/**
 * Error text formatter for CLI commands
 *
 * WHY: Human-readable error output for CLI commands.
 * Consistent error formatting across all commands.
 */

import type { CliError } from '../../types.js';
import type { OutputResult } from './types.js';
import { formatDuration } from './format-utils.js';

/**
 * Format CliError as OutputResult with human-readable error text
 *
 * WHY: Outputs to stderr (via router) to separate errors from stdout.
 * Includes suggestion when available for better UX.
 *
 * @param error - Error result from CLI command
 * @returns OutputResult with error text in primary and error message in errors field
 */
export function formatErrorText(error: CliError): OutputResult {
  const lines: string[] = [];

  lines.push(`Error: ${error.error.message}`);
  lines.push(`Code: ${error.error.code}`);

  // WHY: Show suggestion if available - helps user correct their input
  if (error.error.suggestion) {
    lines.push(`Suggestion: ${error.error.suggestion}`);
  }

  lines.push(`Duration: ${formatDuration(error.durationMs)}`);

  return {
    primary: lines.join('\n'),
    errors: [error.error.message],
    metadata: {
      durationMs: error.durationMs,
    },
  };
}