/**
 * @fileoverview Unit tests for CLI path format utilities
 *
 * WHY: Tests shared path format detection logic extracted from scope/impact commands.
 * Eliminates duplicate code (C15 CRITICAL issue).
 *
 * Test coverage:
 * 1. isMonorepo() - Check packages/ directory existence
 * 2. matchesMonorepoPathFormat() - Regex validation for monorepo paths
 * 3. addPathFormatHint() - Generic function to add suggestion to error results
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { isMonorepo, matchesMonorepoPathFormat, addPathFormatHint } from '../../../../src/cli/utils/path-format.js';
import { ErrorCode } from '../../../../src/api/types/index.js';

// ============================================================================
// Test Suite
// ============================================================================

describe('path-format utilities', () => {
  // ========================================
  // Test 1: isMonorepo
  // ========================================
  describe('isMonorepo', () => {
    it('returns true when packages/ directory exists', () => {
      // Create temp directory with packages/ subdirectory
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-monorepo-'));
      fs.mkdirSync(path.join(tempDir, 'packages'));

      const result = isMonorepo(tempDir);
      assert.strictEqual(result, true);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });

    it('returns false when packages/ directory does not exist', () => {
      // Create temp directory without packages/
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-single-'));

      const result = isMonorepo(tempDir);
      assert.strictEqual(result, false);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });
  });

  // ========================================
  // Test 2: matchesMonorepoPathFormat
  // ========================================
  describe('matchesMonorepoPathFormat', () => {
    it('returns true for valid monorepo path format', () => {
      const validPaths = [
        'packages/codegraph/src/utils.ts',
        'packages/cli/src/index.tsx',
        'packages/core/src/lib/helper.js',
        'packages/my-package/src/deep/nested/file.ts',
        'packages/a/src/file.jsx',
      ];

      for (const p of validPaths) {
        assert.strictEqual(matchesMonorepoPathFormat(p), true, `Expected true for: ${p}`);
      }
    });

    it('returns false for invalid monorepo path format', () => {
      const invalidPaths = [
        'src/utils.ts',                    // Missing packages/ prefix
        'packages/utils.ts',               // Missing src/ segment
        'packages/codegraph/utils.ts',     // Missing src/ segment
        'lib/utils.ts',                    // Wrong prefix
        'packages/codegraph/src/file.py',  // Invalid extension
        'packages/CodeGraph/src/utils.ts', // Package name with uppercase
        'packages/123/src/file.ts',        // Package name starting with digit
        'packages/pkg_name/src/file.ts',   // Package name with underscore
      ];

      for (const p of invalidPaths) {
        assert.strictEqual(matchesMonorepoPathFormat(p), false, `Expected false for: ${p}`);
      }
    });

    it('accepts ts, tsx, js, jsx extensions', () => {
      assert.strictEqual(matchesMonorepoPathFormat('packages/pkg/src/file.ts'), true);
      assert.strictEqual(matchesMonorepoPathFormat('packages/pkg/src/file.tsx'), true);
      assert.strictEqual(matchesMonorepoPathFormat('packages/pkg/src/file.js'), true);
      assert.strictEqual(matchesMonorepoPathFormat('packages/pkg/src/file.jsx'), true);
    });

    it('rejects other extensions', () => {
      assert.strictEqual(matchesMonorepoPathFormat('packages/pkg/src/file.py'), false);
      assert.strictEqual(matchesMonorepoPathFormat('packages/pkg/src/file.go'), false);
      assert.strictEqual(matchesMonorepoPathFormat('packages/pkg/src/file.rs'), false);
      assert.strictEqual(matchesMonorepoPathFormat('packages/pkg/src/file.json'), false);
    });

    it('handles edge cases', () => {
      // Empty string
      assert.strictEqual(matchesMonorepoPathFormat(''), false);

      // Just packages/
      assert.strictEqual(matchesMonorepoPathFormat('packages/'), false);

      // packages/pkg/src/ without file
      assert.strictEqual(matchesMonorepoPathFormat('packages/pkg/src/'), false);

      // Deep nested path
      assert.strictEqual(matchesMonorepoPathFormat('packages/pkg/src/a/b/c/d/e/file.ts'), true);
    });
  });

  // ========================================
  // Test 3: addPathFormatHint
  // ========================================
  describe('addPathFormatHint', () => {
    it('adds hint for TARGET_NOT_FOUND error in monorepo with wrong format', () => {
      // Create temp monorepo directory
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-hint-'));
      fs.mkdirSync(path.join(tempDir, 'packages'));

      const mockError = {
        success: false as const,
        error: {
          code: ErrorCode.TARGET_NOT_FOUND,
          message: 'Target not found: src/utils.ts',
        },
        durationMs: 10,
      };

      const result = addPathFormatHint(mockError, tempDir, 'src/utils.ts');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error.code, ErrorCode.TARGET_NOT_FOUND);
      assert.ok(result.error.suggestion !== undefined);
      assert.ok(result.error.suggestion?.includes('packages/<pkg>/src/'));

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });

    it('does not add hint for TARGET_NOT_FOUND with correct format', () => {
      // Create temp monorepo directory
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-no-hint-'));
      fs.mkdirSync(path.join(tempDir, 'packages'));

      const mockError = {
        success: false as const,
        error: {
          code: ErrorCode.TARGET_NOT_FOUND,
          message: 'Target not found: packages/codegraph/src/utils.ts',
        },
        durationMs: 10,
      };

      // Even in monorepo, if format is correct, no hint needed
      const result = addPathFormatHint(mockError, tempDir, 'packages/codegraph/src/utils.ts');

      assert.strictEqual(result.error.suggestion, undefined);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });

    it('does not add hint for non-TARGET_NOT_FOUND errors', () => {
      const mockError = {
        success: false as const,
        error: {
          code: ErrorCode.PARSE_ERROR,
          message: 'Parse error in baseline',
        },
        durationMs: 10,
      };

      const result = addPathFormatHint(mockError, '/test/project', 'src/utils.ts');

      assert.strictEqual(result.error.suggestion, undefined);
    });

    it('does not add hint in non-monorepo project', () => {
      // Create temp single-project directory (no packages/)
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-single-'));

      const mockError = {
        success: false as const,
        error: {
          code: ErrorCode.TARGET_NOT_FOUND,
          message: 'Target not found: src/utils.ts',
        },
        durationMs: 10,
      };

      const result = addPathFormatHint(mockError, tempDir, 'src/utils.ts');

      assert.strictEqual(result.error.suggestion, undefined);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });

    it('returns new object without mutation (immutability test)', () => {
      // Create temp monorepo directory
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-immutable-'));
      fs.mkdirSync(path.join(tempDir, 'packages'));

      const mockError = {
        success: false as const,
        error: {
          code: ErrorCode.TARGET_NOT_FOUND,
          message: 'Target not found',
        },
        durationMs: 10,
      };

      const result = addPathFormatHint(mockError, tempDir, 'src/utils.ts');

      // Verify immutability: original should not be modified
      assert.strictEqual(mockError.error.suggestion, undefined);
      assert.ok(result !== mockError, 'Result should be new object');

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });

    it('preserves all other fields in error result', () => {
      // Create temp monorepo directory
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-preserve-'));
      fs.mkdirSync(path.join(tempDir, 'packages'));

      const mockError = {
        success: false as const,
        error: {
          code: ErrorCode.TARGET_NOT_FOUND,
          message: 'Target not found: src/utils.ts',
        },
        durationMs: 10,
        warnings: ['Additional warning'],
      };

      const result = addPathFormatHint(mockError, tempDir, 'src/utils.ts');

      assert.strictEqual(result.durationMs, 10);
      assert.strictEqual(result.warnings?.length, 1);
      assert.strictEqual(result.warnings?.[0], 'Additional warning');

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });

    it('works with generic error result type', () => {
      // Test with different error type structure
      const customError = {
        success: false as const,
        error: {
          code: ErrorCode.TARGET_NOT_FOUND,
          message: 'Custom error',
          details: 'extra field',
        },
        durationMs: 50,
        extraField: 'preserved',
      };

      // Create temp monorepo directory
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-generic-'));
      fs.mkdirSync(path.join(tempDir, 'packages'));

      const result = addPathFormatHint(customError, tempDir, 'src/utils.ts');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error.code, ErrorCode.TARGET_NOT_FOUND);
      assert.ok(result.error.suggestion !== undefined);
      assert.strictEqual((result as typeof customError).extraField, 'preserved');

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });
  });
});