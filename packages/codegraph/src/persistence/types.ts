/**
 * @fileoverview Persistence types for CodeGraph baseline management
 *
 * WHY: Baseline persistence requires a rich type system for version management,
 * compatibility checking, and migration framework. These types are distinct from
 * core graph types (GraphNode, GraphEdge) and should live in a separate module.
 *
 * DESIGN DECISIONS:
 * - SchemaVersion is both an interface (for serialization) and a class (for methods)
 * - CompatibilityAction uses 4 strategies: error/rebuild/migrate/proceed
 * - LoadFailureReason covers 6 scenarios for comprehensive error handling
 *
 * @see 06_c6_baseline_version_spec.md for detailed specifications
 */

import type { CodeGraph } from '../graph.js';
import type { SerializedCodeGraph, SchemaVersion } from '../types.js';

// ============================================================================
// Baseline Structure Types
// ============================================================================

/**
 * Demand level for different agent skill types (0-1 scale)
 *
 * WHY: Architecture analysis produces skill demand estimates that help
 * allocate appropriate agents for refactoring tasks.
 *
 * @see 01_origin_blueprint.md Section 3.4
 */
export interface SkillDemand {
  /** Test writing agent demand */
  testWriter: number;
  /** Refactoring specialist demand */
  refactorSpecialist: number;
  /** Architecture planning demand */
  architect: number;
  /** Security review demand */
  securityReviewer: number;
}

/**
 * Record of a single migration operation
 *
 * WHY: Migration history enables debugging version transitions and provides
 * audit trail for schema changes. checksumBefore/checksumAfter allow integrity
 * verification after migration.
 */
export interface MigrationRecord {
  /** Source version (or 'legacy' for unversioned baselines) */
  fromVersion: string;
  /** Target version after migration */
  toVersion: string;
  /** Timestamp of migration execution */
  migratedAt: number;
  /** Strategy used: 'migrate' (transform) or 'rebuild' (full re-analysis) */
  strategy: 'migrate' | 'rebuild';
  /** Optional checksum of baseline before migration */
  checksumBefore?: string;
  /** Optional checksum of baseline after migration */
  checksumAfter?: string;
}

/**
 * Complete baseline structure for persistence
 *
 * WHY: Baseline stores not just the graph but metadata needed for:
 * - Version management (schemaVersion, generatorVersion)
 * - Incremental update decisions (commitHash, timestamp)
 * - Architecture analysis (architectureConstraints, healthScore, skillDemand)
 * - Migration tracking (migrationHistory)
 */
export interface Baseline {
  /** Serialized graph data */
  graph: SerializedCodeGraph;
  /** Git commit hash this baseline represents */
  commitHash: string;
  /** Timestamp when baseline was generated */
  timestamp: number;
  /** Schema version for compatibility checking */
  schemaVersion: SchemaVersion;
  /** Tool version that generated this baseline */
  generatorVersion: string;
  /** Detected architecture constraints (e.g., "layer:service->domain") */
  architectureConstraints: string[];
  /** Overall health score (0-100) */
  healthScore: number;
  /** Skill demand estimates for different agent types */
  skillDemand: SkillDemand;
  /** History of migrations applied to this baseline */
  migrationHistory?: MigrationRecord[];
  /** Mark as deprecated to trigger automatic rebuild */
  deprecated?: boolean;
}

// ============================================================================
// Compatibility Types
// ============================================================================

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
  graph: CodeGraph;
  /** Action that was executed */
  action: CompatibilityAction;
  /** Whether migration was performed */
  migrated: boolean;
}

// ============================================================================
// Load/Save Types
// ============================================================================

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
  actionConfig?: ActionConfig;
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

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Result of baseline structure validation
 *
 * WHY: Collects all validation errors to report comprehensive issues,
 * rather than stopping at first error.
 */
export interface ValidationResult {
  /** Whether structure is valid */
  valid: boolean;
  /** List of validation errors */
  errors: string[];
}

/**
 * Result of baseline data integrity verification
 *
 * WHY: Checks semantic integrity (node ID uniqueness, edge references)
 * after structure validation passes.
 */
export interface IntegrityResult {
  /** Whether data integrity passes */
  valid: boolean;
  /** List of integrity errors */
  errors: string[];
}

// ============================================================================
// Migration Types
// ============================================================================

/**
 * Migration script interface
 *
 * WHY: Defines contract for version migrations:
 * - fromVersion supports 'x' wildcard (e.g., '1.x' matches all 1.x versions)
 * - migrate function transforms baseline structure
 * - description documents the migration purpose
 */
export interface MigrationScript {
  /** Source version (supports 'x' wildcard) */
  fromVersion: string;
  /** Target version */
  toVersion: string;
  /** Migration transformation function */
  migrate: (baseline: Baseline) => Baseline;
  /** Human-readable description of migration purpose */
  description: string;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for baseline operations
 *
 * WHY: Enables programmatic error handling and CLI error messages
 * mapping to specific recovery actions.
 */
export enum BaselineErrorCode {
  // Load errors
  E001_FILE_NOT_FOUND = 'E001_FILE_NOT_FOUND',
  E002_PARSE_ERROR = 'E002_PARSE_ERROR',
  E003_INVALID_STRUCTURE = 'E003_INVALID_STRUCTURE',
  E004_CORRUPTED_DATA = 'E004_CORRUPTED_DATA',
  E005_PERMISSION_ERROR = 'E005_PERMISSION_ERROR',

  // Version errors
  E101_MAJOR_MISMATCH = 'E101_MAJOR_MISMATCH',
  E102_FUTURE_VERSION = 'E102_FUTURE_VERSION',
  E103_LEGACY_BASELINE = 'E103_LEGACY_BASELINE',

  // Migration errors
  E201_NO_MIGRATION_PATH = 'E201_NO_MIGRATION_PATH',
  E202_MIGRATION_FAILED = 'E202_MIGRATION_FAILED',

  // Operation errors
  E301_REBUILD_CANCELLED = 'E301_REBUILD_CANCELLED',
  E302_FORCE_REBUILD_REQUIRED = 'E302_FORCE_REBUILD_REQUIRED'
}

/**
 * Custom error class for baseline incompatibility
 *
 * WHY: Provides specific error type for compatibility failures,
 * enabling callers to distinguish from other errors.
 */
export class IncompatibleBaselineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IncompatibleBaselineError';
  }
}

/**
 * Custom error class for baseline operation failures
 *
 * WHY: Encapsulates error code and details for programmatic handling.
 */
export class BaselineError extends Error {
  /** Error code for categorization */
  code: BaselineErrorCode;
  /** Additional context about the error */
  details?: unknown;

  constructor(code: BaselineErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'BaselineError';
  }
}