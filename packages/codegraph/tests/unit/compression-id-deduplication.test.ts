/**
 * Unit tests for id-deduplication module (Tasks 2.3-2.5)
 *
 * Tests ID removal from nodes and reconstruction from pathIndex.
 * Run with: pnpm test tests/unit/compression-id-deduplication.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  removeIds,
  reconstructNodeId,
} from '../../src/persistence/compression/id-deduplication.js';
import type { GraphNode, PathTable, CompressedNode } from '../../src/types.js';
import { NodeType } from '../../src/types.js';

// ============================================================================
// Task 2.4: removeIds - remove ID fields from nodes
// ============================================================================
describe('removeIds (Task 2.4)', () => {
  it('should remove id field from FILE node', () => {
    const nodes: GraphNode[] = [
      { id: 'FILE:src/a.ts', type: NodeType.FILE, path: 'src/a.ts', name: 'a.ts' },
    ];
    const pathTable: PathTable = ['src/a.ts'];

    const compressed = removeIds(nodes, pathTable);

    assert.strictEqual(compressed.length, 1);
    assert.strictEqual(compressed[0].type, NodeType.FILE);
    assert.strictEqual(compressed[0].pathIndex, 0);
    assert.strictEqual(compressed[0].name, 'a.ts');
    // No id field in CompressedNode
    assert.ok(!('id' in compressed[0]));
  });

  it('should remove id field from DIRECTORY node', () => {
    const nodes: GraphNode[] = [
      { id: 'DIRECTORY:src', type: NodeType.DIRECTORY, path: 'src', name: 'src' },
    ];
    const pathTable: PathTable = ['src'];

    const compressed = removeIds(nodes, pathTable);

    assert.strictEqual(compressed[0].type, NodeType.DIRECTORY);
    assert.strictEqual(compressed[0].pathIndex, 0);
    assert.strictEqual(compressed[0].name, 'src');
  });

  it('should remove id field from MODULE node with name', () => {
    const nodes: GraphNode[] = [
      { id: 'MODULE:src/utils.ts#formatDate', type: NodeType.MODULE, path: 'src/utils.ts', name: 'formatDate' },
    ];
    const pathTable: PathTable = ['src/utils.ts'];

    const compressed = removeIds(nodes, pathTable);

    assert.strictEqual(compressed[0].type, NodeType.MODULE);
    assert.strictEqual(compressed[0].pathIndex, 0);
    assert.strictEqual(compressed[0].name, 'formatDate');
  });

  it('should remove id field from EXTERNAL node', () => {
    const nodes: GraphNode[] = [
      { id: 'EXTERNAL:react', type: NodeType.EXTERNAL, path: 'react', name: 'react' },
    ];
    const pathTable: PathTable = ['react'];

    const compressed = removeIds(nodes, pathTable);

    assert.strictEqual(compressed[0].type, NodeType.EXTERNAL);
    assert.strictEqual(compressed[0].pathIndex, 0);
    assert.strictEqual(compressed[0].name, 'react');
  });

  it('should preserve metadata from MODULE nodes', () => {
    const nodes: GraphNode[] = [
      {
        id: 'MODULE:src/utils.ts#formatDate',
        type: NodeType.MODULE,
        path: 'src/utils.ts',
        name: 'formatDate',
        metadata: {
          kind: 'function',
          isExported: true,
          jsDoc: 'Format date utility',
          hasJSDoc: true,
        },
      },
    ];
    const pathTable: PathTable = ['src/utils.ts'];

    const compressed = removeIds(nodes, pathTable);

    assert.ok(compressed[0].metadata);
    assert.strictEqual(compressed[0].metadata?.kind, 'function');
    assert.strictEqual(compressed[0].metadata?.isExported, true);
    assert.strictEqual(compressed[0].metadata?.jsDoc, 'Format date utility');
    assert.strictEqual(compressed[0].metadata?.hasJSDoc, true);
  });

  it('should handle multiple nodes', () => {
    const nodes: GraphNode[] = [
      { id: 'FILE:src/a.ts', type: NodeType.FILE, path: 'src/a.ts', name: 'a.ts' },
      { id: 'FILE:src/b.ts', type: NodeType.FILE, path: 'src/b.ts', name: 'b.ts' },
      { id: 'MODULE:src/a.ts#func', type: NodeType.MODULE, path: 'src/a.ts', name: 'func' },
    ];
    const pathTable: PathTable = ['src/a.ts', 'src/b.ts'];

    const compressed = removeIds(nodes, pathTable);

    assert.strictEqual(compressed.length, 3);
    assert.strictEqual(compressed[0].pathIndex, 0);
    assert.strictEqual(compressed[1].pathIndex, 1);
    assert.strictEqual(compressed[2].pathIndex, 0); // MODULE uses same path as FILE a.ts
  });

  it('should handle empty nodes array', () => {
    const compressed = removeIds([], []);

    assert.strictEqual(compressed.length, 0);
  });

  it('should resolve pathIndex correctly for each node', () => {
    const nodes: GraphNode[] = [
      { id: 'FILE:src/utils.ts', type: NodeType.FILE, path: 'src/utils.ts', name: 'utils.ts' },
      { id: 'FILE:src/analyzer.ts', type: NodeType.FILE, path: 'src/analyzer.ts', name: 'analyzer.ts' },
    ];
    const pathTable: PathTable = ['src/utils.ts', 'src/analyzer.ts'];

    const compressed = removeIds(nodes, pathTable);

    assert.strictEqual(compressed[0].pathIndex, 0);
    assert.strictEqual(compressed[1].pathIndex, 1);
  });
});

// ============================================================================
// Task 2.5: reconstructNodeId - reconstruct ID from type and pathIndex
// ============================================================================
describe('reconstructNodeId (Task 2.5)', () => {
  it('should reconstruct FILE node ID', () => {
    const pathTable: PathTable = ['src/a.ts', 'src/b.ts'];

    const id = reconstructNodeId(NodeType.FILE, 0, pathTable);

    assert.strictEqual(id, 'FILE:src/a.ts');
  });

  it('should reconstruct DIRECTORY node ID', () => {
    const pathTable: PathTable = ['src', 'lib'];

    const id = reconstructNodeId(NodeType.DIRECTORY, 0, pathTable);

    assert.strictEqual(id, 'DIRECTORY:src');
  });

  it('should reconstruct EXTERNAL node ID', () => {
    const pathTable: PathTable = ['react', 'lodash'];

    const id = reconstructNodeId(NodeType.EXTERNAL, 0, pathTable);

    assert.strictEqual(id, 'EXTERNAL:react');
  });

  it('should reconstruct MODULE node ID with name', () => {
    const pathTable: PathTable = ['src/utils.ts'];

    const id = reconstructNodeId(NodeType.MODULE, 0, pathTable, 'formatDate');

    assert.strictEqual(id, 'MODULE:src/utils.ts#formatDate');
  });

  it('should handle MODULE without name (edge case)', () => {
    const pathTable: PathTable = ['src/utils.ts'];

    // MODULE nodes should always have a name, but test edge case
    const id = reconstructNodeId(NodeType.MODULE, 0, pathTable);

    // Without name, should still construct valid format (though semantically incomplete)
    assert.strictEqual(id, 'MODULE:src/utils.ts#');
  });

  it('should handle large pathTable indexes', () => {
    const pathTable: PathTable = Array.from({ length: 100 }, (_, i) => `src/file${i}.ts`);

    const id = reconstructNodeId(NodeType.FILE, 50, pathTable);

    assert.strictEqual(id, 'FILE:src/file50.ts');
  });

  it('should return correct ID for last element in pathTable', () => {
    const pathTable: PathTable = ['src/a.ts', 'src/b.ts', 'src/c.ts'];

    const id = reconstructNodeId(NodeType.FILE, 2, pathTable);

    assert.strictEqual(id, 'FILE:src/c.ts');
  });
});

// ============================================================================
// Round-trip: removeIds → reconstructNodeId
// ============================================================================
describe('ID round-trip (removeIds → reconstructNodeId)', () => {
  it('should reconstruct same ID after removal for FILE', () => {
    const nodes: GraphNode[] = [
      { id: 'FILE:src/a.ts', type: NodeType.FILE, path: 'src/a.ts', name: 'a.ts' },
    ];
    const pathTable: PathTable = ['src/a.ts'];

    const compressed = removeIds(nodes, pathTable);
    const reconstructedId = reconstructNodeId(
      compressed[0].type,
      compressed[0].pathIndex,
      pathTable,
      compressed[0].name
    );

    assert.strictEqual(reconstructedId, nodes[0].id);
  });

  it('should reconstruct same ID after removal for MODULE', () => {
    const nodes: GraphNode[] = [
      { id: 'MODULE:src/utils.ts#formatDate', type: NodeType.MODULE, path: 'src/utils.ts', name: 'formatDate' },
    ];
    const pathTable: PathTable = ['src/utils.ts'];

    const compressed = removeIds(nodes, pathTable);
    const reconstructedId = reconstructNodeId(
      compressed[0].type,
      compressed[0].pathIndex,
      pathTable,
      compressed[0].name
    );

    assert.strictEqual(reconstructedId, nodes[0].id);
  });

  it('should reconstruct same IDs for multiple nodes', () => {
    const nodes: GraphNode[] = [
      { id: 'FILE:src/a.ts', type: NodeType.FILE, path: 'src/a.ts', name: 'a.ts' },
      { id: 'MODULE:src/a.ts#func', type: NodeType.MODULE, path: 'src/a.ts', name: 'func' },
      { id: 'EXTERNAL:react', type: NodeType.EXTERNAL, path: 'react', name: 'react' },
    ];
    const pathTable: PathTable = ['src/a.ts', 'react'];

    const compressed = removeIds(nodes, pathTable);

    for (let i = 0; i < nodes.length; i++) {
      const reconstructedId = reconstructNodeId(
        compressed[i].type,
        compressed[i].pathIndex,
        pathTable,
        compressed[i].name
      );
      assert.strictEqual(reconstructedId, nodes[i].id);
    }
  });
});

// ============================================================================
// Edge cases
// ============================================================================
describe('ID deduplication edge cases', () => {
  it('should handle nodes with same path (FILE and MODULE)', () => {
    const nodes: GraphNode[] = [
      { id: 'FILE:src/utils.ts', type: NodeType.FILE, path: 'src/utils.ts', name: 'utils.ts' },
      { id: 'MODULE:src/utils.ts#func1', type: NodeType.MODULE, path: 'src/utils.ts', name: 'func1' },
      { id: 'MODULE:src/utils.ts#func2', type: NodeType.MODULE, path: 'src/utils.ts', name: 'func2' },
    ];
    const pathTable: PathTable = ['src/utils.ts'];

    const compressed = removeIds(nodes, pathTable);

    // All nodes should have pathIndex 0 (same path)
    assert.strictEqual(compressed[0].pathIndex, 0);
    assert.strictEqual(compressed[1].pathIndex, 0);
    assert.strictEqual(compressed[2].pathIndex, 0);

    // But different names for MODULEs
    assert.strictEqual(compressed[0].name, 'utils.ts');
    assert.strictEqual(compressed[1].name, 'func1');
    assert.strictEqual(compressed[2].name, 'func2');
  });

  it('should handle MODULE metadata with undefined values', () => {
    const nodes: GraphNode[] = [
      {
        id: 'MODULE:src/a.ts#func',
        type: NodeType.MODULE,
        path: 'src/a.ts',
        name: 'func',
        metadata: {
          kind: undefined,
          isExported: undefined,
        },
      },
    ];
    const pathTable: PathTable = ['src/a.ts'];

    const compressed = removeIds(nodes, pathTable);

    assert.ok(compressed[0].metadata);
    assert.strictEqual(compressed[0].metadata?.kind, undefined);
    assert.strictEqual(compressed[0].metadata?.isExported, undefined);
  });

  it('should handle MODULE without metadata', () => {
    const nodes: GraphNode[] = [
      { id: 'MODULE:src/a.ts#func', type: NodeType.MODULE, path: 'src/a.ts', name: 'func' },
    ];
    const pathTable: PathTable = ['src/a.ts'];

    const compressed = removeIds(nodes, pathTable);

    assert.strictEqual(compressed[0].metadata, undefined);
  });
});