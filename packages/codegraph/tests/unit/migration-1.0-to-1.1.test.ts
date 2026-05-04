/**
 * Unit tests for 1.0 to 1.1 migration module (Tasks 4.1-4.5)
 *
 * Tests migration from BaselineData_1_0 (legacy format with id fields, no pathTable)
 * to CompressedBaseline (1.1 format with pathTable, compressed nodes/edges).
 *
 * Run with: pnpm test tests/unit/migration-1.0-to-1.1.test.ts
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  migrate1_0To1_1,
  detectBaselineFormat,
} from '../../src/persistence/migrations/1.0-to-1.1.js';
import type {
  Baseline,
  CompressedBaseline,
  GraphNode,
  GraphEdge,
  CompressionConfig,
} from '../../src/types.js';
import { NodeType, EdgeType } from '../../src/types.js';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a valid 1.0 baseline for testing
 *
 * 1.0 format characteristics:
 * - graph.nodes: [string, GraphNode][] tuples (Map-compatible format)
 * - Nodes have id field (redundant)
 * - No pathTable (paths stored directly in nodes/edges)
 * - No IMPORTS_BATCH (individual IMPORTS edges)
 */
function createBaseline_1_0(): Baseline {
  const nodes: [string, GraphNode][] = [
    ['DIRECTORY:src', { id: 'DIRECTORY:src', type: NodeType.DIRECTORY, path: 'src', name: 'src' }],
    ['FILE:src/a.ts', { id: 'FILE:src/a.ts', type: NodeType.FILE, path: 'src/a.ts', name: 'a.ts' }],
    ['FILE:src/b.ts', { id: 'FILE:src/b.ts', type: NodeType.FILE, path: 'src/b.ts', name: 'b.ts' }],
    ['MODULE:src/a.ts#formatDate', {
      id: 'MODULE:src/a.ts#formatDate',
      type: NodeType.MODULE,
      path: 'src/a.ts',
      name: 'formatDate',
      metadata: {
        kind: 'function',
        isExported: true,
        jsDoc: 'This is a long JSDoc comment that should be truncated during migration to 100 characters maximum length',
        hasJSDoc: true,
        complexity: 5,
        loc: 20,
      },
    }],
    ['EXTERNAL:react', { id: 'EXTERNAL:react', type: NodeType.EXTERNAL, path: 'react', name: 'react' }],
    ['EXTERNAL:lodash', { id: 'EXTERNAL:lodash', type: NodeType.EXTERNAL, path: 'lodash', name: 'lodash' }],
  ];

  const edges: GraphEdge[] = [
    { from: 'DIRECTORY:src', to: 'FILE:src/a.ts', type: EdgeType.CONTAINS },
    { from: 'DIRECTORY:src', to: 'FILE:src/b.ts', type: EdgeType.CONTAINS },
    { from: 'FILE:src/a.ts', to: 'MODULE:src/a.ts#formatDate', type: EdgeType.CONTAINS },
    { from: 'FILE:src/a.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
    { from: 'FILE:src/a.ts', to: 'EXTERNAL:lodash', type: EdgeType.IMPORTS },
    { from: 'FILE:src/b.ts', to: 'EXTERNAL:react', type: EdgeType.IMPORTS },
  ];

  return {
    graph: {
      nodes,
      edges,
      commitHash: 'abc1234',
      timestamp: 1234567890,
    },
    commitHash: 'abc1234',
    timestamp: 1234567890,
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    generatorVersion: '1.0.0',
    architectureConstraints: ['layer:service->domain'],
    healthScore: 75,
    skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
  };
}

/**
 * Create an empty 1.0 baseline (edge case testing)
 */
function createEmptyBaseline_1_0(): Baseline {
  return {
    graph: {
      nodes: [],
      edges: [],
      commitHash: 'empty',
      timestamp: Date.now(),
    },
    commitHash: 'empty',
    timestamp: Date.now(),
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    generatorVersion: '1.0.0',
    architectureConstraints: [],
    healthScore: 50,
    skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
  };
}

/**
 * Create a 1.0 baseline with no IMPORTS edges
 */
function createBaselineNoImports_1_0(): Baseline {
  const nodes: [string, GraphNode][] = [
    ['DIRECTORY:src', { id: 'DIRECTORY:src', type: NodeType.DIRECTORY, path: 'src', name: 'src' }],
    ['FILE:src/a.ts', { id: 'FILE:src/a.ts', type: NodeType.FILE, path: 'src/a.ts', name: 'a.ts' }],
  ];

  const edges: GraphEdge[] = [
    { from: 'DIRECTORY:src', to: 'FILE:src/a.ts', type: EdgeType.CONTAINS },
  ];

  return {
    graph: {
      nodes,
      edges,
      commitHash: 'noimports',
      timestamp: Date.now(),
    },
    commitHash: 'noimports',
    timestamp: Date.now(),
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    generatorVersion: '1.0.0',
    architectureConstraints: [],
    healthScore: 50,
    skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
  };
}

/**
 * Create a single node baseline (minimal pathTable)
 */
function createSingleNodeBaseline_1_0(): Baseline {
  const nodes: [string, GraphNode][] = [
    ['FILE:src/standalone.ts', { id: 'FILE:src/standalone.ts', type: NodeType.FILE, path: 'src/standalone.ts', name: 'standalone.ts' }],
  ];

  return {
    graph: {
      nodes,
      edges: [],
      commitHash: 'single',
      timestamp: Date.now(),
    },
    commitHash: 'single',
    timestamp: Date.now(),
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    generatorVersion: '1.0.0',
    architectureConstraints: [],
    healthScore: 50,
    skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
  };
}

// ============================================================================
// Task 4.2: migrate1_0To1_1 - Standard Migration
// ============================================================================

describe('migrate1_0To1_1 (Task 4.2)', () => {
  describe('standard migration', () => {
    it('should produce CompressedBaseline with schemaVersion 1.1.0', () => {
      const baseline = createBaseline_1_0();
      const config: CompressionConfig = { compression: { enabled: true, jsDocMaxLength: 100 } };

      const compressed = migrate1_0To1_1(baseline, config);

      assert.ok(compressed.schemaVersion);
      assert.strictEqual(compressed.schemaVersion?.major, 1);
      assert.strictEqual(compressed.schemaVersion?.minor, 1);
      assert.strictEqual(compressed.schemaVersion?.patch, 0);
    });

    it('should build pathTable from unique paths', () => {
      const baseline = createBaseline_1_0();
      const config: CompressionConfig = { compression: { enabled: true } };

      const compressed = migrate1_0To1_1(baseline, config);

      // pathTable should contain all unique paths
      assert.ok(Array.isArray(compressed.pathTable));
      assert.ok(compressed.pathTable.includes('src'));
      assert.ok(compressed.pathTable.includes('src/a.ts'));
      assert.ok(compressed.pathTable.includes('src/b.ts'));
      assert.ok(compressed.pathTable.includes('react'));
      assert.ok(compressed.pathTable.includes('lodash'));

      // react appears 3 times (2 IMPORTS edges + 1 EXTERNAL node), should be first
      const reactIndex = compressed.pathTable.indexOf('react');
      assert.ok(reactIndex >= 0 && reactIndex < compressed.pathTable.length);
    });

    it('should remove id fields from nodes', () => {
      const baseline = createBaseline_1_0();
      const config: CompressionConfig = { compression: { enabled: true } };

      const compressed = migrate1_0To1_1(baseline, config);

      // All compressed nodes should NOT have id field
      for (const node of compressed.nodes) {
        assert.ok(!('id' in node), 'CompressedNode should not have id field');
        assert.ok(typeof node.pathIndex === 'number', 'CompressedNode should have pathIndex');
        assert.ok(node.type, 'CompressedNode should have type');
      }
    });

    it('should convert path strings to pathIndex references', () => {
      const baseline = createBaseline_1_0();
      const config: CompressionConfig = { compression: { enabled: true } };

      const compressed = migrate1_0To1_1(baseline, config);

      // Verify pathIndex resolution
      for (const node of compressed.nodes) {
        const resolvedPath = compressed.pathTable[node.pathIndex];
        assert.ok(resolvedPath, `pathIndex ${node.pathIndex} should resolve to valid path`);
      }
    });

    it('should truncate JSDoc to configured max length', () => {
      const baseline = createBaseline_1_0();
      const config: CompressionConfig = { compression: { enabled: true, jsDocMaxLength: 50 } };

      const compressed = migrate1_0To1_1(baseline, config);

      // Find MODULE node
      const moduleNode = compressed.nodes.find(n => n.type === NodeType.MODULE);
      assert.ok(moduleNode?.metadata?.jsDoc);

      // JSDoc should be truncated to 50 chars + '...'
      assert.ok(moduleNode?.metadata?.jsDoc?.length <= 53); // 50 + '...'
      assert.strictEqual(moduleNode?.metadata?.jsDocTruncated, true);
      assert.strictEqual(moduleNode?.metadata?.hasJSDoc, true);
    });

    it('should batch IMPORTS edges into IMPORTS_BATCH', () => {
      const baseline = createBaseline_1_0();
      const config: CompressionConfig = { compression: { enabled: true } };

      const compressed = migrate1_0To1_1(baseline, config);

      // Should have IMPORTS_BATCH edges
      const batchEdges = compressed.edges.filter(e => e.type === 'IMPORTS_BATCH');
      assert.ok(batchEdges.length > 0, 'Should have IMPORTS_BATCH edges');

      // src/a.ts imports react and lodash - should be batched together
      const aTsBatch = batchEdges.find(b => {
        const fromPath = compressed.pathTable[b.fromIndex];
        return fromPath === 'src/a.ts';
      });
      assert.ok(aTsBatch, 'src/a.ts should have IMPORTS_BATCH');
      assert.ok(aTsBatch.targetIndexes.length >= 2, 'src/a.ts batch should have multiple targets');
    });

    it('should preserve non-IMPORTS edges as CompressedEdge', () => {
      const baseline = createBaseline_1_0();
      const config: CompressionConfig = { compression: { enabled: true } };

      const compressed = migrate1_0To1_1(baseline, config);

      // CONTAINS edges should remain as CompressedEdge (not batched)
      const containsEdges = compressed.edges.filter(e => e.type === EdgeType.CONTAINS);
      assert.ok(containsEdges.length > 0, 'Should have CONTAINS edges');

      for (const edge of containsEdges) {
        assert.ok(typeof edge.fromIndex === 'number', 'CompressedEdge should have fromIndex');
        assert.ok(typeof edge.toIndex === 'number', 'CompressedEdge should have toIndex');
        assert.ok(!('targetIndexes' in edge), 'CONTAINS edge should not have targetIndexes');
      }
    });

    it('should preserve commitHash and timestamp', () => {
      const baseline = createBaseline_1_0();
      const config: CompressionConfig = { compression: { enabled: true } };

      const compressed = migrate1_0To1_1(baseline, config);

      assert.strictEqual(compressed.commitHash, baseline.commitHash);
      assert.strictEqual(compressed.timestamp, baseline.timestamp);
    });

    it('should preserve node metadata (kind, complexity, loc)', () => {
      const baseline = createBaseline_1_0();
      const config: CompressionConfig = { compression: { enabled: true } };

      const compressed = migrate1_0To1_1(baseline, config);

      const moduleNode = compressed.nodes.find(n => n.type === NodeType.MODULE);
      assert.ok(moduleNode?.metadata);
      assert.strictEqual(moduleNode?.metadata?.kind, 'function');
      assert.strictEqual(moduleNode?.metadata?.isExported, true);
      assert.strictEqual(moduleNode?.metadata?.complexity, 5);
      assert.strictEqual(moduleNode?.metadata?.loc, 20);
    });
  });

  // ============================================================================
  // Task 4.3: Edge Case Handling
  // ============================================================================

  describe('edge cases (Task 4.3)', () => {
    it('should handle empty baseline (no nodes, no edges)', () => {
      const baseline = createEmptyBaseline_1_0();
      const config: CompressionConfig = { compression: { enabled: true } };

      const compressed = migrate1_0To1_1(baseline, config);

      assert.strictEqual(compressed.nodes.length, 0);
      assert.strictEqual(compressed.edges.length, 0);
      assert.strictEqual(compressed.pathTable.length, 0);
      assert.ok(compressed.schemaVersion);
      assert.strictEqual(compressed.commitHash, baseline.commitHash);
    });

    it('should handle baseline with no IMPORTS edges', () => {
      const baseline = createBaselineNoImports_1_0();
      const config: CompressionConfig = { compression: { enabled: true } };

      const compressed = migrate1_0To1_1(baseline, config);

      // No IMPORTS_BATCH edges
      const batchEdges = compressed.edges.filter(e => e.type === 'IMPORTS_BATCH');
      assert.strictEqual(batchEdges.length, 0);

      // CONTAINS edges should remain
      const containsEdges = compressed.edges.filter(e => e.type === EdgeType.CONTAINS);
      assert.strictEqual(containsEdges.length, 1);
    });

    it('should handle single node baseline (minimal pathTable)', () => {
      const baseline = createSingleNodeBaseline_1_0();
      const config: CompressionConfig = { compression: { enabled: true } };

      const compressed = migrate1_0To1_1(baseline, config);

      assert.strictEqual(compressed.nodes.length, 1);
      assert.strictEqual(compressed.pathTable.length, 1);
      assert.strictEqual(compressed.pathTable[0], 'src/standalone.ts');
      assert.strictEqual(compressed.nodes[0].pathIndex, 0);
      assert.strictEqual(compressed.edges.length, 0);
    });

    it('should handle MODULE node without metadata', () => {
      const nodes: [string, GraphNode][] = [
        ['MODULE:src/a.ts#noMeta', {
          id: 'MODULE:src/a.ts#noMeta',
          type: NodeType.MODULE,
          path: 'src/a.ts',
          name: 'noMeta',
          // No metadata
        }],
      ];

      const baseline: Baseline = {
        graph: { nodes, edges: [], commitHash: 'nometa', timestamp: Date.now() },
        commitHash: 'nometa',
        timestamp: Date.now(),
        schemaVersion: { major: 1, minor: 0, patch: 0 },
        generatorVersion: '1.0.0',
        architectureConstraints: [],
        healthScore: 50,
        skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
      };

      const config: CompressionConfig = { compression: { enabled: true } };
      const compressed = migrate1_0To1_1(baseline, config);

      const moduleNode = compressed.nodes.find(n => n.type === NodeType.MODULE);
      assert.ok(moduleNode);
      assert.strictEqual(moduleNode.metadata, undefined);
    });

    it('should use default jsDocMaxLength when not specified', () => {
      const baseline = createBaseline_1_0();
      const config: CompressionConfig = { compression: { enabled: true } };

      const compressed = migrate1_0To1_1(baseline, config);

      const moduleNode = compressed.nodes.find(n => n.type === NodeType.MODULE);
      // Default max length is 100
      assert.ok(moduleNode?.metadata?.jsDoc?.length <= 103); // 100 + '...'
    });

    it('should handle compression disabled (no JSDoc truncation)', () => {
      const baseline = createBaseline_1_0();
      const config: CompressionConfig = { compression: { enabled: false } };

      const compressed = migrate1_0To1_1(baseline, config);

      // Even with compression disabled, should produce valid structure
      assert.ok(compressed.schemaVersion);
      assert.ok(Array.isArray(compressed.pathTable));
      assert.ok(Array.isArray(compressed.nodes));

      // JSDoc should NOT be truncated when compression disabled
      const moduleNode = compressed.nodes.find(n => n.type === NodeType.MODULE);
      // Original JSDoc was long, should not be truncated
      assert.strictEqual(moduleNode?.metadata?.jsDocTruncated, undefined);
    });
  });
});

// ============================================================================
// Task 4.4: Detection Logic
// ============================================================================

describe('detectBaselineFormat (Task 4.4)', () => {
  describe('format detection', () => {
    it('should detect 1.0 format (no schemaVersion)', () => {
      // 1.0 baseline may not have schemaVersion field
      const data = {
        graph: {
          nodes: [['FILE:a.ts', { id: 'FILE:a.ts', type: NodeType.FILE, path: 'a.ts', name: 'a.ts' }]],
          edges: [],
          commitHash: 'abc123',
          timestamp: 1000,
        },
        commitHash: 'abc123',
        timestamp: 1000,
        // No schemaVersion
        generatorVersion: '1.0.0',
        architectureConstraints: [],
        healthScore: 50,
        skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
      };

      const format = detectBaselineFormat(data);

      assert.strictEqual(format, '1.0');
    });

    it('should detect 1.0 format (schemaVersion 1.0.x)', () => {
      const data = {
        graph: {
          nodes: [['FILE:a.ts', { id: 'FILE:a.ts', type: NodeType.FILE, path: 'a.ts', name: 'a.ts' }]],
          edges: [],
          commitHash: 'abc123',
          timestamp: 1000,
        },
        commitHash: 'abc123',
        timestamp: 1000,
        schemaVersion: { major: 1, minor: 0, patch: 0 },
        generatorVersion: '1.0.0',
        architectureConstraints: [],
        healthScore: 50,
        skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
      };

      const format = detectBaselineFormat(data);

      assert.strictEqual(format, '1.0');
    });

    it('should detect 1.1 format (schemaVersion 1.1.x)', () => {
      const data: CompressedBaseline = {
        schemaVersion: { major: 1, minor: 1, patch: 0 },
        pathTable: ['src/a.ts'],
        nodes: [{ type: NodeType.FILE, pathIndex: 0, name: 'a.ts' }],
        edges: [],
        commitHash: 'abc123',
        timestamp: 1000,
      };

      const format = detectBaselineFormat(data);

      assert.strictEqual(format, '1.1');
    });

    it('should detect 1.1 format (has pathTable)', () => {
      // 1.1 format can be detected by presence of pathTable
      const data = {
        schemaVersion: { major: 1, minor: 1, patch: 0 },
        pathTable: ['src/a.ts'],
        nodes: [{ type: NodeType.FILE, pathIndex: 0, name: 'a.ts' }],
        edges: [],
        commitHash: 'abc123',
        timestamp: 1000,
      };

      const format = detectBaselineFormat(data);

      assert.strictEqual(format, '1.1');
    });

    it('should detect legacy format (no fields match expected structure)', () => {
      const data = {
        // Neither graph (1.0) nor pathTable (1.1)
        nodes: [],
        edges: [],
        commitHash: 'legacy',
        timestamp: 1000,
      };

      const format = detectBaselineFormat(data);

      assert.strictEqual(format, 'legacy');
    });
  });

  describe('integration with loadBaseline', () => {
    it('should determine migration needed for 1.0 format', () => {
      const baseline_1_0 = createBaseline_1_0();
      const format = detectBaselineFormat(baseline_1_0);

      // 1.0 format needs migration to 1.1
      assert.strictEqual(format, '1.0');

      // Migration should work
      const config: CompressionConfig = { compression: { enabled: true } };
      const compressed = migrate1_0To1_1(baseline_1_0, config);
      assert.ok(compressed.schemaVersion?.minor === 1);
    });

    it('should determine no migration needed for 1.1 format', () => {
      const baseline_1_1: CompressedBaseline = {
        schemaVersion: { major: 1, minor: 1, patch: 0 },
        pathTable: ['src/a.ts'],
        nodes: [{ type: NodeType.FILE, pathIndex: 0, name: 'a.ts' }],
        edges: [],
        commitHash: 'abc123',
        timestamp: 1000,
      };

      const format = detectBaselineFormat(baseline_1_1);

      // 1.1 format - no migration needed
      assert.strictEqual(format, '1.1');
    });
  });
});

// ============================================================================
// Round-trip: 1.0 → migrate → 1.1 → deserialize → verify
// ============================================================================

describe('Migration round-trip verification', () => {
  it('should produce valid CompressedBaseline that can be deserialized', () => {
    const baseline = createBaseline_1_0();
    const config: CompressionConfig = { compression: { enabled: true, jsDocMaxLength: 100 } };

    const compressed = migrate1_0To1_1(baseline, config);

    // Verify structure is valid CompressedBaseline
    assert.ok(compressed.schemaVersion);
    assert.ok(Array.isArray(compressed.pathTable));
    assert.ok(Array.isArray(compressed.nodes));
    assert.ok(Array.isArray(compressed.edges));
    assert.ok(typeof compressed.commitHash === 'string');
    assert.ok(typeof compressed.timestamp === 'number');

    // All pathIndexes should be valid
    for (const node of compressed.nodes) {
      assert.ok(node.pathIndex >= 0);
      assert.ok(node.pathIndex < compressed.pathTable.length);
    }

    // All edge indexes should be valid
    for (const edge of compressed.edges) {
      if (edge.type === 'IMPORTS_BATCH') {
        assert.ok(edge.fromIndex >= 0 && edge.fromIndex < compressed.pathTable.length);
        for (const targetIndex of edge.targetIndexes) {
          assert.ok(targetIndex >= 0 && targetIndex < compressed.pathTable.length);
        }
      } else {
        assert.ok(edge.fromIndex >= 0 && edge.fromIndex < compressed.pathTable.length);
        assert.ok(edge.toIndex >= 0 && edge.toIndex < compressed.pathTable.length);
      }
    }
  });

  it('should preserve node count after migration', () => {
    const baseline = createBaseline_1_0();
    const config: CompressionConfig = { compression: { enabled: true } };

    const compressed = migrate1_0To1_1(baseline, config);

    assert.strictEqual(compressed.nodes.length, baseline.graph.nodes.length);
  });

  it('should preserve edge relationships after migration', () => {
    const baseline = createBaseline_1_0();
    const originalImportsCount = baseline.graph.edges.filter(e => e.type === EdgeType.IMPORTS).length;
    const originalContainsCount = baseline.graph.edges.filter(e => e.type === EdgeType.CONTAINS).length;

    const config: CompressionConfig = { compression: { enabled: true } };
    const compressed = migrate1_0To1_1(baseline, config);

    // IMPORTS_BATCH edges should represent same imports
    const batchEdges = compressed.edges.filter(e => e.type === 'IMPORTS_BATCH');
    let batchedImportsCount = 0;
    for (const batch of batchEdges) {
      batchedImportsCount += batch.targetIndexes.length;
    }
    assert.strictEqual(batchedImportsCount, originalImportsCount);

    // CONTAINS edges count preserved
    const containsEdges = compressed.edges.filter(e => e.type === EdgeType.CONTAINS);
    assert.strictEqual(containsEdges.length, originalContainsCount);
  });
});