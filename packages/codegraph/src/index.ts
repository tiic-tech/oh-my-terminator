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