/**
 * @fileoverview Git HEAD commit resolution
 *
 * WHY: Provides simple Git commit resolution for baseline tracking.
 * Used during full analysis to record current commit, and during
 * incremental update to compare against baseline.
 *
 * @see 09_c9_isomorphic_git_spec.md Section 5.1
 */

import * as git from 'isomorphic-git';
import { fs } from './fs-adapter.js';

// ============================================================================
// HEAD Commit Resolution
// ============================================================================

/**
 * Get current HEAD commit hash
 *
 * Resolves HEAD reference to full SHA-1 commit hash.
 * Works with both regular branches and detached HEAD.
 *
 * @param cwd - Project root directory
 * @returns Full commit SHA (40 characters)
 * @throws Error if not in Git repository or HEAD cannot be resolved
 */
export async function getHeadCommit(cwd: string): Promise<string> {
  try {
    const headRef = await git.resolveRef({
      fs,
      dir: cwd,
      ref: 'HEAD',
    });
    return headRef;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to resolve HEAD: ${message}`);
  }
}

// ============================================================================
// Git Repository Check
// ============================================================================

/**
 * Check if directory is a Git repository
 *
 * Attempts to resolve HEAD - succeeds if Git repo with commits exists.
 * Returns false for:
 * - Non-Git directories
 * - Git repos without any commits (empty .git folder)
 *
 * @param cwd - Directory to check
 * @returns True if Git repository with commits
 */
export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await git.resolveRef({
      fs,
      dir: cwd,
      ref: 'HEAD',
    });
    return true;
  } catch {
    return false;
  }
}