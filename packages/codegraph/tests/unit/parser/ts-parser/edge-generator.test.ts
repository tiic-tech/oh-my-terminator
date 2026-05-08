/**
 * Unit tests for edge-generator importKind metadata
 *
 * Tests Wave 2 implementation:
 * - IMPORTS edge includes importKind in metadata
 * - RE_EXPORTS edge includes importKind in metadata
 * - DYNAMIC_IMPORTS edge does NOT include importKind (no type-only concept)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateImportEdge,
  generateReExportEdge,
  generateDynamicImportEdge,
} from '../../../../src/parser/ts-parser/edge-generator.js';
import { EdgeType } from '../../../../src/types.js';
import type { ParsedImportInfo, ImportKind } from '../../../../src/parser/ts-parser/types.js';

/**
 * Helper to create minimal ParsedImportInfo for testing
 */
function createImportInfo(
  specifier: string,
  resolvedPath: string | null,
  importType: 'import' | 're-export' | 'dynamic',
  importKind: ImportKind,
  importSpecifier: string = 'named:User'
): ParsedImportInfo {
  return {
    sourceFile: 'src/a.ts',
    specifier,
    resolvedPath,
    line: 1,
    importType,
    importSpecifier,
    importKind,
  };
}

describe('IMPORTS edge importKind metadata', () => {
  it('should include importKind: type-only in IMPORTS edge metadata', () => {
    const info = createImportInfo('./types', 'src/types.ts', 'import', 'type-only');
    const edge = generateImportEdge(info);

    assert.strictEqual(edge.type, EdgeType.IMPORTS);
    assert.strictEqual(edge.metadata.importKind, 'type-only');
    assert.strictEqual(edge.metadata.line, 1);
    assert.strictEqual(edge.metadata.importSpecifier, 'named:User');
  });

  it('should include importKind: value in IMPORTS edge metadata', () => {
    const info = createImportInfo('./utils', 'src/utils.ts', 'import', 'value');
    const edge = generateImportEdge(info);

    assert.strictEqual(edge.type, EdgeType.IMPORTS);
    assert.strictEqual(edge.metadata.importKind, 'value');
  });

  it('should handle external imports with value importKind', () => {
    const info = createImportInfo('lodash', null, 'import', 'value', 'namespace');
    const edge = generateImportEdge(info);

    assert.strictEqual(edge.type, EdgeType.IMPORTS);
    assert.strictEqual(edge.to, 'EXTERNAL:lodash');
    assert.strictEqual(edge.metadata.importKind, 'value');
    assert.strictEqual(edge.metadata.importSpecifier, 'namespace');
  });
});

describe('RE_EXPORTS edge importKind metadata', () => {
  it('should include importKind: type-only in RE_EXPORTS edge metadata', () => {
    const info = createImportInfo('./types', 'src/types.ts', 're-export', 'type-only', 'named:User');
    const edge = generateReExportEdge(info);

    assert.strictEqual(edge.type, EdgeType.RE_EXPORTS);
    assert.strictEqual(edge.metadata.importKind, 'type-only');
  });

  it('should include importKind: value in RE_EXPORTS edge metadata', () => {
    const info = createImportInfo('./utils', 'src/utils.ts', 're-export', 'value', 'wildcard');
    const edge = generateReExportEdge(info);

    assert.strictEqual(edge.type, EdgeType.RE_EXPORTS);
    assert.strictEqual(edge.metadata.importKind, 'value');
    assert.strictEqual(edge.metadata.importSpecifier, 'wildcard');
  });

  it('should handle external re-exports with value importKind', () => {
    const info = createImportInfo('react', null, 're-export', 'value', 'named:Component');
    const edge = generateReExportEdge(info);

    assert.strictEqual(edge.type, EdgeType.RE_EXPORTS);
    assert.strictEqual(edge.to, 'EXTERNAL:react');
    assert.strictEqual(edge.metadata.importKind, 'value');
  });
});

describe('DYNAMIC_IMPORTS edge (no importKind)', () => {
  it('should NOT include importKind in DYNAMIC_IMPORTS edge metadata', () => {
    const info = createImportInfo('./module', 'src/module.ts', 'dynamic', 'value', 'dynamic');
    const edge = generateDynamicImportEdge(info);

    assert.strictEqual(edge.type, EdgeType.DYNAMIC_IMPORTS);
    // Dynamic imports have no importKind - per design.md Non-Goals
    assert.strictEqual(edge.metadata.importKind, undefined);
    assert.strictEqual(edge.metadata.importSpecifier, 'dynamic');
  });

  it('should always use importSpecifier: dynamic for DYNAMIC_IMPORTS', () => {
    const info = createImportInfo('./module', 'src/module.ts', 'dynamic', 'value', 'dynamic');
    const edge = generateDynamicImportEdge(info);

    assert.strictEqual(edge.metadata.importSpecifier, 'dynamic');
    // Input importSpecifier is ignored for dynamic imports
  });

  it('should handle unresolved dynamic imports', () => {
    const info = createImportInfo('__dynamic__', null, 'dynamic', 'value', 'dynamic');
    const edge = generateDynamicImportEdge(info);

    assert.strictEqual(edge.type, EdgeType.DYNAMIC_IMPORTS);
    assert.strictEqual(edge.to, 'EXTERNAL:__dynamic__');
  });
});

describe('Edge metadata completeness', () => {
  it('should have all required metadata fields for IMPORTS edge', () => {
    const info = createImportInfo('./types', 'src/types.ts', 'import', 'type-only', 'named:User,Type');
    const edge = generateImportEdge(info);

    assert.strictEqual(edge.from, 'FILE:src/a.ts');
    assert.strictEqual(edge.to, 'FILE:src/types.ts');
    assert.strictEqual(edge.type, EdgeType.IMPORTS);
    assert.ok(edge.metadata.line !== undefined);
    assert.ok(edge.metadata.importSpecifier !== undefined);
    assert.ok(edge.metadata.importKind !== undefined);
  });

  it('should have all required metadata fields for RE_EXPORTS edge', () => {
    const info = createImportInfo('./types', 'src/types.ts', 're-export', 'value', 'wildcard');
    const edge = generateReExportEdge(info);

    assert.strictEqual(edge.from, 'FILE:src/a.ts');
    assert.strictEqual(edge.to, 'FILE:src/types.ts');
    assert.strictEqual(edge.type, EdgeType.RE_EXPORTS);
    assert.ok(edge.metadata.line !== undefined);
    assert.ok(edge.metadata.importSpecifier !== undefined);
    assert.ok(edge.metadata.importKind !== undefined);
  });

  it('should have line metadata from source info', () => {
    const info: ParsedImportInfo = {
      sourceFile: 'src/a.ts',
      specifier: './types',
      resolvedPath: 'src/types.ts',
      line: 42,
      importType: 'import',
      importSpecifier: 'named:User',
      importKind: 'type-only',
    };
    const edge = generateImportEdge(info);

    assert.strictEqual(edge.metadata.line, 42);
  });
});