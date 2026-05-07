/**
 * Migrate text formatter for CLI commands
 *
 * WHY: Human-readable text output for migrate command.
 * Shows migration statistics to users for verification.
 */

import type { MigrateResult } from '../../types.js';
import type { OutputResult } from './types.js';
import { formatDuration, formatBytes } from './format-utils.js';

/**
 * Format MigrateResult as OutputResult with human-readable text
 *
 * WHY: Shows migration statistics to users for verification.
 *
 * @param result - Migration result from CLI migrate command
 * @returns OutputResult with text primary content
 */
export function formatMigrateText(result: MigrateResult): OutputResult {
  const lines: string[] = [];

  // Header
  lines.push('Migration complete');

  // Paths
  lines.push('');
  lines.push(`Input: ${result.inputPath}`);
  lines.push(`Output: ${result.outputPath}`);

  // Statistics (6.6)
  lines.push('');
  lines.push('Migration statistics:');
  lines.push(`- Input size: ${formatBytes(result.stats.inputSizeBytes)}`);
  lines.push(`- Output size: ${formatBytes(result.stats.outputSizeBytes)}`);
  lines.push(`- Savings: ${result.stats.savingsPercent}%`);
  lines.push(`- Path table entries: ${result.stats.pathTableEntries}`);

  // Duration
  lines.push('');
  lines.push(`Duration: ${formatDuration(result.durationMs)}`);

  return {
    primary: lines.join('\n'),
    metadata: {
      durationMs: result.durationMs,
      command: 'migrate',
    },
  };
}