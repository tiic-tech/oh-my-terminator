/**
 * Edge Case Handler Type Definitions
 *
 * WHY: One Truth principle - types defined once, used across all edge case modules.
 * All modules import from this single source, preventing type drift.
 *
 * @see edge-case-detector.ts - uses ProjectKind, SpecialCaseResult, DetectionOptions
 * @see test-file-filter.ts - uses TestPatterns, FilterResult
 */

/**
 * Project classification for edge case handling
 */
export type ProjectKind = 'empty' | 'single-file' | 'test-only' | 'normal';

/**
 * Detection result returned by detectSpecialCases()
 */
export interface SpecialCaseResult {
  kind: ProjectKind;
  sourceFiles: string[];
  testFiles: string[];
}

/**
 * Options for customizing detection behavior
 */
export interface DetectionOptions {
  /** Override default source file extensions */
  extensions?: string[];
  /** Override default test file patterns */
  testPatterns?: string[];
}

/**
 * Test file pattern configuration
 */
export interface TestPatterns {
  /** Override default patterns completely */
  customPatterns?: string[];
  /** Additional patterns to include (merged with defaults) */
  includePatterns?: string[];
}

/**
 * Filter result returned by excludeTestFiles()
 */
export interface FilterResult {
  /** Files that passed filter (non-test files) */
  kept: string[];
  /** Count of filtered test files */
  filtered: number;
  /** Paths of filtered test files */
  filteredFiles: string[];
}

/**
 * Default source file extensions
 * WHY: Standard web development file types, configurable for other stacks
 */
export const DEFAULT_SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.vue'];

/**
 * Default test file patterns (glob-style)
 * WHY: Covers common test naming conventions across JS/TS ecosystem
 */
export const DEFAULT_TEST_PATTERNS = [
  '*.test.ts',
  '*.test.tsx',
  '*.test.js',
  '*.test.jsx',
  '*.spec.ts',
  '*.spec.tsx',
  '*.spec.js',
  '*.spec.jsx',
  '*_test.ts',
  '*_test.js',
  'tests/**',
  '__tests__/**',
  'test/**',
  'spec/**',
];