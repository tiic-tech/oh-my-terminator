/**
 * Impact output formatters for CLI commands
 *
 * WHY: Separate formatters enable both programmatic (JSON) and human-readable (text) output.
 * Text output uses structured layout for easy scanning by developers.
 *
 * CHANGE: Formatters return OutputResult instead of writing to stream.
 * WHY: Separation of concerns - formatter produces, command routes.
 */

import type { ImpactResult, ImpactError } from '../../api/types/index.js';
import type { OutputResult } from './types.js';
import { formatDuration, optionalArray } from './format-utils.js';

/**
 * Format ImpactResult as OutputResult with JSON content
 *
 * @param result - Impact analysis result from CLI impact command
 * @returns OutputResult with JSON primary content and warnings extracted
 */
export function formatImpactJson(result: ImpactResult): OutputResult {
  return {
    primary: JSON.stringify(result),
    warnings: optionalArray(result.warnings),
    metadata: {
      durationMs: result.durationMs,
      command: 'impact',
    },
  };
}

/**
 * Format ImpactError as OutputResult with JSON error content
 *
 * @param error - Error result from impact command
 * @returns OutputResult with JSON error in primary and error message in errors field
 */
export function formatImpactErrorJson(error: ImpactError): OutputResult {
  return {
    primary: JSON.stringify(error),
    errors: [error.error.message],
    metadata: {
      durationMs: error.durationMs,
    },
  };
}

/**
 * Format ImpactResult as OutputResult with human-readable text
 *
 * Layout:
 * 1. Header with blast radius
 * 2. Summary counts
 * 3. Affected files list (with truncation info)
 * 4. Duration
 * 5. Next suggested (warnings go to stderr field, not stdout)
 *
 * @param result - Impact analysis result
 * @returns OutputResult with text primary content and warnings extracted
 */
export function formatImpactText(result: ImpactResult): OutputResult {
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

  // WHY: Warnings go to stderr, not stdout - Unix convention
  // Warnings are NOT included in primary content, extracted to warnings field

  // Next suggested
  if (result.nextSuggested && result.nextSuggested.length > 0) {
    lines.push('');
    lines.push('Next suggested:');
    for (const suggestion of result.nextSuggested) {
      lines.push(`- ${suggestion}`);
    }
  }

  return {
    primary: lines.join('\n'),
    warnings: optionalArray(result.warnings),
    metadata: {
      durationMs: result.durationMs,
      command: 'impact',
    },
  };
}

/**
 * Format ImpactError as OutputResult with human-readable error text
 *
 * @param error - Error result from impact command
 * @returns OutputResult with error text in primary and error message in errors field
 */
export function formatImpactErrorText(error: ImpactError): OutputResult {
  const lines: string[] = [];

  lines.push(`Error: ${error.error.message}`);
  lines.push(`Code: ${error.error.code}`);

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