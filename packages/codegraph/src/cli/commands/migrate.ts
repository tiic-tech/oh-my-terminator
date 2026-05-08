/**
 * @fileoverview CLI migrate command implementation
 *
 * WHY: Provides manual migration from baseline 1.0 to compressed 1.1 format.
 * Enables users to migrate existing baselines without re-analyzing.
 *
 * Flow:
 * 1. Read input baseline file
 * 2. Detect format version (1.0 or 1.1)
 * 3. If 1.0, apply migrate1_0To1_1() transformation
 * 4. Write output to specified path
 * 5. Report migration statistics
 *
 * @see tasks.md 6.4-6.7
 */

import { readFile, writeFile, stat } from 'node:fs/promises';
import {
  type MigrateResult,
  type MigrateStats,
  type MigrateOptions,
  type CliError,
  type CompressionConfig,
  CliErrorCode,
} from '../../types.js';
import { migrate1_0To1_1, detectBaselineFormat } from '../../persistence/migrations/1.0-to-1.1.js';
import type { Baseline } from '../../persistence/types/index.js';

// ============================================================================
// Main Command Implementation
// ============================================================================

/**
 * Execute migrate command
 *
 * Migrates baseline from 1.0 format to compressed 1.1 format.
 *
 * @param options - Migrate options with input and output paths
 * @returns MigrateResult on success, CliError on failure
 *
 * @example
 * ```ts
 * const result = await migrateCommand({
 *   input: '/path/to/old-baseline.json',
 *   output: '/path/to/new-baseline.json'
 * });
 * ```
 */
export async function migrateCommand(
  options: MigrateOptions
): Promise<MigrateResult | CliError> {
  const startTime = Date.now();

  // ========================================
  // Step 1: Validate Input File Exists
  // ========================================
  try {
    await stat(options.input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: {
        code: CliErrorCode.E_INVALID_PATH,
        message: `Input file not found: ${options.input}. ${message}`,
      },
      durationMs: Date.now() - startTime,
    };
  }

  // ========================================
  // Step 2: Read Input Baseline
  // ========================================
  let inputContent: string;
  try {
    inputContent = await readFile(options.input, 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: {
        code: CliErrorCode.E_PARSE_FAILED,
        message: `Failed to read input file: ${message}`,
      },
      durationMs: Date.now() - startTime,
    };
  }

  const inputSizeBytes = Buffer.byteLength(inputContent, 'utf-8');

  // ========================================
  // Step 3: Parse Input JSON
  // ========================================
  let inputData: unknown;
  try {
    inputData = JSON.parse(inputContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: {
        code: CliErrorCode.E_PARSE_FAILED,
        message: `Failed to parse input JSON: ${message}`,
      },
      durationMs: Date.now() - startTime,
    };
  }

  // ========================================
  // Step 4: Detect Format Version
  // ========================================
  const format = detectBaselineFormat(inputData);

  if (format === '1.1') {
    // Already in compressed format - just copy
    try {
      await writeFile(options.output, inputContent, 'utf-8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: {
          code: CliErrorCode.E_PARSE_FAILED,
          message: `Failed to write output file: ${message}`,
        },
        durationMs: Date.now() - startTime,
      };
    }

    const stats: MigrateStats = {
      inputSizeBytes,
      outputSizeBytes: inputSizeBytes,
      savingsPercent: 0,
      pathTableEntries: (inputData as { pathTable?: string[] }).pathTable?.length ?? 0,
    };

    return {
      success: true,
      stats,
      inputPath: options.input,
      outputPath: options.output,
      durationMs: Date.now() - startTime,
    };
  }

  if (format === 'legacy') {
    return {
      success: false,
      error: {
        code: CliErrorCode.E_CORRUPTED_BASELINE,
        message: 'Input file is in legacy pre-versioning format. Run `codegraph analyze` to create a fresh baseline.',
      },
      durationMs: Date.now() - startTime,
    };
  }

  // ========================================
  // Step 5: Apply Migration (1.0 → 1.1)
  // ========================================
  const config: CompressionConfig = {
    compression: {
      enabled: true,
      jsDocMaxLength: 100,
    },
  };

  const baselineData = inputData as Baseline;
  const migrated = migrate1_0To1_1(baselineData, config);

  // ========================================
  // Step 6: Write Output
  // ========================================
  const outputContent = JSON.stringify(migrated, null, 2);
  const outputSizeBytes = Buffer.byteLength(outputContent, 'utf-8');

  try {
    await writeFile(options.output, outputContent, 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: {
        code: CliErrorCode.E_PARSE_FAILED,
        message: `Failed to write output file: ${message}`,
      },
      durationMs: Date.now() - startTime,
    };
  }

  // ========================================
  // Step 7: Calculate Statistics
  // ========================================
  const savingsPercent = inputSizeBytes > 0
    ? Math.round(((inputSizeBytes - outputSizeBytes) / inputSizeBytes) * 100)
    : 0;

  const stats: MigrateStats = {
    inputSizeBytes,
    outputSizeBytes,
    savingsPercent: Math.max(0, savingsPercent), // Ensure non-negative
    pathTableEntries: migrated.pathTable.length,
  };

  // ========================================
  // Step 8: Return Result
  // ========================================
  return {
    success: true,
    stats,
    inputPath: options.input,
    outputPath: options.output,
    durationMs: Date.now() - startTime,
  };
}