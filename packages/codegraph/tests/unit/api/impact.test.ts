/**
 * C8: Impact Analysis API Tests
 *
 * Tests for getImpact function following TDD workflow.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CodeGraph, NodeType, EdgeType, type GraphNode, type GraphEdge } from '../../../src/index.js';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a test graph with standard fixture structure for impact analysis
 */
function createImpactTestGraph(): CodeGraph {
  const graph = new CodeGraph();

  // FILE nodes - layered structure
  // Layer 1 (Foundation): utils/format.ts, types/api.ts
  // Layer 2 (Core): services/auth.ts, services/api.ts, components/Modal.tsx
  // Layer 3 (Application): pages/Home.tsx, pages/Dashboard.tsx, pages/Login.tsx
  // Layer 4 (Presentation): index.ts

  const formatFile: GraphNode = {
    id: 'FILE:src/utils/format.ts',
    type: NodeType.FILE,
    path: 'src/utils/format.ts',
    name: 'format.ts',
  };

  const apiTypesFile: GraphNode = {
    id: 'FILE:src/types/api.ts',
    type: NodeType.FILE,
    path: 'src/types/api.ts',
    name: 'api.ts',
  };

  const authFile: GraphNode = {
    id: 'FILE:src/services/auth.ts',
    type: NodeType.FILE,
    path: 'src/services/auth.ts',
    name: 'auth.ts',
  };

  const apiFile: GraphNode = {
    id: 'FILE:src/services/api.ts',
    type: NodeType.FILE,
    path: 'src/services/api.ts',
    name: 'api.ts',
  };

  const modalFile: GraphNode = {
    id: 'FILE:src/components/Modal.tsx',
    type: NodeType.FILE,
    path: 'src/components/Modal.tsx',
    name: 'Modal.tsx',
  };

  const homeFile: GraphNode = {
    id: 'FILE:src/pages/Home.tsx',
    type: NodeType.FILE,
    path: 'src/pages/Home.tsx',
    name: 'Home.tsx',
  };

  const dashboardFile: GraphNode = {
    id: 'FILE:src/pages/Dashboard.tsx',
    type: NodeType.FILE,
    path: 'src/pages/Dashboard.tsx',
    name: 'Dashboard.tsx',
  };

  const loginFile: GraphNode = {
    id: 'FILE:src/pages/Login.tsx',
    type: NodeType.FILE,
    path: 'src/pages/Login.tsx',
    name: 'Login.tsx',
  };

  const indexFile: GraphNode = {
    id: 'FILE:src/index.ts',
    type: NodeType.FILE,
    path: 'src/index.ts',
    name: 'index.ts',
  };

  const testFile: GraphNode = {
    id: 'FILE:src/__tests__/format.test.ts',
    type: NodeType.FILE,
    path: 'src/__tests__/format.test.ts',
    name: 'format.test.ts',
  };

  const isolatedFile: GraphNode = {
    id: 'FILE:src/isolated.ts',
    type: NodeType.FILE,
    path: 'src/isolated.ts',
    name: 'isolated.ts',
  };

  const dynamicFile: GraphNode = {
    id: 'FILE:src/dynamic.ts',
    type: NodeType.FILE,
    path: 'src/dynamic.ts',
    name: 'dynamic.ts',
  };

  // Add nodes
  graph.addNode(formatFile);
  graph.addNode(apiTypesFile);
  graph.addNode(authFile);
  graph.addNode(apiFile);
  graph.addNode(modalFile);
  graph.addNode(homeFile);
  graph.addNode(dashboardFile);
  graph.addNode(loginFile);
  graph.addNode(indexFile);
  graph.addNode(testFile);
  graph.addNode(isolatedFile);
  graph.addNode(dynamicFile);

  // MODULE node for testing MODULE target resolution
  const formatDateModule: GraphNode = {
    id: 'MODULE:src/utils/format.ts#formatDate',
    type: NodeType.MODULE,
    path: 'src/utils/format.ts',
    name: 'formatDate',
    metadata: { kind: 'function', complexity: 3 },
  };
  graph.addNode(formatDateModule);

  // IMPORTS edges - dependency chain
  // services/auth.ts imports utils/format.ts (direct dependent)
  graph.addEdge({
    from: 'FILE:src/services/auth.ts',
    to: 'FILE:src/utils/format.ts',
    type: EdgeType.IMPORTS,
  });

  // services/api.ts imports utils/format.ts (direct dependent)
  graph.addEdge({
    from: 'FILE:src/services/api.ts',
    to: 'FILE:src/utils/format.ts',
    type: EdgeType.IMPORTS,
  });

  // components/Modal.tsx imports utils/format.ts (direct dependent)
  graph.addEdge({
    from: 'FILE:src/components/Modal.tsx',
    to: 'FILE:src/utils/format.ts',
    type: EdgeType.IMPORTS,
  });

  // pages/Home.tsx imports services/auth.ts (indirect via auth.ts)
  graph.addEdge({
    from: 'FILE:src/pages/Home.tsx',
    to: 'FILE:src/services/auth.ts',
    type: EdgeType.IMPORTS,
  });

  // pages/Home.tsx imports components/Modal.tsx (indirect via Modal.tsx)
  graph.addEdge({
    from: 'FILE:src/pages/Home.tsx',
    to: 'FILE:src/components/Modal.tsx',
    type: EdgeType.IMPORTS,
  });

  // pages/Dashboard.tsx imports services/api.ts (indirect via api.ts)
  graph.addEdge({
    from: 'FILE:src/pages/Dashboard.tsx',
    to: 'FILE:src/services/api.ts',
    type: EdgeType.IMPORTS,
  });

  // pages/Login.tsx imports services/auth.ts (indirect via auth.ts)
  graph.addEdge({
    from: 'FILE:src/pages/Login.tsx',
    to: 'FILE:src/services/auth.ts',
    type: EdgeType.IMPORTS,
  });

  // index.ts imports pages/Home.tsx (indirect via Home.tsx)
  graph.addEdge({
    from: 'FILE:src/index.ts',
    to: 'FILE:src/pages/Home.tsx',
    type: EdgeType.IMPORTS,
  });

  // Test file imports format.ts (C8-1: test exclusion test)
  graph.addEdge({
    from: 'FILE:src/__tests__/format.test.ts',
    to: 'FILE:src/utils/format.ts',
    type: EdgeType.IMPORTS,
  });

  // Dynamic import edge (C8-6: should NOT be traversed)
  graph.addEdge({
    from: 'FILE:src/dynamic.ts',
    to: 'FILE:src/utils/format.ts',
    type: EdgeType.DYNAMIC_IMPORTS,
  });

  // RE_EXPORTS edge (should be traversed like IMPORTS)
  graph.addEdge({
    from: 'FILE:src/services/api.ts',
    to: 'FILE:src/types/api.ts',
    type: EdgeType.RE_EXPORTS,
  });

  return graph;
}

// ============================================================================
// getImpact Tests
// ============================================================================

describe('getImpact', () => {
  let graph: CodeGraph;

  beforeEach(() => {
    graph = createImpactTestGraph();
  });

  // Task 5.2: Test single target with direct dependents
  it('should return direct dependents', async () => {
    const { getImpact } = await import('../../../src/api/impact/index.js');
    const result = getImpact(graph, ['FILE:src/utils/format.ts']);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.summary.direct, 3);
    assert.ok(result.affectedFiles.some(f => f.path === 'src/services/auth.ts' && f.distance === 1));
    assert.ok(result.affectedFiles.some(f => f.path === 'src/services/api.ts' && f.distance === 1));
    assert.ok(result.affectedFiles.some(f => f.path === 'src/components/Modal.tsx' && f.distance === 1));
  });

  // Task 5.3: Test indirect dependents via BFS traversal
  it('should traverse indirect dependents via BFS', async () => {
    const { getImpact } = await import('../../../src/api/impact/index.js');
    const result = getImpact(graph, ['FILE:src/utils/format.ts']);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.summary.indirect, 4);
    // pages/Home.tsx is indirect via auth.ts and Modal.tsx
    assert.ok(result.affectedFiles.some(f => f.path === 'src/pages/Home.tsx' && f.distance === 2));
    assert.ok(result.affectedFiles.some(f => f.path === 'src/pages/Dashboard.tsx' && f.distance === 2));
    assert.ok(result.affectedFiles.some(f => f.path === 'src/pages/Login.tsx' && f.distance === 2));
    assert.ok(result.affectedFiles.some(f => f.path === 'src/index.ts' && f.distance === 3));
  });

  // Task 5.4: Test multi-target merge
  it('should merge multi-target with minimum distance', async () => {
    const { getImpact } = await import('../../../src/api/impact/index.js');
    const result = getImpact(graph, ['FILE:src/utils/format.ts', 'FILE:src/types/api.ts']);

    assert.strictEqual(result.success, true);
    // C8-12: distance should be minimum across targets
    // api.ts imports format.ts, so format.ts dependents are also api.ts dependents
    // services/api.ts imports both format.ts and types/api.ts
  });

  // Task 5.5: Test test file exclusion
  it('should exclude test files by default (C8-1)', async () => {
    const { getImpact } = await import('../../../src/api/impact/index.js');
    const result = getImpact(graph, ['FILE:src/utils/format.ts']);

    assert.strictEqual(result.success, true);
    assert.ok(!result.affectedFiles.some(f => f.path.includes('__tests__')));
    assert.ok(!result.affectedFiles.some(f => f.path === 'src/__tests__/format.test.ts'));
  });

  it('should include test files when includeTests=true (C8-1)', async () => {
    const { getImpact } = await import('../../../src/api/impact/index.js');
    const result = getImpact(graph, ['FILE:src/utils/format.ts'], { includeTests: true });

    assert.strictEqual(result.success, true);
    assert.ok(result.affectedFiles.some(f => f.path === 'src/__tests__/format.test.ts'));
  });

  // Task 5.6: Test maxDepth=0
  it('should return direct only when maxDepth=0 (C8-2)', async () => {
    const { getImpact } = await import('../../../src/api/impact/index.js');
    const result = getImpact(graph, ['FILE:src/utils/format.ts'], { maxDepth: 0 });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.summary.direct, 3);
    assert.strictEqual(result.summary.indirect, 0);
    assert.strictEqual(result.summary.total, 3);
  });

  // Task 5.7: Test DYNAMIC_IMPORTS exclusion
  it('should NOT traverse DYNAMIC_IMPORTS edges (C8-6)', async () => {
    const { getImpact } = await import('../../../src/api/impact/index.js');
    const result = getImpact(graph, ['FILE:src/utils/format.ts']);

    assert.strictEqual(result.success, true);
    assert.ok(!result.affectedFiles.some(f => f.path === 'src/dynamic.ts'));
  });

  // Task 5.8: Test MODULE target resolution
  it('should resolve MODULE target to FILE (C8)', async () => {
    const { getImpact } = await import('../../../src/api/impact/index.js');
    const result = getImpact(graph, ['MODULE:src/utils/format.ts#formatDate']);

    assert.strictEqual(result.success, true);
    // Should resolve to FILE:src/utils/format.ts and find same dependents
    assert.strictEqual(result.summary.direct, 3);
  });

  // Task 5.9: Test isolated file returns empty
  it('should return empty for isolated file', async () => {
    const { getImpact } = await import('../../../src/api/impact/index.js');
    const result = getImpact(graph, ['FILE:src/isolated.ts']);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.summary.total, 0);
    assert.strictEqual(result.summary.direct, 0);
    assert.strictEqual(result.summary.indirect, 0);
    assert.deepStrictEqual(result.affectedFiles, []);
    assert.strictEqual(result.blastRadius, 'unknown');
  });

  // Task 5.10: Test target not found error
  it('should return E001 error for nonexistent target', async () => {
    const { getImpact } = await import('../../../src/api/impact/index.js');
    const result = getImpact(graph, ['FILE:src/nonexistent.ts']);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error?.code, 'E001_TARGET_NOT_FOUND');
  });

  // Blast radius tests
  it('should classify blastRadius=low when total≤3 (C8-8)', async () => {
    const { getImpact } = await import('../../../src/api/impact/index.js');
    const result = getImpact(graph, ['FILE:src/services/auth.ts']);

    // auth.ts has direct: Home.tsx, Login.tsx = 2, indirect: index.ts = 1, total = 3
    assert.strictEqual(result.blastRadius, 'low');
  });

  it('should classify blastRadius=medium when total 4-10', async () => {
    const { getImpact } = await import('../../../src/api/impact/index.js');
    const result = getImpact(graph, ['FILE:src/utils/format.ts']);

    // format.ts has total = 7 (3 direct + 4 indirect)
    assert.strictEqual(result.blastRadius, 'medium');
  });

  // Via path tracking (C8-4)
  it('should track via path for indirect dependents (C8-4)', async () => {
    const { getImpact } = await import('../../../src/api/impact/index.js');
    const result = getImpact(graph, ['FILE:src/utils/format.ts']);

    // pages/Home.tsx reaches format.ts via auth.ts AND Modal.tsx
    const homeEntry = result.affectedFiles.find(f => f.path === 'src/pages/Home.tsx');
    assert.ok(homeEntry);
    assert.strictEqual(homeEntry?.distance, 2);
    // C8-4: via is array format
    assert.ok(Array.isArray(homeEntry?.via));
    assert.ok(homeEntry?.via?.includes('src/services/auth.ts'));
    assert.ok(homeEntry?.via?.includes('src/components/Modal.tsx'));
  });

  // Content format
  it('should generate Markdown content', async () => {
    const { getImpact } = await import('../../../src/api/impact/index.js');
    const result = getImpact(graph, ['FILE:src/utils/format.ts']);

    assert.ok(result.content.includes('## Impact Analysis'));
    assert.ok(result.content.includes('Direct Dependents'));
    assert.ok(result.content.includes('Indirect Dependents'));
  });
});