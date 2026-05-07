/**
 * @fileoverview CLI source root resolution utilities
 *
 * WHY: Centralizes source root resolution logic for CLI commands.
 * Implements precedence: explicit --source-root > auto-detect > error.
 *
 * Precedence logic:
 * 1. If --source-root provided: validate and use it directly
 * 2. If --no-auto-detect and no --source-root: throw error
 * 3. Otherwise: call detectSourceRoot(cwd), use result or throw error
 *
 * @see openspec/changes/cg-source-root-auto-detect/design.md
 */

import { resolve, isAbsolute } from 'node:path';
import { stat } from 'node:fs/promises';
import { detectSourceRoot } from '../../core/index.js';
import { CliErrorCode, type CliError } from '../../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for source root resolution
 *
 * WHY: Structured options enable clean API without positional arguments.
 */
export interface ResolveSourceRootOptions {
  /** Explicit source root from CLI --source-root flag */
  sourceRoot?: string;
  /** Whether auto-detection is disabled (--no-auto-detect) */
  noAutoDetect?: boolean;
  /** Current working directory (defaults to process.cwd()) */
  cwd?: string;
}

/**
 * Result of source root resolution
 *
 * WHY: Discriminated union enables type-safe handling of success/failure cases.
 * success field narrows to either path or error.
 */
export type ResolveSourceRootResult =
  | { success: true; path: string; method: 'explicit' | 'auto-detect'; marker?: string }
  | CliError;

// ============================================================================
// Constants
// ============================================================================

/**
 * WHY: Consistent error messages across commands.
 * Single source of truth for user-facing guidance.
 */
const ERROR_MESSAGES = {
  autoDetectDisabled: 'Auto-detection disabled. Use --source-root to specify project root.',
  sourceRootNotFound: 'Source root not found. Use --source-root to specify project root explicitly.',
  invalidSourceRoot: (path: string) => `Invalid source root: ${path} does not exist or is not a directory.`,
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calculates elapsed duration from a start time.
 *
 * WHY: L3 FIX - Duration calculation was repeated 4 times.
 * Extracted to helper for single source of truth (One Truth principle).
 *
 * @param startTime - Start timestamp (from Date.now())
 * @returns Elapsed milliseconds
 */
function calculateDuration(startTime: number): number {
  return Date.now() - startTime;
}

// ============================================================================
// Main Resolution Function
// ============================================================================

/**
 * Resolve source root with precedence logic
 *
 * WHY: Single entry point for all CLI commands needing source root.
 * Handles all edge cases with structured error responses.
 *
 * @param options - Resolution options (sourceRoot, noAutoDetect, cwd)
 * @returns ResolveSourceRootResult with path on success, CliError on failure
 */
export async function resolveSourceRoot(
  options: ResolveSourceRootOptions
): Promise<ResolveSourceRootResult> {
  const cwd = options.cwd ?? process.cwd();
  const startTime = Date.now();

  // ========================================
  // Precedence 1: Explicit --source-root
  // ========================================
  if (options.sourceRoot) {
    const validation = await validateExplicitSourceRoot(options.sourceRoot, cwd);
    if (!validation.isValid) {
      return {
        success: false,
        error: {
          code: CliErrorCode.E_INVALID_PATH,
          message: validation.error!,
        },
        durationMs: calculateDuration(startTime),
      };
    }
    return {
      success: true,
      path: validation.path,
      method: 'explicit',
    };
  }

  // ========================================
  // Precedence 2: --no-auto-detect requires explicit
  // ========================================
  if (options.noAutoDetect) {
    return {
      success: false,
      error: {
        code: CliErrorCode.E_AUTO_DETECT_DISABLED,
        message: ERROR_MESSAGES.autoDetectDisabled,
        suggestion: 'Example: codegraph analyze --source-root /path/to/project',
      },
      durationMs: calculateDuration(startTime),
    };
  }

  // ========================================
  // Precedence 3: Auto-detect
  // ========================================
  const detection = await detectSourceRoot(cwd);

  if (!detection.success) {
    return {
      success: false,
      error: {
        code: CliErrorCode.E_SOURCE_ROOT_NOT_FOUND,
        message: detection.error ?? ERROR_MESSAGES.sourceRootNotFound,
        suggestion: 'Example: codegraph analyze --source-root /path/to/project',
        debug: `Searched from: ${cwd}`,
      },
      durationMs: calculateDuration(startTime),
    };
  }

  return {
    success: true,
    path: detection.path!,
    method: 'auto-detect',
    marker: detection.markerFound,
  };
}

// ============================================================================
// Helper: Validate Explicit Source Root
// ============================================================================

/**
 * Validate user-provided source root path
 *
 * WHY: Explicit paths need validation before use.
 * Ensures path exists and is a directory.
 *
 * @param sourceRoot - User-provided path (may be relative)
 * @param cwd - Current working directory for relative path resolution
 * @returns Validation result with absolute path or error
 */
async function validateExplicitSourceRoot(
  sourceRoot: string,
  cwd: string
): Promise<{ isValid: boolean; path: string; error?: string }> {
  // Resolve relative to cwd if not absolute
  const absolutePath = isAbsolute(sourceRoot)
    ? sourceRoot
    : resolve(cwd, sourceRoot);

  try {
    const stats = await stat(absolutePath);
    if (!stats.isDirectory()) {
      return {
        isValid: false,
        path: absolutePath,
        error: ERROR_MESSAGES.invalidSourceRoot(absolutePath),
      };
    }
    return {
      isValid: true,
      path: absolutePath,
    };
  } catch {
    return {
      isValid: false,
      path: absolutePath,
      error: ERROR_MESSAGES.invalidSourceRoot(absolutePath),
    };
  }
}

// ============================================================================
// Helper: Format Detection Result for Logging
// ============================================================================

/**
 * Format detection result for verbose output
 *
 * WHY: Provides human-readable summary of detection outcome.
 * Useful for debugging and user awareness.
 *
 * @param result - Resolution result
 * @returns Human-readable summary string
 */
export function formatDetectionSummary(result: ResolveSourceRootResult): string {
  if (!result.success) {
    return `Detection failed: ${result.error.message}`;
  }

  if (result.method === 'explicit') {
    return `Using explicit source root: ${result.path}`;
  }

  return `Auto-detected source root: ${result.path} (found ${result.marker})`;
}