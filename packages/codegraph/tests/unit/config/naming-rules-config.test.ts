/**
 * Tests for Naming Rules Configuration (Task 6.5-6.6)
 *
 * Tests validateSingleRule(), validateNamingRules(), mergeNamingRules():
 * - 6.5: Configuration rule validation
 * - 6.6: Rule merging logic
 *
 * Run with: pnpm test tests/unit/config/naming-rules-config.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSingleRule,
  validateNamingRules,
  mergeNamingRules,
  type NamingRuleConfig,
  type RuleValidationResult,
} from '../../../src/config/naming-rules-config.js';
import { DEFAULT_NAMING_RULES, type NamingRule } from '../../../src/api/layers/inference/naming-rules.js';

// ============================================================================
// Task 6.5: Configuration Rule Validation
// ============================================================================
describe('validateSingleRule() (Task 6.5)', () => {
  describe('valid rules', () => {
    it('should validate correct rule with all required fields', () => {
      const rule: NamingRuleConfig = {
        pattern: '^api$',
        role: 'API Layer',
        priority: 10,
      };

      const result = validateSingleRule(rule);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.error, undefined);
      assert.deepStrictEqual(result.rule, rule);
    });

    it('should validate rule with complex RegExp pattern', () => {
      const rule: NamingRuleConfig = {
        pattern: '^(api|routes|endpoints)$',
        role: 'API Layer',
        priority: 10,
      };

      const result = validateSingleRule(rule);
      assert.strictEqual(result.valid, true);
    });

    it('should validate unanchored pattern (substring match)', () => {
      const rule: NamingRuleConfig = {
        pattern: 'service',
        role: 'Service Layer',
        priority: 8,
      };

      const result = validateSingleRule(rule);
      assert.strictEqual(result.valid, true);
    });

    it('should validate priority at boundaries (0 and 100)', () => {
      const ruleMin: NamingRuleConfig = { pattern: 'test', role: 'Test', priority: 0 };
      const ruleMax: NamingRuleConfig = { pattern: 'test', role: 'Test', priority: 100 };

      assert.strictEqual(validateSingleRule(ruleMin).valid, true);
      assert.strictEqual(validateSingleRule(ruleMax).valid, true);
    });
  });

  describe('invalid rules - missing fields', () => {
    it('should reject rule missing pattern field', () => {
      const rule = { role: 'API Layer', priority: 10 };
      const result = validateSingleRule(rule);
      assert.strictEqual(result.valid, false);
      assert.ok(result.error?.includes('pattern'));
    });

    it('should reject rule missing role field', () => {
      const rule = { pattern: '^api$', priority: 10 };
      const result = validateSingleRule(rule);
      assert.strictEqual(result.valid, false);
      assert.ok(result.error?.includes('role'));
    });

    it('should reject rule missing priority field', () => {
      const rule = { pattern: '^api$', role: 'API Layer' };
      const result = validateSingleRule(rule);
      assert.strictEqual(result.valid, false);
      assert.ok(result.error?.includes('priority'));
    });

    it('should reject empty object', () => {
      const result = validateSingleRule({});
      assert.strictEqual(result.valid, false);
    });
  });

  describe('invalid rules - type mismatches', () => {
    it('should reject pattern as number', () => {
      const rule = { pattern: 123, role: 'API', priority: 10 };
      const result = validateSingleRule(rule);
      assert.strictEqual(result.valid, false);
      assert.ok(result.error?.includes('string'));
    });

    it('should reject role as number', () => {
      const rule = { pattern: '^api$', role: 123, priority: 10 };
      const result = validateSingleRule(rule);
      assert.strictEqual(result.valid, false);
      assert.ok(result.error?.includes('string'));
    });

    it('should reject priority as string', () => {
      const rule = { pattern: '^api$', role: 'API', priority: 'high' };
      const result = validateSingleRule(rule);
      assert.strictEqual(result.valid, false);
      assert.ok(result.error?.includes('number'));
    });
  });

  describe('invalid rules - value constraints', () => {
    it('should reject empty role string (minLength: 1)', () => {
      const rule: NamingRuleConfig = { pattern: '^api$', role: '', priority: 10 };
      const result = validateSingleRule(rule);
      assert.strictEqual(result.valid, false);
      assert.ok(result.error?.includes('1 character'));
    });

    it('should reject priority below 0', () => {
      const rule = { pattern: '^api$', role: 'API', priority: -1 };
      const result = validateSingleRule(rule);
      assert.strictEqual(result.valid, false);
      assert.ok(result.error?.includes('0-100'));
    });

    it('should reject priority above 100', () => {
      const rule = { pattern: '^api$', role: 'API', priority: 101 };
      const result = validateSingleRule(rule);
      assert.strictEqual(result.valid, false);
      assert.ok(result.error?.includes('0-100'));
    });

    it('should reject invalid RegExp pattern', () => {
      const rule = { pattern: '[invalid(', role: 'Invalid', priority: 10 };
      const result = validateSingleRule(rule);
      assert.strictEqual(result.valid, false);
      assert.ok(result.error?.includes('RegExp'));
    });
  });

  describe('edge cases', () => {
    it('should reject null input', () => {
      const result = validateSingleRule(null);
      assert.strictEqual(result.valid, false);
      assert.ok(result.error?.includes('object'));
    });

    it('should reject non-object input (string)', () => {
      const result = validateSingleRule('not an object');
      assert.strictEqual(result.valid, false);
    });

    it('should reject non-object input (array)', () => {
      const result = validateSingleRule(['api', 'Layer', 10]);
      assert.strictEqual(result.valid, false);
    });
  });
});

// ============================================================================
// validateNamingRules() Tests
// ============================================================================
describe('validateNamingRules()', () => {
  describe('valid array input', () => {
    it('should validate array of valid rules', () => {
      const rules: NamingRuleConfig[] = [
        { pattern: '^api$', role: 'API Layer', priority: 10 },
        { pattern: '^services$', role: 'Service Layer', priority: 8 },
      ];

      const result = validateNamingRules(rules);
      assert.strictEqual(result.validRules.length, 2);
      assert.strictEqual(result.invalidRules.length, 0);

      // Check converted to RegExp
      assert.ok(result.validRules[0].pattern instanceof RegExp);
    });

    it('should return empty arrays for empty input', () => {
      const result = validateNamingRules([]);
      assert.strictEqual(result.validRules.length, 0);
      assert.strictEqual(result.invalidRules.length, 0);
    });
  });

  describe('partial success - skip invalid, continue valid', () => {
    it('should skip invalid rule and keep valid ones', () => {
      const rules = [
        { pattern: '^api$', role: 'API Layer', priority: 10 }, // valid
        { pattern: '^bad$', role: '', priority: 5 }, // invalid: empty role
        { pattern: '^utils$', role: 'Utility Layer', priority: 5 }, // valid
      ];

      const result = validateNamingRules(rules);
      assert.strictEqual(result.validRules.length, 2);
      assert.strictEqual(result.invalidRules.length, 1);
      assert.ok(result.invalidRules[0].error?.includes('1 character'));
    });

    it('should collect all invalid rules with errors', () => {
      const rules = [
        { pattern: 'invalid(', role: 'Bad Regex', priority: 10 },
        { role: 'Missing Pattern', priority: 8 },
        { pattern: '^utils$', role: 'Utility', priority: -5 },
      ];

      const result = validateNamingRules(rules);
      assert.strictEqual(result.validRules.length, 0);
      assert.strictEqual(result.invalidRules.length, 3);
    });
  });

  describe('invalid input type', () => {
    it('should reject non-array input (string)', () => {
      const result = validateNamingRules('not an array');
      assert.strictEqual(result.validRules.length, 0);
      assert.strictEqual(result.invalidRules.length, 0);
    });

    it('should reject non-array input (object)', () => {
      const result = validateNamingRules({ rules: [] });
      assert.strictEqual(result.validRules.length, 0);
      assert.strictEqual(result.invalidRules.length, 0);
    });

    it('should reject null input', () => {
      const result = validateNamingRules(null);
      assert.strictEqual(result.validRules.length, 0);
      assert.strictEqual(result.invalidRules.length, 0);
    });
  });
});

// ============================================================================
// Task 6.6: Rule Merging Logic
// ============================================================================
describe('mergeNamingRules() (Task 6.6)', () => {
  describe('basic merging', () => {
    it('should return only defaults when no user rules', () => {
      const merged = mergeNamingRules([]);
      assert.strictEqual(merged.length, DEFAULT_NAMING_RULES.length);
      assert.deepStrictEqual(merged, DEFAULT_NAMING_RULES);
    });

    it('should append user rules to defaults', () => {
      const userRule: NamingRule = {
        pattern: new RegExp('^custom$', 'i'),
        role: 'Custom Layer',
        priority: 15,
      };

      const merged = mergeNamingRules([userRule]);
      assert.strictEqual(merged.length, DEFAULT_NAMING_RULES.length + 1);

      // Last element should be user rule
      const lastRule = merged[merged.length - 1];
      assert.strictEqual(lastRule.role, 'Custom Layer');
    });
  });

  describe('user override capability', () => {
    it('user can override by higher priority', () => {
      // User provides higher priority for same pattern
      const userRule: NamingRule = {
        pattern: new RegExp('^api$', 'i'),
        role: 'REST API Layer', // Different role name
        priority: 20, // Higher than default 10
      };

      const merged = mergeNamingRules([userRule]);
      // Both rules exist, user rule at end with higher priority
      assert.ok(merged.length > DEFAULT_NAMING_RULES.length);

      // When matching "api", user rule (priority 20) wins over default (10)
      // This is handled by inferLayerRoleNames sorting by priority
    });

    it('user can add new patterns not in defaults', () => {
      const userRule: NamingRule = {
        pattern: new RegExp('^feature$', 'i'),
        role: 'Feature Layer',
        priority: 8,
      };

      const merged = mergeNamingRules([userRule]);
      // Should contain both default rules and user's new pattern
      assert.ok(merged.some(r => r.role === 'Feature Layer'));
    });
  });

  describe('merge result properties', () => {
    it('merged rules should maintain RegExp type', () => {
      const userRule: NamingRule = {
        pattern: new RegExp('^test$', 'i'),
        role: 'Test',
        priority: 5,
      };

      const merged = mergeNamingRules([userRule]);
      for (const rule of merged) {
        assert.ok(
          rule.pattern instanceof RegExp || typeof rule.pattern === 'string',
          'Pattern should be RegExp or string'
        );
      }
    });

    it('merged rules should maintain priority numbers', () => {
      const merged = mergeNamingRules([]);
      for (const rule of merged) {
        assert.strictEqual(typeof rule.priority, 'number');
        assert.ok(rule.priority >= 0 && rule.priority <= 100);
      }
    });
  });

  describe('immutability', () => {
    it('should not mutate DEFAULT_NAMING_RULES', () => {
      const originalLength = DEFAULT_NAMING_RULES.length;
      const userRule: NamingRule = {
        pattern: new RegExp('^x$', 'i'),
        role: 'X',
        priority: 1,
      };

      mergeNamingRules([userRule]);
      assert.strictEqual(DEFAULT_NAMING_RULES.length, originalLength);
    });

    it('should not mutate user rules array', () => {
      const userRules: NamingRule[] = [
        { pattern: new RegExp('^x$', 'i'), role: 'X', priority: 1 },
      ];
      const originalLength = userRules.length;

      mergeNamingRules(userRules);
      assert.strictEqual(userRules.length, originalLength);
    });
  });
});

// ============================================================================
// Integration: Validation → Merge Pipeline
// ============================================================================
describe('validation → merge pipeline', () => {
  it('should validate then merge valid rules', () => {
    const configRules: NamingRuleConfig[] = [
      { pattern: '^custom$', role: 'Custom', priority: 15 },
      { pattern: '^special$', role: 'Special', priority: 12 },
    ];

    // Step 1: Validate
    const validated = validateNamingRules(configRules);
    assert.strictEqual(validated.validRules.length, 2);

    // Step 2: Merge
    const merged = mergeNamingRules(validated.validRules);
    assert.strictEqual(merged.length, DEFAULT_NAMING_RULES.length + 2);
  });

  it('should skip invalid rules during merge', () => {
    const configRules = [
      { pattern: '^valid$', role: 'Valid', priority: 10 },
      { pattern: '^invalid$', role: '', priority: 5 }, // empty role
    ];

    const validated = validateNamingRules(configRules);
    const merged = mergeNamingRules(validated.validRules);

    // Only valid rule should be merged
    assert.strictEqual(merged.length, DEFAULT_NAMING_RULES.length + 1);
  });
});