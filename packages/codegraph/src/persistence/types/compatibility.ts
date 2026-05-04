/**
 * @fileoverview Compatibility checking types
 *
 * WHY: Schema compatibility is a distinct concern from baseline data structure.
 * These types define the strategy matrix for handling version mismatches.
 *
 * Contains:
 * - CompatibilityReason: Reasons for compatibility outcome
 * - CompatibilityAction: Actions to take based on compatibility
 * - CompatibilityResult: Result of schema compatibility check
 * - ActionConfig: Configuration for action determination
 * - ActionResult: Result of executing a compatibility action
 */

/**
 * Reasons for compatibility outcome
 *
 * WHY: Each reason maps to a specific action in the strategy matrix,
 * enabling deterministic handling of version mismatches.
 */
export type CompatibilityReason =
  | 'legacy_baseline'          // No schemaVersion field
  | 'major_version_mismatch'   // Major version differs
  | 'minor_version_old'        // Minor version behind current
  | 'patch_version_old'        // Patch version behind current
  | 'version_match'            // Exact version match
  | 'version_future';          // Baseline version higher than current

/**
 * Actions to take based on compatibility result
 *
 * WHY: 4 strategies cover all scenarios:
 * - error: Fatal incompatibility, user must intervene
 * - rebuild: Automatic full re-analysis
 * - migrate: Transform baseline to current version
 * - proceed: Use baseline directly (compatible or patch difference)
 */
export type CompatibilityAction =
  | 'error'      // Throw error, require manual intervention
  | 'rebuild'    // Execute full re-analysis
  | 'migrate'    // Execute migration scripts
  | 'proceed';   // Use baseline directly

/**
 * Result of schema compatibility check
 *
 * WHY: Provides both the compatibility outcome and recommended action,
 * allowing callers to make informed decisions about baseline handling.
 */
export interface CompatibilityResult {
  /** Whether baseline can be used directly */
  compatible: boolean;
  /** Reason for compatibility outcome */
  reason: CompatibilityReason;
  /** Recommended action to take */
  action: CompatibilityAction;
  /** Human-readable description */
  message: string;
  /** Detailed version information if relevant */
  details?: {
    baselineVersion?: string;
    currentVersion?: string;
  };
}

/**
 * Configuration for action determination
 *
 * WHY: Allows fine-grained control over behavior:
 * - forceAction: Override default strategy
 * - autoMigrate: Enable automatic minor version migration
 * - allowRebuild: Enable automatic rebuild without confirmation
 */
export interface ActionConfig {
  /** Override default action determination */
  forceAction?: CompatibilityAction;
  /** Auto-migrate for minor version differences */
  autoMigrate?: boolean;
  /** Allow rebuild without user confirmation */
  allowRebuild?: boolean;
}

/**
 * Result of executing a compatibility action
 *
 * WHY: Tracks what action was executed and whether migration occurred,
 * enabling logging and reporting of baseline handling decisions.
 */
export interface ActionResult {
  /** Graph after action execution */
  graph: import('../../graph.js').CodeGraph;
  /** Action that was executed */
  action: CompatibilityAction;
  /** Whether migration was performed */
  migrated: boolean;
}