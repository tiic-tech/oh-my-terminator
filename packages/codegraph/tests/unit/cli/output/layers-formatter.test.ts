/**
 * @fileoverview Unit tests for CLI layers formatters
 *
 * WHY: Tests output formatting for JSON and text formats.
 * Ensures programmatic consumption (JSON) and human-readable (text) work correctly.
 *
 * Test coverage:
 * 1. formatLayersJson for successful result
 * 2. formatLayersJson for error result
 * 3. formatLayersText for successful result
 * 4. formatLayersText for error result
 * 5. Markdown content structure
 *
 * @see Section 4 tasks 4.8
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatLayersJson, formatLayersText, formatLayersErrorJson, formatLayersErrorText } from '../../../../src/cli/output/layers-formatter.js';
import type { LayersResult, LayersError } from '../../../../src/api/types/index.js';

// ============================================================================
// Helper Functions
// ============================================================================

function createMockLayersResult(): LayersResult {
  return {
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
    content: '## Architecture Layers\n\n### Layer 1: Foundation\n- utils (5 files)\n\n### Layer 2: Core\n- services (8 files)\n\n### Health Score: 100',
  };
}

function createMockLayersError(): LayersError {
  return {
    success: false,
    error: {
      code: 'E005',
      message: 'Graph contains no FILE nodes - cannot infer architecture layers',
      suggestion: 'Run `codegraph analyze` with valid source directory',
    },
    durationMs: 10,
  };
}

// ============================================================================
// Test Suite: JSON Formatter
// ============================================================================

describe('formatLayersJson', () => {
  it('formats LayersResult as valid JSON string', () => {
    const result = createMockLayersResult();
    const json = formatLayersJson(result);

    assert.strictEqual(typeof json, 'string');
    const parsed = JSON.parse(json) as LayersResult;
    assert.strictEqual(parsed.success, true);
    assert.strictEqual(parsed.layers.length, 4);
    assert.strictEqual(parsed.layers[0].role, 'Foundation');
    assert.strictEqual(parsed.healthScore, 100);
    assert.strictEqual(parsed.groups.length, 4);
  });

  it('includes all required fields in JSON output', () => {
    const result = createMockLayersResult();
    const json = formatLayersJson(result);
    const parsed = JSON.parse(json);

    // Required fields
    assert.ok('success' in parsed);
    assert.ok('layers' in parsed);
    assert.ok('violations' in parsed);
    assert.ok('healthScore' in parsed);
    assert.ok('groups' in parsed);
    assert.ok('durationMs' in parsed);
    assert.ok('content' in parsed);

    // Optional fields present
    assert.ok('warnings' in parsed);
    assert.ok('nextSuggested' in parsed);
  });

  it('formats result with violations', () => {
    const result: LayersResult = {
      success: true,
      layers: [
        { layer: 1, role: 'Foundation', groups: [{ name: 'utils', fileCount: 5, importedByCount: 10, importsFromCount: 0 }] },
      ],
      violations: [
        {
          fromGroup: 'services',
          toGroup: 'utils',
          count: 2,
          affectedFiles: [
            { from: 'src/services/auth.ts', to: 'src/utils/logger.ts' },
          ],
          layerGap: 1,
          severity: 'minor',
          suggestion: 'Consider moving shared utilities to a dedicated foundation layer',
        },
      ],
      healthScore: 95,
      groups: [{ name: 'utils', assignedLayer: 1, netScore: 10 }],
      durationMs: 30,
      warnings: ['2 layer violations detected'],
      nextSuggested: ['Inspect violations'],
      content: '## Architecture Layers\n### Violations\n...',
    };

    const json = formatLayersJson(result);
    const parsed = JSON.parse(json);

    assert.strictEqual(parsed.violations.length, 1);
    assert.strictEqual(parsed.violations[0].severity, 'minor');
    assert.strictEqual(parsed.violations[0].affectedFiles.length, 1);
    assert.strictEqual(parsed.healthScore, 95);
  });
});

describe('formatLayersErrorJson', () => {
  it('formats LayersError as valid JSON string', () => {
    const error = createMockLayersError();
    const json = formatLayersErrorJson(error);

    assert.strictEqual(typeof json, 'string');
    const parsed = JSON.parse(json) as LayersError;
    assert.strictEqual(parsed.success, false);
    assert.strictEqual(parsed.error.code, 'E005');
    assert.ok(parsed.error.message.includes('no FILE nodes'));
  });

  it('includes suggestion in error JSON', () => {
    const error = createMockLayersError();
    const json = formatLayersErrorJson(error);
    const parsed = JSON.parse(json);

    assert.ok(parsed.error.suggestion !== undefined);
    assert.ok(parsed.error.suggestion?.includes('analyze'));
  });
});

// ============================================================================
// Test Suite: Text Formatter
// ============================================================================

describe('formatLayersText', () => {
  it('formats LayersResult as human-readable text', () => {
    const result = createMockLayersResult();
    const text = formatLayersText(result);

    assert.strictEqual(typeof text, 'string');
    assert.ok(text.includes('Architecture Layers'));
    assert.ok(text.includes('Foundation'));
    assert.ok(text.includes('Core'));
    assert.ok(text.includes('Health Score'));
  });

  it('includes layer information', () => {
    const result = createMockLayersResult();
    const text = formatLayersText(result);

    assert.ok(text.includes('Layer 1'));
    assert.ok(text.includes('Layer 2'));
    assert.ok(text.includes('utils'));
    assert.ok(text.includes('services'));
  });

  it('includes health score', () => {
    const result = createMockLayersResult();
    const text = formatLayersText(result);

    assert.ok(text.includes('Health Score'));
    assert.ok(text.includes('100'));
  });

  it('includes duration', () => {
    const result = createMockLayersResult();
    const text = formatLayersText(result);

    assert.ok(text.includes('Duration'));
    assert.ok(text.includes('ms'));
  });

  it('handles violations in text output', () => {
    const result: LayersResult = {
      success: true,
      layers: [],
      violations: [
        {
          fromGroup: 'ui',
          toGroup: 'utils',
          count: 3,
          affectedFiles: [],
          layerGap: 3,
          severity: 'critical',
          suggestion: 'Major architecture violation',
        },
      ],
      healthScore: 55,
      groups: [],
      durationMs: 50,
      warnings: ['Critical violations detected'],
      nextSuggested: ['Fix violations'],
      content: '',
    };

    const text = formatLayersText(result);
    assert.ok(text.includes('Violations'));
    assert.ok(text.includes('critical'));
    assert.ok(text.includes('ui'));
    assert.ok(text.includes('utils'));
  });

  it('includes warnings when present', () => {
    const result: LayersResult = {
      ...createMockLayersResult(),
      warnings: ['Mutual imports detected', 'Consider refactoring'],
    };

    const text = formatLayersText(result);
    assert.ok(text.includes('Warnings'));
    assert.ok(text.includes('Mutual imports detected'));
  });

  it('includes next suggested commands', () => {
    const result: LayersResult = {
      ...createMockLayersResult(),
      nextSuggested: ['Review violations', 'Run refactoring analysis'],
    };

    const text = formatLayersText(result);
    assert.ok(text.includes('Next suggested'));
    assert.ok(text.includes('Review violations'));
  });
});

describe('formatLayersErrorText', () => {
  it('formats LayersError as human-readable error text', () => {
    const error = createMockLayersError();
    const text = formatLayersErrorText(error);

    assert.strictEqual(typeof text, 'string');
    assert.ok(text.includes('Error'));
    assert.ok(text.includes('no FILE nodes'));
    assert.ok(text.includes('E005'));
  });

  it('includes suggestion in error text', () => {
    const error = createMockLayersError();
    const text = formatLayersErrorText(error);

    assert.ok(text.includes('Suggestion'));
    assert.ok(text.includes('analyze'));
  });

  it('includes duration in error text', () => {
    const error = createMockLayersError();
    const text = formatLayersErrorText(error);

    assert.ok(text.includes('Duration'));
    assert.ok(text.includes('ms'));
  });
});