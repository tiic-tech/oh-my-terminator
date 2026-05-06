/**
 * Unit tests for ImportKind type and importKind field
 *
 * Tests the type-only import detection feature from design.md Decision 5 & 7.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ImportKind, ParsedImportInfo } from '../../../../src/parser/ts-parser/types.js';

describe('ImportKind type', () => {
  it('should accept type-only value', () => {
    const kind: ImportKind = 'type-only';
    assert.strictEqual(kind, 'type-only');
  });

  it('should accept value', () => {
    const kind: ImportKind = 'value';
    assert.strictEqual(kind, 'value');
  });

  it('should be assignable to ParsedImportInfo.importKind', () => {
    const importInfo: Partial<ParsedImportInfo> = {
      sourceFile: 'test.ts',
      specifier: './types',
      resolvedPath: './types.ts',
      line: 1,
      importType: 'import',
      importSpecifier: 'named:User',
      importKind: 'type-only',
    };
    assert.strictEqual(importInfo.importKind, 'type-only');
  });
});