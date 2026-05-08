/**
 * Path Utilities
 *
 * Shared path manipulation functions for TypeScript parser.
 */

import path from 'path';

/**
 * Get relative path from absolute path using proper path.relative()
 *
 * Uses Node.js path.relative() for correct cross-platform path resolution,
 * avoiding the pitfalls of string replacement (e.g., shared prefixes,
 * path separator differences).
 *
 * @param projectRoot - Absolute project root path
 * @param absolutePath - Absolute file path
 * @returns Relative path from project root
 *
 * @example
 * ```typescript
 * const projectRoot = '/Users/dev/project';
 * const absolutePath = '/Users/dev/project/src/utils/helper.ts';
 * const relative = getRelativePath(projectRoot, absolutePath);
 * // Returns: 'src/utils/helper.ts'
 * ```
 */
export function getRelativePath(projectRoot: string, absolutePath: string): string {
  return path.relative(projectRoot, absolutePath);
}