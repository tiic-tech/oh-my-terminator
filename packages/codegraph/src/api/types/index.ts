/**
 * API Types: Barrel File
 *
 * WHY this file exists: Centralizes all type exports for API module.
 * Consumers import from './types/index.js' instead of individual files,
 * maintaining backward compatibility with original './types.js' imports.
 *
 * Exports from: common.ts, scope-types.ts, brief-types.ts, normalize-types.ts,
 *               impact-types.ts, layers-types.ts
 */

// ============================================================================
// Common Types (shared across modules)
// ============================================================================

export { ErrorCode } from './common.js';
export type { NodeType, EdgeType } from './common.js';

// ============================================================================
// Scope Query Types (C7)
// ============================================================================

export type {
  ComplexityLevel,
  ComplexityInfo,
  ModifiedInfo,
  ExportInfo,
  ImportInfo,
  ImportedByInfo,
  ScopeResult,
  ScopeError,
} from './scope-types.js';

// QuickBrief Types (C7)
export type {
  QuickBriefResult,
  QuickBriefError,
} from './brief-types.js';

// Normalized Target Types (Internal)
export type {
  TargetType,
  NormalizedTarget,
} from './normalize-types.js';

// ============================================================================
// Impact Analysis Types (C8)
// ============================================================================

export type {
  AffectedFile,
  ImpactResult,
  ImpactError,
  ImpactOptions,
} from './impact-types.js';

// ============================================================================
// Architecture Layers Types (C8)
// ============================================================================

export type {
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
} from './layers-types.js';

export { LAYER_ROLE_NAMES } from './layers-types.js';