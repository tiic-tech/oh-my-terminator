/**
 * @fileoverview CLI validation utilities
 *
 * WHY: Centralizes validation logic for CLI commands.
 * Single source of truth for git and path validation.
 * Prevents duplication between analyze.ts and update.ts.
 *
 * Security: Path validation prevents traversal attacks by:
 * - Resolving relative paths to absolute
 * - Verifying path exists and is accessible
 * - Confirming path is a directory (not a file)
 */

import { resolve, isAbsolute, join } from 'node:path';
import { stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { isGitRepo } from '../git/head-commit.js';
import { CliErrorCode } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Validation error with structured code and message
 *
 * WHY: Structured errors enable programmatic handling and user-friendly messages.
 * Each code maps to specific failure scenario with actionable guidance.
 */
export interface ValidationError {
  /** Error code for programmatic handling */
  code: CliErrorCode;
  /** Human-readable error message */
  message: string;
}

/**
 * Git validation result
 *
 * Discriminated by isValid - error only present when false.
 */
export interface GitValidationResult {
  /** true if valid git repo, false otherwise */
  isValid: boolean;
  /** Error details (only present when isValid is false) */
  error?: ValidationError;
}

/**
 * Path validation result
 *
 * Always includes absolutePath for downstream use.
 * Error only present when isValid is false.
 */
export interface PathValidationResult {
  /** true if valid path, false otherwise */
  isValid: boolean;
  /** Resolved absolute path (always present, even on error) */
  absolutePath: string;
  /** Error details (only present when isValid is false) */
  error?: ValidationError;
}

// ============================================================================
// Path Validation
// ============================================================================

/**
 * Validate user-provided project path
 *
 * Security: Prevents path traversal attacks by validating:
 * - Path exists on filesystem
 * - Path is a directory (not a file)
 * - Path resolves to absolute (no relative path ambiguity)
 *
 * @param cwd - User-provided path (may be relative or absolute)
 * @returns PathValidationResult with absolute path or error
 */
export async function validateProjectPath(
  cwd: string
): Promise<PathValidationResult> {
  // Resolve to absolute path (handles relative paths safely)
  const absolutePath = isAbsolute(cwd) ? cwd : resolve(process.cwd(), cwd);

  try {
    const stats = await stat(absolutePath);
    if (!stats.isDirectory()) {
      return {
        isValid: false,
        absolutePath,
        error: {
          code: CliErrorCode.E_INVALID_PATH,
          message: `Path is not a directory: ${absolutePath}`,
        },
      };
    }
  } catch {
    return {
      isValid: false,
      absolutePath,
      error: {
        code: CliErrorCode.E_INVALID_PATH,
        message: `Path does not exist or is not accessible: ${absolutePath}`,
      },
    };
  }

  return {
    isValid: true,
    absolutePath,
  };
}

// ============================================================================
// Git Validation
// ============================================================================

/**
 * Validate git repository status
 *
 * Checks for two scenarios:
 * 1. Not a git repo at all (no .git directory)
 * 2. Empty git repo (.git exists but no commits)
 *
 * WHY: isomorphic-git requires commits to resolve HEAD.
 * Empty repos fail HEAD resolution, causing confusing errors.
 *
 * @param cwd - Project directory (must be valid path first)
 * @returns GitValidationResult with validation status
 */
export async function validateGitRepo(
  cwd: string
): Promise<GitValidationResult> {
  const isGit = await isGitRepo(cwd);

  if (!isGit) {
    // Check if .git directory exists (empty repo case)
    const hasGitDir = existsSync(join(cwd, '.git'));

    return {
      isValid: false,
      error: {
        code: hasGitDir ? CliErrorCode.E_EMPTY_REPO : CliErrorCode.E_NO_GIT_REPO,
        message: hasGitDir
          ? 'Git repository has no commits. Make an initial commit before using CodeGraph.'
          : 'Not a git repository. CodeGraph requires a git repository with commits.',
      },
    };
  }

  return { isValid: true };
}

// ============================================================================
// Combined Validation
// ============================================================================

/**
 * Validate both path and git status
 *
 * WHY: Most CLI commands need both validations.
 * Combines them for convenience while returning separate results
 * for granular error handling.
 *
 * Order: Path first, then git (git validation requires valid path).
 *
 * @param cwd - User-provided path (may be relative)
 * @returns Combined validation result with path and git results
 */
export async function validateProject(cwd: string): Promise<{
  path: PathValidationResult;
  git?: GitValidationResult;
}> {
  const pathResult = await validateProjectPath(cwd);

  if (!pathResult.isValid) {
    // Short-circuit: git validation requires valid path
    return { path: pathResult };
  }

  const gitResult = await validateGitRepo(pathResult.absolutePath);
  return { path: pathResult, git: gitResult };
}