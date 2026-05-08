/**
 * C8: Architecture Layers - Severity and Suggestions
 *
 * WHY: calculateSeverity and generateViolationSuggestion are pure utility functions.
 * Kept together because they share the layerGap-based logic pattern.
 *
 * Both functions are small (~15 lines each) but form a cohesive unit.
 */

import type { ViolationSeverity } from '../../types/index.js';

/**
 * Calculate violation severity from layerGap
 *
 * C8-5: minor=-5, moderate=-10, critical=-15.
 */
export function calculateSeverity(layerGap: number): ViolationSeverity {
  if (layerGap >= 3) {
    return 'critical';
  }
  if (layerGap === 2) {
    return 'moderate';
  }
  return 'minor';
}

/**
 * Generate violation remediation suggestion
 */
export function generateViolationSuggestion(
  fromGroup: string,
  toGroup: string,
  layerGap: number
): string {
  if (layerGap >= 3) {
    return `Critical violation: ${fromGroup} (lower layer) imports ${toGroup} (higher layer). Consider restructuring architecture`;
  }
  if (layerGap === 2) {
    return `Move shared logic from ${toGroup} to ${fromGroup}, or create a shared middle layer`;
  }
  return `Consider moving the importing file to ${toGroup} directory`;
}