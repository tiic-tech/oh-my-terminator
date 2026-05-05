/**
 * Scope output formatters for CLI commands
 *
 * WHY: Separated formatters for scope command enable:
 * - JSON: Programmatic consumption by other tools
 * - Text: Human-readable output for developers
 *
 * @see fix-e2e-report-all-issues tasks 2.3-2.4
 */

import type { ScopeResult, ScopeError } from '../../api/types/index.js';

// ============================================================================
// JSON Formatters
// ============================================================================

/**
 * Format ScopeResult as compact JSON
 *
 * @param result - Scope query result from CLI scope command
 * @returns JSON string with minimal whitespace
 */
export function formatScopeJson(result: ScopeResult): string {
  return JSON.stringify(result);
}

/**
 * Format ScopeError as compact JSON
 *
 * @param error - Scope error result from CLI scope command
 * @returns JSON string with minimal whitespace
 */
export function formatScopeErrorJson(error: ScopeError): string {
  return JSON.stringify(error);
}

// ============================================================================
// Text Formatters
// ============================================================================

/**
 * Format ScopeResult as human-readable text
 *
 * @param result - Scope query result from CLI scope command
 * @returns Multiline formatted string
 */
export function formatScopeText(result: ScopeResult): string {
  const lines: string[] = [];

  // Header
  lines.push('Scope result');
  lines.push('');

  // Target
  lines.push(`Target: ${result.target}`);

  // Exports
  if (result.exports.length > 0) {
    lines.push('');
    lines.push('Exports:');
    for (const exp of result.exports) {
      lines.push(`- ${exp.kind}: ${exp.name}`);
    }
  } else {
    lines.push('');
    lines.push('Exports: none');
  }

  // Imports
  if (result.imports.length > 0) {
    lines.push('');
    lines.push('Imports:');
    for (const imp of result.imports) {
      const specifiers = imp.specifiers.length > 0
        ? ` (${imp.specifiers.join(', ')})`
        : '';
      lines.push(`- ${imp.from}${specifiers}`);
    }
  } else {
    lines.push('');
    lines.push('Imports: none');
  }

  // Imported By
  if (result.importedBy.length > 0) {
    lines.push('');
    lines.push('Imported by:');
    for (const ib of result.importedBy) {
      const specifiers = ib.specifiers.length > 0
        ? ` (${ib.specifiers.join(', ')})`
        : '';
      lines.push(`- ${ib.file}${specifiers}`);
    }
  } else {
    lines.push('');
    lines.push('Imported by: none');
  }

  // Test file
  lines.push('');
  if (result.testFile) {
    lines.push(`Test file: ${result.testFile}`);
  } else {
    lines.push('Test file: No test file');
  }

  // Complexity
  lines.push('');
  lines.push(`Complexity: ${result.complexity.level} (${result.complexity.value})`);

  // Last modified
  if (result.lastModified.relativeTime) {
    lines.push(`Last modified: ${result.lastModified.relativeTime}`);
  } else if (result.lastModified.commit) {
    lines.push(`Last modified: commit ${result.lastModified.commit}`);
  }

  // Metadata
  lines.push('');
  lines.push(`Has test: ${result.metadata.hasTest}`);
  lines.push(`Deprecated: ${result.metadata.deprecated}`);

  // Duration
  lines.push('');
  lines.push(`Duration: ${formatDuration(result.durationMs)}`);

  // Warnings (if any)
  if (result.warnings && result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  // Next suggested (if any)
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
 * Format ScopeError as human-readable error text
 *
 * @param error - Scope error result from CLI scope command
 * @returns Error message string
 */
export function formatScopeErrorText(error: ScopeError): string {
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