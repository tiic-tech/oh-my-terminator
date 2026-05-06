/**
 * C8: Architecture Layers - Depth Presets Configuration
 *
 * Defines scale-based threshold presets for layer depth inference.
 * Larger projects use more conservative (lower) thresholds to limit recursion depth.
 */

/**
 * Configuration for a depth preset tier.
 */
export interface DepthPreset {
  /** Maximum file count for this tier */
  maxFiles: number;
  /** Layer threshold for this tier */
  threshold: number;
}

/**
 * Depth presets by scale tier.
 *
 * - SMALL:     50 files max, threshold 5 (aggressive depth)
 * - MEDIUM:    200 files max, threshold 3 (balanced)
 * - LARGE:     500 files max, threshold 2 (conservative)
 * - ENTERPRISE: unlimited files, threshold 1 (most conservative)
 */
export const DEPTH_PRESETS: Record<string, DepthPreset> = {
  SMALL: { maxFiles: 50, threshold: 5 },
  MEDIUM: { maxFiles: 200, threshold: 3 },
  LARGE: { maxFiles: 500, threshold: 2 },
  ENTERPRISE: { maxFiles: Infinity, threshold: 1 },
};

/**
 * Preset tiers in iteration order.
 * Iterates from smallest to largest scale.
 */
export const PRESET_ORDER = ['SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'] as const;

/**
 * Get the appropriate layer threshold for a project scale.
 *
 * Iterates presets in order (SMALL → MEDIUM → LARGE → ENTERPRISE)
 * and returns the threshold of the first preset where fileCount <= maxFiles.
 *
 * @param fileCount - Number of files in the project
 * @returns Layer threshold for the project scale
 */
export function getThresholdForScale(fileCount: number): number {
  for (const tier of PRESET_ORDER) {
    const preset = DEPTH_PRESETS[tier];
    if (fileCount <= preset.maxFiles) {
      return preset.threshold;
    }
  }
  // Default: ENTERPRISE threshold (most conservative)
  return DEPTH_PRESETS.ENTERPRISE.threshold;
}