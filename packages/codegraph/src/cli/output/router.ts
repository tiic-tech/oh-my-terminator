/**
 * Stream routing for CLI output
 *
 * WHY: Central utility handles stream routing based on OutputMode.
 * Commands call routeOutput(), keeping routing logic consistent and reusable.
 *
 * Unix convention:
 * - stdout: Program output (what user asked for)
 * - stderr: Diagnostics, progress, errors (what happened during execution)
 *
 * @see cg-stderr-model design.md Decision 4
 */

import { OutputMode, type OutputResult, type ModeOptions } from './types.js';

/**
 * Routes OutputResult to appropriate streams based on OutputMode
 *
 * Behavior:
 * - JSON mode: primary -> stdout (pure JSON), warnings/errors -> stderr
 * - TEXT mode: primary -> stdout (formatted text), warnings/errors -> stderr
 * - SILENT mode: errors -> stderr only
 *
 * WHY: Ensures stdout contains only program output in JSON mode.
 * Users piping to jq get valid JSON, not mixed content.
 *
 * @param result - OutputResult from formatter
 * @param mode - Output mode determining routing behavior
 * @throws Error if result.primary is null/undefined
 */
export function routeOutput(result: OutputResult, mode: OutputMode): void {
  // Validate required field - WHY: Safety check before writing to streams
  // Using == null catches both null and undefined (idiomatic JavaScript)
  if (result.primary == null) {
    throw new Error('OutputResult.primary is required and cannot be null');
  }

  // stdout: primary content (JSON or formatted text)
  // WHY: SILENT mode suppresses stdout to enable quiet operation
  if (mode !== OutputMode.SILENT && result.primary) {
    // WHY: Only add newline if primary doesn't already end with one
    // Prevents double newlines from formatted content
    const content = result.primary.endsWith('\n') ? result.primary : result.primary + '\n';
    process.stdout.write(content);
  }

  // stderr: warnings + errors (joined with newline)
  // WHY: Diagnostics go to stderr, not stdout - Unix convention
  const stderrParts: string[] = [];

  // In SILENT mode, only errors go to stderr (warnings suppressed)
  // WHY: Silent mode for quiet operation, but errors must still surface
  if (mode === OutputMode.SILENT) {
    if (result.errors && result.errors.length > 0) {
      stderrParts.push(...result.errors);
    }
  } else {
    // JSON/TEXT mode: both warnings and errors go to stderr
    if (result.warnings && result.warnings.length > 0) {
      stderrParts.push(...result.warnings);
    }
    if (result.errors && result.errors.length > 0) {
      stderrParts.push(...result.errors);
    }
  }

  if (stderrParts.length > 0) {
    process.stderr.write(stderrParts.join('\n') + '\n');
  }
}

/**
 * Detects OutputMode from command options
 *
 * WHY: Standardized mode detection avoids per-command switch logic.
 * Priority: json > silent > text (default)
 *
 * @param options - Command options containing json/silent flags
 * @returns Detected OutputMode
 */
export function detectMode(options: ModeOptions): OutputMode {
  if (options.json) {
    return OutputMode.JSON;
  }
  if (options.silent) {
    return OutputMode.SILENT;
  }
  return OutputMode.TEXT;
}

/**
 * Create OutputResult from primary content
 *
 * WHY: Helper for simple output cases (no warnings/errors).
 * Reduces boilerplate in commands.
 *
 * @param primary - Main output content
 * @param warnings - Optional warning messages
 * @param errors - Optional error messages
 * @returns OutputResult object
 */
export function createOutput(
  primary: string,
  warnings?: string[],
  errors?: string[]
): OutputResult {
  const result: OutputResult = { primary };

  // WHY: Only include optional fields if they have content
  // Empty arrays are semantically equivalent to undefined
  if (warnings && warnings.length > 0) {
    result.warnings = warnings;
  }
  if (errors && errors.length > 0) {
    result.errors = errors;
  }

  return result;
}