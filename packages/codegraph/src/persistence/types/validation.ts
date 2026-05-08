/**
 * @fileoverview Validation result types
 *
 * WHY: Validation types are simple, self-contained result containers.
 * Separated to keep file focused and allow reuse without pulling in other types.
 *
 * Contains:
 * - ValidationResult: Result of baseline structure validation
 * - IntegrityResult: Result of baseline data integrity verification
 */

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