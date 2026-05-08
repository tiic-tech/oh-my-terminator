/**
 * @fileoverview Migration from Baseline 1.0 to CompressedBaseline 1.1
 *
 * WHY: Baselines with 1.0 format (id fields, no pathTable) need migration
 * to 1.1 compressed format for token efficiency.
 *
 * Migration flow (from design.md D5):
 * 1. Build pathTable from unique paths (sorted by reference count)
 * 2. Remove id fields from nodes
 * 3. Convert path strings to pathIndex references
 * 4. Truncate JSDoc strings (configurable, default 100 chars)
 * 5. Batch IMPORTS edges into IMPORTS_BATCH
 * 6. Add schemaVersion: {major: 1, minor: 1, patch: 0}
 *
 * @see design.md D5: Schema Version Migration
 */

import type {
  CompressedBaseline,
  CompressionConfig,
  GraphNode,
  GraphEdge,
  PathTable,
  CompressedNode,
  CompressedModuleMetadata,
  ModuleMetadata,
  CompressedEdge,
  IMPORTS_BATCH,
} from '../../types.js';
import type { Baseline } from '../types/index.js';
import { EdgeType } from '../../types.js';
import { buildPathTable, resolvePathIndex } from '../compression/path-table.js';
import { truncateJSDoc } from '../compression/jsdoc-truncate.js';
import { batchImportsEdges } from '../compression/edge-batcher.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Format detection result
 *
 * WHY: Enables loadBaseline() to determine if migration is needed.
 * - '1.0': Legacy format with id fields, no pathTable
 * - '1.1': Compressed format with pathTable
 * - 'legacy': Pre-versioning baseline (neither 1.0 nor 1.1 structure)
 */
export type BaselineFormat = '1.0' | '1.1' | 'legacy';

/**
 * 1.0 baseline data type alias
 *
 * WHY: Explicit type alias clarifies migration input expectations.
 * Baseline_1_0 has:
 * - graph.nodes: [string, GraphNode][] (with id fields)
 * - graph.edges: GraphEdge[] (individual edges)
 * - No pathTable
 */
export type BaselineData_1_0 = Baseline;

// ============================================================================
// Schema Version Constants
// ============================================================================

/**
 * Schema version for 1.1 compressed format
 */
const COMPRESSED_SCHEMA_VERSION = { major: 1, minor: 1, patch: 0 };

// ============================================================================
// Migration Function
// ============================================================================

/**
 * Migrate Baseline 1.0 to CompressedBaseline 1.1
 *
 * WHY: Transforms legacy format to compressed format for token efficiency.
 * Enables backward compatibility while reducing baseline size by 20-60%.
 *
 * @param data - BaselineData_1_0 (1.0 format with id fields)
 * @param config - Compression configuration (jsDocMaxLength etc.)
 * @returns CompressedBaseline (1.1 format with pathTable)
 *
 * @example
 * ```ts
 * const legacyBaseline = loadJson('baseline.json');
 * const config = { compression: { enabled: true, jsDocMaxLength: 100 } };
 * const compressed = migrate1_0To1_1(legacyBaseline, config);
 * saveJson('baseline.json', compressed);
 * ```
 */
export function migrate1_0To1_1(
  data: BaselineData_1_0,
  config: CompressionConfig
): CompressedBaseline {
  // Convert nodes from [string, GraphNode][] to GraphNode[]
  // The first element (id string) is discarded as it's redundant in 1.0 format
  const nodes: GraphNode[] = data.graph.nodes.map((tuple: [string, GraphNode]) => tuple[1]);

  // Convert edges from serialized format
  const edges: GraphEdge[] = data.graph.edges;

  // Step 1: Build pathTable from nodes and edges
  const pathTable = buildPathTable(nodes, edges);

  // Step 2: Remove IDs and convert to CompressedNode
  const compressedNodes = removeIdsAndCompress(nodes, pathTable, config);

  // Step 3: Batch IMPORTS edges, compress other edges
  const compressedEdges = compressEdges(edges, pathTable);

  // Step 4: Build CompressedBaseline
  return {
    schemaVersion: COMPRESSED_SCHEMA_VERSION,
    pathTable,
    nodes: compressedNodes,
    edges: compressedEdges,
    commitHash: data.commitHash,
    timestamp: data.timestamp,
  };
}

// ============================================================================
// Format Detection
// ============================================================================

/**
 * Detect baseline format version
 *
 * WHY: Enables loadBaseline() to determine migration strategy.
 * Detection rules:
 * - Has pathTable + schemaVersion 1.1 → '1.1' (compressed, no migration)
 * - Has graph + schemaVersion 1.0 → '1.0' (needs migration)
 * - Has graph but no schemaVersion → '1.0' (legacy 1.0)
 * - Neither structure → 'legacy' (pre-versioning)
 *
 * @param data - Parsed JSON data (unknown structure)
 * @returns Detected format version
 */
export function detectBaselineFormat(data: unknown): BaselineFormat {
  if (!data || typeof data !== 'object') {
    return 'legacy';
  }

  const obj = data as Record<string, unknown>;

  // Check for 1.1 format: has pathTable
  if ('pathTable' in obj && Array.isArray(obj.pathTable)) {
    return '1.1';
  }

  // Check for 1.0 format: has graph with nodes/edges
  if ('graph' in obj && obj.graph && typeof obj.graph === 'object') {
    const graph = obj.graph as Record<string, unknown>;
    if ('nodes' in graph && 'edges' in graph) {
      // Has graph structure - this is 1.0 format
      // (schemaVersion may be missing in very old baselines)
      return '1.0';
    }
  }

  // Neither 1.0 nor 1.1 structure - legacy pre-versioning
  return 'legacy';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Remove ID fields and convert GraphNode[] to CompressedNode[]
 *
 * WHY: ID field is redundant - can be reconstructed from type + pathIndex + name.
 * Also applies JSDoc truncation for MODULE nodes.
 *
 * @param nodes - Original GraphNode[] with id fields
 * @param pathTable - Path table for index resolution
 * @param config - Compression configuration
 * @returns CompressedNode[] without id fields
 */
function removeIdsAndCompress(
  nodes: GraphNode[],
  pathTable: PathTable,
  config: CompressionConfig
): CompressedNode[] {
  return nodes.map(node => {
    const pathIndex = resolvePathIndex(node.path, pathTable);

    // Compress metadata if present
    let metadata: CompressedModuleMetadata | undefined;
    if (node.metadata) {
      metadata = compressMetadata(node.metadata, config);
    }

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
 * WHY: CompressedMetadata is a subset focused on essential information.
 * Also applies JSDoc truncation when compression is enabled.
 *
 * @param metadata - Original ModuleMetadata
 * @param config - Compression configuration
 * @returns CompressedModuleMetadata with truncated JSDoc
 */
function compressMetadata(
  metadata: ModuleMetadata,
  config: CompressionConfig
): CompressedModuleMetadata {
  const compressed: CompressedModuleMetadata = {};

  // Copy essential fields
  if (metadata.kind !== undefined) compressed.kind = metadata.kind;
  if (metadata.isExported !== undefined) compressed.isExported = metadata.isExported;
  if (metadata.deprecated !== undefined) compressed.deprecated = metadata.deprecated;
  if (metadata.complexity !== undefined) compressed.complexity = metadata.complexity;
  if (metadata.loc !== undefined) compressed.loc = metadata.loc;

  // Handle JSDoc with truncation
  if (config.compression.enabled && config.compression.jsDocMaxLength) {
    const truncated = truncateJSDoc(metadata.jsDoc, config.compression.jsDocMaxLength);
    if (truncated.jsDoc !== undefined) compressed.jsDoc = truncated.jsDoc;
    if (truncated.jsDocTruncated !== undefined) compressed.jsDocTruncated = truncated.jsDocTruncated;
    compressed.hasJSDoc = truncated.hasJSDoc;
  } else if (metadata.jsDoc !== undefined) {
    // Compression disabled - preserve original JSDoc
    compressed.jsDoc = metadata.jsDoc;
    if (metadata.jsDocTruncated !== undefined) compressed.jsDocTruncated = metadata.jsDocTruncated;
    if (metadata.hasJSDoc !== undefined) compressed.hasJSDoc = metadata.hasJSDoc;
  }

  return compressed;
}

/**
 * Convert GraphEdge[] to (CompressedEdge | IMPORTS_BATCH)[]
 *
 * WHY: IMPORTS edges are batched for efficiency.
 * Other edges (CONTAINS, EXPORTS) remain as CompressedEdge.
 *
 * @param edges - Original GraphEdge[]
 * @param pathTable - Path table for index resolution
 * @returns Compressed edges (batched or individual)
 */
function compressEdges(
  edges: GraphEdge[],
  pathTable: PathTable
): (CompressedEdge | IMPORTS_BATCH)[] {
  // Batch IMPORTS edges
  const importsBatches = batchImportsEdges(edges, pathTable);

  // Compress non-IMPORTS edges
  const otherEdges = edges
    .filter(e => e.type !== EdgeType.IMPORTS)
    .map(e => compressNonImportsEdge(e, pathTable));

  // Combine: IMPORTS_BATCH first, then other edges
  return [...importsBatches, ...otherEdges];
}

/**
 * Compress a non-IMPORTS edge to CompressedEdge format
 *
 * WHY: Only IMPORTS edges are batched. Other edges use pathIndex references.
 *
 * @param edge - Original GraphEdge
 * @param pathTable - Path table for index resolution
 * @returns CompressedEdge with fromIndex/toIndex
 */
function compressNonImportsEdge(
  edge: GraphEdge,
  pathTable: PathTable
): CompressedEdge {
  const fromPath = extractPathFromId(edge.from);
  const toPath = extractPathFromId(edge.to);

  const fromIndex = resolvePathIndex(fromPath, pathTable);
  const toIndex = resolvePathIndex(toPath, pathTable);

  return {
    type: edge.type,
    fromIndex,
    toIndex,
    metadata: edge.metadata,
  };
}

/**
 * Extract path from a node/edge ID
 *
 * ID format rules:
 * - FILE: "FILE:path"
 * - DIRECTORY: "DIRECTORY:path"
 * - MODULE: "MODULE:path#name"
 * - EXTERNAL: "EXTERNAL:packageName"
 *
 * @param id - Node or edge ID
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