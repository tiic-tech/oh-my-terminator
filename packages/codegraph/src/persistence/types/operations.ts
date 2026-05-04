/**
 * @fileoverview Load/save operation types
 *
 * WHY: Load and save operations have their own configuration and result types.
 * Separated from baseline structure to keep this file focused on operation flow.
 *
 * Contains:
 * - LoadFailureReason: Reasons for baseline load failure
 * - FailureInfo: Information about a load failure
 * - FailureHandler: Custom failure handler function type
 * - RebuildHandler: Rebuild handler for dependency injection
 * - LoadBaselineOptions: Options for loading baseline
 * - LoadBaselineResult: Result of loading baseline
 * - SaveBaselineOptions: Options for saving baseline
 */

import type { CodeGraph } from '../../graph.js';
import type { Baseline } from './baseline.js';
import type { CompatibilityResult, CompatibilityAction } from './compatibility.js';

/**
 * Reasons for baseline load failure
 *
 * WHY: 6 scenarios cover all possible failure modes, enabling
 * appropriate recovery strategies for each case.
 */
export type LoadFailureReason =
  | 'file_not_found'          // baseline.json does not exist
  | 'parse_error'             // JSON parsing failed
  | 'invalid_structure'       // Structure validation failed
  | 'schema_incompatible'     // Version incompatible with no migration path
  | 'corrupted_data'          // Data integrity check failed
  | 'permission_error';       // File permission denied

/**
 * Information about a load failure
 *
 * WHY: Captures failure context for error reporting and recovery decisions.
 */
export interface FailureInfo {
  /** Reason for failure */
  reason: LoadFailureReason;
  /** Underlying error if available */
  error?: Error;
  /** Additional context about the failure */
  details?: unknown;
}

/**
 * Custom failure handler function type
 */
export type FailureHandler = (
  reason: LoadFailureReason,
  cwd: string,
  details?: unknown
) => Promise<LoadBaselineResult>;

/**
 * Rebuild handler for dependency injection
 *
 * WHY: Enables CLI layer to inject handlers with progress reporting,
 * and tests to inject mock handlers without depending on analyzeFull.
 */
export type RebuildHandler = (cwd: string) => Promise<CodeGraph>;

/**
 * Options for loading baseline
 *
 * WHY: Controls behavior through:
 * - actionConfig: Compatibility action configuration
 * - onFailure: Custom failure handling
 * - strict: Disallow automatic fixes
 * - rebuildHandler: Inject custom rebuild logic
 */
export interface LoadBaselineOptions {
  /** Compatibility action configuration */
  actionConfig?: import('./compatibility.js').ActionConfig;
  /** Custom failure handler */
  onFailure?: FailureHandler;
  /** Strict mode - disallow automatic fixes */
  strict?: boolean;
  /** Custom rebuild handler (dependency injection) */
  rebuildHandler?: RebuildHandler;
}

/**
 * Result of loading baseline
 *
 * WHY: Provides comprehensive outcome including:
 * - Success/failure status
 * - Loaded graph and baseline
 * - Compatibility analysis
 * - Action executed
 * - Migration status
 */
export interface LoadBaselineResult {
  /** Whether load succeeded */
  success: boolean;
  /** Loaded graph if successful */
  graph?: CodeGraph;
  /** Loaded baseline if successful */
  baseline?: Baseline;
  /** Compatibility analysis result */
  compatibility?: CompatibilityResult;
  /** Action that was executed */
  executedAction?: CompatibilityAction;
  /** Whether migration was performed */
  migrated?: boolean;
  /** Failure information if unsuccessful */
  failure?: FailureInfo;
}

/**
 * Options for saving baseline
 *
 * WHY: Controls atomic write behavior:
 * - createBackup: Create .bak file before write
 * - createVersionFile: Create .version file for quick check
 * - mode: File permissions (inherit or specific)
 */
export interface SaveBaselineOptions {
  /** Create backup before write */
  createBackup?: boolean;
  /** Create .version file for quick version check */
  createVersionFile?: boolean;
  /** File permissions (default: inherit from existing or 0o644) */
  mode?: number;
}