/**
 * @fileoverview Edge batcher module for IMPORTS compression
 *
 * WHY: IMPORTS edges dominate (70-80% of edges). Grouping reduces key repetition.
 * One IMPORTS_BATCH replaces multiple IMPORTS edges from same source.
 *
 * Format: { type: 'IMPORTS_BATCH', fromIndex: number, targetIndexes: number[] }
 *
 * @see design.md D4: Edge Batch Compression decision
 */

import type { GraphEdge, PathTable, IMPORTS_BATCH } from '../../types.js';
import { EdgeType, NodeType } from '../../types.js';
import { resolvePathIndex, resolvePathFromIndex } from './path-table.js';

/**
 * Batch IMPORTS edges by source file
 *
 * WHY: Multiple IMPORTS edges from same source file share common fromIndex.
 * Batching reduces key repetition: one object instead of many.
 *
 * Algorithm:
 * 1. Filter IMPORTS edges only
 * 2. Group by source (from field)
 * 3. Convert to IMPORTS_BATCH with fromIndex and targetIndexes array
 * 4. Deduplicate targets within each batch
 *
 * Note: Metadata is NOT preserved in IMPORTS_BATCH per design.md D4.
 * If metadata preservation needed, would require CompressedEdge array.
 *
 * @param edges - Original graph edges
 * @param pathTable - Path table for index resolution
 * @returns Array of IMPORTS_BATCH objects
 *
 * @example
 * ```ts
 * const edges = [
 *   { from: 'FILE:src/a.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
 *   { from: 'FILE:src/a.ts', to: 'EXTERNAL:lodash', type: EdgeType.IMPORTS }
 * ];
 * const pathTable = ['src/a.ts', 'react', 'lodash'];
 * const batches = batchImportsEdges(edges, pathTable);
 * // batches: [{ type: 'IMPORTS_BATCH', fromIndex: 0, targetIndexes: [1, 2] }]
 * ```
 */
export function batchImportsEdges(edges: GraphEdge[], pathTable: PathTable): IMPORTS_BATCH[] {
  // Filter IMPORTS edges only
  const importsEdges = edges.filter(e => e.type === EdgeType.IMPORTS);

  if (importsEdges.length === 0) {
    return [];
  }

  // Group by source (from field)
  const sourceGroups = new Map<string, Set<string>>();

  for (const edge of importsEdges) {
    const targets = sourceGroups.get(edge.from) ?? new Set();
    targets.add(edge.to);
    sourceGroups.set(edge.from, targets);
  }

  // Convert to IMPORTS_BATCH
  const batches: IMPORTS_BATCH[] = [];

  for (const [fromId, targets] of sourceGroups) {
    // Extract path from fromId (format: TYPE:path or TYPE:path#name)
    const fromPath = extractPathFromId(fromId);
    const fromIndex = resolvePathIndex(fromPath, pathTable);

    // Convert target IDs to pathIndexes
    const targetIndexes: number[] = [];
    for (const targetId of targets) {
      const targetPath = extractPathFromId(targetId);
      const targetIndex = resolvePathIndex(targetPath, pathTable);
      if (targetIndex !== -1) {
        targetIndexes.push(targetIndex);
      }
    }

    batches.push({
      type: 'IMPORTS_BATCH',
      fromIndex,
      targetIndexes,
    });
  }

  return batches;
}

/**
 * Expand IMPORTS_BATCH back to individual IMPORTS edges
 *
 * WHY: Enables decompression - restoring original edge array for API consumers.
 *
 * Algorithm:
 * 1. For each batch, iterate targetIndexes
 * 2. Create IMPORTS edge for each targetIndex
 * 3. Reconstruct node IDs from pathIndexes
 *
 * Note: Metadata is NOT restored (per design.md D4, metadata not preserved).
 *
 * @param batches - Batched IMPORTS edges
 * @param pathTable - Path table for path resolution
 * @returns Array of GraphEdge (IMPORTS type)
 *
 * @example
 * ```ts
 * const batches = [{ type: 'IMPORTS_BATCH', fromIndex: 0, targetIndexes: [1, 2] }];
 * const pathTable = ['src/a.ts', 'react', 'lodash'];
 * const edges = expandBatchedEdges(batches, pathTable);
 * // edges: [
 * //   { from: 'FILE:src/a.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
 * //   { from: 'FILE:src/a.ts', to: 'EXTERNAL:lodash', type: EdgeType.IMPORTS }
 * // ]
 * ```
 */
export function expandBatchedEdges(batches: IMPORTS_BATCH[], pathTable: PathTable): GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (const batch of batches) {
    // Resolve source path
    const fromPath = resolvePathFromIndex(batch.fromIndex, pathTable);

    // Determine source node type (FILE for imports)
    // Most imports are from FILE nodes
    const fromId = `FILE:${fromPath}`;

    // Create edge for each target
    for (const targetIndex of batch.targetIndexes) {
      const targetPath = resolvePathFromIndex(targetIndex, pathTable);

      // Determine target node type
      // External package paths → EXTERNAL, project files → FILE
      const targetType = isExternalPath(targetPath) ? NodeType.EXTERNAL : NodeType.FILE;
      const toId = `${targetType}:${targetPath}`;

      edges.push({
        from: fromId,
        to: toId,
        type: EdgeType.IMPORTS,
      });
    }
  }

  return edges;
}

/**
 * Extract path from a node/edge ID
 *
 * ID format rules (from types.ts GraphNode):
 * - FILE: "FILE:path"
 * - DIRECTORY: "DIRECTORY:path"
 * - MODULE: "MODULE:path#name"
 * - EXTERNAL: "EXTERNAL:packageName"
 *
 * @param id - Node ID
 * @returns Path portion of the ID
 */
function extractPathFromId(id: string): string {
  const colonIndex = id.indexOf(':');
  if (colonIndex === -1) {
    return id;
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
 * Check if path is an external package (not a project file)
 *
 * WHY: Used to determine EXTERNAL vs FILE node type during edge expansion.
 *
 * Detection rules:
 * 1. Path contains 'node_modules' → EXTERNAL
 * 2. Path is a package name (no file extension, no path separators) → EXTERNAL
 * 3. Otherwise → FILE
 *
 * Package name detection:
 * - No slashes (not a file path)
 * - No file extension like .ts, .js, .tsx, .jsx
 * - Short string (package names are typically short)
 *
 * @param path - Path string to check
 * @returns true if path represents an external package
 */
function isExternalPath(path: string): boolean {
  // Check for node_modules path
  if (path.includes('node_modules/') || path.startsWith('node_modules')) {
    return true;
  }

  // Check if it looks like a package name (no extension, no path separators)
  const hasPathSeparator = path.includes('/');
  const hasFileExtension = /\.(ts|js|tsx|jsx|json|mjs|cjs)$/.test(path);

  // Package names don't have path separators or file extensions
  if (!hasPathSeparator && !hasFileExtension) {
    return true;
  }

  return false;
}