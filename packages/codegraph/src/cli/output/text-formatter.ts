/**
 * Text output formatters for CLI commands
 *
 * WHY: Human-readable text output provides immediate feedback to developers.
 * Uses Unicode symbols for visual clarity and structured layout for scanning.
 */

import type { AnalyzeResult, UpdateResult, CliError } from '../../types.js';

/**
 * Format AnalyzeResult as human-readable text
 *
 * @param result - Analysis result from CLI analyze command
 * @returns Multiline formatted string
 */
export function formatAnalyzeText(result: AnalyzeResult): string {
  const lines: string[] = [];

  // Header
  lines.push('Analysis complete');

  // Stats
  lines.push('');
  lines.push(`Files scanned: ${result.stats.filesScanned}`);
  lines.push(`Modules extracted: ${result.stats.modulesExtracted}`);
  lines.push(
    `Edges created: ${result.stats.edgesCreated.imports} imports, ${result.stats.edgesCreated.exports} exports, ${result.stats.edgesCreated.contains} contains`
  );

  // Baseline info (if present)
  if (result.baseline) {
    lines.push('');
    lines.push(`Baseline saved: ${result.baseline.path}`);
  }

  // Duration
  lines.push(`Duration: ${formatDuration(result.durationMs)}`);

  // Warnings (if any)
  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  // Next suggested (if any)
  if (result.nextSuggested.length > 0) {
    lines.push('');
    lines.push('Next suggested:');
    for (const suggestion of result.nextSuggested) {
      lines.push(`- ${suggestion}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format UpdateResult as human-readable text
 *
 * @param result - Update result from CLI update command
 * @returns Multiline formatted string
 */
export function formatUpdateText(result: UpdateResult): string {
  const lines: string[] = [];

  // Header
  lines.push('Update complete');

  // Changes
  lines.push('');
  lines.push('Changes detected:');
  lines.push(`- Added: ${result.changes.added.length} files`);
  lines.push(`- Modified: ${result.changes.modified.length} files`);
  lines.push(`- Removed: ${result.changes.removed.length} files`);

  // Delta
  lines.push('');
  lines.push(`New nodes: ${result.delta.newNodes}`);
  lines.push(`Removed nodes: ${result.delta.removedNodes}`);

  // Duration
  lines.push(`Duration: ${formatDuration(result.durationMs)}`);

  // Warnings (if any)
  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format CliError as human-readable text
 *
 * @param error - Error result from CLI command
 * @returns Error message string
 */
export function formatErrorText(error: CliError): string {
  const lines: string[] = [];

  lines.push(`Error: ${error.error.message}`);
  lines.push(`Code: ${error.error.code}`);
  lines.push(`Duration: ${formatDuration(error.durationMs)}`);

  return lines.join('\n');
}

/**
 * Format duration in milliseconds to human-readable string
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "2.3s", "450ms")
 */
function formatDuration(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
}