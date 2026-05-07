/**
 * Naming Rule Types for Configuration
 *
 * WHY: Schema is the truth. Types flow from schema.
 * Separated from naming-rules-config.ts for single responsibility.
 *
 * These types define the contract for naming rule configuration:
 * - NamingRuleConfig: JSON-friendly config schema (pattern is string)
 * - NamingRulesConfig: Full config extension
 * - Validation result types for partial success pattern
 *
 * @see coding-taste skill - "One Truth, Not Two"
 */

import type { NamingRule } from '../api/layers/inference/naming-rules.js';

/**
 * Naming rule from JSON config (pattern is string only)
 *
 * WHY: JSON cannot serialize RegExp objects. Config schema uses string patterns
 * that are converted to RegExp at runtime.
 *
 * @see design.md Decision 4 - pattern is string in JSON schema
 */
export interface NamingRuleConfig {
  /** RegExp pattern string for matching directory group names */
  pattern: string;
  /** Semantic role name (must have at least 1 character) */
  role: string;
  /** Priority for conflict resolution (0-100, higher wins) */
  priority: number;
}

/**
 * Full config schema extension for naming rules
 *
 * WHY: Optional field - user can omit namingRules and get defaults.
 * Matches existing CompressionConfig pattern.
 */
export interface NamingRulesConfig {
  /** Optional naming rules (merged with defaults) */
  namingRules?: NamingRuleConfig[];
}

/**
 * Validation result for a single naming rule
 *
 * WHY: Preserves original rule for error context.
 * Enables detailed error messages with rule data.
 */
export interface RuleValidationResult {
  /** Whether this specific rule is valid */
  valid: boolean;
  /** Original rule config (preserved for error context - may be partial) */
  rule: NamingRuleConfig | Record<string, unknown>;
  /** Error message if invalid, undefined if valid */
  error?: string;
}

/**
 * Validation result for all naming rules
 *
 * WHY: Partial success pattern - invalid rules are skipped, valid rules continue.
 * Matches graceful handling principle from design.md.
 */
export interface NamingRulesValidationResult {
  /** All valid rules (converted to NamingRule with RegExp) */
  validRules: NamingRule[];
  /** Invalid rules with error messages */
  invalidRules: RuleValidationResult[];
}