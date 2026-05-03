import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { scanDirectory } from '../../src/scanner.js';
import { CodeGraph } from '../../src/graph.js';
import { NodeType, EdgeType } from '../../src/types.js';

const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');

describe('Integration: scanner → graph', () => {
  it('should add scanned nodes and edges to a CodeGraph', async () => {
    const testDir = path.join(fixturesDir, 'simple');
    const result = await scanDirectory(testDir);
    const graph = new CodeGraph();

    // Add all nodes to graph
    for (const node of result.nodes) {
      graph.addNode(node);
    }

    // Add all edges to graph
    for (const edge of result.edges) {
      graph.addEdge(edge);
    }

    // Verify nodes exist in graph
    assert.ok(graph.nodes.size > 0, 'Graph should have nodes');
    assert.ok(graph.edges.length > 0, 'Graph should have edges');

    // Verify all scanned nodes are in graph
    for (const node of result.nodes) {
      assert.ok(graph.nodes.has(node.id), `Node ${node.id} should be in graph`);
    }

    // Verify all scanned edges are in graph
    assert.strictEqual(graph.edges.length, result.edges.length);
  });

  it('should create correct graph structure for nested directories', async () => {
    const testDir = path.join(fixturesDir, 'nested');
    const result = await scanDirectory(testDir);
    const graph = new CodeGraph();

    for (const node of result.nodes) {
      graph.addNode(node);
    }
    for (const edge of result.edges) {
      graph.addEdge(edge);
    }

    // Find root directory node
    const rootDir = result.nodes.find(n => n.id === 'DIRECTORY:.');
    assert.ok(rootDir, 'Should have root directory node');

    // Find CONTAINS edges from root
    const rootEdges = graph.edges.filter(
      e => e.from === 'DIRECTORY:.'
    );
    assert.ok(rootEdges.length > 0, 'Root should have CONTAINS edges');

    // Verify all edges are CONTAINS type
    for (const edge of graph.edges) {
      assert.strictEqual(edge.type, EdgeType.CONTAINS);
    }
  });

  it('should preserve file paths in nodes', async () => {
    const testDir = path.join(fixturesDir, 'simple');
    const result = await scanDirectory(testDir);
    const graph = new CodeGraph();

    for (const node of result.nodes) {
      graph.addNode(node);
    }

    // Get all file nodes
    const fileNodes = result.nodes.filter(n => n.type === NodeType.FILE);
    for (const node of fileNodes) {
      // Verify node ID matches path pattern
      assert.ok(node.id.startsWith('FILE:'));
      assert.ok(node.path.endsWith('.ts') || node.path.endsWith('.tsx'));
    }
  });

  it('should have correct edge relationships in graph indexes', async () => {
    const testDir = path.join(fixturesDir, 'nested');
    const result = await scanDirectory(testDir);
    const graph = new CodeGraph();

    for (const node of result.nodes) {
      graph.addNode(node);
    }
    for (const edge of result.edges) {
      graph.addEdge(edge);
    }

    // Verify inEdges/outEdges indexes
    for (const edge of graph.edges) {
      const sourceOutEdges = graph.outEdges.get(edge.from) || [];
      const targetInEdges = graph.inEdges.get(edge.to) || [];

      assert.ok(sourceOutEdges.includes(edge), `outEdges for ${edge.from} should include edge`);
      assert.ok(targetInEdges.includes(edge), `inEdges for ${edge.to} should include edge`);
    }
  });
});