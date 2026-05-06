/**
 * C8: Architecture Layers - Core Inference Tests
 *
 * Tests for dynamic threshold integration in inferArchitectureLayers.
 * WHY: Threshold should adapt to project scale, not be hardcoded.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { DirectoryGroup } from '../../../../../src/api/layers/grouping.js';
import { inferArchitectureLayers } from '../../../../../src/api/layers/inference/core.js';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a mock DirectoryGroup for testing
 */
function createMockGroup(name: string, fileCount: number): DirectoryGroup {
  return {
    files: Array(fileCount).fill(`src/${name}/file.ts`),
    importStats: {
      importedBy: new Map(),
      importsFrom: new Map(),
    },
  };
}

/**
 * Create groups with specific import patterns
 */
function createGroupsWithHierarchy(): Map<string, DirectoryGroup> {
  const groups = new Map<string, DirectoryGroup>();

  // Foundation: utils (imported by many)
  const utils = createMockGroup('utils', 5);
  utils.importStats.importedBy.set('services', 3);
  utils.importStats.importedBy.set('components', 2);
  utils.importStats.importedBy.set('pages', 2);
  // Net score: 7 (importedBy=7, importsFrom=0)

  // Core: services (imported by pages, imports utils)
  const services = createMockGroup('services', 10);
  services.importStats.importedBy.set('pages', 5);
  services.importStats.importsFrom.set('utils', 3);
  // Net score: 2 (importedBy=5, importsFrom=3)

  // Application: pages (imports services)
  const pages = createMockGroup('pages', 15);
  pages.importStats.importsFrom.set('services', 5);
  pages.importStats.importsFrom.set('utils', 2);
  // Net score: -7 (importedBy=0, importsFrom=7)

  groups.set('utils', utils);
  groups.set('services', services);
  groups.set('pages', pages);

  return groups;
}

/**
 * Create groups with scores close together (difference <= threshold)
 */
function createGroupsWithCloseScores(): Map<string, DirectoryGroup> {
  const groups = new Map<string, DirectoryGroup>();

  // Three groups with netScore differences of 1
  const group1 = createMockGroup('group1', 5);
  group1.importStats.importedBy.set('group2', 1);
  group1.importStats.importedBy.set('group3', 1);
  // Net score: 2

  const group2 = createMockGroup('group2', 5);
  group2.importStats.importedBy.set('group3', 1);
  group2.importStats.importsFrom.set('group1', 1);
  // Net score: 0

  const group3 = createMockGroup('group3', 5);
  group3.importStats.importsFrom.set('group1', 1);
  group3.importStats.importsFrom.set('group2', 1);
  // Net score: -2

  groups.set('group1', group1);
  groups.set('group2', group2);
  groups.set('group3', group3);

  return groups;
}

/**
 * Create groups with scores far apart (difference > threshold)
 */
function createGroupsWithDistantScores(): Map<string, DirectoryGroup> {
  const groups = new Map<string, DirectoryGroup>();

  // Three groups with large score differences
  const foundation = createMockGroup('foundation', 5);
  foundation.importStats.importedBy.set('core', 10);
  foundation.importStats.importedBy.set('app', 10);
  foundation.importStats.importedBy.set('ui', 10);
  // Net score: 30

  const core = createMockGroup('core', 10);
  core.importStats.importedBy.set('app', 5);
  core.importStats.importedBy.set('ui', 5);
  core.importStats.importsFrom.set('foundation', 10);
  // Net score: 0

  const app = createMockGroup('app', 15);
  app.importStats.importedBy.set('ui', 2);
  app.importStats.importsFrom.set('foundation', 10);
  app.importStats.importsFrom.set('core', 5);
  // Net score: -13

  const ui = createMockGroup('ui', 20);
  ui.importStats.importsFrom.set('foundation', 10);
  ui.importStats.importsFrom.set('core', 5);
  ui.importStats.importsFrom.set('app', 2);
  // Net score: -17

  groups.set('foundation', foundation);
  groups.set('core', core);
  groups.set('app', app);
  groups.set('ui', ui);

  return groups;
}

// ============================================================================
// inferArchitectureLayers with Dynamic Threshold Tests
// ============================================================================

describe('inferArchitectureLayers with dynamic threshold', () => {
  describe('threshold parameter', () => {
    it('should accept threshold parameter', () => {
      const groups = createGroupsWithHierarchy();
      // With explicit threshold
      const result = inferArchitectureLayers(groups, 5);
      assert.ok(result.layers.length >= 1);
      assert.ok(result.groupScores.length === 3);
    });

    it('should use default threshold 2 when not provided', () => {
      const groups = createGroupsWithHierarchy();
      // Without threshold - should use default
      const result = inferArchitectureLayers(groups);
      assert.ok(result.layers.length >= 1);
      // Default behavior should match threshold=2
      const resultWithDefault = inferArchitectureLayers(groups, 2);
      assert.deepStrictEqual(result.layers.length, resultWithDefault.layers.length);
    });
  });

  describe('threshold effect on layer grouping', () => {
    it('should merge close scores with high threshold (threshold=5)', () => {
      const groups = createGroupsWithCloseScores();
      // Scores differ by 1-2, threshold=5 should merge all into one layer
      const result = inferArchitectureLayers(groups, 5);

      // All groups should be in same layer when score diff <= 5
      assert.strictEqual(result.layers.length, 1);
      assert.strictEqual(result.layers[0].groups.length, 3);
    });

    it('should split distant scores with low threshold (threshold=1)', () => {
      const groups = createGroupsWithDistantScores();
      // Scores differ by 10+, threshold=1 should create multiple layers
      const result = inferArchitectureLayers(groups, 1);

      // Large score differences should create multiple layers
      assert.ok(result.layers.length >= 3);
    });

    it('should use threshold 5 for small project (aggressive depth)', () => {
      const groups = createGroupsWithHierarchy();
      // Small project: threshold=5, more groups merged together
      const resultSmall = inferArchitectureLayers(groups, 5);

      // With higher threshold, more groups stay together
      // utils(7) and services(2) differ by 5, should merge with threshold=5
      const utilsLayer = resultSmall.layers.find(l =>
        l.groups.some(g => g.name === 'utils')
      );
      const servicesLayer = resultSmall.layers.find(l =>
        l.groups.some(g => g.name === 'services')
      );

      // With threshold=5, utils(7) and services(2) should be same layer
      // Score diff = 5, which is <= threshold 5
      if (utilsLayer && servicesLayer) {
        assert.strictEqual(utilsLayer.layer, servicesLayer.layer);
      }
    });

    it('should use threshold 1 for enterprise project (conservative depth)', () => {
      const groups = createGroupsWithHierarchy();
      // Enterprise: threshold=1, groups split by finer granularity
      const resultEnterprise = inferArchitectureLayers(groups, 1);

      // With threshold=1, only identical scores merge
      // utils(7), services(2), pages(-7) all differ by more than 1
      // Should create separate layers for each significant score difference
      assert.ok(resultEnterprise.layers.length >= 2);
    });
  });

  describe('backward compatibility', () => {
    it('should maintain same behavior when threshold not provided', () => {
      const groups = createGroupsWithHierarchy();
      const resultNoThreshold = inferArchitectureLayers(groups);
      const resultThreshold2 = inferArchitectureLayers(groups, 2);

      // Should produce identical results
      assert.strictEqual(resultNoThreshold.layers.length, resultThreshold2.layers.length);
      assert.strictEqual(
        resultNoThreshold.groupScores.length,
        resultThreshold2.groupScores.length
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty groups', () => {
      const groups = new Map<string, DirectoryGroup>();
      const result = inferArchitectureLayers(groups, 2);
      assert.strictEqual(result.layers.length, 0);
      assert.strictEqual(result.groupScores.length, 0);
    });

    it('should handle single group', () => {
      const groups = new Map<string, DirectoryGroup>();
      const single = createMockGroup('single', 5);
      groups.set('single', single);

      const result = inferArchitectureLayers(groups, 2);
      assert.strictEqual(result.layers.length, 1);
      assert.strictEqual(result.layers[0].groups.length, 1);
    });

    it('should handle groups with zero files', () => {
      const groups = new Map<string, DirectoryGroup>();
      groups.set('empty', createMockGroup('empty', 0));
      groups.set('valid', createMockGroup('valid', 5));

      const result = inferArchitectureLayers(groups, 2);
      // Empty group should be skipped
      assert.ok(result.groupScores.length === 1);
      assert.ok(result.groupScores[0].name === 'valid');
    });
  });
});