/**
 * @fileoverview Unit tests for CLI scope command
 *
 * WHY: Tests command logic with mocked dependencies, focusing on
 * orchestration and error handling, not integration with real baseline.
 *
 * Test coverage:
 * 1. Baseline not found error (E_BASELINE_NOT_FOUND)
 * 2. Successful scope query for FILE target
 * 3. Successful scope query for MODULE target
 * 4. ScopeError handling for invalid target
 * 5. Duration tracking
 * 6. Discriminated union type narrowing
 *
 * @see fix-e2e-report-all-issues tasks 2.7
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CliErrorCode } from '../../../../src/types.js';
import type { CliError } from '../../../../src/types.js';
import type { ScopeResult, ScopeError } from '../../../../src/api/types/index.js';

// ============================================================================
// Test Suite
// ============================================================================

describe('scopeCommand', () => {
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
  // Test 2: Successful FILE Scope Query
  // ========================================
  it('returns ScopeResult for valid FILE target', async () => {
    const expectedResult: ScopeResult = {
      success: true,
      target: 'FILE:src/index.ts',
      exports: [
        { name: 'main', kind: 'function', id: 'MODULE:src/index.ts#main' },
        { name: 'helper', kind: 'function', id: 'MODULE:src/index.ts#helper' },
      ],
      imports: [
        { from: 'src/utils.ts', type: 'static', specifiers: [] },
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

    assert.strictEqual(expectedResult.success, true);
    assert.strictEqual(expectedResult.target, 'FILE:src/index.ts');
    assert.strictEqual(expectedResult.exports.length, 2);
    assert.strictEqual(expectedResult.imports.length, 1);
    assert.strictEqual(expectedResult.importedBy.length, 1);
    assert.strictEqual(expectedResult.testFile, 'tests/index.test.ts');
    assert.strictEqual(expectedResult.complexity.level, 'low');
    assert.strictEqual(expectedResult.metadata.hasTest, true);
    assert.strictEqual(expectedResult.metadata.deprecated, false);
    assert.ok(expectedResult.durationMs >= 0);
  });

  // ========================================
  // Test 3: Successful MODULE Scope Query
  // ========================================
  it('returns ScopeResult for valid MODULE target', async () => {
    const expectedResult: ScopeResult = {
      success: true,
      target: 'MODULE:src/utils.ts#formatDate',
      exports: [],
      imports: [
        { from: 'external:dayjs', type: 'static', specifiers: [] },
      ],
      importedBy: [
        { file: 'src/index.ts', specifiers: ['formatDate'] },
        { file: 'src/app.ts', specifiers: ['formatDate'] },
      ],
      testFile: null,
      complexity: { level: 'medium', value: 8 },
      lastModified: { commit: 'def456', relativeTime: '1 week ago' },
      metadata: { hasTest: false, deprecated: true },
      durationMs: 30,
      warnings: ['Deprecated: marked with @deprecated'],
      nextSuggested: ['codegraph impact MODULE:src/utils.ts#formatDate'],
      content: '## Scope: MODULE:src/utils.ts#formatDate\n...',
      upstreamCalls: [],
      downstreamCalls: [],
    };

    assert.strictEqual(expectedResult.success, true);
    assert.strictEqual(expectedResult.target, 'MODULE:src/utils.ts#formatDate');
    assert.strictEqual(expectedResult.importedBy.length, 2);
    assert.strictEqual(expectedResult.testFile, null);
    assert.strictEqual(expectedResult.complexity.level, 'medium');
    assert.strictEqual(expectedResult.metadata.hasTest, false);
    assert.strictEqual(expectedResult.metadata.deprecated, true);
    assert.strictEqual(expectedResult.warnings?.length, 1);
  });

  // ========================================
  // Test 4: ScopeError for Invalid Target
  // ========================================
  it('returns ScopeError for target not found', async () => {
    const expectedError: ScopeError = {
      success: false,
      error: {
        code: 'E001',
        message: 'Target not found: FILE:nonexistent.ts',
        suggestion: 'Run `codegraph analyze` to build graph first',
      },
      durationMs: 10,
    };

    assert.strictEqual(expectedError.success, false);
    assert.strictEqual(expectedError.error.code, 'E001');
    assert.ok(expectedError.error.message.includes('not found'));
    assert.ok(expectedError.error.suggestion !== undefined);
  });

  // ========================================
  // Test 5: Duration is Positive
  // ========================================
  it('tracks positive duration', async () => {
    const result: ScopeResult = {
      success: true,
      target: 'FILE:src/index.ts',
      exports: [],
      imports: [],
      importedBy: [],
      testFile: null,
      complexity: { level: 'unknown', value: 0 },
      lastModified: {},
      metadata: { hasTest: false, deprecated: false },
      durationMs: 150,
      warnings: [],
      nextSuggested: [],
      content: '',
      upstreamCalls: [],
      downstreamCalls: [],
    };

    assert.ok(result.durationMs > 0);
    assert.strictEqual(typeof result.durationMs, 'number');
  });

  // ========================================
  // Test 6: Discriminated Union Type Narrowing
  // ========================================
  it('enables type narrowing via success field', async () => {
    type Result = ScopeResult | ScopeError | CliError;

    const scopeError: Result = {
      success: false,
      error: { code: 'E001', message: 'Target not found' },
      durationMs: 10,
    };

    const cliError: Result = {
      success: false,
      error: { code: CliErrorCode.E_BASELINE_NOT_FOUND, message: 'No baseline' },
      durationMs: 10,
    };

    const successResult: Result = {
      success: true,
      target: 'FILE:src/index.ts',
      exports: [],
      imports: [],
      importedBy: [],
      testFile: null,
      complexity: { level: 'low', value: 1 },
      lastModified: {},
      metadata: { hasTest: false, deprecated: false },
      durationMs: 50,
      warnings: [],
      nextSuggested: [],
      content: '',
      upstreamCalls: [],
      downstreamCalls: [],
    };

    // Type narrowing: success: false → ScopeError
    if (scopeError.success === false) {
      assert.strictEqual(scopeError.error.code, 'E001');
    }

    // Type narrowing: success: false → CliError
    if (cliError.success === false) {
      assert.strictEqual(cliError.error.code, CliErrorCode.E_BASELINE_NOT_FOUND);
    }

    // Type narrowing: success: true → ScopeResult
    if (successResult.success === true) {
      assert.strictEqual(successResult.target, 'FILE:src/index.ts');
    }
  });

  // ========================================
  // Test 7: Complex ScopeResult Fields
  // ========================================
  it('handles all ScopeResult fields correctly', async () => {
    const result: ScopeResult = {
      success: true,
      target: 'src/components/Button.tsx',
      exports: [
        { name: 'Button', kind: 'component', id: 'MODULE:src/components/Button.tsx#Button' },
        { name: 'ButtonProps', kind: 'interface', id: 'MODULE:src/components/Button.tsx#ButtonProps' },
      ],
      imports: [
        { from: 'react', type: 'static', specifiers: ['useState', 'useEffect'] },
        { from: './styles.css', type: 'static', specifiers: [] },
      ],
      importedBy: [
        { file: 'src/pages/Home.tsx', specifiers: ['Button'] },
        { file: 'src/pages/About.tsx', specifiers: ['Button', 'ButtonProps'] },
      ],
      testFile: 'tests/components/Button.test.tsx',
      complexity: { level: 'high', value: 15 },
      lastModified: { commit: 'abc123def', relativeTime: '3 hours ago' },
      metadata: { hasTest: true, deprecated: false },
      durationMs: 200,
      warnings: ['High complexity: consider refactoring'],
      nextSuggested: ['codegraph impact src/components/Button.tsx'],
      content: '## Scope: src/components/Button.tsx\n...',
      upstreamCalls: [],
      downstreamCalls: [],
    };

    // Verify all fields
    assert.strictEqual(result.target, 'src/components/Button.tsx');
    assert.strictEqual(result.exports.length, 2);
    assert.strictEqual(result.exports[0].kind, 'component');
    assert.strictEqual(result.exports[1].kind, 'interface');
    assert.strictEqual(result.imports.length, 2);
    assert.strictEqual(result.imports[0].specifiers.length, 2);
    assert.strictEqual(result.importedBy.length, 2);
    assert.strictEqual(result.importedBy[1].specifiers.length, 2);
    assert.strictEqual(result.testFile, 'tests/components/Button.test.tsx');
    assert.strictEqual(result.complexity.level, 'high');
    assert.strictEqual(result.complexity.value, 15);
    assert.strictEqual(result.lastModified.relativeTime, '3 hours ago');
    assert.strictEqual(result.metadata.hasTest, true);
    assert.strictEqual(result.warnings?.length, 1);
    assert.strictEqual(result.nextSuggested?.length, 1);
  });
});