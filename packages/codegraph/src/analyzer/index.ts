/**
 * Analyzer Edge Case Handler Module Index
 *
 * WHY: Single entry point for all edge case handlers - enables clean imports
 * from CLI commands and preserves module boundaries.
 *
 * @example
 * import {
 *   detectSpecialCases,
 *   excludeTestFiles,
 *   handleEmptyProject,
 *   handleSingleFileProject,
 * } from './analyzer/index.js';
 */

// Core types (One Truth principle)
export {
  type ProjectKind,
  type SpecialCaseResult,
  type DetectionOptions,
  type TestPatterns,
  type FilterResult,
  DEFAULT_SOURCE_EXTENSIONS,
  DEFAULT_TEST_PATTERNS,
} from './types.js';

// Detection
export { detectSpecialCases } from './edge-case-detector.js';

// Filtering
export { excludeTestFiles } from './test-file-filter.js';

// Handlers
export { handleEmptyProject, type EmptyProjectResult } from './empty-project-handler.js';
export { handleSingleFileProject, type SingleFileResult } from './single-file-handler.js';