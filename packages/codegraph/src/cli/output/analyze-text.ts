/**
 * Analyze text formatter for CLI commands
 *
 * WHY: Human-readable text output for analyze command.
 * Uses structured layout for easy scanning by developers.
 */

import type { AnalyzeResult } from '../../types.js';
import type { OutputResult } from './types.js';
import { formatDuration, formatCompressionStats, optionalArray } from './format-utils.js';

/**
 * Format AnalyzeResult as OutputResult with human-readable text
 *
 * @param result - Analysis result from CLI analyze command
 * @returns OutputResult with text primary content and warnings extracted to stderr field
 */
export function formatAnalyzeText(result: AnalyzeResult): OutputResult {
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

  // Compression stats (if present - 6.8)
  if (result.compressionStats) {
    lines.push(formatCompressionStats(result.compressionStats));
  }

  // Duration
  lines.push(`Duration: ${formatDuration(result.durationMs)}`);

  // WHY: Warnings go to stderr, not stdout - Unix convention
  // Warnings are NOT included in primary content, extracted to warnings field

  // Next suggested (if any)
  if (result.nextSuggested.length > 0) {
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
      command: 'analyze',
    },
  };
}