/**
 * Layers output formatters for CLI commands
 *
 * WHY: Separated formatters for layers command enable:
 * - JSON: Programmatic consumption by other tools
 * - Text: Human-readable output for developers
 *
 * CHANGE: Formatters return OutputResult instead of writing to stream.
 * WHY: Separation of concerns - formatter produces, command routes.
 *
 * @see Section 4 tasks 4.3-4.4
 */

import type { LayersResult, LayersError } from '../../api/types/index.js';
import type { OutputResult } from './types.js';
import { formatDuration, optionalArray } from './format-utils.js';

// ============================================================================
// JSON Formatters
// ============================================================================

/**
 * Format LayersResult as OutputResult with JSON content
 *
 * @param result - Layers analysis result from CLI layers command
 * @returns OutputResult with JSON primary content and warnings extracted
 */
export function formatLayersJson(result: LayersResult): OutputResult {
  return {
    primary: JSON.stringify(result),
    warnings: optionalArray(result.warnings),
    metadata: {
      durationMs: result.durationMs,
      command: 'layers',
    },
  };
}

/**
 * Format LayersError as OutputResult with JSON error content
 *
 * @param error - Layers error result from CLI layers command
 * @returns OutputResult with JSON error in primary and error message in errors field
 */
export function formatLayersErrorJson(error: LayersError): OutputResult {
  return {
    primary: JSON.stringify(error),
    errors: [error.error.message],
    metadata: {
      durationMs: error.durationMs,
    },
  };
}

// ============================================================================
// Text Formatters
// ============================================================================

/**
 * Format LayersResult as OutputResult with human-readable text
 *
 * @param result - Layers analysis result from CLI layers command
 * @returns OutputResult with text primary content and warnings extracted
 */
export function formatLayersText(result: LayersResult): OutputResult {
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

  // WHY: Warnings go to stderr, not stdout - Unix convention
  // Warnings are NOT included in primary content, extracted to warnings field

  // Next suggested (if any)
  if (result.nextSuggested && result.nextSuggested.length > 0) {
    lines.push('Next suggested:');
    for (const suggestion of result.nextSuggested) {
      lines.push(`- ${suggestion}`);
    }
    lines.push('');
  }

  return {
    primary: lines.join('\n'),
    warnings: optionalArray(result.warnings),
    metadata: {
      durationMs: result.durationMs,
      command: 'layers',
    },
  };
}

/**
 * Format LayersError as OutputResult with human-readable error text
 *
 * @param error - Layers error result from CLI layers command
 * @returns OutputResult with error text in primary and error message in errors field
 */
export function formatLayersErrorText(error: LayersError): OutputResult {
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