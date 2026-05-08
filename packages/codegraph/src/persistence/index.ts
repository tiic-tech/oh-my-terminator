/**
 * @fileoverview Public exports for CodeGraph persistence module
 *
 * WHY: Provides clean public API for baseline persistence operations.
 * Internal implementation files (compatibility.ts, baseline.ts, migrations/)
 * are imported and re-exported here.
 */

// Re-export types (SchemaVersion from core types, others from persistence types)
export type { SchemaVersion } from '../types.js';
export type {
  SkillDemand,
  MigrationRecord,
  Baseline,
  CompatibilityReason,
  CompatibilityAction,
  CompatibilityResult,
  ActionConfig,
  ActionResult,
  LoadFailureReason,
  FailureInfo,
  FailureHandler,
  RebuildHandler,
  LoadBaselineOptions,
  LoadBaselineResult,
  SaveBaselineOptions,
  ValidationResult,
  IntegrityResult,
  MigrationScript,
} from './types/index.js';

// Re-export error classes
export {
  BaselineErrorCode,
  IncompatibleBaselineError,
  BaselineError,
} from './types/index.js';

// Version constants and SchemaVersionImpl class
export {
  CURRENT_SCHEMA_VERSION,
  GENERATOR_VERSION,
  LEGACY_VERSION,
  SchemaVersionImpl,
} from '../version.js';

// Path utilities
export {
  CODEGRAPH_DIR,
  BASELINE_FILE,
  LAST_COMMIT_FILE,
  VERSION_FILE,
  MIGRATION_LOG_FILE,
  getBaselinePath,
  getLastCommitPath,
  getVersionPath,
  getMigrationLogPath,
  getCodegraphDirPath,
  ensureCodegraphDir,
  getBackupPath,
  getTempPath,
} from './paths.js';

// Compatibility functions (split into compatibility/ module)
export {
  checkSchemaCompatibility,
  determineAction,
  executeAction,
} from './compatibility/index.js';

// Baseline load/save functions (from split baseline module)
export {
  validateBaselineStructure,
  verifyDataIntegrity,
  handleFailure,
  loadBaseline,
} from './baseline/index.js';

export {
  saveBaseline,
} from './save.js';

// Baseline loading functions (from load.ts)
export {
  loadBaselineFile,
  loadBaselineMetadata,
} from './load.js';

// Migration functions
export {
  registerMigration,
  versionMatchesPattern,
  findMigrationPath,
  migrateBaseline,
  safeMigrateBaseline,
  clearMigrationRegistry,
} from './migrations/index.js';