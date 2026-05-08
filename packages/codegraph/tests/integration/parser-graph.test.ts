import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { scanDirectory } from '../../src/scanner.js';
import { parseImports } from '../../src/parser/index.js';
import { CodeGraph } from '../../src/graph.js';
import { NodeType, EdgeType } from '../../src/types.js';

const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');
const importTestProject = path.join(fixturesDir, 'import-test-project');

describe('Integration: scanner → parser → graph', () => {
  it('should scan files, parse imports, and add to graph', async () => {
    // Step 1: Scan directory
    const scanResult = await scanDirectory(importTestProject);
    const graph = new CodeGraph();

    // Add scanned nodes and edges
    for (const node of scanResult.nodes) {
      graph.addNode(node);
    }
    for (const edge of scanResult.edges) {
      graph.addEdge(edge);
    }

    // Step 2: Parse imports from filesToParse
    const parserResult = parseImports(
      scanResult.filesToParse.map(f => path.join(importTestProject, f)),
      importTestProject
    );

    // Add EXTERNAL nodes from parser
    for (const node of parserResult.nodes) {
      graph.addNode(node);
    }

    // Add IMPORTS/RE_EXPORTS/DYNAMIC_IMPORTS edges from parser
    for (const edge of parserResult.edges) {
      graph.addEdge(edge);
    }

    // Verify graph has nodes
    assert.ok(graph.nodes.size > 0, 'Graph should have nodes');

    // Verify we have FILE nodes
    const fileNodes = Array.from(graph.nodes.values()).filter(n => n.type === NodeType.FILE);
    assert.ok(fileNodes.length > 0, 'Should have FILE nodes');

    // Verify we have EXTERNAL nodes
    const externalNodes = Array.from(graph.nodes.values()).filter(n => n.type === NodeType.EXTERNAL);
    assert.ok(externalNodes.length > 0, 'Should have EXTERNAL nodes for external imports');

    // Verify we have IMPORTS edges
    const importEdges = graph.edges.filter(e => e.type === EdgeType.IMPORTS);
    assert.ok(importEdges.length > 0, 'Should have IMPORTS edges');

    // Verify we have CONTAINS edges (from scanner)
    const containsEdges = graph.edges.filter(e => e.type === EdgeType.CONTAINS);
    assert.ok(containsEdges.length > 0, 'Should have CONTAINS edges');

    // Verify import edges point to valid nodes
    for (const edge of importEdges) {
      const targetExists = graph.nodes.has(edge.to);
      assert.ok(targetExists, `Import edge target ${edge.to} should exist in graph`);
    }
  });

  it('should correctly handle lodash external import', async () => {
    const scanResult = await scanDirectory(importTestProject);
    const parserResult = parseImports(
      scanResult.filesToParse.map(f => path.join(importTestProject, f)),
      importTestProject
    );

    // Should have EXTERNAL:lodash node
    const lodashNode = parserResult.nodes.find(n =>
      n.type === NodeType.EXTERNAL && n.name === 'lodash'
    );
    assert.ok(lodashNode, 'Should create EXTERNAL:lodash node');

    // Should have edges to lodash
    const lodashEdges = parserResult.edges.filter(e =>
      e.to === 'EXTERNAL:lodash'
    );
    assert.ok(lodashEdges.length >= 2, 'Should have multiple edges to lodash (debounce imports)');
  });

  it('should resolve alias paths correctly', async () => {
    const scanResult = await scanDirectory(importTestProject);
    const parserResult = parseImports(
      scanResult.filesToParse.map(f => path.join(importTestProject, f)),
      importTestProject
    );

    // Find edges from aliased-import.ts
    const aliasEdges = parserResult.edges.filter(e =>
      e.from.includes('aliased-import')
    );

    assert.ok(aliasEdges.length > 0, 'Should have edges from aliased-import file');

    // Should resolve @utils alias to actual file
    const resolvedAliasEdge = aliasEdges.find(e =>
      e.to.startsWith('FILE:') && e.to.includes('shared')
    );
    assert.ok(resolvedAliasEdge, 'Should resolve @utils alias to shared/utils');
  });

  it('should generate correct importSpecifier metadata', async () => {
    const scanResult = await scanDirectory(importTestProject);
    const parserResult = parseImports(
      scanResult.filesToParse.map(f => path.join(importTestProject, f)),
      importTestProject
    );

    // Check named import specifier
    const namedImport = parserResult.edges.find(e =>
      e.metadata?.importSpecifier?.startsWith('named:')
    );
    assert.ok(namedImport, 'Should have named import edge');

    // Check default import specifier
    const defaultImport = parserResult.edges.find(e =>
      e.metadata?.importSpecifier === 'default'
    );
    assert.ok(defaultImport, 'Should have default import edge');

    // Check namespace import specifier
    const namespaceImport = parserResult.edges.find(e =>
      e.metadata?.importSpecifier === 'namespace'
    );
    assert.ok(namespaceImport, 'Should have namespace import edge');

    // Check wildcard re-export specifier
    const wildcardExport = parserResult.edges.find(e =>
      e.type === EdgeType.RE_EXPORTS &&
      e.metadata?.importSpecifier === 'wildcard'
    );
    assert.ok(wildcardExport, 'Should have wildcard re-export edge');
  });
});