/**
 * C8: Impact Analysis - Output Formatting
 *
 * Generates Agent-friendly Markdown output.
 */

import type { AffectedFile } from '../types.js';

/**
 * Format impact output as Markdown
 */
export function formatImpactOutput(
  targets: string[],
  affectedFiles: AffectedFile[],
  directCount: number,
  indirectCount: number
): string {
  const lines: string[] = [];

  lines.push('## Impact Analysis');
  lines.push('');

  // Target files
  lines.push('### Target Files');
  for (const target of targets) {
    const displayPath = target.replace('FILE:', '').replace('MODULE:', '');
    lines.push(`- ${displayPath}`);
  }
  lines.push('');

  // Direct dependents
  if (directCount > 0) {
    lines.push(`### Direct Dependents (${directCount} files)`);
    const directFiles = affectedFiles.filter(f => f.distance === 1);
    for (const file of directFiles) {
      lines.push(`- ${file.path}`);
    }
    lines.push('');
  } else {
    lines.push('### Direct Dependents');
    lines.push('No direct dependents found.');
    lines.push('');
  }

  // Indirect dependents
  if (indirectCount > 0) {
    lines.push(`### Indirect Dependents (${indirectCount} files)`);
    const indirectFiles = affectedFiles.filter(f => f.distance > 1);
    for (const file of indirectFiles) {
      // C8-4: Display via as comma-separated in text output
      const viaDisplay = file.via.length > 0 ? ` (via ${file.via.join(', ')})` : '';
      lines.push(`- ${file.path}${viaDisplay}`);
    }
    lines.push('');
  }

  // Summary
  lines.push('### Summary');
  const total = directCount + indirectCount;
  lines.push(`- Total affected: ${total} files`);
  lines.push(`- Direct: ${directCount}, Indirect: ${indirectCount}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Calculate blast radius classification
 *
 * C8-8 Resolution: ≤3=low, ≤10=medium, >10=high
 */
export function calculateBlastRadius(total: number): 'low' | 'medium' | 'high' | 'unknown' {
  if (total === 0) {
    return 'unknown';
  }
  if (total <= 3) {
    return 'low'; // C8-8: 3归属于low
  }
  if (total <= 10) {
    return 'medium'; // C8-8: 10归属于medium
  }
  return 'high';
}

/**
 * Generate nextSuggested commands
 *
 * C8-9 Resolution: Suggest viewing top dependent and layers.
 */
export function generateNextSuggested(affectedFiles: AffectedFile[]): string[] {
  const suggestions: string[] = [];

  if (affectedFiles.length > 0) {
    // C8-9: topDependent is first affected file (nearest dependent)
    const topDependent = affectedFiles[0].path;
    suggestions.push(`codegraph scope FILE:${topDependent}`);
  }

  suggestions.push('codegraph layers');

  return suggestions;
}

/**
 * Generate warnings for edge cases
 */
export function generateWarnings(
  affectedFiles: AffectedFile[]
): string[] {
  const warnings: string[] = [];

  if (affectedFiles.length === 0) {
    warnings.push('No dependents found - file may be isolated or entry point');
  }

  return warnings;
}