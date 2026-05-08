/**
 * Tests for createOutput function
 *
 * WHY: Verifies OutputResult creation helper.
 * Ensures optional fields are handled correctly.
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { createOutput } from '../../../src/cli/output/router.js';

describe('createOutput', () => {
  it('creates OutputResult with primary only', () => {
    const result = createOutput('test content');
    assert.strictEqual(result.primary, 'test content');
    assert.strictEqual(result.warnings, undefined);
    assert.strictEqual(result.errors, undefined);
  });

  it('creates OutputResult with warnings', () => {
    const result = createOutput('test content', ['warning1', 'warning2']);
    assert.strictEqual(result.primary, 'test content');
    assert.deepStrictEqual(result.warnings, ['warning1', 'warning2']);
    assert.strictEqual(result.errors, undefined);
  });

  it('creates OutputResult with errors', () => {
    const result = createOutput('test content', undefined, ['error1']);
    assert.strictEqual(result.primary, 'test content');
    assert.strictEqual(result.warnings, undefined);
    assert.deepStrictEqual(result.errors, ['error1']);
  });

  it('omits empty warnings array', () => {
    const result = createOutput('test content', []);
    assert.strictEqual(result.warnings, undefined, 'Empty warnings should be omitted');
  });

  it('omits empty errors array', () => {
    const result = createOutput('test content', undefined, []);
    assert.strictEqual(result.errors, undefined, 'Empty errors should be omitted');
  });
});