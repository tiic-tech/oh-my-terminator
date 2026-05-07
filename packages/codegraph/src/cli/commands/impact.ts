/**
 * @fileoverview CLI impact command implementation
 *
 * WHY: Provides impact analysis by finding all files that depend on target files.
 * Uses BFS traversal on IMPORTS edges to determine blast radius.
 *
 * Flow:
 * 1. Validate project (path existence + git repo)
 * 2. Load baseline (graph must exist)
 * 3. Normalize target (add FILE: prefix if missing)
 * 4. Call getImpact API
 * 5. Add path format hint on error
 * 6. Return structured result
 */

import { validateProject } from '../validation.js';
import { loadBaseline } from '../../persistence/index.js';
import { getImpact } from '../../api/impact/index.js';
import { CliErrorCode } from '../../types.js';
import type { CliError } from '../../types.js';
import type { ImpactResult, ImpactError, ImpactOptions } from '../../api/types/index.js';
import { addPathFormatHint } from '../utils/path-format.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * WHY: Default max files limit balances two concerns:
 * 1. Agent token budgets: Large impact sets (>100 files) exceed LLM context limits
 * 2. User comprehension: Humans struggle to process >30 items in a list
 * 20 is a safe default that fits most agent workflows while remaining readable.
 */
const DEFAULT_MAX_FILES = 20;

// ============================================================================
// Command Options
// ============================================================================

/**
 * Options for impact command
 *
 * Inherits from ImpactOptions with CLI-specific additions.
 */
export interface ImpactCommandOptions extends ImpactOptions {
  /** Output as JSON (for programmatic consumption) */
  json?: boolean;
}

// ============================================================================
// Result Type
// ============================================================================

/**
 * Impact command result type
 *
 * Discriminated union: success field determines which type to use.
 * - ImpactResult: successful impact analysis
 * - ImpactError: API error (target not found, etc.)
 * - CliError: CLI error (baseline not found, validation failed, etc.)
 */
export type ImpactCommandResult = ImpactResult | ImpactError | CliError;

// ============================================================================
// Main Command Implementation
// ============================================================================

/**
 * Execute impact command
 *
 * Finds all files that depend on the target file(s).
 *
 * @param cwd - Project root directory
 * @param target - Target file path (with or without FILE: prefix)
 * @param options - Command options (maxFiles, includeTests, maxDepth)
 * @returns ImpactResult on success, CliError on failure
 */
export async function impactCommand(
  cwd: string,
  target: string,
  options?: ImpactCommandOptions
): Promise<ImpactCommandResult> {
  const startTime = Date.now();

  // Default options: maxFiles from constant for agent token budgets
  const impactOptions: ImpactOptions = {
    maxFiles: options?.maxFiles ?? DEFAULT_MAX_FILES,
    includeTests: options?.includeTests ?? false,
    maxDepth: options?.maxDepth,
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
  // Step 3: Normalize Target
  // ========================================
  // Accept both 'src/utils.ts' and 'FILE:src/utils.ts'
  const normalizedTarget = target.startsWith('FILE:') ? target : `FILE:${target}`;

  // ========================================
  // Step 4: Call getImpact API
  // ========================================
  const impactResult = getImpact(graph, [normalizedTarget], impactOptions);

  // ========================================
  // Step 5: Add Path Format Hint on Error
  // ========================================
  // WHY: If target not found and path format is wrong, show hint
  if (!impactResult.success) {
    const impactError = impactResult as ImpactError;
    const enhancedError = addPathFormatHint(impactError, projectRoot, target);
    // WHY spread: Immutability - create new object instead of mutation
    return { ...enhancedError, durationMs: Date.now() - startTime };
  }

  // ========================================
  // Step 6: Return Result
  // ========================================
  // WHY spread: Immutability - create new object instead of mutation
  return { ...impactResult, durationMs: Date.now() - startTime };
}