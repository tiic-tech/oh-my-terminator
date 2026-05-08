/**
 * Scope output formatters for CLI commands
 *
 * WHY: Separated formatters for scope command enable:
 * - JSON: Programmatic consumption by other tools
 * - Text: Human-readable output for developers
 *
 * CHANGE: Formatters return OutputResult instead of writing to stream.
 * WHY: Separation of concerns - formatter produces, command routes.
 *
 * @see fix-e2e-report-all-issues tasks 2.3-2.4
 */

import type { ScopeResult, ScopeError } from '../../api/types/index.js';
import type { OutputResult } from './types.js';
import { formatDuration, optionalArray } from './format-utils.js';

// ============================================================================
// JSON Formatters
// ============================================================================

/**
 * Format ScopeResult as OutputResult with JSON content
 *
 * @param result - Scope query result from CLI scope command
 * @returns OutputResult with JSON primary content and warnings extracted
 */
export function formatScopeJson(result: ScopeResult): OutputResult {
  return {
    primary: JSON.stringify(result),
    warnings: optionalArray(result.warnings),
    metadata: {
      durationMs: result.durationMs,
      command: 'scope',
    },
  };
}

/**
 * Format ScopeError as OutputResult with JSON error content
 *
 * @param error - Scope error result from CLI scope command
 * @returns OutputResult with JSON error in primary and error message in errors field
 */
export function formatScopeErrorJson(error: ScopeError): OutputResult {
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
 * Format ScopeResult as OutputResult with human-readable text
 *
 * @param result - Scope query result from CLI scope command
 * @returns OutputResult with text primary content and warnings extracted
 */
export function formatScopeText(result: ScopeResult): OutputResult {
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

  // WHY: Warnings go to stderr, not stdout - Unix convention
  // Warnings are NOT included in primary content, extracted to warnings field

  // Next suggested (if any)
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
      command: 'scope',
    },
  };
}

/**
 * Format ScopeError as OutputResult with human-readable error text
 *
 * @param error - Scope error result from CLI scope command
 * @returns OutputResult with error text in primary and error message in errors field
 */
export function formatScopeErrorText(error: ScopeError): OutputResult {
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