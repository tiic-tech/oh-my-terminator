/**
 * @fileoverview Fallback commit walker for git change detection
 *
 * WHY: Separates fallback strategy from main tree walk.
 * Used when git.walk API fails (e.g., complex merge scenarios,
 * shallow clones, or corrupted git objects).
 *
 * STRATEGY: Walk commit history from sinceCommit to HEAD,
 * comparing each commit against its parent to collect changes.
 * Applies deduplication to handle repeated file modifications.
 *
 * @see 09_c9_isomorphic_git_spec.md Section 5.3
 */

import * as git from 'isomorphic-git';
import { fs } from './fs-adapter.js';
import type { FileChange } from './change-detector.js';
import { getFileChangesBetweenCommits } from './change-detector.js';

// ============================================================================
// Fallback: Commit-by-Commit Walk
// ============================================================================

/**
 * Get file changes by walking through individual commits
 *
 * Fallback strategy when git.walk tree comparison fails.
 * Walks commit history from sinceCommit to HEAD, collecting changes.
 *
 * Deduplication logic:
 * - Same file modified multiple times → final state only
 * - File added then deleted → not included (no net change)
 * - File deleted then re-added → MODIFY (content changed)
 *
 * @param cwd - Project root directory
 * @param sinceCommit - Starting commit hash (baseline)
 * @returns Array of FileChange objects (deduplicated)
 */
export async function getFileChangesByWalkingCommits(
  cwd: string,
  sinceCommit: string
): Promise<FileChange[]> {
  const changeMap = new Map<string, FileChange>();

  // Get commit history from HEAD
  const commits = await git.log({
    fs,
    dir: cwd,
    ref: 'HEAD',
  });

  // Find the index of sinceCommit (baseline)
  // Only process commits AFTER baseline (newer commits)
  const startIndex = commits.findIndex((c) => c.oid === sinceCommit);
  const relevantCommits = startIndex > 0 ? commits.slice(0, startIndex) : commits;

  // Walk through each commit, comparing against its parent
  for (const commit of relevantCommits) {
    const parentOid = commit.commit.parent?.[0];

    if (!parentOid) continue; // Initial commit has no parent

    // Get changes for this commit vs its parent (recursive call)
    const commitChanges = await getFileChangesBetweenCommits(cwd, parentOid, commit.oid);

    // Merge changes with deduplication logic
    for (const change of commitChanges) {
      const existing = changeMap.get(change.path);

      if (existing) {
        // Apply deduplication rules based on change sequence
        if (existing.type === 'ADD' && change.type === 'DELETE') {
          // Added then deleted → no net change, remove from map
          changeMap.delete(change.path);
        } else if (existing.type === 'DELETE' && change.type === 'ADD') {
          // Deleted then re-added → treat as MODIFY (content likely changed)
          changeMap.set(change.path, { path: change.path, type: 'MODIFY' });
        } else {
          // Otherwise keep the latest state (MODIFY → MODIFY stays MODIFY)
          changeMap.set(change.path, change);
        }
      } else {
        changeMap.set(change.path, change);
      }
    }
  }

  return Array.from(changeMap.values());
}