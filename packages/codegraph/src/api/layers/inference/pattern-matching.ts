/**
 * Pattern Matching for Layer Naming
 *
 * WHY: Matching logic separated from inference algorithm for testability.
 * HOW: Pattern-to-RegExp conversion with anchored pattern detection.
 *
 * @see coding-taste skill - "One Truth, Not Two"
 * @see layer-naming-types.ts for type definitions
 */

import type { NamingRule } from './naming-rules.js';
import type { MatchResult } from './layer-naming-types.js';

/**
 * Check if pattern is anchored (exact match intent)
 *
 * WHY: Anchored patterns (^...$) indicate user wants exact directory match.
 * HOW: Check if pattern string starts with ^ and ends with $.
 *
 * @param pattern - Pattern to check (string or RegExp)
 * @returns true if pattern is anchored for exact matching
 */
export function isAnchoredPattern(pattern: string | RegExp): boolean {
  const patternStr = typeof pattern === 'string' ? pattern : pattern.source;
  return patternStr.startsWith('^') && patternStr.endsWith('$');
}

/**
 * Match a group name against a naming rule
 *
 * WHY: Pattern matching determines which role to assign.
 * HOW: Convert pattern to RegExp, test against group name.
 *
 * Algorithm:
 * 1. Convert string pattern to RegExp (case-insensitive)
 * 2. Test match against group name
 * 3. Calculate exact match boost (+10 for anchored patterns)
 * 4. Return match result with final priority
 *
 * @param groupName - Directory/group name to match
 * @param rule - Naming rule with pattern
 * @returns MatchResult if matched, null if no match
 */
export function matchGroupToRule(
  groupName: string,
  rule: NamingRule
): MatchResult | null {
  // Convert pattern to RegExp
  const regex = typeof rule.pattern === 'string'
    ? new RegExp(rule.pattern, 'i') // Case-insensitive for flexibility
    : rule.pattern;

  // Test match
  if (!regex.test(groupName)) {
    return null;
  }

  // Calculate exact match boost
  const isExactMatch = isAnchoredPattern(rule.pattern);
  const exactMatchBoost = isExactMatch ? 10 : 0;
  const finalPriority = rule.priority + exactMatchBoost;

  return {
    rule,
    isExactMatch,
    finalPriority,
  };
}