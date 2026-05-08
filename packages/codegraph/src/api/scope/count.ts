/**
 * C7: Scope Query - Edge Counting
 *
 * Count import/importedBy edges for QuickBrief.
 */

import { CodeGraph, EdgeType, type GraphNode, type GraphEdge } from '../../types.js';

/**
 * Count import edges for a FILE node
 *
 * A4 Resolution: Counts edges, not unique files.
 * Reason: Edge count reflects dependency density more accurately.
 *
 * @param graph - CodeGraph instance
 * @param fileNode - FILE node
 * @returns Number of import edges
 */
export function countImports(graph: CodeGraph, fileNode: GraphNode): number {
  const outEdges = graph.outEdges.get(fileNode.id) || [];
  return outEdges.filter(
    (e: GraphEdge) =>
      e.type === EdgeType.IMPORTS ||
      e.type === EdgeType.RE_EXPORTS ||
      e.type === EdgeType.DYNAMIC_IMPORTS
  ).length;
}

/**
 * Count imported-by edges for a FILE node
 *
 * A2 Resolution: DYNAMIC_IMPORTS are NOT counted.
 * A4 Resolution: Counts edges, not unique files.
 *
 * @param graph - CodeGraph instance
 * @param fileNode - FILE node
 * @returns Number of imported-by edges
 */
export function countImportedBy(graph: CodeGraph, fileNode: GraphNode): number {
  const inEdges = graph.inEdges.get(fileNode.id) || [];
  return inEdges.filter(
    (e: GraphEdge) => e.type === EdgeType.IMPORTS || e.type === EdgeType.RE_EXPORTS
  ).length;
}