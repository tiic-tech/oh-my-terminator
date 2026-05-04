/**
 * @fileoverview Baseline saving with atomic write and compression support for CodeGraph
 *
 * WHY: Atomic write prevents corruption during concurrent writes and crash mid-write.
 * Strategy: Write to .tmp file → fs.rename (atomic on POSIX) → final location
 *
 * Compression support (5.1-5.2):
 * - compress=true (default): Save as CompressedBaseline format 1.1
 * - compress=false: Save as legacy SerializedCodeGraph format 1.0
 *
 * Steps:
 * 1. Ensure .codegraph directory exists
 * 2. Optionally create backup of existing baseline
 * 3. Write JSON to .tmp file (compressed or uncompressed)
 * 4. Atomic rename to baseline.json
 * 5. Update lastCommit.txt
 * 6. Optionally create .version file
 *
 * @see 06_c6_baseline_version_spec.md Section 5
 * @see design.md D1-D4 compression decisions
 */

import { writeFile, rename, stat, copyFile } from 'node:fs/promises';
import type {
  Baseline,
  SaveBaselineOptions,
  CompressionConfig,
  CompressedBaseline,
} from './types/index.js';
import {
  getBaselinePath,
  getBackupPath,
  getVersionPath,
  getLastCommitPath,
  getTempPath,
  getCodegraphDirPath,
} from './paths.js';
import { serializeCompressed } from './compression/serializer.js';
import { CodeGraph } from '../graph.js';

// ============================================================================
// Main Saving Function
// ============================================================================

/**
 * Save baseline with atomic write and optional compression
 *
 * WHY: Atomic write prevents corruption through:
 * 1. Write to temp file first (complete data before moving)
 * 2. Atomic rename (POSIX guarantees no partial state)
 * 3. Backup creation (preserve previous state)
 *
 * Compression behavior:
 * - compress=true (default): Saves as CompressedBaseline (1.1 format)
 * - compress=false: Saves as legacy Baseline (1.0 format)
 *
 * @param baseline - Complete baseline to save
 * @param cwd - Project working directory
 * @param options - Save options (backup, version file, permissions, compress)
 */
export async function saveBaseline(
  baseline: Baseline,
  cwd: string,
  options?: SaveBaselineOptions
): Promise<void> {
  const baselinePath = getBaselinePath(cwd);
  const tempPath = getTempPath(cwd);

  // Step 1: Ensure directory exists
  const codegraphDir = getCodegraphDirPath(cwd);
  try {
    await stat(codegraphDir);
  } catch {
    // Directory doesn't exist - throw error
    throw new Error(`Directory does not exist: ${codegraphDir}`);
  }

  // Step 2: Create backup if requested and baseline exists
  if (options?.createBackup) {
    try {
      await stat(baselinePath);
      // Baseline exists, create backup
      const backupPath = getBackupPath(cwd);
      await copyFile(baselinePath, backupPath);
    } catch {
      // Baseline doesn't exist, skip backup
    }
  }

  // Step 3: Serialize baseline (with or without compression)
  // Default: compress=true (compression enabled by default)
  const compress = options?.compress ?? true;
  const content = serializeBaseline(baseline, compress);

  // Step 4: Write to temp file
  const mode = options?.mode ?? 0o644;
  await writeFile(tempPath, content, { mode });

  // Step 5: Atomic rename to final location
  await rename(tempPath, baselinePath);

  // Step 6: Update lastCommit.txt
  const lastCommitPath = getLastCommitPath(cwd);
  await writeFile(lastCommitPath, baseline.commitHash, { mode });

  // Step 7: Optionally create .version file
  // Use 1.1.0 for compressed format, baseline.schemaVersion for legacy format
  if (options?.createVersionFile) {
    const versionPath = getVersionPath(cwd);
    // When compress=true, version is 1.1.0; when compress=false, use baseline's version
    const versionString = compress
      ? '1.1.0'
      : `${baseline.schemaVersion.major}.${baseline.schemaVersion.minor}.${baseline.schemaVersion.patch}`;
    await writeFile(versionPath, versionString, { mode });
  }
}

// ============================================================================
// Serialization Helpers
// ============================================================================

/**
 * Serialize baseline with optional compression
 *
 * WHY: Compression reduces baseline size by 20-60% for Agent token budgets.
 * Default compression config: jsDocMaxLength=100
 *
 * @param baseline - Baseline to serialize
 * @param compress - Whether to use compression (default: true)
 * @returns JSON string of serialized baseline
 */
function serializeBaseline(baseline: Baseline, compress: boolean): string {
  if (compress) {
    // Convert Baseline.graph (SerializedCodeGraph) to CodeGraph for compression
    const graphData = baseline.graph;
    const graph = CodeGraph.fromJSON(graphData);

    // Ensure graph metadata matches baseline metadata
    // WHY: Baseline.commitHash may differ from graph.commitHash (e.g., after manual update)
    graph.commitHash = baseline.commitHash;
    graph.timestamp = baseline.timestamp;

    // Use default compression config
    const config: CompressionConfig = {
      compression: {
        enabled: true,
        jsDocMaxLength: 100,
      },
    };

    const compressed: CompressedBaseline = serializeCompressed(graph, config);

    // Add additional baseline metadata to compressed format
    // (schemaVersion is already added by serializeCompressed)
    return JSON.stringify({
      ...compressed,
      // Preserve additional baseline metadata for backward compatibility
      generatorVersion: baseline.generatorVersion,
      architectureConstraints: baseline.architectureConstraints,
      healthScore: baseline.healthScore,
      skillDemand: baseline.skillDemand,
      migrationHistory: baseline.migrationHistory,
      deprecated: baseline.deprecated,
    }, null, 2);
  } else {
    // Legacy format (1.0) - no compression
    return JSON.stringify(baseline, null, 2);
  }
}