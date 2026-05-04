/**
 * @fileoverview Integration tests for baseline compression persistence
 *
 * WHY: Verifies end-to-end compression/decompression flow with actual file I/O.
 * Tests backward compatibility with legacy baselines (1.0 format).
 *
 * Test cases:
 * 1. save with compression → load (round-trip)
 * 2. save without compression → load (legacy round-trip)
 * 3. load 1.0 baseline → migrate → return CodeGraph
 * 4. load 1.1 baseline → decompress → return CodeGraph
 *
 * @see design.md for compression strategy
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp, rm, writeFile, readFile, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import {
  saveBaseline,
  loadBaselineFile,
  ensureCodegraphDir,
  getBaselinePath,
} from '../../src/persistence/index.js';
import { serializeCompressed, deserializeCompressed } from '../../src/persistence/compression/index.js';
import { migrate1_0To1_1, detectBaselineFormat } from '../../src/persistence/migrations/1.0-to-1.1.js';
import { CodeGraph } from '../../src/graph.js';
import { NodeType, EdgeType } from '../../src/types.js';
import type {
  Baseline,
  CompressedBaseline,
  CompressionConfig,
  GraphNode,
  GraphEdge,
} from '../../src/types.js';

describe('Persistence Compression Integration Tests', () => {
  let testDir: string;
  let baselinePath: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'codegraph-compression-'));
    await ensureCodegraphDir(testDir);
    baselinePath = getBaselinePath(testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Create a sample CodeGraph for testing
   */
  function createSampleGraph(): CodeGraph {
    const graph = new CodeGraph();

    // Add nodes
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
      metadata: {
        kind: 'function',
        isExported: true,
        jsDoc: 'Format a date to ISO string format. This is a long JSDoc comment that will be truncated during compression.',
        complexity: 1,
        loc: 5,
      },
    };
    graph.addNode(moduleNode);

    const externalNode: GraphNode = {
      id: 'EXTERNAL:lodash',
      type: NodeType.EXTERNAL,
      path: 'lodash',
      name: 'lodash',
    };
    graph.addNode(externalNode);

    // Add edges
    const containsEdge: GraphEdge = {
      from: 'FILE:src/utils.ts',
      to: 'MODULE:src/utils.ts#formatDate',
      type: EdgeType.CONTAINS,
    };
    graph.addEdge(containsEdge);

    const importsEdge: GraphEdge = {
      from: 'FILE:src/utils.ts',
      to: 'EXTERNAL:lodash',
      type: EdgeType.IMPORTS,
      metadata: { importSpecifier: 'named:formatDate' },
    };
    graph.addEdge(importsEdge);

    graph.commitHash = 'abc123';
    graph.timestamp = Date.now();

    return graph;
  }

  /**
   * Create a sample 1.0 format Baseline (legacy)
   */
  function createLegacyBaseline(): Baseline {
    const graph = createSampleGraph();
    return {
      graph: {
        nodes: Array.from(graph.nodes.entries()),
        edges: graph.edges,
        commitHash: graph.commitHash ?? 'abc123',
        timestamp: graph.timestamp ?? Date.now(),
      },
      commitHash: graph.commitHash ?? 'abc123',
      timestamp: graph.timestamp ?? Date.now(),
      schemaVersion: { major: 1, minor: 0, patch: 0 },
      generatorVersion: '1.0.0',
      architectureConstraints: [],
      healthScore: 50,
      skillDemand: {
        testWriter: 0.5,
        refactorSpecialist: 0.3,
        architect: 0.2,
        securityReviewer: 0.1,
      },
    };
  }

  // ============================================================================
  // Test Case 1: save with compression → load (round-trip)
  // ============================================================================

  describe('5.7.1: Compressed save/load round-trip', () => {
    it('should save compressed baseline and load it correctly', async () => {
      const graph = createSampleGraph();
      const config: CompressionConfig = {
        compression: { enabled: true, jsDocMaxLength: 100 },
      };

      // Create baseline with compression enabled
      const baseline: Baseline = {
        graph: {
          nodes: Array.from(graph.nodes.entries()),
          edges: graph.edges,
          commitHash: graph.commitHash ?? 'test-hash',
          timestamp: graph.timestamp ?? Date.now(),
        },
        commitHash: graph.commitHash ?? 'test-hash',
        timestamp: Date.now(),
        schemaVersion: { major: 1, minor: 1, patch: 0 },
        generatorVersion: '1.1.0',
        architectureConstraints: [],
        healthScore: 50,
        skillDemand: {
          testWriter: 0.5,
          refactorSpecialist: 0.3,
          architect: 0.2,
          securityReviewer: 0.1,
        },
      };

      // Save with compression enabled (compress: true)
      await saveBaseline(baseline, testDir, { compress: true });

      // Verify file exists
      const exists = await stat(baselinePath).then(() => true).catch(() => false);
      assert.strictEqual(exists, true, 'Baseline file should exist');

      // Load and verify format
      const loadedGraph = await loadBaselineFile(baselinePath);
      assert.ok(loadedGraph, 'Loaded graph should exist');

      // Verify nodes
      assert.strictEqual(loadedGraph.nodes.size, graph.nodes.size, 'Node count should match');

      // Verify edges
      assert.strictEqual(loadedGraph.edges.length, graph.edges.length, 'Edge count should match');

      // Verify commit hash
      assert.strictEqual(loadedGraph.commitHash, graph.commitHash, 'Commit hash should match');
    });

    it('should produce smaller file with compression enabled', async () => {
      const graph = createSampleGraph();

      // Create two baselines
      const baseline: Baseline = {
        graph: {
          nodes: Array.from(graph.nodes.entries()),
          edges: graph.edges,
          commitHash: graph.commitHash ?? 'test-hash',
          timestamp: graph.timestamp ?? Date.now(),
        },
        commitHash: graph.commitHash ?? 'test-hash',
        timestamp: Date.now(),
        schemaVersion: { major: 1, minor: 1, patch: 0 },
        generatorVersion: '1.1.0',
        architectureConstraints: [],
        healthScore: 50,
        skillDemand: {
          testWriter: 0.5,
          refactorSpecialist: 0.3,
          architect: 0.2,
          securityReviewer: 0.1,
        },
      };

      // Save without compression
      await saveBaseline(baseline, testDir, { compress: false });
      const uncompressedSize = await readFile(baselinePath).then(c => c.length);

      // Reset directory
      await rm(testDir, { recursive: true, force: true });
      testDir = await mkdtemp(join(tmpdir(), 'codegraph-compression-'));
      await ensureCodegraphDir(testDir);
      baselinePath = getBaselinePath(testDir);

      // Save with compression
      await saveBaseline(baseline, testDir, { compress: true });
      const compressedSize = await readFile(baselinePath).then(c => c.length);

      // Compressed should be smaller (or equal for small graphs)
      assert.ok(
        compressedSize <= uncompressedSize,
        `Compressed (${compressedSize}) should be <= uncompressed (${uncompressedSize})`
      );
    });
  });

  // ============================================================================
  // Test Case 2: save without compression → load (legacy round-trip)
  // ============================================================================

  describe('5.7.2: Uncompressed save/load round-trip', () => {
    it('should save uncompressed baseline (1.0 format) and load it', async () => {
      const graph = createSampleGraph();
      const baseline: Baseline = {
        graph: {
          nodes: Array.from(graph.nodes.entries()),
          edges: graph.edges,
          commitHash: graph.commitHash ?? 'test-hash',
          timestamp: graph.timestamp ?? Date.now(),
        },
        commitHash: graph.commitHash ?? 'test-hash',
        timestamp: Date.now(),
        schemaVersion: { major: 1, minor: 0, patch: 0 },
        generatorVersion: '1.0.0',
        architectureConstraints: [],
        healthScore: 50,
        skillDemand: {
          testWriter: 0.5,
          refactorSpecialist: 0.3,
          architect: 0.2,
          securityReviewer: 0.1,
        },
      };

      // Save without compression (compress: false)
      await saveBaseline(baseline, testDir, { compress: false });

      // Verify file exists
      const exists = await stat(baselinePath).then(() => true).catch(() => false);
      assert.strictEqual(exists, true, 'Baseline file should exist');

      // Verify file format is 1.0 (has graph.nodes/edges structure)
      const content = await readFile(baselinePath, 'utf-8');
      const parsed = JSON.parse(content);
      const format = detectBaselineFormat(parsed);
      assert.strictEqual(format, '1.0', 'Format should be detected as 1.0');

      // Load and verify
      const loadedGraph = await loadBaselineFile(baselinePath);
      assert.ok(loadedGraph, 'Loaded graph should exist');
      assert.strictEqual(loadedGraph.nodes.size, graph.nodes.size, 'Node count should match');
    });
  });

  // ============================================================================
  // Test Case 3: load 1.0 baseline → migrate → return CodeGraph
  // ============================================================================

  describe('5.7.3: Legacy baseline migration', () => {
    it('should migrate 1.0 baseline to 1.1 and return CodeGraph', async () => {
      // Create a legacy 1.0 baseline directly
      const legacyBaseline = createLegacyBaseline();

      // Write it directly (bypassing saveBaseline to preserve 1.0 format)
      await writeFile(baselinePath, JSON.stringify(legacyBaseline, null, 2));

      // Verify format is 1.0
      const content = await readFile(baselinePath, 'utf-8');
      const parsed = JSON.parse(content);
      const format = detectBaselineFormat(parsed);
      assert.strictEqual(format, '1.0', 'Format should be detected as 1.0');

      // Load should migrate transparently
      const loadedGraph = await loadBaselineFile(baselinePath);
      assert.ok(loadedGraph, 'Loaded graph should exist after migration');

      // Verify nodes were reconstructed
      assert.ok(loadedGraph.nodes.size > 0, 'Nodes should be reconstructed');
    });

    it('should handle legacy baseline without schemaVersion', async () => {
      // Create legacy baseline without schemaVersion (very old format)
      const legacyData = {
        graph: {
          nodes: [
            ['FILE:src/main.ts', {
              id: 'FILE:src/main.ts',
              type: NodeType.FILE,
              path: 'src/main.ts',
              name: 'main.ts',
            }],
          ],
          edges: [],
          commitHash: 'legacy-hash',
          timestamp: 1000,
        },
        commitHash: 'legacy-hash',
        timestamp: 1000,
        generatorVersion: 'unknown',
        architectureConstraints: [],
        healthScore: 50,
        skillDemand: {
          testWriter: 0.5,
          refactorSpecialist: 0.3,
          architect: 0.2,
          securityReviewer: 0.1,
        },
      };

      await writeFile(baselinePath, JSON.stringify(legacyData, null, 2));

      // Load should handle migration
      const loadedGraph = await loadBaselineFile(baselinePath);
      assert.ok(loadedGraph, 'Should load legacy baseline');
      assert.strictEqual(loadedGraph.nodes.size, 1, 'Should have 1 node');
    });
  });

  // ============================================================================
  // Test Case 4: load 1.1 baseline → decompress → return CodeGraph
  // ============================================================================

  describe('5.7.4: Compressed baseline decompression', () => {
    it('should load 1.1 compressed baseline and decompress to CodeGraph', async () => {
      // Create a compressed baseline directly
      const graph = createSampleGraph();
      const config: CompressionConfig = {
        compression: { enabled: true, jsDocMaxLength: 100 },
      };
      const compressed = serializeCompressed(graph, config);

      // Write compressed baseline directly
      await writeFile(baselinePath, JSON.stringify(compressed, null, 2));

      // Verify format is 1.1
      const content = await readFile(baselinePath, 'utf-8');
      const parsed = JSON.parse(content);
      const format = detectBaselineFormat(parsed);
      assert.strictEqual(format, '1.1', 'Format should be detected as 1.1');

      // Load should decompress transparently
      const loadedGraph = await loadBaselineFile(baselinePath);
      assert.ok(loadedGraph, 'Loaded graph should exist');

      // Verify node IDs were reconstructed correctly
      for (const [id, node] of loadedGraph.nodes) {
        assert.ok(id.startsWith('FILE:') || id.startsWith('MODULE:') || id.startsWith('EXTERNAL:') || id.startsWith('DIRECTORY:'),
          `Node ID ${id} should have valid format`);
        assert.strictEqual(id, node.id, 'Node ID should match');
      }
    });

    it('should reconstruct IMPORTS_BATCH edges correctly', async () => {
      // Create graph with multiple IMPORTS edges (will be batched)
      const graph = new CodeGraph();

      // Add FILE node
      graph.addNode({
        id: 'FILE:src/index.ts',
        type: NodeType.FILE,
        path: 'src/index.ts',
        name: 'index.ts',
      });

      // Add multiple EXTERNAL nodes
      const externals = ['react', 'lodash', 'axios'];
      for (const pkg of externals) {
        graph.addNode({
          id: `EXTERNAL:${pkg}`,
          type: NodeType.EXTERNAL,
          path: pkg,
          name: pkg,
        });

        // Add IMPORTS edge (will be batched)
        graph.addEdge({
          from: 'FILE:src/index.ts',
          to: `EXTERNAL:${pkg}`,
          type: EdgeType.IMPORTS,
        });
      }

      graph.commitHash = 'batch-test';

      // Serialize with compression
      const config: CompressionConfig = { compression: { enabled: true } };
      const compressed = serializeCompressed(graph, config);

      // Verify IMPORTS_BATCH was created
      const importsBatch = compressed.edges.find(e => e.type === 'IMPORTS_BATCH');
      assert.ok(importsBatch, 'IMPORTS_BATCH should be created');

      // Write and load
      await writeFile(baselinePath, JSON.stringify(compressed, null, 2));
      const loadedGraph = await loadBaselineFile(baselinePath);

      // Verify all IMPORTS edges were reconstructed
      const importsEdges = loadedGraph.edges.filter(e => e.type === EdgeType.IMPORTS);
      assert.strictEqual(importsEdges.length, externals.length, 'All IMPORTS edges should be reconstructed');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge cases', () => {
    it('should throw error for corrupted baseline (invalid pathIndex)', async () => {
      const corruptedData = {
        schemaVersion: { major: 1, minor: 1, patch: 0 },
        pathTable: ['src/main.ts'],
        nodes: [
          { type: NodeType.FILE, pathIndex: 999, name: 'main.ts' }, // Invalid index
        ],
        edges: [],
        commitHash: 'corrupted',
        timestamp: 1000,
      };

      await writeFile(baselinePath, JSON.stringify(corruptedData, null, 2));

      // Load should throw or return error
      try {
        await loadBaselineFile(baselinePath);
        assert.fail('Should throw error for corrupted baseline');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw Error');
        assert.ok(
          error.message.includes('out of bounds') || error.message.includes('corrupted'),
          `Error message should mention corruption: ${error.message}`
        );
      }
    });

    it('should throw error for unrecognized baseline format', async () => {
      const unrecognizedData = {
        someField: 'value',
        anotherField: 123,
      };

      await writeFile(baselinePath, JSON.stringify(unrecognizedData, null, 2));

      try {
        await loadBaselineFile(baselinePath);
        assert.fail('Should throw error for unrecognized format');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw Error');
      }
    });
  });
});