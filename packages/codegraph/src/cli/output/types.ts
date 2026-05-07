/**
 * Output types for CLI stream routing
 *
 * WHY: Unix convention requires stdout for program output, stderr for diagnostics.
 * This interface enables formatters to return structured output, letting commands
 * route to appropriate streams.
 *
 * One truth: OutputResult is the single definition for all formatters.
 * No duplication - warnings/errors are defined once here.
 *
 * @see cg-stderr-model design.md Decision 2
 */

/**
 * Output mode enum defining routing behavior
 *
 * WHY: Different modes require different routing logic.
 * JSON mode needs pure stdout for piping; TEXT mode can mix.
 */
export enum OutputMode {
  /** JSON mode: JSON output to stdout, warnings/errors to stderr */
  JSON = 'json',
  /** Text mode: Formatted text to stdout, warnings/errors to stderr */
  TEXT = 'text',
  /** Silent mode: Only errors to stderr, no stdout output */
  SILENT = 'silent',
}

/**
 * Output result structure returned by formatters
 *
 * WHY: Separates content generation from stream routing.
 * Formatters produce content; commands decide where it goes.
 * This enables clean testing (formatters return objects, not write streams).
 *
 * Fields:
 * - primary: string (required) - Main output content for stdout
 * - warnings: string[] (optional) - Diagnostic messages for stderr
 * - errors: string[] (optional) - Error messages for stderr
 * - metadata: object (optional) - Execution metadata
 *
 * Null handling:
 * - primary MUST be non-null string (required field)
 * - warnings/errors MAY be undefined (optional fields) or empty array
 * - Empty arrays are semantically equivalent to undefined
 */
export interface OutputResult {
  /** Main output content, written to stdout. Always present. */
  primary: string;

  /** Warning messages for stderr. Empty array or undefined when no warnings. */
  warnings?: string[];

  /** Error messages for stderr. Empty array or undefined when no errors. */
  errors?: string[];

  /** Optional execution metadata */
  metadata?: {
    /** Execution duration in milliseconds */
    durationMs?: number;
    /** Command name for logging */
    command?: 'analyze' | 'update' | 'migrate' | 'impact' | 'scope' | 'layers';
  };
}

/**
 * Options for mode detection
 *
 * WHY: Standardized options object for detectMode function.
 * Avoids per-command option interface duplication.
 */
export interface ModeOptions {
  /** JSON output mode flag */
  json?: boolean;
  /** Silent output mode flag */
  silent?: boolean;
}