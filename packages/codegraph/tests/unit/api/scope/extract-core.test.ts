/**
 * C7: Scope Query - Core Extraction Unit Tests
 *
 * WHY separate file: Per decomposition principle, unit tests for extractExports
 * and extractImportedBy form a cohesive unit separate from integration tests.
 *
 * Tests edge cases: empty results, multiple edges, EXTERNAL references.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CodeGraph, NodeType, EdgeType, type GraphNode } from '../../../../src/index.js';
import { extractExports, extractImportedBy } from '../../../../src/api/scope/extract.js';

describe('extractExports Unit Tests', () => {
  let graph: CodeGraph;

  beforeEach(() => {
    graph = new CodeGraph();
  });

  describe('Input Validation', () => {
    it('should return empty array for null fileNode', () => {
      const result = extractExports(graph, null as unknown as GraphNode);
      assert.deepStrictEqual(result, []);
    });

    it('should return empty array for non-FILE node type', () => {
      const externalNode: GraphNode = {
        id: 'EXTERNAL:lodash',
        type: NodeType.EXTERNAL,
        path: 'lodash',
        name: 'lodash',
      };
      graph.addNode(externalNode);

      const result = extractExports(graph, externalNode);
      assert.deepStrictEqual(result, []);
    });

    it('should return empty array for FILE node with no MODULE children', () => {
      const fileNode: GraphNode = {
        id: 'FILE:src/empty.ts',
        type: NodeType.FILE,
        path: 'src/empty.ts',
        name: 'empty.ts',
      };
      graph.addNode(fileNode);

      const result = extractExports(graph, fileNode);
      assert.deepStrictEqual(result, []);
    });
  });

  describe('Export Extraction', () => {
    it('should extract single export in kind:name format', () => {
      const fileNode: GraphNode = {
        id: 'FILE:src/utils.ts',
        type: NodeType.FILE,
        path: 'src/utils.ts',
        name: 'utils.ts',
      };
      graph.addNode(fileNode);

      const moduleNode: GraphNode = {
        id: 'MODULE:src/utils.ts#formatDate',
        type: NodeType.MODULE,
        path: 'src/utils.ts',
        name: 'formatDate',
        metadata: { kind: 'function' },
      };
      graph.addNode(moduleNode);

      const result = extractExports(graph, fileNode);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], 'function:formatDate');
    });

    it('should extract multiple exports sorted alphabetically', () => {
      const fileNode: GraphNode = {
        id: 'FILE:src/types.ts',
        type: NodeType.FILE,
        path: 'src/types.ts',
        name: 'types.ts',
      };
      graph.addNode(fileNode);

      // Add modules in unsorted order
      const modules = [
        { name: 'User', kind: 'interface' },
        { name: 'Product', kind: 'type' },
        { name: 'Order', kind: 'class' },
      ];

      for (const mod of modules) {
        graph.addNode({
          id: `MODULE:src/types.ts#${mod.name}`,
          type: NodeType.MODULE,
          path: 'src/types.ts',
          name: mod.name,
          metadata: { kind: mod.kind },
        });
      }

      const result = extractExports(graph, fileNode);

      assert.strictEqual(result.length, 3);
      // Should be sorted alphabetically
      assert.strictEqual(result[0], 'class:Order');
      assert.strictEqual(result[1], 'interface:User');
      assert.strictEqual(result[2], 'type:Product');
    });

    it('should use "unknown" kind when metadata.kind is missing', () => {
      const fileNode: GraphNode = {
        id: 'FILE:src/legacy.ts',
        type: NodeType.FILE,
        path: 'src/legacy.ts',
        name: 'legacy.ts',
      };
      graph.addNode(fileNode);

      const moduleNode: GraphNode = {
        id: 'MODULE:src/legacy.ts#oldExport',
        type: NodeType.MODULE,
        path: 'src/legacy.ts',
        name: 'oldExport',
        // No metadata
      };
      graph.addNode(moduleNode);

      const result = extractExports(graph, fileNode);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], 'unknown:oldExport');
    });

    it('should only include MODULE nodes matching fileNode.path', () => {
      const fileNode: GraphNode = {
        id: 'FILE:src/target.ts',
        type: NodeType.FILE,
        path: 'src/target.ts',
        name: 'target.ts',
      };
      graph.addNode(fileNode);

      // Add module for target file
      graph.addNode({
        id: 'MODULE:src/target.ts#expected',
        type: NodeType.MODULE,
        path: 'src/target.ts',
        name: 'expected',
        metadata: { kind: 'function' },
      });

      // Add module for different file (should be excluded)
      graph.addNode({
        id: 'MODULE:src/other.ts#unexpected',
        type: NodeType.MODULE,
        path: 'src/other.ts',
        name: 'unexpected',
        metadata: { kind: 'function' },
      });

      const result = extractExports(graph, fileNode);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], 'function:expected');
    });
  });
});

describe('extractImportedBy Unit Tests', () => {
  let graph: CodeGraph;

  beforeEach(() => {
    graph = new CodeGraph();
  });

  describe('Input Validation', () => {
    it('should return empty array for null fileNode', () => {
      const result = extractImportedBy(graph, null as unknown as GraphNode);
      assert.deepStrictEqual(result, []);
    });

    it('should return empty array for node with no inEdges', () => {
      const fileNode: GraphNode = {
        id: 'FILE:src/isolated.ts',
        type: NodeType.FILE,
        path: 'src/isolated.ts',
        name: 'isolated.ts',
      };
      graph.addNode(fileNode);

      const result = extractImportedBy(graph, fileNode);
      assert.deepStrictEqual(result, []);
    });
  });

  describe('ImportedBy Extraction', () => {
    it('should extract single IMPORTS reverse dependency', () => {
      const targetFile: GraphNode = {
        id: 'FILE:src/utils.ts',
        type: NodeType.FILE,
        path: 'src/utils.ts',
        name: 'utils.ts',
      };
      graph.addNode(targetFile);

      const sourceFile: GraphNode = {
        id: 'FILE:src/main.ts',
        type: NodeType.FILE,
        path: 'src/main.ts',
        name: 'main.ts',
      };
      graph.addNode(sourceFile);

      graph.addEdge({
        from: 'FILE:src/main.ts',
        to: 'FILE:src/utils.ts',
        type: EdgeType.IMPORTS,
      });

      const result = extractImportedBy(graph, targetFile);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], 'src/main.ts');
    });

    it('should extract multiple IMPORTS reverse dependencies sorted', () => {
      const targetFile: GraphNode = {
        id: 'FILE:src/shared.ts',
        type: NodeType.FILE,
        path: 'src/shared.ts',
        name: 'shared.ts',
      };
      graph.addNode(targetFile);

      // Add sources in unsorted order
      const sources = ['src/z.ts', 'src/a.ts', 'src/m.ts'];
      for (const src of sources) {
        graph.addNode({
          id: `FILE:${src}`,
          type: NodeType.FILE,
          path: src,
          name: src.split('/').pop()!,
        });
        graph.addEdge({
          from: `FILE:${src}`,
          to: 'FILE:src/shared.ts',
          type: EdgeType.IMPORTS,
        });
      }

      const result = extractImportedBy(graph, targetFile);

      assert.strictEqual(result.length, 3);
      // Should be sorted alphabetically
      assert.strictEqual(result[0], 'src/a.ts');
      assert.strictEqual(result[1], 'src/m.ts');
      assert.strictEqual(result[2], 'src/z.ts');
    });

    it('should deduplicate multiple edges from same source', () => {
      const targetFile: GraphNode = {
        id: 'FILE:src/utils.ts',
        type: NodeType.FILE,
        path: 'src/utils.ts',
        name: 'utils.ts',
      };
      graph.addNode(targetFile);

      const sourceFile: GraphNode = {
        id: 'FILE:src/main.ts',
        type: NodeType.FILE,
        path: 'src/main.ts',
        name: 'main.ts',
      };
      graph.addNode(sourceFile);

      // Add multiple IMPORTS edges from same source (A4: edge count vs unique files)
      graph.addEdge({
        from: 'FILE:src/main.ts',
        to: 'FILE:src/utils.ts',
        type: EdgeType.IMPORTS,
        metadata: { importSpecifier: 'named:funcA' },
      });
      graph.addEdge({
        from: 'FILE:src/main.ts',
        to: 'FILE:src/utils.ts',
        type: EdgeType.IMPORTS,
        metadata: { importSpecifier: 'named:funcB' },
      });

      const result = extractImportedBy(graph, targetFile);

      // Should deduplicate to one source file
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], 'src/main.ts');
    });
  });

  describe('Edge Type Handling', () => {
    it('should include RE_EXPORTS as reverse dependency', () => {
      const targetFile: GraphNode = {
        id: 'FILE:src/types.ts',
        type: NodeType.FILE,
        path: 'src/types.ts',
        name: 'types.ts',
      };
      graph.addNode(targetFile);

      const reexportFile: GraphNode = {
        id: 'FILE:src/index.ts',
        type: NodeType.FILE,
        path: 'src/index.ts',
        name: 'index.ts',
      };
      graph.addNode(reexportFile);

      graph.addEdge({
        from: 'FILE:src/index.ts',
        to: 'FILE:src/types.ts',
        type: EdgeType.RE_EXPORTS,
      });

      const result = extractImportedBy(graph, targetFile);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], 'src/index.ts');
    });

    it('should NOT include DYNAMIC_IMPORTS (A2 resolution)', () => {
      const targetFile: GraphNode = {
        id: 'FILE:src/utils.ts',
        type: NodeType.FILE,
        path: 'src/utils.ts',
        name: 'utils.ts',
      };
      graph.addNode(targetFile);

      const staticSource: GraphNode = {
        id: 'FILE:src/static.ts',
        type: NodeType.FILE,
        path: 'src/static.ts',
        name: 'static.ts',
      };
      graph.addNode(staticSource);

      const dynamicSource: GraphNode = {
        id: 'FILE:src/dynamic.ts',
        type: NodeType.FILE,
        path: 'src/dynamic.ts',
        name: 'dynamic.ts',
      };
      graph.addNode(dynamicSource);

      // Static import - should be included
      graph.addEdge({
        from: 'FILE:src/static.ts',
        to: 'FILE:src/utils.ts',
        type: EdgeType.IMPORTS,
      });

      // Dynamic import - should NOT be included (A2 resolution)
      graph.addEdge({
        from: 'FILE:src/dynamic.ts',
        to: 'FILE:src/utils.ts',
        type: EdgeType.DYNAMIC_IMPORTS,
      });

      const result = extractImportedBy(graph, targetFile);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], 'src/static.ts');
    });
  });

  describe('EXTERNAL Reference Handling', () => {
    it('should handle EXTERNAL node as target correctly', () => {
      const externalNode: GraphNode = {
        id: 'EXTERNAL:lodash',
        type: NodeType.EXTERNAL,
        path: 'lodash',
        name: 'lodash',
      };
      graph.addNode(externalNode);

      const sourceFile: GraphNode = {
        id: 'FILE:src/main.ts',
        type: NodeType.FILE,
        path: 'src/main.ts',
        name: 'main.ts',
      };
      graph.addNode(sourceFile);

      graph.addEdge({
        from: 'FILE:src/main.ts',
        to: 'EXTERNAL:lodash',
        type: EdgeType.IMPORTS,
      });

      const result = extractImportedBy(graph, externalNode);

      // EXTERNAL nodes can have reverse dependencies
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], 'src/main.ts');
    });

    it('should NOT include non-FILE source nodes', () => {
      const targetFile: GraphNode = {
        id: 'FILE:src/utils.ts',
        type: NodeType.FILE,
        path: 'src/utils.ts',
        name: 'utils.ts',
      };
      graph.addNode(targetFile);

      const externalSource: GraphNode = {
        id: 'EXTERNAL:package',
        type: NodeType.EXTERNAL,
        path: 'package',
        name: 'package',
      };
      graph.addNode(externalSource);

      // Edge from EXTERNAL to FILE (unusual but valid edge)
      graph.addEdge({
        from: 'EXTERNAL:package',
        to: 'FILE:src/utils.ts',
        type: EdgeType.IMPORTS,
      });

      const result = extractImportedBy(graph, targetFile);

      // Should NOT include non-FILE source
      assert.strictEqual(result.length, 0);
    });
  });
});