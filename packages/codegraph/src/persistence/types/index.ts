/**
 * @fileoverview Re-exports for persistence types
 *
 * WHY: Barrel file provides clean public API for all persistence types.
 * Consumers import from './types/index.js' instead of individual files.
 *
 * Type groups (each file < 150 lines per coding-taste Rule 2):
 * - baseline.ts: Core baseline data structure types
 * - compatibility.ts: Schema compatibility checking types
 * - operations.ts: Load/save operation types
 * - validation.ts: Validation result types
 * - migration.ts: Migration script interface
 * - errors.ts: Error codes and custom error classes
 */

// ============================================================================
// Baseline Structure Types
// ============================================================================

export type { SkillDemand, MigrationRecord, Baseline } from './baseline.js';

// Re-export SchemaVersion from core types (used by baseline.ts)
export type { SchemaVersion } from '../../types.js';

// ============================================================================
// Compatibility Types
// ============================================================================

export type {
  CompatibilityReason,
  CompatibilityAction,
  CompatibilityResult,
  ActionConfig,
  ActionResult,
} from './compatibility.js';

// ============================================================================
// Load/Save Operation Types
// ============================================================================

export type {
  LoadFailureReason,
  FailureInfo,
  FailureHandler,
  RebuildHandler,
  LoadBaselineOptions,
  LoadBaselineResult,
  SaveBaselineOptions,
} from './operations.js';

// ============================================================================
// Validation Types
// ============================================================================

export type { ValidationResult, IntegrityResult } from './validation.js';

// ============================================================================
// Migration Types
// ============================================================================

export type { MigrationScript } from './migration.js';

// ============================================================================
// Error Types
// ============================================================================

export { BaselineErrorCode, IncompatibleBaselineError, BaselineError } from './errors.js';