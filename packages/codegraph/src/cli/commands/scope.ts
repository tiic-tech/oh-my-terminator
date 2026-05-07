/**
 * @fileoverview CLI scope command implementation
 *
 * WHY: Provides scope query functionality via CLI.
 * Enables developers to inspect FILE, MODULE, or EXTERNAL nodes.
 *
 * Flow:
 * 1. Resolve source root (precedence: explicit > auto-detect > error)
 * 2. Validate project (path existence + git repo + commits)
 * 3. Load baseline
 * 4. Call getScope(graph, target)
 * 5. Return structured result with path format hints on error
 *
 * @see fix-e2e-report-all-issues tasks 2.1-2.2
 * @see openspec/changes/cg-source-root-auto-detect/design.md D1-D6
 */

import { loadBaseline } from '../../persistence/index.js';
import { validateProject } from '../validation.js';
import { CliErrorCode, type CliError } from '../../types.js';
import { getScope } from '../../api/scope/index.js';
import type { ScopeResult, ScopeError } from '../../api/types/index.js';
import { addPathFormatHint } from '../utils/path-format.js';
import { resolveSourceRoot } from '../utils/resolve-source-root.js';

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
  /** Explicit source root directory (overrides auto-detection) */
  sourceRoot?: string;
  /** Disable automatic source root detection (requires --source-root) */
  noAutoDetect?: boolean;
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
  // Step 0: Resolve source root (precedence: explicit > auto-detect > error)
  // ========================================
  const sourceRootResult = await resolveSourceRoot({
    sourceRoot: _options?.sourceRoot,
    noAutoDetect: _options?.noAutoDetect,
    cwd,
  });

  if (!sourceRootResult.success) {
    // WHY: Return CliError directly - durationMs already set by resolveSourceRoot
    return sourceRootResult;
  }

  const projectRoot = sourceRootResult.path;

  // ========================================
  // Step 1: Validate Project (Path + Git)
  // ========================================
  const validation = await validateProject(projectRoot);

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
  const validatedRoot = validation.path.absolutePath;

  // ========================================
  // Step 2: Load Baseline
  // ========================================
  const loadResult = await loadBaseline(validatedRoot);

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
  // Step 4: Add Path Format Hint on Error
  // ========================================
  // WHY: If target not found and path format is wrong, show hint
  if (!scopeResult.success) {
    const scopeError = scopeResult as ScopeError;
    const enhancedError = addPathFormatHint(scopeError, validatedRoot, target);
    // WHY spread: Immutability - create new object instead of mutation
    return { ...enhancedError, durationMs: Date.now() - startTime };
  }

  // ========================================
  // Step 5: Return Result
  // ========================================
  // WHY spread: Immutability - create new object instead of mutation
  return { ...scopeResult, durationMs: Date.now() - startTime };
}