/**
 * Layer Role Name Inference
 *
 * WHY: Layers 5+ need semantic names instead of generic "Layer N".
 * HOW: Pattern matching against directory/group names with priority-based resolution.
 *
 * Design Decisions:
 * - Higher priority = more specific architectural role
 * - Anchored patterns (^...$) receive +10 boost for exact match preference
 * - Fallback to "Layer N" when no pattern matches
 *
 * ELASTIC EXCEPTION (coding-taste Rule 2): File is ~80 lines.
 * NOT split further because: inferLayerRoleNames + calculateMatchConfidence
 * are tightly related - confidence calculation depends on match collection.
 * Splitting would fragment this cohesive unit into <50 line files.
 *
 * @see pattern-matching.ts for matching logic
 * @see layer-naming-types.ts for type definitions
 */

import { DEFAULT_NAMING_RULES, type NamingRule } from './naming-rules.js';
import { matchGroupToRule } from './pattern-matching.js';
import type { MatchResult, LayerRoleResult, MatchedRuleInfo } from './layer-naming-types.js';

// Re-export types for backward compatibility (barrel pattern)
export type { LayerRoleResult, MatchedRuleInfo } from './layer-naming-types.js';

/**
 * Calculate confidence based on match characteristics
 *
 * WHY: Confidence informs user how reliable the inferred name is.
 * HOW: Score based on match type and selection method.
 *
 * Confidence scoring:
 * - 100: Exact anchored match (highest confidence)
 * - 80: Single substring match (good confidence)
 * - 50: Multiple matches (medium, selected via priority)
 * - 0: No match, fallback to generic name
 *
 * @param matches - All matching rules
 * @param selectedMatch - The selected match (highest priority)
 * @returns Confidence score 0-100
 */
function calculateMatchConfidence(
  matches: MatchResult[],
  selectedMatch: MatchResult
): number {
  // Exact match: highest confidence
  if (selectedMatch.isExactMatch) {
    return 100;
  }

  // Single match: high confidence (substring match)
  if (matches.length === 1) {
    return 80;
  }

  // Multiple matches: medium confidence (selected via priority)
  return 50;
}

/**
 * Infer layer role name from multiple directory groups
 *
 * WHY: A layer may contain multiple groups (e.g., "api" and "services").
 * HOW: Aggregate matches, apply exact boost, select highest priority.
 *
 * Algorithm (Decision 5 & 6 from design.md):
 * 1. Validate input (defensive checks for edge cases)
 * 2. Match all group names against naming rules
 * 3. Collect matching rules with priorities
 * 4. Apply exact match boost (+10) for anchored patterns
 * 5. Select highest final priority
 * 6. If tie: first match wins (deterministic order)
 * 7. If no matches: fallback to "Layer N"
 *
 * @param groups - Directory group names in the layer
 * @param layerNum - Layer number for fallback naming
 * @param rules - Optional custom rules (merged with defaults)
 * @returns LayerRoleResult with role name, confidence, and matched rule info
 */
export function inferLayerRoleNames(
  groups: string[],
  layerNum: number,
  rules?: NamingRule[]
): LayerRoleResult {
  // Edge case validation (defensive programming)
  // WHY: Prevent runtime errors from invalid input
  if (!groups || groups.length === 0) {
    return {
      role: `Layer ${layerNum}`,
      confidence: 0,
    };
  }

  // Sanitize layerNum (must be positive integer)
  const safeLayerNum = Math.max(1, Math.floor(layerNum));

  // Use provided rules or default rules
  const activeRules = rules ?? DEFAULT_NAMING_RULES;

  // Collect all matches across all groups
  const allMatches: MatchResult[] = [];

  for (const groupName of groups) {
    for (const rule of activeRules) {
      const match = matchGroupToRule(groupName, rule);
      if (match) {
        allMatches.push(match);
      }
    }
  }

  // No matches: fallback to generic name
  if (allMatches.length === 0) {
    return {
      role: `Layer ${safeLayerNum}`,
      confidence: 0,
    };
  }

  // Sort by final priority descending (highest first)
  // Deterministic: stable sort preserves order for ties
  allMatches.sort((a, b) => b.finalPriority - a.finalPriority);

  // Select highest priority match (first after sort)
  const selectedMatch = allMatches[0];

  // Calculate confidence
  const confidence = calculateMatchConfidence(allMatches, selectedMatch);

  // Build matched rule info (One Truth: store complete inference result)
  // WHY: Formatter decides whether to display based on verbose flag
  const matchedRule: MatchedRuleInfo = {
    pattern: typeof selectedMatch.rule.pattern === 'string'
      ? selectedMatch.rule.pattern
      : selectedMatch.rule.pattern.source,
    role: selectedMatch.rule.role,
    basePriority: selectedMatch.rule.priority,
    isExactMatch: selectedMatch.isExactMatch,
    finalPriority: selectedMatch.finalPriority,
  };

  return {
    role: selectedMatch.rule.role,
    confidence,
    matchedRule,
  };
}