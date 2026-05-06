/**
 * E2E: Threshold Selection Tests
 *
 * WHY: Verify dynamic threshold selection works correctly across different project sizes.
 * Larger projects should use more conservative (lower) thresholds to limit recursion depth.
 *
 * Threshold tiers (from depth-presets.ts):
 * - SMALL (≤50 files): threshold 5 (aggressive depth)
 * - MEDIUM (≤200 files): threshold 3 (balanced)
 * - LARGE (≤500 files): threshold 2 (conservative)
 * - ENTERPRISE (unlimited): threshold 1 (most conservative)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getProjectThreshold, detectProjectScale } from '../../src/api/layers/inference/index.js';

describe('E2E: Threshold Selection', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'codegraph-e2e-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  /**
   * Create mock project with specified number of source files.
   *
   * WHY: Simulates real project structure for threshold testing.
   * Files are created in src/ directory to match conventional project layout.
   *
   * @param fileCount - Number of .ts files to create (non-test files)
   */
  function createMockProject(fileCount: number): void {
    const srcDir = join(tempDir, 'src');
    mkdirSync(srcDir, { recursive: true });

    // Create unique source files with descriptive names
    // WHY: Avoid test file patterns (*.test.ts) that would be filtered out
    for (let i = 0; i < fileCount; i++) {
      const fileName = `module-${i.toString().padStart(4, '0')}.ts`;
      writeFileSync(join(srcDir, fileName), `// Mock module ${i}\nexport const id = ${i};\n`);
    }
  }

  // ========================================
  // Task 5.1: Small project (30 files)
  // ========================================

  it('should return threshold 5 for small project (30 files)', () => {
    createMockProject(30);
    const threshold = getProjectThreshold(tempDir);
    assert.strictEqual(threshold, 5, '30 files should use SMALL tier (threshold 5)');
  });

  // ========================================
  // Task 5.2: Medium project (150 files)
  // ========================================

  it('should return threshold 3 for medium project (150 files)', () => {
    createMockProject(150);
    const threshold = getProjectThreshold(tempDir);
    assert.strictEqual(threshold, 3, '150 files should use MEDIUM tier (threshold 3)');
  });

  // ========================================
  // Task 5.3: Large project (400 files)
  // ========================================

  it('should return threshold 2 for large project (400 files)', () => {
    createMockProject(400);
    const threshold = getProjectThreshold(tempDir);
    assert.strictEqual(threshold, 2, '400 files should use LARGE tier (threshold 2)');
  });

  // ========================================
  // Task 5.4: Enterprise project (800 files)
  // ========================================

  it('should return threshold 1 for enterprise project (800 files)', () => {
    createMockProject(800);
    const threshold = getProjectThreshold(tempDir);
    assert.strictEqual(threshold, 1, '800 files should use ENTERPRISE tier (threshold 1)');
  });

  // ========================================
  // Additional validation tests
  // ========================================

  it('should detect correct file count via detectProjectScale', () => {
    createMockProject(30);
    const fileCount = detectProjectScale(tempDir);
    assert.strictEqual(fileCount, 30, 'detectProjectScale should return exact file count');
  });

  it('should return 0 for non-existent directory', () => {
    const nonExistent = join(tmpdir(), 'non-existent-dir');
    const fileCount = detectProjectScale(nonExistent);
    assert.strictEqual(fileCount, 0, 'Non-existent directory should return 0');
  });

  it('should handle project without src/ directory', () => {
    // Create files in root (no src/ directory)
    for (let i = 0; i < 20; i++) {
      const fileName = `root-module-${i.toString().padStart(4, '0')}.ts`;
      writeFileSync(join(tempDir, fileName), `// Root module ${i}\nexport const id = ${i};\n`);
    }

    const threshold = getProjectThreshold(tempDir);
    assert.strictEqual(threshold, 5, '20 files in root should still use SMALL tier');
  });

  it('should exclude test files from file count', () => {
    const srcDir = join(tempDir, 'src');
    mkdirSync(srcDir, { recursive: true });

    // Create 30 production files
    for (let i = 0; i < 30; i++) {
      writeFileSync(join(srcDir, `prod-${i}.ts`), `export const id = ${i};\n`);
    }

    // Create 10 test files (should be excluded)
    for (let i = 0; i < 10; i++) {
      writeFileSync(join(srcDir, `prod-${i}.test.ts`), `import { id } from './prod-${i}';\n`);
    }

    const fileCount = detectProjectScale(tempDir);
    // Should count only 30 production files
    assert.strictEqual(fileCount, 30, 'Test files should be excluded from file count');
  });

  // ========================================
  // Boundary tests
  // ========================================

  it('should use SMALL tier at boundary (50 files)', () => {
    createMockProject(50);
    const threshold = getProjectThreshold(tempDir);
    assert.strictEqual(threshold, 5, 'Exactly 50 files should use SMALL tier');
  });

  it('should use MEDIUM tier just above SMALL boundary (51 files)', () => {
    createMockProject(51);
    const threshold = getProjectThreshold(tempDir);
    assert.strictEqual(threshold, 3, '51 files should use MEDIUM tier');
  });

  it('should use MEDIUM tier at boundary (200 files)', () => {
    createMockProject(200);
    const threshold = getProjectThreshold(tempDir);
    assert.strictEqual(threshold, 3, 'Exactly 200 files should use MEDIUM tier');
  });

  it('should use LARGE tier just above MEDIUM boundary (201 files)', () => {
    createMockProject(201);
    const threshold = getProjectThreshold(tempDir);
    assert.strictEqual(threshold, 2, '201 files should use LARGE tier');
  });

  it('should use LARGE tier at boundary (500 files)', () => {
    createMockProject(500);
    const threshold = getProjectThreshold(tempDir);
    assert.strictEqual(threshold, 2, 'Exactly 500 files should use LARGE tier');
  });

  it('should use ENTERPRISE tier just above LARGE boundary (501 files)', () => {
    createMockProject(501);
    const threshold = getProjectThreshold(tempDir);
    assert.strictEqual(threshold, 1, '501 files should use ENTERPRISE tier');
  });
});