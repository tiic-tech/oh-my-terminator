/**
 * @oh-my-terminator/codegraph
 *
 * Core graph data structure for repository relationship modeling
 */

export {
  NodeType,
  EdgeType,
  type GraphNode,
  type GraphEdge,
  type ModuleMetadata,
  type EdgeMetadata,
  type SerializedCodeGraph,
} from './types.js';

export { CodeGraph } from './graph.js';

export {
  DEFAULT_IGNORE_RULES,
  shouldIgnore,
} from './ignore-rules.js';

export {
  scanDirectory,
  isParseableFile,
  createDirectoryNode,
  createFileNode,
  createContainsEdge,
  type ScanResult,
  type ScanOptions,
} from './scanner.js';