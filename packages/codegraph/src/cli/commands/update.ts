/**
 * @fileoverview CLI update command implementation
 *
 * WHY: Provides incremental graph update by detecting git changes.
 * Avoids full re-analysis by only processing changed files.
 *
 * Flow:
 * 1. Validate project (path existence + git repo + commits)
 * 2. Check baseline exists
 * 3. Detect edge cases (re-check after git changes)
 * 4. Detect changes since lastCommit
 * 5. Remove deleted/modified file nodes
 * 6. Re-parse added/modified files
 * 7. Save updated baseline
 * 8. Return structured result
 *
 * @see 09_c9_cli_analyze_update_spec.md Section 5.10-5.18
 */

import { writeFile } from 'node:fs/promises';
import { loadBaseline, saveBaseline, getLastCommitPath } from '../../persistence/index.js';
import {
  detectGitChanges,
  getHeadCommit,
  type GitChangeResult,
} from '../../git/index.js';
import { validateProject } from '../validation.js';
import {
  CURRENT_SCHEMA_VERSION,
  GENERATOR_VERSION,
} from '../../version.js';
import {
  CliErrorCode,
  type UpdateResult,
  type CliError,
  type CompressionStats,
  type EdgeCaseResult,
} from '../../types.js';
import type { Baseline } from '../../persistence/types/baseline.js';
import { reparseFiles } from '../reparser.js';
import { detectSpecialCases } from '../../analyzer/index.js';
import { handleUpdateEdgeCase, removeFileFromGraph } from './update-helpers.js';
import { calculateCompressionStats } from './compression-stats.js';

// ============================================================================
// Command Options
// ============================================================================

/**
 * Options for update command
 */
export interface UpdateOptions {
  /** Output as JSON (for programmatic consumption) */
  json?: boolean;
  /** Enable compression (default: true, inherit analyze behavior) */
  compress?: boolean;
}

// ============================================================================
// Main Command Implementation
// ============================================================================

/**
 * Execute update command
 *
 * Performs incremental graph update based on git changes.
 * Handles edge cases gracefully - if project becomes empty/single-file after
 * file deletions, returns appropriate EdgeCaseResult.
 *
 * @param cwd - Project root directory
 * @param options - Command options (compress defaults to true, inherits analyze behavior)
 * @returns UpdateResult on success, CliError on failure, EdgeCaseResult for edge cases
 */
export async function updateCommand(
  cwd: string,
  options?: UpdateOptions
): Promise<UpdateResult | CliError | EdgeCaseResult> {
  const startTime = Date.now();

  // WHY: Compression enabled by default (6.11-6.12), inherits analyze behavior
  const compress = options?.compress ?? true;

  // ========================================
  // Step 1: Validate Project (Path + Git)
  // ========================================
  const validation = await validateProject(cwd);

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

  const projectRoot = validation.path.absolutePath;

  // ========================================
  // Step 2: Check Baseline
  // ========================================
  const loadResult = await loadBaseline(projectRoot);

  if (!loadResult.success || !loadResult.graph || !loadResult.baseline) {
    return {
      success: false,
      error: {
        code: CliErrorCode.E_BASELINE_NOT_FOUND,
        message: 'No baseline found. Run `codegraph analyze` first to create initial baseline.',
      },
      durationMs: Date.now() - startTime,
    };
  }

  const baseline = loadResult.baseline;
  const graph = loadResult.graph;

  // ========================================
  // Step 3: Detect Edge Cases
  // ========================================
  // WHY: After file deletions, project might become empty/single-file
  const specialCase = detectSpecialCases(projectRoot);
  const edgeCaseResult = handleUpdateEdgeCase(specialCase, startTime);

  // WHY: Return early for empty case (no files to update)
  if (edgeCaseResult && edgeCaseResult.kind === 'empty') {
    return edgeCaseResult;
  }

  // ========================================
  // Step 4: Detect Changes
  // ========================================
  let changes: GitChangeResult;
  try {
    changes = await detectGitChanges(projectRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: {
        code: CliErrorCode.E_BASELINE_NOT_FOUND,
        message: `Failed to detect changes: ${message}`,
      },
      durationMs: Date.now() - startTime,
    };
  }

  // ========================================
  // Step 5: Handle No Changes
  // ========================================
  if (!changes.hasChanges) {
    return {
      success: true,
      changes: { added: [], removed: [], modified: [] },
      delta: { newNodes: 0, removedNodes: 0 },
      durationMs: Date.now() - startTime,
      warnings: [],
    };
  }

  // ========================================
  // Step 6: Remove Changed/Deleted File Nodes
  // ========================================
  let removedNodes = 0;
  let warnings: string[] = [];

  const deletedFiles = changes.changes.filter(c => c.type === 'DELETE');
  const modifiedFiles = changes.changes.filter(c => c.type === 'MODIFY');

  // WHY: Remove nodes for deleted and modified files before re-parse
  for (const change of deletedFiles) {
    removedNodes += removeFileFromGraph(graph, change.path);
  }
  for (const change of modifiedFiles) {
    removedNodes += removeFileFromGraph(graph, change.path);
  }

  // ========================================
  // Step 7: Re-parse Added/Modified Files
  // ========================================
  const filesToReparse = changes.changes
    .filter(c => c.type === 'ADD' || c.type === 'MODIFY')
    .map(c => c.path);

  let newNodes = 0;

  if (filesToReparse.length > 0) {
    const reparseResult = await reparseFiles({
      cwd: projectRoot,
      files: filesToReparse,
      graph,
    });

    newNodes = reparseResult.nodesAdded;
    // WHY: Immutable pattern - create new array instead of mutating
    if (reparseResult.warnings.length > 0) {
      warnings = [...warnings, ...reparseResult.warnings];
    }
  }

  // ========================================
  // Step 8: Save Updated Baseline (with compression)
  // ========================================
  const newHead = await getHeadCommit(projectRoot);
  const timestamp = Date.now();

  const updatedBaseline: Baseline = {
    graph: graph.toJSON(),
    commitHash: newHead,
    timestamp,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    generatorVersion: GENERATOR_VERSION,
    architectureConstraints: baseline.architectureConstraints,
    healthScore: baseline.healthScore,
    skillDemand: baseline.skillDemand,
    migrationHistory: baseline.migrationHistory,
  };

  const originalSizeBytes = Buffer.byteLength(JSON.stringify(updatedBaseline), 'utf-8');

  await saveBaseline(updatedBaseline, projectRoot, { compress });

  // ========================================
  // Step 9: Calculate Compression Stats
  // ========================================
  // WHY: Reuse compression-stats.ts - single source of truth for calculation
  let compressionStats: CompressionStats | undefined;
  if (compress) {
    compressionStats = await calculateCompressionStats(projectRoot, originalSizeBytes);
  }

  // Update lastCommit.txt
  const lastCommitPath = getLastCommitPath(projectRoot);
  await writeFile(lastCommitPath, newHead, 'utf-8');

  // ========================================
  // Step 10: Return Result
  // ========================================
  // WHY: Immutable pattern - prepend edge case warning without mutation
  if (edgeCaseResult && edgeCaseResult.kind === 'test-only') {
    warnings = [edgeCaseResult.warning!, ...warnings];
  }

  const addedFiles = changes.changes.filter(c => c.type === 'ADD').map(c => c.path);
  const removedFiles = deletedFiles.map(c => c.path);
  const modifiedFileList = modifiedFiles.map(c => c.path);

  return {
    success: true,
    changes: {
      added: addedFiles,
      removed: removedFiles,
      modified: modifiedFileList,
    },
    delta: { newNodes, removedNodes },
    compressionStats,
    durationMs: Date.now() - startTime,
    warnings,
  };
}