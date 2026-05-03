/**
 * Module Resolution Utilities
 *
 * Helpers for identifying built-in modules and extracting package names.
 */

/**
 * Set of built-in Node.js module names
 */
const BUILTIN_MODULES = new Set([
  'fs', 'path', 'os', 'crypto', 'util', 'stream', 'events', 'buffer',
  'http', 'https', 'url', 'net', 'dns', 'child_process', 'cluster',
  ' readline', 'repl', 'vm', 'module', 'assert', 'console', 'process',
  'timers', 'zlib', 'punycode', 'string_decoder', 'querystring',
]);

/**
 * Check if a specifier is a built-in Node.js module
 *
 * @param specifier - Import specifier to check
 * @returns True if the specifier is a built-in module
 */
export function isBuiltinModule(specifier: string): boolean {
  // Handle node: prefix
  if (specifier.startsWith('node:')) {
    return true;
  }
  return BUILTIN_MODULES.has(specifier);
}

/**
 * Extract package name from specifier
 *
 * Handles various specifier formats:
 * - Built-in modules: 'fs' -> 'fs', 'node:fs' -> 'fs'
 * - Scoped packages: '@utils/format' -> '@utils'
 * - Regular packages: 'lodash/debounce' -> 'lodash'
 *
 * @param specifier - Import specifier (e.g., 'lodash/debounce', '@utils/format')
 * @returns Package name (e.g., 'lodash', '@utils')
 */
export function extractPackageName(specifier: string): string {
  // Built-in modules
  if (isBuiltinModule(specifier)) {
    return specifier.replace(/^node:/, '');
  }

  // Scoped packages (@scope/package)
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }

  // Regular packages (package/subpath)
  const firstSlash = specifier.indexOf('/');
  return firstSlash > 0 ? specifier.substring(0, firstSlash) : specifier;
}