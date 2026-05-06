/**
 * Edge Case Detector
 *
 * WHY: Large-scale codegraph analysis fails on edge cases (empty projects, test-only repos).
 * This module detects these early to apply specialized handling strategies.
 *
 * PERFORMANCE: Synchronous file scan for <100ms target on 1000 files.
 * Async would add overhead without benefit for this lightweight detection.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  type ProjectKind,
  type SpecialCaseResult,
  type DetectionOptions,
  DEFAULT_SOURCE_EXTENSIONS,
  DEFAULT_TEST_PATTERNS,
} from './types.js';

/**
 * Detects special project cases that require non-standard analysis.
 *
 * WHY: Normal analysis assumes 2+ source files with test separation.
 * Edge cases need different strategies to avoid misleading metrics.
 *
 * @param projectRoot - Absolute or relative path to project directory
 * @param options - Override default extensions or test patterns
 * @returns Classification with source and test file lists
 */
export function detectSpecialCases(
  projectRoot: string,
  options?: DetectionOptions
): SpecialCaseResult {
  // Resolve to absolute path for consistent file handling
  const absoluteRoot = path.resolve(projectRoot);

  // Use configured extensions or fall back to defaults
  // WHY: Different stacks have different source file types (e.g., .svelte, .py)
  const extensions = options?.extensions ?? DEFAULT_SOURCE_EXTENSIONS;

  // Scan all files recursively
  // WHY: Project structure varies; recursive scan ensures complete coverage
  const allFiles = scanFiles(absoluteRoot);

  // Separate source and test files based on patterns
  // WHY: Test files shouldn't count toward source complexity metrics
  const { sourceFiles, testFiles } = classifyFiles(allFiles, extensions, options?.testPatterns);

  // Determine project kind based on source file count
  // WHY: Each kind needs different Layer inference strategy
  const kind = determineKind(sourceFiles, testFiles);

  return { kind, sourceFiles, testFiles };
}

/**
 * Recursively scan directory for all files.
 *
 * WHY: Single-pass scan is faster than multiple glob operations.
 * Performance: O(n) where n = total files in project tree.
 */
function scanFiles(root: string): string[] {
  // Check if directory exists to avoid ENOENT errors
  // WHY: Defensive check prevents crashes on invalid paths
  if (!fs.existsSync(root)) {
    return [];
  }

  const files: string[] = [];

  // Recursive readdir with file type filtering
  // WHY: Node 18+ recursive option eliminates manual traversal overhead
  const entries = fs.readdirSync(root, { recursive: true, withFileTypes: true });

  for (const entry of entries) {
    // Skip directories (only collect files)
    if (!entry.isFile()) {
      continue;
    }

    // Build relative path for consistent handling
    // WHY: Relative paths work across different project structures
    const relativePath = path.relative(root, path.join(entry.parentPath ?? root, entry.name));
    files.push(relativePath);
  }

  return files;
}

/**
 * Classify files into source and test categories.
 *
 * WHY: Separation enables accurate source count without test file pollution.
 * Test files in tests/__ or *.test.* patterns shouldn't inflate source metrics.
 */
function classifyFiles(
  files: string[],
  extensions: string[],
  testPatterns?: string[]
): { sourceFiles: string[]; testFiles: string[] } {
  const patterns = testPatterns ?? DEFAULT_TEST_PATTERNS;

  const sourceFiles: string[] = [];
  const testFiles: string[] = [];

  for (const file of files) {
    // Check if file matches test pattern
    // WHY: Test patterns indicate non-production code
    if (isTestFile(file, patterns)) {
      testFiles.push(file);
      continue;
    }

    // Check if file has source extension
    // WHY: Extension filtering excludes config, docs, assets from source count
    const ext = path.extname(file);
    if (extensions.includes(ext)) {
      sourceFiles.push(file);
    }
  }

  return { sourceFiles, testFiles };
}

/**
 * Check if file matches any test pattern.
 *
 * WHY: Multiple naming conventions exist (*.test.*, *_test.*, tests/**).
 * Simple regex matching avoids heavy glob library overhead.
 */
function isTestFile(file: string, patterns: string[]): boolean {
  // Normalize path for consistent matching
  const normalized = file.replace(/\\/g, '/');

  for (const pattern of patterns) {
    // Convert glob pattern to regex
    // WHY: minimatch adds dependency; simple conversion suffices for known patterns
    const regex = globToRegex(pattern);
    if (regex.test(normalized)) {
      return true;
    }
  }

  return false;
}

/**
 * Convert glob-style pattern to regex.
 *
 * WHY: Known patterns are simple (asterisk-slash and dot-wildcards only).
 * Full glob parser would add 50+ lines and external dependency.
 *
 * LIMITATION: Only handles patterns from DEFAULT_TEST_PATTERNS.
 * Complex globs (nested braces, character classes) not supported.
 */
function globToRegex(pattern: string): RegExp {
  // Escape regex special chars except glob wildcards
  // WHY: Prevent regex injection from pattern strings
  let regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex specials
    .replace(/\*/g, '.*');                  // Convert * to regex wildcard

  // Anchor pattern for full match
  // WHY: Prevent partial matches (*.test.ts shouldn't match foo.test.ts.bak)
  if (!pattern.endsWith('/**')) {
    regexStr = '^' + regexStr + '$';
  } else {
    // Directory patterns match prefix (tests/** matches tests/foo/bar.ts)
    // WHY: tests/** should match all files under tests directory
    regexStr = '^' + regexStr.replace('/\\*\\*', '(/.*)?');
  }

  return new RegExp(regexStr);
}

/**
 * Determine project kind from file counts.
 *
 * WHY: Each kind requires different Layer inference:
 * - empty: Skip analysis entirely
 * - single-file: Force single Layer (no dependency depth)
 * - test-only: Invert analysis (test structure as source)
 * - normal: Apply standard inference rules
 */
function determineKind(sourceFiles: string[], testFiles: string[]): ProjectKind {
  const sourceCount = sourceFiles.length;

  if (sourceCount === 0) {
    // Only test files or truly empty
    // WHY: Test-only projects need special handling (test structure becomes "source")
    return testFiles.length > 0 ? 'test-only' : 'empty';
  }

  if (sourceCount === 1) {
    // Single source file
    // WHY: No Layer hierarchy possible; force single-layer inference
    return 'single-file';
  }

  return 'normal';
}