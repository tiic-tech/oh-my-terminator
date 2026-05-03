/**
 * C7: API Types for Scope Query and QuickBrief
 *
 * Provides structured output types for Agent-friendly graph queries.
 */

import type { NodeType, EdgeType } from '../types.js';

// ============================================================================
// Scope Query Types
// ============================================================================

/**
 * Complexity level classification
 *
 * A6 Resolution: Includes 'unknown' for cases where no MODULE data exists.
 */
export type ComplexityLevel = 'low' | 'medium' | 'high' | 'unknown';

/**
 * Complexity information with level and numeric value
 */
export interface ComplexityInfo {
  /** Complexity level classification */
  level: ComplexityLevel;
  /** Numeric complexity value (0 when unknown) */
  value: number;
}

/**
 * Last modified information from git history
 */
export interface ModifiedInfo {
  /** Last commit hash that modified this node */
  commit?: string;
  /** Human-readable relative time description */
  relativeTime?: string;
}

/**
 * Export symbol information for CLI JSON output
 */
export interface ExportInfo {
  /** Symbol name */
  name: string;
  /** Symbol kind (function, class, variable, etc.) */
  kind: string;
  /** Full MODULE node ID */
  id: string;
}

/**
 * Import relationship information for CLI JSON output
 */
export interface ImportInfo {
  /** Source path or package name */
  from: string;
  /** Import type (static, dynamic, re-export) */
  type: 'static' | 'dynamic' | 're-export';
  /** Imported specifiers (empty for namespace imports) */
  specifiers: string[];
}

/**
 * Imported-by relationship information for CLI JSON output
 */
export interface ImportedByInfo {
  /** File that imports this target */
  file: string;
  /** Specifiers imported from this target */
  specifiers: string[];
}

/**
 * Scope query result
 *
 * Contains both structured data and Agent-friendly Markdown output.
 */
export interface ScopeResult {
  /** Operation success status */
  success: boolean;
  /** Query target ID */
  target: string;
  /** Exported symbols list */
  exports: ExportInfo[];
  /** Import relationships list */
  imports: ImportInfo[];
  /** Reverse dependency list (who imports this) */
  importedBy: ImportedByInfo[];
  /** Associated test file path */
  testFile: string | null;
  /** Complexity information */
  complexity: ComplexityInfo;
  /** Last modified information */
  lastModified: ModifiedInfo;
  /** Metadata flags */
  metadata: {
    /** Whether test file exists */
    hasTest: boolean;
    /** Whether any export is deprecated */
    deprecated: boolean;
  };
  /** Query execution time in milliseconds */
  durationMs: number;
  /** Non-fatal warnings */
  warnings?: string[];
  /** Suggested follow-up commands */
  nextSuggested?: string[];
  /** Agent-friendly Markdown output */
  content: string;
  /** Upstream CALLS edges (MVP: empty, TODO for M2) */
  upstreamCalls: string[];
  /** Downstream CALLS edges (MVP: empty, TODO for M2) */
  downstreamCalls: string[];
}

/**
 * Scope query error result
 *
 * Returned when target not found or other errors occur.
 */
export interface ScopeError {
  /** Operation success status (always false) */
  success: false;
  /** Error details */
  error: {
    /** Error code (E001 for target not found) */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Suggested remediation action */
    suggestion?: string;
  };
  /** Query execution time in milliseconds */
  durationMs: number;
}

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
  fileNode: import('../types.js').GraphNode | null;
  /** Resolved MODULE node (null if not FILE/MODULE target) */
  moduleNode: import('../types.js').GraphNode | null;
  /** Original target string */
  originalTarget: string;
  /** Detected target type */
  targetType: TargetType;
}

// ============================================================================
// Error Codes
// ============================================================================

/**
 * CLI error codes
 *
 * Aligns with C6 §5.6 error code patterns for consistency.
 */
export const ErrorCode = {
  /** Target node not found in graph */
  TARGET_NOT_FOUND: 'E001_TARGET_NOT_FOUND',
  /** Parse error in baseline data */
  PARSE_ERROR: 'E002_PARSE_ERROR',
} as const;