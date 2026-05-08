import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { performance } from 'perf_hooks';
import {
  detectSpecialCases,
  type ProjectKind,
  type SpecialCaseResult,
  type DetectionOptions,
} from '../../../src/analyzer/edge-case-detector.js';

describe('edge-case-detector', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('detectSpecialCases function', () => {
    it('should return SpecialCaseResult structure', async () => {
      const result = detectSpecialCases(tempDir);

      assert.ok(typeof result.kind === 'string');
      assert.ok(Array.isArray(result.sourceFiles));
      assert.ok(Array.isArray(result.testFiles));
    });

    it('should detect empty project (no source files)', async () => {
      const result = detectSpecialCases(tempDir);

      assert.strictEqual(result.kind, 'empty');
      assert.strictEqual(result.sourceFiles.length, 0);
      assert.strictEqual(result.testFiles.length, 0);
    });

    it('should detect single-file project', async () => {
      fs.writeFileSync(path.join(tempDir, 'utils.ts'), '');

      const result = detectSpecialCases(tempDir);

      assert.strictEqual(result.kind, 'single-file');
      assert.strictEqual(result.sourceFiles.length, 1);
    });

    it('should detect normal project (2+ source files)', async () => {
      fs.writeFileSync(path.join(tempDir, 'a.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'b.ts'), '');

      const result = detectSpecialCases(tempDir);

      assert.strictEqual(result.kind, 'normal');
      assert.strictEqual(result.sourceFiles.length, 2);
    });

    it('should detect test-only project', async () => {
      fs.writeFileSync(path.join(tempDir, 'utils.test.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'main.spec.ts'), '');

      const result = detectSpecialCases(tempDir);

      assert.strictEqual(result.kind, 'test-only');
      assert.strictEqual(result.sourceFiles.length, 0);
      assert.strictEqual(result.testFiles.length, 2);
    });

    it('should classify test files separately from source count', async () => {
      fs.writeFileSync(path.join(tempDir, 'main.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'main.test.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'utils.spec.ts'), '');

      const result = detectSpecialCases(tempDir);

      assert.strictEqual(result.kind, 'single-file');
      assert.strictEqual(result.sourceFiles.length, 1);
      assert.strictEqual(result.testFiles.length, 2);
    });
  });

  describe('source file extension list', () => {
    it('should use default extensions: .ts, .tsx, .js, .jsx, .vue', async () => {
      fs.writeFileSync(path.join(tempDir, 'file.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'file.tsx'), '');
      fs.writeFileSync(path.join(tempDir, 'file.js'), '');
      fs.writeFileSync(path.join(tempDir, 'file.jsx'), '');
      fs.writeFileSync(path.join(tempDir, 'file.vue'), '');

      const result = detectSpecialCases(tempDir);

      assert.strictEqual(result.kind, 'normal');
      assert.strictEqual(result.sourceFiles.length, 5);
    });

    it('should ignore non-source extensions', async () => {
      fs.writeFileSync(path.join(tempDir, 'config.json'), '');
      fs.writeFileSync(path.join(tempDir, 'style.css'), '');
      fs.writeFileSync(path.join(tempDir, 'readme.md'), '');

      const result = detectSpecialCases(tempDir);

      assert.strictEqual(result.kind, 'empty');
    });

    it('should support custom extensions via options', async () => {
      fs.writeFileSync(path.join(tempDir, 'config.json'), '');

      const options: DetectionOptions = {
        extensions: ['.json'],
      };

      const result = detectSpecialCases(tempDir, options);

      assert.strictEqual(result.kind, 'single-file');
      assert.strictEqual(result.sourceFiles.length, 1);
    });
  });

  describe('test file pattern matching', () => {
    it('should match *.test.ts pattern', async () => {
      fs.writeFileSync(path.join(tempDir, 'utils.test.ts'), '');

      const result = detectSpecialCases(tempDir);

      assert.strictEqual(result.kind, 'test-only');
      assert.strictEqual(result.testFiles.length, 1);
    });

    it('should match *.spec.ts pattern', async () => {
      fs.writeFileSync(path.join(tempDir, 'utils.spec.ts'), '');

      const result = detectSpecialCases(tempDir);

      assert.strictEqual(result.kind, 'test-only');
    });

    it('should match *_test.ts pattern', async () => {
      fs.writeFileSync(path.join(tempDir, 'utils_test.ts'), '');

      const result = detectSpecialCases(tempDir);

      assert.strictEqual(result.kind, 'test-only');
    });

    it('should match tests/** directory pattern', async () => {
      fs.mkdirSync(path.join(tempDir, 'tests'));
      fs.writeFileSync(path.join(tempDir, 'tests', 'main.ts'), '');

      const result = detectSpecialCases(tempDir);

      assert.strictEqual(result.kind, 'test-only');
    });

    it('should match __tests__/** directory pattern', async () => {
      fs.mkdirSync(path.join(tempDir, '__tests__'));
      fs.writeFileSync(path.join(tempDir, '__tests__', 'main.ts'), '');

      const result = detectSpecialCases(tempDir);

      assert.strictEqual(result.kind, 'test-only');
    });
  });

  describe('detection performance', () => {
    it('should complete detection within 100ms for large projects', async () => {
      for (let i = 0; i < 1000; i++) {
        fs.writeFileSync(path.join(tempDir, `file${i}.ts`), '');
      }

      const start = performance.now();
      detectSpecialCases(tempDir);
      const elapsed = performance.now() - start;

      assert.ok(elapsed < 100, `Detection took ${elapsed}ms, expected <100ms`);
    });
  });
});