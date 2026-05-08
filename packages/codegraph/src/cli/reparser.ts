/**
 * @fileoverview File reparse utilities for incremental updates
 *
 * WHY: Separates reparse logic from command orchestration.
 * Enables testing reparsing independently of CLI flow.
 *
 * MVP Limitation: Runs full analysis as workaround for selective parsing.
 * Future optimization: implement selective file parsing for efficiency.
 */

import * as path from 'node:path';
import { analyzeFull } from '../analyzer.js';
import { NodeType } from '../types.js';
import type { CodeGraph } from '../graph.js';

// ============================================================================
// Public Interface
// ============================================================================

/**
 * Options for file reparse operation
 */
export interface ReparseOptions {
  /** Project root directory */
  cwd: string;
  /** Files to re-parse (relative paths) */
  files: string[];
  /** Existing graph to merge results into */
  graph: CodeGraph;
}

/**
 * Result of reparse operation
 */
export interface ReparseResult {
  /** Number of nodes added to graph */
  nodesAdded: number;
  /** Warnings from parsing */
  warnings: string[];
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Re-parse files and merge into existing graph
 *
 * MVP Implementation: Runs full analysis as workaround.
 * WHY MVP: Selective parsing requires analyzer modifications not yet implemented.
 * Trade-off: Inefficient but functional; enables incremental update flow.
 *
 * TODO: Implement selective parsing for efficiency.
 * @see 09_c9_cli_analyze_update_spec.md Section 5.15
 *
 * @param options - Reparse options
 * @returns ReparseResult with nodes added and warnings
 */
export async function reparseFiles(options: ReparseOptions): Promise<ReparseResult> {
  const { cwd, files, graph } = options;
  let nodesAdded = 0;

  // Filter supported file extensions
  const supportedFiles = files.filter(f => {
    const ext = path.extname(f);
    return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext);
  });

  if (supportedFiles.length === 0) {
    return { nodesAdded: 0, warnings: [] };
  }

  // MVP: Run full analysis to get fresh graph data
  // WHY: Selective parsing would require analyzer to accept file list,
  // which is not yet implemented. This is a known trade-off.
  // Future: implement selective parsing to avoid re-analyzing unchanged files.
  const fullResult = await analyzeFull(cwd);

  // Merge nodes from changed files only
  for (const [id, node] of fullResult.graph.nodes) {
    if (node.type === NodeType.FILE && files.includes(node.path)) {
      if (!graph.nodes.has(id)) {
        graph.addNode(node);
        nodesAdded++;
      }
    } else if (node.type === NodeType.MODULE && files.includes(node.path)) {
      if (!graph.nodes.has(id)) {
        graph.addNode(node);
        nodesAdded++;
      }
    }
  }

  // Merge edges related to changed files
  for (const edge of fullResult.graph.edges) {
    const sourceNode = fullResult.graph.nodes.get(edge.from);
    const targetNode = fullResult.graph.nodes.get(edge.to);

    const sourceRelevant = sourceNode && files.includes(sourceNode.path);
    const targetRelevant = targetNode && files.includes(targetNode.path);

    if (sourceRelevant || targetRelevant) {
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