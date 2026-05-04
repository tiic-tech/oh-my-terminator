/**
 * API Types: Common Shared Types
 *
 * WHY separate file: ErrorCode is used across all API modules (scope/impact/layers).
 * Separating shared constants reduces duplication and centralizes error code definitions.
 *
 * Used by: scope-types.ts, impact-types.ts, layers-types.ts
 */

import type { NodeType, EdgeType } from '../../types.js';

// ============================================================================
// Error Codes (C7 + C8)
// ============================================================================

/**
 * CLI error codes
 *
 * Aligns with C6 §5.6 error code patterns for consistency.
 * C8-7: Extended with E003-E005 for impact/layers commands.
 */
export const ErrorCode = {
  /** Target node not found in graph */
  TARGET_NOT_FOUND: 'E001_TARGET_NOT_FOUND',
  /** Parse error in baseline data */
  PARSE_ERROR: 'E002_PARSE_ERROR',
  /** No dependents found for target (C8) */
  NO_IMPACT: 'E003_NO_IMPACT',
  /** No architecture layers could be inferred (C8) */
  NO_LAYERS: 'E004_NO_LAYERS',
  /** Graph contains no FILE nodes (C8) */
  EMPTY_GRAPH: 'E005_EMPTY_GRAPH',
} as const;

// ============================================================================
// Re-export base types for convenience
// ============================================================================

export type { NodeType, EdgeType };