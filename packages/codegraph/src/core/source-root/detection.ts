/**
 * @oh-my-terminator/codegraph
 *
 * Source Root Detection - Core Detection Logic
 *
 * WHY: Core detection functions search upward for project markers.
 * Separated from constants/types for clean responsibility boundaries.
 *
 * Contains:
 * - detectMarkerInDirectory: Single-directory marker detection
 * - searchUpward: Upward search algorithm
 * - detectSourceRoot: Main API entry point
 * - Internal helpers: fileExists, directoryExists, getProjectTypeForMarker
 */

import * as path from 'path';
import { promises as fsPromises } from 'fs';
import {
  MARKER_PRIORITY,
  GENERIC_MARKER,
  MAX_SEARCH_DEPTH,
  MARKER_TO_PROJECT_TYPE,
} from './constants.js';
import {
  DetectionResult,
  DetectorOptions,
  MarkerInfo,
  UpwardSearchResult,
  ProjectType,
} from './types.js';
import { resolveSymlinkPath } from './symlink.js';

// ============================================================================
// Internal Helpers: File/Directory Checks
// ============================================================================

/**
 * Checks if a file exists at the given path.
 *
 * WHY: Abstracted fs operation enables consistent error handling and
 * future optimization (e.g., caching, batch operations).
 *
 * M2 FIX: Converted to async fs.promises API for consistency with
 * async detection flow. Sync operations in async context block event loop.
 *
 * @param filePath - Absolute path to check
 * @returns true if file exists, false otherwise
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a directory exists at the given path.
 *
 * WHY: Directory check requires stat call to distinguish from files.
 * .git may be a file (git worktree reference) vs directory (real repo).
 * Only directory indicates true repository root.
 *
 * M2 FIX: Converted to async fs.promises API for consistency with
 * async detection flow. Sync operations in async context block event loop.
 *
 * @param dirPath - Absolute path to check
 * @returns true if directory exists (not file), false otherwise
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fsPromises.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Maps marker file name to project type.
 *
 * WHY: Single source of truth for marker-to-type mapping.
 * Consumers don't need to know marker file names, just project type.
 *
 * L5 FIX: Removed dead code fallback. Unknown markers throw error
 * instead of returning 'nodejs'. This ensures explicit handling of
 * all markers defined in constants.ts.
 *
 * @param marker - Marker file name (e.g., 'package.json')
 * @returns Project type inferred from marker
 * @throws Error if marker is not recognized
 */
function getProjectTypeForMarker(marker: string): Exclude<ProjectType, 'generic'> {
  const type = MARKER_TO_PROJECT_TYPE[marker];
  if (!type) {
    throw new Error(`Unknown marker: ${marker}. Marker not found in MARKER_TO_PROJECT_TYPE.`);
  }
  return type;
}

// ============================================================================
// Internal Helpers: Error Message Formatting
// ============================================================================

/**
 * Formats error message when filesystem root is reached.
 *
 * WHY: Extracted to keep searchUpward under 50-line threshold.
 * Consistent error format with actionable suggestion.
 *
 * @param fsRoot - Filesystem root path
 * @param levelsSearched - Number of levels searched
 * @returns Formatted error message
 */
function formatFilesystemRootError(fsRoot: string, levelsSearched: number): string {
  return (
    `Source root not found: reached filesystem root '${fsRoot}' after ${levelsSearched} levels. ` +
    `Suggestion: Use --source-root to specify project root explicitly.`
  );
}

/**
 * Formats error message when max depth is exceeded.
 *
 * WHY: Extracted to keep searchUpward under 50-line threshold.
 * Consistent error format with actionable suggestion.
 *
 * @param maxDepth - Maximum depth configured
 * @param lastDir - Last directory checked before hitting limit
 * @returns Formatted error message
 */
function formatMaxDepthError(maxDepth: number, lastDir: string): string {
  return (
    `Source root not found: searched ${maxDepth} levels upward without finding project marker. ` +
    `Last directory checked: '${lastDir}'. ` +
    `Suggestion: Use --source-root to specify project root explicitly.`
  );
}

/**
 * Formats error message when path resolution fails.
 *
 * WHY: Extracted to keep searchUpward under 50-line threshold.
 * Handles edge cases like broken path resolution or circular references.
 *
 * @param currentPath - Path where ascent failed
 * @returns Formatted error message
 */
function formatCannotAscendError(currentPath: string): string {
  return (
    `Source root not found: cannot ascend further from '${currentPath}'. ` +
    `Suggestion: Use --source-root to specify project root explicitly.`
  );
}

// ============================================================================
// Marker Detection in Single Directory
// ============================================================================

/**
 * Detects project markers in a single directory.
 *
 * WHY: Single-directory detection is the atomic operation for upward search.
 * Encapsulating this logic enables clean composition and testing.
 *
 * HOW: Checks language markers first (alphabetical priority), then .git fallback.
 * Language markers provide precise project context; .git is generic fallback.
 *
 * M4 FIX: Converted to async to match async detection API pattern.
 * Previously sync function was called from async context, causing
 * mixed sync/async pattern. Now all detection functions are async.
 *
 * @param dirPath - Absolute path to directory to check
 * @returns MarkerInfo if marker found, null if none found
 */
export async function detectMarkerInDirectory(dirPath: string): Promise<MarkerInfo | null> {
  // Check language markers in alphabetical priority order
  for (const marker of MARKER_PRIORITY) {
    const markerPath = `${dirPath}/${marker}`;
    if (await fileExists(markerPath)) {
      return {
        marker,
        projectType: getProjectTypeForMarker(marker),
        isDirectory: false,
      };
    }
  }

  // Check generic fallback (.git directory)
  const gitPath = `${dirPath}/${GENERIC_MARKER}`;
  if (await directoryExists(gitPath)) {
    return {
      marker: GENERIC_MARKER,
      projectType: 'generic',
      isDirectory: true,
    };
  }

  return null;
}

// ============================================================================
// Core Detection: Upward Search Algorithm
// ============================================================================

/**
 * Search upward from start path toward filesystem root for project marker.
 *
 * WHY: Project roots are typically above current working directory in nested structures.
 * Upward search finds the nearest enclosing project root without requiring explicit path.
 *
 * M4 FIX: Converted to async to match async detection API pattern.
 * Calls async detectMarkerInDirectory, must be async itself.
 *
 * ALGORITHM:
 * 1. Start from resolved path (symlinks resolved if requested)
 * 2. Check current directory for markers (language markers first, then .git)
 * 3. If found, return immediately (nearest root wins)
 * 4. If not found, move to parent directory
 * 5. Repeat until marker found, filesystem root reached, or max depth exceeded
 *
 * EDGE CASES:
 * - Filesystem root: Throw error with suggestion to use --source-root
 * - Max depth exceeded: Throw error with last directory checked
 * - Parent equals current: Safety check for broken path resolution
 *
 * @param startPath - Starting directory for upward search (should be absolute)
 * @param maxDepth - Maximum upward search levels (default: MAX_SEARCH_DEPTH)
 * @returns UpwardSearchResult with path, marker, and levels searched
 * @throws Error if filesystem root or max depth reached without finding marker
 */
export async function searchUpward(
  startPath: string,
  maxDepth: number = MAX_SEARCH_DEPTH
): Promise<UpwardSearchResult> {
  // Normalize to absolute path
  let currentPath = path.resolve(startPath);
  let levelsSearched = 0;

  // Get filesystem root for comparison
  const fsRoot = path.parse(currentPath).root;

  while (levelsSearched <= maxDepth) {
    // Check current directory for markers
    const markerInfo = await detectMarkerInDirectory(currentPath);
    if (markerInfo) {
      return {
        path: currentPath,
        marker: markerInfo.marker,
        levelsSearched,
        projectType: markerInfo.projectType,
      };
    }

    // Check if we've reached filesystem root (terminate at root)
    if (currentPath === fsRoot) {
      throw new Error(formatFilesystemRootError(fsRoot, levelsSearched));
    }

    // Move to parent directory
    const parentPath = path.dirname(currentPath);

    // Safety check: parent should be different from current
    if (parentPath === currentPath) {
      throw new Error(formatCannotAscendError(currentPath));
    }

    currentPath = parentPath;
    levelsSearched++;
  }

  // Max depth exceeded without finding marker
  throw new Error(formatMaxDepthError(maxDepth, currentPath));
}

// ============================================================================
// Core Detection: Main API Entry Point
// ============================================================================

/**
 * Detect source root automatically from current working directory.
 *
 * WHY: CLI convenience - most projects have identifiable root markers.
 * Automatic detection reduces friction while preserving explicit override.
 *
 * ALGORITHM:
 * 1. Resolve symlinks in start path
 * 2. Search upward for project markers
 * 3. Return first match (nearest root wins)
 *
 * PRECEDENCE:
 * - Language markers (Cargo.toml, go.mod, package.json, pyproject.toml, etc.)
 * - Generic fallback (.git directory)
 *
 * @param cwd - Starting directory (defaults to process.cwd())
 * @param options - Detection options (maxDepth, resolveSymlinks)
 * @returns DetectionResult with path on success, error on failure
 */
export async function detectSourceRoot(
  cwd?: string,
  options?: DetectorOptions
): Promise<DetectionResult> {
  const startDir = cwd ?? process.cwd();
  const maxDepth = options?.maxDepth ?? MAX_SEARCH_DEPTH;
  const shouldResolveSymlinks = options?.resolveSymlinks ?? true;

  try {
    // Step 1: Resolve symlinks if requested
    const resolvedPath = shouldResolveSymlinks
      ? await resolveSymlinkPath(startDir)
      : startDir;

    // Step 2: Search upward for markers
    const result = await searchUpward(resolvedPath, maxDepth);

    // Step 3: Return structured result
    return {
      success: true,
      path: result.path,
      levelsSearched: result.levelsSearched,
      markerFound: result.marker,
    };
  } catch (error) {
    // Handle search failure with structured error
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown error during source root detection';
    return {
      success: false,
      error: errorMessage,
    };
  }
}