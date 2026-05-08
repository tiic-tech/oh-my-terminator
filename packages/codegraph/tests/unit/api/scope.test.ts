/**
 * C7: Scope Query API Tests
 *
 * Tests for getScope and getQuickBrief functions following TDD workflow.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CodeGraph, NodeType, EdgeType, type GraphNode, type GraphEdge } from '../../../src/index.js';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a test graph with standard fixture structure
 */
function createTestGraph(): CodeGraph {
  const graph = new CodeGraph();

  // FILE nodes
  const indexFile: GraphNode = {
    id: 'FILE:src/index.ts',
    type: NodeType.FILE,
    path: 'src/index.ts',
    name: 'index.ts',
  };

  const formatFile: GraphNode = {
    id: 'FILE:src/utils/format.ts',
    type: NodeType.FILE,
    path: 'src/utils/format.ts',
    name: 'format.ts',
  };

  const mathFile: GraphNode = {
    id: 'FILE:src/utils/math.ts',
    type: NodeType.FILE,
    path: 'src/utils/math.ts',
    name: 'math.ts',
  };

  const configFile: GraphNode = {
    id: 'FILE:src/config.ts',
    type: NodeType.FILE,
    path: 'src/config.ts',
    name: 'config.ts',
  };

  const testFile: GraphNode = {
    id: 'FILE:src/__tests__/format.test.ts',
    type: NodeType.FILE,
    path: 'src/__tests__/format.test.ts',
    name: 'format.test.ts',
  };

  // MODULE nodes
  const formatDateModule: GraphNode = {
    id: 'MODULE:src/utils/format.ts#formatDate',
    type: NodeType.MODULE,
    path: 'src/utils/format.ts',
    name: 'formatDate',
    metadata: {
      kind: 'function',
      complexity: 3,
      deprecated: false,
    },
  };

  const formatNumberModule: GraphNode = {
    id: 'MODULE:src/utils/format.ts#formatNumber',
    type: NodeType.MODULE,
    path: 'src/utils/format.ts',
    name: 'formatNumber',
    metadata: {
      kind: 'function',
      complexity: 5,
      deprecated: false,
    },
  };

  const deprecatedModule: GraphNode = {
    id: 'MODULE:src/utils/format.ts#oldFormat',
    type: NodeType.MODULE,
    path: 'src/utils/format.ts',
    name: 'oldFormat',
    metadata: {
      kind: 'function',
      complexity: 2,
      deprecated: true,
    },
  };

  const mainModule: GraphNode = {
    id: 'MODULE:src/index.ts#main',
    type: NodeType.MODULE,
    path: 'src/index.ts',
    name: 'main',
    metadata: {
      kind: 'function',
      complexity: 8,
    },
  };

  // EXTERNAL nodes
  const lodashExternal: GraphNode = {
    id: 'EXTERNAL:lodash',
    type: NodeType.EXTERNAL,
    path: 'lodash',
    name: 'lodash',
  };

  // Add nodes
  graph.addNode(indexFile);
  graph.addNode(formatFile);
  graph.addNode(mathFile);
  graph.addNode(configFile);
  graph.addNode(testFile);
  graph.addNode(formatDateModule);
  graph.addNode(formatNumberModule);
  graph.addNode(deprecatedModule);
  graph.addNode(mainModule);
  graph.addNode(lodashExternal);

  // Add edges
  // index.ts imports format.ts (2 symbols = 2 edges per A4)
  graph.addEdge({
    from: 'FILE:src/index.ts',
    to: 'FILE:src/utils/format.ts',
    type: EdgeType.IMPORTS,
    metadata: { importSpecifier: 'named:formatDate' },
  });
  graph.addEdge({
    from: 'FILE:src/index.ts',
    to: 'FILE:src/utils/format.ts',
    type: EdgeType.IMPORTS,
    metadata: { importSpecifier: 'named:formatNumber' },
  });

  // index.ts imports math.ts
  graph.addEdge({
    from: 'FILE:src/index.ts',
    to: 'FILE:src/utils/math.ts',
    type: EdgeType.IMPORTS,
  });

  // index.ts imports config.ts
  graph.addEdge({
    from: 'FILE:src/index.ts',
    to: 'FILE:src/config.ts',
    type: EdgeType.IMPORTS,
  });

  // index.ts imports lodash (external)
  graph.addEdge({
    from: 'FILE:src/index.ts',
    to: 'EXTERNAL:lodash',
    type: EdgeType.IMPORTS,
  });

  // test file imports format.ts
  graph.addEdge({
    from: 'FILE:src/__tests__/format.test.ts',
    to: 'FILE:src/utils/format.ts',
    type: EdgeType.IMPORTS,
  });

  return graph;
}

// ============================================================================
// normalizeTarget Tests (Task 2.1)
// ============================================================================

describe('normalizeTarget', () => {
  let graph: CodeGraph;

  beforeEach(() => {
    graph = createTestGraph();
  });

  it('should handle FILE: prefix directly', async () => {
    const { normalizeTarget } = await import('../../../src/api/scope/index.js');
    const result = normalizeTarget(graph, 'FILE:src/utils/format.ts');
    assert.strictEqual(result.targetType, 'FILE');
    assert.ok(result.fileNode);
    assert.strictEqual(result.fileNode?.id, 'FILE:src/utils/format.ts');
    assert.strictEqual(result.moduleNode, null);
  });

  it('should resolve MODULE: prefix to parent FILE', async () => {
    const { normalizeTarget } = await import('../../../src/api/scope/index.js');
    const result = normalizeTarget(graph, 'MODULE:src/utils/format.ts#formatDate');
    assert.strictEqual(result.targetType, 'MODULE');
    assert.ok(result.fileNode);
    assert.strictEqual(result.fileNode?.id, 'FILE:src/utils/format.ts');
    assert.ok(result.moduleNode);
    assert.strictEqual(result.moduleNode?.id, 'MODULE:src/utils/format.ts#formatDate');
  });

  it('should handle EXTERNAL: prefix (A1 resolution)', async () => {
    const { normalizeTarget } = await import('../../../src/api/scope/index.js');
    const result = normalizeTarget(graph, 'EXTERNAL:lodash');
    assert.strictEqual(result.targetType, 'EXTERNAL');
    assert.ok(result.fileNode);
    assert.strictEqual(result.fileNode?.id, 'EXTERNAL:lodash');
    assert.strictEqual(result.moduleNode, null);
  });

  it('should auto-prefix plain path with FILE:', async () => {
    const { normalizeTarget } = await import('../../../src/api/scope/index.js');
    const result = normalizeTarget(graph, 'src/utils/format.ts');
    assert.strictEqual(result.targetType, 'PATH');
    assert.ok(result.fileNode);
    assert.strictEqual(result.fileNode?.id, 'FILE:src/utils/format.ts');
  });

  it('should return null for nonexistent FILE', async () => {
    const { normalizeTarget } = await import('../../../src/api/scope/index.js');
    const result = normalizeTarget(graph, 'FILE:src/nonexistent.ts');
    assert.strictEqual(result.fileNode, null);
  });

  it('should return null for nonexistent MODULE (A5 resolution)', async () => {
    const { normalizeTarget } = await import('../../../src/api/scope/index.js');
    const result = normalizeTarget(graph, 'MODULE:src/utils/format.ts#nonexistentExport');
    assert.strictEqual(result.targetType, 'MODULE');
    assert.strictEqual(result.moduleNode, null);
    assert.strictEqual(result.fileNode, null);
  });
});

// ============================================================================
// extractExports Tests (Task 2.2)
// ============================================================================

describe('extractExports', () => {
  let graph: CodeGraph;

  beforeEach(() => {
    graph = createTestGraph();
  });

  it('should return exports in kind:name format, sorted', async () => {
    const { extractExports } = await import('../../../src/api/scope/index.js');
    const fileNode = graph.getNode('FILE:src/utils/format.ts')!;
    const exports = extractExports(graph, fileNode);
    assert.ok(exports.includes('function:formatDate'));
    assert.ok(exports.includes('function:formatNumber'));
    assert.ok(exports.includes('function:oldFormat'));
    assert.strictEqual(exports.length, 3);
    // Should be sorted
    assert.strictEqual(exports[0], 'function:formatDate');
  });

  it('should return empty array for FILE with no MODULE nodes', async () => {
    const { extractExports } = await import('../../../src/api/scope/index.js');
    const fileNode = graph.getNode('FILE:src/utils/math.ts')!;
    const exports = extractExports(graph, fileNode);
    assert.deepStrictEqual(exports, []);
  });
});

// ============================================================================
// extractImports Tests (Task 2.3)
// ============================================================================

describe('extractImports', () => {
  let graph: CodeGraph;

  beforeEach(() => {
    graph = createTestGraph();
  });

  it('should extract import targets from outEdges', async () => {
    const { extractImports } = await import('../../../src/api/scope/index.js');
    const fileNode = graph.getNode('FILE:src/index.ts')!;
    const imports = extractImports(graph, fileNode);
    assert.ok(imports.includes('src/utils/format.ts'));
    assert.ok(imports.includes('src/utils/math.ts'));
    assert.ok(imports.includes('src/config.ts'));
    assert.ok(imports.includes('lodash'));
  });

  it('should return empty array for leaf files', async () => {
    const { extractImports } = await import('../../../src/api/scope/index.js');
    const fileNode = graph.getNode('FILE:src/utils/format.ts')!;
    const imports = extractImports(graph, fileNode);
    assert.deepStrictEqual(imports, []);
  });
});

// ============================================================================
// extractImportedBy Tests (Task 2.4)
// ============================================================================

describe('extractImportedBy', () => {
  let graph: CodeGraph;

  beforeEach(() => {
    graph = createTestGraph();
  });

  it('should extract reverse dependencies from inEdges', async () => {
    const { extractImportedBy } = await import('../../../src/api/scope/index.js');
    const fileNode = graph.getNode('FILE:src/utils/format.ts')!;
    const importedBy = extractImportedBy(graph, fileNode);
    assert.ok(importedBy.includes('src/index.ts'));
    assert.ok(importedBy.includes('src/__tests__/format.test.ts'));
  });

  it('should NOT include DYNAMIC_IMPORTS (A2 resolution)', async () => {
    const { extractImportedBy } = await import('../../../src/api/scope/index.js');
    // Add a dynamic import edge
    graph.addNode({
      id: 'FILE:src/dynamic.ts',
      type: NodeType.FILE,
      path: 'src/dynamic.ts',
      name: 'dynamic.ts',
    });
    graph.addEdge({
      from: 'FILE:src/dynamic.ts',
      to: 'FILE:src/utils/format.ts',
      type: EdgeType.DYNAMIC_IMPORTS,
    });

    const fileNode = graph.getNode('FILE:src/utils/format.ts')!;
    const importedBy = extractImportedBy(graph, fileNode);
    assert.ok(!importedBy.includes('src/dynamic.ts'));
  });

  it('should return empty array for entry point files', async () => {
    const { extractImportedBy } = await import('../../../src/api/scope/index.js');
    const fileNode = graph.getNode('FILE:src/index.ts')!;
    const importedBy = extractImportedBy(graph, fileNode);
    assert.deepStrictEqual(importedBy, []);
  });
});

// ============================================================================
// aggregateComplexity Tests (Task 2.6)
// ============================================================================

describe('aggregateComplexity', () => {
  let graph: CodeGraph;

  beforeEach(() => {
    graph = createTestGraph();
  });

  it('should aggregate MODULE complexity values for FILE', async () => {
    const { aggregateComplexity } = await import('../../../src/api/scope/index.js');
    const fileNode = graph.getNode('FILE:src/utils/format.ts')!;
    const complexity = aggregateComplexity(graph, fileNode);
    // 3 + 5 + 2 = 10, which is medium (6-15)
    assert.strictEqual(complexity.value, 10);
    assert.strictEqual(complexity.level, 'medium');
  });

  it('should return direct complexity for MODULE node', async () => {
    const { aggregateComplexity } = await import('../../../src/api/scope/index.js');
    const fileNode = graph.getNode('FILE:src/utils/format.ts')!;
    const moduleNode = graph.getNode('MODULE:src/utils/format.ts#formatDate')!;
    const complexity = aggregateComplexity(graph, fileNode, moduleNode);
    assert.strictEqual(complexity.value, 3);
    assert.strictEqual(complexity.level, 'low');
  });

  it('should return "unknown" when no MODULE data (A6 resolution)', async () => {
    const { aggregateComplexity } = await import('../../../src/api/scope/index.js');
    const fileNode = graph.getNode('FILE:src/utils/math.ts')!;
    const complexity = aggregateComplexity(graph, fileNode);
    assert.strictEqual(complexity.level, 'unknown');
    assert.strictEqual(complexity.value, 0);
  });
});

// ============================================================================
// checkDeprecated Tests (Task 2.7)
// ============================================================================

describe('checkDeprecated', () => {
  let graph: CodeGraph;

  beforeEach(() => {
    graph = createTestGraph();
  });

  it('should return true when any MODULE is deprecated', async () => {
    const { checkDeprecated } = await import('../../../src/api/scope/index.js');
    const fileNode = graph.getNode('FILE:src/utils/format.ts')!;
    const deprecated = checkDeprecated(graph, fileNode);
    assert.strictEqual(deprecated, true);
  });

  it('should return false when no MODULE is deprecated', async () => {
    const { checkDeprecated } = await import('../../../src/api/scope/index.js');
    const fileNode = graph.getNode('FILE:src/index.ts')!;
    const deprecated = checkDeprecated(graph, fileNode);
    assert.strictEqual(deprecated, false);
  });
});

// ============================================================================
// countImports/countImportedBy Tests (Tasks 3.1-3.2, A4 Resolution)
// ============================================================================

describe('countImports', () => {
  let graph: CodeGraph;

  beforeEach(() => {
    graph = createTestGraph();
  });

  it('should count edges, not unique files (A4 resolution)', async () => {
    const { countImports } = await import('../../../src/api/scope/index.js');
    const fileNode = graph.getNode('FILE:src/index.ts')!;
    // index.ts has 5 IMPORTS edges: format.ts (2), math.ts (1), config.ts (1), lodash (1)
    const count = countImports(graph, fileNode);
    assert.strictEqual(count, 5);
  });

  it('should include DYNAMIC_IMPORTS in count', async () => {
    const { countImports } = await import('../../../src/api/scope/index.js');
    graph.addNode({
      id: 'FILE:src/dynamic.ts',
      type: NodeType.FILE,
      path: 'src/dynamic.ts',
      name: 'dynamic.ts',
    });
    graph.addEdge({
      from: 'FILE:src/dynamic.ts',
      to: 'FILE:src/utils/format.ts',
      type: EdgeType.DYNAMIC_IMPORTS,
    });

    const fileNode = graph.getNode('FILE:src/dynamic.ts')!;
    const count = countImports(graph, fileNode);
    assert.strictEqual(count, 1);
  });
});

describe('countImportedBy', () => {
  let graph: CodeGraph;

  beforeEach(() => {
    graph = createTestGraph();
  });

  it('should count edges, excluding DYNAMIC_IMPORTS', async () => {
    const { countImportedBy } = await import('../../../src/api/scope/index.js');
    const fileNode = graph.getNode('FILE:src/utils/format.ts')!;
    // format.ts is imported by index.ts (2 edges) and test file (1 edge) = 3 edges
    const count = countImportedBy(graph, fileNode);
    assert.strictEqual(count, 3);
  });

  it('should NOT count DYNAMIC_IMPORTS (A2 resolution)', async () => {
    const { countImportedBy } = await import('../../../src/api/scope/index.js');
    graph.addNode({
      id: 'FILE:src/dynamic.ts',
      type: NodeType.FILE,
      path: 'src/dynamic.ts',
      name: 'dynamic.ts',
    });
    graph.addEdge({
      from: 'FILE:src/dynamic.ts',
      to: 'FILE:src/utils/format.ts',
      type: EdgeType.DYNAMIC_IMPORTS,
    });

    const fileNode = graph.getNode('FILE:src/utils/format.ts')!;
    const count = countImportedBy(graph, fileNode);
    // Should still be 3, not 4
    assert.strictEqual(count, 3);
  });
});

// ============================================================================
// getScope Tests (Tasks 2.10, 5.2-5.8)
// ============================================================================

describe('getScope', () => {
  let graph: CodeGraph;

  beforeEach(() => {
    graph = createTestGraph();
  });

  it('should return exports for FILE node', async () => {
    const { getScope } = await import('../../../src/api/scope/index.js');
    const result = getScope(graph, 'FILE:src/utils/format.ts');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.exports.length, 3);
    assert.ok(result.exports.map(e => e.name).includes('formatDate'));
  });

  it('should return imports for FILE node', async () => {
    const { getScope } = await import('../../../src/api/scope/index.js');
    const result = getScope(graph, 'FILE:src/index.ts');
    assert.strictEqual(result.success, true);
    assert.ok(result.imports.length > 0);
  });

  it('should return importedBy for FILE node', async () => {
    const { getScope } = await import('../../../src/api/scope/index.js');
    const result = getScope(graph, 'FILE:src/utils/format.ts');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.importedBy.length, 2);
    assert.ok(result.importedBy.map(i => i.file).includes('src/index.ts'));
  });

  it('should handle MODULE node query', async () => {
    const { getScope } = await import('../../../src/api/scope/index.js');
    const result = getScope(graph, 'MODULE:src/utils/format.ts#formatDate');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.target, 'MODULE:src/utils/format.ts#formatDate');
  });

  it('should handle EXTERNAL node query (A1 verification)', async () => {
    const { getScope } = await import('../../../src/api/scope/index.js');
    const result = getScope(graph, 'EXTERNAL:lodash');
    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.exports, []);
    assert.deepStrictEqual(result.imports, []);
    assert.strictEqual(result.importedBy.length, 1);
    assert.strictEqual(result.importedBy[0].file, 'src/index.ts');
  });

  it('should return error for nonexistent FILE target', async () => {
    const { getScope } = await import('../../../src/api/scope/index.js');
    const result = getScope(graph, 'FILE:src/nonexistent.ts');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error?.code, 'E001_TARGET_NOT_FOUND');
  });

  it('should return warning for nonexistent MODULE (A5 verification)', async () => {
    const { getScope } = await import('../../../src/api/scope/index.js');
    const result = getScope(graph, 'MODULE:src/utils/format.ts#nonexistentExport');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error?.code, 'E001_TARGET_NOT_FOUND');
    assert.ok(result.error?.message.includes('MODULE'));
  });

  it('should mark isolated files correctly', async () => {
    const { getScope } = await import('../../../src/api/scope/index.js');
    const result = getScope(graph, 'FILE:src/index.ts');
    assert.strictEqual(result.importedBy.length, 0);
    assert.ok(result.content.includes('none'));
  });

  it('should return complexity unknown for files without MODULE data (A6 verification)', async () => {
    const { getScope } = await import('../../../src/api/scope/index.js');
    const result = getScope(graph, 'FILE:src/utils/math.ts');
    assert.strictEqual(result.complexity.level, 'unknown');
  });

  it('should detect deprecated status', async () => {
    const { getScope } = await import('../../../src/api/scope/index.js');
    const result = getScope(graph, 'FILE:src/utils/format.ts');
    assert.strictEqual(result.metadata.deprecated, true);
  });

  it('should include Agent-friendly Markdown content', async () => {
    const { getScope } = await import('../../../src/api/scope/index.js');
    const result = getScope(graph, 'FILE:src/utils/format.ts');
    assert.ok(result.content.includes('## Scope:'));
    assert.ok(result.content.includes('Exports'));
  });

  it('should handle plain path input', async () => {
    const { getScope } = await import('../../../src/api/scope/index.js');
    const result = getScope(graph, 'src/utils/format.ts');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.target, 'FILE:src/utils/format.ts');
  });
});

// ============================================================================
// getQuickBrief Tests (Tasks 3.4, 5.9-5.11)
// ============================================================================

describe('getQuickBrief', () => {
  let graph: CodeGraph;

  beforeEach(() => {
    graph = createTestGraph();
  });

  it('should return counts without detailed lists', async () => {
    const { getQuickBrief } = await import('../../../src/api/scope/index.js');
    const result = getQuickBrief(graph, 'src/index.ts');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.imports, 5); // Edge count (A4)
    assert.strictEqual(result.importedBy, 0);
  });

  it('should accept both FILE: prefix and plain path', async () => {
    const { getQuickBrief } = await import('../../../src/api/scope/index.js');
    const result1 = getQuickBrief(graph, 'FILE:src/index.ts');
    const result2 = getQuickBrief(graph, 'src/index.ts');
    assert.strictEqual(result1.imports, result2.imports);
  });

  it('should return error for nonexistent file', async () => {
    const { getQuickBrief } = await import('../../../src/api/scope/index.js');
    const result = getQuickBrief(graph, 'src/nonexistent.ts');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error?.code, 'E001_TARGET_NOT_FOUND');
  });

  it('should detect test file', async () => {
    const { getQuickBrief } = await import('../../../src/api/scope/index.js');
    const result = getQuickBrief(graph, 'src/utils/format.ts');
    assert.strictEqual(result.hasTest, true);
  });

  it('should detect deprecated flag', async () => {
    const { getQuickBrief } = await import('../../../src/api/scope/index.js');
    const result = getQuickBrief(graph, 'src/utils/format.ts');
    assert.strictEqual(result.deprecated, true);
  });

  it('should return correct complexity level', async () => {
    const { getQuickBrief } = await import('../../../src/api/scope/index.js');
    const result = getQuickBrief(graph, 'src/utils/format.ts');
    assert.strictEqual(result.complexityLevel, 'medium');
  });

  it('should return unknown complexity for files without MODULE data', async () => {
    const { getQuickBrief } = await import('../../../src/api/scope/index.js');
    const result = getQuickBrief(graph, 'src/utils/math.ts');
    assert.strictEqual(result.complexityLevel, 'unknown');
  });

  it('should generate quickFacts', async () => {
    const { getQuickBrief } = await import('../../../src/api/scope/index.js');
    const result = getQuickBrief(graph, 'src/index.ts');
    assert.ok(result.quickFacts.length > 0);
    assert.ok(result.quickFacts.some(f => f.includes('imports')));
  });

  it('should generate Markdown content', async () => {
    const { getQuickBrief } = await import('../../../src/api/scope/index.js');
    const result = getQuickBrief(graph, 'src/index.ts');
    assert.ok(result.content.includes('## Brief:'));
    assert.ok(result.content.includes('Imports:'));
  });
});