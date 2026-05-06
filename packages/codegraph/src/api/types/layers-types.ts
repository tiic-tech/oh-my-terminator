/**
 * API Types: Architecture Layers (C8)
 *
 * WHY separate file: Architecture Layers is a complete feature domain (~150 lines).
 * Separating layers types maintains single responsibility and makes layer inference,
 * violation detection, and health score calculation easier to understand.
 *
 * ELASTIC EXCEPTION (coding-taste Rule 2): File is ~151 lines, slightly over 150 threshold.
 * NOT split because: These types form a tightly related cohesive unit - all Architecture Layers
 * types (LayerRole, GroupStats, LayerAssignment, ViolationSeverity, LayerViolation, etc.) are
 * used together in layers inference, violation detection, and health score calculation.
 * Splitting would produce files <50 lines each that fragment this cohesive unit.
 *
 * Related: common.ts (shared types), scope-types.ts, impact-types.ts
 */

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
  /** Project root directory for threshold calculation (optional) */
  projectRoot?: string;
  /** Explicit layer threshold (overrides projectRoot-based calculation) */
  threshold?: number;
}