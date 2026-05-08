/**
 * @fileoverview Error types for baseline operations
 *
 * WHY: Error handling is a distinct concern from data structures and operations.
 * Separated to allow focused error handling and custom error class definitions.
 *
 * Contains:
 * - BaselineErrorCode: Error codes for baseline operations
 * - IncompatibleBaselineError: Custom error for compatibility failures
 * - BaselineError: Custom error for baseline operation failures
 */

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