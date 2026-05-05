/**
 * Layers output formatters for CLI commands
 *
 * WHY: Separated formatters for layers command enable:
 * - JSON: Programmatic consumption by other tools
 * - Text: Human-readable output for developers
 *
 * @see Section 4 tasks 4.3-4.4
 */

import type { LayersResult, LayersError } from '../../api/types/index.js';

// ============================================================================
// JSON Formatters
// ============================================================================

/**
 * Format LayersResult as compact JSON
 *
 * @param result - Layers analysis result from CLI layers command
 * @returns JSON string with minimal whitespace
 */
export function formatLayersJson(result: LayersResult): string {
  return JSON.stringify(result);
}

/**
 * Format LayersError as compact JSON
 *
 * @param error - Layers error result from CLI layers command
 * @returns JSON string with minimal whitespace
 */
export function formatLayersErrorJson(error: LayersError): string {
  return JSON.stringify(error);
}

// ============================================================================
// Text Formatters
// ============================================================================

/**
 * Format LayersResult as human-readable text
 *
 * @param result - Layers analysis result from CLI layers command
 * @returns Multiline formatted string
 */
export function formatLayersText(result: LayersResult): string {
  const lines: string[] = [];

  // Header
  lines.push('Architecture Layers');
  lines.push('');

  // Layers
  if (result.layers.length > 0) {
    for (const layer of result.layers) {
      lines.push(`Layer ${layer.layer}: ${layer.role}`);
      for (const group of layer.groups) {
        lines.push(`  - ${group.name} (${group.fileCount} files)`);
      }
      lines.push('');
    }
  } else {
    lines.push('No layers detected');
    lines.push('');
  }

  // Violations
  if (result.violations.length > 0) {
    lines.push('Violations:');
    for (const violation of result.violations) {
      lines.push(`  - ${violation.fromGroup} → ${violation.toGroup} (${violation.severity})`);
      lines.push(`    Count: ${violation.count}, Gap: ${violation.layerGap}`);
      if (violation.suggestion) {
        lines.push(`    Suggestion: ${violation.suggestion}`);
      }
    }
    lines.push('');
  } else {
    lines.push('Violations: none');
    lines.push('');
  }

  // Health Score
  lines.push(`Health Score: ${result.healthScore}/100`);
  lines.push('');

  // Groups summary
  if (result.groups.length > 0) {
    lines.push('Groups:');
    for (const group of result.groups) {
      lines.push(`  - ${group.name}: Layer ${group.assignedLayer}, Net Score: ${group.netScore}`);
    }
    lines.push('');
  }

  // Duration
  lines.push(`Duration: ${formatDuration(result.durationMs)}`);
  lines.push('');

  // Warnings (if any)
  if (result.warnings && result.warnings.length > 0) {
    lines.push('Warnings:');
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push('');
  }

  // Next suggested (if any)
  if (result.nextSuggested && result.nextSuggested.length > 0) {
    lines.push('Next suggested:');
    for (const suggestion of result.nextSuggested) {
      lines.push(`- ${suggestion}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format LayersError as human-readable error text
 *
 * @param error - Layers error result from CLI layers command
 * @returns Error message string
 */
export function formatLayersErrorText(error: LayersError): string {
  const lines: string[] = [];

  lines.push(`Error: ${error.error.message}`);
  lines.push(`Code: ${error.error.code}`);

  if (error.error.suggestion) {
    lines.push(`Suggestion: ${error.error.suggestion}`);
  }

  lines.push(`Duration: ${formatDuration(error.durationMs)}`);

  return lines.join('\n');
}

// ============================================================================
// Helper Functions
// ============================================================================

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