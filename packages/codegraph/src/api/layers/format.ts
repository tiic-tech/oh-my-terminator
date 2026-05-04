/**
 * C8: Architecture Layers - Output Formatting
 *
 * Generates Agent-friendly Markdown output.
 */

import type { LayerAssignment, LayerViolation } from '../types.js';

/**
 * Format layers output as Markdown
 */
export function formatLayersOutput(
  layers: LayerAssignment[],
  violations: LayerViolation[],
  healthScore: number
): string {
  const lines: string[] = [];

  lines.push('## Architecture Layers');
  lines.push('');

  // Layer sections
  for (const layer of layers) {
    lines.push(`### Layer ${layer.layer} (${layer.role})`);

    for (const group of layer.groups) {
      const stats = `- **${group.name}**: ${group.fileCount} files, imported by ${group.importedByCount} groups`;
      lines.push(stats);
    }
    lines.push('');
  }

  // Violations section
  if (violations.length > 0) {
    lines.push(`## Layer Violations (${violations.length} detected)`);
    for (const violation of violations) {
      lines.push(`- **${violation.fromGroup} → ${violation.toGroup}**: ${violation.count} imports (${violation.severity})`);
      lines.push(`  - Suggestion: ${violation.suggestion}`);
    }
    lines.push('');
  } else {
    lines.push('## Layer Violations');
    lines.push('✓ All imports follow layer hierarchy');
    lines.push('');
  }

  // Health score
  lines.push(`## Layer Health Score: ${healthScore}/100`);
  if (violations.length > 0) {
    const penalty = 100 - healthScore;
    lines.push(`- Violation penalty: -${penalty} points (${violations.length} violations)`);
  }

  return lines.join('\n');
}

/**
 * Generate warnings for edge cases
 */
export function generateLayersWarnings(
  violations: LayerViolation[],
  layers: LayerAssignment[]
): string[] {
  const warnings: string[] = [];

  if (violations.length > 0) {
    warnings.push(`${violations.length} layer violations detected`);
  }

  // Check for single-layer project
  if (layers.length === 1) {
    warnings.push('Project has single-layer structure - no meaningful layer hierarchy');
  }

  return warnings;
}

/**
 * Generate nextSuggested commands
 */
export function generateLayersNextSuggested(
  violations: LayerViolation[]
): string[] {
  const suggestions: string[] = [];

  if (violations.length > 0) {
    // Suggest examining first violation
    const firstViolation = violations[0];
    if (firstViolation.affectedFiles.length > 0) {
      const firstFile = firstViolation.affectedFiles[0].from;
      suggestions.push(`codegraph scope FILE:${firstFile}`);
    }
  }

  return suggestions;
}