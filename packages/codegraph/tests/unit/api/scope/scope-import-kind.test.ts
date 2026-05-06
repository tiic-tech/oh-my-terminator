/**
 * Tests for Scope Query Import Kind (Wave 3)
 *
 * Tests the extraction and display of import kind metadata
 * distinguishing type-only imports from value imports.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CodeGraph, NodeType, EdgeType, type GraphNode, type GraphEdge } from '../../../../src/index.js';
import { extractImportsWithKind } from '../../../../src/api/scope/extract-with-kind.js';
import { formatScopeOutput } from '../../../../src/api/scope/format/index.js';
import type { ImportInfo, ImportKind } from '../../../../src/api/types/index.js';

describe('Scope Query Import Kind', () => {
  let graph: CodeGraph;
  let fileNode: GraphNode;

  beforeEach(() => {
    graph = new CodeGraph();

    // Create source file
    fileNode = {
      id: 'FILE:src/main.ts',
      type: NodeType.FILE,
      path: 'src/main.ts',
      name: 'main.ts',
    };
    graph.addNode(fileNode);

    // Create target files for imports
    graph.addNode({
      id: 'FILE:src/types.ts',
      type: NodeType.FILE,
      path: 'src/types.ts',
      name: 'types.ts',
    });

    graph.addNode({
      id: 'FILE:src/utils.ts',
      type: NodeType.FILE,
      path: 'src/utils.ts',
      name: 'utils.ts',
    });

    // Create external package
    graph.addNode({
      id: 'EXTERNAL:lodash',
      type: NodeType.EXTERNAL,
      path: 'lodash',
      name: 'lodash',
    });
  });

  describe('extractImportsWithKind', () => {
    it('should extract importKind from IMPORTS edge metadata', () => {
      // Add IMPORTS edge with type-only kind
      graph.addEdge({
        from: 'FILE:src/main.ts',
        to: 'FILE:src/types.ts',
        type: EdgeType.IMPORTS,
        metadata: {
          line: 1,
          importSpecifier: 'named:User',
          importKind: 'type-only' as ImportKind,
        },
      });

      const imports = extractImportsWithKind(graph, fileNode);

      assert.strictEqual(imports.length, 1);
      assert.strictEqual(imports[0].from, 'src/types.ts');
      assert.strictEqual(imports[0].kind, 'type-only');
      assert.strictEqual(imports[0].type, 'static');
    });

    it('should default to value for imports without importKind metadata', () => {
      // Add IMPORTS edge without importKind
      graph.addEdge({
        from: 'FILE:src/main.ts',
        to: 'FILE:src/utils.ts',
        type: EdgeType.IMPORTS,
        metadata: {
          line: 2,
          importSpecifier: 'named:formatDate',
        },
      });

      const imports = extractImportsWithKind(graph, fileNode);

      assert.strictEqual(imports.length, 1);
      assert.strictEqual(imports[0].from, 'src/utils.ts');
      assert.strictEqual(imports[0].kind, 'value');
    });

    it('should always use value for external imports', () => {
      // Add IMPORTS edge to external package
      graph.addEdge({
        from: 'FILE:src/main.ts',
        to: 'EXTERNAL:lodash',
        type: EdgeType.IMPORTS,
        metadata: {
          line: 3,
          importSpecifier: 'namespace',
          importKind: 'type-only' as ImportKind, // Even if marked type-only
        },
      });

      const imports = extractImportsWithKind(graph, fileNode);

      assert.strictEqual(imports.length, 1);
      assert.strictEqual(imports[0].from, 'lodash');
      // External imports are always value (runtime dependencies)
      assert.strictEqual(imports[0].kind, 'value');
    });

    it('should handle RE_EXPORTS edges with importKind', () => {
      graph.addEdge({
        from: 'FILE:src/main.ts',
        to: 'FILE:src/types.ts',
        type: EdgeType.RE_EXPORTS,
        metadata: {
          line: 1,
          importSpecifier: 'named:User',
          importKind: 'type-only' as ImportKind,
        },
      });

      const imports = extractImportsWithKind(graph, fileNode);

      assert.strictEqual(imports.length, 1);
      assert.strictEqual(imports[0].type, 're-export');
      assert.strictEqual(imports[0].kind, 'type-only');
    });

    it('should handle DYNAMIC_IMPORTS edges (always value)', () => {
      graph.addEdge({
        from: 'FILE:src/main.ts',
        to: 'FILE:src/utils.ts',
        type: EdgeType.DYNAMIC_IMPORTS,
        metadata: {
          line: 5,
          importSpecifier: 'dynamic',
        },
      });

      const imports = extractImportsWithKind(graph, fileNode);

      assert.strictEqual(imports.length, 1);
      assert.strictEqual(imports[0].type, 'dynamic');
      // Dynamic imports have no type-only concept
      assert.strictEqual(imports[0].kind, 'value');
    });

    it('should deduplicate imports by path', () => {
      // Add multiple IMPORTS edges to same target
      graph.addEdge({
        from: 'FILE:src/main.ts',
        to: 'FILE:src/types.ts',
        type: EdgeType.IMPORTS,
        metadata: {
          line: 1,
          importSpecifier: 'named:User',
          importKind: 'type-only' as ImportKind,
        },
      });

      graph.addEdge({
        from: 'FILE:src/main.ts',
        to: 'FILE:src/types.ts',
        type: EdgeType.IMPORTS,
        metadata: {
          line: 2,
          importSpecifier: 'named:Product',
          importKind: 'type-only' as ImportKind,
        },
      });

      const imports = extractImportsWithKind(graph, fileNode);

      // Should deduplicate to one entry
      assert.strictEqual(imports.length, 1);
      assert.strictEqual(imports[0].from, 'src/types.ts');
    });

    it('should sort imports by path', () => {
      graph.addEdge({
        from: 'FILE:src/main.ts',
        to: 'FILE:src/utils.ts',
        type: EdgeType.IMPORTS,
      });

      graph.addEdge({
        from: 'FILE:src/main.ts',
        to: 'EXTERNAL:lodash',
        type: EdgeType.IMPORTS,
      });

      graph.addEdge({
        from: 'FILE:src/main.ts',
        to: 'FILE:src/types.ts',
        type: EdgeType.IMPORTS,
        metadata: { importKind: 'type-only' as ImportKind },
      });

      const imports = extractImportsWithKind(graph, fileNode);

      assert.strictEqual(imports.length, 3);
      // Sorted alphabetically: lodash, src/types.ts, src/utils.ts
      assert.strictEqual(imports[0].from, 'lodash');
      assert.strictEqual(imports[1].from, 'src/types.ts');
      assert.strictEqual(imports[2].from, 'src/utils.ts');
    });
  });

  describe('formatScopeOutput import kind display', () => {
    it('should display [type-only] marker for type-only imports', () => {
      const imports: ImportInfo[] = [
        { from: 'src/types.ts', type: 'static', specifiers: [], kind: 'type-only' },
        { from: 'src/utils.ts', type: 'static', specifiers: [], kind: 'value' },
      ];

      const output = formatScopeOutput(
        'FILE:src/main.ts',
        [],
        imports,
        [],
        null,
        { level: 'unknown', value: 0 },
        {},
        false
      );

      // Check that type-only import has marker
      assert.ok(output.includes("'src/types.ts' [type-only]"));
      // Check that value import has no marker
      assert.ok(output.includes("'src/utils.ts'"));
      assert.ok(!output.includes("'src/utils.ts' [value]"));
    });

    it('should not display [value] marker (default)', () => {
      const imports: ImportInfo[] = [
        { from: 'lodash', type: 'static', specifiers: [], kind: 'value' },
      ];

      const output = formatScopeOutput(
        'FILE:src/main.ts',
        [],
        imports,
        [],
        null,
        { level: 'unknown', value: 0 },
        {},
        false
      );

      // Value imports should not have explicit marker
      assert.ok(output.includes("'lodash'"));
      assert.ok(!output.includes("'lodash' [value]"));
    });

    it('should handle empty imports', () => {
      const output = formatScopeOutput(
        'FILE:src/main.ts',
        [],
        [],
        [],
        null,
        { level: 'unknown', value: 0 },
        {},
        false
      );

      assert.ok(output.includes('none (leaf file)'));
    });
  });
});