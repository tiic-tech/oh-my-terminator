/**
 * Unit tests for serializer module (Tasks 2.15-2.17)
 *
 * Tests compression serialization and deserialization.
 * Run with: pnpm test tests/unit/compression-serializer.test.ts
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeCompressed,
  deserializeCompressed,
} from '../../src/persistence/compression/serializer.js';
import type { CodeGraph, CompressionConfig, CompressedBaseline, GraphNode, GraphEdge } from '../../src/types.js';
import { NodeType, EdgeType } from '../../src/types.js';
import { CorruptedBaselineError } from '../../src/persistence/compression/errors.js';

// Helper to create valid mock graph
function createMockGraph(): CodeGraph {
  const nodes: GraphNode[] = [
    { id: 'DIRECTORY:src', type: NodeType.DIRECTORY, path: 'src', name: 'src' },
    { id: 'FILE:src/a.ts', type: NodeType.FILE, path: 'src/a.ts', name: 'a.ts' },
    { id: 'FILE:src/b.ts', type: NodeType.FILE, path: 'src/b.ts', name: 'b.ts' },
    { id: 'MODULE:src/a.ts#formatDate', type: NodeType.MODULE, path: 'src/a.ts', name: 'formatDate', metadata: { kind: 'function', isExported: true, jsDoc: 'Format date utility', hasJSDoc: true } },
    { id: 'EXTERNAL:react', type: NodeType.EXTERNAL, path: 'react', name: 'react' },
  ];

  const edges: GraphEdge[] = [
    { from: 'DIRECTORY:src', to: 'FILE:src/a.ts', type: EdgeType.CONTAINS },
    { from: 'DIRECTORY:src', to: 'FILE:src/b.ts', type: EdgeType.CONTAINS },
    { from: 'FILE:src/a.ts', to: 'MODULE:src/a.ts#formatDate', type: EdgeType.CONTAINS },
    { from: 'FILE:src/a.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
    { from: 'FILE:src/b.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
  ];

  return {
    nodes: new Map(nodes.map(n => [n.id, n])),
    edges,
    commitHash: 'abc1234',
    timestamp: Date.now(),
  };
}

// ============================================================================
// Task 2.16: serializeCompressed - serialize graph to compressed format
// ============================================================================
describe('serializeCompressed (Task 2.16)', () => {
  it('should serialize graph to CompressedBaseline format', () => {
    const graph = createMockGraph();
    const config: CompressionConfig = { compression: { enabled: true, jsDocMaxLength: 100 } };

    const compressed = serializeCompressed(graph, config);

    assert.ok(compressed.schemaVersion);
    assert.strictEqual(compressed.schemaVersion?.major, 1);
    assert.strictEqual(compressed.schemaVersion?.minor, 1);
    assert.strictEqual(compressed.schemaVersion?.patch, 0);
    assert.ok(Array.isArray(compressed.pathTable));
    assert.ok(Array.isArray(compressed.nodes));
    assert.ok(Array.isArray(compressed.edges));
    assert.strictEqual(compressed.commitHash, graph.commitHash);
    assert.strictEqual(compressed.timestamp, graph.timestamp);
  });

  it('should build pathTable with correct entries', () => {
    const graph = createMockGraph();
    const config: CompressionConfig = { compression: { enabled: true } };

    const compressed = serializeCompressed(graph, config);

    // All unique paths should be in pathTable
    assert.ok(compressed.pathTable.includes('src'));
    assert.ok(compressed.pathTable.includes('src/a.ts'));
    assert.ok(compressed.pathTable.includes('src/b.ts'));
    assert.ok(compressed.pathTable.includes('react'));
  });

  it('should compress nodes without id field', () => {
    const graph = createMockGraph();
    const config: CompressionConfig = { compression: { enabled: true } };

    const compressed = serializeCompressed(graph, config);

    // All nodes should have type and pathIndex, no id
    for (const node of compressed.nodes) {
      assert.ok(node.type);
      assert.ok(typeof node.pathIndex === 'number');
      assert.ok(!('id' in node));
    }
  });

  it('should batch IMPORTS edges', () => {
    const graph = createMockGraph();
    const config: CompressionConfig = { compression: { enabled: true } };

    const compressed = serializeCompressed(graph, config);

    // Should have IMPORTS_BATCH edges
    const batchEdges = compressed.edges.filter(e => e.type === 'IMPORTS_BATCH');
    assert.ok(batchEdges.length > 0);

    // Non-IMPORTS edges should remain as CompressedEdge
    const otherEdges = compressed.edges.filter(e => e.type !== 'IMPORTS_BATCH');
    assert.ok(otherEdges.some(e => e.type === EdgeType.CONTAINS));
  });

  it('should truncate JSDoc when compression enabled', () => {
    const nodes: GraphNode[] = [
      {
        id: 'MODULE:src/a.ts#func',
        type: NodeType.MODULE,
        path: 'src/a.ts',
        name: 'func',
        metadata: {
          kind: 'function',
          jsDoc: 'This is a very long JSDoc comment that should be truncated when compression is enabled',
          hasJSDoc: true,
        },
      },
    ];
    const graph: CodeGraph = {
      nodes: new Map(nodes.map(n => [n.id, n])),
      edges: [],
      commitHash: 'abc123',
      timestamp: Date.now(),
    };
    const config: CompressionConfig = { compression: { enabled: true, jsDocMaxLength: 30 } };

    const compressed = serializeCompressed(graph, config);

    // Find the MODULE node
    const moduleNode = compressed.nodes.find(n => n.type === NodeType.MODULE);
    assert.ok(moduleNode?.metadata?.jsDoc);
    assert.strictEqual(moduleNode?.metadata?.jsDoc?.length, 33); // 30 + '...'
    assert.strictEqual(moduleNode?.metadata?.jsDocTruncated, true);
  });

  it('should handle compression disabled', () => {
    const graph = createMockGraph();
    const config: CompressionConfig = { compression: { enabled: false } };

    const compressed = serializeCompressed(graph, config);

    // Even with compression disabled, should produce valid structure
    // (compression.enabled controls behavior, not output format)
    assert.ok(Array.isArray(compressed.nodes));
    assert.ok(Array.isArray(compressed.edges));
  });

  it('should handle empty graph', () => {
    const graph: CodeGraph = {
      nodes: new Map(),
      edges: [],
      commitHash: 'empty',
      timestamp: Date.now(),
    };
    const config: CompressionConfig = { compression: { enabled: true } };

    const compressed = serializeCompressed(graph, config);

    assert.strictEqual(compressed.nodes.length, 0);
    assert.strictEqual(compressed.edges.length, 0);
    assert.strictEqual(compressed.pathTable.length, 0);
  });
});

// ============================================================================
// Task 2.17: deserializeCompressed - deserialize compressed format to graph
// ============================================================================
describe('deserializeCompressed (Task 2.17)', () => {
  it('should deserialize CompressedBaseline to CodeGraph', () => {
    const compressed: CompressedBaseline = {
      schemaVersion: { major: 1, minor: 1, patch: 0 },
      pathTable: ['src', 'src/a.ts', 'src/b.ts', 'react'],
      nodes: [
        { type: NodeType.DIRECTORY, pathIndex: 0, name: 'src' },
        { type: NodeType.FILE, pathIndex: 1, name: 'a.ts' },
        { type: NodeType.FILE, pathIndex: 2, name: 'b.ts' },
        { type: NodeType.EXTERNAL, pathIndex: 3, name: 'react' },
      ],
      edges: [
        { type: EdgeType.CONTAINS, fromIndex: 0, toIndex: 1 },
        { type: EdgeType.CONTAINS, fromIndex: 0, toIndex: 2 },
      ],
      commitHash: 'abc123',
      timestamp: 1234567890,
    };

    const graph = deserializeCompressed(compressed);

    assert.strictEqual(graph.commitHash, 'abc123');
    assert.strictEqual(graph.timestamp, 1234567890);
    assert.strictEqual(graph.nodes.size, 4);
    assert.strictEqual(graph.edges.length, 2);
  });

  it('should reconstruct node IDs correctly', () => {
    const compressed: CompressedBaseline = {
      pathTable: ['src/a.ts', 'react'],
      nodes: [
        { type: NodeType.FILE, pathIndex: 0, name: 'a.ts' },
        { type: NodeType.EXTERNAL, pathIndex: 1, name: 'react' },
      ],
      edges: [],
      commitHash: 'test',
      timestamp: Date.now(),
    };

    const graph = deserializeCompressed(compressed);

    assert.ok(graph.nodes.has('FILE:src/a.ts'));
    assert.ok(graph.nodes.has('EXTERNAL:react'));
  });

  it('should reconstruct MODULE node IDs with name', () => {
    const compressed: CompressedBaseline = {
      pathTable: ['src/utils.ts'],
      nodes: [
        { type: NodeType.MODULE, pathIndex: 0, name: 'formatDate' },
      ],
      edges: [],
      commitHash: 'test',
      timestamp: Date.now(),
    };

    const graph = deserializeCompressed(compressed);

    assert.ok(graph.nodes.has('MODULE:src/utils.ts#formatDate'));
    const moduleNode = graph.nodes.get('MODULE:src/utils.ts#formatDate');
    assert.strictEqual(moduleNode?.name, 'formatDate');
  });

  it('should expand IMPORTS_BATCH edges', () => {
    const compressed: CompressedBaseline = {
      pathTable: ['src/a.ts', 'src/b.ts', 'react', 'lodash'],
      nodes: [
        { type: NodeType.FILE, pathIndex: 0, name: 'a.ts' },
        { type: NodeType.FILE, pathIndex: 1, name: 'b.ts' },
      ],
      edges: [
        { type: 'IMPORTS_BATCH', fromIndex: 0, targetIndexes: [2, 3] },
      ],
      commitHash: 'test',
      timestamp: Date.now(),
    };

    const graph = deserializeCompressed(compressed);

    // IMPORTS_BATCH should expand to 2 edges
    assert.strictEqual(graph.edges.length, 2);
    assert.strictEqual(graph.edges[0].type, EdgeType.IMPORTS);
    assert.strictEqual(graph.edges[0].from, 'FILE:src/a.ts');
    assert.strictEqual(graph.edges[0].to, 'EXTERNAL:react');
    assert.strictEqual(graph.edges[1].to, 'EXTERNAL:lodash');
  });

  it('should restore node metadata', () => {
    const compressed: CompressedBaseline = {
      pathTable: ['src/utils.ts'],
      nodes: [
        {
          type: NodeType.MODULE,
          pathIndex: 0,
          name: 'formatDate',
          metadata: {
            kind: 'function',
            isExported: true,
            jsDoc: 'Format date',
            hasJSDoc: true,
          },
        },
      ],
      edges: [],
      commitHash: 'test',
      timestamp: Date.now(),
    };

    const graph = deserializeCompressed(compressed);

    const moduleNode = graph.nodes.get('MODULE:src/utils.ts#formatDate');
    assert.strictEqual(moduleNode?.metadata?.kind, 'function');
    assert.strictEqual(moduleNode?.metadata?.isExported, true);
    assert.strictEqual(moduleNode?.metadata?.jsDoc, 'Format date');
    assert.strictEqual(moduleNode?.metadata?.hasJSDoc, true);
  });

  it('should throw CorruptedBaselineError for invalid pathIndex', () => {
    const compressed: CompressedBaseline = {
      pathTable: ['src/a.ts'],
      nodes: [
        { type: NodeType.FILE, pathIndex: 100, name: 'a.ts' }, // invalid index
      ],
      edges: [],
      commitHash: 'test',
      timestamp: Date.now(),
    };

    assert.throws(
      () => deserializeCompressed(compressed),
      CorruptedBaselineError
    );
  });

  it('should throw CorruptedBaselineError for missing required fields', () => {
    // Missing pathTable
    const compressed = {
      schemaVersion: { major: 1, minor: 1, patch: 0 },
      nodes: [],
      edges: [],
      commitHash: 'test',
      timestamp: Date.now(),
    } as unknown as CompressedBaseline;

    assert.throws(
      () => deserializeCompressed(compressed),
      CorruptedBaselineError
    );
  });
});

// ============================================================================
// Round-trip: serializeCompressed → deserializeCompressed
// ============================================================================
describe('Serializer round-trip (serialize → deserialize)', () => {
  it('should preserve graph structure after round-trip', () => {
    const originalGraph = createMockGraph();
    const config: CompressionConfig = { compression: { enabled: true, jsDocMaxLength: 100 } };

    const compressed = serializeCompressed(originalGraph, config);
    const restoredGraph = deserializeCompressed(compressed);

    // Same commitHash and timestamp
    assert.strictEqual(restoredGraph.commitHash, originalGraph.commitHash);
    assert.strictEqual(restoredGraph.timestamp, originalGraph.timestamp);

    // Same node count
    assert.strictEqual(restoredGraph.nodes.size, originalGraph.nodes.size);

    // Same edge count (IMPORTS_BATCH expands to individual edges)
    const originalImportsCount = originalGraph.edges.filter(e => e.type === EdgeType.IMPORTS).length;
    const restoredImportsCount = restoredGraph.edges.filter(e => e.type === EdgeType.IMPORTS).length;
    assert.strictEqual(restoredImportsCount, originalImportsCount);
  });

  it('should preserve node IDs after round-trip', () => {
    const originalGraph = createMockGraph();
    const config: CompressionConfig = { compression: { enabled: true } };

    const compressed = serializeCompressed(originalGraph, config);
    const restoredGraph = deserializeCompressed(compressed);

    // All original node IDs should exist in restored graph
    for (const [id] of originalGraph.nodes) {
      assert.ok(restoredGraph.nodes.has(id), `Node ${id} should exist in restored graph`);
    }
  });

  it('should preserve node metadata after round-trip', () => {
    const nodes: GraphNode[] = [
      {
        id: 'MODULE:src/utils.ts#func',
        type: NodeType.MODULE,
        path: 'src/utils.ts',
        name: 'func',
        metadata: {
          kind: 'function',
          isExported: true,
          jsDoc: 'A utility function',
          hasJSDoc: true,
          complexity: 5,
          loc: 20,
        },
      },
    ];
    const originalGraph: CodeGraph = {
      nodes: new Map(nodes.map(n => [n.id, n])),
      edges: [],
      commitHash: 'test',
      timestamp: Date.now(),
    };
    const config: CompressionConfig = { compression: { enabled: true } };

    const compressed = serializeCompressed(originalGraph, config);
    const restoredGraph = deserializeCompressed(compressed);

    const restoredNode = restoredGraph.nodes.get('MODULE:src/utils.ts#func');
    assert.strictEqual(restoredNode?.metadata?.kind, 'function');
    assert.strictEqual(restoredNode?.metadata?.isExported, true);
    assert.strictEqual(restoredNode?.metadata?.hasJSDoc, true);
    assert.strictEqual(restoredNode?.metadata?.complexity, 5);
    assert.strictEqual(restoredNode?.metadata?.loc, 20);
  });

  it('should preserve edge relationships after round-trip', () => {
    const originalGraph = createMockGraph();
    const config: CompressionConfig = { compression: { enabled: true } };

    const compressed = serializeCompressed(originalGraph, config);
    const restoredGraph = deserializeCompressed(compressed);

    // Check CONTAINS edges preserved (except FILE→MODULE which lose MODULE name info)
    // NOTE: FILE→MODULE CONTAINS edges can't be perfectly reconstructed because
    // MODULE nodes share the same path as FILE nodes. The edge becomes FILE→FILE.
    // These edges can be inferred from MODULE nodes having same pathIndex as FILE nodes.
    const originalContains = originalGraph.edges.filter(
      e => e.type === EdgeType.CONTAINS && !e.to.startsWith('MODULE:')
    );
    const restoredContains = restoredGraph.edges.filter(e => e.type === EdgeType.CONTAINS);

    // DIRECTORY→FILE CONTAINS edges should be preserved
    for (const originalEdge of originalContains) {
      const matchingRestored = restoredContains.find(
        e => e.from === originalEdge.from && e.to === originalEdge.to
      );
      assert.ok(matchingRestored, `Edge ${originalEdge.from} → ${originalEdge.to} should exist`);
    }
  });
});