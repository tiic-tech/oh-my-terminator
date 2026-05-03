/**
 * @fileoverview Path definitions for .codegraph directory structure
 *
 * WHY: Centralizes all path-related constants and helpers for baseline persistence.
 * Single source of truth for directory structure, avoiding magic strings scattered
 * throughout the codebase.
 *
 * .codegraph directory structure:
 * ```
 * .codegraph/
 * ├── baseline.json         # Complete graph data with metadata
 * ├── lastCommit.txt        # Git commit hash for version tracking
 * ├── .version              # Optional quick version check file
 * └── migration.log         # Optional migration audit log (JSONL)
 * ```
 *
 * @see 06_c6_baseline_version_spec.md Section 1.4
 */

import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

// ============================================================================
// Directory & File Constants
// ============================================================================

/**
 * Root directory name for CodeGraph persistence
 *
 * WHY: Placed at project root for easy discovery. Named '.codegraph' to:
 * - Follow convention for tool metadata directories (like '.git', '.github')
 * - Be hidden by default in file explorers
 */
export const CODEGRAPH_DIR = '.codegraph';

/**
 * Main baseline file containing complete graph data
 *
 * WHY: JSON format for human readability and easy inspection.
 * Contains SerializedCodeGraph plus version metadata.
 */
export const BASELINE_FILE = 'baseline.json';

/**
 * Git commit hash tracking file
 *
 * WHY: Enables incremental update decisions by comparing current HEAD
 * with baseline's commit. Single line file for quick reading.
 */
export const LAST_COMMIT_FILE = 'lastCommit.txt';

/**
 * Quick version check file (optional)
 *
 * WHY: Enables fast version check without parsing full baseline.json.
 * Useful when baseline is large (hundreds of MB) and only version info needed.
 */
export const VERSION_FILE = '.version';

/**
 * Migration audit log file (optional)
 *
 * WHY: JSONL format for appending migration entries without rewriting.
 * Provides audit trail for schema version transitions.
 */
export const MIGRATION_LOG_FILE = 'migration.log';

// ============================================================================
// Path Helper Functions
// ============================================================================

/**
 * Get full path to baseline.json
 *
 * @param cwd - Project root directory (current working directory)
 * @returns Absolute or relative path to baseline.json
 */
export function getBaselinePath(cwd: string): string {
  return join(cwd, CODEGRAPH_DIR, BASELINE_FILE);
}

/**
 * Get full path to lastCommit.txt
 *
 * @param cwd - Project root directory
 * @returns Path to lastCommit.txt
 */
export function getLastCommitPath(cwd: string): string {
  return join(cwd, CODEGRAPH_DIR, LAST_COMMIT_FILE);
}

/**
 * Get full path to .version file
 *
 * @param cwd - Project root directory
 * @returns Path to .version file
 */
export function getVersionPath(cwd: string): string {
  return join(cwd, CODEGRAPH_DIR, VERSION_FILE);
}

/**
 * Get full path to migration.log
 *
 * @param cwd - Project root directory
 * @returns Path to migration.log
 */
export function getMigrationLogPath(cwd: string): string {
  return join(cwd, CODEGRAPH_DIR, MIGRATION_LOG_FILE);
}

/**
 * Get full path to .codegraph directory
 *
 * @param cwd - Project root directory
 * @returns Path to .codegraph directory
 */
export function getCodegraphDirPath(cwd: string): string {
  return join(cwd, CODEGRAPH_DIR);
}

/**
 * Ensure .codegraph directory exists
 *
 * WHY: Called before any write operation to guarantee directory exists.
 * Uses recursive mkdir to create parent directories if needed.
 *
 * @param cwd - Project root directory
 * @returns Path to the .codegraph directory
 */
export async function ensureCodegraphDir(cwd: string): Promise<string> {
  const codegraphDir = getCodegraphDirPath(cwd);
  await mkdir(codegraphDir, { recursive: true });
  return codegraphDir;
}

/**
 * Get path to backup file for baseline
 *
 * WHY: Used before migration to preserve original baseline.
 * Backup file has .bak suffix.
 *
 * @param cwd - Project root directory
 * @returns Path to baseline.json.bak
 */
export function getBackupPath(cwd: string): string {
  return getBaselinePath(cwd) + '.bak';
}

/**
 * Get path to temporary file for atomic write
 *
 * WHY: Atomic write strategy writes to .tmp first, then renames.
 * Prevents partial writes from corrupting baseline.
 *
 * @param cwd - Project root directory
 * @returns Path to baseline.json.tmp
 */
export function getTempPath(cwd: string): string {
  return getBaselinePath(cwd) + '.tmp';
}