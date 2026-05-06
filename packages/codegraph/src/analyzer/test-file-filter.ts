/**
 * Test File Filter
 *
 * WHY: Pre-filtering reduces analysis workload and provides clear CLI feedback.
 * Pattern matching delegated to glob-utils (single source of truth).
 *
 * Pattern types:
 * - '*.test.ts' → matches filename suffix
 * - 'tests/**' → matches path prefix
 */

import type { TestPatterns, FilterResult } from './types.js';
import { DEFAULT_TEST_PATTERNS } from './types.js';
import { patternToMatcher } from '../cli/commands/glob-utils.js';

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