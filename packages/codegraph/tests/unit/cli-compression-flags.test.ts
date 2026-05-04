/**
 * @fileoverview Unit tests for CLI compression options types
 *
 * WHY: Validates that compression options are correctly defined in command interfaces.
 * These tests verify the type definitions without mocking implementation.
 *
 * Test cases (tasks.md 6.9, 6.13):
 * 1. AnalyzeOptions has compress field
 * 2. UpdateOptions has compress field
 * 3. CompressionStats interface is correctly defined
 * 4. AnalyzeResult includes compressionStats field
 * 5. UpdateResult includes compressionStats field
 *
 * @see tasks.md 6.1-6.3, 6.8-6.13
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  type AnalyzeResult,
  type UpdateResult,
  type CompressionStats,
  CliErrorCode,
} from '../../src/types.js';
import { type AnalyzeOptions } from '../../src/cli/commands/analyze.js';
import { type UpdateOptions } from '../../src/cli/commands/update.js';

describe('Compression options types', () => {
  describe('AnalyzeOptions interface (6.1-6.3)', () => {
    it('should have compress field in AnalyzeOptions', () => {
      // Type test: verify AnalyzeOptions has compress field
      const options: AnalyzeOptions = {
        compress: true,
      };
      assert.strictEqual(options.compress, true);
    });

    it('should allow compress=false in AnalyzeOptions (--no-compression)', () => {
      const options: AnalyzeOptions = {
        compress: false,
      };
      assert.strictEqual(options.compress, false);
    });

    it('should allow undefined compress (default behavior)', () => {
      const options: AnalyzeOptions = {};
      assert.strictEqual(options.compress, undefined);
    });

    it('should allow json flag alongside compress', () => {
      const options: AnalyzeOptions = {
        json: true,
        compress: false,
      };
      assert.strictEqual(options.json, true);
      assert.strictEqual(options.compress, false);
    });
  });

  describe('UpdateOptions interface (6.11-6.12)', () => {
    it('should have compress field in UpdateOptions', () => {
      const options: UpdateOptions = {
        compress: true,
      };
      assert.strictEqual(options.compress, true);
    });

    it('should allow compress=false in UpdateOptions (--no-compression)', () => {
      const options: UpdateOptions = {
        compress: false,
      };
      assert.strictEqual(options.compress, false);
    });

    it('should allow undefined compress in UpdateOptions (inherits default)', () => {
      const options: UpdateOptions = {};
      assert.strictEqual(options.compress, undefined);
    });
  });

  describe('CompressionStats interface (6.8)', () => {
    it('should have all required fields', () => {
      const stats: CompressionStats = {
        originalSizeBytes: 1024,
        compressedSizeBytes: 512,
        savingsPercent: 50,
      };
      assert.strictEqual(stats.originalSizeBytes, 1024);
      assert.strictEqual(stats.compressedSizeBytes, 512);
      assert.strictEqual(stats.savingsPercent, 50);
    });

    it('should allow zero values', () => {
      const stats: CompressionStats = {
        originalSizeBytes: 0,
        compressedSizeBytes: 0,
        savingsPercent: 0,
      };
      assert.strictEqual(stats.savingsPercent, 0);
    });

    it('should allow large values', () => {
      const stats: CompressionStats = {
        originalSizeBytes: 10 * 1024 * 1024, // 10MB
        compressedSizeBytes: 3 * 1024 * 1024, // 3MB
        savingsPercent: 70,
      };
      assert.strictEqual(stats.originalSizeBytes, 10485760);
      assert.strictEqual(stats.savingsPercent, 70);
    });
  });

  describe('AnalyzeResult compressionStats field (6.8)', () => {
    it('should include compressionStats field in AnalyzeResult', () => {
      const result: AnalyzeResult = {
        success: true,
        stats: {
          filesScanned: 10,
          modulesExtracted: 25,
          edgesCreated: { imports: 50, exports: 30, contains: 15 },
        },
        compressionStats: {
          originalSizeBytes: 1024,
          compressedSizeBytes: 512,
          savingsPercent: 50,
        },
        durationMs: 100,
        warnings: [],
        nextSuggested: [],
      };
      assert.ok(result.compressionStats !== undefined);
      assert.strictEqual(result.compressionStats?.savingsPercent, 50);
    });

    it('should allow undefined compressionStats (when compression disabled)', () => {
      const result: AnalyzeResult = {
        success: true,
        stats: {
          filesScanned: 10,
          modulesExtracted: 25,
          edgesCreated: { imports: 50, exports: 30, contains: 15 },
        },
        durationMs: 100,
        warnings: [],
        nextSuggested: [],
      };
      assert.strictEqual(result.compressionStats, undefined);
    });
  });

  describe('UpdateResult compressionStats field (6.8)', () => {
    it('should include compressionStats field in UpdateResult', () => {
      const result: UpdateResult = {
        success: true,
        changes: { added: [], removed: [], modified: [] },
        delta: { newNodes: 0, removedNodes: 0 },
        compressionStats: {
          originalSizeBytes: 2048,
          compressedSizeBytes: 1024,
          savingsPercent: 50,
        },
        durationMs: 50,
        warnings: [],
      };
      assert.ok(result.compressionStats !== undefined);
      assert.strictEqual(result.compressionStats?.savingsPercent, 50);
    });

    it('should allow undefined compressionStats in UpdateResult', () => {
      const result: UpdateResult = {
        success: true,
        changes: { added: [], removed: [], modified: [] },
        delta: { newNodes: 0, removedNodes: 0 },
        durationMs: 50,
        warnings: [],
      };
      assert.strictEqual(result.compressionStats, undefined);
    });
  });
});

describe('Compression-related error codes', () => {
  it('should have E_INVALID_CONFIG error code', () => {
    assert.strictEqual(CliErrorCode.E_INVALID_CONFIG, 'E_INVALID_CONFIG');
  });

  it('should have E_INDEX_OUT_OF_BOUNDS error code', () => {
    assert.strictEqual(CliErrorCode.E_INDEX_OUT_OF_BOUNDS, 'E_INDEX_OUT_OF_BOUNDS');
  });

  it('should have E_CORRUPTED_BASELINE error code', () => {
    assert.strictEqual(CliErrorCode.E_CORRUPTED_BASELINE, 'E_CORRUPTED_BASELINE');
  });
});