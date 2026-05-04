/**
 * @fileoverview Git change detection for incremental updates
 *
 * WHY: Enables efficient incremental graph updates by detecting file changes
 * between Git commits. Uses isomorphic-git for cross-platform Git operations.
 *
 * Flow:
 * 1. Read lastCommit.txt (baseline commit from previous analysis)
 * 2. Get current HEAD commit
 * 3. Compare trees to detect ADD/MODIFY/DELETE changes
 * 4. Return structured change result for incremental update
 *
 * @see 09_c9_isomorphic_git_spec.md
 */

import * as git from 'isomorphic-git';
import type { WalkerEntry } from 'isomorphic-git';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fs } from './fs-adapter.js';
import { getLastCommitPath } from '../persistence/paths.js';

// ============================================================================
// Types
// ============================================================================

/**
 * File change type detected between commits
 */
export interface FileChange {
  /** Relative file path from project root */
  path: string;
  /** Change type: ADD (new), MODIFY (changed), DELETE (removed) */
  type: 'ADD' | 'MODIFY' | 'DELETE';
}

/**
 * Result of Git change detection
 */
export interface GitChangeResult {
  /** Baseline commit from lastCommit.txt */
  lastCommit: string;
  /** Current HEAD commit */
  currentHead: string;
  /** Detected file changes */
  changes: FileChange[];
  /** Whether any changes detected */
  hasChanges: boolean;
}

// ============================================================================
// Supported File Extensions
// ============================================================================

/**
 * File extensions supported by CodeGraph analysis
 *
 * WHY: Limits change detection to relevant files, avoiding noise from
 * config files, markdown, etc.
 */
const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

/**
 * Check if file path is supported for CodeGraph analysis
 *
 * @param filePath - Relative file path
 * @returns True if file extension is supported
 */
export function isSupportedFile(filePath: string): boolean {
  const ext = path.extname(filePath);
  return SUPPORTED_EXTENSIONS.includes(ext);
}

// ============================================================================
// Main Change Detection Function
// ============================================================================

/**
 * Detect Git changes since last analysis baseline
 *
 * Workflow:
 * 1. Read lastCommit.txt to get baseline commit
 * 2. Resolve current HEAD commit
 * 3. If same commit, return no changes
 * 4. If different, compare trees to detect file changes
 *
 * @param cwd - Project root directory
 * @returns GitChangeResult with detected changes
 * @throws Error if no baseline found (run `analyze` first)
 */
export async function detectGitChanges(cwd: string): Promise<GitChangeResult> {
  // Step 1: Read baseline commit from lastCommit.txt
  const lastCommitPath = getLastCommitPath(cwd);
  let lastCommit: string;

  try {
    lastCommit = (await readFile(lastCommitPath, 'utf-8')).trim();
  } catch {
    throw new Error('No baseline found. Run `codegraph analyze` first.');
  }

  // Step 2: Resolve current HEAD commit
  const currentHead = await git.resolveRef({
    fs,
    dir: cwd,
    ref: 'HEAD',
  });

  // Step 3: Check if commits match (no changes)
  if (lastCommit === currentHead) {
    return {
      lastCommit,
      currentHead,
      changes: [],
      hasChanges: false,
    };
  }

  // Step 4: Get changes between commits
  const changes = await getFileChangesBetweenCommits(cwd, lastCommit, currentHead);

  return {
    lastCommit,
    currentHead,
    changes,
    hasChanges: changes.length > 0,
  };
}

// ============================================================================
// Tree Comparison Functions
// ============================================================================

/**
 * Get file changes between two commits using tree walk
 *
 * Uses isomorphic-git's walk API to compare two tree snapshots:
 * - fromCommit: Baseline tree (older)
 * - toCommit: Current tree (newer)
 *
 * Change detection logic:
 * - fromEntry missing, toEntry present → ADD
 * - fromEntry present, toEntry missing → DELETE
 * - Both present but different OID → MODIFY
 *
 * @param cwd - Project root directory
 * @param fromCommit - Baseline commit hash
 * @param toCommit - Target commit hash (HEAD)
 * @returns Array of FileChange objects
 */
export async function getFileChangesBetweenCommits(
  cwd: string,
  fromCommit: string,
  toCommit: string
): Promise<FileChange[]> {
  const changes: FileChange[] = [];

  try {
    await git.walk({
      fs,
      dir: cwd,
      trees: [
        git.TREE({ ref: fromCommit }),
        git.TREE({ ref: toCommit }),
      ],
      /**
       * Map function - called for each filepath in both trees
       *
       * @param filepath - Relative path from project root
       * @param entries - Walker entries [fromEntry, toEntry]
       */
      map: async (filepath: string, entries: (WalkerEntry | null)[]) => {
        const [fromEntry, toEntry] = entries;

        // Skip if both entries are null (shouldn't happen but safety check)
        if (!fromEntry && !toEntry) return null;

        // Get entry types (async calls)
        const fromType = fromEntry ? await fromEntry.type() : null;
        const toType = toEntry ? await toEntry.type() : null;

        // Skip directories - only process files (blobs)
        if (fromType === 'tree' || toType === 'tree') {
          return entries; // Continue traversing children
        }

        // Filter to supported file types only
        if (!isSupportedFile(filepath)) {
          return null;
        }

        // Get OIDs for comparison (async calls)
        const fromOid = fromEntry ? await fromEntry.oid() : null;
        const toOid = toEntry ? await toEntry.oid() : null;

        // Determine change type using OID comparison
        if (!fromOid && toOid) {
          // Baseline missing, current present → ADD
          changes.push({ path: filepath, type: 'ADD' });
        } else if (fromOid && !toOid) {
          // Baseline present, current missing → DELETE
          changes.push({ path: filepath, type: 'DELETE' });
        } else if (fromOid !== toOid) {
          // Both present but different → MODIFY
          changes.push({ path: filepath, type: 'MODIFY' });
        }

        return null; // Don't descend into file children
      },
    });
  } catch (error) {
    // Fallback to commit-by-commit approach if walk fails
    return getFileChangesByWalkingCommits(cwd, fromCommit);
  }

  return changes;
}

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
 * - File added then deleted → not included
 * - File deleted then re-added → MODIFY (content changed)
 *
 * @param cwd - Project root directory
 * @param sinceCommit - Starting commit hash
 * @returns Array of FileChange objects (deduplicated)
 */
export async function getFileChangesByWalkingCommits(
  cwd: string,
  sinceCommit: string
): Promise<FileChange[]> {
  const changeMap = new Map<string, FileChange>();

  // Get commit history
  const commits = await git.log({
    fs,
    dir: cwd,
    ref: 'HEAD',
  });

  // Find the index of sinceCommit
  const startIndex = commits.findIndex((c) => c.oid === sinceCommit);
  const relevantCommits = startIndex > 0 ? commits.slice(0, startIndex) : commits;

  // Walk through each commit
  for (const commit of relevantCommits) {
    const parentOid = commit.commit.parent?.[0];

    if (!parentOid) continue; // Initial commit has no parent

    // Get changes for this commit vs its parent
    const commitChanges = await getFileChangesBetweenCommits(cwd, parentOid, commit.oid);

    // Merge changes with deduplication logic
    for (const change of commitChanges) {
      const existing = changeMap.get(change.path);

      if (existing) {
        // Apply deduplication rules based on change sequence
        if (existing.type === 'ADD' && change.type === 'DELETE') {
          // Added then deleted → file doesn't exist, remove from map
          changeMap.delete(change.path);
        } else if (existing.type === 'DELETE' && change.type === 'ADD') {
          // Deleted then re-added → treat as MODIFY
          changeMap.set(change.path, { path: change.path, type: 'MODIFY' });
        } else {
          // Otherwise keep the latest state
          changeMap.set(change.path, change);
        }
      } else {
        changeMap.set(change.path, change);
      }
    }
  }

  return Array.from(changeMap.values());
}