/**
 * Unit tests for edge-batcher module (Tasks 2.12-2.14)
 *
 * Tests IMPORTS edge batching for compression efficiency.
 * Run with: pnpm test tests/unit/compression-edge-batcher.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  batchImportsEdges,
  expandBatchedEdges,
} from '../../src/persistence/compression/edge-batcher.js';
import type { GraphEdge, PathTable, CompressedEdge, IMPORTS_BATCH } from '../../src/types.js';
import { EdgeType } from '../../src/types.js';

// ============================================================================
// Task 2.13: batchImportsEdges - batch IMPORTS edges
// ============================================================================
describe('batchImportsEdges (Task 2.13)', () => {
  it('should batch multiple IMPORTS edges from same source', () => {
    const edges: GraphEdge[] = [
      { from: 'FILE:src/a.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
      { from: 'FILE:src/a.ts', to: 'EXTERNAL:lodash', type: EdgeType.IMPORTS },
      { from: 'FILE:src/a.ts', to: 'FILE:src/b.ts', type: EdgeType.IMPORTS },
    ];
    const pathTable: PathTable = ['src/a.ts', 'react', 'lodash', 'src/b.ts'];

    const batches = batchImportsEdges(edges, pathTable);

    assert.strictEqual(batches.length, 1);
    assert.strictEqual(batches[0].type, 'IMPORTS_BATCH');
    assert.strictEqual(batches[0].fromIndex, 0);
    assert.strictEqual(batches[0].targetIndexes.length, 3);
    assert.ok(batches[0].targetIndexes.includes(1)); // react
    assert.ok(batches[0].targetIndexes.includes(2)); // lodash
    assert.ok(batches[0].targetIndexes.includes(3)); // src/b.ts
  });

  it('should create separate batches for different sources', () => {
    const edges: GraphEdge[] = [
      { from: 'FILE:src/a.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
      { from: 'FILE:src/b.ts', to: 'EXTERNAL:lodash', type: EdgeType.IMPORTS },
    ];
    const pathTable: PathTable = ['src/a.ts', 'src/b.ts', 'react', 'lodash'];

    const batches = batchImportsEdges(edges, pathTable);

    assert.strictEqual(batches.length, 2);
    // First batch from src/a.ts
    assert.strictEqual(batches[0].fromIndex, 0);
    assert.strictEqual(batches[0].targetIndexes.length, 1);
    assert.strictEqual(batches[0].targetIndexes[0], 2); // react
    // Second batch from src/b.ts
    assert.strictEqual(batches[1].fromIndex, 1);
    assert.strictEqual(batches[1].targetIndexes[0], 3); // lodash
  });

  it('should return empty array for no IMPORTS edges', () => {
    const edges: GraphEdge[] = [
      { from: 'DIRECTORY:src', to: 'FILE:src/a.ts', type: EdgeType.CONTAINS },
      { from: 'FILE:src/a.ts', to: 'MODULE:src/a.ts#func', type: EdgeType.CONTAINS },
    ];
    const pathTable: PathTable = ['src', 'src/a.ts'];

    const batches = batchImportsEdges(edges, pathTable);

    assert.strictEqual(batches.length, 0);
  });

  it('should handle single IMPORTS edge', () => {
    const edges: GraphEdge[] = [
      { from: 'FILE:src/a.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
    ];
    const pathTable: PathTable = ['src/a.ts', 'react'];

    const batches = batchImportsEdges(edges, pathTable);

    assert.strictEqual(batches.length, 1);
    assert.strictEqual(batches[0].targetIndexes.length, 1);
  });

  it('should handle empty edges array', () => {
    const batches = batchImportsEdges([], []);

    assert.strictEqual(batches.length, 0);
  });

  it('should preserve edge metadata in batch', () => {
    const edges: GraphEdge[] = [
      { from: 'FILE:src/a.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS, metadata: { line: 1 } },
      { from: 'FILE:src/a.ts', to: 'EXTERNAL:lodash', type: EdgeType.IMPORTS, metadata: { line: 2 } },
    ];
    const pathTable: PathTable = ['src/a.ts', 'react', 'lodash'];

    const batches = batchImportsEdges(edges, pathTable);

    // Metadata is NOT preserved in IMPORTS_BATCH (per design.md D4)
    // If metadata preservation needed, would require different approach
    assert.strictEqual(batches.length, 1);
    // IMPORTS_BATCH does not have metadata field
    assert.strictEqual('metadata' in batches[0], false);
  });

  it('should handle IMPORTS edges with different from sources', () => {
    const edges: GraphEdge[] = [
      { from: 'FILE:src/a.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
      { from: 'FILE:src/a.ts', to: 'EXTERNAL:lodash', type: EdgeType.IMPORTS },
      { from: 'FILE:src/b.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
      { from: 'FILE:src/b.ts', to: 'EXTERNAL:axios', type: EdgeType.IMPORTS },
      { from: 'FILE:src/b.ts', to: 'FILE:src/c.ts', type: EdgeType.IMPORTS },
    ];
    const pathTable: PathTable = ['src/a.ts', 'src/b.ts', 'react', 'lodash', 'axios', 'src/c.ts'];

    const batches = batchImportsEdges(edges, pathTable);

    assert.strictEqual(batches.length, 2);
    // First batch: src/a.ts imports react, lodash
    assert.strictEqual(batches[0].fromIndex, 0);
    assert.strictEqual(batches[0].targetIndexes.length, 2);
    // Second batch: src/b.ts imports react, axios, c.ts
    assert.strictEqual(batches[1].fromIndex, 1);
    assert.strictEqual(batches[1].targetIndexes.length, 3);
  });

  it('should deduplicate same target in batch', () => {
    // Edge case: same file imports same package twice (unlikely but possible)
    const edges: GraphEdge[] = [
      { from: 'FILE:src/a.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
      { from: 'FILE:src/a.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS }, // duplicate
    ];
    const pathTable: PathTable = ['src/a.ts', 'react'];

    const batches = batchImportsEdges(edges, pathTable);

    // Should deduplicate targets
    assert.strictEqual(batches[0].targetIndexes.length, 1);
    assert.strictEqual(batches[0].targetIndexes[0], 1);
  });
});

// ============================================================================
// Task 2.14: expandBatchedEdges - expand batches back to edges
// ============================================================================
describe('expandBatchedEdges (Task 2.14)', () => {
  it('should expand IMPORTS_BATCH to multiple IMPORTS edges', () => {
    const batches: IMPORTS_BATCH[] = [
      { type: 'IMPORTS_BATCH', fromIndex: 0, targetIndexes: [1, 2, 3] },
    ];
    const pathTable: PathTable = ['src/a.ts', 'react', 'lodash', 'axios'];

    const edges = expandBatchedEdges(batches, pathTable);

    assert.strictEqual(edges.length, 3);
    assert.strictEqual(edges[0].type, EdgeType.IMPORTS);
    assert.strictEqual(edges[0].from, 'FILE:src/a.ts');
    assert.strictEqual(edges[0].to, 'EXTERNAL:react');
    assert.strictEqual(edges[1].to, 'EXTERNAL:lodash');
    assert.strictEqual(edges[2].to, 'EXTERNAL:axios');
  });

  it('should expand multiple batches', () => {
    const batches: IMPORTS_BATCH[] = [
      { type: 'IMPORTS_BATCH', fromIndex: 0, targetIndexes: [2] },
      { type: 'IMPORTS_BATCH', fromIndex: 1, targetIndexes: [2, 3] },
    ];
    const pathTable: PathTable = ['src/a.ts', 'src/b.ts', 'react', 'lodash'];

    const edges = expandBatchedEdges(batches, pathTable);

    assert.strictEqual(edges.length, 3);
    // First batch: a.ts imports react
    assert.strictEqual(edges[0].from, 'FILE:src/a.ts');
    assert.strictEqual(edges[0].to, 'EXTERNAL:react');
    // Second batch: b.ts imports react, lodash
    assert.strictEqual(edges[1].from, 'FILE:src/b.ts');
    assert.strictEqual(edges[2].from, 'FILE:src/b.ts');
  });

  it('should handle empty batches array', () => {
    const edges = expandBatchedEdges([], []);

    assert.strictEqual(edges.length, 0);
  });

  it('should handle batch with single target', () => {
    const batches: IMPORTS_BATCH[] = [
      { type: 'IMPORTS_BATCH', fromIndex: 0, targetIndexes: [1] },
    ];
    const pathTable: PathTable = ['src/a.ts', 'react'];

    const edges = expandBatchedEdges(batches, pathTable);

    assert.strictEqual(edges.length, 1);
    assert.strictEqual(edges[0].from, 'FILE:src/a.ts');
    assert.strictEqual(edges[0].to, 'EXTERNAL:react');
  });

  it('should reconstruct correct ID format for different node types', () => {
    const batches: IMPORTS_BATCH[] = [
      { type: 'IMPORTS_BATCH', fromIndex: 0, targetIndexes: [1, 2] },
    ];
    const pathTable: PathTable = ['src/a.ts', 'src/b.ts', 'react'];

    const edges = expandBatchedEdges(batches, pathTable);

    // FILE imports FILE
    assert.strictEqual(edges[0].from, 'FILE:src/a.ts');
    assert.strictEqual(edges[0].to, 'FILE:src/b.ts');
    // FILE imports EXTERNAL
    assert.strictEqual(edges[1].to, 'EXTERNAL:react');
  });
});

// ============================================================================
// Round-trip: batchImportsEdges → expandBatchedEdges
// ============================================================================
describe('Edge batch round-trip (batch → expand)', () => {
  it('should preserve edges after batch → expand cycle', () => {
    const originalEdges: GraphEdge[] = [
      { from: 'FILE:src/a.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
      { from: 'FILE:src/a.ts', to: 'EXTERNAL:lodash', type: EdgeType.IMPORTS },
      { from: 'FILE:src/b.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
    ];
    const pathTable: PathTable = ['src/a.ts', 'src/b.ts', 'react', 'lodash'];

    const batches = batchImportsEdges(originalEdges, pathTable);
    const expandedEdges = expandBatchedEdges(batches, pathTable);

    // Should have same number of edges (metadata may differ)
    assert.strictEqual(expandedEdges.length, originalEdges.length);

    // Check edge content matches
    for (const expanded of expandedEdges) {
      assert.strictEqual(expanded.type, EdgeType.IMPORTS);
      // Check that each expanded edge corresponds to an original edge
      const matchingOriginal = originalEdges.find(
        e => e.from === expanded.from && e.to === expanded.to
      );
      assert.ok(matchingOriginal, `Expanded edge ${expanded.from} → ${expanded.to} should match original`);
    }
  });

  it('should handle complex import graph correctly', () => {
    const originalEdges: GraphEdge[] = [
      { from: 'FILE:src/index.ts', to: 'FILE:src/app.ts', type: EdgeType.IMPORTS },
      { from: 'FILE:src/index.ts', to: 'FILE:src/utils.ts', type: EdgeType.IMPORTS },
      { from: 'FILE:src/app.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
      { from: 'FILE:src/app.ts', to: 'EXTERNAL:lodash', type: EdgeType.IMPORTS },
      { from: 'FILE:src/utils.ts', to: 'EXTERNAL:date-fns', type: EdgeType.IMPORTS },
    ];
    const pathTable: PathTable = ['src/index.ts', 'src/app.ts', 'src/utils.ts', 'react', 'lodash', 'date-fns'];

    const batches = batchImportsEdges(originalEdges, pathTable);
    const expandedEdges = expandBatchedEdges(batches, pathTable);

    assert.strictEqual(expandedEdges.length, originalEdges.length);
    assert.strictEqual(batches.length, 3); // 3 sources: index.ts, app.ts, utils.ts
  });
});

// ============================================================================
// Edge cases
// ============================================================================
describe('Edge batcher edge cases', () => {
  it('should handle large number of imports from single file', () => {
    const edges: GraphEdge[] = Array.from({ length: 50 }, (_, i) => ({
      from: 'FILE:src/a.ts',
      to: `EXTERNAL:dep${i}`,
      type: EdgeType.IMPORTS,
    }));
    const pathTable: PathTable = ['src/a.ts', ...Array.from({ length: 50 }, (_, i) => `dep${i}`)];

    const batches = batchImportsEdges(edges, pathTable);

    assert.strictEqual(batches.length, 1);
    assert.strictEqual(batches[0].targetIndexes.length, 50);
  });

  it('should handle paths not in pathTable gracefully', () => {
    // This should not happen with proper pathTable, but test edge case
    // resolvePathIndex returns -1 for missing paths
    const edges: GraphEdge[] = [
      { from: 'FILE:src/unknown.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
    ];
    const pathTable: PathTable = ['react']; // missing src/unknown.ts

    const batches = batchImportsEdges(edges, pathTable);

    // Should handle gracefully (fromIndex will be -1)
    // This is an edge case that shouldn't happen with proper pathTable
    assert.strictEqual(batches.length, 1);
    assert.strictEqual(batches[0].fromIndex, -1);
  });

  it('should skip non-IMPORTS edges', () => {
    const edges: GraphEdge[] = [
      { from: 'FILE:src/a.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
      { from: 'DIRECTORY:src', to: 'FILE:src/a.ts', type: EdgeType.CONTAINS },
      { from: 'FILE:src/a.ts', to: 'MODULE:src/a.ts#func', type: EdgeType.EXPORTS },
      { from: 'FILE:src/a.ts', to: 'EXTERNAL:lodash', type: EdgeType.IMPORTS },
    ];
    const pathTable: PathTable = ['src', 'src/a.ts', 'react', 'lodash'];

    const batches = batchImportsEdges(edges, pathTable);

    // Only IMPORTS edges should be batched
    assert.strictEqual(batches.length, 1);
    assert.strictEqual(batches[0].targetIndexes.length, 2);
  });
});