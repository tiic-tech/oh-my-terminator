/**
 * C7: Scope Query - Import with Kind Extraction
 *
 * WHY separate file: extractImportsWithKind and helpers form a cohesive unit
 * handling import kind metadata. Split from extract.ts per decomposition principle.
 *
 * Design decision: Per design.md Decision 5, new function avoids breaking changes.
 * Existing extractImports() returns paths only, this returns full ImportInfo.
 */

import { CodeGraph, NodeType, EdgeType } from '../../types.js';
import type { ImportInfo, ImportKind } from '../types/index.js';

/**
 * Determine import type from edge type
 *
 * WHY: IMPORTS/RE_EXPORTS/DYNAMIC_IMPORTS have distinct semantics.
 * Static imports resolve at compile time, dynamic at runtime.
 *
 * @param edgeType - Type of the edge
 * @returns 'static' | 'dynamic' | 're-export'
 */
function getImportType(edgeType: EdgeType): 'static' | 'dynamic' | 're-export' {
  if (edgeType === EdgeType.DYNAMIC_IMPORTS) return 'dynamic';
  if (edgeType === EdgeType.RE_EXPORTS) return 're-export';
  return 'static';
}

/**
 * Determine import kind from edge metadata and target node type
 *
 * WHY: External imports always 'value' (runtime deps). Internal imports
 * may be 'type-only' (TypeScript type imports) or 'value'.
 *
 * @param edge - Edge with metadata
 * @param targetNodeType - Type of target node
 * @returns ImportKind ('value' or 'type-only')
 */
function getImportKind(edge: { metadata?: { importKind?: ImportKind } }, targetNodeType: NodeType): ImportKind {
  // External imports are always runtime dependencies
  if (targetNodeType === NodeType.EXTERNAL) return 'value';
  return edge.metadata?.importKind ?? 'value';
}

/**
 * Create ImportInfo object from edge and target node
 *
 * WHY: Factory function encapsulates ImportInfo creation logic.
 * Single source of truth for ImportInfo structure.
 *
 * @param edge - Edge data
 * @param targetNode - Target node of the edge
 * @returns ImportInfo object
 */
function createImportInfo(
  edge: { type: EdgeType; metadata?: { importKind?: ImportKind } },
  targetNode: { path: string; type: NodeType }
): ImportInfo {
  const importType = getImportType(edge.type);
  const importKind = getImportKind(edge, targetNode.type);

  return {
    from: targetNode.path,
    type: importType,
    specifiers: [],
    kind: importKind,
  };
}

/**
 * Sort comparison for ImportInfo array
 *
 * WHY: Consistent ordering for CLI output. Path-first, then kind
 * (type-only before value) ensures stable display order.
 *
 * @param a - First ImportInfo
 * @param b - Second ImportInfo
 * @returns Sort order (-1, 0, 1)
 */
function sortImportInfoByPathAndKind(a: ImportInfo, b: ImportInfo): number {
  const pathCompare = a.from.localeCompare(b.from);
  if (pathCompare !== 0) return pathCompare;
  // type-only < value for stable ordering
  return a.kind === 'type-only' ? -1 : 1;
}

/**
 * Extract imports with kind metadata from a FILE node's outEdges
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
export function extractImportsWithKind(graph: CodeGraph, fileNode: { id: string } | null): ImportInfo[] {
  if (!fileNode) return [];

  // WHY: Use composite key (path + importKind) instead of just path.
  // This preserves both type-only and value imports from the same source file.
  // Example: `import type { User } from './types'; import { format } from './types';`
  // should yield TWO ImportInfo entries: one for 'type-only', one for 'value'.
  const importsMap = new Map<string, ImportInfo>();
  const outEdges = graph.outEdges.get(fileNode.id) || [];

  const importEdgeTypes = [EdgeType.IMPORTS, EdgeType.RE_EXPORTS, EdgeType.DYNAMIC_IMPORTS];

  for (const edge of outEdges) {
    if (!importEdgeTypes.includes(edge.type)) continue;

    const targetNode = graph.getNode(edge.to);
    if (!targetNode) continue;

    const importInfo = createImportInfo(edge, targetNode);
    // WHY: Composite key ensures both type-only and value imports
    // from same target file are preserved separately.
    const key = `${importInfo.from}:${importInfo.kind}`;

    // Skip if exact same (path, kind) already seen
    if (importsMap.has(key)) continue;

    importsMap.set(key, importInfo);
  }

  return Array.from(importsMap.values()).sort(sortImportInfoByPathAndKind);
}