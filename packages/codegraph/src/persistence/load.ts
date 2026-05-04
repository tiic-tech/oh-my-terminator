/**
 * @fileoverview Baseline loading from file path with format detection
 *
 * WHY: Enables loading baselines from arbitrary file paths with automatic
 * format detection and migration. Provides transparent decompression.
 *
 * Format handling (5.3-5.5):
 * - 1.1 (has pathTable): Use deserializeCompressed() directly
 * - 1.0 (has graph.nodes/edges): Migrate to 1.1, then deserialize
 * - legacy: Attempt migration or throw error
 *
 * @param path - Absolute file path to baseline file
 * @returns CodeGraph with reconstructed nodes and edges
 * @throws Error if baseline is corrupted or format is unrecognized
 *
 * @see design.md D5: Schema Version Migration
 */

import { readFile } from 'node:fs/promises';
import { detectBaselineFormat, migrate1_0To1_1 } from './migrations/1.0-to-1.1.js';
import { deserializeCompressed } from './compression/serializer.js';
import { CorruptedBaselineError } from './compression/errors.js';
import { CodeGraph } from '../graph.js';
import type {
  Baseline,
  CompressionConfig,
  CompressedBaseline,
} from './types/index.js';

// ============================================================================
// Main Loading Function
// ============================================================================

/**
 * Load baseline from file path with automatic format detection
 *
 * WHY: Transparent decompression enables backward compatibility.
 * Consumers receive CodeGraph regardless of underlying format.
 *
 * @param path - Absolute file path to baseline.json
 * @returns CodeGraph with reconstructed nodes and edges
 * @throws Error if file read fails, JSON parse fails, or baseline is corrupted
 *
 * @example
 * ```ts
 * const graph = await loadBaselineFile('/project/.codegraph/baseline.json');
 * // graph is CodeGraph regardless of whether file was 1.0 or 1.1 format
 * ```
 */
export async function loadBaselineFile(path: string): Promise<CodeGraph> {
  // Step 1: Read file content
  const content = await readFile(path, 'utf-8');

  // Step 2: Parse JSON
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch (parseError) {
    throw new Error(`Failed to parse baseline JSON: ${parseError}`);
  }

  // Step 3: Detect format
  const format = detectBaselineFormat(data);

  // Step 4: Process based on format
  switch (format) {
    case '1.1':
      // Compressed format - deserialize directly
      return deserializeFrom1_1(data as CompressedBaseline);

    case '1.0':
      // Legacy format - migrate then deserialize
      return deserializeFrom1_0(data as Baseline);

    case 'legacy':
      // Pre-versioning format - attempt migration
      // This format has no schemaVersion, treat as 1.0
      return deserializeFrom1_0(data as Baseline);

    default:
      throw new CorruptedBaselineError(
        `Unrecognized baseline format: ${format}`,
        { path, data }
      );
  }
}

// ============================================================================
// Format-Specific Deserialization
// ============================================================================

/**
 * Deserialize CompressedBaseline (1.1 format) to CodeGraph
 *
 * WHY: Direct deserialization is fastest for modern baselines.
 *
 * @param data - CompressedBaseline data with pathTable
 * @returns CodeGraph with reconstructed nodes and edges
 */
function deserializeFrom1_1(data: CompressedBaseline): CodeGraph {
  return deserializeCompressed(data);
}

/**
 * Deserialize Baseline (1.0 format) to CodeGraph via migration
 *
 * WHY: Migration enables backward compatibility with legacy baselines.
 * Flow: 1.0 → migrate1_0To1_1 → 1.1 → deserializeCompressed → CodeGraph
 *
 * @param data - Baseline data with graph.nodes/edges
 * @returns CodeGraph with reconstructed nodes and edges
 */
function deserializeFrom1_0(data: Baseline): CodeGraph {
  // Use default compression config for migration
  const config: CompressionConfig = {
    compression: {
      enabled: true,
      jsDocMaxLength: 100,
    },
  };

  // Migrate 1.0 → 1.1
  const compressed = migrate1_0To1_1(data, config);

  // Deserialize 1.1 → CodeGraph
  return deserializeCompressed(compressed);
}

// ============================================================================
// Additional Metadata Extraction
// ============================================================================

/**
 * Load baseline metadata without full deserialization
 *
 * WHY: Quick access to commitHash, timestamp, schemaVersion for compatibility checks.
 * Avoids full graph reconstruction when only metadata is needed.
 *
 * @param path - Absolute file path to baseline.json
 * @returns Metadata object with commitHash, timestamp, schemaVersion
 */
export async function loadBaselineMetadata(path: string): Promise<{
  commitHash: string;
  timestamp: number;
  schemaVersion?: { major: number; minor: number; patch: number };
}> {
  const content = await readFile(path, 'utf-8');

  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch (parseError) {
    throw new Error(`Failed to parse baseline JSON: ${parseError}`);
  }

  const format = detectBaselineFormat(data);

  if (format === '1.1') {
    const compressed = data as CompressedBaseline;
    return {
      commitHash: compressed.commitHash,
      timestamp: compressed.timestamp,
      schemaVersion: compressed.schemaVersion,
    };
  }

  if (format === '1.0' || format === 'legacy') {
    const baseline = data as Baseline;
    return {
      commitHash: baseline.commitHash,
      timestamp: baseline.timestamp,
      schemaVersion: baseline.schemaVersion,
    };
  }

  throw new CorruptedBaselineError(
    `Unrecognized baseline format for metadata extraction`,
    { path }
  );
}