/**
 * JSON output formatters for CLI commands
 *
 * WHY: Compact JSON output enables programmatic consumption and piping to other tools.
 * Each formatter returns a string - caller handles stdout/stderr routing.
 */

import type { AnalyzeResult, UpdateResult, MigrateResult, CliError } from '../../types.js';

/**
 * Format AnalyzeResult as compact JSON
 *
 * @param result - Analysis result from CLI analyze command
 * @returns JSON string with minimal whitespace
 */
export function formatAnalyzeJson(result: AnalyzeResult): string {
  return JSON.stringify(result);
}

/**
 * Format UpdateResult as compact JSON
 *
 * @param result - Update result from CLI update command
 * @returns JSON string with minimal whitespace
 */
export function formatUpdateJson(result: UpdateResult): string {
  return JSON.stringify(result);
}

/**
 * Format MigrateResult as compact JSON
 *
 * @param result - Migration result from CLI migrate command
 * @returns JSON string with minimal whitespace
 */
export function formatMigrateJson(result: MigrateResult): string {
  return JSON.stringify(result);
}

/**
 * Format CliError as compact JSON
 *
 * @param error - Error result from CLI command
 * @returns JSON string with minimal whitespace
 */
export function formatErrorJson(error: CliError): string {
  return JSON.stringify(error);
}