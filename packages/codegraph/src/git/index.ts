/**
 * @fileoverview Git module exports
 *
 * WHY: Single entry point for all Git-related operations.
 * Provides clean public API for:
 * - Change detection (detectGitChanges, getFileChangesBetweenCommits)
 * - HEAD resolution (getHeadCommit, isGitRepo)
 * - File filtering (isSupportedFile)
 * - fs adapter (for isomorphic-git)
 *
 * @see 09_c9_isomorphic_git_spec.md
 */

// fs adapter for isomorphic-git
export { fs } from './fs-adapter.js';

// Change detection (main API)
export {
  detectGitChanges,
  getFileChangesBetweenCommits,
  isSupportedFile,
  type FileChange,
  type GitChangeResult,
} from './change-detector.js';

// Fallback commit walker (used when tree comparison fails)
export { getFileChangesByWalkingCommits } from './commit-walker.js';

// HEAD commit resolution
export {
  getHeadCommit,
  isGitRepo,
} from './head-commit.js';