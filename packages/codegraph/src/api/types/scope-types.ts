/**
 * API Types: Scope Query Core (C7)
 *
 * WHY separate file: Scope Query is the core feature domain (~140 lines).
 * Includes complexity classification, export/import info types, and result types.
 * QuickBrief and NormalizedTarget types split to brief-types.ts and normalize-types.ts
 * to comply with coding-taste Rule 2 threshold.
 *
 * Related: brief-types.ts, normalize-types.ts, common.ts
 */

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