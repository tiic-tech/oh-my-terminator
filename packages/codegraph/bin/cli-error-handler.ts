/**
 * CLI Entry Point Error Handler
 *
 * WHY: CAC errors and CLI-level errors need centralized handling for consistent UX.
 * Transforms technical errors into friendly messages with suggestions.
 */

import type { CAC, Command } from 'cac';
import { CliErrorCode, type CliError } from '../src/types.js';
import { transformCACError, createUnknownCommandError, isCACError } from '../src/cli/error-transformer.js';
import { routeOutput, detectMode } from '../src/cli/output/router.js';
import { formatErrorJson } from '../src/cli/output/json-formatter.js';
import { formatErrorText } from '../src/cli/output/error-text.js';

/**
 * Type guard: Check if value is an Error instance
 *
 * WHY: TypeScript's `unknown` type requires explicit narrowing.
 * Using type guard instead of `as Error` casting ensures type safety.
 */
function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Type guard: Check if value is a CAC Command instance
 *
 * WHY: matchedCommand comes from CAC's internal state as `unknown`.
 * Type guard validates the shape before using Command-specific methods.
 * Checks for presence of `options` array which is unique to Command objects.
 */
function isCommand(value: unknown): value is Command {
  if (value === null || value === undefined) return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.options) && typeof obj.name === 'string';
}

/**
 * Setup CLI-level error handlers
 *
 * WHY: CAC doesn't throw for unknown commands - emits event instead.
 * Need to handle both CACError throws and unknown command events.
 */
export function setupCliErrorHandler(cli: CAC, startTime: number): void {
  // WHY: CAC emits 'command:*' when no command matched and args[0] exists
  // This is how unknown commands are detected (CAC doesn't throw for them)
  cli.on('command:*', () => {
    const userCommand = cli.args[0];
    if (!userCommand) return;

    // WHY: Suppress CAC's automatic help output for unknown commands
    // CAC shows help before emitting this event when help() is enabled
    cli.unsetMatchedCommand();

    const isJsonMode = process.argv.includes('--json');
    const error = createUnknownCommandError(userCommand, cli, startTime);

    outputCliError(error, isJsonMode);
  });
}

/**
 * Handle caught error at CLI entry point
 *
 * WHY: All command action errors flow through here.
 * Transforms CACError to friendly messages, wraps other errors.
 */
export function handleCliError(error: unknown, cli: CAC, startTime: number, matchedCommand?: unknown): void {
  const isJsonMode = process.argv.includes('--json');

  let cliError: CliError;

  if (isCACError(error) && isError(error)) {
    // WHY: CACError needs transformation - technical message → friendly + suggestion
    // isError type guard ensures safe access to Error properties
    const command = isCommand(matchedCommand) ? matchedCommand : undefined;
    cliError = transformCACError(error, cli, command, startTime);
  } else if (error instanceof Error) {
    // WHY: Other errors become internal errors with debug info
    cliError = {
      success: false,
      error: {
        code: CliErrorCode.E_CLI_INTERNAL,
        message: 'An unexpected error occurred',
        debug: error.message,
      },
      durationMs: Date.now() - startTime,
    };
  } else {
    // WHY: Non-Error thrown (string, etc.) - wrap as internal
    cliError = {
      success: false,
      error: {
        code: CliErrorCode.E_CLI_INTERNAL,
        message: String(error),
      },
      durationMs: Date.now() - startTime,
    };
  }

  outputCliError(cliError, isJsonMode);
}

/**
 * Output CliError based on mode
 *
 * WHY: Routes to stderr in text mode, stdout in JSON mode.
 * Follows existing cli-output-routing spec.
 */
function outputCliError(error: CliError, isJsonMode: boolean): void {
  const mode = detectMode({ json: isJsonMode });

  if (isJsonMode) {
    routeOutput(formatErrorJson(error), mode);
  } else {
    routeOutput(formatErrorText(error), mode);
  }

  // WHY: Exit with non-zero code for errors
  process.exit(1);
}