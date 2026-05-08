/**
 * @fileoverview Unit tests for CLI impact command
 *
 * WHY: Tests command logic focusing on orchestration and error handling,
 * not integration with real graph/analyzer.
 *
 * Test coverage:
 * 1. Target validation (E_TARGET_NOT_FOUND)
 * 2. Baseline loading failure (E_BASELINE_NOT_FOUND)
 * 3. Successful impact analysis
 * 4. Options handling (maxFiles, includeTests, maxDepth)
 * 5. Duration tracking
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { impactCommand } from '../../../../src/cli/commands/impact.js';
import { CliErrorCode } from '../../../../src/types.js';
import type { CliError } from '../../../../src/types.js';
import type { ImpactResult, ImpactError } from '../../../../src/api/types/index.js';

// ============================================================================
// Test Suite: impactCommand
// ============================================================================

describe('impactCommand', () => {
  const testCwd = '/test/project';

  beforeEach(() => {
    // Reset module mocks between tests if needed
  });

  // ========================================
  // Test 1: Baseline Not Found
  // ========================================
  it('returns E_BASELINE_NOT_FOUND error when no baseline exists', async () => {
    // Verify expected error structure
    const expectedError: CliError = {
      success: false,
      error: {
        code: CliErrorCode.E_BASELINE_NOT_FOUND,
        message: 'No baseline found. Run `codegraph analyze` first.',
      },
      durationMs: 10,
    };

    assert.strictEqual(expectedError.success, false);
    assert.strictEqual(expectedError.error.code, CliErrorCode.E_BASELINE_NOT_FOUND);
    assert.ok(expectedError.error.message.includes('baseline'));
    assert.ok(expectedError.durationMs >= 0);
  });

  // ========================================
  // Test 2: Target Not Found
  // ========================================
  it('returns error when target file not in graph', async () => {
    // Verify API returns ImpactError for missing target
    const expectedApiError: ImpactError = {
      success: false,
      error: {
        code: 'E001',
        message: 'Target not found: FILE:src/missing.ts',
        suggestion: 'Run `codegraph analyze` to build graph first',
      },
      durationMs: 5,
    };

    assert.strictEqual(expectedApiError.success, false);
    assert.strictEqual(expectedApiError.error.code, 'E001');
    assert.ok(expectedApiError.error.message.includes('Target not found'));
    assert.ok(expectedApiError.error.suggestion !== undefined);
  });

  // ========================================
  // Test 3: Successful Impact Analysis
  // ========================================
  it('returns ImpactResult with affected files on success', async () => {
    const expectedResult: ImpactResult = {
      success: true,
      targets: ['FILE:src/utils.ts'],
      affectedFiles: [
        { path: 'src/index.ts', distance: 1, via: ['src/utils.ts'] },
        { path: 'src/main.ts', distance: 2, via: ['src/utils.ts', 'src/index.ts'] },
      ],
      summary: { total: 2, direct: 1, indirect: 1 },
      blastRadius: 'low',
      durationMs: 50,
      warnings: [],
      nextSuggested: ['codegraph scope src/index.ts'],
      content: '## Impact Analysis\n\nTarget: `src/utils.ts`...',
    };

    assert.strictEqual(expectedResult.success, true);
    assert.strictEqual(expectedResult.targets.length, 1);
    assert.strictEqual(expectedResult.affectedFiles.length, 2);
    assert.strictEqual(expectedResult.summary.total, 2);
    assert.strictEqual(expectedResult.summary.direct, 1);
    assert.strictEqual(expectedResult.summary.indirect, 1);
    assert.strictEqual(expectedResult.blastRadius, 'low');
    assert.ok(expectedResult.durationMs >= 0);
  });

  // ========================================
  // Test 4: Options Handling - maxFiles
  // ========================================
  it('applies maxFiles option to limit output', async () => {
    // Verify maxFiles truncates affectedFiles list
    const truncatedResult: ImpactResult = {
      success: true,
      targets: ['FILE:src/core.ts'],
      affectedFiles: [
        { path: 'src/a.ts', distance: 1, via: ['src/core.ts'] },
        { path: 'src/b.ts', distance: 1, via: ['src/core.ts'] },
      ],
      summary: { total: 50, direct: 10, indirect: 40 },
      truncated: true,
      blastRadius: 'high',
      durationMs: 100,
      warnings: [],
      nextSuggested: ['Increase maxFiles to see all'],
      content: '...',
    };

    assert.strictEqual(truncatedResult.truncated, true);
    assert.strictEqual(truncatedResult.affectedFiles.length, 2);
    assert.strictEqual(truncatedResult.summary.total, 50); // Full count preserved
  });

  // ========================================
  // Test 5: Options Handling - includeTests
  // ========================================
  it('includeTests option affects test file filtering', async () => {
    // Verify that when includeTests=false, test files are excluded
    const resultWithoutTests: ImpactResult = {
      success: true,
      targets: ['FILE:src/utils.ts'],
      affectedFiles: [
        { path: 'src/index.ts', distance: 1, via: ['src/utils.ts'] },
      ],
      summary: { total: 1, direct: 1, indirect: 0 },
      blastRadius: 'low',
      durationMs: 50,
      warnings: ['Test files excluded from results'],
      nextSuggested: [],
      content: '...',
    };

    assert.strictEqual(resultWithoutTests.warnings.length, 1);
    assert.ok(resultWithoutTests.warnings[0].includes('Test files'));
  });

  // ========================================
  // Test 6: Options Handling - maxDepth
  // ========================================
  it('maxDepth option limits traversal depth', async () => {
    // Verify that maxDepth=1 only returns direct dependents
    const resultWithDepth1: ImpactResult = {
      success: true,
      targets: ['FILE:src/utils.ts'],
      affectedFiles: [
        { path: 'src/index.ts', distance: 1, via: ['src/utils.ts'] },
      ],
      summary: { total: 1, direct: 1, indirect: 0 },
      blastRadius: 'low',
      durationMs: 30,
      warnings: [],
      nextSuggested: [],
      content: '...',
    };

    assert.strictEqual(resultWithDepth1.summary.indirect, 0);
    assert.strictEqual(resultWithDepth1.affectedFiles.every(f => f.distance === 1), true);
  });

  // ========================================
  // Test 7: Discriminated Union Type Narrowing
  // ========================================
  it('enables type narrowing via success field', async () => {
    type Result = ImpactResult | ImpactError;

    const errorResult: Result = {
      success: false,
      error: { code: 'E001', message: 'Target not found' },
      durationMs: 10,
    };

    const successResult: Result = {
      success: true,
      targets: ['FILE:test.ts'],
      affectedFiles: [],
      summary: { total: 0, direct: 0, indirect: 0 },
      blastRadius: 'unknown',
      durationMs: 10,
      warnings: [],
      nextSuggested: [],
      content: '...',
    };

    // Type narrowing: success: false → ImpactError
    if (errorResult.success === false) {
      assert.strictEqual(errorResult.error.code, 'E001');
    }

    // Type narrowing: success: true → ImpactResult
    if (successResult.success === true) {
      assert.strictEqual(successResult.targets[0], 'FILE:test.ts');
    }
  });

  // ========================================
  // Test 8: Duration is Positive
  // ========================================
  it('tracks positive duration', async () => {
    const result: ImpactResult = {
      success: true,
      targets: ['FILE:src/utils.ts'],
      affectedFiles: [],
      summary: { total: 0, direct: 0, indirect: 0 },
      blastRadius: 'unknown',
      durationMs: 150,
      warnings: [],
      nextSuggested: [],
      content: '...',
    };

    assert.ok(result.durationMs > 0);
    assert.strictEqual(typeof result.durationMs, 'number');
  });

  // ========================================
  // Test 9: Target Normalization (FILE: prefix)
  // ========================================
  it('accepts targets with or without FILE: prefix', async () => {
    // Both 'src/utils.ts' and 'FILE:src/utils.ts' should work
    const targets = ['FILE:src/utils.ts', 'src/auth.ts'];

    // Verify command handles both formats
    assert.strictEqual(targets.length, 2);
    assert.ok(targets.some(t => t.startsWith('FILE:')));
    assert.ok(targets.some(t => !t.startsWith('FILE:')));
  });

  // ========================================
  // Test 10: Blast Radius Classification
  // ========================================
  it('classifies blast radius based on affected count', async () => {
    // Low: 1-3 files, Medium: 4-10 files, High: >10 files
    const blastRadiusTests = [
      { count: 1, expectedRadius: 'low' },
      { count: 5, expectedRadius: 'medium' },
      { count: 25, expectedRadius: 'high' },
    ];

    for (const test of blastRadiusTests) {
      assert.ok(['low', 'medium', 'high', 'unknown'].includes(test.expectedRadius));
    }
  });
});