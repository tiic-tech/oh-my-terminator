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
  /** Affected files with distance and via information */
  affectedFiles: AffectedFile[];
  /** Summary statistics */
  summary: {
    /** Total affected file count */
    total: number;
    /** Direct dependents count */
    direct: number;
    /** Indirect dependents count */
    indirect: number;
  };
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
}

// ============================================================================
// C8: Architecture Layers Types
// ============================================================================

/**
 * Layer role names
 */
export type LayerRole = 'Foundation' | 'Core' | 'Application' | 'Presentation';

/**
 * Group statistics within a layer
 */
export interface GroupStats {
  /** Group name (directory name) */
  name: string;
  /** File count in this group */
  fileCount: number;
  /** Number of times this group is imported by other groups */
  importedByCount: number;
  /** Number of times this group imports from other groups */
  importsFromCount: number;
}

/**
 * Layer assignment with groups
 *
 * C8-3: LAYER_THRESHOLD=2 for adjacent score merging.
 */
export interface LayerAssignment {
  /** Layer number (1-based, 1=bottom/Foundation) */
  layer: number;
  /** Layer role name */
  role: LayerRole | string;
  /** Groups assigned to this layer */
  groups: GroupStats[];
}

/**
 * Violation severity levels
 *
 * C8-5: minor=-5, moderate=-10, critical=-15 for healthScore.
 */
export type ViolationSeverity = 'minor' | 'moderate' | 'critical';

/**
 * Violating file pair
 */
export interface ViolationFilePair {
  /** Violating file path */
  from: string;
  /** Imported file path */
  to: string;
}

/**
 * Layer violation details
 *
 * C8-10: layerGap (renamed from expectedLayerGap) represents crossing layer count.
 */
export interface LayerViolation {
  /** Violating group (lower layer importing higher) */
  fromGroup: string;
  /** Target group (being imported from higher layer) */
  toGroup: string;
  /** Number of violating imports */
  count: number;
  /** Specific violating file pairs */
  affectedFiles: ViolationFilePair[];
  /** Layer gap (toLayer - fromLayer, C8-10) */
  layerGap: number;
  /** Severity level (C8-5) */
  severity: ViolationSeverity;
  /** Remediation suggestion */
  suggestion: string;
}

/**
 * Group summary for layer inference explanation
 */
export interface GroupSummary {
  /** Group name */
  name: string;
  /** Assigned layer number */
  assignedLayer: number;
  /** Net dependency score (importedBy - importsFrom) */
  netScore: number;
}

/**
 * Architecture layers result
 *
 * Contains inferred layers, violations, and health score.
 */
export interface LayersResult {
  /** Operation success status */
  success: boolean;
  /** Inferred architecture layers */
  layers: LayerAssignment[];
  /** Detected layer violations */
  violations: LayerViolation[];
  /** Health score (0-100, C8-5 formula) */
  healthScore: number;
  /** Group summaries with netScore */
  groups: GroupSummary[];
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
 * Architecture layers error result
 */
export interface LayersError {
  /** Operation success status (always false) */
  success: false;
  /** Error details */
  error: {
    /** Error code (E004, E005, etc.) */
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
 * Options for architecture layers analysis
 */
export interface LayersOptions {
  /** Source root directory (default: 'src') */
  sourceRoot?: string;
  /** Warn on same-layer mutual imports (C8-11) */
  warnOnMutualImport?: boolean;
}

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