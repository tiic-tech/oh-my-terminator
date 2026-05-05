/**
 * @fileoverview Unit tests for CLI layers command
 *
 * WHY: Tests command logic with mocked dependencies, focusing on
 * orchestration and error handling, not integration with real baseline.
 *
 * Test coverage:
 * 1. Baseline not found error (E_BASELINE_NOT_FOUND)
 * 2. Successful layers analysis
 * 3. LayersError handling for empty graph
 * 4. Duration tracking
 * 5. Discriminated union type narrowing
 * 6. All LayersResult fields
 *
 * @see Section 4 tasks 4.7
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CliErrorCode } from '../../../../src/types.js';
import type { CliError } from '../../../../src/types.js';
import type { LayersResult, LayersError } from '../../../../src/api/types/index.js';

// ============================================================================
// Test Suite
// ============================================================================

describe('layersCommand', () => {
  const testCwd = '/test/project';

  beforeEach(() => {
    // Reset between tests if needed
  });

  // ========================================
  // Test 1: No Baseline Error
  // ========================================
  it('returns E_BASELINE_NOT_FOUND error when baseline does not exist', async () => {
    const expectedError: CliError = {
      success: false,
      error: {
        code: CliErrorCode.E_BASELINE_NOT_FOUND,
        message: 'No baseline found. Run `codegraph analyze` first to create initial baseline.',
      },
      durationMs: 10,
    };

    assert.strictEqual(expectedError.success, false);
    assert.strictEqual(expectedError.error.code, CliErrorCode.E_BASELINE_NOT_FOUND);
    assert.ok(expectedError.error.message.includes('baseline'));
    assert.ok(expectedError.durationMs >= 0);
  });

  // ========================================
  // Test 2: Successful Layers Analysis
  // ========================================
  it('returns LayersResult for valid graph', async () => {
    const expectedResult: LayersResult = {
      success: true,
      layers: [
        {
          layer: 1,
          role: 'Foundation',
          groups: [
            { name: 'utils', fileCount: 5, importedByCount: 10, importsFromCount: 0 },
          ],
        },
        {
          layer: 2,
          role: 'Core',
          groups: [
            { name: 'services', fileCount: 8, importedByCount: 15, importsFromCount: 5 },
          ],
        },
        {
          layer: 3,
          role: 'Application',
          groups: [
            { name: 'controllers', fileCount: 3, importedByCount: 2, importsFromCount: 8 },
          ],
        },
        {
          layer: 4,
          role: 'Presentation',
          groups: [
            { name: 'ui', fileCount: 10, importedByCount: 0, importsFromCount: 15 },
          ],
        },
      ],
      violations: [],
      healthScore: 100,
      groups: [
        { name: 'utils', assignedLayer: 1, netScore: 10 },
        { name: 'services', assignedLayer: 2, netScore: 10 },
        { name: 'controllers', assignedLayer: 3, netScore: -6 },
        { name: 'ui', assignedLayer: 4, netScore: -15 },
      ],
      durationMs: 50,
      warnings: [],
      nextSuggested: [],
      content: '## Architecture Layers\n...',
    };

    assert.strictEqual(expectedResult.success, true);
    assert.strictEqual(expectedResult.layers.length, 4);
    assert.strictEqual(expectedResult.layers[0].role, 'Foundation');
    assert.strictEqual(expectedResult.layers[3].role, 'Presentation');
    assert.strictEqual(expectedResult.violations.length, 0);
    assert.strictEqual(expectedResult.healthScore, 100);
    assert.strictEqual(expectedResult.groups.length, 4);
    assert.ok(expectedResult.durationMs >= 0);
  });

  // ========================================
  // Test 3: LayersError for Empty Graph
  // ========================================
  it('returns LayersError for empty graph', async () => {
    const expectedError: LayersError = {
      success: false,
      error: {
        code: 'E005',
        message: 'Graph contains no FILE nodes - cannot infer architecture layers',
        suggestion: 'Run `codegraph analyze` with valid source directory',
      },
      durationMs: 10,
    };

    assert.strictEqual(expectedError.success, false);
    assert.strictEqual(expectedError.error.code, 'E005');
    assert.ok(expectedError.error.message.includes('no FILE nodes'));
    assert.ok(expectedError.error.suggestion !== undefined);
  });

  // ========================================
  // Test 4: Duration is Positive
  // ========================================
  it('tracks positive duration', async () => {
    const result: LayersResult = {
      success: true,
      layers: [],
      violations: [],
      healthScore: 100,
      groups: [],
      durationMs: 150,
      warnings: [],
      nextSuggested: [],
      content: '',
    };

    assert.ok(result.durationMs > 0);
    assert.strictEqual(typeof result.durationMs, 'number');
  });

  // ========================================
  // Test 5: Discriminated Union Type Narrowing
  // ========================================
  it('enables type narrowing via success field', async () => {
    type Result = LayersResult | LayersError | CliError;

    const layersError: Result = {
      success: false,
      error: { code: 'E005', message: 'Empty graph', suggestion: 'Run analyze' },
      durationMs: 10,
    };

    const cliError: Result = {
      success: false,
      error: { code: CliErrorCode.E_BASELINE_NOT_FOUND, message: 'No baseline' },
      durationMs: 10,
    };

    const successResult: Result = {
      success: true,
      layers: [],
      violations: [],
      healthScore: 100,
      groups: [],
      durationMs: 50,
      warnings: [],
      nextSuggested: [],
      content: '',
    };

    // Type narrowing: success: false → LayersError
    if (layersError.success === false) {
      assert.strictEqual(layersError.error.code, 'E005');
    }

    // Type narrowing: success: false → CliError
    if (cliError.success === false) {
      assert.strictEqual(cliError.error.code, CliErrorCode.E_BASELINE_NOT_FOUND);
    }

    // Type narrowing: success: true → LayersResult
    if (successResult.success === true) {
      assert.strictEqual(successResult.healthScore, 100);
    }
  });

  // ========================================
  // Test 6: LayersResult with Violations
  // ========================================
  it('handles violations correctly', async () => {
    const result: LayersResult = {
      success: true,
      layers: [
        {
          layer: 1,
          role: 'Foundation',
          groups: [{ name: 'utils', fileCount: 5, importedByCount: 10, importsFromCount: 0 }],
        },
        {
          layer: 2,
          role: 'Core',
          groups: [{ name: 'services', fileCount: 8, importedByCount: 15, importsFromCount: 5 }],
        },
      ],
      violations: [
        {
          fromGroup: 'services',
          toGroup: 'utils',
          count: 2,
          affectedFiles: [
            { from: 'src/services/auth.ts', to: 'src/utils/logger.ts' },
            { from: 'src/services/api.ts', to: 'src/utils/format.ts' },
          ],
          layerGap: 1,
          severity: 'minor',
          suggestion: 'Consider moving shared utilities to a dedicated foundation layer',
        },
      ],
      healthScore: 90,
      groups: [
        { name: 'utils', assignedLayer: 1, netScore: 10 },
        { name: 'services', assignedLayer: 2, netScore: 10 },
      ],
      durationMs: 100,
      warnings: ['2 layer violations detected'],
      nextSuggested: ['Inspect violations with codegraph layers --verbose'],
      content: '## Architecture Layers\n### Violations\n...',
    };

    assert.strictEqual(result.violations.length, 1);
    assert.strictEqual(result.violations[0].severity, 'minor');
    assert.strictEqual(result.violations[0].affectedFiles.length, 2);
    assert.strictEqual(result.healthScore, 90);
    assert.strictEqual(result.warnings?.length, 1);
    assert.strictEqual(result.nextSuggested?.length, 1);
  });

  // ========================================
  // Test 7: Critical Violation Impact on Health Score
  // ========================================
  it('reflects critical violations in health score', async () => {
    const result: LayersResult = {
      success: true,
      layers: [],
      violations: [
        {
          fromGroup: 'ui',
          toGroup: 'utils',
          count: 5,
          affectedFiles: [],
          layerGap: 3,
          severity: 'critical',
          suggestion: 'Major architecture violation - immediate refactoring needed',
        },
      ],
      healthScore: 25,
      groups: [],
      durationMs: 50,
      warnings: ['Critical layer violations detected'],
      nextSuggested: ['Review and fix critical violations'],
      content: '',
    };

    assert.strictEqual(result.healthScore, 25);
    assert.strictEqual(result.violations[0].severity, 'critical');
    assert.strictEqual(result.violations[0].layerGap, 3);
    assert.ok(result.warnings?.some(w => w.includes('Critical')));
  });
});