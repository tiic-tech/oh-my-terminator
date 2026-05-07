/**
 * @oh-my-terminator/codegraph
 *
 * Core module exports - source root detection and related utilities
 *
 * WHY: Barrel export re-exports from the decomposed source-root module,
 * preserving the public API while enabling internal refactoring.
 */

export {
  // Constants
  PROJECT_MARKERS,
  MARKER_PRIORITY,
  GENERIC_MARKER,
  MAX_SEARCH_DEPTH,
  // Default options
  DEFAULT_DETECTOR_OPTIONS,
  // Main API
  detectSourceRoot,
  // Internal helpers (exported for testing)
  searchUpward,
  detectMarkerInDirectory,
  resolveSymlinkPath,
} from './source-root/index.js';

// Re-export types (use 'type' keyword for type-only exports)
export type {
  DetectionResult,
  DetectorOptions,
  UpwardSearchResult,
  MarkerInfo,
  ProjectType,
} from './source-root/index.js';