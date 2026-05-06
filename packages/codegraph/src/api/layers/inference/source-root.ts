/**
 * Source Root Discovery - Weighted Signal Scoring
 *
 * WHY: CodeGraph analysis needs to find the actual source root directory.
 * Project roots may have node_modules, dist, etc. but the real source is in src/, lib/, app/.
 * Weighted signal scoring provides reliable detection without hardcoding assumptions.
 *
 * Signal scoring algorithm:
 * - PACKAGE_JSON presence: +10 (strong indicator of project root)
 * - TS_CONFIG presence: +8 (TypeScript project configuration)
 * - TYPICAL_DIR name (src/lib/app): +15 (conventional source location)
 * - NO_NODE_MODULES: -20 (penalty for containing build artifacts)
 * - EXCLUDED_DIRS: -Infinity (never select build/test/git directories)
 */

import * as path from 'path';
import * as fs from 'fs';

/**
 * Signal weights for source root scoring.
 *
 * WHY: Weighted scoring handles edge cases better than binary matching.
 * A directory with package.json + tsconfig.json + src name gets high confidence.
 * A directory with node_modules gets penalized heavily.
 */
export const SIGNAL_WEIGHTS = {
  /** package.json presence indicates project root */
  PACKAGE_JSON: 10,
  /** tsconfig.json indicates TypeScript source */
  TS_CONFIG: 8,
  /** Typical source directory names (src, lib, app) */
  TYPICAL_DIR: 15,
  /** Penalty for containing node_modules (not source) */
  NO_NODE_MODULES: -20,
} as const;

/**
 * Directory names to exclude from source root consideration.
 *
 * WHY: Build artifacts, dependencies, tests, and git directories are never source roots.
 * Assigning -Infinity score ensures these directories are never selected,
 * even if they accidentally contain config files.
 */
export const EXCLUDED_DIRECTORIES = [
  'node_modules',
  'dist',
  'build',
  'test',
  'tests',
  '__tests__',
  '.git',
  '.github',
  'docs',
  'coverage',
  'scripts',
] as const;

/**
 * Typical source directory names that receive positive signal.
 */
const TYPICAL_SOURCE_NAMES = ['src', 'lib', 'app'] as const;

/**
 * Result of source root detection.
 */
export interface SourceRootResult {
  /** Detected source root directory (highest scored candidate) */
  sourceRoot: string;
  /** Score of selected source root */
  score: number;
  /** Confidence level (0-1) based on signal strength */
  confidence: number;
  /** All candidates with their scores */
  candidates: SourceRootCandidate[];
}

/**
 * Individual candidate directory with score.
 */
export interface SourceRootCandidate {
  /** Directory path */
  path: string;
  /** Calculated score from signals */
  score: number;
}

/**
 * Detect source root directory from candidates using weighted signal scoring.
 *
 * Algorithm:
 * 1. Filter out excluded directories (score = -Infinity)
 * 2. Score each remaining candidate based on signals
 * 3. Select highest scored directory
 * 4. Calculate confidence from score magnitude
 *
 * @param candidates - Array of directory paths to evaluate
 * @returns Source root result with selected path, score, and confidence
 */
export function detectSourceRoot(candidates: string[]): SourceRootResult {
  // Handle empty input
  if (candidates.length === 0) {
    return {
      sourceRoot: '',
      score: 0,
      confidence: 0,
      candidates: [],
    };
  }

  // Score all candidates
  const scoredCandidates: SourceRootCandidate[] = candidates.map((candidatePath) => ({
    path: candidatePath,
    score: calculateScore(candidatePath),
  }));

  // Sort by score descending (highest first)
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Select highest scored (first after sort)
  const best = scoredCandidates[0];

  // Calculate confidence from score
  // WHY: Confidence reflects certainty of selection.
  // - score >= 25: Strong signals (src + configs) -> high confidence
  // - score >= 10: Some signals (config files) -> medium confidence
  // - score <= 0: Weak or negative signals -> low confidence
  const confidence = calculateConfidence(best.score);

  return {
    sourceRoot: best.path,
    score: best.score,
    confidence,
    candidates: scoredCandidates,
  };
}

/**
 * Calculate score for a single candidate directory.
 *
 * Scoring rules:
 * - Excluded directories: -Infinity (never selected)
 * - Typical source names: +15
 * - package.json present: +10
 * - tsconfig.json present: +8
 * - Contains node_modules subdirectory: -20
 *
 * @param dirPath - Directory path to score
 * @returns Calculated score (-Infinity for excluded directories)
 */
function calculateScore(dirPath: string): number {
  // Get directory name for checks
  const dirName = path.basename(dirPath);

  // Check if directory is in exclusion list
  if (EXCLUDED_DIRECTORIES.includes(dirName as typeof EXCLUDED_DIRECTORIES[number])) {
    return -Infinity;
  }

  // Check if path exists (handle non-existent gracefully)
  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  let score = 0;

  // Check for typical source directory names
  if (TYPICAL_SOURCE_NAMES.includes(dirName as typeof TYPICAL_SOURCE_NAMES[number])) {
    score += SIGNAL_WEIGHTS.TYPICAL_DIR;
  }

  // Check for package.json
  if (fs.existsSync(path.join(dirPath, 'package.json'))) {
    score += SIGNAL_WEIGHTS.PACKAGE_JSON;
  }

  // Check for tsconfig.json
  if (fs.existsSync(path.join(dirPath, 'tsconfig.json'))) {
    score += SIGNAL_WEIGHTS.TS_CONFIG;
  }

  // Check for node_modules subdirectory (penalty)
  if (fs.existsSync(path.join(dirPath, 'node_modules'))) {
    score += SIGNAL_WEIGHTS.NO_NODE_MODULES;
  }

  return score;
}

/**
 * Calculate confidence level from score.
 *
 * WHY: Confidence helps users understand detection certainty.
 * Higher scores indicate stronger signals and more reliable detection.
 *
 * @param score - Calculated score
 * @returns Confidence level (0-1)
 */
function calculateConfidence(score: number): number {
  // Handle negative infinity or very negative scores
  if (score === -Infinity || score < 0) {
    return 0;
  }

  // Strong signals (>= 25) -> high confidence
  if (score >= 25) {
    return 0.9;
  }

  // Good signals (>= 15) -> medium-high confidence
  if (score >= 15) {
    return 0.7;
  }

  // Some signals (>= 8) -> medium confidence
  if (score >= 8) {
    return 0.5;
  }

  // Weak signals (> 0) -> low confidence
  if (score > 0) {
    return 0.3;
  }

  // No signals -> zero confidence
  return 0;
}