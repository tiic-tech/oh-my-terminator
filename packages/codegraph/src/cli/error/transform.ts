/**
 * CLI Error Transformation Functions
 *
 * WHY: Transform CACError and other CLI errors into friendly, actionable messages
 * with suggestions. Avoid raw Node.js stack traces for better UX.
 */

import type { CAC, Command } from 'cac';
import { CliErrorCode, type CliError } from '../../types.js';
import { createCliError } from '../error-codes.js';
import { CAC_ERROR_PATTERNS } from './patterns.js';
import { getAvailableCommands, getAvailableFlags } from './helpers.js';
import { findSimilarCommand, findSimilarFlag } from './suggestions.js';

/**
 * Transform CACError into friendly CliError with suggestions
 *
 * WHY: CACError messages are technical. Transform them into user-friendly
 * messages with actionable suggestions.
 *
 * @param error - Error to transform
 * @param _cli - CLI instance (unused but kept for future command suggestions)
 * @param matchedCommand - The matched command for flag suggestions
 * @param startTime - Process start time for duration calculation
 */
export function transformCACError(
  error: Error,
  _cli: CAC,
  matchedCommand?: Command,
  startTime?: number
): CliError {
  const message = error.message;
  const durationMs = startTime ? Date.now() - startTime : 0;

  // Check for unknown option
  const unknownOptionMatch = message.match(CAC_ERROR_PATTERNS.UNKNOWN_OPTION);
  if (unknownOptionMatch) {
    const userFlag = unknownOptionMatch[1];
    const availableFlags = matchedCommand ? getAvailableFlags(matchedCommand) : [];
    const similarFlag = findSimilarFlag(userFlag, availableFlags);

    return createCliError(CliErrorCode.E_CLI_UNKNOWN_FLAG, `Invalid flag: --${userFlag}`, {
      suggestion: similarFlag
        ? `Did you mean ${similarFlag}?`
        : availableFlags.length > 0
          ? `Available flags: ${availableFlags.join(', ')}`
          : undefined,
      debug: message,
    }, durationMs);
  }

  // Check for missing option value
  const missingOptionValueMatch = message.match(CAC_ERROR_PATTERNS.MISSING_OPTION_VALUE);
  if (missingOptionValueMatch) {
    const optionName = missingOptionValueMatch[1];
    return createCliError(CliErrorCode.E_CLI_MISSING_ARG, `Flag --${optionName} requires a value`, {
      suggestion: `Use: --${optionName} <value>`,
      debug: message,
    }, durationMs);
  }

  // Check for missing required args
  const missingArgsMatch = message.match(CAC_ERROR_PATTERNS.MISSING_REQUIRED_ARGS);
  if (missingArgsMatch) {
    const commandName = missingArgsMatch[1];
    return createCliError(CliErrorCode.E_CLI_MISSING_ARG, `Missing required argument for ${commandName}`, {
      suggestion: `Check usage with: codegraph ${commandName} --help`,
      debug: message,
    }, durationMs);
  }

  // Fallback: unknown error type, return as internal error
  return createCliError(CliErrorCode.E_CLI_INTERNAL, 'An unexpected error occurred', {
    debug: message,
  }, durationMs);
}

/**
 * Create CliError for unknown command (CAC doesn't throw this, we handle it)
 *
 * WHY: CAC shows help for unknown commands without throwing error.
 * We need custom handling to provide friendly error + suggestions.
 *
 * @param startTime - Process start time for duration calculation
 */
export function createUnknownCommandError(userCommand: string, cli: CAC, startTime?: number): CliError {
  const availableCommands = getAvailableCommands(cli);
  const similarCommand = findSimilarCommand(userCommand, availableCommands);
  const durationMs = startTime ? Date.now() - startTime : 0;

  return createCliError(CliErrorCode.E_CLI_UNKNOWN_COMMAND, `Unknown command: ${userCommand}`, {
    suggestion: similarCommand
      ? `Did you mean ${similarCommand}?`
      : availableCommands.length > 0
        ? `Available commands: ${availableCommands.join(', ')}`
        : undefined,
  }, durationMs);
}

/**
 * Create CliError for target not found in scope/impact commands
 *
 * WHY: Provide path format hint when user uses wrong path format.
 *
 * @param userPath - User-provided path that wasn't found
 * @param _projectRoot - Project root (unused but kept for future validation)
 * @param isMonorepo - Whether project is monorepo (affects hint format)
 * @param startTime - Process start time for duration calculation
 */
export function createTargetNotFoundError(
  userPath: string,
  _projectRoot: string,
  isMonorepo: boolean,
  startTime?: number
): CliError {
  const message = `Target not found: ${userPath}`;
  const durationMs = startTime ? Date.now() - startTime : 0;

  // WHY: Show path hint if path doesn't match monorepo format
  const shouldShowHint = isMonorepo && !/^packages\/[a-z-]+\/src\/.+/.test(userPath);

  const suggestion = shouldShowHint
    ? 'Hint: Use full path format: packages/<pkg>/src/<file>.ts'
    : undefined;

  return createCliError(CliErrorCode.E_CLI_TARGET_NOT_FOUND, message, {
    suggestion,
  }, durationMs);
}

/**
 * Check if error is CACError (CAC's custom error class)
 *
 * WHY: CACError has specific name property, not exported in types.
 * Use name check to identify CAC-specific errors.
 */
export function isCACError(error: unknown): boolean {
  return error instanceof Error && error.name === 'CACError';
}