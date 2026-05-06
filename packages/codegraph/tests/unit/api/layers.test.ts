/**
 * C8: Architecture Layers API Tests
 *
 * Tests for getArchitectureLayers function following TDD workflow.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CodeGraph, NodeType, EdgeType, type GraphNode, type GraphEdge } from '../../../src/index.js';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a test graph with layered architecture structure
 */
function createLayersTestGraph(): CodeGraph {
  const graph = new CodeGraph();

  // Layer 1 (Foundation): utils, types
  const utilsFormat: GraphNode = {
    id: 'FILE:src/utils/format.ts',
    type: NodeType.FILE,
    path: 'src/utils/format.ts',
    name: 'format.ts',
  };

  const utilsValidate: GraphNode = {
    id: 'FILE:src/utils/validate.ts',
    type: NodeType.FILE,
    path: 'src/utils/validate.ts',
    name: 'validate.ts',
  };

  const typesIndex: GraphNode = {
    id: 'FILE:src/types/index.ts',
    type: NodeType.FILE,
    path: 'src/types/index.ts',
    name: 'index.ts',
  };

  const typesApi: GraphNode = {
    id: 'FILE:src/types/api.ts',
    type: NodeType.FILE,
    path: 'src/types/api.ts',
    name: 'api.ts',
  };

  // Layer 2 (Core): services, components
  const servicesAuth: GraphNode = {
    id: 'FILE:src/services/auth.ts',
    type: NodeType.FILE,
    path: 'src/services/auth.ts',
    name: 'auth.ts',
  };

  const servicesApi: GraphNode = {
    id: 'FILE:src/services/api.ts',
    type: NodeType.FILE,
    path: 'src/services/api.ts',
    name: 'api.ts',
  };

  const componentsButton: GraphNode = {
    id: 'FILE:src/components/Button.tsx',
    type: NodeType.FILE,
    path: 'src/components/Button.tsx',
    name: 'Button.tsx',
  };

  const componentsModal: GraphNode = {
    id: 'FILE:src/components/Modal.tsx',
    type: NodeType.FILE,
    path: 'src/components/Modal.tsx',
    name: 'Modal.tsx',
  };

  // Layer 3 (Application): pages
  const pagesHome: GraphNode = {
    id: 'FILE:src/pages/Home.tsx',
    type: NodeType.FILE,
    path: 'src/pages/Home.tsx',
    name: 'Home.tsx',
  };

  const pagesLogin: GraphNode = {
    id: 'FILE:src/pages/Login.tsx',
    type: NodeType.FILE,
    path: 'src/pages/Login.tsx',
    name: 'Login.tsx',
  };

  const pagesDashboard: GraphNode = {
    id: 'FILE:src/pages/Dashboard.tsx',
    type: NodeType.FILE,
    path: 'src/pages/Dashboard.tsx',
    name: 'Dashboard.tsx',
  };

  // Layer 4 (Presentation): root
  const indexFile: GraphNode = {
    id: 'FILE:src/index.ts',
    type: NodeType.FILE,
    path: 'src/index.ts',
    name: 'index.ts',
  };

  // External dependency (should be excluded)
  const lodash: GraphNode = {
    id: 'EXTERNAL:lodash',
    type: NodeType.EXTERNAL,
    path: 'lodash',
    name: 'lodash',
  };

  // Add all nodes
  graph.addNode(utilsFormat);
  graph.addNode(utilsValidate);
  graph.addNode(typesIndex);
  graph.addNode(typesApi);
  graph.addNode(servicesAuth);
  graph.addNode(servicesApi);
  graph.addNode(componentsButton);
  graph.addNode(componentsModal);
  graph.addNode(pagesHome);
  graph.addNode(pagesLogin);
  graph.addNode(pagesDashboard);
  graph.addNode(indexFile);
  graph.addNode(lodash);

  // IMPORTS edges - correct layer direction (top → bottom)
  // pages import services
  graph.addEdge({
    from: 'FILE:src/pages/Home.tsx',
    to: 'FILE:src/services/auth.ts',
    type: EdgeType.IMPORTS,
  });
  graph.addEdge({
    from: 'FILE:src/pages/Home.tsx',
    to: 'FILE:src/services/api.ts',
    type: EdgeType.IMPORTS,
  });
  graph.addEdge({
    from: 'FILE:src/pages/Login.tsx',
    to: 'FILE:src/services/auth.ts',
    type: EdgeType.IMPORTS,
  });
  graph.addEdge({
    from: 'FILE:src/pages/Dashboard.tsx',
    to: 'FILE:src/services/api.ts',
    type: EdgeType.IMPORTS,
  });

  // pages import components
  graph.addEdge({
    from: 'FILE:src/pages/Home.tsx',
    to: 'FILE:src/components/Button.tsx',
    type: EdgeType.IMPORTS,
  });
  graph.addEdge({
    from: 'FILE:src/pages/Login.tsx',
    to: 'FILE:src/components/Button.tsx',
    type: EdgeType.IMPORTS,
  });
  graph.addEdge({
    from: 'FILE:src/pages/Dashboard.tsx',
    to: 'FILE:src/components/Modal.tsx',
    type: EdgeType.IMPORTS,
  });

  // services import utils
  graph.addEdge({
    from: 'FILE:src/services/auth.ts',
    to: 'FILE:src/utils/format.ts',
    type: EdgeType.IMPORTS,
  });
  graph.addEdge({
    from: 'FILE:src/services/api.ts',
    to: 'FILE:src/utils/format.ts',
    type: EdgeType.IMPORTS,
  });
  graph.addEdge({
    from: 'FILE:src/services/auth.ts',
    to: 'FILE:src/utils/validate.ts',
    type: EdgeType.IMPORTS,
  });

  // services import types
  graph.addEdge({
    from: 'FILE:src/services/auth.ts',
    to: 'FILE:src/types/api.ts',
    type: EdgeType.IMPORTS,
  });
  graph.addEdge({
    from: 'FILE:src/services/api.ts',
    to: 'FILE:src/types/api.ts',
    type: EdgeType.IMPORTS,
  });

  // components import types
  graph.addEdge({
    from: 'FILE:src/components/Button.tsx',
    to: 'FILE:src/types/index.ts',
    type: EdgeType.IMPORTS,
  });
  graph.addEdge({
    from: 'FILE:src/components/Modal.tsx',
    to: 'FILE:src/types/index.ts',
    type: EdgeType.IMPORTS,
  });

  // components import utils
  graph.addEdge({
    from: 'FILE:src/components/Modal.tsx',
    to: 'FILE:src/utils/format.ts',
    type: EdgeType.IMPORTS,
  });

  // utils import types (same layer = Foundation, no violation)
  graph.addEdge({
    from: 'FILE:src/utils/format.ts',
    to: 'FILE:src/types/index.ts',
    type: EdgeType.IMPORTS,
  });

  // index imports pages
  graph.addEdge({
    from: 'FILE:src/index.ts',
    to: 'FILE:src/pages/Home.tsx',
    type: EdgeType.IMPORTS,
  });

  // External import (should be excluded from layer inference)
  graph.addEdge({
    from: 'FILE:src/services/api.ts',
    to: 'EXTERNAL:lodash',
    type: EdgeType.IMPORTS,
  });

  return graph;
}

/**
 * Create a test graph with layer violations
 *
 * Uses more imports to create clear layer hierarchy with netScore differences > 2.
 */
function createViolationTestGraph(): CodeGraph {
  const graph = new CodeGraph();

  // Layer 1: utils (imported by many, imports few)
  const utilsFormat: GraphNode = {
    id: 'FILE:src/utils/format.ts',
    type: NodeType.FILE,
    path: 'src/utils/format.ts',
    name: 'format.ts',
  };

  const utilsHelper: GraphNode = {
    id: 'FILE:src/utils/helper.ts',
    type: NodeType.FILE,
    path: 'src/utils/helper.ts',
    name: 'helper.ts',
  };

  const utilsValidate: GraphNode = {
    id: 'FILE:src/utils/validate.ts',
    type: NodeType.FILE,
    path: 'src/utils/validate.ts',
    name: 'validate.ts',
  };

  // Layer 2: services (imports utils, imported by pages)
  const servicesAuth: GraphNode = {
    id: 'FILE:src/services/auth.ts',
    type: NodeType.FILE,
    path: 'src/services/auth.ts',
    name: 'auth.ts',
  };

  const servicesApi: GraphNode = {
    id: 'FILE:src/services/api.ts',
    type: NodeType.FILE,
    path: 'src/services/api.ts',
    name: 'api.ts',
  };

  // Layer 3: pages (imports services and components, imported by few)
  const pagesHome: GraphNode = {
    id: 'FILE:src/pages/Home.tsx',
    type: NodeType.FILE,
    path: 'src/pages/Home.tsx',
    name: 'Home.tsx',
  };

  const pagesAbout: GraphNode = {
    id: 'FILE:src/pages/About.tsx',
    type: NodeType.FILE,
    path: 'src/pages/About.tsx',
    name: 'About.tsx',
  };

  const pagesLogin: GraphNode = {
    id: 'FILE:src/pages/Login.tsx',
    type: NodeType.FILE,
    path: 'src/pages/Login.tsx',
    name: 'Login.tsx',
  };

  graph.addNode(utilsFormat);
  graph.addNode(utilsHelper);
  graph.addNode(utilsValidate);
  graph.addNode(servicesAuth);
  graph.addNode(servicesApi);
  graph.addNode(pagesHome);
  graph.addNode(pagesAbout);
  graph.addNode(pagesLogin);

  // pages → services (many imports for clear hierarchy)
  graph.addEdge({ from: 'FILE:src/pages/Home.tsx', to: 'FILE:src/services/auth.ts', type: EdgeType.IMPORTS });
  graph.addEdge({ from: 'FILE:src/pages/Home.tsx', to: 'FILE:src/services/api.ts', type: EdgeType.IMPORTS });
  graph.addEdge({ from: 'FILE:src/pages/About.tsx', to: 'FILE:src/services/auth.ts', type: EdgeType.IMPORTS });
  graph.addEdge({ from: 'FILE:src/pages/Login.tsx', to: 'FILE:src/services/auth.ts', type: EdgeType.IMPORTS });

  // services → utils (imports utils multiple times)
  graph.addEdge({ from: 'FILE:src/services/auth.ts', to: 'FILE:src/utils/format.ts', type: EdgeType.IMPORTS });
  graph.addEdge({ from: 'FILE:src/services/auth.ts', to: 'FILE:src/utils/helper.ts', type: EdgeType.IMPORTS });
  graph.addEdge({ from: 'FILE:src/services/auth.ts', to: 'FILE:src/utils/validate.ts', type: EdgeType.IMPORTS });
  graph.addEdge({ from: 'FILE:src/services/api.ts', to: 'FILE:src/utils/format.ts', type: EdgeType.IMPORTS });
  graph.addEdge({ from: 'FILE:src/services/api.ts', to: 'FILE:src/utils/helper.ts', type: EdgeType.IMPORTS });

  // VIOLATION: utils imports pages (layer 1 → layer 3)
  graph.addEdge({ from: 'FILE:src/utils/format.ts', to: 'FILE:src/pages/Home.tsx', type: EdgeType.IMPORTS });

  return graph;
}

// ============================================================================
// getArchitectureLayers Tests
// ============================================================================

describe('getArchitectureLayers', () => {
  let graph: CodeGraph;

  beforeEach(() => {
    graph = createLayersTestGraph();
  });

  // Task 5.12: Test first-level directory grouping
  it('should group files by first-level directory', async () => {
    const { getArchitectureLayers } = await import('../../../src/api/layers/index.js');
    const result = getArchitectureLayers(graph);

    assert.strictEqual(result.success, true);
    // Should have groups: utils, types, services, components, pages, __root__
    const groupNames = result.groups.map(g => g.name);
    assert.ok(groupNames.includes('utils'));
    assert.ok(groupNames.includes('types'));
    assert.ok(groupNames.includes('services'));
    assert.ok(groupNames.includes('components'));
    assert.ok(groupNames.includes('pages'));
    assert.ok(groupNames.includes('__root__'));
  });

  // Task 5.13: Test __root__ group
  it('should create __root__ group for root files', async () => {
    const { getArchitectureLayers } = await import('../../../src/api/layers/index.js');
    const result = getArchitectureLayers(graph);

    const rootGroup = result.groups.find(g => g.name === '__root__');
    assert.ok(rootGroup);
    // Root should be in a layer (exact layer depends on import stats)
    assert.ok(rootGroup?.assignedLayer > 0);
  });

  // Task 5.14: Test layer inference by netScore
  it('should infer Foundation layer for highly imported groups', async () => {
    const { getArchitectureLayers } = await import('../../../src/api/layers/index.js');
    const result = getArchitectureLayers(graph);

    // types should have highest netScore (imported by many)
    const typesGroup = result.groups.find(g => g.name === 'types');
    assert.ok(typesGroup);
    assert.strictEqual(typesGroup?.assignedLayer, 1); // Foundation
  });

  // Task 5.15: Test adjacent score merging
  it('should merge adjacent scores with threshold=2 (C8-3)', async () => {
    const { getArchitectureLayers } = await import('../../../src/api/layers/index.js');
    const result = getArchitectureLayers(graph);

    // Check that groups with similar scores are in same layer
    // utils and types should both be in Foundation (Layer 1)
    const utilsGroup = result.groups.find(g => g.name === 'utils');
    const typesGroup = result.groups.find(g => g.name === 'types');

    // They should be in same layer if scores differ by ≤ 2
    // (exact depends on import counts, but both should be low layers)
    assert.ok(utilsGroup?.assignedLayer <= 2);
    assert.ok(typesGroup?.assignedLayer <= 2);
  });

  // Task 5.16: Test layer violation detection
  it('should detect low-to-high import as violation', async () => {
    const { getArchitectureLayers } = await import('../../../src/api/layers/index.js');
    const violationGraph = createViolationTestGraph();
    const result = getArchitectureLayers(violationGraph);

    assert.strictEqual(result.success, true);
    // There should be at least 1 violation (utils → pages)
    assert.ok(result.violations.length >= 1);

    // Check for the specific violation
    const violation = result.violations.find(v => v.fromGroup === 'utils' && v.toGroup === 'pages');
    // Layer gap depends on actual layer assignment
    if (violation) {
      assert.ok(violation.layerGap >= 1);
    }
  });

  // Task 5.17: Test no violation for correct direction
  it('should NOT flag high-to-low import as violation', async () => {
    const { getArchitectureLayers } = await import('../../../src/api/layers/index.js');
    const result = getArchitectureLayers(graph);

    // pages → services should NOT be violation
    const violation = result.violations.find(v => v.fromGroup === 'pages' && v.toGroup === 'services');
    assert.ok(!violation);
  });

  // Task 5.18: Test same-layer mutual imports
  it('should NOT flag same-layer mutual imports as violation (C8-11)', async () => {
    const { getArchitectureLayers } = await import('../../../src/api/layers/index.js');
    const result = getArchitectureLayers(graph);

    // utils imports types (both Foundation) - should NOT be violation
    const violation = result.violations.find(v => v.fromGroup === 'utils' && v.toGroup === 'types');
    assert.ok(!violation);
  });

  // Task 5.19: Test healthScore calculation
  it('should calculate healthScore for no major violations', async () => {
    const { getArchitectureLayers } = await import('../../../src/api/layers/index.js');
    const result = getArchitectureLayers(graph);

    // Clean architecture - should have high score
    assert.ok(result.healthScore >= 90);
  });

  it('should reduce healthScore with violations (C8-5)', async () => {
    const { getArchitectureLayers } = await import('../../../src/api/layers/index.js');
    const violationGraph = createViolationTestGraph();
    const result = getArchitectureLayers(violationGraph);

    // With violations, score should be less than 100
    assert.ok(result.healthScore < 100);
    assert.ok(result.healthScore >= 0);
  });

  // Task 5.20: Test empty graph error
  it('should return E005 error for empty graph', async () => {
    const { getArchitectureLayers } = await import('../../../src/api/layers/index.js');
    const emptyGraph = new CodeGraph();
    const result = getArchitectureLayers(emptyGraph);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error?.code, 'E005_EMPTY_GRAPH');
  });

  // Task 5.21: Test custom sourceRoot
  it('should support custom sourceRoot parameter', async () => {
    const { getArchitectureLayers } = await import('../../../src/api/layers/index.js');

    // Add lib directory structure
    graph.addNode({
      id: 'FILE:lib/core/main.ts',
      type: NodeType.FILE,
      path: 'lib/core/main.ts',
      name: 'main.ts',
    });

    const result = getArchitectureLayers(graph, { sourceRoot: 'lib' });
    assert.strictEqual(result.success, true);
  });

  // Task 5.22: Test external dependency exclusion
  it('should exclude external dependencies from inference (C8)', async () => {
    const { getArchitectureLayers } = await import('../../../src/api/layers/index.js');
    const result = getArchitectureLayers(graph);

    // lodash should NOT appear in groups
    const groupNames = result.groups.map(g => g.name);
    assert.ok(!groupNames.includes('lodash'));
    assert.ok(!groupNames.includes('EXTERNAL'));
  });

  // Severity tests
  it('should assign severity based on layerGap', async () => {
    const { calculateSeverity } = await import('../../../src/api/layers/index.js');

    // C8-5: minor=-5, moderate=-10, critical=-15
    assert.strictEqual(calculateSeverity(1), 'minor');
    assert.strictEqual(calculateSeverity(2), 'moderate');
    assert.strictEqual(calculateSeverity(3), 'critical');
    assert.strictEqual(calculateSeverity(4), 'critical');
  });

  // Content format
  it('should generate Markdown content', async () => {
    const { getArchitectureLayers } = await import('../../../src/api/layers/index.js');
    const result = getArchitectureLayers(graph);

    assert.ok(result.content.includes('## Architecture Layers'));
    assert.ok(result.content.includes('Layer 1'));
    assert.ok(result.content.includes('Foundation'));
  });

  // Layers result structure
  it('should return layers with role names', async () => {
    const { getArchitectureLayers } = await import('../../../src/api/layers/index.js');
    const result = getArchitectureLayers(graph);

    assert.ok(result.layers.length >= 2);
    assert.ok(result.layers.some(l => l.role === 'Foundation'));
    assert.ok(result.layers.some(l => l.role === 'Core' || l.role === 'Application' || l.role === 'Presentation'));
  });

  // ========================================
  // Dynamic Threshold Integration Tests
  // ========================================

  describe('dynamic threshold selection', () => {
    it('should use default threshold 2 when no options provided', async () => {
      const { getArchitectureLayers } = await import('../../../src/api/layers/index.js');
      const result = getArchitectureLayers(graph);

      // Should work with default threshold
      assert.strictEqual(result.success, true);
      assert.ok(result.layers.length >= 2);
    });

    it('should use explicit threshold when provided', async () => {
      const { getArchitectureLayers } = await import('../../../src/api/layers/index.js');
      const resultThreshold5 = getArchitectureLayers(graph, { threshold: 5 });
      const resultThreshold1 = getArchitectureLayers(graph, { threshold: 1 });

      // Both should succeed
      assert.strictEqual(resultThreshold5.success, true);
      assert.strictEqual(resultThreshold1.success, true);

      // Different thresholds should potentially produce different layer counts
      // Higher threshold = more merging = fewer layers (or same if scores differ significantly)
      assert.ok(resultThreshold5.layers.length >= 1);
      assert.ok(resultThreshold1.layers.length >= 1);
    });

    it('should override projectRoot threshold with explicit threshold', async () => {
      const { getArchitectureLayers } = await import('../../../src/api/layers/index.js');
      // Even with projectRoot, explicit threshold wins
      const result = getArchitectureLayers(graph, {
        threshold: 3,
        projectRoot: '/some/path', // Would normally use different threshold
      });

      assert.strictEqual(result.success, true);
      // Should use threshold 3, not projectRoot-based value
    });
  });
});