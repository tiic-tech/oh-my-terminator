/**
 * C7: Scope Query - Data Extraction
 *
 * Extract exports, imports, importedBy from graph nodes.
 */

import { CodeGraph, NodeType, EdgeType, type GraphNode } from '../../types.js';
import type { ImportInfo, ImportKind } from '../types/index.js';

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
 * Extract imports with kind metadata from a FILE node's outEdges
 *
 * WHY: Per design.md Decision 5, new function avoids breaking changes.
 * Existing extractImports() returns paths only, this returns full ImportInfo.
 *
 * Handles IMPORTS, RE_EXPORTS, and DYNAMIC_IMPORTS edges.
 * - IMPORTS/RE_EXPORTS: Extract importKind from edge metadata
 * - DYNAMIC_IMPORTS: Always 'value' (no type-only concept for dynamic imports)
 * - External imports: Always 'value' (external packages are runtime deps)
 *
 * BEHAVIOR: When same file has multiple imports from same target with different
 * importKinds (e.g., `import type { X }` AND `import { Y }` from same file),
 * returns BOTH ImportInfo entries to preserve the distinction.
 *
 * @param graph - CodeGraph instance
 * @param fileNode - FILE node to extract from
 * @returns Array of ImportInfo objects (sorted by path, then by kind)
 */
export function extractImportsWithKind(graph: CodeGraph, fileNode: GraphNode): ImportInfo[] {
  if (!fileNode) return [];

  // WHY: Use composite key (path + importKind) instead of just path.
  // This preserves both type-only and value imports from the same source file.
  // Example: `import type { User } from './types'; import { format } from './types';`
  // should yield TWO ImportInfo entries: one for 'type-only', one for 'value'.
  const importsMap = new Map<string, ImportInfo>();
  const outEdges = graph.outEdges.get(fileNode.id) || [];

  for (const edge of outEdges) {
    if (
      edge.type === EdgeType.IMPORTS ||
      edge.type === EdgeType.RE_EXPORTS ||
      edge.type === EdgeType.DYNAMIC_IMPORTS
    ) {
      const targetNode = graph.getNode(edge.to);
      if (targetNode) {
        // Determine import type from edge type
        const importType: 'static' | 'dynamic' | 're-export' =
          edge.type === EdgeType.DYNAMIC_IMPORTS ? 'dynamic' :
          edge.type === EdgeType.RE_EXPORTS ? 're-export' : 'static';

        // Determine import kind from edge metadata
        let importKind: ImportKind = 'value';
        if (targetNode.type !== NodeType.EXTERNAL) {
          importKind = edge.metadata?.importKind ?? 'value';
        }

        // WHY: Composite key ensures both type-only and value imports
        // from same target file are preserved separately.
        const key = `${targetNode.path}:${importKind}`;

        // Skip if exact same (path, kind) already seen
        if (importsMap.has(key)) continue;

        importsMap.set(key, {
          from: targetNode.path,
          type: importType,
          specifiers: [],
          kind: importKind,
        });
      }
    }
  }

  // Sort by path first, then by kind (type-only before value for consistent ordering)
  return Array.from(importsMap.values()).sort((a, b) => {
    const pathCompare = a.from.localeCompare(b.from);
    if (pathCompare !== 0) return pathCompare;
    // type-only < value for stable ordering
    return a.kind === 'type-only' ? -1 : 1;
  });
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