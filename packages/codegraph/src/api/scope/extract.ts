/**
 * C7: Scope Query - Data Extraction
 *
 * Extract exports, imports, importedBy from graph nodes.
 */

import { CodeGraph, NodeType, EdgeType, type GraphNode } from '../../types.js';

/**
 * Extract export symbols from a FILE node
 *
 * Returns exports in "kind:name" format, sorted alphabetically.
 *
 * @param graph - CodeGraph instance
 * @param fileNode - FILE node to extract from
 * @returns Array of "kind:name" strings
 */
export function extractExports(graph: CodeGraph, fileNode: GraphNode): string[] {
  if (!fileNode || fileNode.type !== NodeType.FILE) {
    return [];
  }

  const exports: string[] = [];

  for (const [, node] of graph.nodes) {
    if (node.type !== NodeType.MODULE) continue;
    if (node.path !== fileNode.path) continue;

    const kind = node.metadata?.kind || 'unknown';
    const name = node.name;
    exports.push(`${kind}:${name}`);
  }

  exports.sort();
  return exports;
}

/**
 * Extract import targets from a FILE node's outEdges
 *
 * Handles IMPORTS, RE_EXPORTS, and DYNAMIC_IMPORTS edges.
 *
 * @param graph - CodeGraph instance
 * @param fileNode - FILE node to extract from
 * @returns Array of import target paths (deduplicated, sorted)
 */
export function extractImports(graph: CodeGraph, fileNode: GraphNode): string[] {
  if (!fileNode) return [];

  const imports = new Set<string>();
  const outEdges = graph.outEdges.get(fileNode.id) || [];

  for (const edge of outEdges) {
    if (
      edge.type === EdgeType.IMPORTS ||
      edge.type === EdgeType.RE_EXPORTS ||
      edge.type === EdgeType.DYNAMIC_IMPORTS
    ) {
      const targetNode = graph.getNode(edge.to);
      if (targetNode) {
        imports.add(targetNode.path);
      }
    }
  }

  return Array.from(imports).sort();
}

/**
 * Extract reverse dependencies from a node's inEdges
 *
 * A2 Resolution: DYNAMIC_IMPORTS edges are NOT included.
 * Reason: Dynamic imports resolve at runtime - target cannot know
 * who dynamically imports it. Inherent asymmetry in static analysis.
 *
 * @param graph - CodeGraph instance
 * @param fileNode - Node to extract from
 * @returns Array of source file paths (deduplicated, sorted)
 */
export function extractImportedBy(graph: CodeGraph, fileNode: GraphNode): string[] {
  if (!fileNode) return [];

  const importedBy = new Set<string>();
  const inEdges = graph.inEdges.get(fileNode.id) || [];

  for (const edge of inEdges) {
    // A2 Resolution: DYNAMIC_IMPORTS excluded from reverse index
    if (edge.type === EdgeType.IMPORTS || edge.type === EdgeType.RE_EXPORTS) {
      const sourceNode = graph.getNode(edge.from);
      if (sourceNode && sourceNode.type === NodeType.FILE) {
        importedBy.add(sourceNode.path);
      }
    }
  }

  return Array.from(importedBy).sort();
}