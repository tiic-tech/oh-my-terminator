/**
 * @fileoverview ID deduplication module for compression
 *
 * WHY: IDs are redundant - can be reconstructed from type + pathIndex + name.
 * Removal yields 15-20% size reduction in baseline.
 *
 * ID reconstruction rules (from types.ts GraphNode):
 * - FILE/DIRECTORY/EXTERNAL: `${type}:${pathTable[pathIndex]}`
 * - MODULE: `MODULE:${pathTable[pathIndex]}#${name}`
 *
 * @see design.md D1: ID Field Removal decision
 */

import type { GraphNode, PathTable, CompressedNode, CompressedModuleMetadata, ModuleMetadata } from '../../types.js';
import { NodeType } from '../../types.js';
import { resolvePathIndex } from './path-table.js';

/**
 * Remove ID fields from nodes and convert to compressed format
 *
 * WHY: Eliminates redundant data. ID can be reconstructed from:
 * - type (NodeType)
 * - pathIndex (reference to pathTable)
 * - name (for MODULE nodes, export name)
 *
 * @param nodes - Original graph nodes with IDs
 * @param pathTable - Path table for index resolution
 * @returns Array of CompressedNode (no id field)
 *
 * @example
 * ```ts
 * const nodes = [{ id: 'FILE:src/a.ts', type: NodeType.FILE, path: 'src/a.ts', name: 'a.ts' }];
 * const pathTable = ['src/a.ts'];
 * const compressed = removeIds(nodes, pathTable);
 * // compressed: [{ type: NodeType.FILE, pathIndex: 0, name: 'a.ts' }]
 * ```
 */
export function removeIds(nodes: GraphNode[], pathTable: PathTable): CompressedNode[] {
  return nodes.map(node => {
    // Resolve path to index in pathTable
    const pathIndex = resolvePathIndex(node.path, pathTable);

    // Convert ModuleMetadata to CompressedModuleMetadata if present
    const metadata = node.metadata
      ? compressMetadata(node.metadata)
      : undefined;

    return {
      type: node.type,
      pathIndex,
      name: node.name,
      metadata,
    };
  });
}

/**
 * Convert ModuleMetadata to CompressedModuleMetadata
 *
 * WHY: CompressedMetadata is subset focused on essential information.
 * Removes fields not needed in compressed format (testFile, lastModifiedCommit, changeFrequency).
 *
 * @param metadata - Original ModuleMetadata
 * @returns CompressedModuleMetadata with essential fields only
 */
function compressMetadata(metadata: ModuleMetadata): CompressedModuleMetadata {
  const compressed: CompressedModuleMetadata = {};

  // Copy fields that exist (preserve undefined for optional fields)
  if (metadata.kind !== undefined) {
    compressed.kind = metadata.kind;
  }
  if (metadata.isExported !== undefined) {
    compressed.isExported = metadata.isExported;
  }
  if (metadata.jsDoc !== undefined) {
    compressed.jsDoc = metadata.jsDoc;
  }
  if (metadata.jsDocTruncated !== undefined) {
    compressed.jsDocTruncated = metadata.jsDocTruncated;
  }
  if (metadata.hasJSDoc !== undefined) {
    compressed.hasJSDoc = metadata.hasJSDoc;
  }
  if (metadata.deprecated !== undefined) {
    compressed.deprecated = metadata.deprecated;
  }
  if (metadata.complexity !== undefined) {
    compressed.complexity = metadata.complexity;
  }
  if (metadata.loc !== undefined) {
    compressed.loc = metadata.loc;
  }

  return compressed;
}

/**
 * Reconstruct node ID from type, pathIndex, and optional name
 *
 * WHY: Enables decompression - restoring original node IDs from compressed format.
 *
 * ID format rules:
 * - FILE: `FILE:${path}`
 * - DIRECTORY: `DIRECTORY:${path}`
 * - MODULE: `MODULE:${path}#${name}`
 * - EXTERNAL: `EXTERNAL:${path}`
 *
 * @param type - Node type
 * @param pathIndex - Index in pathTable
 * @param pathTable - Path table to resolve index
 * @param name - Optional name (required for MODULE nodes)
 * @returns Reconstructed node ID
 *
 * @example
 * ```ts
 * const pathTable = ['src/utils.ts'];
 * reconstructNodeId(NodeType.FILE, 0, pathTable);
 * // 'FILE:src/utils.ts'
 *
 * reconstructNodeId(NodeType.MODULE, 0, pathTable, 'formatDate');
 * // 'MODULE:src/utils.ts#formatDate'
 * ```
 */
export function reconstructNodeId(
  type: NodeType,
  pathIndex: number,
  pathTable: PathTable,
  name?: string
): string {
  // Resolve path from index
  const path = pathTable[pathIndex];

  // Construct ID based on type
  switch (type) {
    case NodeType.FILE:
      return `FILE:${path}`;
    case NodeType.DIRECTORY:
      return `DIRECTORY:${path}`;
    case NodeType.EXTERNAL:
      return `EXTERNAL:${path}`;
    case NodeType.MODULE:
      // MODULE format: MODULE:path#name
      // name is required for MODULE, but handle edge case
      return `MODULE:${path}#${name ?? ''}`;
    default:
      // Should never happen with valid NodeType enum
      return `${type}:${path}`;
  }
}