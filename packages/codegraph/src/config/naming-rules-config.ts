/**
 * Naming Rules Configuration Module (Task 3.2-3.4)
 *
 * WHY: Module-level exports only public symbols.
 * Implementation details are in separate files for single responsibility.
 *
 * Barrel file pattern - re-exports all from:
 * - naming-rule-types.ts: Config schema types
 * - naming-rule-validation.ts: Validation functions
 * - naming-rule-merging.ts: Merge functions
 *
 * @see coding-taste skill - "Module-level re-exports only public symbols"
 */

// Re-export types (from naming-rule-types.ts)
export type {
  NamingRuleConfig,
  NamingRulesConfig,
  NamingRulesValidationResult,
  RuleValidationResult,
} from './naming-rule-types.js';

// Re-export validation functions (from naming-rule-validation.ts)
export {
  validateSingleRule,
  validateNamingRules,
} from './naming-rule-validation.js';

// Re-export merge functions (from naming-rule-merging.ts)
export {
  mergeNamingRules,
  DEFAULT_MERGED_NAMING_RULES,
} from './naming-rule-merging.js';