/**
 * @oh-my-terminator/codegraph
 *
 * Source Root Detection - Public API
 *
 * WHY: Barrel export provides clean public interface for consumers.
 * Internal modules remain hidden, enabling future refactoring without breaking changes.
 */

// Re-export constants
export {
  PROJECT_MARKERS,
  MARKER_PRIORITY,
  GENERIC_MARKER,
  MAX_SEARCH_DEPTH,
} from './constants.js';

// Re-export types (use 'type' keyword for type-only exports)
export type {
  DetectionResult,
  DetectorOptions,
  MarkerInfo,
  UpwardSearchResult,
  ProjectType,
} from './types.js';

// Re-export values from types
export { DEFAULT_DETECTOR_OPTIONS } from './types.js';

// Re-export core detection functions
export {
  detectMarkerInDirectory,
  searchUpward,
  detectSourceRoot,
} from './detection.js';

// Re-export symlink resolution
export { resolveSymlinkPath } from './symlink.js';