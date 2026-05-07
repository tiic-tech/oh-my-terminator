/**
 * @oh-my-terminator/codegraph
 *
 * Source Root Detection - Symlink Resolution
 *
 * WHY: Symlinks can create misleading directory structures or circular paths.
 * Resolving to real paths ensures search operates on actual filesystem layout,
 * preventing infinite loops and false positives from symlink chains.
 *
 * Separated from core detection logic for:
 * - Clear error handling responsibility
 * - Independent testing of symlink edge cases
 * - Future extensibility (e.g., caching resolved paths)
 */

import * as fsPromises from 'fs/promises';

// ============================================================================
// Symlink Resolution
// ============================================================================

/**
 * Resolve symlink path to its real filesystem path.
 *
 * WHY: Symlinks can create misleading directory structures or circular paths.
 * Resolving to real paths ensures search operates on actual filesystem layout,
 * preventing infinite loops and false positives from symlink chains.
 *
 * EXAMPLES:
 * - symlinked project root: /home/user/proj-link -> /mnt/shared/proj
 * - Circular symlinks: link1 -> link2 -> link1 (resolved breaks cycle)
 * - Relative symlinks: resolved to absolute path
 *
 * @param pathInput - Path to resolve (may be symlink or real path)
 * @returns Promise resolving to real absolute path after symlink resolution
 * @throws Error if path does not exist (ENOENT) or cannot be accessed
 */
export async function resolveSymlinkPath(pathInput: string): Promise<string> {
  try {
    // fs.realpath resolves all symlinks in the path chain
    // Returns the canonical absolute path
    const realPath = await fsPromises.realpath(pathInput);
    return realPath;
  } catch (error: unknown) {
    // Handle specific error types with helpful messages
    if (error instanceof Error && 'code' in error) {
      const nodeError = error as { code: string; message: string };
      if (nodeError.code === 'ENOENT') {
        throw new Error(`Path does not exist: ${pathInput}`);
      }
      if (nodeError.code === 'EACCES') {
        throw new Error(`Permission denied: cannot access path '${pathInput}'`);
      }
      if (nodeError.code === 'ELOOP') {
        throw new Error(
          `Circular symlink detected at '${pathInput}'. ` +
            `Suggestion: Use --source-root to specify project root explicitly.`
        );
      }
    }
    // Generic fallback for unexpected errors
    throw new Error(
      `Cannot resolve path '${pathInput}': ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}