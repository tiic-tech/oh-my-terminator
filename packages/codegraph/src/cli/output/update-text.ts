/**
 * Update text formatter for CLI commands
 *
 * WHY: Human-readable text output for update command.
 * Shows change detection statistics and delta information.
 */

import type { UpdateResult } from '../../types.js';
import type { OutputResult } from './types.js';
import { formatDuration, formatCompressionStats, optionalArray } from './format-utils.js';

/**
 * Format UpdateResult as OutputResult with human-readable text
 *
 * @param result - Update result from CLI update command
 * @returns OutputResult with text primary content and warnings extracted to stderr field
 */
export function formatUpdateText(result: UpdateResult): OutputResult {
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

  // Compression stats (if present - 6.8)
  if (result.compressionStats) {
    lines.push(formatCompressionStats(result.compressionStats));
  }

  // Duration
  lines.push(`Duration: ${formatDuration(result.durationMs)}`);

  // WHY: Warnings go to stderr, not stdout - Unix convention
  // Warnings are NOT included in primary content, extracted to warnings field

  return {
    primary: lines.join('\n'),
    warnings: optionalArray(result.warnings),
    metadata: {
      durationMs: result.durationMs,
      command: 'update',
    },
  };
}