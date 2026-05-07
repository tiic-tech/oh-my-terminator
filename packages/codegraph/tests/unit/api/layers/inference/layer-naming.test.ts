/**
 * Tests for Layer Role Name Inference (Task 6.1-6.4)
 *
 * Tests inferLayerRoleNames() function:
 * - 6.1: Single pattern match
 * - 6.2: Multiple pattern match with priority resolution
 * - 6.3: Exact vs substring match preference
 * - 6.4: Fallback to generic name
 *
 * Run with: pnpm test tests/unit/api/layers/inference/layer-naming.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  inferLayerRoleNames,
  type LayerRoleResult,
} from '../../../../../src/api/layers/inference/layer-naming.js';
import { DEFAULT_NAMING_RULES, type NamingRule } from '../../../../../src/api/layers/inference/naming-rules.js';

// ============================================================================
// Task 6.1: Single Pattern Match Tests
// ============================================================================
describe('inferLayerRoleNames - single pattern match (Task 6.1)', () => {
  describe('exact anchored match', () => {
    it('should match "api" exactly and return "API Layer"', () => {
      const result = inferLayerRoleNames(['api'], 5);
      assert.strictEqual(result.role, 'API Layer');
      assert.strictEqual(result.confidence, 100, 'Exact match should have confidence 100');
    });

    it('should match "persistence" exactly and return "Data Layer"', () => {
      const result = inferLayerRoleNames(['persistence'], 5);
      assert.strictEqual(result.role, 'Data Layer');
      assert.strictEqual(result.confidence, 100);
    });

    it('should match "cli" exactly and return "CLI Layer"', () => {
      const result = inferLayerRoleNames(['cli'], 5);
      assert.strictEqual(result.role, 'CLI Layer');
      assert.strictEqual(result.confidence, 100);
    });
  });

  describe('case-insensitive matching', () => {
    it('should match "API" (uppercase) to "API Layer"', () => {
      const result = inferLayerRoleNames(['API'], 5);
      assert.strictEqual(result.role, 'API Layer');
      assert.strictEqual(result.confidence, 100);
    });

    it('should match "Services" (capitalized) to "Service Layer"', () => {
      const result = inferLayerRoleNames(['Services'], 5);
      assert.strictEqual(result.role, 'Service Layer');
      assert.strictEqual(result.confidence, 100);
    });
  });

  describe('substring match (unanchored pattern)', () => {
    it('should match "my-services-dir" substring to "Service Layer"', () => {
      // Services pattern is anchored ^(services|workers|jobs)$
      // This should NOT match as substring because anchored
      const result = inferLayerRoleNames(['my-services-dir'], 5);
      assert.strictEqual(result.role, 'Layer 5', 'Anchored pattern should not match substring');
      assert.strictEqual(result.confidence, 0);
    });

    it('should match exact "services" to "Service Layer"', () => {
      const result = inferLayerRoleNames(['services'], 5);
      assert.strictEqual(result.role, 'Service Layer');
      assert.strictEqual(result.confidence, 100);
    });
  });
});

// ============================================================================
// Task 6.2: Multiple Pattern Match with Priority Resolution
// ============================================================================
describe('inferLayerRoleNames - multiple pattern match (Task 6.2)', () => {
  describe('different priority levels', () => {
    it('should select API Layer (priority 10) over Service Layer (priority 8)', () => {
      // api: priority 10, services: priority 8
      // Both are anchored patterns → exact match → confidence 100
      const result = inferLayerRoleNames(['api', 'services'], 5);
      assert.strictEqual(result.role, 'API Layer');
      assert.strictEqual(result.confidence, 100, 'Exact anchored match selected → confidence 100');
    });

    it('should select Data Layer (priority 10) over Utility Layer (priority 5)', () => {
      // persistence: priority 10, utils: priority 5
      // Both are anchored patterns → exact match → confidence 100
      const result = inferLayerRoleNames(['persistence', 'utils'], 5);
      assert.strictEqual(result.role, 'Data Layer');
      assert.strictEqual(result.confidence, 100, 'Exact anchored match selected → confidence 100');
    });

    it('should have confidence 50 when multiple substring matches (no exact)', () => {
      // Custom rules with unanchored patterns only
      const customRules: NamingRule[] = [
        { pattern: 'api', role: 'API (substring)', priority: 10 },
        { pattern: 'service', role: 'Service (substring)', priority: 8 },
      ];
      const result = inferLayerRoleNames(['my-api', 'my-service'], 5, customRules);
      assert.strictEqual(result.role, 'API (substring)');
      assert.strictEqual(result.confidence, 50, 'Multiple substring matches → confidence 50');
    });
  });

  describe('same priority level', () => {
    it('should select first match when priorities are equal', () => {
      // api and routes both have priority 10
      // api pattern: ^(api|routes|endpoints)$ - single pattern covers both
      const result = inferLayerRoleNames(['routes', 'api'], 5);
      assert.strictEqual(result.role, 'API Layer');
      assert.strictEqual(result.confidence, 100, 'Both match same anchored pattern');
    });

    it('should handle multiple Tier 2 patterns (priority 9)', () => {
      // infrastructure and config both have priority 9
      const result = inferLayerRoleNames(['infrastructure', 'config'], 5);
      // First match wins (infrastructure)
      assert.strictEqual(result.role, 'Infrastructure Layer');
      assert.strictEqual(result.confidence, 100);
    });
  });
});

// ============================================================================
// Task 6.3: Exact vs Substring Match Preference
// ============================================================================
describe('inferLayerRoleNames - exact vs substring preference (Task 6.3)', () => {
  describe('anchored pattern boost', () => {
    it('anchored pattern should get +10 priority boost', () => {
      // Custom rules: anchored exact match vs unanchored substring
      const customRules: NamingRule[] = [
        { pattern: 'api', role: 'API (substring)', priority: 10 }, // unanchored
        { pattern: '^api$', role: 'API (exact)', priority: 5 }, // anchored, gets +10 = 15
      ];

      const result = inferLayerRoleNames(['api'], 5, customRules);
      assert.strictEqual(result.role, 'API (exact)', 'Anchored should beat substring');
      assert.strictEqual(result.confidence, 100);
    });

    it('substring match should work when no anchored match available', () => {
      // Unanchored pattern matches substring
      const customRules: NamingRule[] = [
        { pattern: 'service', role: 'Service Layer', priority: 8 }, // unanchored
      ];

      const result = inferLayerRoleNames(['my-service-layer'], 5, customRules);
      assert.strictEqual(result.role, 'Service Layer');
      assert.strictEqual(result.confidence, 80, 'Single substring match');
    });
  });

  describe('exact match detection', () => {
    it('should detect anchored pattern with ^ and $', () => {
      const result = inferLayerRoleNames(['db'], 5);
      // db is in anchored pattern ^(persistence|data|storage|db)$
      assert.strictEqual(result.role, 'Data Layer');
      assert.strictEqual(result.confidence, 100);
    });

    it('should NOT match partial for anchored patterns', () => {
      const result = inferLayerRoleNames(['mydb'], 5);
      // db pattern is anchored, should NOT match "mydb" substring
      assert.strictEqual(result.role, 'Layer 5');
      assert.strictEqual(result.confidence, 0);
    });
  });
});

// ============================================================================
// Task 6.4: Fallback to Generic Name
// ============================================================================
describe('inferLayerRoleNames - fallback behavior (Task 6.4)', () => {
  describe('no matches', () => {
    it('should return "Layer N" when no pattern matches', () => {
      const result = inferLayerRoleNames(['unknown-directory'], 5);
      assert.strictEqual(result.role, 'Layer 5');
      assert.strictEqual(result.confidence, 0);
    });

    it('should return "Layer N" for unrecognized group names', () => {
      const result = inferLayerRoleNames(['foobar', 'random'], 7);
      assert.strictEqual(result.role, 'Layer 7');
      assert.strictEqual(result.confidence, 0);
    });
  });

  describe('empty input', () => {
    it('should return "Layer N" for empty groups array', () => {
      const result = inferLayerRoleNames([], 5);
      assert.strictEqual(result.role, 'Layer 5');
      assert.strictEqual(result.confidence, 0);
    });
  });

  describe('layer number preservation', () => {
    it('should use provided layer number in fallback name', () => {
      const result = inferLayerRoleNames(['xyz'], 10);
      assert.strictEqual(result.role, 'Layer 10');
    });

    it('should use layer 1 when no groups', () => {
      const result = inferLayerRoleNames([], 1);
      assert.strictEqual(result.role, 'Layer 1');
    });
  });
});

// ============================================================================
// Confidence Calculation Tests
// ============================================================================
describe('inferLayerRoleNames - confidence calculation', () => {
  it('exact anchored match should have confidence 100', () => {
    const result = inferLayerRoleNames(['api'], 5);
    assert.strictEqual(result.confidence, 100);
  });

  it('single substring match should have confidence 80', () => {
    const customRules: NamingRule[] = [
      { pattern: 'api', role: 'API Layer', priority: 10 }, // unanchored
    ];
    const result = inferLayerRoleNames(['my-api'], 5, customRules);
    assert.strictEqual(result.confidence, 80);
  });

  it('multiple anchored matches should have confidence 100 (highest is exact)', () => {
    // api and services both match anchored patterns
    // Selected match (api) is exact → confidence 100
    const result = inferLayerRoleNames(['api', 'services'], 5);
    assert.strictEqual(result.confidence, 100, 'Selected match is exact anchored → confidence 100');
  });

  it('multiple substring matches should have confidence 50 (no exact)', () => {
    const customRules: NamingRule[] = [
      { pattern: 'api', role: 'API', priority: 10 },
      { pattern: 'service', role: 'Service', priority: 8 },
    ];
    const result = inferLayerRoleNames(['my-api-dir', 'my-service-dir'], 5, customRules);
    assert.strictEqual(result.confidence, 50, 'No exact match selected → confidence 50');
  });

  it('no match should have confidence 0', () => {
    const result = inferLayerRoleNames(['xyz'], 5);
    assert.strictEqual(result.confidence, 0);
  });
});

// ============================================================================
// Custom Rules Tests
// ============================================================================
describe('inferLayerRoleNames - custom rules', () => {
  it('should use custom rules when provided', () => {
    const customRules: NamingRule[] = [
      { pattern: '^custom$', role: 'Custom Layer', priority: 15 },
    ];
    const result = inferLayerRoleNames(['custom'], 5, customRules);
    assert.strictEqual(result.role, 'Custom Layer');
  });

  it('should use default rules when no custom rules provided', () => {
    const result = inferLayerRoleNames(['api'], 5);
    assert.strictEqual(result.role, 'API Layer');
  });

  it('should merge custom rules with defaults (append pattern)', () => {
    // Custom rule appended to defaults
    const customRules: NamingRule[] = [
      { pattern: '^special$', role: 'Special Layer', priority: 20 },
    ];
    const result = inferLayerRoleNames(['special'], 5, customRules);
    assert.strictEqual(result.role, 'Special Layer');
  });
});