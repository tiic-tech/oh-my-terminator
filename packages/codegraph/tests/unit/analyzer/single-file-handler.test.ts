/**
 * Single File Handler Tests
 *
 * WHY: TDD workflow - tests define expected behavior before implementation.
 * Tests verify reclassification logic: single-file with internal imports → normal.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  handleSingleFileProject,
  type SingleFileResult,
} from '../../../src/analyzer/single-file-handler.js';

describe('handleSingleFileProject', () => {
  describe('basic single-file handling', () => {
    it('should return result with exitCode 0 for valid single file', () => {
      const result = handleSingleFileProject('src/main.ts', ['lodash'], []);
      assert.strictEqual(result.exitCode, 0);
    });

    it('should return filePath in result', () => {
      const result = handleSingleFileProject('src/index.ts', ['axios'], []);
      assert.strictEqual(result.filePath, 'src/index.ts');
    });

    it('should return external dependencies', () => {
      const result = handleSingleFileProject('src/app.ts', ['react', 'lodash'], []);
      assert.deepEqual(result.externalDeps, ['react', 'lodash']);
    });

    it('should return kind as single-file when no internal imports', () => {
      const result = handleSingleFileProject('src/cli.ts', ['commander'], []);
      assert.strictEqual(result.kind, 'single-file');
    });
  });

  describe('reclassification logic', () => {
    it('should reclassify as normal when imports resolve to project files', () => {
      const result = handleSingleFileProject(
        'src/main.ts',
        ['lodash'],
        ['src/utils.ts', 'src/config.ts']
      );
      assert.strictEqual(result.kind, 'normal');
      assert.strictEqual(result.reclassified, true);
    });

    it('should not reclassify when resolved imports array is empty', () => {
      const result = handleSingleFileProject('src/main.ts', ['lodash'], []);
      assert.strictEqual(result.kind, 'single-file');
      assert.strictEqual(result.reclassified, false);
    });

    it('should reclassify even with single internal import', () => {
      const result = handleSingleFileProject(
        'src/index.ts',
        [],
        ['src/helper.ts']
      );
      assert.strictEqual(result.kind, 'normal');
      assert.strictEqual(result.reclassified, true);
    });
  });

  describe('SingleFileResult interface', () => {
    it('should have all required fields', () => {
      const result: SingleFileResult = handleSingleFileProject(
        'src/main.ts',
        ['lodash'],
        ['src/utils.ts']
      );
      assert.ok(result.filePath);
      assert.ok(Array.isArray(result.externalDeps));
      assert.ok(result.kind);
      assert.strictEqual(typeof result.exitCode, 'number');
    });

    it('should have reclassified field defined', () => {
      const result = handleSingleFileProject('src/main.ts', [], []);
      assert.strictEqual(typeof result.reclassified, 'boolean');
    });
  });
});