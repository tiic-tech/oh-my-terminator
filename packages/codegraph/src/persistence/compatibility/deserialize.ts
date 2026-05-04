/**
 * @fileoverview Graph deserialization helper for baseline loading
 *
 * WHY: Unsafe `as any` type assertions bypass TypeScript's type safety.
 * This module validates the graph structure before deserialization to ensure:
 * - Required properties (nodes, edges) are present
 * - Structure matches SerializedCodeGraph format
 * - Clear error message if structure is invalid
 *
 * Originally extracted from compatibility.ts (315 lines) to comply with
 * coding-taste Rule 2 (max 150 lines per file).
 */

import { CodeGraph } from '../../graph.js';
import type { SerializedCodeGraph } from '../../types.js';

/**
 * Deserialize baseline graph with structure validation
 *
 * WHY: Unsafe `as any` type assertions bypass TypeScript's type safety.
 * This helper validates the graph structure before deserialization to ensure:
 * - Required properties (nodes, edges) are present
 * - Structure matches SerializedCodeGraph format
 * - Clear error message if structure is invalid
 *
 * @param graphData - Graph data from baseline
 * @returns Properly deserialized CodeGraph instance
 * @throws Error if graph structure is invalid
 */
export function deserializeBaselineGraph(graphData: unknown): CodeGraph {
  // Validate structure before deserialization
  if (!graphData || typeof graphData !== 'object') {
    throw new Error('Invalid baseline graph: graph data is not an object');
  }

  const graph = graphData as Record<string, unknown>;

  // Check required properties
  if (!Array.isArray(graph.nodes)) {
    throw new Error('Invalid baseline graph: missing or invalid "nodes" array');
  }

  if (!Array.isArray(graph.edges)) {
    throw new Error('Invalid baseline graph: missing or invalid "edges" array');
  }

  // Validate nodes format (array of [id, node] tuples)
  for (const [index, entry] of graph.nodes.entries()) {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new Error(
        `Invalid baseline graph: nodes[${index}] is not a valid [id, node] tuple`
      );
    }
  }

  // Use CodeGraph.fromJSON for proper deserialization
  return CodeGraph.fromJSON(graphData as SerializedCodeGraph);
}