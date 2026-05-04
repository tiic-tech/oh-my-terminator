/**
 * @fileoverview Compression module entry point
 *
 * WHY: Provides clean public API for baseline compression operations.
 * Re-exports all compression components for easy consumption.
 *
 * Usage:
 * ```ts
 * import { serializeCompressed, deserializeCompressed } from './compression';
 * import { CompressionError, IndexOutOfBoundsError } from './compression';
 * ```
 *
 * Components:
 * - serializeCompressed: Compress CodeGraph to CompressedBaseline
 * - deserializeCompressed: Decompress CompressedBaseline to CodeGraph
 * - buildPathTable: Build path table from nodes/edges
 * - removeIds: Remove ID fields from nodes
 * - truncateJSDoc: Truncate JSDoc to max length
 * - batchImportsEdges: Batch IMPORTS edges for compression
 * - expandBatchedEdges: Expand batched edges back to individual edges
 * - Error classes: CompressionError, IndexOutOfBoundsError, CorruptedBaselineError
 */

// Core serialization functions
export {
  serializeCompressed,
  deserializeCompressed,
} from './serializer.js';

// Path table module
export {
  buildPathTable,
  resolvePathIndex,
  resolvePathFromIndex,
} from './path-table.js';

// ID deduplication module
export {
  removeIds,
  reconstructNodeId,
} from './id-deduplication.js';

// JSDoc truncation module
export {
  truncateJSDoc,
  type TruncatedJSDocResult,
} from './jsdoc-truncate.js';

// Edge batcher module
export {
  batchImportsEdges,
  expandBatchedEdges,
} from './edge-batcher.js';

// Error classes
export {
  CompressionError,
  IndexOutOfBoundsError,
  CorruptedBaselineError,
} from './errors.js';