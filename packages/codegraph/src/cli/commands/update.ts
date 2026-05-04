/**
 * @fileoverview CLI update command implementation
 *
 * WHY: Provides incremental graph update by detecting git changes.
 * Avoids full re-analysis by only processing changed files.
 *
 * Flow:
 * 1. Git validation (must be in git repo)
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
import * as path from 'node:path';
import { loadBaseline, saveBaseline, getLastCommitPath } from '../../persistence/index.js';
import {
  detectGitChanges,
  getHeadCommit,
  isGitRepo,
  type GitChangeResult,
} from '../../git/index.js';
import { analyzeFull } from '../../analyzer.js';
import {
  CURRENT_SCHEMA_VERSION,
  GENERATOR_VERSION,
} from '../../version.js';
import {
  CliErrorCode,
  NodeType,
  type UpdateResult,
  type CliError,
} from '../../types.js';
import { CodeGraph } from '../../graph.js';
import type { Baseline } from '../../persistence/types/baseline.js';

// ============================================================================
// Command Options
// ============================================================================

/**
 * Options for update command
 */
export interface UpdateOptions {
  /** Output as JSON (for programmatic consumption) */
  json?: boolean;
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
 * @param options - Command options
 * @returns UpdateResult on success, CliError on failure
 */
export async function updateCommand(
  cwd: string,
  _options?: UpdateOptions
): Promise<UpdateResult | CliError> {
  const startTime = Date.now();

  // ========================================
  // Step 1: Git Validation
  // ========================================
  const isGit = await isGitRepo(cwd);
  if (!isGit) {
    return {
      success: false,
      error: {
        code: CliErrorCode.E_NO_GIT_REPO,
        message: 'Not a git repository. CodeGraph requires a git repository for baseline tracking.',
      },
      durationMs: Date.now() - startTime,
    };
  }

  // ========================================
  // Step 2: Check Baseline
  // ========================================
  const loadResult = await loadBaseline(cwd);

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
    changes = await detectGitChanges(cwd);
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
    // Run partial analysis on changed files
    // Note: We use analyzeFull with specific extensions/files would require
    // additional scanner options. For now, we re-run full analysis on supported files.
    // This can be optimized later with selective parsing.

    const reparseResult = await reparseFiles(cwd, filesToReparse, graph);

    newNodes = reparseResult.nodesAdded;
    if (reparseResult.warnings.length > 0) {
      warnings.push(...reparseResult.warnings);
    }
  }

  // ========================================
  // Step 7: Save Updated Baseline
  // ========================================
  const newHead = await getHeadCommit(cwd);
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

  await saveBaseline(updatedBaseline, cwd);

  // Update lastCommit.txt
  const lastCommitPath = getLastCommitPath(cwd);
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

/**
 * Re-parse files and add new nodes to graph
 *
 * For incremental update, we parse only the changed files.
 * This requires selective parsing which is done by creating a minimal
 * analysis context.
 *
 * @param cwd - Project root directory
 * @param filePaths - Files to re-parse
 * @param graph - Existing graph to update
 * @returns Nodes added and warnings
 */
async function reparseFiles(
  cwd: string,
  filePaths: string[],
  graph: CodeGraph
): Promise<{ nodesAdded: number; warnings: string[] }> {
  let nodesAdded = 0;

  // Group files by extension for batch parsing
  const tsFiles = filePaths.filter(f => {
    const ext = path.extname(f);
    return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext);
  });

  if (tsFiles.length === 0) {
    return { nodesAdded: 0, warnings: [] };
  }

  // Use analyzeFull for re-parse (simpler approach for MVP)
  // Note: This re-parses all files, but the changes are merged into existing graph
  // For a more efficient approach, we would need selective parsing support in analyzer
  // which can be added as an optimization later

  // Run full analysis to get fresh graph data
  const fullResult = await analyzeFull(cwd);

  // Merge new nodes from changed files
  // We only add nodes for files that were in the reparse list
  for (const [id, node] of fullResult.graph.nodes) {
    if (node.type === NodeType.FILE && filePaths.includes(node.path)) {
      // Add FILE node
      if (!graph.nodes.has(id)) {
        graph.addNode(node);
        nodesAdded++;
      }
    } else if (node.type === NodeType.MODULE) {
      // Add MODULE node if its file is in the reparse list
      if (filePaths.includes(node.path)) {
        if (!graph.nodes.has(id)) {
          graph.addNode(node);
          nodesAdded++;
        }
      }
    }
  }

  // Merge edges for changed files
  for (const edge of fullResult.graph.edges) {
    // Only add edges related to changed files
    const sourceNode = fullResult.graph.nodes.get(edge.from);
    const targetNode = fullResult.graph.nodes.get(edge.to);

    const sourceRelevant = sourceNode && filePaths.includes(sourceNode.path);
    const targetRelevant = targetNode && filePaths.includes(targetNode.path);

    if (sourceRelevant || targetRelevant) {
      // Check if edge already exists (avoid duplicates)
      const exists = graph.edges.some(
        e => e.from === edge.from && e.to === edge.to && e.type === edge.type
      );
      if (!exists) {
        graph.addEdge(edge);
      }
    }
  }

  return { nodesAdded, warnings: fullResult.warnings };
}