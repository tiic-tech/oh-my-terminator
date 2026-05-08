/**
 * Unit tests for path-table module (Tasks 2.8-2.11)
 *
 * Tests path table building, resolution, and sorting by reference count.
 * Run with: pnpm test tests/unit/compression-path-table.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPathTable,
  resolvePathIndex,
  resolvePathFromIndex,
} from '../../src/persistence/compression/path-table.js';
import type { GraphNode, GraphEdge, PathTable } from '../../src/types.js';
import { NodeType, EdgeType } from '../../src/types.js';
import { IndexOutOfBoundsError } from '../../src/persistence/compression/errors.js';

// ============================================================================
// Task 2.9: buildPathTable - builds path table sorted by reference count
// ============================================================================
describe('buildPathTable (Task 2.9)', () => {
  it('should build path table from nodes and edges', () => {
    const nodes: GraphNode[] = [
      { id: 'FILE:src/a.ts', type: NodeType.FILE, path: 'src/a.ts', name: 'a.ts' },
      { id: 'FILE:src/b.ts', type: NodeType.FILE, path: 'src/b.ts', name: 'b.ts' },
      { id: 'EXTERNAL:react', type: NodeType.EXTERNAL, path: 'react', name: 'react' },
    ];
    const edges: GraphEdge[] = [
      { from: 'FILE:src/a.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
      { from: 'FILE:src/b.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
    ];

    const pathTable = buildPathTable(nodes, edges);

    assert.ok(Array.isArray(pathTable));
    assert.ok(pathTable.includes('src/a.ts'));
    assert.ok(pathTable.includes('src/b.ts'));
    assert.ok(pathTable.includes('react'));
  });

  it('should sort by reference count (most referenced first)', () => {
    const nodes: GraphNode[] = [
      { id: 'FILE:src/a.ts', type: NodeType.FILE, path: 'src/a.ts', name: 'a.ts' },
      { id: 'FILE:src/b.ts', type: NodeType.FILE, path: 'src/b.ts', name: 'b.ts' },
      { id: 'FILE:src/c.ts', type: NodeType.FILE, path: 'src/c.ts', name: 'c.ts' },
      { id: 'EXTERNAL:react', type: NodeType.EXTERNAL, path: 'react', name: 'react' },
    ];
    // 'react' is referenced 3 times (most frequent)
    const edges: GraphEdge[] = [
      { from: 'FILE:src/a.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
      { from: 'FILE:src/b.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
      { from: 'FILE:src/c.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
    ];

    const pathTable = buildPathTable(nodes, edges);

    // 'react' should have smallest index (most referenced)
    const reactIndex = pathTable.indexOf('react');
    assert.strictEqual(reactIndex, 0, 'react should be first (most referenced)');
  });

  it('should count both node and edge references', () => {
    const nodes: GraphNode[] = [
      { id: 'FILE:src/a.ts', type: NodeType.FILE, path: 'src/a.ts', name: 'a.ts' },
      { id: 'MODULE:src/a.ts#func', type: NodeType.MODULE, path: 'src/a.ts', name: 'func' },
      { id: 'EXTERNAL:lodash', type: NodeType.EXTERNAL, path: 'lodash', name: 'lodash' },
    ];
    const edges: GraphEdge[] = [
      { from: 'FILE:src/a.ts', to: 'EXTERNAL:lodash', type: EdgeType.IMPORTS },
    ];

    const pathTable = buildPathTable(nodes, edges);

    // 'src/a.ts' has 2 node references + 1 edge reference = 3 total
    // 'lodash' has 1 node reference + 1 edge reference = 2 total
    const srcAIndex = pathTable.indexOf('src/a.ts');
    const lodashIndex = pathTable.indexOf('lodash');

    assert.ok(srcAIndex < lodashIndex, 'src/a.ts should have smaller index (more references)');
  });

  it('should handle empty nodes and edges', () => {
    const pathTable = buildPathTable([], []);

    assert.strictEqual(pathTable.length, 0);
  });

  it('should deduplicate paths', () => {
    const nodes: GraphNode[] = [
      { id: 'FILE:src/a.ts', type: NodeType.FILE, path: 'src/a.ts', name: 'a.ts' },
      { id: 'MODULE:src/a.ts#func1', type: NodeType.MODULE, path: 'src/a.ts', name: 'func1' },
      { id: 'MODULE:src/a.ts#func2', type: NodeType.MODULE, path: 'src/a.ts', name: 'func2' },
    ];
    const edges: GraphEdge[] = [];

    const pathTable = buildPathTable(nodes, edges);

    // 'src/a.ts' should appear only once
    assert.strictEqual(pathTable.filter(p => p === 'src/a.ts').length, 1);
  });

  it('should handle DIRECTORY nodes', () => {
    const nodes: GraphNode[] = [
      { id: 'DIRECTORY:src', type: NodeType.DIRECTORY, path: 'src', name: 'src' },
      { id: 'FILE:src/a.ts', type: NodeType.FILE, path: 'src/a.ts', name: 'a.ts' },
    ];
    const edges: GraphEdge[] = [
      { from: 'DIRECTORY:src', to: 'FILE:src/a.ts', type: EdgeType.CONTAINS },
    ];

    const pathTable = buildPathTable(nodes, edges);

    assert.ok(pathTable.includes('src'));
    assert.ok(pathTable.includes('src/a.ts'));
  });

  it('should handle MODULE nodes with same path as FILE', () => {
    const nodes: GraphNode[] = [
      { id: 'FILE:src/utils.ts', type: NodeType.FILE, path: 'src/utils.ts', name: 'utils.ts' },
      { id: 'MODULE:src/utils.ts#formatDate', type: NodeType.MODULE, path: 'src/utils.ts', name: 'formatDate' },
    ];
    const edges: GraphEdge[] = [
      { from: 'FILE:src/utils.ts', to: 'MODULE:src/utils.ts#formatDate', type: EdgeType.CONTAINS },
    ];

    const pathTable = buildPathTable(nodes, edges);

    // Path 'src/utils.ts' should be deduplicated (appears in FILE and MODULE)
    assert.strictEqual(pathTable.filter(p => p === 'src/utils.ts').length, 1);
  });
});

// ============================================================================
// Task 2.10: resolvePathIndex - get index for a path
// ============================================================================
describe('resolvePathIndex (Task 2.10)', () => {
  it('should return index for existing path', () => {
    const pathTable: PathTable = ['react', 'src/a.ts', 'src/b.ts'];

    const index = resolvePathIndex('react', pathTable);

    assert.strictEqual(index, 0);
    assert.strictEqual(resolvePathIndex('src/a.ts', pathTable), 1);
    assert.strictEqual(resolvePathIndex('src/b.ts', pathTable), 2);
  });

  it('should return -1 for non-existent path', () => {
    const pathTable: PathTable = ['src/a.ts', 'src/b.ts'];

    const index = resolvePathIndex('non-existent.ts', pathTable);

    assert.strictEqual(index, -1);
  });

  it('should handle empty path table', () => {
    const pathTable: PathTable = [];

    const index = resolvePathIndex('any/path.ts', pathTable);

    assert.strictEqual(index, -1);
  });

  it('should handle exact string matching', () => {
    const pathTable: PathTable = ['src/a.ts', 'src/a.ts.backup'];

    // Should not match partial strings
    const index = resolvePathIndex('src/a.ts', pathTable);

    assert.strictEqual(index, 0);
    assert.strictEqual(resolvePathIndex('src/a.ts.backup', pathTable), 1);
  });
});

// ============================================================================
// Task 2.11: resolvePathFromIndex - get path from index
// ============================================================================
describe('resolvePathFromIndex (Task 2.11)', () => {
  it('should return path for valid index', () => {
    const pathTable: PathTable = ['react', 'src/a.ts', 'src/b.ts'];

    assert.strictEqual(resolvePathFromIndex(0, pathTable), 'react');
    assert.strictEqual(resolvePathFromIndex(1, pathTable), 'src/a.ts');
    assert.strictEqual(resolvePathFromIndex(2, pathTable), 'src/b.ts');
  });

  it('should throw IndexOutOfBoundsError for invalid index', () => {
    const pathTable: PathTable = ['src/a.ts', 'src/b.ts'];

    assert.throws(
      () => resolvePathFromIndex(100, pathTable),
      IndexOutOfBoundsError
    );
  });

  it('should throw IndexOutOfBoundsError for negative index', () => {
    const pathTable: PathTable = ['src/a.ts'];

    assert.throws(
      () => resolvePathFromIndex(-1, pathTable),
      IndexOutOfBoundsError
    );
  });

  it('should throw IndexOutOfBoundsError for empty path table', () => {
    const pathTable: PathTable = [];

    assert.throws(
      () => resolvePathFromIndex(0, pathTable),
      IndexOutOfBoundsError
    );
  });

  it('should include index and maxIndex in error details', () => {
    const pathTable: PathTable = ['src/a.ts', 'src/b.ts'];

    try {
      resolvePathFromIndex(100, pathTable);
      assert.fail('Should have thrown');
    } catch (error) {
      assert.ok(error instanceof IndexOutOfBoundsError);
      assert.strictEqual(error.index, 100);
      assert.strictEqual(error.maxIndex, 1);
    }
  });
});

// ============================================================================
// Edge cases and integration scenarios
// ============================================================================
describe('Path table edge cases', () => {
  it('should handle large path tables', () => {
    const nodes: GraphNode[] = Array.from({ length: 100 }, (_, i) => ({
      id: `FILE:src/file${i}.ts`,
      type: NodeType.FILE,
      path: `src/file${i}.ts`,
      name: `file${i}.ts`,
    }));

    const pathTable = buildPathTable(nodes, []);

    assert.strictEqual(pathTable.length, 100);
    // Verify sorting - single reference each, order stable
    assert.ok(pathTable.includes('src/file0.ts'));
    assert.ok(pathTable.includes('src/file99.ts'));
  });

  it('should handle paths with special characters', () => {
    const nodes: GraphNode[] = [
      { id: 'FILE:src/[test].ts', type: NodeType.FILE, path: 'src/[test].ts', name: '[test].ts' },
      { id: 'FILE:src/test-file.ts', type: NodeType.FILE, path: 'src/test-file.ts', name: 'test-file.ts' },
    ];

    const pathTable = buildPathTable(nodes, []);

    assert.ok(pathTable.includes('src/[test].ts'));
    assert.ok(pathTable.includes('src/test-file.ts'));
  });

  it('should maintain reference count accuracy for complex graphs', () => {
    // Create a graph where 'node_modules/common' is referenced many times
    const nodes: GraphNode[] = [
      { id: 'FILE:src/a.ts', type: NodeType.FILE, path: 'src/a.ts', name: 'a.ts' },
      { id: 'FILE:src/b.ts', type: NodeType.FILE, path: 'src/b.ts', name: 'b.ts' },
      { id: 'FILE:src/c.ts', type: NodeType.FILE, path: 'src/c.ts', name: 'c.ts' },
      { id: 'EXTERNAL:common', type: NodeType.EXTERNAL, path: 'common', name: 'common' },
      { id: 'EXTERNAL:unique', type: NodeType.EXTERNAL, path: 'unique', name: 'unique' },
    ];
    const edges: GraphEdge[] = [
      { from: 'FILE:src/a.ts', to: 'EXTERNAL:common', type: EdgeType.IMPORTS },
      { from: 'FILE:src/b.ts', to: 'EXTERNAL:common', type: EdgeType.IMPORTS },
      { from: 'FILE:src/c.ts', to: 'EXTERNAL:common', type: EdgeType.IMPORTS },
      { from: 'FILE:src/a.ts', to: 'EXTERNAL:unique', type: EdgeType.IMPORTS },
    ];

    const pathTable = buildPathTable(nodes, edges);

    // 'common' has: 1 node + 3 edges = 4 references
    // 'src/a.ts' has: 1 node + 2 edges (as from) = 3 references
    // 'unique' has: 1 node + 1 edge = 2 references
    const commonIndex = pathTable.indexOf('common');
    const srcAIndex = pathTable.indexOf('src/a.ts');
    const uniqueIndex = pathTable.indexOf('unique');

    assert.ok(commonIndex < srcAIndex, 'common should come before src/a.ts');
    assert.ok(srcAIndex < uniqueIndex, 'src/a.ts should come before unique');
  });
});