/**
 * @fileoverview CLI layers command implementation
 *
 * WHY: Provides architecture layer inference functionality via CLI.
 * Enables developers to visualize layer assignments and detect violations.
 *
 * Flow:
 * 1. Validate project (path existence + git repo)
 * 2. Load baseline
 * 3. Call getArchitectureLayers(graph, options)
 * 4. Return structured result
 *
 * @see Section 4 tasks 4.1-4.2
 */

import { validateProject } from '../validation.js';
import { loadBaseline } from '../../persistence/index.js';
import { getArchitectureLayers } from '../../api/layers/index.js';
import { CliErrorCode } from '../../types.js';
import type { CliError } from '../../types.js';
import type { LayersResult, LayersError, LayersOptions } from '../../api/types/index.js';

// ============================================================================
// Command Options
// ============================================================================

/**
 * Options for layers command
 *
 * Inherits from LayersOptions with CLI-specific additions.
 */
export interface LayersCommandOptions extends LayersOptions {
  /** Output as JSON (for programmatic consumption) */
  json?: boolean;
}

// ============================================================================
// Result Type
// ============================================================================

/**
 * Layers command result type
 *
 * Discriminated union: success field determines which type to use.
 * - LayersResult: successful layers analysis
 * - LayersError: API error (empty graph, etc.)
 * - CliError: CLI error (baseline not found, validation failed, etc.)
 */
export type LayersCommandResult = LayersResult | LayersError | CliError;

// ============================================================================
// Main Command Implementation
// ============================================================================

/**
 * Execute layers command
 *
 * Infer architecture layers from import direction statistics.
 *
 * @param cwd - Project root directory
 * @param options - Command options (sourceRoot, warnOnMutualImport)
 * @returns LayersResult on success, CliError on failure
 */
export async function layersCommand(
  cwd: string,
  options?: LayersCommandOptions
): Promise<LayersCommandResult> {
  const startTime = Date.now();

  // Default options
  const layersOptions: LayersOptions = {
    sourceRoot: options?.sourceRoot ?? 'src',
    warnOnMutualImport: options?.warnOnMutualImport ?? false,
  };

  // ========================================
  // Step 1: Validate Project (Path + Git)
  // ========================================
  const validation = await validateProject(cwd);

  if (!validation.path.isValid) {
    return {
      success: false,
      error: validation.path.error!,
      durationMs: Date.now() - startTime,
    };
  }

  if (!validation.git?.isValid) {
    return {
      success: false,
      error: validation.git!.error!,
      durationMs: Date.now() - startTime,
    };
  }

  // Use validated absolute path
  const projectRoot = validation.path.absolutePath;

  // ========================================
  // Step 2: Load Baseline
  // ========================================
  const loadResult = await loadBaseline(projectRoot);

  if (!loadResult.success || !loadResult.graph) {
    return {
      success: false,
      error: {
        code: CliErrorCode.E_BASELINE_NOT_FOUND,
        message: 'No baseline found. Run `codegraph analyze` first to create initial baseline.',
      },
      durationMs: Date.now() - startTime,
    };
  }

  const graph = loadResult.graph;

  // ========================================
  // Step 3: Call getArchitectureLayers API
  // ========================================
  const layersResult = getArchitectureLayers(graph, layersOptions);

  // ========================================
  // Step 4: Return Result
  // ========================================
  // getArchitectureLayers returns LayersResult | LayersError
  // Both have durationMs already set by API
  // Override with our measured duration for CLI accuracy
  layersResult.durationMs = Date.now() - startTime;

  return layersResult;
}