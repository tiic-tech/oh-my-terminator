/**
 * @fileoverview Path table module for string interning (deduplication)
 *
 * WHY: External dependency paths repeat frequently (50+ times for popular packages).
 * Path table reduces repetition to single entry, referenced by index.
 * Sorted by reference count to minimize index digit length in output.
 *
 * @see design.md D3: Path Table (String Interning) decision
 */

import type { GraphNode, GraphEdge, PathTable } from '../../types.js';
import { IndexOutOfBoundsError } from './errors.js';

/**
 * Reference count map for path sorting
 */
type PathRefCount = Map<string, number>;

/**
 * Build a path table from nodes and edges
 *
 * WHY: Collects all unique paths from graph and sorts by reference frequency.
 * Most frequently referenced paths get smallest indexes, minimizing output size.
 *
 * Sorting strategy (design.md D3):
 * - Count references in both nodes (path field) and edges (from/to IDs)
 * - Sort descending by total reference count
 * - Paths with same count maintain stable order (insertion order)
 *
 * @param nodes - Graph nodes to extract paths from
 * @param edges - Graph edges to extract path references from
 * @returns Path table sorted by reference count (most frequent first)
 *
 * @example
 * ```ts
 * const nodes = [
 *   { id: 'FILE:src/a.ts', path: 'src/a.ts' },
 *   { id: 'EXTERNAL:react', path: 'react' }
 * ];
 * const edges = [
 *   { from: 'FILE:src/a.ts', to: 'EXTERNAL:react' }
 * ];
 * const table = buildPathTable(nodes, edges);
 * // table: ['react', 'src/a.ts'] // react has 2 refs (1 node + 1 edge), a.ts has 1
 * ```
 */
export function buildPathTable(nodes: GraphNode[], edges: GraphEdge[]): PathTable {
  const refCount: PathRefCount = new Map();

  // Count node path references
  for (const node of nodes) {
    const path = node.path;
    refCount.set(path, (refCount.get(path) ?? 0) + 1);
  }

  // Count edge path references (from and to IDs)
  for (const edge of edges) {
    // Extract path from edge.from and edge.to IDs
    // ID format: "TYPE:path" or "TYPE:path#name" (for MODULE)
    const fromPath = extractPathFromId(edge.from);
    const toPath = extractPathFromId(edge.to);

    if (fromPath) {
      refCount.set(fromPath, (refCount.get(fromPath) ?? 0) + 1);
    }
    if (toPath) {
      refCount.set(toPath, (refCount.get(toPath) ?? 0) + 1);
    }
  }

  // Sort paths by reference count (descending), then by insertion order for stability
  const sortedPaths = Array.from(refCount.entries())
    .sort((a, b) => {
      // Sort by count descending
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      // Stable sort: maintain insertion order for equal counts
      // (Array.from preserves insertion order, so comparing indices works)
      return 0;
    })
    .map(([path]) => path);

  return sortedPaths;
}

/**
 * Extract path from a node/edge ID
 *
 * ID format rules (from types.ts GraphNode):
 * - DIRECTORY: "DIRECTORY:relativePath"
 * - FILE: "FILE:relativePath"
 * - MODULE: "MODULE:filePath#exportName"
 * - EXTERNAL: "EXTERNAL:packageName"
 *
 * @param id - Node or edge ID
 * @returns Path portion of the ID, or null if invalid format
 */
function extractPathFromId(id: string): string | null {
  // ID format: TYPE:path or TYPE:path#name
  const colonIndex = id.indexOf(':');
  if (colonIndex === -1) {
    return null;
  }

  const pathPart = id.slice(colonIndex + 1);

  // For MODULE type, remove the #name suffix
  const hashIndex = pathPart.indexOf('#');
  if (hashIndex !== -1) {
    return pathPart.slice(0, hashIndex);
  }

  return pathPart;
}

/**
 * Resolve path index in the path table
 *
 * WHY: Used during compression to convert paths to indexes.
 * Returns -1 for non-existent paths to allow caller to handle gracefully.
 *
 * @param path - Path string to find
 * @param table - Path table to search in
 * @returns Index of path, or -1 if not found
 *
 * @example
 * ```ts
 * const table = ['react', 'src/a.ts'];
 * resolvePathIndex('react', table); // 0
 * resolvePathIndex('nonexistent', table); // -1
 * ```
 */
export function resolvePathIndex(path: string, table: PathTable): number {
  const index = table.indexOf(path);
  return index; // indexOf returns -1 if not found
}

/**
 * Resolve path from index in the path table
 *
 * WHY: Used during decompression to convert indexes back to paths.
 * Throws IndexOutOfBoundsError for invalid indexes to catch corruption early.
 *
 * @param index - Index in path table
 * @param table - Path table to resolve from
 * @returns Path string at the given index
 * @throws IndexOutOfBoundsError if index is out of bounds
 *
 * @example
 * ```ts
 * const table = ['react', 'src/a.ts'];
 * resolvePathFromIndex(0, table); // 'react'
 * resolvePathFromIndex(100, table); // throws IndexOutOfBoundsError
 * ```
 */
export function resolvePathFromIndex(index: number, table: PathTable): string {
  if (index < 0 || index >= table.length) {
    const maxIndex = table.length > 0 ? table.length - 1 : -1;
    throw new IndexOutOfBoundsError(index, maxIndex);
  }

  return table[index];
}