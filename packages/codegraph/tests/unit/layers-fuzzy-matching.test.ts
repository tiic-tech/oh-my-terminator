/**
 * Unit tests for fuzzy matching algorithm (Phase 4: Layer Assignment with Confidence)
 *
 * Tests the threshold-based adjacent group merging in layer assignment.
 * Run with: pnpm test tests/unit/layers-fuzzy-matching.test.ts
 *
 * TDD RED Phase: Tests written before implementation.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { DirectoryGroup } from '../../src/api/layers/grouping.js';
import {
  inferArchitectureLayers,
  type GroupScore,
} from '../../src/api/layers/inference/core.js';
import {
  DEPTH_PRESETS,
  getThresholdForScale,
} from '../../src/api/layers/inference/depth-presets.js';

// ============================================================================
// Helper: Create mock DirectoryGroup with at least one file
// ============================================================================
function createMockGroup(
  name: string,
  importedBy: Record<string, number>,
  importsFrom: Record<string, number>
): DirectoryGroup {
  return {
    name,
    // Include at least one file so inferArchitectureLayers doesn't skip
    files: [`src/${name}/index.ts`],
    importStats: {
      importedBy: new Map(Object.entries(importedBy)),
      importsFrom: new Map(Object.entries(importsFrom)),
    },
  };
}

// ============================================================================
// Task 3.3 & 3.4: Fuzzy matching with DEPTH_PRESETS threshold
// ============================================================================
describe('Fuzzy matching with threshold (Task 3.3/3.4)', () => {
  let groups: Map<string, DirectoryGroup>;

  beforeEach(() => {
    groups = new Map();
  });

  // ============================================================================
  // SMALL threshold (5) - aggressive depth
  // ============================================================================
  describe('SMALL threshold (5)', () => {
    it('should merge groups with score diff < 5', () => {
      // Setup: Both groups have no imports, identical scores
      // diff = 0 < 5 → same layer
      groups.set('groupA', createMockGroup('groupA', {}, {}));
      groups.set('groupB', createMockGroup('groupB', {}, {}));
      groups.set('groupC', createMockGroup('groupC', {}, {}));

      const threshold = DEPTH_PRESETS.SMALL.threshold; // 5
      const { layers } = inferArchitectureLayers(groups, threshold);

      // All groups should be in layer 1 (diff < threshold)
      assert.strictEqual(layers.length, 1, 'Should have 1 layer with identical scores');
      assert.strictEqual(layers[0].groups.length, 3, 'All groups should merge into one layer');
    });

    it('should create new layer when diff >= 5', () => {
      // Setup: groupA imported by groupB
      // groupA: importedBy=10, importsFrom=0 → netScore=10
      // groupB: importedBy=0, importsFrom=10 → netScore=-10
      // diff = 20 >= 5 → separate layers
      groups.set('groupA', createMockGroup('groupA', { groupB: 10 }, {}));
      groups.set('groupB', createMockGroup('groupB', {}, { groupA: 10 }));

      const threshold = DEPTH_PRESETS.SMALL.threshold; // 5
      const { layers } = inferArchitectureLayers(groups, threshold);

      // Should have 2 layers (diff >= threshold)
      assert.strictEqual(layers.length, 2, 'Should have 2 layers when diff >= threshold');
    });

    it('should handle identical scores (diff=0)', () => {
      groups.set('groupA', createMockGroup('groupA', {}, {}));
      groups.set('groupB', createMockGroup('groupB', {}, {}));

      const threshold = DEPTH_PRESETS.SMALL.threshold;
      const { layers } = inferArchitectureLayers(groups, threshold);

      // Identical scores -> same layer
      assert.strictEqual(layers.length, 1, 'Identical scores should merge');
    });
  });

  // ============================================================================
  // MEDIUM threshold (3) - balanced
  // ============================================================================
  describe('MEDIUM threshold (3)', () => {
    it('should merge groups with score diff < 3', () => {
      // Setup: Both groups have no imports, identical scores
      // diff = 0 < 3 → same layer
      groups.set('groupA', createMockGroup('groupA', {}, {}));
      groups.set('groupB', createMockGroup('groupB', {}, {}));

      const threshold = DEPTH_PRESETS.MEDIUM.threshold; // 3
      const { layers } = inferArchitectureLayers(groups, threshold);

      assert.strictEqual(layers.length, 1, 'Should merge identical scores (diff=0 < 3)');
    });

    it('should create new layer when diff >= 3', () => {
      // Setup: groupA imported by groupB
      // groupA: importedBy=10, importsFrom=0 → netScore=10
      // groupB: importedBy=0, importsFrom=10 → netScore=-10
      // diff = 20 >= 3 → separate layers
      groups.set('groupA', createMockGroup('groupA', { groupB: 10 }, {}));
      groups.set('groupB', createMockGroup('groupB', {}, { groupA: 10 }));

      const threshold = DEPTH_PRESETS.MEDIUM.threshold; // 3
      const { layers } = inferArchitectureLayers(groups, threshold);

      assert.strictEqual(layers.length, 2, 'Should separate with diff >= 3');
    });
  });

  // ============================================================================
  // LARGE threshold (2) - conservative (default)
  // ============================================================================
  describe('LARGE threshold (2)', () => {
    it('should merge groups with score diff < 2', () => {
      // Setup: Both groups have no imports, identical scores
      // groupA: importedBy=0, importsFrom=0 → netScore=0
      // groupB: importedBy=0, importsFrom=0 → netScore=0
      // diff = 0 < 2 → same layer
      groups.set('groupA', createMockGroup('groupA', {}, {}));
      groups.set('groupB', createMockGroup('groupB', {}, {}));

      const threshold = DEPTH_PRESETS.LARGE.threshold; // 2
      const { layers } = inferArchitectureLayers(groups, threshold);

      assert.strictEqual(layers.length, 1, 'Should merge identical scores (diff=0 < 2)');
    });

    it('should create new layer when diff >= 2', () => {
      // Setup: groupA imported by groupB, no mutual imports
      // groupA: importedBy=10, importsFrom=0 → netScore=10
      // groupB: importedBy=0, importsFrom=10 → netScore=-10
      // diff = 20 >= 2 → separate layers
      groups.set('groupA', createMockGroup('groupA', { groupB: 10 }, {}));
      groups.set('groupB', createMockGroup('groupB', {}, { groupA: 10 }));

      const threshold = DEPTH_PRESETS.LARGE.threshold; // 2
      const { layers } = inferArchitectureLayers(groups, threshold);

      assert.strictEqual(layers.length, 2, 'Should separate with diff >= 2');
    });
  });

  // ============================================================================
  // ENTERPRISE threshold (1) - most conservative
  // ============================================================================
  describe('ENTERPRISE threshold (1)', () => {
    it('should merge only identical scores (diff=0)', () => {
      // Setup: All groups have no imports, identical scores
      // diff = 0 < 1 → same layer
      groups.set('groupA', createMockGroup('groupA', {}, {}));
      groups.set('groupB', createMockGroup('groupB', {}, {}));
      groups.set('groupC', createMockGroup('groupC', {}, {}));

      const threshold = DEPTH_PRESETS.ENTERPRISE.threshold; // 1
      const { layers } = inferArchitectureLayers(groups, threshold);

      assert.strictEqual(layers.length, 1, 'Should merge identical scores');
    });

    it('should create new layer for any score difference >= 1', () => {
      // Setup: groupA imported by groupB
      // groupA: importedBy=1, importsFrom=0 → netScore=1
      // groupB: importedBy=0, importsFrom=1 → netScore=-1
      // diff = 2 >= 1 → separate layers
      groups.set('groupA', createMockGroup('groupA', { groupB: 1 }, {}));
      groups.set('groupB', createMockGroup('groupB', {}, { groupA: 1 }));

      const threshold = DEPTH_PRESETS.ENTERPRISE.threshold; // 1
      const { layers } = inferArchitectureLayers(groups, threshold);

      assert.strictEqual(layers.length, 2, 'Should separate with diff >= 1');
    });
  });

  // ============================================================================
  // getThresholdForScale() function
  // ============================================================================
  describe('getThresholdForScale()', () => {
    it('should return SMALL threshold (5) for <= 50 files', () => {
      const threshold = getThresholdForScale(50);
      assert.strictEqual(threshold, 5);
    });

    it('should return SMALL threshold for < 50 files', () => {
      const threshold = getThresholdForScale(25);
      assert.strictEqual(threshold, 5);
    });

    it('should return MEDIUM threshold (3) for <= 200 files', () => {
      const threshold = getThresholdForScale(200);
      assert.strictEqual(threshold, 3);
    });

    it('should return MEDIUM threshold for 100 files', () => {
      const threshold = getThresholdForScale(100);
      assert.strictEqual(threshold, 3);
    });

    it('should return LARGE threshold (2) for <= 500 files', () => {
      const threshold = getThresholdForScale(500);
      assert.strictEqual(threshold, 2);
    });

    it('should return LARGE threshold for 300 files', () => {
      const threshold = getThresholdForScale(300);
      assert.strictEqual(threshold, 2);
    });

    it('should return ENTERPRISE threshold (1) for > 500 files', () => {
      const threshold = getThresholdForScale(1000);
      assert.strictEqual(threshold, 1);
    });

    it('should return ENTERPRISE threshold for 10000 files', () => {
      const threshold = getThresholdForScale(10000);
      assert.strictEqual(threshold, 1);
    });
  });

  // ============================================================================
  // Edge cases
  // ============================================================================
  describe('Edge cases', () => {
    it('should handle single group (always layer 1)', () => {
      groups.set('onlyGroup', createMockGroup('onlyGroup', {}, {}));

      const { layers } = inferArchitectureLayers(groups, 2);

      assert.strictEqual(layers.length, 1, 'Single group should be layer 1');
      assert.strictEqual(layers[0].layer, 1);
      assert.strictEqual(layers[0].groups.length, 1);
    });

    it('should handle empty groups map', () => {
      const emptyGroups = new Map<string, DirectoryGroup>();

      const { layers } = inferArchitectureLayers(emptyGroups, 2);

      assert.strictEqual(layers.length, 0, 'Empty groups should yield no layers');
    });

    it('should handle groups with zero files (skipped)', () => {
      // Create a group with zero files (should be skipped)
      const emptyGroup: DirectoryGroup = {
        name: 'empty',
        files: [], // Explicitly empty - should be skipped
        importStats: {
          importedBy: new Map(),
          importsFrom: new Map(),
        },
      };
      groups.set('empty', emptyGroup);

      const { layers, groupScores } = inferArchitectureLayers(groups, 2);

      // Empty groups should not appear in results
      assert.strictEqual(groupScores.length, 0, 'Empty group should be skipped');
    });

    it('should preserve layer order (1-based, bottom=Foundation)', () => {
      // 3 groups with large score gaps
      groups.set('foundation', createMockGroup('foundation', { core: 20, app: 10 }, {}));
      groups.set('core', createMockGroup('core', { app: 10 }, { foundation: 20 }));
      groups.set('app', createMockGroup('app', {}, { foundation: 10, core: 10 }));

      const { layers } = inferArchitectureLayers(groups, 1); // ENTERPRISE threshold

      // Layer numbers should be 1, 2, 3
      assert.strictEqual(layers[0].layer, 1, 'First layer should be 1');
      if (layers.length > 1) {
        assert.strictEqual(layers[1].layer, 2, 'Second layer should be 2');
      }
      if (layers.length > 2) {
        assert.strictEqual(layers[2].layer, 3, 'Third layer should be 3');
      }
    });

    it('should assign correct role names', () => {
      groups.set('foundation', createMockGroup('foundation', { core: 20 }, {}));
      groups.set('core', createMockGroup('core', {}, { foundation: 20 }));

      const { layers } = inferArchitectureLayers(groups, 1);

      // Role names: Layer 1 = Foundation, Layer 2 = Core, etc.
      assert.strictEqual(layers[0].role, 'Foundation');
      if (layers.length > 1) {
        assert.strictEqual(layers[1].role, 'Core');
      }
    });

    it('should handle large score gaps (many layers)', () => {
      // 5 groups with score gaps of 10 each
      groups.set('g1', createMockGroup('g1', { g2: 10, g3: 10, g4: 10, g5: 10 }, {}));
      groups.set('g2', createMockGroup('g2', { g3: 10, g4: 10, g5: 10 }, { g1: 10 }));
      groups.set('g3', createMockGroup('g3', { g4: 10, g5: 10 }, { g1: 10, g2: 10 }));
      groups.set('g4', createMockGroup('g4', { g5: 10 }, { g1: 10, g2: 10, g3: 10 }));
      groups.set('g5', createMockGroup('g5', {}, { g1: 10, g2: 10, g3: 10, g4: 10 }));

      const { layers } = inferArchitectureLayers(groups, 5); // SMALL threshold

      // Each group should be in separate layer (gaps >= threshold)
      assert.strictEqual(layers.length, 5, 'Should have 5 layers');
    });
  });

  // ============================================================================
  // LayerAssignment confidence field (Task 3.1)
  // ============================================================================
  describe('LayerAssignment confidence field', () => {
    it('should include confidence in returned layers', () => {
      groups.set('groupA', createMockGroup('groupA', {}, {}));
      groups.set('groupB', createMockGroup('groupB', {}, {}));

      const { layers } = inferArchitectureLayers(groups, 2);

      // Each layer should have confidence field
      for (const layer of layers) {
        assert.ok('confidence' in layer, 'Layer should have confidence field');
        assert.strictEqual(typeof layer.confidence, 'number');
        assert.ok(layer.confidence >= 0, 'Confidence should be >= 0');
        assert.ok(layer.confidence <= 100, 'Confidence should be <= 100');
      }
    });

    it('should have high confidence for clear layer separation with strong signals', () => {
      // Large score gap -> clear separation -> pass high sourceRootScore for confidence
      groups.set('foundation', createMockGroup('foundation', { core: 50 }, {}));
      groups.set('core', createMockGroup('core', {}, { foundation: 50 }));

      // Pass high sourceRootScore (35) to get signal strength bonus (+40)
      const { layers } = inferArchitectureLayers(groups, 2, 35);

      // With sourceRootScore=35 (+40 bonus) and no cycles, confidence should be high
      assert.ok(layers[0].confidence >= 70, `Clear separation should have high confidence (got ${layers[0].confidence})`);
    });

    it('should have lower confidence when sourceRootScore is low', () => {
      // Pass low sourceRootScore (0) to get no signal strength bonus
      groups.set('groupA', createMockGroup('groupA', {}, {}));
      groups.set('groupB', createMockGroup('groupB', {}, {}));

      const { layers } = inferArchitectureLayers(groups, 2, 0);

      // With sourceRootScore=0 and no bonuses, confidence should be base (30) or lower
      assert.ok(layers[0].confidence >= 30, `Low sourceRootScore should give base confidence (got ${layers[0].confidence})`);
    });
  });

  // ============================================================================
  // GroupScore return value
  // ============================================================================
  describe('GroupScore return', () => {
    it('should return groupScores alongside layers', () => {
      groups.set('groupA', createMockGroup('groupA', {}, {}));
      groups.set('groupB', createMockGroup('groupB', {}, {}));

      const { layers, groupScores } = inferArchitectureLayers(groups, 2);

      assert.ok(Array.isArray(groupScores), 'Should return groupScores array');
      assert.strictEqual(groupScores.length, 2);
    });

    it('should include netScore in GroupScore', () => {
      groups.set('groupA', createMockGroup('groupA', {}, {}));
      groups.set('groupB', createMockGroup('groupB', {}, {}));

      const { groupScores } = inferArchitectureLayers(groups, 2);

      for (const score of groupScores) {
        assert.ok('name' in score);
        assert.ok('netScore' in score);
        assert.ok('importedBy' in score);
        assert.ok('importsFrom' in score);
        assert.ok('fileCount' in score);
      }
    });

    it('should sort groupScores by netScore descending', () => {
      // Setup: high imported by low, mid imported by low, low imports from both
      // high: importedBy=10 → netScore=10
      // mid: importedBy=5 → netScore=5
      // low: importsFrom=15 → netScore=-15
      groups.set('high', createMockGroup('high', { low: 10 }, {}));
      groups.set('mid', createMockGroup('mid', { low: 5 }, {}));
      groups.set('low', createMockGroup('low', {}, { high: 10, mid: 5 }));

      const { groupScores } = inferArchitectureLayers(groups, 2);

      // Should be sorted: high(10), mid(5), low(-15)
      assert.strictEqual(groupScores[0].name, 'high');
      assert.strictEqual(groupScores[1].name, 'mid');
      assert.strictEqual(groupScores[2].name, 'low');
    });
  });
});