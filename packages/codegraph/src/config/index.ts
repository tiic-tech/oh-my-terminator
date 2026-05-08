/**
 * Configuration module public exports (Task 3.1)
 *
 * WHY: Module-level exports only public symbols.
 * Implementation details (ValidationSuccess, LoadSuccess types) are internal.
 *
 * Public API:
 * - loadCompressionConfig: Load config from project
 * - loadFullConfig: Load config + naming rules from project
 * - validateCompressionConfig: Validate config object
 * - validateFullConfig: Validate config + naming rules
 * - DEFAULT_COMPRESSION_OPTIONS: Default values
 * - DEFAULT_COMPRESSION_CONFIG: Full default config
 * - validateNamingRules: Validate naming rules array
 * - mergeNamingRules: Merge user rules with defaults
 * - DEFAULT_MERGED_NAMING_RULES: Default naming rules
 *
 * @see coding-taste skill - "Module-level re-exports only public symbols"
 */

// Re-export loading functions
export { loadCompressionConfig, type LoadResult } from './load-config.js';
export { loadFullConfig, type FullLoadResult } from './load-config.js';

// Re-export validation functions and result types
export {
  validateCompressionConfig,
  validateFullConfig,
  type ValidationResult,
  type ValidationSuccess,
  type ValidationFailure,
  type FullValidationResult,
  type FullValidationSuccess,
  type FullValidationFailure,
  type CodeGraphConfig,
} from './validate-config.js';

// Re-export default constants
export {
  DEFAULT_COMPRESSION_OPTIONS,
  DEFAULT_COMPRESSION_CONFIG,
} from './validate-config.js';

// Re-export naming rules config functions and types
export {
  type NamingRuleConfig,
  type NamingRulesConfig,
  type NamingRulesValidationResult,
  type RuleValidationResult,
  validateNamingRules,
  validateSingleRule,
  mergeNamingRules,
  DEFAULT_MERGED_NAMING_RULES,
} from './naming-rules-config.js';