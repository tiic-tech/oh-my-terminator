/**
 * @fileoverview Baseline saving with atomic write for CodeGraph
 *
 * WHY: Atomic write prevents corruption during concurrent writes and crash mid-write.
 * Strategy: Write to .tmp file → fs.rename (atomic on POSIX) → final location
 *
 * Steps:
 * 1. Ensure .codegraph directory exists
 * 2. Optionally create backup of existing baseline
 * 3. Write JSON to .tmp file
 * 4. Atomic rename to baseline.json
 * 5. Update lastCommit.txt
 * 6. Optionally create .version file
 *
 * @see 06_c6_baseline_version_spec.md Section 5
 */

import { writeFile, rename, stat, readFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  Baseline,
  SaveBaselineOptions,
} from './types/index.js';
import {
  getBaselinePath,
  getBackupPath,
  getVersionPath,
  getLastCommitPath,
  getTempPath,
  getCodegraphDirPath,
} from './paths.js';

// ============================================================================
// Main Saving Function
// ============================================================================

/**
 * Save baseline with atomic write
 *
 * WHY: Atomic write prevents corruption through:
 * 1. Write to temp file first (complete data before moving)
 * 2. Atomic rename (POSIX guarantees no partial state)
 * 3. Backup creation (preserve previous state)
 *
 * @param baseline - Complete baseline to save
 * @param cwd - Project working directory
 * @param options - Save options (backup, version file, permissions)
 */
export async function saveBaseline(
  baseline: Baseline,
  cwd: string,
  options?: SaveBaselineOptions
): Promise<void> {
  const baselinePath = getBaselinePath(cwd);
  const tempPath = getTempPath(cwd);

  // Step 1: Ensure directory exists
  const codegraphDir = getCodegraphDirPath(cwd);
  try {
    await stat(codegraphDir);
  } catch {
    // Directory doesn't exist - throw error
    throw new Error(`Directory does not exist: ${codegraphDir}`);
  }

  // Step 2: Create backup if requested and baseline exists
  if (options?.createBackup) {
    try {
      const existingStat = await stat(baselinePath);
      // Baseline exists, create backup
      const backupPath = getBackupPath(cwd);
      await copyFile(baselinePath, backupPath);
    } catch {
      // Baseline doesn't exist, skip backup
    }
  }

  // Step 3: Serialize baseline to JSON
  const content = JSON.stringify(baseline, null, 2);

  // Step 4: Write to temp file
  const mode = options?.mode ?? 0o644;
  await writeFile(tempPath, content, { mode });

  // Step 5: Atomic rename to final location
  await rename(tempPath, baselinePath);

  // Step 6: Update lastCommit.txt
  const lastCommitPath = getLastCommitPath(cwd);
  await writeFile(lastCommitPath, baseline.commitHash, { mode });

  // Step 7: Optionally create .version file
  if (options?.createVersionFile) {
    const versionPath = getVersionPath(cwd);
    const versionString = `${baseline.schemaVersion.major}.${baseline.schemaVersion.minor}.${baseline.schemaVersion.patch}`;
    await writeFile(versionPath, versionString, { mode });
  }
}