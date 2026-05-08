/**
 * Naming Rule Merging
 *
 * WHY: User rules can override defaults by providing higher priority.
 * HOW: Append user rules to defaults for override pattern.
 *
 * Algorithm (design.md Decision 4):
 * 1. Start with DEFAULT_NAMING_RULES
 * 2. Append user rules to defaults
 * 3. User can override by providing higher priority rule
 *
 * @see naming-rule-types.ts for type definitions
 */

import { DEFAULT_NAMING_RULES, type NamingRule } from '../api/layers/inference/naming-rules.js';

/**
 * Merge user naming rules with default rules
 *
 * WHY: User rules can override defaults by providing higher priority.
 * HOW: User rules are appended to defaults, enabling override pattern.
 *
 * @param userRules - Validated user rules (empty array if no config)
 * @returns Merged rules array (defaults + user rules)
 */
export function mergeNamingRules(userRules: NamingRule[]): NamingRule[] {
  // User rules appended to defaults
  // User can override by providing higher priority rule
  return [...DEFAULT_NAMING_RULES, ...userRules];
}

/**
 * Default merged rules (no user config)
 *
 * WHY: Convenience for callers without config.
 * Matches DEFAULT_COMPRESSION_CONFIG pattern.
 */
export const DEFAULT_MERGED_NAMING_RULES: NamingRule[] = mergeNamingRules([]);