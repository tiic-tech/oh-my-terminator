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
  type InferenceContext,
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

// Source root discovery (Phase 1: Source Root Discovery)
export {
  SIGNAL_WEIGHTS,
  EXCLUDED_DIRECTORIES,
  detectSourceRoot,
  type SourceRootResult,
  type SourceRootCandidate,
} from './source-root.js';

// Dependency score calculation (Phase 2: Dependency Score Calculation)
export {
  calculateDependencyScore,
  type DependencyScoreResult,
} from './dependency-score.js';

// Cycle detection (Phase 2: Dependency Score Calculation)
export {
  detectCycles,
  calculateCyclePenalty,
  type CycleInfo,
} from './cycle-detection.js';

// Import analysis (Phase 2: Dependency Score Calculation)
export {
  countTypeOnlyImports,
  countDynamicImports,
} from './import-analysis.js';

// Path utilities (shared helper for group extraction)
export { extractGroupFromPath } from './path-utils.js';

// Confidence calculation (Phase 4: Layer Assignment with Confidence)
export {
  calculateConfidence,
  calculateGroupVariance,
  countAmbiguousPairs,
  CONFIDENCE_CONSTANTS,
  type ConfidenceInputs,
} from './confidence.js';

// Fallback suggestions (Phase 5: Fallback & Suggestions)
export {
  generateSuggestions,
  SUGGESTION_CONSTANTS,
  type Suggestion,
  type SuggestionType,
  type SuggestionContext,
} from './fallback.js';

// Naming rules for layer role inference
export {
  DEFAULT_NAMING_RULES,
  type NamingRule,
} from './naming-rules.js';

// Layer role name inference (Decision 5 & 6)
// Types and matching logic are in separate files for single responsibility
export {
  inferLayerRoleNames,
  type LayerRoleResult,
  type MatchedRuleInfo,
} from './layer-naming.js';

// Pattern matching helpers (exported for testing)
export {
  isAnchoredPattern,
  matchGroupToRule,
} from './pattern-matching.js';