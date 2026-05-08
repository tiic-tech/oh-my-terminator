/**
 * Shared formatting utilities for CLI output
 *
 * WHY: Single source of truth for common formatting functions.
 * Used by all formatters to ensure consistent output style.
 *
 * Functions:
 * - formatBytes: Human-readable byte sizes
 * - formatDuration: Human-readable time durations
 * - formatCompressionStats: Compression statistics display
 * - optionalArray: Return array only if non-empty
 */

import type { CompressionStats } from '../../types.js';

/**
 * Format bytes in human-readable format
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.2KB", "500B")
 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)}KB`;
  }
  return `${bytes}B`;
}

/**
 * Format duration in milliseconds to human-readable string
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "2.3s", "450ms")
 */
export function formatDuration(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
}

/**
 * Format compression statistics for text output
 *
 * WHY: Shows users the benefit of compression for token budget awareness.
 *
 * @param stats - Compression statistics
 * @returns Formatted compression stats string
 */
export function formatCompressionStats(stats: CompressionStats): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('Compression stats:');
  lines.push(`- Original size: ${formatBytes(stats.originalSizeBytes)}`);
  lines.push(`- Compressed size: ${formatBytes(stats.compressedSizeBytes)}`);
  lines.push(`- Savings: ${stats.savingsPercent}%`);
  return lines.join('\n');
}

/**
 * Helper to return array only if non-empty, otherwise undefined
 *
 * WHY: Reduces duplication for optional array fields.
 * Empty arrays are semantically equivalent to undefined.
 *
 * @param arr - Array to check
 * @returns Array if non-empty, undefined otherwise
 */
export function optionalArray<T>(arr: T[] | undefined): T[] | undefined {
  return arr && arr.length > 0 ? arr : undefined;
}