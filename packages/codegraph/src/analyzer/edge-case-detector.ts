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
import { globToRegex } from '../cli/commands/glob-utils.js';
import { type ProjectKind, type SpecialCaseResult, type DetectionOptions, DEFAULT_SOURCE_EXTENSIONS, DEFAULT_TEST_PATTERNS } from './types.js';

/** Detects special project cases requiring non-standard analysis. WHY: Edge cases need different strategies to avoid misleading metrics. */
export function detectSpecialCases(
  projectRoot: string,
  options?: DetectionOptions
): SpecialCaseResult {
  // WHY: Resolve to absolute path for consistent file handling
  const absoluteRoot = path.resolve(projectRoot);

  // WHY: Different stacks have different source file types; use configured extensions or defaults
  const extensions = options?.extensions ?? DEFAULT_SOURCE_EXTENSIONS;

  // WHY: Project structure varies; scan all files recursively for complete coverage
  const allFiles = scanFiles(absoluteRoot);

  // WHY: Test files shouldn't count toward source complexity metrics; separate from source files
  const { sourceFiles, testFiles } = classifyFiles(allFiles, extensions, options?.testPatterns);

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
  // WHY: Defensive check prevents crashes on invalid paths
  if (!fs.existsSync(root)) {
    return [];
  }

  const files: string[] = [];

  // WHY: Node 18+ recursive option eliminates manual traversal overhead
  const entries = fs.readdirSync(root, { recursive: true, withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

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
    // WHY: Test patterns indicate non-production code
    if (isTestFile(file, patterns)) {
      testFiles.push(file);
      continue;
    }

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
  const normalized = file.replace(/\\/g, '/');

  for (const pattern of patterns) {
    // WHY: minimatch adds dependency; globToRegex suffices for known patterns
    const regex = globToRegex(pattern);
    if (regex.test(normalized)) {
      return true;
    }
  }

  return false;
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
    // WHY: Test-only projects need special handling (test structure becomes "source")
    return testFiles.length > 0 ? 'test-only' : 'empty';
  }

  if (sourceCount === 1) {
    // WHY: No Layer hierarchy possible; force single-layer inference
    return 'single-file';
  }

  return 'normal';
}