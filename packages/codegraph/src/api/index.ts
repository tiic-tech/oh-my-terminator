/**
 * C7: API Module Entry Point
 *
 * Exports Scope Query and QuickBrief APIs for Agent-friendly graph queries.
 */

// Types
export type {
  ComplexityLevel,
  ComplexityInfo,
  ModifiedInfo,
  ExportInfo,
  ImportInfo,
  ImportedByInfo,
  ScopeResult,
  ScopeError,
  QuickBriefResult,
  QuickBriefError,
  TargetType,
  NormalizedTarget,
} from './types.js';

export { ErrorCode } from './types.js';

// Functions
export { getScope, getQuickBrief } from './scope/index.js';

// Internal helpers (exported for testing)
export {
  normalizeTarget,
  extractExports,
  extractImports,
  extractImportedBy,
  findTestFile,
  aggregateComplexity,
  checkDeprecated,
  countImports,
  countImportedBy,
  formatScopeOutput,
  formatQuickBriefOutput,
} from './scope/index.js';