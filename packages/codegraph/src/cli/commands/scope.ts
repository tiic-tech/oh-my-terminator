/**
 * @fileoverview CLI scope command implementation
 *
 * WHY: Provides scope query functionality via CLI.
 * Enables developers to inspect FILE, MODULE, or EXTERNAL nodes.
 *
 * Flow:
 * 1. Validate project (path existence + git repo + commits)
 * 2. Load baseline
 * 3. Call getScope(graph, target)
 * 4. Return structured result
 *
 * @see fix-e2e-report-all-issues tasks 2.1-2.2
 */

import { loadBaseline } from '../../persistence/index.js';
import { validateProject } from '../validation.js';
import { CliErrorCode, type CliError } from '../../types.js';
import { getScope } from '../../api/scope/index.js';
import type { ScopeResult, ScopeError } from '../../api/types/index.js';

// ============================================================================
// Command Options
// ============================================================================

/**
 * Options for scope command
 */
export interface ScopeOptions {
  /** Output as JSON (for programmatic consumption) */
  json?: boolean;
  /** Include all imports/exports (not filtered) */
  all?: boolean;
}

// ============================================================================
// Result Type
// ============================================================================

/**
 * Scope command result type
 *
 * Discriminated union: success field determines which type to use.
 */
export type ScopeCommandResult = ScopeResult | ScopeError | CliError;

// ============================================================================
// Main Command Implementation
// ============================================================================

/**
 * Execute scope command
 *
 * Queries scope for a FILE, MODULE, or EXTERNAL target.
 *
 * @param cwd - Project root directory
 * @param target - Target ID (FILE:xxx, MODULE:xxx#yyy, EXTERNAL:xxx, or plain path)
 * @param _options - Command options (reserved for future filtering features)
 * @returns ScopeResult on success, ScopeError or CliError on failure
 */
export async function scopeCommand(
  cwd: string,
  target: string,
  _options?: ScopeOptions
): Promise<ScopeCommandResult> {
  const startTime = Date.now();

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
  // Step 3: Call getScope API
  // ========================================
  const scopeResult = getScope(graph, target);

  // ========================================
  // Step 4: Return Result
  // ========================================
  // getScope returns ScopeResult | ScopeError
  // Both have durationMs already set by API
  // For consistency, we return the result directly

  // If CliError (baseline validation error), durationMs is already set
  // If ScopeResult/ScopeError, getScope already set durationMs
  // Override with our measured duration for CLI accuracy
  scopeResult.durationMs = Date.now() - startTime;

  return scopeResult;
}