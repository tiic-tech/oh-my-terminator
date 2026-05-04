/**
 * @fileoverview Unit tests for CLI migrate command types
 *
 * WHY: Validates migrate command types are correctly defined.
 * Integration tests will verify actual functionality with fixtures.
 *
 * Test cases (tasks.md 6.10):
 * 1. MigrateResult type is correctly defined
 * 2. MigrateStats type has required fields
 * 3. MigrateOptions type has required paths
 * 4. Error handling for invalid inputs
 *
 * @see tasks.md 6.4-6.7, 6.10
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  type MigrateResult,
  type MigrateStats,
  type MigrateOptions,
  type CliError,
  CliErrorCode,
} from '../../src/types.js';
import { migrateCommand } from '../../src/cli/commands/migrate.js';

describe('Migrate types', () => {
  describe('MigrateStats interface (6.6)', () => {
    it('should have all required fields', () => {
      const stats: MigrateStats = {
        inputSizeBytes: 2048,
        outputSizeBytes: 1024,
        savingsPercent: 50,
        pathTableEntries: 5,
      };
      assert.strictEqual(stats.inputSizeBytes, 2048);
      assert.strictEqual(stats.outputSizeBytes, 1024);
      assert.strictEqual(stats.savingsPercent, 50);
      assert.strictEqual(stats.pathTableEntries, 5);
    });

    it('should allow zero savings (same size)', () => {
      const stats: MigrateStats = {
        inputSizeBytes: 100,
        outputSizeBytes: 100,
        savingsPercent: 0,
        pathTableEntries: 1,
      };
      assert.strictEqual(stats.savingsPercent, 0);
    });

    it('should allow empty baseline stats', () => {
      const stats: MigrateStats = {
        inputSizeBytes: 50,
        outputSizeBytes: 30,
        savingsPercent: 40,
        pathTableEntries: 0,
      };
      assert.strictEqual(stats.pathTableEntries, 0);
    });
  });

  describe('MigrateResult interface (6.5)', () => {
    it('should have success: true literal', () => {
      const result: MigrateResult = {
        success: true,
        stats: {
          inputSizeBytes: 1024,
          outputSizeBytes: 512,
          savingsPercent: 50,
          pathTableEntries: 3,
        },
        inputPath: '/test/input.json',
        outputPath: '/test/output.json',
        durationMs: 100,
      };
      assert.strictEqual(result.success, true);
    });

    it('should have all required fields', () => {
      const result: MigrateResult = {
        success: true,
        stats: {
          inputSizeBytes: 1024,
          outputSizeBytes: 512,
          savingsPercent: 50,
          pathTableEntries: 3,
        },
        inputPath: '/in.json',
        outputPath: '/out.json',
        durationMs: 10,
      };
      assert.ok(result.stats !== undefined);
      assert.ok(result.inputPath !== undefined);
      assert.ok(result.outputPath !== undefined);
      assert.ok(result.durationMs !== undefined);
    });
  });

  describe('MigrateOptions interface (6.5)', () => {
    it('should require input and output paths', () => {
      const options: MigrateOptions = {
        input: '/path/to/input.json',
        output: '/path/to/output.json',
      };
      assert.strictEqual(options.input, '/path/to/input.json');
      assert.strictEqual(options.output, '/path/to/output.json');
    });

    it('should allow optional json flag', () => {
      const options: MigrateOptions = {
        input: '/in.json',
        output: '/out.json',
        json: true,
      };
      assert.strictEqual(options.json, true);
    });
  });
});

describe('Migrate command error handling (6.10)', () => {
  it('should return error for missing input file', async () => {
    const result = await migrateCommand({
      input: '/nonexistent/path/baseline.json',
      output: '/tmp/output.json',
    });

    assert.strictEqual(result.success, false);
    // Check it's a CliError
    if (result.success === false) {
      assert.ok(result.error.code === CliErrorCode.E_INVALID_PATH || result.error.code === CliErrorCode.E_PARSE_FAILED);
      assert.ok(result.error.message.length > 0);
    }
  });

  it('should return error for missing output path', async () => {
    // This should actually fail because we can't write to nowhere
    const result = await migrateCommand({
      input: '/nonexistent/baseline.json',
      output: '', // Empty output path
    });

    assert.strictEqual(result.success, false);
    if (result.success === false) {
      assert.ok(result.error.code !== undefined);
    }
  });

  it('should return CliError structure on failure', async () => {
    const result = await migrateCommand({
      input: '/does/not/exist.json',
      output: '/tmp/out.json',
    });

    // Type narrowing: verify it's a CliError
    const errorResult = result as CliError;
    assert.strictEqual(errorResult.success, false);
    assert.ok('error' in errorResult);
    assert.ok('code' in errorResult.error);
    assert.ok('message' in errorResult.error);
    assert.ok('durationMs' in errorResult);
  });
});