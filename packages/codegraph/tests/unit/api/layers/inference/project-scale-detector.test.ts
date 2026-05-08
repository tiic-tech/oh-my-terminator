import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  detectProjectScale,
  getProjectThreshold,
} from '../../../../../src/api/layers/inference/project-scale-detector.js';

describe('project-scale-detector', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create unique temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-scale-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('detectProjectScale', () => {
    it('should count files in src directory when src exists', () => {
      // Create src/ with 10 source files
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      for (let i = 0; i < 10; i++) {
        fs.writeFileSync(path.join(srcDir, `file${i}.ts`), '');
      }

      const count = detectProjectScale(tempDir);
      assert.strictEqual(count, 10);
    });

    it('should fall back to project root when src missing', () => {
      // Create files in root (no src/)
      for (let i = 0; i < 5; i++) {
        fs.writeFileSync(path.join(tempDir, `root${i}.ts`), '');
      }

      const count = detectProjectScale(tempDir);
      assert.strictEqual(count, 5);
    });

    it('should exclude test files from count', () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      // Create 8 source files
      for (let i = 0; i < 8; i++) {
        fs.writeFileSync(path.join(srcDir, `source${i}.ts`), '');
      }

      // Create 4 test files (should be excluded)
      fs.writeFileSync(path.join(srcDir, 'app.test.ts'), '');
      fs.writeFileSync(path.join(srcDir, 'utils.spec.ts'), '');
      fs.writeFileSync(path.join(srcDir, 'module_test.ts'), '');
      fs.writeFileSync(path.join(srcDir, 'handler.test.tsx'), '');

      const count = detectProjectScale(tempDir);
      assert.strictEqual(count, 8);
    });

    it('should count files with all supported extensions', () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      // Create files with each extension type
      fs.writeFileSync(path.join(srcDir, 'a.ts'), '');
      fs.writeFileSync(path.join(srcDir, 'b.tsx'), '');
      fs.writeFileSync(path.join(srcDir, 'c.js'), '');
      fs.writeFileSync(path.join(srcDir, 'd.jsx'), '');
      fs.writeFileSync(path.join(srcDir, 'e.vue'), '');

      const count = detectProjectScale(tempDir);
      assert.strictEqual(count, 5);
    });

    it('should handle empty project', () => {
      const count = detectProjectScale(tempDir);
      assert.strictEqual(count, 0);
    });

    it('should handle nested directories', () => {
      const srcDir = path.join(tempDir, 'src');
      const nestedDir = path.join(srcDir, 'components', 'ui');
      const utilsDir = path.join(srcDir, 'utils');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.mkdirSync(utilsDir, { recursive: true });

      // Files at different levels
      fs.writeFileSync(path.join(srcDir, 'index.ts'), '');
      fs.writeFileSync(path.join(srcDir, 'utils', 'helper.ts'), '');
      fs.writeFileSync(path.join(nestedDir, 'Button.tsx'), '');

      const count = detectProjectScale(tempDir);
      assert.strictEqual(count, 3);
    });

    it('should exclude files in tests directory', () => {
      const srcDir = path.join(tempDir, 'src');
      const testsDir = path.join(tempDir, 'tests');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.mkdirSync(testsDir, { recursive: true });

      // Source files
      fs.writeFileSync(path.join(srcDir, 'main.ts'), '');
      fs.writeFileSync(path.join(srcDir, 'app.ts'), '');

      // Test files in tests/
      fs.writeFileSync(path.join(testsDir, 'main.test.ts'), '');

      // When src exists, tests/ outside src should not be counted
      // (but when scanning src, test patterns inside src are excluded)
      const count = detectProjectScale(tempDir);
      assert.strictEqual(count, 2);
    });

    it('should handle project with only test files in src', () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      // Only test files
      fs.writeFileSync(path.join(srcDir, 'a.test.ts'), '');
      fs.writeFileSync(path.join(srcDir, 'b.spec.ts'), '');

      const count = detectProjectScale(tempDir);
      assert.strictEqual(count, 0);
    });

    it('should handle project with src/ containing subdirectories with tests', () => {
      const srcDir = path.join(tempDir, 'src');
      const nestedTestsDir = path.join(srcDir, '__tests__');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.mkdirSync(nestedTestsDir, { recursive: true });

      // Source files
      fs.writeFileSync(path.join(srcDir, 'lib.ts'), '');
      fs.writeFileSync(path.join(srcDir, 'utils.ts'), '');

      // Test files in __tests__ subdirectory
      fs.writeFileSync(path.join(nestedTestsDir, 'lib.test.ts'), '');

      const count = detectProjectScale(tempDir);
      assert.strictEqual(count, 2);
    });
  });

  describe('getProjectThreshold', () => {
    it('should return threshold 5 for small project (30 files)', () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      for (let i = 0; i < 30; i++) {
        fs.writeFileSync(path.join(srcDir, `file${i}.ts`), '');
      }

      const threshold = getProjectThreshold(tempDir);
      assert.strictEqual(threshold, 5);
    });

    it('should return threshold 3 for medium project (150 files)', () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      for (let i = 0; i < 150; i++) {
        fs.writeFileSync(path.join(srcDir, `file${i}.ts`), '');
      }

      const threshold = getProjectThreshold(tempDir);
      assert.strictEqual(threshold, 3);
    });

    it('should return threshold 2 for large project (400 files)', () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      for (let i = 0; i < 400; i++) {
        fs.writeFileSync(path.join(srcDir, `file${i}.ts`), '');
      }

      const threshold = getProjectThreshold(tempDir);
      assert.strictEqual(threshold, 2);
    });

    it('should return threshold 1 for enterprise project (800 files)', () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      for (let i = 0; i < 800; i++) {
        fs.writeFileSync(path.join(srcDir, `file${i}.ts`), '');
      }

      const threshold = getProjectThreshold(tempDir);
      assert.strictEqual(threshold, 1);
    });

    it('should calculate threshold excluding test files', () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      // 45 source files + 10 test files
      for (let i = 0; i < 45; i++) {
        fs.writeFileSync(path.join(srcDir, `source${i}.ts`), '');
      }

      for (let i = 0; i < 10; i++) {
        fs.writeFileSync(path.join(srcDir, `test${i}.test.ts`), '');
      }

      // 45 files -> SMALL tier (threshold 5)
      const threshold = getProjectThreshold(tempDir);
      assert.strictEqual(threshold, 5);
    });
  });

  describe('edge cases', () => {
    it('should handle non-existent directory gracefully', () => {
      const nonExistent = path.join(os.tmpdir(), 'non-existent-dir');
      const count = detectProjectScale(nonExistent);
      assert.strictEqual(count, 0);
    });

    it('should ignore non-source files', () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      // Source files
      fs.writeFileSync(path.join(srcDir, 'app.ts'), '');

      // Non-source files (should be ignored)
      fs.writeFileSync(path.join(srcDir, 'config.json'), '');
      fs.writeFileSync(path.join(srcDir, 'README.md'), '');
      fs.writeFileSync(path.join(srcDir, 'styles.css'), '');

      const count = detectProjectScale(tempDir);
      assert.strictEqual(count, 1);
    });

    it('should handle deeply nested structure', () => {
      const deepDir = path.join(tempDir, 'src', 'a', 'b', 'c', 'd', 'e');
      fs.mkdirSync(deepDir, { recursive: true });

      fs.writeFileSync(path.join(deepDir, 'deep.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'src', 'root.ts'), '');

      const count = detectProjectScale(tempDir);
      assert.strictEqual(count, 2);
    });
  });
});