/**
 * Test File Filter
 *
 * WHY: Pre-filtering reduces analysis workload and provides clear CLI feedback.
 * Pattern matching uses simple regex (no external deps) for glob-style patterns.
 *
 * Pattern types:
 * - '*.test.ts' → matches filename suffix
 * - 'tests/**' → matches path prefix
 */

import type { TestPatterns, FilterResult } from './types.js';
import { DEFAULT_TEST_PATTERNS } from './types.js';

/**
 * Convert glob pattern to regex matcher function.
 * WHY: No minimatch dependency - simple patterns can use regex.
 */
function patternToMatcher(pattern: string): (path: string) => boolean {
  // Directory patterns like 'tests/**' → match path prefix
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3);
    return (path) => path.startsWith(prefix + '/') || path === prefix;
  }

  // File patterns like '*.test.ts' → match filename suffix
  // Extract the suffix part after '*'
  const suffix = pattern.replace(/^\*/, '');
  return (path) => {
    const filename = path.split('/').pop() ?? path;
    return filename.endsWith(suffix);
  };
}

/**
 * Check if a file path matches any test pattern.
 */
function isTestFile(path: string, matchers: ((path: string) => boolean)[]): boolean {
  return matchers.some((matcher) => matcher(path));
}

/**
 * Filter test files from file list.
 *
 * @param files - List of file paths to filter
 * @param patterns - Optional custom patterns configuration
 * @returns FilterResult with kept files, filtered count, and filtered file paths
 */
export function excludeTestFiles(files: string[], patterns?: TestPatterns): FilterResult {
  // Determine active patterns: custom override, or defaults + includes
  let activePatterns: string[];
  if (patterns?.customPatterns) {
    activePatterns = patterns.customPatterns;
  } else {
    activePatterns = [...DEFAULT_TEST_PATTERNS];
    if (patterns?.includePatterns) {
      activePatterns.push(...patterns.includePatterns);
    }
  }

  // Build matcher functions once (performance: avoid repeated regex creation)
  const matchers = activePatterns.map(patternToMatcher);

  // Partition files into kept and filtered
  const kept: string[] = [];
  const filteredFiles: string[] = [];

  for (const file of files) {
    if (isTestFile(file, matchers)) {
      filteredFiles.push(file);
    } else {
      kept.push(file);
    }
  }

  return {
    kept,
    filtered: filteredFiles.length,
    filteredFiles,
  };
}