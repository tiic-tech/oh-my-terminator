/**
 * @fileoverview Unit tests for CLI impact formatters
 *
 * WHY: Tests formatter output for programmatic (JSON) and human-readable (text) consumption.
 *
 * Test coverage:
 * 1. formatImpactJson produces valid JSON with all fields
 * 2. formatImpactText includes summary and affected files
 * 3. Truncation indicator in text output
 * 4. Blast radius classification
 * 5. Warnings and nextSuggested formatting
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatImpactJson,
  formatImpactText,
  formatImpactErrorJson,
  formatImpactErrorText,
} from '../../../../src/cli/output/impact-formatter.js';
import type { ImpactResult, ImpactError } from '../../../../src/api/types/index.js';

// ============================================================================
// Test Suite: formatImpactJson
// ============================================================================

describe('formatImpactJson', () => {
  it('should produce valid JSON string', () => {
    const result: ImpactResult = {
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
      content: '## Impact Analysis\n\nTarget: `src/utils.ts`\n...',
    };

    const output = formatImpactJson(result);
    assert.ok(typeof output === 'string');

    const parsed = JSON.parse(output);
    assert.ok(parsed);
  });

  it('should include all required fields', () => {
    const result: ImpactResult = {
      success: true,
      targets: ['FILE:src/auth.ts'],
      affectedFiles: [
        { path: 'src/login.ts', distance: 1, via: ['src/auth.ts'] },
      ],
      summary: { total: 1, direct: 1, indirect: 0 },
      truncated: false,
      blastRadius: 'low',
      durationMs: 25,
      warnings: ['Test files excluded'],
      nextSuggested: ['codegraph scope src/login.ts'],
      content: '## Impact Analysis\n...',
    };

    const output = formatImpactJson(result);
    const parsed = JSON.parse(output);

    assert.strictEqual(parsed.success, true);
    assert.strictEqual(parsed.targets[0], 'FILE:src/auth.ts');
    assert.strictEqual(parsed.affectedFiles.length, 1);
    assert.strictEqual(parsed.affectedFiles[0].path, 'src/login.ts');
    assert.strictEqual(parsed.affectedFiles[0].distance, 1);
    assert.strictEqual(parsed.summary.total, 1);
    assert.strictEqual(parsed.summary.direct, 1);
    assert.strictEqual(parsed.summary.indirect, 0);
    assert.strictEqual(parsed.truncated, false);
    assert.strictEqual(parsed.blastRadius, 'low');
    assert.strictEqual(parsed.durationMs, 25);
    assert.strictEqual(parsed.warnings.length, 1);
    assert.strictEqual(parsed.nextSuggested.length, 1);
  });

  it('should handle truncated results', () => {
    const result: ImpactResult = {
      success: true,
      targets: ['FILE:src/core.ts'],
      affectedFiles: [
        { path: 'src/a.ts', distance: 1, via: ['src/core.ts'] },
      ],
      summary: { total: 50, direct: 10, indirect: 40 },
      truncated: true,
      blastRadius: 'high',
      durationMs: 100,
      warnings: [],
      nextSuggested: ['Run with --max-files 100 to see more'],
      content: '...',
    };

    const output = formatImpactJson(result);
    const parsed = JSON.parse(output);

    assert.strictEqual(parsed.truncated, true);
    assert.strictEqual(parsed.summary.total, 50);
    assert.strictEqual(parsed.affectedFiles.length, 1); // Limited by maxFiles
    assert.strictEqual(parsed.blastRadius, 'high');
  });
});

// ============================================================================
// Test Suite: formatImpactText
// ============================================================================

describe('formatImpactText', () => {
  it('should include summary with counts', () => {
    const result: ImpactResult = {
      success: true,
      targets: ['FILE:src/utils.ts'],
      affectedFiles: [
        { path: 'src/index.ts', distance: 1, via: ['src/utils.ts'] },
      ],
      summary: { total: 5, direct: 2, indirect: 3 },
      blastRadius: 'medium',
      durationMs: 50,
      warnings: [],
      nextSuggested: [],
      content: '...',
    };

    const output = formatImpactText(result);

    assert.ok(output.includes('Impact analysis complete'));
    assert.ok(output.includes('Total affected: 5'));
    assert.ok(output.includes('Direct: 2'));
    assert.ok(output.includes('Indirect: 3'));
    assert.ok(output.includes('Blast radius: medium'));
  });

  it('should list affected files with distance', () => {
    const result: ImpactResult = {
      success: true,
      targets: ['FILE:src/auth.ts'],
      affectedFiles: [
        { path: 'src/login.ts', distance: 1, via: ['src/auth.ts'] },
        { path: 'src/api.ts', distance: 2, via: ['src/auth.ts', 'src/login.ts'] },
      ],
      summary: { total: 2, direct: 1, indirect: 1 },
      blastRadius: 'low',
      durationMs: 25,
      warnings: [],
      nextSuggested: [],
      content: '...',
    };

    const output = formatImpactText(result);

    assert.ok(output.includes('Affected files:'));
    assert.ok(output.includes('src/login.ts (direct)'));
    assert.ok(output.includes('src/api.ts (indirect)'));
  });

  it('should show truncation warning when truncated', () => {
    const result: ImpactResult = {
      success: true,
      targets: ['FILE:src/core.ts'],
      affectedFiles: [
        { path: 'src/a.ts', distance: 1, via: ['src/core.ts'] },
      ],
      summary: { total: 50, direct: 10, indirect: 40 },
      truncated: true,
      blastRadius: 'high',
      durationMs: 100,
      warnings: [],
      nextSuggested: ['Increase maxFiles to see all'],
      content: '...',
    };

    const output = formatImpactText(result);

    assert.ok(output.includes('Showing 1 of 50 files'));
    assert.ok(output.includes('truncated'));
  });

  it('should list warnings if present', () => {
    const result: ImpactResult = {
      success: true,
      targets: ['FILE:src/utils.ts'],
      affectedFiles: [],
      summary: { total: 0, direct: 0, indirect: 0 },
      blastRadius: 'unknown',
      durationMs: 10,
      warnings: ['Test files excluded', 'Circular dependency detected'],
      nextSuggested: [],
      content: '...',
    };

    const output = formatImpactText(result);

    assert.ok(output.includes('Warnings:'));
    assert.ok(output.includes('- Test files excluded'));
    assert.ok(output.includes('- Circular dependency detected'));
  });

  it('should list next suggested if present', () => {
    const result: ImpactResult = {
      success: true,
      targets: ['FILE:src/utils.ts'],
      affectedFiles: [
        { path: 'src/index.ts', distance: 1, via: ['src/utils.ts'] },
      ],
      summary: { total: 1, direct: 1, indirect: 0 },
      blastRadius: 'low',
      durationMs: 25,
      warnings: [],
      nextSuggested: ['codegraph scope src/index.ts', 'codegraph brief src/index.ts'],
      content: '...',
    };

    const output = formatImpactText(result);

    assert.ok(output.includes('Next suggested:'));
    assert.ok(output.includes('- codegraph scope src/index.ts'));
    assert.ok(output.includes('- codegraph brief src/index.ts'));
  });

  it('should format duration in seconds for >= 1000ms', () => {
    const result: ImpactResult = {
      success: true,
      targets: ['FILE:src/utils.ts'],
      affectedFiles: [],
      summary: { total: 0, direct: 0, indirect: 0 },
      blastRadius: 'unknown',
      durationMs: 2500,
      warnings: [],
      nextSuggested: [],
      content: '...',
    };

    const output = formatImpactText(result);

    assert.ok(output.includes('2.5s'));
  });

  it('should format duration in milliseconds for < 1000ms', () => {
    const result: ImpactResult = {
      success: true,
      targets: ['FILE:src/utils.ts'],
      affectedFiles: [],
      summary: { total: 0, direct: 0, indirect: 0 },
      blastRadius: 'unknown',
      durationMs: 450,
      warnings: [],
      nextSuggested: [],
      content: '...',
    };

    const output = formatImpactText(result);

    assert.ok(output.includes('450ms'));
  });

  it('should show blast radius classification', () => {
    const radii = ['low', 'medium', 'high', 'unknown'] as const;

    for (const radius of radii) {
      const result: ImpactResult = {
        success: true,
        targets: ['FILE:test.ts'],
        affectedFiles: [],
        summary: { total: 0, direct: 0, indirect: 0 },
        blastRadius: radius,
        durationMs: 10,
        warnings: [],
        nextSuggested: [],
        content: '...',
      };

      const output = formatImpactText(result);
      assert.ok(output.includes(`Blast radius: ${radius}`));
    }
  });
});

// ============================================================================
// Test Suite: formatImpactErrorJson
// ============================================================================

describe('formatImpactErrorJson', () => {
  it('should include success: false', () => {
    const error: ImpactError = {
      success: false,
      error: {
        code: 'E_TARGET_NOT_FOUND',
        message: 'Target not found: FILE:src/missing.ts',
        suggestion: 'Run codegraph analyze to build graph first',
      },
      durationMs: 10,
    };

    const output = formatImpactErrorJson(error);
    const parsed = JSON.parse(output);

    assert.strictEqual(parsed.success, false);
  });

  it('should include error code, message, and suggestion', () => {
    const error: ImpactError = {
      success: false,
      error: {
        code: 'E_TARGET_NOT_FOUND',
        message: 'Target not found',
        suggestion: 'Run codegraph analyze',
      },
      durationMs: 100,
    };

    const output = formatImpactErrorJson(error);
    const parsed = JSON.parse(output);

    assert.strictEqual(parsed.error.code, 'E_TARGET_NOT_FOUND');
    assert.strictEqual(parsed.error.message, 'Target not found');
    assert.strictEqual(parsed.error.suggestion, 'Run codegraph analyze');
    assert.strictEqual(parsed.durationMs, 100);
  });
});

// ============================================================================
// Test Suite: formatImpactErrorText
// ============================================================================

describe('formatImpactErrorText', () => {
  it('should show error code and message', () => {
    const error: ImpactError = {
      success: false,
      error: {
        code: 'E_TARGET_NOT_FOUND',
        message: 'Target not found: FILE:src/missing.ts',
      },
      durationMs: 10,
    };

    const output = formatImpactErrorText(error);

    assert.ok(output.includes('Error: Target not found'));
    assert.ok(output.includes('Code: E_TARGET_NOT_FOUND'));
  });

  it('should show suggestion if present', () => {
    const error: ImpactError = {
      success: false,
      error: {
        code: 'E_TARGET_NOT_FOUND',
        message: 'Target not found',
        suggestion: 'Run codegraph analyze to build graph first',
      },
      durationMs: 10,
    };

    const output = formatImpactErrorText(error);

    assert.ok(output.includes('Suggestion: Run codegraph analyze'));
  });

  it('should show duration', () => {
    const error: ImpactError = {
      success: false,
      error: {
        code: 'E_TARGET_NOT_FOUND',
        message: 'Target not found',
      },
      durationMs: 500,
    };

    const output = formatImpactErrorText(error);

    assert.ok(output.includes('Duration: 500ms'));
  });
});