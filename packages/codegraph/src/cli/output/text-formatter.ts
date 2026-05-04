/**
 * Text output formatters for CLI commands
 *
 * WHY: Human-readable text output provides immediate feedback to developers.
 * Uses Unicode symbols for visual clarity and structured layout for scanning.
 */

import type { AnalyzeResult, UpdateResult, MigrateResult, CliError, CompressionStats } from '../../types.js';

/**
 * Format compression statistics for text output
 *
 * WHY: Shows users the benefit of compression for token budget awareness.
 *
 * @param stats - Compression statistics
 * @returns Formatted compression stats string
 */
function formatCompressionStats(stats: CompressionStats): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('Compression stats:');
  lines.push(`- Original size: ${formatBytes(stats.originalSizeBytes)}`);
  lines.push(`- Compressed size: ${formatBytes(stats.compressedSizeBytes)}`);
  lines.push(`- Savings: ${stats.savingsPercent}%`);
  return lines.join('\n');
}

/**
 * Format bytes in human-readable format
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.2KB", "500B")
 */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)}KB`;
  }
  return `${bytes}B`;
}

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

  // Compression stats (if present - 6.8)
  if (result.compressionStats) {
    lines.push(formatCompressionStats(result.compressionStats));
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

  // Compression stats (if present - 6.8)
  if (result.compressionStats) {
    lines.push(formatCompressionStats(result.compressionStats));
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

/**
 * Format MigrateResult as human-readable text
 *
 * WHY: Shows migration statistics to users for verification.
 *
 * @param result - Migration result from CLI migrate command
 * @returns Multiline formatted string
 */
export function formatMigrateText(result: MigrateResult): string {
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

  return lines.join('\n');
}