/**
 * API Types: Normalized Target (Internal)
 *
 * WHY separate file: NormalizedTarget and TargetType are internal types (~30 lines)
 * used by scope/normalize.ts. Splitting from scope-types.ts keeps file sizes
 * under coding-taste Rule 2 threshold.
 *
 * Related: scope-types.ts, brief-types.ts
 */

import type { GraphNode } from '../../types.js';

// ============================================================================
// Normalized Target Types (Internal)
// ============================================================================

/**
 * Normalized target type for scope queries
 *
 * D1 Resolution: Single entry point handles FILE, MODULE, EXTERNAL, PATH.
 */
export type TargetType = 'FILE' | 'MODULE' | 'EXTERNAL' | 'PATH';

/**
 * Normalized target result from normalizeTarget function
 */
export interface NormalizedTarget {
  /** Resolved FILE or EXTERNAL node (null if not found) */
  fileNode: GraphNode | null;
  /** Resolved MODULE node (null if not FILE/MODULE target) */
  moduleNode: GraphNode | null;
  /** Original target string */
  originalTarget: string;
  /** Detected target type */
  targetType: TargetType;
}