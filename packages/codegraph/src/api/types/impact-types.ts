/**
 * API Types: Impact Analysis (C8)
 *
 * WHY separate file: Impact Analysis is a complete feature domain (~75 lines).
 * Separating impact types maintains single responsibility and makes BFS traversal
 * types easier to understand independently.
 *
 * Related: common.ts (shared types), scope-types.ts, layers-types.ts
 */

// ============================================================================
// C8: Impact Analysis Types
// ============================================================================

/**
 * Affected file with dependency path information
 *
 * C8-4 Resolution: via field uses array format for multi-path support.
 */
export interface AffectedFile {
  /** File path (without FILE: prefix) */
  path: string;
  /** Distance from target (1=direct, 2+=indirect) */
  distance: number;
  /** Intermediate dependency paths (C8-4: array format) */
  via: string[];
}

/**
 * Impact analysis result
 *
 * Contains BFS traversal results and blast radius classification.
 */
export interface ImpactResult {
  /** Operation success status */
  success: boolean;
  /** Query target IDs */
  targets: string[];
  /** Affected files with distance and via information (limited by maxFiles) */
  affectedFiles: AffectedFile[];
  /** Summary statistics */
  summary: {
    /** Total affected file count (full count, not limited by maxFiles) */
    total: number;
    /** Direct dependents count */
    direct: number;
    /** Indirect dependents count */
    indirect: number;
  };
  /** Whether affectedFiles was truncated due to maxFiles limit */
  truncated?: boolean;
  /** Blast radius classification (C8-8: 3=low, 10=medium boundaries) */
  blastRadius: 'low' | 'medium' | 'high' | 'unknown';
  /** Query execution time in milliseconds */
  durationMs: number;
  /** Non-fatal warnings */
  warnings?: string[];
  /** Suggested follow-up commands */
  nextSuggested?: string[];
  /** Agent-friendly Markdown output */
  content: string;
}

/**
 * Impact analysis error result
 */
export interface ImpactError {
  /** Operation success status (always false) */
  success: false;
  /** Error details */
  error: {
    /** Error code (E001, E003, etc.) */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Suggested remediation action */
    suggestion?: string;
  };
  /** Query execution time in milliseconds */
  durationMs: number;
}

/**
 * Options for impact analysis
 */
export interface ImpactOptions {
  /** Maximum traversal depth (default: 10, C8-2: 0=direct only) */
  maxDepth?: number;
  /** Include test files in results (default: false, C8-1) */
  includeTests?: boolean;
  /**
   * Maximum files to include in affectedFiles list (default: 20)
   * WHY 20: Agent token budgets are limited; 83 files = 2000+ tokens is too verbose.
   * Full count preserved in summary.total; truncated flag indicates pagination needed.
   */
  maxFiles?: number;
}