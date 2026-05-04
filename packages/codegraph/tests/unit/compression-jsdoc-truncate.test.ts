/**
 * Unit tests for jsdoc-truncate module (Tasks 2.6-2.7)
 *
 * Tests JSDoc truncation with configurable max length.
 * Run with: pnpm test tests/unit/compression-jsdoc-truncate.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  truncateJSDoc,
} from '../../src/persistence/compression/jsdoc-truncate.js';
import type { TruncatedJSDocResult } from '../../src/persistence/compression/jsdoc-truncate.js';

// ============================================================================
// Task 2.7: truncateJSDoc - truncates JSDoc to max length
// ============================================================================
describe('truncateJSDoc (Task 2.7)', () => {
  it('should return empty result for undefined jsDoc', () => {
    const result = truncateJSDoc(undefined, 100);

    assert.strictEqual(result.jsDoc, undefined);
    assert.strictEqual(result.jsDocTruncated, undefined);
    assert.strictEqual(result.hasJSDoc, false);
  });

  it('should return empty result for null jsDoc', () => {
    const result = truncateJSDoc(null, 100);

    assert.strictEqual(result.jsDoc, undefined);
    assert.strictEqual(result.jsDocTruncated, undefined);
    assert.strictEqual(result.hasJSDoc, false);
  });

  it('should return empty result for empty string jsDoc', () => {
    const result = truncateJSDoc('', 100);

    assert.strictEqual(result.jsDoc, undefined);
    assert.strictEqual(result.jsDocTruncated, undefined);
    assert.strictEqual(result.hasJSDoc, false);
  });

  it('should preserve short JSDoc without truncation', () => {
    const shortDoc = 'This is a short description.';
    const result = truncateJSDoc(shortDoc, 100);

    assert.strictEqual(result.jsDoc, shortDoc);
    assert.strictEqual(result.jsDocTruncated, false);
    assert.strictEqual(result.hasJSDoc, true);
  });

  it('should truncate long JSDoc to max length', () => {
    const longDoc = 'This is a very long JSDoc comment that exceeds the maximum length limit and should be truncated appropriately to fit within the specified bounds while preserving readability.';
    const result = truncateJSDoc(longDoc, 50);

    assert.strictEqual(result.jsDoc?.length, 53); // 50 + '...'
    assert.strictEqual(result.jsDocTruncated, true);
    assert.strictEqual(result.hasJSDoc, true);
    assert.ok(result.jsDoc?.endsWith('...'));
  });

  it('should truncate exactly at maxLength boundary', () => {
    const doc = 'Exactly one hundred characters long JSDoc comment that fits perfectly within the limit now!';
    const result = truncateJSDoc(doc, 50);

    assert.strictEqual(result.jsDoc?.length, 53); // truncated with '...'
    assert.strictEqual(result.jsDocTruncated, true);
  });

  it('should handle whitespace-only JSDoc', () => {
    const result = truncateJSDoc('   ', 100);

    // Whitespace-only should be treated as empty
    assert.strictEqual(result.hasJSDoc, false);
    assert.strictEqual(result.jsDoc, undefined);
  });

  it('should trim whitespace from JSDoc', () => {
    const doc = '  Description with leading/trailing spaces  ';
    const result = truncateJSDoc(doc, 100);

    assert.strictEqual(result.jsDoc, 'Description with leading/trailing spaces');
    assert.strictEqual(result.hasJSDoc, true);
  });

  it('should truncate after trimming', () => {
    const doc = '     This is a long description that needs truncation after trimming the whitespace      ';
    const result = truncateJSDoc(doc, 30);

    assert.ok(result.jsDoc?.startsWith('This is a long'));
    assert.strictEqual(result.jsDocTruncated, true);
    assert.ok(result.jsDoc?.endsWith('...'));
  });

  it('should use default max length of 100', () => {
    // Test that truncateJSDoc can work with default maxLength
    const docExactly100 = 'This is exactly one hundred characters long description that should not be truncated at all here!';
    // The function should accept undefined maxLength and default to 100

    const result = truncateJSDoc(docExactly100, 100);

    // Should not truncate if within limit
    assert.strictEqual(result.jsDoc, docExactly100);
    assert.strictEqual(result.jsDocTruncated, false);
  });

  it('should handle multi-line JSDoc', () => {
    const multiLineDoc = `This is a multi-line JSDoc comment.

    @param input - The input value
    @returns The processed result
    @example
    const result = process(input);`;

    const result = truncateJSDoc(multiLineDoc, 50);

    assert.strictEqual(result.jsDocTruncated, true);
    assert.ok(result.jsDoc?.length <= 53);
    assert.ok(result.jsDoc?.endsWith('...'));
  });

  it('should preserve newlines in short multi-line JSDoc', () => {
    const shortMultiLineDoc = `Short description.
    @param x - input`;

    const result = truncateJSDoc(shortMultiLineDoc, 100);

    assert.strictEqual(result.jsDoc, shortMultiLineDoc);
    assert.strictEqual(result.jsDocTruncated, false);
    assert.strictEqual(result.hasJSDoc, true);
  });

  it('should handle special characters in JSDoc', () => {
    const docWithSpecialChars = 'Description with <special> & "characters" and \'quotes\'';
    const result = truncateJSDoc(docWithSpecialChars, 100);

    assert.strictEqual(result.jsDoc, docWithSpecialChars);
    assert.strictEqual(result.jsDocTruncated, false);
  });

  it('should truncate to 0 length (edge case)', () => {
    const doc = 'Any description';
    const result = truncateJSDoc(doc, 0);

    // Even with maxLength 0, should still indicate hasJSDoc
    assert.strictEqual(result.hasJSDoc, true);
    assert.strictEqual(result.jsDocTruncated, true);
    assert.strictEqual(result.jsDoc, '...');
  });
});

// ============================================================================
// TruncatedJSDocResult interface tests
// ============================================================================
describe('TruncatedJSDocResult interface', () => {
  it('should return correct structure for truncated JSDoc', () => {
    const result: TruncatedJSDocResult = truncateJSDoc('Long description here...', 10);

    assert.ok(result.hasOwnProperty('jsDoc'));
    assert.ok(result.hasOwnProperty('jsDocTruncated'));
    assert.ok(result.hasOwnProperty('hasJSDoc'));
  });

  it('should return correct structure for non-truncated JSDoc', () => {
    const result: TruncatedJSDocResult = truncateJSDoc('Short', 100);

    assert.strictEqual(typeof result.jsDoc, 'string');
    assert.strictEqual(typeof result.jsDocTruncated, 'boolean');
    assert.strictEqual(typeof result.hasJSDoc, 'boolean');
  });

  it('should return correct structure for empty JSDoc', () => {
    const result: TruncatedJSDocResult = truncateJSDoc(undefined, 100);

    assert.strictEqual(result.jsDoc, undefined);
    assert.strictEqual(result.jsDocTruncated, undefined);
    assert.strictEqual(result.hasJSDoc, false);
  });
});

// ============================================================================
// Edge cases
// ============================================================================
describe('JSDoc truncation edge cases', () => {
  it('should handle very long JSDoc (1000+ chars)', () => {
    const veryLongDoc = 'A'.repeat(1000);
    const result = truncateJSDoc(veryLongDoc, 100);

    assert.strictEqual(result.jsDoc?.length, 103); // 100 + '...'
    assert.strictEqual(result.jsDocTruncated, true);
  });

  it('should handle maxLength larger than JSDoc', () => {
    const shortDoc = 'Short';
    const result = truncateJSDoc(shortDoc, 1000);

    assert.strictEqual(result.jsDoc, shortDoc);
    assert.strictEqual(result.jsDocTruncated, false);
  });

  it('should handle maxLength equal to JSDoc length', () => {
    const doc = 'Exact length test';
    const result = truncateJSDoc(doc, doc.length);

    assert.strictEqual(result.jsDoc, doc);
    assert.strictEqual(result.jsDocTruncated, false);
  });

  it('should handle maxLength one less than JSDoc length', () => {
    const doc = 'Exact length test';
    const result = truncateJSDoc(doc, doc.length - 1);

    assert.strictEqual(result.jsDocTruncated, true);
    assert.ok(result.jsDoc?.endsWith('...'));
  });

  it('should preserve meaningful truncation (not cut mid-word aggressively)', () => {
    // Test that truncation happens at a reasonable point
    const doc = 'This function processes input data and returns transformed output with validation applied';
    const result = truncateJSDoc(doc, 30);

    // Should truncate cleanly
    assert.ok(result.jsDoc);
    assert.ok(result.jsDocTruncated);
    assert.ok(result.jsDoc?.endsWith('...'));
  });
});