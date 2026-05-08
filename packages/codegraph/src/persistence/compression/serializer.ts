/**
 * @fileoverview Serializer module for compression orchestration
 *
 * WHY: Orchestrates all compression components to produce CompressedBaseline.
 * Handles serialization (compression) and deserialization (decompression).
 *
 * Compression flow:
 * 1. Build path table from nodes and edges
 * 2. Remove IDs from nodes (→ CompressedNode)
 * 3. Truncate JSDoc in MODULE metadata
 * 4. Batch IMPORTS edges (→ IMPORTS_BATCH)
 * 5. Combine into CompressedBaseline with schemaVersion
 *
 * Decompression flow:
 * 1. Validate baseline structure
 * 2. Reconstruct node IDs from pathIndexes
 * 3. Expand IMPORTS_BATCH to individual edges
 * 4. Build CodeGraph with reconstructed nodes and edges
 *
 * @see design.md for full compression strategy
 */

import type { CompressionConfig, CompressedBaseline, GraphNode, GraphEdge, CompressedNode, CompressedEdge, IMPORTS_BATCH, CompressedModuleMetadata } from '../../types.js';
import { NodeType, EdgeType } from '../../types.js';
import { CodeGraph } from '../../graph.js';
import { buildPathTable, resolvePathFromIndex } from './path-table.js';
import { removeIds, reconstructNodeId } from './id-deduplication.js';
import { truncateJSDoc } from './jsdoc-truncate.js';
import { batchImportsEdges, expandBatchedEdges } from './edge-batcher.js';
import { CorruptedBaselineError, IndexOutOfBoundsError } from './errors.js';

/**
 * Schema version for compressed baseline format
 *
 * WHY: Major version 1.1 indicates compression format.
 * Enables compatibility checking and migration.
 */
const COMPRESSED_SCHEMA_VERSION = { major: 1, minor: 1, patch: 0 };

/**
 * Serialize CodeGraph to compressed baseline format
 *
 * WHY: Reduces baseline size by 20-60% through compression techniques.
 * Enables efficient storage and Agent token budget compliance.
 *
 * @param graph - CodeGraph to compress
 * @param config - Compression configuration
 * @returns CompressedBaseline ready for JSON serialization
 *
 * @example
 * ```ts
 * const graph = analyzeFull(projectRoot);
 * const config = { compression: { enabled: true, jsDocMaxLength: 100 } };
 * const compressed = serializeCompressed(graph.graph, config);
 * fs.writeFileSync('baseline.json', JSON.stringify(compressed));
 * ```
 */
export function serializeCompressed(graph: CodeGraph, config: CompressionConfig): CompressedBaseline {
  // Convert Map to array for processing
  const nodes = Array.from(graph.nodes.values());

  // Step 1: Build path table from nodes and edges
  const pathTable = buildPathTable(nodes, graph.edges);

  // Step 2: Apply JSDoc truncation to MODULE nodes if compression enabled
  if (config.compression.enabled && config.compression.jsDocMaxLength) {
    truncateModuleJSDoc(nodes, config.compression.jsDocMaxLength);
  }

  // Step 3: Remove IDs from nodes
  const compressedNodes = removeIds(nodes, pathTable);

  // Step 4: Batch IMPORTS edges, keep other edges as CompressedEdge
  const importsBatches = batchImportsEdges(graph.edges, pathTable);
  const otherEdges = graph.edges
    .filter(e => e.type !== EdgeType.IMPORTS)
    .map(e => compressNonImportsEdge(e, pathTable));

  // Combine edges (IMPORTS_BATCH + CompressedEdge for others)
  const compressedEdges: (CompressedEdge | IMPORTS_BATCH)[] = [
    ...importsBatches,
    ...otherEdges,
  ];

  // Step 5: Build CompressedBaseline
  return {
    schemaVersion: COMPRESSED_SCHEMA_VERSION,
    pathTable,
    nodes: compressedNodes,
    edges: compressedEdges,
    commitHash: graph.commitHash,
    timestamp: graph.timestamp,
  };
}

/**
 * Deserialize CompressedBaseline to CodeGraph
 *
 * WHY: Restores original graph structure for API consumers.
 * Transparent decompression enables backward compatibility.
 *
 * @param data - CompressedBaseline data
 * @returns CodeGraph with reconstructed nodes and edges
 * @throws CorruptedBaselineError if baseline structure is invalid
 *
 * @example
 * ```ts
 * const content = fs.readFileSync('baseline.json', 'utf-8');
 * const compressed = JSON.parse(content);
 * const graph = deserializeCompressed(compressed);
 * ```
 */
export function deserializeCompressed(data: CompressedBaseline): CodeGraph {
  // Validate required fields
  validateBaselineStructure(data);

  // Create CodeGraph instance
  const graph = new CodeGraph();

  // Reconstruct and add nodes
  const nodes = reconstructNodes(data.nodes, data.pathTable);
  for (const node of nodes) {
    graph.addNode(node);
  }

  // Expand and add edges (handle both IMPORTS_BATCH and CompressedEdge)
  // WHY silent=true: Suppress warnings during deserialization - orphan edges are normal
  // for compressed baselines where some directory nodes may not exist as explicit nodes
  const edges = reconstructEdges(data.edges, data.pathTable);
  for (const edge of edges) {
    graph.addEdge(edge, true);
  }

  // Set metadata
  graph.commitHash = data.commitHash;
  graph.timestamp = data.timestamp;

  return graph;
}

/**
 * Truncate JSDoc in MODULE node metadata
 *
 * WHY: JSDoc strings can be 200+ chars. Truncation preserves existence signal
 * while reducing baseline size.
 *
 * @param nodes - Nodes to process (mutates metadata.jsDoc)
 * @param maxLength - Maximum JSDoc length
 */
function truncateModuleJSDoc(nodes: GraphNode[], maxLength: number): void {
  for (const node of nodes) {
    if (node.type === NodeType.MODULE && node.metadata?.jsDoc) {
      const result = truncateJSDoc(node.metadata.jsDoc, maxLength);
      node.metadata.jsDoc = result.jsDoc;
      node.metadata.jsDocTruncated = result.jsDocTruncated ?? false;
      node.metadata.hasJSDoc = result.hasJSDoc;
    }
  }
}

/**
 * Compress a non-IMPORTS edge to CompressedEdge format
 *
 * WHY: Only IMPORTS edges are batched. Other edges (CONTAINS, EXPORTS, etc.)
 * remain as CompressedEdge with fromIndex/toIndex.
 *
 * @param edge - Original edge
 * @param pathTable - Path table for index resolution
 * @returns CompressedEdge (no id, uses indexes)
 */
function compressNonImportsEdge(edge: GraphEdge, pathTable: string[]): CompressedEdge {
  const fromPath = extractPathFromId(edge.from);
  const toPath = extractPathFromId(edge.to);

  // Find path indexes (use -1 if not found, but should always be found)
  const fromIndex = pathTable.indexOf(fromPath);
  const toIndex = pathTable.indexOf(toPath);

  return {
    type: edge.type,
    fromIndex,
    toIndex,
    metadata: edge.metadata,
  };
}

/**
 * Validate CompressedBaseline structure
 *
 * WHY: Detects corrupted baseline before processing.
 * Validates required fields and basic structure integrity.
 *
 * @param data - Baseline data to validate
 * @throws CorruptedBaselineError if validation fails
 */
function validateBaselineStructure(data: CompressedBaseline): void {
  // Check required fields
  if (!Array.isArray(data.pathTable)) {
    throw new CorruptedBaselineError('pathTable must be an array');
  }

  if (!Array.isArray(data.nodes)) {
    throw new CorruptedBaselineError('nodes must be an array');
  }

  if (!Array.isArray(data.edges)) {
    throw new CorruptedBaselineError('edges must be an array');
  }

  if (typeof data.commitHash !== 'string') {
    throw new CorruptedBaselineError('commitHash must be a string');
  }

  if (typeof data.timestamp !== 'number') {
    throw new CorruptedBaselineError('timestamp must be a number');
  }

  // Validate pathIndexes in nodes
  for (const node of data.nodes) {
    if (typeof node.pathIndex !== 'number') {
      throw new CorruptedBaselineError(
        'Node pathIndex must be a number',
        { node }
      );
    }

    if (node.pathIndex < 0 || node.pathIndex >= data.pathTable.length) {
      throw new CorruptedBaselineError(
        `Node pathIndex ${node.pathIndex} out of bounds`,
        { node, pathTableLength: data.pathTable.length }
      );
    }
  }
}

/**
 * Reconstruct nodes from CompressedNode array
 *
 * WHY: Restores original GraphNode structure with IDs.
 * Uses reconstructNodeId to generate IDs from pathIndex.
 *
 * @param compressedNodes - Compressed nodes without IDs
 * @param pathTable - Path table for path resolution
 * @returns Array of GraphNode with IDs
 * @throws CorruptedBaselineError if pathIndex is invalid
 */
function reconstructNodes(compressedNodes: CompressedNode[], pathTable: string[]): GraphNode[] {
  const nodes: GraphNode[] = [];

  for (const compressed of compressedNodes) {
    try {
      const path = resolvePathFromIndex(compressed.pathIndex, pathTable);
      const id = reconstructNodeId(compressed.type, compressed.pathIndex, pathTable, compressed.name);

      nodes.push({
        id,
        type: compressed.type,
        path,
        name: compressed.name ?? '',
        metadata: compressed.metadata
          ? expandMetadata(compressed.metadata)
          : undefined,
      });
    } catch (error) {
      if (error instanceof IndexOutOfBoundsError) {
        throw new CorruptedBaselineError(
          `Invalid pathIndex ${compressed.pathIndex} in node`,
          { node: compressed }
        );
      }
      throw error;
    }
  }

  return nodes;
}

/**
 * Reconstruct edges from CompressedEdge and IMPORTS_BATCH array
 *
 * WHY: Restores original GraphEdge structure.
 * IMPORTS_BATCH expands to multiple IMPORTS edges.
 * CompressedEdge converts indexes back to node IDs.
 *
 * @param compressedEdges - Compressed edges (batch or individual)
 * @param pathTable - Path table for path resolution
 * @returns Array of GraphEdge with from/to IDs
 */
function reconstructEdges(
  compressedEdges: (CompressedEdge | IMPORTS_BATCH)[],
  pathTable: string[]
): GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (const compressed of compressedEdges) {
    if (compressed.type === 'IMPORTS_BATCH') {
      // Expand batch to individual IMPORTS edges
      const expanded = expandBatchedEdges([compressed], pathTable);
      edges.push(...expanded);
    } else {
      // Reconstruct individual CompressedEdge
      const edge = reconstructSingleEdge(compressed, pathTable);
      edges.push(edge);
    }
  }

  return edges;
}

/**
 * Reconstruct a single CompressedEdge to GraphEdge
 *
 * @param compressed - Compressed edge
 * @param pathTable - Path table for path resolution
 * @returns GraphEdge with from/to IDs
 */
function reconstructSingleEdge(compressed: CompressedEdge, pathTable: string[]): GraphEdge {
  const fromPath = resolvePathFromIndex(compressed.fromIndex, pathTable);
  const toPath = resolvePathFromIndex(compressed.toIndex, pathTable);

  // Determine node types based on edge type and path characteristics
  const fromType = inferNodeType(fromPath, compressed.type, 'from');
  const toType = inferNodeType(toPath, compressed.type, 'to');

  const fromId = `${fromType}:${fromPath}`;
  const toId = `${toType}:${toPath}`;

  return {
    from: fromId,
    to: toId,
    type: compressed.type,
    metadata: compressed.metadata,
  };
}

/**
 * Infer node type from path and edge context
 *
 * WHY: CompressedEdge doesn store node types. We infer them from:
 * - Path characteristics (file extension, path separators)
 * - Edge type (CONTAINS, EXPORTS have specific patterns)
 * - Position in edge (from vs to)
 *
 * @param path - Path string
 * @param edgeType - Edge type
 * @param position - 'from' or 'to' position in edge
 * @returns Inferred NodeType
 */
function inferNodeType(path: string, edgeType: EdgeType, position: 'from' | 'to'): NodeType {
  // Check if path looks like a file (has extension)
  const hasFileExtension = /\.(ts|js|tsx|jsx|json|mjs|cjs)$/.test(path);

  // Check if path contains node_modules (definitely external)
  if (path.includes('node_modules')) {
    return NodeType.EXTERNAL;
  }

  // For CONTAINS edges, use specific logic:
  // - from is DIRECTORY (container)
  // - to is FILE or MODULE (contained item)
  if (edgeType === EdgeType.CONTAINS) {
    if (position === 'from') {
      // CONTAINS source is always a container (DIRECTORY or FILE containing MODULEs)
      // Since MODULE paths are stored without #name, treat paths with extension as FILE
      // and paths without extension as DIRECTORY
      return hasFileExtension ? NodeType.FILE : NodeType.DIRECTORY;
    } else {
      // CONTAINS target is FILE (has extension) or MODULE (would have same path as FILE)
      // For now, assume FILE (MODULE edges with same path are special case)
      return NodeType.FILE;
    }
  }

  // For IMPORTS edges (from edge-batcher):
  // - from is FILE (source file doing the import)
  // - to is EXTERNAL (package) or FILE (relative import)
  if (edgeType === EdgeType.IMPORTS) {
    if (position === 'from') {
      return NodeType.FILE;
    } else {
      // Check if target looks like a package (no extension, no separators, not node_modules)
      const looksLikePackage = !path.includes('/') && !hasFileExtension;
      return looksLikePackage ? NodeType.EXTERNAL : NodeType.FILE;
    }
  }

  // For EXPORTS edges: MODULE → FILE
  if (edgeType === EdgeType.EXPORTS) {
    return position === 'from' ? NodeType.MODULE : NodeType.FILE;
  }

  // Default: FILE for paths with extensions, DIRECTORY for paths without
  // (except for package-like names which are EXTERNAL)
  if (hasFileExtension) {
    return NodeType.FILE;
  }

  // Path without extension: could be DIRECTORY or EXTERNAL package
  // Use heuristics: paths with '/' are likely directories, single words might be packages
  // But for internal paths like 'src', 'lib', treat as DIRECTORY
  // Package names like 'react', 'lodash' are handled above in IMPORTS logic
  return NodeType.DIRECTORY;
}

/**
 * Expand CompressedModuleMetadata to full ModuleMetadata
 *
 * WHY: Restores optional metadata fields that weren't compressed.
 *
 * @param compressed - Compressed metadata
 * @returns Full ModuleMetadata
 */
function expandMetadata(compressed: CompressedModuleMetadata): Record<string, unknown> {
  const expanded: Record<string, unknown> = {};

  // Copy all fields from compressed metadata
  for (const key of Object.keys(compressed) as (keyof CompressedModuleMetadata)[]) {
    const value = compressed[key];
    if (value !== undefined) {
      expanded[key] = value;
    }
  }

  return expanded;
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