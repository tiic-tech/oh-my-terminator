/**
 * Naming Rule Validation
 *
 * WHY: Validation logic separated from config module for testability.
 * HOW: Schema-based validation with partial success pattern.
 *
 * Validation rules:
 * 1. pattern: Must be valid RegExp string (can be compiled)
 * 2. role: Must have at least 1 character (minLength: 1)
 * 3. priority: Must be number in range 0-100
 *
 * ELASTIC EXCEPTION (coding-taste Rule 2): File exceeds 150 threshold.
 * NOT split because: validateSingleRule + validateNamingRules are tightly
 * related - the latter calls the former for each rule. Splitting would
 * produce files <50 lines each that fragment this cohesive validation unit.
 *
 * @see naming-rule-types.ts for type definitions
 * @see coding-taste skill - "Schema is the truth"
 */

import type { NamingRule } from '../api/layers/inference/naming-rules.js';
import type {
  NamingRuleConfig,
  RuleValidationResult,
  NamingRulesValidationResult,
} from './naming-rule-types.js';

/**
 * Validate a single naming rule config
 *
 * WHY: Comprehensive validation prevents runtime errors.
 * HOW: Check each field against schema constraints.
 *
 * @param rule - Rule config to validate (unknown for safety)
 * @returns RuleValidationResult with valid flag and error if invalid
 */
export function validateSingleRule(rule: unknown): RuleValidationResult {
  // Type check: must be object
  if (typeof rule !== 'object' || rule === null) {
    return {
      valid: false,
      rule: {},
      error: 'Rule must be an object',
    };
  }

  const r = rule as Record<string, unknown>;

  // pattern check (required)
  if (!('pattern' in r)) {
    return {
      valid: false,
      rule: r,
      error: 'Rule missing required "pattern" field',
    };
  }

  if (typeof r.pattern !== 'string') {
    return {
      valid: false,
      rule: r,
      error: `"pattern" must be string, got ${typeof r.pattern}`,
    };
  }

  // Validate pattern is valid RegExp (try compiling)
  try {
    new RegExp(r.pattern);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Invalid RegExp';
    return {
      valid: false,
      rule: r,
      error: `Invalid RegExp pattern: ${errorMsg}`,
    };
  }

  // role check (required, minLength: 1)
  if (!('role' in r)) {
    return {
      valid: false,
      rule: r,
      error: 'Rule missing required "role" field',
    };
  }

  if (typeof r.role !== 'string') {
    return {
      valid: false,
      rule: r,
      error: `"role" must be string, got ${typeof r.role}`,
    };
  }

  if (r.role.length === 0) {
    return {
      valid: false,
      rule: r,
      error: '"role" must have at least 1 character (minLength: 1)',
    };
  }

  // priority check (required, 0-100 range)
  if (!('priority' in r)) {
    return {
      valid: false,
      rule: r,
      error: 'Rule missing required "priority" field',
    };
  }

  if (typeof r.priority !== 'number') {
    return {
      valid: false,
      rule: r,
      error: `"priority" must be number, got ${typeof r.priority}`,
    };
  }

  if (r.priority < 0 || r.priority > 100) {
    return {
      valid: false,
      rule: r,
      error: `"priority" must be in range 0-100, got ${r.priority}`,
    };
  }

  // All checks passed - return valid rule with proper type
  return {
    valid: true,
    rule: {
      pattern: r.pattern,
      role: r.role,
      priority: r.priority,
    },
  };
}

/**
 * Validate array of naming rule configs
 *
 * WHY: Partial success - skip invalid rules, continue with valid.
 * HOW: Validate each rule, collect valid and invalid results.
 *
 * Warning logged for each invalid rule (Task 3.4).
 *
 * @param rules - Array of rule configs (unknown for safety)
 * @returns NamingRulesValidationResult with validRules and invalidRules
 */
export function validateNamingRules(rules: unknown): NamingRulesValidationResult {
  const validRules: NamingRule[] = [];
  const invalidRules: RuleValidationResult[] = [];

  // Must be array
  if (!Array.isArray(rules)) {
    console.warn('[codegraph] namingRules must be array, ignoring invalid config');
    return {
      validRules: [],
      invalidRules: [],
    };
  }

  // Validate each rule
  for (const rule of rules) {
    const result = validateSingleRule(rule);

    if (result.valid) {
      // Convert string pattern to RegExp for NamingRule
      // When valid, rule is guaranteed to be NamingRuleConfig
      const validRule = result.rule as NamingRuleConfig;
      validRules.push({
        pattern: new RegExp(validRule.pattern, 'i'), // Case-insensitive
        role: validRule.role,
        priority: validRule.priority,
      });
    } else {
      // Warning log for invalid rules
      console.warn(`[codegraph] Invalid naming rule skipped: ${result.error}`);
      invalidRules.push(result);
    }
  }

  return {
    validRules,
    invalidRules,
  };
}