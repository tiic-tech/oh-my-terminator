/**
 * C8: Architecture Layers - Inference Module Entry
 *
 * Re-exports all inference functions for layers API.
 */

// Core inference
export {
  inferArchitectureLayers,
  buildGroupToLayerMap,
  buildGroupSummaries,
  type GroupScore,
} from './core.js';

// Violation detection
export { detectLayerViolations } from './violations.js';

// Health score
export { calculateLayerHealthScore } from './health.js';

// Severity and suggestions
export {
  calculateSeverity,
  generateViolationSuggestion,
} from './suggestions.js';

// Depth presets configuration
export {
  DEPTH_PRESETS,
  PRESET_ORDER,
  getThresholdForScale,
  type DepthPreset,
} from './depth-presets.js';

// Project scale detection
export {
  detectProjectScale,
  getProjectThreshold,
} from './project-scale-detector.js';