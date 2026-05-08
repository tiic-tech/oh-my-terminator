/**
 * @fileoverview Shared path format utilities for CLI commands
 *
 * WHY: Eliminates duplicate code between scope.ts and impact.ts (C15 CRITICAL issue).
 * Single source of truth for path format detection logic.
 *
 * Functions:
 * - isMonorepo: Check packages/ directory existence
 * - matchesMonorepoPathFormat: Regex validation for valid monorepo paths
 * - addPathFormatHint: Generic function to add suggestion to error results
 *
 * @see coding-taste: One Truth, Not Two - eliminate duplication
 */

import * as fs from 'fs';
import * as path from 'path';
import { ErrorCode } from '../../api/types/index.js';

// ============================================================================
// Path Format Detection
// ============================================================================

/**
 * Check if project is monorepo (has packages/ directory)
 *
 * WHY: Path format hints vary by project structure.
 * Monorepo uses packages/<pkg>/src/..., single-project uses src/...
 *
 * @param projectRoot - Absolute path to project root
 * @returns true if packages/ directory exists
 */
export function isMonorepo(projectRoot: string): boolean {
  return fs.existsSync(path.join(projectRoot, 'packages'));
}

/**
 * Check if path matches monorepo format
 *
 * WHY: If path already matches format, suppress hint (file doesn't exist but format correct).
 *
 * Pattern: packages/<pkg>/src/<file>.<ext>
 * - Package name: lowercase letters and hyphens only
 * - Extension: ts, tsx, js, jsx
 *
 * @param userPath - User-provided path string
 * @returns true if path matches monorepo format
 */
export function matchesMonorepoPathFormat(userPath: string): boolean {
  return /^packages\/[a-z-]+\/src\/.+\.(ts|tsx|js|jsx)$/.test(userPath);
}

/**
 * Add path format hint to error result if applicable
 *
 * WHY: Users often use wrong path format in monorepos.
 * Example: src/utils.ts instead of packages/codegraph/src/utils.ts
 *
 * GENERIC: Works with any error result type (ScopeError, ImpactError, etc.)
 * Uses spread operator for immutability.
 *
 * @param result - Error result object
 * @param projectRoot - Absolute path to project root
 * @param userPath - User-provided path string
 * @param errorCode - Error code to check (defaults to TARGET_NOT_FOUND)
 * @returns New error result with hint added, or original if no hint needed
 */
export function addPathFormatHint<T extends { success: false; error: { code: string; suggestion?: string }; durationMs: number }>(
  result: T,
  projectRoot: string,
  userPath: string,
  errorCode: string = ErrorCode.TARGET_NOT_FOUND
): T {
  // Only add hint for specified error code (default: TARGET_NOT_FOUND)
  if (result.error.code !== errorCode) {
    return result;
  }

  // Check if path format hint is needed
  if (isMonorepo(projectRoot) && !matchesMonorepoPathFormat(userPath)) {
    return {
      ...result,
      error: {
        ...result.error,
        suggestion: 'Hint: Use full path format: packages/<pkg>/src/<file>.ts',
      },
    };
  }

  return result;
}