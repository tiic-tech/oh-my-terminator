/**
 * Layer Naming Types
 *
 * WHY: Schema is the truth. Types flow from schema.
 * Separated from layer-naming.ts for single responsibility.
 *
 * These types define the contract for layer role name inference:
 * - LayerRoleResult: Public API result type
 * - MatchedRuleInfo: Metadata for verbose output
 * - MatchResult: Internal matching state
 *
 * @see coding-taste skill - "One Truth, Not Two"
 */

import type { NamingRule } from './naming-rules.js';

/**
 * Matched rule metadata for verbose output
 *
 * WHY: Enables verbose mode to show which pattern matched for inferred names.
 * HOW: Attached to LayerRoleResult when verbose=true requested.
 */
export interface MatchedRuleInfo {
  /** Pattern that matched (string or RegExp source) */
  pattern: string;
  /** Semantic role name assigned */
  role: string;
  /** Rule priority (before exact match boost) */
  basePriority: number;
  /** Whether pattern was anchored (^...$) for exact match */
  isExactMatch: boolean;
  /** Final priority (basePriority + exact match boost if applicable) */
  finalPriority: number;
}

/**
 * Result of layer role name inference
 *
 * WHY: Public API contract for callers.
 * Contains inferred role name, confidence score, and optional match metadata.
 */
export interface LayerRoleResult {
  /** Semantic role name or "Layer N" fallback */
  role: string;
  /** Confidence score: 0-100 (100=exact, 80=partial, 50=multi-match, 0=fallback) */
  confidence: number;
  /** Matched rule info for verbose output (optional, only when verbose=true) */
  matchedRule?: MatchedRuleInfo;
}

/**
 * Internal match result with priority and exact-match flag
 *
 * WHY: Tracks matching state during inference algorithm.
 * Used for priority-based selection and confidence calculation.
 */
export interface MatchResult {
  /** The naming rule that matched */
  rule: NamingRule;
  /** Whether pattern was anchored (exact match) */
  isExactMatch: boolean;
  /** Final priority after applying exact match boost */
  finalPriority: number;
}