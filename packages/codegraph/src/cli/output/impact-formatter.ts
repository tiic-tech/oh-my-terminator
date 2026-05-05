/**
 * Impact output formatters for CLI commands
 *
 * WHY: Separate formatters enable both programmatic (JSON) and human-readable (text) output.
 * Text output uses structured layout for easy scanning by developers.
 */

import type { ImpactResult, ImpactError } from '../../api/types/index.js';

/**
 * Format ImpactResult as compact JSON
 *
 * @param result - Impact analysis result from CLI impact command
 * @returns JSON string with minimal whitespace
 */
export function formatImpactJson(result: ImpactResult): string {
  return JSON.stringify(result);
}

/**
 * Format ImpactError as compact JSON
 *
 * @param error - Error result from impact command
 * @returns JSON string with minimal whitespace
 */
export function formatImpactErrorJson(error: ImpactError): string {
  return JSON.stringify(error);
}

/**
 * Format ImpactResult as human-readable text
 *
 * Layout:
 * 1. Header with blast radius
 * 2. Summary counts
 * 3. Affected files list (with truncation info)
 * 4. Duration
 * 5. Warnings and nextSuggested
 *
 * @param result - Impact analysis result
 * @returns Multiline formatted string
 */
export function formatImpactText(result: ImpactResult): string {
  const lines: string[] = [];

  // Header
  lines.push('Impact analysis complete');

  // Summary
  lines.push('');
  lines.push(`Total affected: ${result.summary.total}`);
  lines.push(`Direct: ${result.summary.direct}`);
  lines.push(`Indirect: ${result.summary.indirect}`);
  lines.push(`Blast radius: ${result.blastRadius}`);

  // Affected files
  if (result.affectedFiles.length > 0) {
    lines.push('');
    if (result.truncated) {
      lines.push(`Affected files (showing ${result.affectedFiles.length} of ${result.summary.total}):`);
    } else {
      lines.push('Affected files:');
    }

    for (const file of result.affectedFiles) {
      const typeLabel = file.distance === 1 ? 'direct' : 'indirect';
      const viaPath = file.via.length > 0 ? ` via ${file.via.join(' → ')}` : '';
      lines.push(`- ${file.path} (${typeLabel})${viaPath}`);
    }

    if (result.truncated) {
      lines.push('');
      lines.push('Results truncated. Use --max-files to see more.');
    }
  } else {
    lines.push('');
    lines.push('No affected files found.');
  }

  // Duration
  lines.push(`Duration: ${formatDuration(result.durationMs)}`);

  // Warnings
  if (result.warnings && result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  // Next suggested
  if (result.nextSuggested && result.nextSuggested.length > 0) {
    lines.push('');
    lines.push('Next suggested:');
    for (const suggestion of result.nextSuggested) {
      lines.push(`- ${suggestion}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format ImpactError as human-readable text
 *
 * @param error - Error result from impact command
 * @returns Error message string
 */
export function formatImpactErrorText(error: ImpactError): string {
  const lines: string[] = [];

  lines.push(`Error: ${error.error.message}`);
  lines.push(`Code: ${error.error.code}`);

  if (error.error.suggestion) {
    lines.push(`Suggestion: ${error.error.suggestion}`);
  }

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