/**
 * @fileoverview Compression-specific error classes
 *
 * WHY: Structured error handling enables programmatic error processing
 * and user-friendly messages. Each error class maps to a CliErrorCode
 * for consistent error reporting across the CLI.
 *
 * @see types.ts CliErrorCode enum for error code definitions
 * @see design.md Section "Risks / Trade-offs" - Path table index confusion
 */

import { CliErrorCode } from '../../types.js';

/**
 * Base error class for compression operations
 *
 * WHY: Provides common structure for all compression-related errors.
 * The `code` field enables programmatic handling by CLI commands.
 */
export class CompressionError extends Error {
  /** Structured error code for programmatic handling */
  readonly code: CliErrorCode;

  /**
   * Create a compression error
   * @param code - CliErrorCode for this error type
   * @param message - Human-readable error description
   */
  constructor(code: CliErrorCode, message: string) {
    super(message);
    this.name = 'CompressionError';
    this.code = code;
  }
}

/**
 * Error thrown when path table index exceeds bounds
 *
 * WHY: Path table indexes are critical for reconstruction. Invalid indexes
 * indicate corrupted baseline or programming error. Specialized class
 * provides context for debugging.
 *
 * @see design.md D3: Path Table decision - index references
 */
export class IndexOutOfBoundsError extends CompressionError {
  /** The invalid index that caused the error */
  readonly index: number;
  /** Maximum valid index (pathTable.length - 1) */
  readonly maxIndex: number;

  /**
   * Create an index out of bounds error
   * @param index - The invalid index value
   * @param maxIndex - Maximum valid index (pathTable.length - 1)
   * @param detail - Optional additional context
   */
  constructor(index: number, maxIndex: number, detail?: string) {
    const message = detail
      ? `Path table index ${index} exceeds bounds (max: ${maxIndex}). ${detail}`
      : `Path table index ${index} exceeds bounds (max: ${maxIndex})`;

    super(CliErrorCode.E_INDEX_OUT_OF_BOUNDS, message);

    this.name = 'IndexOutOfBoundsError';
    this.index = index;
    this.maxIndex = maxIndex;
  }
}

/**
 * Error thrown when baseline file is corrupted or invalid
 *
 * WHY: Baseline corruption can occur from manual edits, disk errors,
 * or version incompatibility. Specialized class provides structured
 * details for error recovery suggestions.
 *
 * @see design.md D5: Schema Version Migration - corrupted baseline handling
 */
export class CorruptedBaselineError extends CompressionError {
  /** Optional structured details about the corruption */
  readonly details?: Record<string, unknown>;

  /**
   * Create a corrupted baseline error
   * @param reason - Description of what makes the baseline invalid
   * @param details - Optional structured details for debugging
   */
  constructor(reason: string, details?: Record<string, unknown>) {
    const message = details
      ? `Corrupted baseline: ${reason}. Details: ${JSON.stringify(details)}`
      : `Corrupted baseline: ${reason}`;

    super(CliErrorCode.E_CORRUPTED_BASELINE, message);

    this.name = 'CorruptedBaselineError';
    this.details = details;
  }
}