/**
 * C8: Architecture Layers - Health Score Calculation
 *
 * WHY: calculateLayerHealthScore is a self-contained responsibility.
 * Separated from inference core to keep file sizes under threshold.
 *
 * Formula: Base 100, subtract by severity weights.
 */

import type { LayerViolation } from '../../types/index.js';

/**
 * Calculate health score from violations
 *
 * C8-5 Resolution: Base 100, subtract by severity weights.
 */
export function calculateLayerHealthScore(violations: LayerViolation[]): number {
  let score = 100;

  for (const violation of violations) {
    switch (violation.severity) {
      case 'minor':
        score -= 5;
        break;
      case 'moderate':
        score -= 10;
        break;
      case 'critical':
        score -= 15;
        break;
    }
  }

  return Math.max(0, score);
}