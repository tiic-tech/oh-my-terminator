import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { excludeTestFiles } from '../../../src/analyzer/test-file-filter.js';
import type { TestPatterns } from '../../../src/analyzer/types.js';

describe('excludeTestFiles', () => {
  describe('basic filtering', () => {
    it('filters test files from mixed list', () => {
      const input = ['src/utils.ts', 'src/utils.test.ts', 'tests/main.ts'];
      const result = excludeTestFiles(input);

      assert.deepEqual(result.kept, ['src/utils.ts']);
      assert.strictEqual(result.filtered, 2);
      assert.deepEqual(result.filteredFiles, ['src/utils.test.ts', 'tests/main.ts']);
    });

    it('returns empty array when all files are test files', () => {
      const input = ['src/a.test.ts', 'src/b.spec.ts', '__tests__/c.ts'];
      const result = excludeTestFiles(input);

      assert.deepEqual(result.kept, []);
      assert.strictEqual(result.filtered, 3);
    });

    it('returns original list when no test files present', () => {
      const input = ['src/index.ts', 'src/utils.ts', 'lib/helper.js'];
      const result = excludeTestFiles(input);

      assert.deepEqual(result.kept, input);
      assert.strictEqual(result.filtered, 0);
      assert.deepEqual(result.filteredFiles, []);
    });
  });

  describe('default patterns', () => {
    it('matches *.test.ts pattern', () => {
      const result = excludeTestFiles(['app.test.ts', 'app.ts']);
      assert.deepEqual(result.kept, ['app.ts']);
    });

    it('matches *.spec.ts pattern', () => {
      const result = excludeTestFiles(['handler.spec.ts', 'handler.ts']);
      assert.deepEqual(result.kept, ['handler.ts']);
    });

    it('matches *_test.ts pattern', () => {
      const result = excludeTestFiles(['module_test.ts', 'module.ts']);
      assert.deepEqual(result.kept, ['module.ts']);
    });

    it('matches tests/** directory pattern', () => {
      const result = excludeTestFiles(['tests/unit/foo.ts', 'src/foo.ts']);
      assert.deepEqual(result.kept, ['src/foo.ts']);
    });

    it('matches __tests__/** directory pattern', () => {
      const result = excludeTestFiles(['__tests__/bar.ts', 'lib/bar.ts']);
      assert.deepEqual(result.kept, ['lib/bar.ts']);
    });

    it('matches test/** directory pattern', () => {
      const result = excludeTestFiles(['test/integration/api.ts', 'src/api.ts']);
      assert.deepEqual(result.kept, ['src/api.ts']);
    });

    it('matches spec/** directory pattern', () => {
      const result = excludeTestFiles(['spec/features/login.ts', 'src/login.ts']);
      assert.deepEqual(result.kept, ['src/login.ts']);
    });
  });

  describe('custom patterns', () => {
    it('customPatterns override defaults', () => {
      const patterns: TestPatterns = { customPatterns: ['*.e2e.ts'] };
      const input = ['src/app.test.ts', 'src/app.e2e.ts', 'src/app.ts'];
      const result = excludeTestFiles(input, patterns);

      // Only *.e2e.ts filtered, *.test.ts NOT filtered (defaults overridden)
      assert.deepEqual(result.kept, ['src/app.test.ts', 'src/app.ts']);
      assert.deepEqual(result.filteredFiles, ['src/app.e2e.ts']);
    });

    it('includePatterns merge with defaults', () => {
      const patterns: TestPatterns = { includePatterns: ['*.e2e.ts'] };
      const input = ['src/app.test.ts', 'src/app.e2e.ts', 'src/app.ts'];
      const result = excludeTestFiles(input, patterns);

      // Both default (*.test.ts) and additional (*.e2e.ts) filtered
      assert.deepEqual(result.kept, ['src/app.ts']);
      assert.strictEqual(result.filtered, 2);
    });
  });

  describe('edge cases', () => {
    it('handles empty input', () => {
      const result = excludeTestFiles([]);
      assert.deepEqual(result.kept, []);
      assert.strictEqual(result.filtered, 0);
    });

    it('handles files with multiple extensions', () => {
      const input = ['component.test.tsx', 'component.tsx'];
      const result = excludeTestFiles(input);
      assert.deepEqual(result.kept, ['component.tsx']);
    });

    it('handles deeply nested test directories', () => {
      const input = ['tests/unit/analyzer/filter.test.ts', 'src/analyzer/filter.ts'];
      const result = excludeTestFiles(input);
      assert.deepEqual(result.kept, ['src/analyzer/filter.ts']);
    });
  });
});