/**
 * C8: Impact Analysis - Traverse Module Entry
 *
 * Re-exports all traverse functions for impact API.
 */

// BFS core
export { bfsDependents, type BFSResult } from './bfs-core.js';

// BFS phases (for testing)
export {
  isTestFile,
  collectDirectDependents,
  collectIndirectDependents,
  type VisitedMeta,
} from './bfs-phases.js';

// Target normalization
export { normalizeTargetsToFile } from './normalize.js';

// Result merging
export { mergeBFSResults } from './merge.js';