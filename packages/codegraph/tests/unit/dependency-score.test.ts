/**
 * Unit tests for dependency-score.ts module
 *
 * Tests Phase 2 of cg-layer-inference-pipeline:
 * - Cycle detection and penalty
 * - External dependency exclusion
 * - Dynamic import penalty
 * - Type-only import exclusion
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDependencyScore,
  detectCycles,
  calculateCyclePenalty,
  type DependencyScoreResult,
  type CycleInfo,
} from '../../src/api/layers/inference/dependency-score.js';
import { CodeGraph } from '../../src/graph.js';
import { NodeType, EdgeType } from '../../src/types.js';
import type { DirectoryGroup } from '../../src/api/layers/grouping.js';

// ============================================================================
// Helper functions for test graph construction
// ============================================================================

/**
 * Create a minimal DirectoryGroup for testing
 */
function createGroup(
  name: string,
  files: string[] = [],
  importedBy: Map<string, number> = new Map(),
  importsFrom: Map<string, number> = new Map()
): DirectoryGroup {
  return {
    name,
    files,
    importStats: { importedBy, importsFrom },
  };
}

/**
 * Create a test CodeGraph with FILE nodes
 */
function createTestGraph(): CodeGraph {
  const graph = new CodeGraph();

  // Add FILE nodes
  graph.addNode({
    id: 'FILE:src/utils.ts',
    type: NodeType.FILE,
    path: 'src/utils.ts',
    name: 'utils.ts',
  });
  graph.addNode({
    id: 'FILE:src/api.ts',
    type: NodeType.FILE,
    path: 'src/api.ts',
    name: 'api.ts',
  });
  graph.addNode({
    id: 'FILE:src/core.ts',
    type: NodeType.FILE,
    path: 'src/core.ts',
    name: 'core.ts',
  });

  return graph;
}

// ============================================================================
// calculateCyclePenalty tests
// ============================================================================

describe('calculateCyclePenalty', () => {
  it('should return 1 for 2-group cycle', () => {
    const cycle = ['group-a', 'group-b'];
    assert.strictEqual(calculateCyclePenalty(cycle), 1);
  });

  it('should return 2 for 3-group cycle', () => {
    const cycle = ['group-a', 'group-b', 'group-c'];
    assert.strictEqual(calculateCyclePenalty(cycle), 2);
  });

  it('should return 2 for 4-group cycle', () => {
    const cycle = ['group-a', 'group-b', 'group-c', 'group-d'];
    assert.strictEqual(calculateCyclePenalty(cycle), 2);
  });

  it('should return 3 for 5-group cycle', () => {
    const cycle = ['a', 'b', 'c', 'd', 'e'];
    assert.strictEqual(calculateCyclePenalty(cycle), 3);
  });

  it('should return 0 for empty cycle', () => {
    const cycle: string[] = [];
    assert.strictEqual(calculateCyclePenalty(cycle), 0);
  });

  it('should return 1 for single-group cycle (self-loop)', () => {
    const cycle = ['group-a'];
    assert.strictEqual(calculateCyclePenalty(cycle), 1);
  });
});

// ============================================================================
// detectCycles tests
// ============================================================================

describe('detectCycles', () => {
  it('should return empty array for acyclic groups', () => {
    const groups = new Map<string, DirectoryGroup>();
    groups.set('utils', createGroup('utils', [], new Map(), new Map([['api', 1]])));
    groups.set('api', createGroup('api', [], new Map([['utils', 1]]), new Map()));

    const cycles = detectCycles(groups);
    assert.strictEqual(cycles.length, 0);
  });

  it('should detect simple 2-group cycle', () => {
    const groups = new Map<string, DirectoryGroup>();
    // utils imports api, api imports utils -> cycle
    groups.set('utils', createGroup('utils', [], new Map([['api', 1]]), new Map([['api', 1]])));
    groups.set('api', createGroup('api', [], new Map([['utils', 1]]), new Map([['utils', 1]])));

    const cycles = detectCycles(groups);
    assert.strictEqual(cycles.length, 1);
    assert.strictEqual(cycles[0].groups.length, 2);
    // Cycle should contain both groups
    assert.ok(cycles[0].groups.includes('utils'));
    assert.ok(cycles[0].groups.includes('api'));
  });

  it('should detect 3-group cycle', () => {
    const groups = new Map<string, DirectoryGroup>();
    // a -> b -> c -> a cycle
    groups.set('a', createGroup('a', [], new Map([['c', 1]]), new Map([['b', 1]])));
    groups.set('b', createGroup('b', [], new Map([['a', 1]]), new Map([['c', 1]])));
    groups.set('c', createGroup('c', [], new Map([['b', 1]]), new Map([['a', 1]])));

    const cycles = detectCycles(groups);
    assert.strictEqual(cycles.length, 1);
    assert.strictEqual(cycles[0].groups.length, 3);
  });

  it('should detect multiple independent cycles', () => {
    const groups = new Map<string, DirectoryGroup>();
    // Cycle 1: a <-> b
    groups.set('a', createGroup('a', [], new Map([['b', 1]]), new Map([['b', 1]])));
    groups.set('b', createGroup('b', [], new Map([['a', 1]]), new Map([['a', 1]])));
    // Cycle 2: c <-> d
    groups.set('c', createGroup('c', [], new Map([['d', 1]]), new Map([['d', 1]])));
    groups.set('d', createGroup('d', [], new Map([['c', 1]]), new Map([['c', 1]])));

    const cycles = detectCycles(groups);
    assert.strictEqual(cycles.length, 2);
  });

  it('should handle groups with no dependencies', () => {
    const groups = new Map<string, DirectoryGroup>();
    groups.set('isolated', createGroup('isolated', [], new Map(), new Map()));

    const cycles = detectCycles(groups);
    assert.strictEqual(cycles.length, 0);
  });
});

// ============================================================================
// calculateDependencyScore - base score tests
// ============================================================================

describe('calculateDependencyScore - base score', () => {
  it('should calculate correct netScore for simple imports', () => {
    const graph = createTestGraph();
    const groups = new Map<string, DirectoryGroup>();

    // utils imported by 2 groups, imports from 1 group
    const importedBy = new Map([['api', 2], ['core', 1]]);
    const importsFrom = new Map([['core', 1]]);
    groups.set('utils', createGroup('utils', ['FILE:src/utils.ts'], importedBy, importsFrom));

    const result = calculateDependencyScore(groups.get('utils')!, graph, groups);

    // netScore = importedBy (3) - importsFrom (1) = 2
    assert.strictEqual(result.netScore, 2);
    assert.strictEqual(result.importedBy, 3);
    assert.strictEqual(result.importsFrom, 1);
    assert.strictEqual(result.cyclePenalty, 0);
  });

  it('should return zero score for isolated group', () => {
    const graph = createTestGraph();
    const groups = new Map<string, DirectoryGroup>();
    groups.set('isolated', createGroup('isolated', ['FILE:src/utils.ts'], new Map(), new Map()));

    const result = calculateDependencyScore(groups.get('isolated')!, graph, groups);

    assert.strictEqual(result.netScore, 0);
    assert.strictEqual(result.importedBy, 0);
    assert.strictEqual(result.importsFrom, 0);
  });
});

// ============================================================================
// calculateDependencyScore - cycle penalty tests
// ============================================================================

describe('calculateDependencyScore - cycle penalty', () => {
  it('should apply cycle penalty to group in cycle', () => {
    const graph = createTestGraph();
    const groups = new Map<string, DirectoryGroup>();

    // Cycle: utils <-> api
    groups.set('utils', createGroup('utils', ['FILE:src/utils.ts'],
      new Map([['api', 1]]), new Map([['api', 1]])));
    groups.set('api', createGroup('api', ['FILE:src/api.ts'],
      new Map([['utils', 1]]), new Map([['utils', 1]])));

    const result = calculateDependencyScore(groups.get('utils')!, graph, groups);

    // netScore = 1 - 1 - cyclePenalty(2) = 1 - 1 - 1 = -1
    assert.strictEqual(result.cyclePenalty, 1);
    assert.strictEqual(result.netScore, -1);
  });

  it('should not apply penalty to group not in cycle', () => {
    const graph = createTestGraph();
    const groups = new Map<string, DirectoryGroup>();

    // utils imports api (acyclic)
    groups.set('utils', createGroup('utils', ['FILE:src/utils.ts'],
      new Map(), new Map([['api', 1]])));
    groups.set('api', createGroup('api', ['FILE:src/api.ts'],
      new Map([['utils', 1]]), new Map()));

    const result = calculateDependencyScore(groups.get('utils')!, graph, groups);

    assert.strictEqual(result.cyclePenalty, 0);
    // netScore = 0 - 1 = -1
    assert.strictEqual(result.netScore, -1);
  });
});

// ============================================================================
// calculateDependencyScore - external dependency exclusion tests
// ============================================================================

describe('calculateDependencyScore - external exclusion', () => {
  it('should exclude external dependencies from importsFrom count', () => {
    const graph = new CodeGraph();

    // Add FILE nodes
    graph.addNode({
      id: 'FILE:src/api.ts',
      type: NodeType.FILE,
      path: 'src/api.ts',
      name: 'api.ts',
    });

    // Add EXTERNAL node for lodash
    graph.addNode({
      id: 'EXTERNAL:lodash',
      type: NodeType.EXTERNAL,
      path: 'lodash',
      name: 'lodash',
    });

    // Add IMPORTS edge to external
    graph.addEdge({
      from: 'FILE:src/api.ts',
      to: 'EXTERNAL:lodash',
      type: EdgeType.IMPORTS,
      metadata: { importKind: 'value' },
    });

    const groups = new Map<string, DirectoryGroup>();
    // api imports from utils (internal) and lodash (external)
    groups.set('api', createGroup('api', ['FILE:src/api.ts'],
      new Map(), new Map([['utils', 1], ['__external__', 1]])));

    const result = calculateDependencyScore(groups.get('api')!, graph, groups);

    // external imports should not count
    assert.strictEqual(result.externalImportCount, 1);
    // importsFrom should only count internal imports
    assert.strictEqual(result.importsFrom, 1);
  });
});

// ============================================================================
// calculateDependencyScore - dynamic import penalty tests
// ============================================================================

describe('calculateDependencyScore - dynamic import penalty', () => {
  it('should apply penalty for dynamic imports', () => {
    const graph = new CodeGraph();

    // Use proper subdirectory paths for group assignment
    graph.addNode({
      id: 'FILE:src/api/service.ts',
      type: NodeType.FILE,
      path: 'src/api/service.ts',
      name: 'service.ts',
    });
    graph.addNode({
      id: 'FILE:src/utils/helper.ts',
      type: NodeType.FILE,
      path: 'src/utils/helper.ts',
      name: 'helper.ts',
    });

    // Add DYNAMIC_IMPORTS edge
    graph.addEdge({
      from: 'FILE:src/api/service.ts',
      to: 'FILE:src/utils/helper.ts',
      type: EdgeType.DYNAMIC_IMPORTS,
      metadata: { isDynamic: true },
    });

    const groups = new Map<string, DirectoryGroup>();
    // api has dynamic import to utils
    groups.set('api', createGroup('api', ['FILE:src/api/service.ts'],
      new Map(), new Map([['utils', 1]])));

    const result = calculateDependencyScore(groups.get('api')!, graph, groups);

    // dynamic import adds +1 penalty to importsFrom
    assert.strictEqual(result.dynamicImportPenalty, 1);
    assert.ok(result.importsFrom >= 1);
  });
});

// ============================================================================
// calculateDependencyScore - type-only import exclusion tests
// ============================================================================

describe('calculateDependencyScore - type-only exclusion', () => {
  it('should exclude type-only imports from importsFrom count', () => {
    const graph = new CodeGraph();

    // Use proper subdirectory paths for group assignment
    graph.addNode({
      id: 'FILE:src/api/service.ts',
      type: NodeType.FILE,
      path: 'src/api/service.ts',
      name: 'service.ts',
    });
    graph.addNode({
      id: 'FILE:src/types/index.ts',
      type: NodeType.FILE,
      path: 'src/types/index.ts',
      name: 'index.ts',
    });

    // Add IMPORTS edge with type-only metadata
    graph.addEdge({
      from: 'FILE:src/api/service.ts',
      to: 'FILE:src/types/index.ts',
      type: EdgeType.IMPORTS,
      metadata: { importKind: 'type-only' },
    });

    const groups = new Map<string, DirectoryGroup>();
    // api imports types (type-only) and utils (value)
    groups.set('api', createGroup('api', ['FILE:src/api/service.ts'],
      new Map(), new Map([['types', 1], ['utils', 1]])));

    const result = calculateDependencyScore(groups.get('api')!, graph, groups);

    // type-only imports should not count toward importsFrom
    assert.strictEqual(result.typeOnlyImportCount, 1);
    // Only value import should count
    assert.strictEqual(result.importsFrom, 1);
  });

  it('should count value imports normally', () => {
    const graph = new CodeGraph();

    // Use proper subdirectory paths for group assignment
    graph.addNode({
      id: 'FILE:src/api/service.ts',
      type: NodeType.FILE,
      path: 'src/api/service.ts',
      name: 'service.ts',
    });
    graph.addNode({
      id: 'FILE:src/utils/helper.ts',
      type: NodeType.FILE,
      path: 'src/utils/helper.ts',
      name: 'helper.ts',
    });

    // Add IMPORTS edge with value metadata
    graph.addEdge({
      from: 'FILE:src/api/service.ts',
      to: 'FILE:src/utils/helper.ts',
      type: EdgeType.IMPORTS,
      metadata: { importKind: 'value' },
    });

    const groups = new Map<string, DirectoryGroup>();
    groups.set('api', createGroup('api', ['FILE:src/api/service.ts'],
      new Map(), new Map([['utils', 1]])));

    const result = calculateDependencyScore(groups.get('api')!, graph, groups);

    assert.strictEqual(result.typeOnlyImportCount, 0);
    assert.strictEqual(result.importsFrom, 1);
  });
});

// ============================================================================
// DependencyScoreResult interface tests
// ============================================================================

describe('DependencyScoreResult interface', () => {
  it('should return complete result with all fields', () => {
    const graph = createTestGraph();
    const groups = new Map<string, DirectoryGroup>();

    groups.set('test', createGroup('test', ['FILE:src/utils.ts'],
      new Map([['other', 2]]), new Map([['lib', 1]])));

    const result = calculateDependencyScore(groups.get('test')!, graph, groups);

    // Verify all required fields are present
    assert.ok(typeof result.netScore === 'number');
    assert.ok(typeof result.importedBy === 'number');
    assert.ok(typeof result.importsFrom === 'number');
    assert.ok(typeof result.cyclePenalty === 'number');
    assert.ok(typeof result.dynamicImportPenalty === 'number');
    assert.ok(typeof result.externalImportCount === 'number');
    assert.ok(typeof result.typeOnlyImportCount === 'number');
  });
});

// ============================================================================
// CycleInfo interface tests
// ============================================================================

describe('CycleInfo interface', () => {
  it('should include penalty in CycleInfo', () => {
    const groups = new Map<string, DirectoryGroup>();
    groups.set('a', createGroup('a', [], new Map([['b', 1]]), new Map([['b', 1]])));
    groups.set('b', createGroup('b', [], new Map([['a', 1]]), new Map([['a', 1]])));

    const cycles = detectCycles(groups);

    assert.strictEqual(cycles.length, 1);
    assert.ok(Array.isArray(cycles[0].groups));
    assert.ok(typeof cycles[0].penalty === 'number');
    assert.strictEqual(cycles[0].penalty, 1); // ceil(2/2) = 1
  });
});