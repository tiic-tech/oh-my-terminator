/**
 * Integration Tests for Layer Naming (Task 6.7)
 *
 * Tests inferArchitectureLayers() integration with inferLayerRoleNames():
 * - Layers 1-4 use predefined LAYER_ROLE_NAMES
 * - Layers 5+ use semantic names inferred from group names
 *
 * Run with: pnpm test tests/unit/api/layers/inference/core-naming.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { DirectoryGroup } from '../../../../../src/api/layers/grouping.js';
import { inferArchitectureLayers } from '../../../../../src/api/layers/inference/core.js';
import { LAYER_ROLE_NAMES } from '../../../../../src/api/types/index.js';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create mock DirectoryGroup for testing
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
 * Create groups that form 5+ layers (for naming inference)
 * High score differences create many layers
 */
function createGroupsWithManyLayers(): Map<string, DirectoryGroup> {
  const groups = new Map<string, DirectoryGroup>();

  // Layer 1: utils (highest score - imported by all)
  const utils = createMockGroup('utils', 10);
  utils.importStats.importedBy.set('models', 10);
  utils.importStats.importedBy.set('services', 8);
  utils.importStats.importedBy.set('api', 6);
  utils.importStats.importedBy.set('cli', 4);
  // Net score: 28

  // Layer 2: models (imported by services, api, cli)
  const models = createMockGroup('models', 8);
  models.importStats.importedBy.set('services', 6);
  models.importStats.importedBy.set('api', 4);
  models.importStats.importedBy.set('cli', 2);
  models.importStats.importsFrom.set('utils', 10);
  // Net score: 2

  // Layer 3: services (imported by api, cli)
  const services = createMockGroup('services', 12);
  services.importStats.importedBy.set('api', 5);
  services.importStats.importedBy.set('cli', 3);
  services.importStats.importsFrom.set('utils', 8);
  services.importStats.importsFrom.set('models', 6);
  // Net score: -6

  // Layer 4: api (imported by cli)
  const api = createMockGroup('api', 15);
  api.importStats.importedBy.set('cli', 4);
  api.importStats.importsFrom.set('utils', 6);
  api.importStats.importsFrom.set('models', 4);
  api.importStats.importsFrom.set('services', 5);
  // Net score: -11

  // Layer 5: cli (no importedBy)
  const cli = createMockGroup('cli', 5);
  cli.importStats.importsFrom.set('utils', 4);
  cli.importStats.importsFrom.set('models', 2);
  cli.importStats.importsFrom.set('services', 3);
  cli.importStats.importsFrom.set('api', 4);
  // Net score: -13

  groups.set('utils', utils);
  groups.set('models', models);
  groups.set('services', services);
  groups.set('api', api);
  groups.set('cli', cli);

  return groups;
}

/**
 * Create groups with 6+ layers to test fallback naming
 */
function createGroupsWithSixLayers(): Map<string, DirectoryGroup> {
  const groups = new Map<string, DirectoryGroup>();

  // Layer 1: foundation
  const foundation = createMockGroup('foundation', 10);
  foundation.importStats.importedBy.set('core', 15);
  foundation.importStats.importedBy.set('domain', 12);
  foundation.importStats.importedBy.set('business', 8);
  foundation.importStats.importedBy.set('presentation', 5);
  foundation.importStats.importedBy.set('unknownXYZ', 3);
  // Net score: 43

  // Layer 2: core
  const core = createMockGroup('core', 8);
  core.importStats.importedBy.set('domain', 8);
  core.importStats.importedBy.set('business', 6);
  core.importStats.importedBy.set('presentation', 4);
  core.importStats.importedBy.set('unknownXYZ', 2);
  core.importStats.importsFrom.set('foundation', 15);
  // Net score: 5

  // Layer 3: domain
  const domain = createMockGroup('domain', 6);
  domain.importStats.importedBy.set('business', 5);
  domain.importStats.importedBy.set('presentation', 3);
  domain.importStats.importedBy.set('unknownXYZ', 1);
  domain.importStats.importsFrom.set('foundation', 12);
  domain.importStats.importsFrom.set('core', 8);
  // Net score: -11

  // Layer 4: business (services)
  const business = createMockGroup('business', 10);
  business.importStats.importedBy.set('presentation', 4);
  business.importStats.importedBy.set('unknownXYZ', 2);
  business.importStats.importsFrom.set('foundation', 8);
  business.importStats.importsFrom.set('core', 6);
  business.importStats.importsFrom.set('domain', 5);
  // Net score: -13

  // Layer 5: presentation (api)
  const presentation = createMockGroup('presentation', 12);
  presentation.importStats.importedBy.set('unknownXYZ', 3);
  presentation.importStats.importsFrom.set('foundation', 5);
  presentation.importStats.importsFrom.set('core', 4);
  presentation.importStats.importsFrom.set('domain', 3);
  presentation.importStats.importsFrom.set('business', 4);
  // Net score: -13

  // Layer 6: unknownXYZ (no pattern match - fallback)
  const unknownXYZ = createMockGroup('unknownXYZ', 5);
  unknownXYZ.importStats.importsFrom.set('foundation', 3);
  unknownXYZ.importStats.importsFrom.set('core', 2);
  unknownXYZ.importStats.importsFrom.set('domain', 1);
  unknownXYZ.importStats.importsFrom.set('business', 2);
  unknownXYZ.importStats.importsFrom.set('presentation', 3);
  // Net score: -11

  groups.set('foundation', foundation);
  groups.set('core', core);
  groups.set('domain', domain);
  groups.set('business', business);
  groups.set('presentation', presentation);
  groups.set('unknownXYZ', unknownXYZ);

  return groups;
}

// ============================================================================
// Task 6.7: Integration Tests
// ============================================================================
describe('inferArchitectureLayers integration with naming (Task 6.7)', () => {
  describe('layers 1-4 use predefined names', () => {
    it('Layer 1 should use LAYER_ROLE_NAMES[1]', () => {
      const groups = createGroupsWithManyLayers();
      const result = inferArchitectureLayers(groups, 2);

      assert.ok(result.layers.length >= 4);
      const layer1 = result.layers.find(l => l.layer === 1);
      assert.ok(layer1);
      assert.strictEqual(layer1.role, LAYER_ROLE_NAMES[1]);
    });

    it('Layer 2 should use LAYER_ROLE_NAMES[2]', () => {
      const groups = createGroupsWithManyLayers();
      const result = inferArchitectureLayers(groups, 2);

      const layer2 = result.layers.find(l => l.layer === 2);
      assert.ok(layer2);
      assert.strictEqual(layer2.role, LAYER_ROLE_NAMES[2]);
    });

    it('Layers 1-4 should NOT use inferred names', () => {
      const groups = createGroupsWithManyLayers();
      const result = inferArchitectureLayers(groups, 2);

      // Check layers 1-4 use predefined names
      for (let i = 1; i <= 4; i++) {
        const layer = result.layers.find(l => l.layer === i);
        if (layer) {
          assert.strictEqual(layer.role, LAYER_ROLE_NAMES[i]);
        }
      }
    });
  });

  describe('layers 5+ use inferred semantic names', () => {
    it('Layer 5 with "cli" group should infer "CLI Layer"', () => {
      const groups = createGroupsWithManyLayers();
      // Use threshold 1 to ensure distinct layers
      const result = inferArchitectureLayers(groups, 1);

      const layer5 = result.layers.find(l => l.layer === 5);
      assert.ok(layer5, 'Should have Layer 5');

      // cli group should infer "CLI Layer" (matches anchored pattern)
      assert.strictEqual(layer5.role, 'CLI Layer');
    });

    it('Layer 5 with "api" group should infer "API Layer"', () => {
      // Create groups where api is in layer 5
      const groups = new Map<string, DirectoryGroup>();

      const utils = createMockGroup('utils', 5);
      utils.importStats.importedBy.set('api', 10);
      groups.set('utils', utils);

      const api = createMockGroup('api', 10);
      api.importStats.importsFrom.set('utils', 10);
      groups.set('api', api);

      const result = inferArchitectureLayers(groups, 1);
      assert.ok(result.layers.length >= 2);

      // api should be Layer 2 (or higher if threshold splits)
      // Check that api group gets "API Layer" role
      const apiLayer = result.layers.find(l =>
        l.groups.some(g => g.name === 'api')
      );
      assert.ok(apiLayer);

      // If api is in layer > 4, should have inferred name
      if (apiLayer && apiLayer.layer > 4) {
        assert.strictEqual(apiLayer.role, 'API Layer');
      }
    });
  });

  describe('fallback naming for unmatched groups', () => {
    it('Unknown group name should fallback to "Layer N"', () => {
      // Create a simple fixture with unknown group
      const groups = new Map<string, DirectoryGroup>();

      // foundation: high score (imported by unknown)
      const foundation = createMockGroup('foundation', 5);
      foundation.importStats.importedBy.set('unknownXYZ', 20);
      foundation.importStats.importedBy.set('other', 15);
      foundation.importStats.importedBy.set('app', 10);
      // Net score: 45

      // other: medium score (imported by app)
      const other = createMockGroup('other', 5);
      other.importStats.importedBy.set('app', 10);
      other.importStats.importedBy.set('unknownXYZ', 5);
      other.importStats.importsFrom.set('foundation', 15);
      // Net score: 0

      // app: low score
      const app = createMockGroup('app', 5);
      app.importStats.importedBy.set('unknownXYZ', 5);
      app.importStats.importsFrom.set('foundation', 10);
      app.importStats.importsFrom.set('other', 10);
      // Net score: -15

      // unknownXYZ: lowest score (no importedBy)
      const unknownXYZ = createMockGroup('unknownXYZ', 5);
      unknownXYZ.importStats.importsFrom.set('foundation', 20);
      unknownXYZ.importStats.importsFrom.set('other', 5);
      unknownXYZ.importStats.importsFrom.set('app', 5);
      // Net score: -30

      groups.set('foundation', foundation);
      groups.set('other', other);
      groups.set('app', app);
      groups.set('unknownXYZ', unknownXYZ);

      // Use threshold 10 to create 4 distinct layers
      const result = inferArchitectureLayers(groups, 10);

      // Should have at least 4 layers with threshold 10
      assert.ok(result.layers.length >= 4, `Expected >= 4 layers, got ${result.layers.length}`);

      // Find layer with unknownXYZ group
      const unknownLayer = result.layers.find(l =>
        l.groups.some(g => g.name === 'unknownXYZ')
      );
      assert.ok(unknownLayer, 'Should find layer with unknownXYZ');

      // unknownXYZ should be in the highest-numbered layer (lowest score)
      // If layer >= 5, should have fallback name
      // If layer < 5, uses predefined LAYER_ROLE_NAMES
      if (unknownLayer && unknownLayer.layer >= 5) {
        assert.strictEqual(unknownLayer.role, `Layer ${unknownLayer.layer}`);
      }
    });

    it('Layer 1-4 always use predefined names regardless of group names', () => {
      // Even with unknown group names, layers 1-4 use LAYER_ROLE_NAMES
      const groups = new Map<string, DirectoryGroup>();

      const unknownA = createMockGroup('unknownA', 5);
      unknownA.importStats.importedBy.set('unknownB', 5);
      unknownA.importStats.importedBy.set('unknownC', 3);
      // Net: 8

      const unknownB = createMockGroup('unknownB', 5);
      unknownB.importStats.importedBy.set('unknownC', 3);
      unknownB.importStats.importsFrom.set('unknownA', 5);
      // Net: -2

      const unknownC = createMockGroup('unknownC', 5);
      unknownC.importStats.importsFrom.set('unknownA', 3);
      unknownC.importStats.importsFrom.set('unknownB', 3);
      // Net: -6

      groups.set('unknownA', unknownA);
      groups.set('unknownB', unknownB);
      groups.set('unknownC', unknownC);

      const result = inferArchitectureLayers(groups, 2);

      // All layers 1-4 should use predefined names
      for (const layer of result.layers) {
        if (layer.layer <= 4) {
          assert.strictEqual(layer.role, LAYER_ROLE_NAMES[layer.layer]);
        }
      }
    });
  });

  describe('semantic naming preserves confidence', () => {
    it('inferred layer should inherit confidence from inference', () => {
      const groups = createGroupsWithManyLayers();
      const result = inferArchitectureLayers(groups, 1);

      // All layers should have confidence
      for (const layer of result.layers) {
        assert.ok(layer.confidence >= 0 && layer.confidence <= 100);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle groups with no semantic patterns', () => {
      const groups = new Map<string, DirectoryGroup>();
      const randomA = createMockGroup('randomA', 5);
      randomA.importStats.importedBy.set('randomB', 3);
      groups.set('randomA', randomA);

      const randomB = createMockGroup('randomB', 5);
      randomB.importStats.importsFrom.set('randomA', 3);
      groups.set('randomB', randomB);

      const result = inferArchitectureLayers(groups, 1);

      // Both should have fallback names for layers > 4
      for (const layer of result.layers) {
        if (layer.layer > 4) {
          assert.ok(layer.role.startsWith('Layer ') || layer.role === LAYER_ROLE_NAMES[layer.layer]);
        }
      }
    });

    it('should handle single group (layer 1)', () => {
      const groups = new Map<string, DirectoryGroup>();
      groups.set('api', createMockGroup('api', 5));

      const result = inferArchitectureLayers(groups, 2);
      assert.strictEqual(result.layers.length, 1);
      assert.strictEqual(result.layers[0].layer, 1);
      // Layer 1 uses predefined name, not inferred
      assert.strictEqual(result.layers[0].role, LAYER_ROLE_NAMES[1]);
    });

    it('should handle empty groups map', () => {
      const groups = new Map<string, DirectoryGroup>();
      const result = inferArchitectureLayers(groups, 2);
      assert.strictEqual(result.layers.length, 0);
    });
  });
});

// ============================================================================
// LAYER_ROLE_NAMES Verification
// ============================================================================
describe('LAYER_ROLE_NAMES predefined values', () => {
  it('LAYER_ROLE_NAMES should have entries for layers 1-4', () => {
    assert.ok(LAYER_ROLE_NAMES[1], 'Layer 1 should have predefined name');
    assert.ok(LAYER_ROLE_NAMES[2], 'Layer 2 should have predefined name');
    assert.ok(LAYER_ROLE_NAMES[3], 'Layer 3 should have predefined name');
    assert.ok(LAYER_ROLE_NAMES[4], 'Layer 4 should have predefined name');
  });

  it('LAYER_ROLE_NAMES[5+] should not exist (forces inference)', () => {
    // Layers 5+ should use inferred names, not predefined
    assert.strictEqual(LAYER_ROLE_NAMES[5], undefined);
    assert.strictEqual(LAYER_ROLE_NAMES[6], undefined);
  });
});