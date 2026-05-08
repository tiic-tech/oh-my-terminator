/**
 * Empty Project Handler
 *
 * WHY: Empty projects are valid states (e.g., new repos), not errors.
 * CLI should exit 0 with helpful guidance, not fail with error code.
 * This improves user experience and reduces false-negative failures.
 */

/**
 * Result returned when no parseable source files found
 */
export interface EmptyProjectResult {
  /** Exit code - 0 for graceful handling, not error */
  exitCode: 0;
  /** Primary message explaining the situation */
  message: string;
  /** actionable suggestions for user */
  suggestions: string[];
}

/**
 * Handle empty project scenario
 *
 * WHY: Returns structured message for CLI consumption, enabling
 * clear user guidance without throwing errors.
 */
export function handleEmptyProject(): EmptyProjectResult {
  return {
    exitCode: 0,
    message: 'No source files found. Check if project has .ts/.js files',
    suggestions: [
      'Verify git clone completed successfully',
      'Check project contains TypeScript/JavaScript files',
      'Use custom extensions option for other file types',
    ],
  };
}