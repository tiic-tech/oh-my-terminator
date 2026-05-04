/**
 * Module Resolution Utilities
 *
 * Helpers for identifying built-in modules, detecting node_modules paths,
 * and extracting package names from various specifier formats.
 */

/**
 * Set of built-in Node.js module names
 */
const BUILTIN_MODULES = new Set([
  // Core modules
  'fs', 'path', 'os', 'crypto', 'util', 'stream', 'events', 'buffer',
  'http', 'https', 'url', 'net', 'dns', 'child_process', 'cluster',
  'readline', 'repl', 'vm', 'module', 'assert', 'console', 'process',
  'timers', 'zlib', 'punycode', 'string_decoder', 'querystring',
  // Additional built-ins
  'dgram', 'tls', 'v8', 'worker_threads', 'perf_hooks', 'async_hooks',
  'inspector', 'http2', 'trace_events', 'diagnostics_channel',
]);

/**
 * Check if a resolved path points to node_modules
 *
 * TypeScript's module resolution returns actual file paths for npm packages
 * (e.g., '../node_modules/typescript/lib/typescript.d.ts'). These should be
 * treated as EXTERNAL nodes, not FILE nodes, since they are not project source files.
 *
 * @param resolvedPath - Resolved file path (relative or absolute)
 * @returns True if the path contains node_modules segment
 */
export function isNodeModulesPath(resolvedPath: string): boolean {
  // Check for node_modules in path (handles both absolute and relative paths)
  return resolvedPath.includes('node_modules');
}

/**
 * Extract package name from a node_modules file path
 *
 * Handles various path formats:
 * - '../node_modules/typescript/lib/typescript.d.ts' → 'typescript'
 * - 'node_modules/@types/node/index.d.ts' → '@types/node'
 * - '/full/path/node_modules/lodash/debounce.js' → 'lodash'
 *
 * @param resolvedPath - Path containing node_modules segment
 * @returns Package name or 'unknown' if extraction fails
 */
export function extractPackageFromNodeModules(resolvedPath: string): string {
  // Match node_modules/<package> or node_modules/@scope/<package>
  // The regex captures:
  // - node_modules/typescript → 'typescript'
  // - node_modules/@types/node → '@types/node'
  const match = resolvedPath.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
  return match ? match[1] : 'unknown';
}

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