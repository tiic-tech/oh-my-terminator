/**
 * @fileoverview CLI update command implementation
 *
 * WHY: Provides incremental graph update by detecting git changes.
 * Avoids full re-analysis by only processing changed files.
 *
 * Flow:
 * 1. Validate project (path existence + git repo + commits)
 * 2. Check baseline exists
 * 3. Detect changes since lastCommit
 * 4. Remove deleted/modified file nodes
 * 5. Re-parse added/modified files
 * 6. Save updated baseline
 * 7. Return structured result
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
  NodeType,
  type UpdateResult,
  type CliError,
  type CompressionStats,
} from '../../types.js';
import { CodeGraph } from '../../graph.js';
import type { Baseline } from '../../persistence/types/baseline.js';
import { reparseFiles } from '../reparser.js';

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
 *
 * @param cwd - Project root directory
 * @param options - Command options (compress defaults to true, inherits analyze behavior)
 * @returns UpdateResult on success, CliError on failure
 */
export async function updateCommand(
  cwd: string,
  options?: UpdateOptions
): Promise<UpdateResult | CliError> {
  const startTime = Date.now();

  // Compression is enabled by default (6.11-6.12)
  // Inherits analyze behavior: compress=true unless --no-compression
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

  // Use validated absolute path
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
  // Step 3: Detect Changes
  // ========================================
  let changes: GitChangeResult;
  try {
    changes = await detectGitChanges(projectRoot);
  } catch (error) {
    // detectGitChanges throws if lastCommit.txt missing - should not happen after loadBaseline
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
  // Step 4: Handle No Changes
  // ========================================
  if (!changes.hasChanges) {
    return {
      success: true,
      changes: {
        added: [],
        removed: [],
        modified: [],
      },
      delta: {
        newNodes: 0,
        removedNodes: 0,
      },
      durationMs: Date.now() - startTime,
      warnings: [],
    };
  }

  // ========================================
  // Step 5: Remove Changed/Deleted File Nodes
  // ========================================
  let removedNodes = 0;
  const warnings: string[] = [];

  // Files to remove entirely (DELETE)
  const deletedFiles = changes.changes.filter(c => c.type === 'DELETE');
  for (const change of deletedFiles) {
    removedNodes += removeFileFromGraph(graph, change.path);
  }

  // Files to remove nodes for re-parse (MODIFY)
  const modifiedFiles = changes.changes.filter(c => c.type === 'MODIFY');
  for (const change of modifiedFiles) {
    removedNodes += removeFileFromGraph(graph, change.path);
  }

  // ========================================
  // Step 6: Re-parse Added/Modified Files
  // ========================================
  const filesToReparse = changes.changes.filter(
    c => c.type === 'ADD' || c.type === 'MODIFY'
  ).map(c => c.path);

  let newNodes = 0;

  if (filesToReparse.length > 0) {
    const reparseResult = await reparseFiles({
      cwd: projectRoot,
      files: filesToReparse,
      graph,
    });

    newNodes = reparseResult.nodesAdded;
    if (reparseResult.warnings.length > 0) {
      warnings.push(...reparseResult.warnings);
    }
  }

  // ========================================
  // Step 7: Save Updated Baseline (with compression)
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

  // Calculate original size estimate (uncompressed JSON)
  const originalSizeBytes = Buffer.byteLength(JSON.stringify(updatedBaseline), 'utf-8');

  await saveBaseline(updatedBaseline, projectRoot, { compress });

  // ========================================
  // Step 7.5: Calculate Compression Stats
  // ========================================
  let compressionStats: CompressionStats | undefined;
  if (compress) {
    const { readFile } = await import('node:fs/promises');
    const baselinePath = `.codegraph/baseline.json`;
    const fullPath = `${projectRoot}/${baselinePath}`;
    try {
      const savedContent = await readFile(fullPath, 'utf-8');
      const compressedSizeBytes = Buffer.byteLength(savedContent, 'utf-8');
      const savingsPercent = originalSizeBytes > 0
        ? Math.round(((originalSizeBytes - compressedSizeBytes) / originalSizeBytes) * 100)
        : 0;
      compressionStats = {
        originalSizeBytes,
        compressedSizeBytes,
        savingsPercent,
      };
    } catch {
      // If file read fails, skip compression stats
    }
  }

  // Update lastCommit.txt
  const lastCommitPath = getLastCommitPath(projectRoot);
  await writeFile(lastCommitPath, newHead, 'utf-8');

  // ========================================
  // Step 8: Return Result
  // ========================================
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
    delta: {
      newNodes,
      removedNodes,
    },
    compressionStats,
    durationMs: Date.now() - startTime,
    warnings,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Remove FILE node and all MODULE sub-nodes for a file
 *
 * WHY: Part of incremental update - must clean old nodes before re-parse.
 *
 * @param graph - CodeGraph instance
 * @param filePath - Relative file path
 * @returns Number of nodes removed
 */
function removeFileFromGraph(graph: CodeGraph, filePath: string): number {
  let count = 0;
  const fileId = `FILE:${filePath}`;

  // Find and remove all MODULE nodes for this file
  for (const [id, node] of graph.nodes) {
    if (node.type === NodeType.MODULE && node.path === filePath) {
      graph.removeNode(id);
      count++;
    }
  }

  // Remove edges for this file (imports, exports, contains)
  graph.removeEdgesForFile(filePath);

  // Remove FILE node if exists
  if (graph.nodes.has(fileId)) {
    graph.removeNode(fileId);
    count++;
  }

  return count;
}