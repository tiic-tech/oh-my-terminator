/**
 * Unit tests for source root detection (Phase 1: Source Root Discovery)
 *
 * Tests the signal-based scoring algorithm for detecting source root directories.
 * Run with: pnpm test tests/unit/source-root.test.ts
 *
 * TDD RED Phase: Tests written before implementation.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Import module to test (will fail initially - RED phase)
import {
  SIGNAL_WEIGHTS,
  EXCLUDED_DIRECTORIES,
  detectSourceRoot,
  SourceRootResult,
  SourceRootCandidate,
} from '../../src/api/layers/inference/source-root.js';

// ============================================================================
// Task 1.2: SIGNAL_WEIGHTS configuration
// ============================================================================
describe('SIGNAL_WEIGHTS (Task 1.2)', () => {
  it('should define PACKAGE_JSON weight as +10', () => {
    assert.strictEqual(SIGNAL_WEIGHTS.PACKAGE_JSON, 10);
  });

  it('should define TS_CONFIG weight as +8', () => {
    assert.strictEqual(SIGNAL_WEIGHTS.TS_CONFIG, 8);
  });

  it('should define TYPICAL_DIR weight as +15', () => {
    assert.strictEqual(SIGNAL_WEIGHTS.TYPICAL_DIR, 15);
  });

  it('should define NO_NODE_MODULES weight as -20', () => {
    assert.strictEqual(SIGNAL_WEIGHTS.NO_NODE_MODULES, -20);
  });

  it('should have all required signal keys', () => {
    const requiredKeys = ['PACKAGE_JSON', 'TS_CONFIG', 'TYPICAL_DIR', 'NO_NODE_MODULES'];
    for (const key of requiredKeys) {
      assert.ok(
        key in SIGNAL_WEIGHTS,
        `Missing required signal key: ${key}`
      );
    }
  });

  it('should have positive weights for presence signals', () => {
    // Presence of config files and typical dirs should be positive signals
    assert.ok(SIGNAL_WEIGHTS.PACKAGE_JSON > 0, 'PACKAGE_JSON should be positive');
    assert.ok(SIGNAL_WEIGHTS.TS_CONFIG > 0, 'TS_CONFIG should be positive');
    assert.ok(SIGNAL_WEIGHTS.TYPICAL_DIR > 0, 'TYPICAL_DIR should be positive');
  });

  it('should have negative weight for node_modules presence', () => {
    // node_modules presence is a negative signal (not source root)
    assert.ok(SIGNAL_WEIGHTS.NO_NODE_MODULES < 0, 'NO_NODE_MODULES should be negative');
  });
});

// ============================================================================
// Task 1.3: EXCLUDED_DIRECTORIES list
// ============================================================================
describe('EXCLUDED_DIRECTORIES (Task 1.3)', () => {
  it('should exclude node_modules', () => {
    assert.ok(EXCLUDED_DIRECTORIES.includes('node_modules'));
  });

  it('should exclude dist', () => {
    assert.ok(EXCLUDED_DIRECTORIES.includes('dist'));
  });

  it('should exclude build', () => {
    assert.ok(EXCLUDED_DIRECTORIES.includes('build'));
  });

  it('should exclude test directories', () => {
    assert.ok(EXCLUDED_DIRECTORIES.includes('test'));
    assert.ok(EXCLUDED_DIRECTORIES.includes('tests'));
    assert.ok(EXCLUDED_DIRECTORIES.includes('__tests__'));
  });

  it('should exclude git directories', () => {
    assert.ok(EXCLUDED_DIRECTORIES.includes('.git'));
    assert.ok(EXCLUDED_DIRECTORIES.includes('.github'));
  });

  it('should exclude docs', () => {
    assert.ok(EXCLUDED_DIRECTORIES.includes('docs'));
  });

  it('should exclude coverage', () => {
    assert.ok(EXCLUDED_DIRECTORIES.includes('coverage'));
  });

  it('should exclude scripts', () => {
    assert.ok(EXCLUDED_DIRECTORIES.includes('scripts'));
  });

  it('should have all required excluded directories', () => {
    const required = [
      'node_modules', 'dist', 'build', 'test', 'tests', '__tests__',
      '.git', '.github', 'docs', 'coverage', 'scripts'
    ];
    for (const dir of required) {
      assert.ok(
        EXCLUDED_DIRECTORIES.includes(dir),
        `Missing required excluded directory: ${dir}`
      );
    }
  });
});

// ============================================================================
// Task 1.4: detectSourceRoot function - signal scoring
// ============================================================================
describe('detectSourceRoot() - Signal Scoring (Task 1.4)', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create unique temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-root-test-'));
  });

  it('should score package.json presence with +10', async () => {
    // Create directory with package.json
    const dirWithPkg = path.join(tempDir, 'with-package');
    fs.mkdirSync(dirWithPkg);
    fs.writeFileSync(path.join(dirWithPkg, 'package.json'), '{}');

    const result = detectSourceRoot([dirWithPkg]);

    // Should have positive score from package.json signal
    const candidate = result.candidates.find(c => c.path === dirWithPkg);
    assert.ok(candidate, 'Should find candidate for test directory');
    assert.ok(candidate.score >= 10, `Score should be >= 10 (got ${candidate.score})`);
  });

  it('should score tsconfig.json presence with +8', async () => {
    // Create directory with tsconfig.json
    const dirWithTsconfig = path.join(tempDir, 'with-tsconfig');
    fs.mkdirSync(dirWithTsconfig);
    fs.writeFileSync(path.join(dirWithTsconfig, 'tsconfig.json'), '{}');

    const result = detectSourceRoot([dirWithTsconfig]);

    const candidate = result.candidates.find(c => c.path === dirWithTsconfig);
    assert.ok(candidate, 'Should find candidate');
    assert.ok(candidate.score >= 8, `Score should be >= 8 (got ${candidate.score})`);
  });

  it('should score typical dir names (src, lib, app) with +15', async () => {
    const srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir);

    const result = detectSourceRoot([srcDir]);

    const candidate = result.candidates.find(c => c.path === srcDir);
    assert.ok(candidate, 'Should find candidate for src');
    assert.ok(candidate.score >= 15, `Score for src should be >= 15 (got ${candidate.score})`);
  });

  it('should penalize node_modules presence with -20', async () => {
    const dirWithNodeModules = path.join(tempDir, 'with-modules');
    fs.mkdirSync(dirWithNodeModules);
    fs.mkdirSync(path.join(dirWithNodeModules, 'node_modules'));

    const result = detectSourceRoot([dirWithNodeModules]);

    const candidate = result.candidates.find(c => c.path === dirWithNodeModules);
    assert.ok(candidate, 'Should find candidate');
    // Score should be penalized
    assert.ok(candidate.score <= -20, `Score should be <= -20 (got ${candidate.score})`);
  });

  it('should combine multiple signals correctly', async () => {
    // Create src/ with package.json and tsconfig.json (ideal source root)
    const idealDir = path.join(tempDir, 'src');
    fs.mkdirSync(idealDir);
    fs.writeFileSync(path.join(idealDir, 'package.json'), '{}');
    fs.writeFileSync(path.join(idealDir, 'tsconfig.json'), '{}');

    const result = detectSourceRoot([idealDir]);

    const candidate = result.candidates.find(c => c.path === idealDir);
    assert.ok(candidate, 'Should find candidate');
    // Expected: TYPICAL_DIR(15) + PACKAGE_JSON(10) + TS_CONFIG(8) = 33
    assert.strictEqual(candidate.score, 33, 'Combined score should be 33');
  });

  it('should return highest scored directory as sourceRoot', async () => {
    // Create two directories with different scores
    const lowScoreDir = path.join(tempDir, 'low');
    fs.mkdirSync(lowScoreDir);

    const highScoreDir = path.join(tempDir, 'src');
    fs.mkdirSync(highScoreDir);
    fs.writeFileSync(path.join(highScoreDir, 'package.json'), '{}');

    const result = detectSourceRoot([lowScoreDir, highScoreDir]);

    // src/ should win because it has higher score
    assert.strictEqual(result.sourceRoot, highScoreDir);
    assert.ok(result.score > 0, 'Winning score should be positive');
  });

  it('should handle empty candidates array', () => {
    const result = detectSourceRoot([]);

    // Should have empty result with reasonable defaults
    assert.strictEqual(result.sourceRoot, '');
    assert.strictEqual(result.score, 0);
    assert.strictEqual(result.candidates.length, 0);
  });

  it('should handle non-existent directories gracefully', () => {
    const nonExistent = path.join(tempDir, 'does-not-exist');

    const result = detectSourceRoot([nonExistent]);

    // Should handle gracefully, not crash
    assert.ok(result, 'Should return result without crashing');
    // Non-existent directory should have low score or be excluded
    const candidate = result.candidates.find(c => c.path === nonExistent);
    if (candidate) {
      assert.ok(candidate.score <= 0, 'Non-existent path should have zero or negative score');
    }
  });
});

// ============================================================================
// Task 1.6: Exclusion list behavior
// ============================================================================
describe('detectSourceRoot() - Exclusion Behavior (Task 1.6)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-root-exclude-'));
  });

  it('should assign score -Infinity to excluded directories', async () => {
    const nodeModulesDir = path.join(tempDir, 'node_modules');
    fs.mkdirSync(nodeModulesDir);

    const result = detectSourceRoot([nodeModulesDir]);

    const candidate = result.candidates.find(c => c.path === nodeModulesDir);
    assert.ok(candidate, 'Should find candidate for excluded dir');
    // Excluded directories should have minimum score
    assert.strictEqual(candidate.score, -Infinity, 'Excluded dir should have -Infinity score');
  });

  it('should never select excluded directory as sourceRoot', async () => {
    // Create excluded dir with config files (should still be excluded)
    const nodeModulesDir = path.join(tempDir, 'node_modules');
    fs.mkdirSync(nodeModulesDir);
    fs.writeFileSync(path.join(nodeModulesDir, 'package.json'), '{}');

    // Create a regular directory with no signals
    const regularDir = path.join(tempDir, 'regular');
    fs.mkdirSync(regularDir);

    const result = detectSourceRoot([nodeModulesDir, regularDir]);

    // node_modules should never be selected, even with package.json
    assert.notStrictEqual(result.sourceRoot, nodeModulesDir);
  });

  it('should exclude dist directory', async () => {
    const distDir = path.join(tempDir, 'dist');
    fs.mkdirSync(distDir);

    const result = detectSourceRoot([distDir]);

    const candidate = result.candidates.find(c => c.path === distDir);
    assert.ok(candidate, 'Should find candidate');
    assert.strictEqual(candidate.score, -Infinity);
  });

  it('should exclude build directory', async () => {
    const buildDir = path.join(tempDir, 'build');
    fs.mkdirSync(buildDir);

    const result = detectSourceRoot([buildDir]);

    const candidate = result.candidates.find(c => c.path === buildDir);
    assert.ok(candidate, 'Should find candidate');
    assert.strictEqual(candidate.score, -Infinity);
  });

  it('should exclude .git directory', async () => {
    const gitDir = path.join(tempDir, '.git');
    fs.mkdirSync(gitDir);

    const result = detectSourceRoot([gitDir]);

    const candidate = result.candidates.find(c => c.path === gitDir);
    assert.ok(candidate, 'Should find candidate');
    assert.strictEqual(candidate.score, -Infinity);
  });

  it('should exclude __tests__ directory', async () => {
    const testsDir = path.join(tempDir, '__tests__');
    fs.mkdirSync(testsDir);

    const result = detectSourceRoot([testsDir]);

    const candidate = result.candidates.find(c => c.path === testsDir);
    assert.ok(candidate, 'Should find candidate');
    assert.strictEqual(candidate.score, -Infinity);
  });
});

// ============================================================================
// SourceRootResult interface validation
// ============================================================================
describe('SourceRootResult interface', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-root-result-'));
  });

  it('should return sourceRoot as string', async () => {
    const dir = path.join(tempDir, 'src');
    fs.mkdirSync(dir);

    const result = detectSourceRoot([dir]);

    assert.strictEqual(typeof result.sourceRoot, 'string');
  });

  it('should return score as number', async () => {
    const dir = path.join(tempDir, 'src');
    fs.mkdirSync(dir);

    const result = detectSourceRoot([dir]);

    assert.strictEqual(typeof result.score, 'number');
  });

  it('should return confidence as number between 0 and 1', async () => {
    const dir = path.join(tempDir, 'src');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'package.json'), '{}');

    const result = detectSourceRoot([dir]);

    assert.strictEqual(typeof result.confidence, 'number');
    assert.ok(result.confidence >= 0, 'Confidence should be >= 0');
    assert.ok(result.confidence <= 1, 'Confidence should be <= 1');
  });

  it('should return candidates array with path and score', async () => {
    const dir1 = path.join(tempDir, 'src');
    const dir2 = path.join(tempDir, 'lib');
    fs.mkdirSync(dir1);
    fs.mkdirSync(dir2);

    const result = detectSourceRoot([dir1, dir2]);

    assert.ok(Array.isArray(result.candidates), 'candidates should be array');
    assert.strictEqual(result.candidates.length, 2);

    for (const candidate of result.candidates) {
      assert.ok('path' in candidate, 'Each candidate should have path');
      assert.ok('score' in candidate, 'Each candidate should have score');
      assert.strictEqual(typeof candidate.path, 'string');
      assert.strictEqual(typeof candidate.score, 'number');
    }
  });

  it('should have high confidence for strong signals', async () => {
    // Ideal source root: src/ + package.json + tsconfig.json
    const idealDir = path.join(tempDir, 'src');
    fs.mkdirSync(idealDir);
    fs.writeFileSync(path.join(idealDir, 'package.json'), '{}');
    fs.writeFileSync(path.join(idealDir, 'tsconfig.json'), '{}');

    const result = detectSourceRoot([idealDir]);

    // High score (33) should give high confidence
    assert.ok(result.confidence >= 0.8, `High score should give high confidence (got ${result.confidence})`);
  });

  it('should have low confidence for weak signals', async () => {
    // Random directory with no signals
    const weakDir = path.join(tempDir, 'random');
    fs.mkdirSync(weakDir);

    const result = detectSourceRoot([weakDir]);

    // Score 0 should give low confidence
    assert.ok(result.confidence <= 0.3, `Low score should give low confidence (got ${result.confidence})`);
  });
});

// ============================================================================
// Edge cases
// ============================================================================
describe('Edge cases', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-root-edge-'));
  });

  it('should handle single candidate', async () => {
    const dir = path.join(tempDir, 'src');
    fs.mkdirSync(dir);

    const result = detectSourceRoot([dir]);

    assert.strictEqual(result.sourceRoot, dir);
    assert.strictEqual(result.candidates.length, 1);
  });

  it('should handle candidates with same scores', async () => {
    // Create two directories with identical signals
    const dir1 = path.join(tempDir, 'lib');
    const dir2 = path.join(tempDir, 'app');
    fs.mkdirSync(dir1);
    fs.mkdirSync(dir2);

    const result = detectSourceRoot([dir1, dir2]);

    // Both have same TYPICAL_DIR score (15)
    // Should pick one (first in input order)
    assert.ok(result.sourceRoot === dir1 || result.sourceRoot === dir2);
    assert.strictEqual(result.score, 15);
  });

  it('should handle deeply nested paths', async () => {
    const deepDir = path.join(tempDir, 'deeply', 'nested', 'src');
    fs.mkdirSync(deepDir, { recursive: true });

    const result = detectSourceRoot([deepDir]);

    assert.strictEqual(result.sourceRoot, deepDir);
  });

  it('should score lib as typical directory', async () => {
    const libDir = path.join(tempDir, 'lib');
    fs.mkdirSync(libDir);

    const result = detectSourceRoot([libDir]);

    const candidate = result.candidates.find(c => c.path === libDir);
    assert.ok(candidate, 'Should find candidate');
    assert.ok(candidate.score >= 15, 'lib should be scored as typical dir');
  });

  it('should score app as typical directory', async () => {
    const appDir = path.join(tempDir, 'app');
    fs.mkdirSync(appDir);

    const result = detectSourceRoot([appDir]);

    const candidate = result.candidates.find(c => c.path === appDir);
    assert.ok(candidate, 'Should find candidate');
    assert.ok(candidate.score >= 15, 'app should be scored as typical dir');
  });
});