/**
 * Path utilities for layer inference
 *
 * WHY: Group extraction from file paths is needed by multiple modules.
 * Single source of truth prevents duplication (coding-taste Truth II).
 */

/**
 * Extract group name from file path (first-level directory after sourceRoot)
 *
 * @param filePath - File path (may include 'FILE:' prefix or not)
 * @param sourceRoot - Source root directory (default: 'src')
 * @returns Group name ('__root__' for root files, first-level dir otherwise)
 */
export function extractGroupFromPath(filePath: string, sourceRoot: string = 'src'): string {
  // Remove FILE: prefix if present
  const path = filePath.startsWith('FILE:') ? filePath.slice(5) : filePath;

  // Remove sourceRoot prefix
  const normalizedPath = path.startsWith(sourceRoot + '/')
    ? path.slice(sourceRoot.length + 1)
    : path.startsWith(sourceRoot)
      ? path.slice(sourceRoot.length)
      : path;

  const firstSlash = normalizedPath.indexOf('/');
  if (firstSlash === -1) {
    return '__root__';
  }

  return normalizedPath.slice(0, firstSlash);
}