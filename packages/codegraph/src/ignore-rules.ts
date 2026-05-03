/**
 * Default ignore rules for file system scanning
 *
 * These patterns are matched using prefix matching on relative paths.
 * Patterns ending with `/` match directories and their contents.
 */
export const DEFAULT_IGNORE_RULES: string[] = [
  '.git/',
  'node_modules/',
  'dist/',
  'build/',
  '.next/',
  '.cache/',
  '.codegraph/',
  'coverage/',
  '__pycache__/',
  '.DS_Store',
];

/**
 * Check if a relative path should be ignored based on given rules
 *
 * Uses prefix matching:
 * - Directory rules (ending with `/`) match directory name anywhere in path
 * - File rules match exact file name or path ending with file name
 *
 * @param relativePath - Relative path from project root (e.g., "src/node_modules/util")
 * @param rules - Array of ignore patterns
 * @returns true if path should be ignored
 *
 * @example
 * ```typescript
 * shouldIgnore('node_modules/foo', DEFAULT_IGNORE_RULES) // true
 * shouldIgnore('src/main.ts', DEFAULT_IGNORE_RULES) // false
 * ```
 */
export function shouldIgnore(relativePath: string, rules: string[]): boolean {
  const segments = relativePath.split(/[/\\]/);

  for (const rule of rules) {
    // Directory rule (ends with /)
    if (rule.endsWith('/')) {
      const dirName = rule.slice(0, -1);
      // Check if any path segment matches the directory name
      if (segments.includes(dirName)) {
        return true;
      }
    } else {
      // File rule - check exact match or last segment
      if (relativePath === rule || segments[segments.length - 1] === rule) {
        return true;
      }
    }
  }

  return false;
}