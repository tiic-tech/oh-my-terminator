/**
 * JSON output formatters for CLI commands
 *
 * WHY: Compact JSON output enables programmatic consumption and piping to other tools.
 * Each formatter returns OutputResult - caller handles stdout/stderr routing.
 *
 * CHANGE: Formatters return OutputResult instead of writing to stream.
 * WHY: Separation of concerns - formatter produces, command routes.
 */

import type { AnalyzeResult, UpdateResult, MigrateResult, CliError } from '../../types.js';
import type { OutputResult } from './types.js';
import { optionalArray } from './format-utils.js';

/**
 * Format AnalyzeResult as OutputResult with JSON content
 *
 * @param result - Analysis result from CLI analyze command
 * @returns OutputResult with JSON primary content and warnings extracted
 */
export function formatAnalyzeJson(result: AnalyzeResult): OutputResult {
  return {
    primary: JSON.stringify(result),
    warnings: optionalArray(result.warnings),
    metadata: {
      durationMs: result.durationMs,
      command: 'analyze',
    },
  };
}

/**
 * Format UpdateResult as OutputResult with JSON content
 *
 * @param result - Update result from CLI update command
 * @returns OutputResult with JSON primary content and warnings extracted
 */
export function formatUpdateJson(result: UpdateResult): OutputResult {
  return {
    primary: JSON.stringify(result),
    warnings: optionalArray(result.warnings),
    metadata: {
      durationMs: result.durationMs,
      command: 'update',
    },
  };
}

/**
 * Format MigrateResult as OutputResult with JSON content
 *
 * @param result - Migration result from CLI migrate command
 * @returns OutputResult with JSON primary content
 */
export function formatMigrateJson(result: MigrateResult): OutputResult {
  return {
    primary: JSON.stringify(result),
    metadata: {
      durationMs: result.durationMs,
      command: 'migrate',
    },
  };
}

/**
 * Format CliError as OutputResult with JSON error content
 *
 * @param error - Error result from CLI command
 * @returns OutputResult with JSON error in primary and error message in errors field
 */
export function formatErrorJson(error: CliError): OutputResult {
  return {
    primary: JSON.stringify(error),
    errors: [error.error.message],
    metadata: {
      durationMs: error.durationMs,
    },
  };
}