/**
 * @oh-my-terminator/codegraph
 *
 * Source Root Detection Types
 *
 * WHY: Types define structured contracts for detection results and options.
 * Separated from constants and logic for clean dependency boundaries.
 */

import { MAX_SEARCH_DEPTH } from './constants.js';

// ============================================================================
// Detection Results
// ============================================================================

/**
 * Result of source root detection attempt.
 *
 * WHY: Structured result enables discriminated union for success/failure handling.
 * success field enables type narrowing for downstream code.
 */
export interface DetectionResult {
  /** true if marker found, false if search exhausted without match */
  success: boolean;
  /** Absolute path to detected source root (present only on success) */
  path?: string;
  /** Number of directory levels searched upward (present only on success) */
  levelsSearched?: number;
  /** Marker file that identified the root (present only on success) */
  markerFound?: string;
  /** Error message (present only on failure) */
  error?: string;
}

/**
 * Information about a detected project marker.
 *
 * WHY: Encapsulates marker details for consumer code without requiring
 * direct constant lookup. Enables type-safe marker handling.
 */
export interface MarkerInfo {
  /** The marker file/directory name that was detected */
  marker: string;
  /** The project type inferred from the marker */
  projectType: ProjectType;
  /** Whether the marker is a directory (.git) or file */
  isDirectory: boolean;
}

/**
 * Result of upward search containing detected root information.
 *
 * WHY: Structured return type enables clean handling of search results.
 * Separate from DetectionResult to distinguish search output from API output.
 */
export interface UpwardSearchResult {
  /** Absolute path to detected source root */
  path: string;
  /** Marker file/directory that identified the root */
  marker: string;
  /** Number of directory levels searched upward from start */
  levelsSearched: number;
  /** Project type inferred from marker */
  projectType: ProjectType;
}

// ============================================================================
// Project Type
// ============================================================================

/**
 * Supported project types for marker detection.
 *
 * WHY: Type-safe project type enables downstream logic branching
 * (e.g., language-specific analyzer selection).
 */
export type ProjectType = 'rust' | 'go' | 'nodejs' | 'python' | 'generic';

// ============================================================================
// Detection Options
// ============================================================================

/**
 * Options for source root detection behavior.
 *
 * WHY: Configurable options enable edge case handling without modifying core logic.
 * Default values optimize for typical CLI usage while allowing override.
 */
export interface DetectorOptions {
  /** Maximum upward search depth (default: MAX_SEARCH_DEPTH = 10) */
  maxDepth?: number;
  /** Whether to resolve symlinks before searching (default: true) */
  resolveSymlinks?: boolean;
  /** Starting directory for upward search (default: process.cwd()) */
  startDir?: string;
}

/**
 * Default detection options.
 *
 * WHY: Explicit defaults document expected behavior and simplify function calls.
 */
export const DEFAULT_DETECTOR_OPTIONS: DetectorOptions = {
  maxDepth: MAX_SEARCH_DEPTH,
  resolveSymlinks: true,
  startDir: undefined, // Uses process.cwd() when undefined
};