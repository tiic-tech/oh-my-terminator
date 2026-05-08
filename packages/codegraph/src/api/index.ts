/**
 * C7/C8: API Module Entry Point
 *
 * Exports Scope Query, QuickBrief, Impact Analysis, and Architecture Layers APIs.
 */

// C7: Scope Query Types
export type {
  ComplexityLevel,
  ComplexityInfo,
  ModifiedInfo,
  ExportInfo,
  ImportInfo,
  ImportKind,
  ImportedByInfo,
  ScopeResult,
  ScopeError,
  QuickBriefResult,
  QuickBriefError,
  TargetType,
  NormalizedTarget,
} from './types/index.js';

// C8: Impact Analysis Types
export type {
  AffectedFile,
  ImpactResult,
  ImpactError,
  ImpactOptions,
  LayerRole,
  GroupStats,
  LayerAssignment,
  ViolationSeverity,
  ViolationFilePair,
  LayerViolation,
  GroupSummary,
  LayersResult,
  LayersError,
  LayersOptions,
} from './types/index.js';

export { ErrorCode } from './types/index.js';

// C7: Scope Query Functions
export { getScope, getQuickBrief } from './scope/index.js';

// C7: Scope Internal helpers (exported for testing)
export {
  normalizeTarget,
  extractExports,
  extractImports,
  extractImportedBy,
  extractImportsWithKind,
  findTestFile,
  aggregateComplexity,
  checkDeprecated,
  countImports,
  countImportedBy,
  formatScopeOutput,
  formatQuickBriefOutput,
} from './scope/index.js';

// C8: Impact Analysis Functions
export { getImpact } from './impact/index.js';

// C8: Impact Internal helpers (exported for testing)
export {
  normalizeTargetsToFile,
  bfsDependents,
  mergeBFSResults,
  isTestFile,
  formatImpactOutput,
  calculateBlastRadius,
  generateNextSuggested,
  generateWarnings,
} from './impact/index.js';

// C8: Architecture Layers Functions
export { getArchitectureLayers } from './layers/index.js';

// C8: Layers Internal helpers (exported for testing)
export {
  groupFilesByFirstLevelDirectory,
  computeImportDirectionStats,
  getGroupNameFromFile,
  inferArchitectureLayers,
  detectLayerViolations,
  calculateLayerHealthScore,
  calculateSeverity,
  generateViolationSuggestion,
  buildGroupSummaries,
  buildGroupToLayerMap,
  formatLayersOutput,
  generateLayersWarnings,
  generateLayersNextSuggested,
  // Inference sub-modules (exported for E2E testing)
  detectSourceRoot,
  detectCycles,
  calculateCyclePenalty,
  calculateConfidence,
  generateSuggestions,
  getProjectThreshold,
  detectProjectScale,
  SIGNAL_WEIGHTS,
  EXCLUDED_DIRECTORIES,
  CONFIDENCE_CONSTANTS,
  SUGGESTION_CONSTANTS,
  type SourceRootResult,
  type SourceRootCandidate,
  type CycleInfo,
  type ConfidenceInputs,
  type Suggestion,
  type SuggestionType,
  type SuggestionContext,
} from './layers/index.js';