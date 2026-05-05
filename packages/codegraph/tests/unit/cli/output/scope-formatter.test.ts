/**
 * @fileoverview Unit tests for CLI scope formatters
 *
 * WHY: Tests output formatting for JSON and text formats.
 * Ensures programmatic consumption (JSON) and human-readable (text) work correctly.
 *
 * Test coverage:
 * 1. formatScopeJson for successful result
 * 2. formatScopeJson for error result
 * 3. formatScopeText for successful result
 * 4. formatScopeText for error result
 * 5. Markdown content structure
 *
 * @see fix-e2e-report-all-issues tasks 2.8
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatScopeJson, formatScopeText, formatScopeErrorJson, formatScopeErrorText } from '../../../../src/cli/output/scope-formatter.js';
import type { ScopeResult, ScopeError } from '../../../../src/api/types/index.js';

// ============================================================================
// Helper Functions
// ============================================================================

function createMockScopeResult(): ScopeResult {
  return {
    success: true,
    target: 'FILE:src/index.ts',
    exports: [
      { name: 'main', kind: 'function', id: 'MODULE:src/index.ts#main' },
      { name: 'helper', kind: 'function', id: 'MODULE:src/index.ts#helper' },
    ],
    imports: [
      { from: 'src/utils.ts', type: 'static', specifiers: [] },
      { from: 'lodash', type: 'static', specifiers: ['map', 'filter'] },
    ],
    importedBy: [
      { file: 'src/app.ts', specifiers: [] },
    ],
    testFile: 'tests/index.test.ts',
    complexity: { level: 'low', value: 3 },
    lastModified: { commit: 'abc123', relativeTime: '2 days ago' },
    metadata: { hasTest: true, deprecated: false },
    durationMs: 50,
    warnings: [],
    nextSuggested: ['codegraph impact FILE:src/index.ts'],
    content: '## Scope: FILE:src/index.ts\n...',
    upstreamCalls: [],
    downstreamCalls: [],
  };
}

function createMockScopeError(): ScopeError {
  return {
    success: false,
    error: {
      code: 'E001',
      message: 'Target not found: FILE:nonexistent.ts',
      suggestion: 'Run `codegraph analyze` to build graph first',
    },
    durationMs: 10,
  };
}

// ============================================================================
// Test Suite: JSON Formatter
// ============================================================================

describe('formatScopeJson', () => {
  it('formats ScopeResult as valid JSON string', () => {
    const result = createMockScopeResult();
    const json = formatScopeJson(result);

    assert.strictEqual(typeof json, 'string');
    const parsed = JSON.parse(json) as ScopeResult;
    assert.strictEqual(parsed.success, true);
    assert.strictEqual(parsed.target, 'FILE:src/index.ts');
    assert.strictEqual(parsed.exports.length, 2);
    assert.strictEqual(parsed.imports.length, 2);
    assert.strictEqual(parsed.testFile, 'tests/index.test.ts');
    assert.strictEqual(parsed.complexity.level, 'low');
    assert.strictEqual(parsed.metadata.hasTest, true);
  });

  it('includes all required fields in JSON output', () => {
    const result = createMockScopeResult();
    const json = formatScopeJson(result);
    const parsed = JSON.parse(json);

    // Required fields
    assert.ok('success' in parsed);
    assert.ok('target' in parsed);
    assert.ok('exports' in parsed);
    assert.ok('imports' in parsed);
    assert.ok('importedBy' in parsed);
    assert.ok('testFile' in parsed);
    assert.ok('complexity' in parsed);
    assert.ok('lastModified' in parsed);
    assert.ok('metadata' in parsed);
    assert.ok('durationMs' in parsed);
    assert.ok('content' in parsed);

    // Optional fields present
    assert.ok('warnings' in parsed);
    assert.ok('nextSuggested' in parsed);
  });

  it('formats complex result with all specifiers', () => {
    const result: ScopeResult = {
      success: true,
      target: 'MODULE:src/utils.ts#formatDate',
      exports: [],
      imports: [
        { from: 'dayjs', type: 'static', specifiers: ['default', 'format'] },
      ],
      importedBy: [
        { file: 'src/index.ts', specifiers: ['formatDate'] },
        { file: 'src/app.ts', specifiers: ['formatDate', 'parseDate'] },
      ],
      testFile: null,
      complexity: { level: 'medium', value: 8 },
      lastModified: { commit: 'def456', relativeTime: '1 week ago' },
      metadata: { hasTest: false, deprecated: true },
      durationMs: 30,
      warnings: ['Deprecated: marked with @deprecated'],
      nextSuggested: ['codegraph impact MODULE:src/utils.ts#formatDate'],
      content: '## Scope: MODULE:src/utils.ts#formatDate',
      upstreamCalls: [],
      downstreamCalls: [],
    };

    const json = formatScopeJson(result);
    const parsed = JSON.parse(json);

    assert.strictEqual(parsed.imports[0].specifiers.length, 2);
    assert.strictEqual(parsed.importedBy[1].specifiers.length, 2);
    assert.strictEqual(parsed.metadata.deprecated, true);
  });
});

describe('formatScopeErrorJson', () => {
  it('formats ScopeError as valid JSON string', () => {
    const error = createMockScopeError();
    const json = formatScopeErrorJson(error);

    assert.strictEqual(typeof json, 'string');
    const parsed = JSON.parse(json) as ScopeError;
    assert.strictEqual(parsed.success, false);
    assert.strictEqual(parsed.error.code, 'E001');
    assert.ok(parsed.error.message.includes('not found'));
  });

  it('includes suggestion in error JSON', () => {
    const error = createMockScopeError();
    const json = formatScopeErrorJson(error);
    const parsed = JSON.parse(json);

    assert.ok(parsed.error.suggestion !== undefined);
    assert.ok(parsed.error.suggestion?.includes('analyze'));
  });
});

// ============================================================================
// Test Suite: Text Formatter
// ============================================================================

describe('formatScopeText', () => {
  it('formats ScopeResult as human-readable text', () => {
    const result = createMockScopeResult();
    const text = formatScopeText(result);

    assert.strictEqual(typeof text, 'string');
    assert.ok(text.includes('Scope result'));
    assert.ok(text.includes('FILE:src/index.ts'));
    assert.ok(text.includes('exports'));
    assert.ok(text.includes('imports'));
    assert.ok(text.includes('imported by'));
  });

  it('includes test file information', () => {
    const result = createMockScopeResult();
    const text = formatScopeText(result);

    assert.ok(text.includes('Test file'));
    assert.ok(text.includes('tests/index.test.ts'));
  });

  it('includes complexity information', () => {
    const result = createMockScopeResult();
    const text = formatScopeText(result);

    assert.ok(text.includes('Complexity'));
    assert.ok(text.includes('low'));
    assert.ok(text.includes('3'));
  });

  it('includes duration', () => {
    const result = createMockScopeResult();
    const text = formatScopeText(result);

    assert.ok(text.includes('Duration'));
    assert.ok(text.includes('ms'));
  });

  it('handles null test file', () => {
    const result: ScopeResult = {
      success: true,
      target: 'FILE:src/utils.ts',
      exports: [],
      imports: [],
      importedBy: [],
      testFile: null,
      complexity: { level: 'unknown', value: 0 },
      lastModified: {},
      metadata: { hasTest: false, deprecated: false },
      durationMs: 20,
      warnings: [],
      nextSuggested: [],
      content: '',
      upstreamCalls: [],
      downstreamCalls: [],
    };

    const text = formatScopeText(result);
    assert.ok(text.includes('No test file'));
  });

  it('includes warnings when present', () => {
    const result: ScopeResult = {
      ...createMockScopeResult(),
      warnings: ['Deprecated symbol', 'High complexity'],
    };

    const text = formatScopeText(result);
    assert.ok(text.includes('Warnings'));
    assert.ok(text.includes('Deprecated symbol'));
  });

  it('includes next suggested commands', () => {
    const result = createMockScopeResult();
    const text = formatScopeText(result);

    assert.ok(text.includes('Next suggested'));
    assert.ok(text.includes('codegraph impact'));
  });
});

describe('formatScopeErrorText', () => {
  it('formats ScopeError as human-readable error text', () => {
    const error = createMockScopeError();
    const text = formatScopeErrorText(error);

    assert.strictEqual(typeof text, 'string');
    assert.ok(text.includes('Error'));
    assert.ok(text.includes('Target not found'));
    assert.ok(text.includes('E001'));
  });

  it('includes suggestion in error text', () => {
    const error = createMockScopeError();
    const text = formatScopeErrorText(error);

    assert.ok(text.includes('Suggestion'));
    assert.ok(text.includes('analyze'));
  });

  it('includes duration in error text', () => {
    const error = createMockScopeError();
    const text = formatScopeErrorText(error);

    assert.ok(text.includes('Duration'));
    assert.ok(text.includes('ms'));
  });
});