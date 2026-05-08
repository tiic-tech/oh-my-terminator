/**
 * API Types: QuickBrief (C7)
 *
 * WHY separate file: QuickBrief is a lightweight file statistics API (~50 lines).
 * Separating from Scope Query types maintains single responsibility and keeps
 * file sizes under coding-taste Rule 2 threshold.
 *
 * Related: scope-types.ts, normalize-types.ts
 */

import type { ComplexityLevel } from './scope-types.js';

// ============================================================================
// QuickBrief Types
// ============================================================================

/**
 * QuickBrief query result
 *
 * Minimal file statistics for quick overview.
 */
export interface QuickBriefResult {
  /** Operation success status */
  success: boolean;
  /** File path */
  file: string;
  /** Import edge count (A4: counts edges, not unique files) */
  imports: number;
  /** Imported-by edge count (A4: counts edges, excludes DYNAMIC_IMPORTS) */
  importedBy: number;
  /** Whether test file exists */
  hasTest: boolean;
  /** Whether any export is deprecated */
  deprecated: boolean;
  /** Complexity level */
  complexityLevel: ComplexityLevel;
  /** Human-readable quick facts */
  quickFacts: string[];
  /** Query execution time in milliseconds */
  durationMs: number;
  /** Agent-friendly Markdown output */
  content: string;
}

/**
 * QuickBrief error result
 *
 * Returned when file not found.
 */
export interface QuickBriefError {
  /** Operation success status (always false) */
  success: false;
  /** Error details */
  error: {
    /** Error code (E001 for file not found) */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Suggested remediation action */
    suggestion?: string;
  };
  /** Query execution time in milliseconds */
  durationMs: number;
}