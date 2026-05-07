/**
 * @oh-my-terminator/codegraph
 *
 * Source Root Detection Constants
 *
 * WHY: Constants define project markers and search parameters.
 * Separated from types and logic for single-source-of-truth management.
 */

import { ProjectType } from './types.js';

// ============================================================================
// Project Markers Configuration
// ============================================================================

/**
 * Language-specific project marker files organized by project type.
 *
 * WHY: Universal markers indicate the logical source root. Language markers
 * provide more precise context than generic .git fallback in monorepos.
 */
export const PROJECT_MARKERS = {
  /** Rust project markers */
  rust: ['Cargo.toml', 'Cargo.lock'],
  /** Go project markers */
  go: ['go.mod', 'go.sum'],
  /** Node.js project markers */
  nodejs: ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
  /** Python project markers */
  python: ['pyproject.toml', 'setup.py', 'requirements.txt', 'Pipfile'],
} as const;

/**
 * Reverse mapping: marker file name → project type.
 *
 * WHY: Single source of truth for marker-to-type mapping (One Truth principle).
 * Eliminates repetitive if-else blocks in detection logic.
 *
 * HOW: Built from PROJECT_MARKERS, ensures consistency between forward and reverse mappings.
 */
export const MARKER_TO_PROJECT_TYPE: Record<string, Exclude<ProjectType, 'generic'>> = {
  // Rust markers
  'Cargo.toml': 'rust',
  'Cargo.lock': 'rust',
  // Go markers
  'go.mod': 'go',
  'go.sum': 'go',
  // Node.js markers
  'package.json': 'nodejs',
  'package-lock.json': 'nodejs',
  'yarn.lock': 'nodejs',
  'pnpm-lock.yaml': 'nodejs',
  // Python markers
  'pyproject.toml': 'python',
  'setup.py': 'python',
  'requirements.txt': 'python',
  'Pipfile': 'python',
};

/**
 * Alphabetical priority order for language markers at the same directory level.
 *
 * WHY: Deterministic output when multiple markers exist. No need to maintain
 * type priority list - simple alphabetical sorting is predictable and stable.
 *
 * Priority: Cargo.toml > go.mod > package.json > pyproject.toml > setup.py
 */
export const MARKER_PRIORITY: readonly string[] = [
  'Cargo.toml',
  'Cargo.lock',
  'go.mod',
  'go.sum',
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'pyproject.toml',
  'setup.py',
  'requirements.txt',
  'Pipfile',
];

/**
 * Generic fallback marker for projects without language-specific markers.
 *
 * WHY: .git directory indicates a repository root. Useful fallback when
 * no language markers are present, but may be less precise in monorepos.
 */
export const GENERIC_MARKER = '.git';

/**
 * Maximum upward search depth from current working directory.
 *
 * WHY: Prevents infinite loops in edge cases (circular symlinks, deeply nested).
 * 10 levels covers typical project structures while maintaining reasonable performance.
 */
export const MAX_SEARCH_DEPTH = 10;