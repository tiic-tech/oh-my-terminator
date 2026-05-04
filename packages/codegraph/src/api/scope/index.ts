/**
 * C7: Scope Query API Entry
 *
 * Re-exports all scope-related functions for external use.
 */

// Main API functions
export { getScope } from './query.js';
export { getQuickBrief } from './brief.js';

// Internal helpers (exported for testing)
export { normalizeTarget } from './normalize.js';
export { extractExports, extractImports, extractImportedBy } from './extract.js';
export { findTestFile, aggregateComplexity, checkDeprecated } from './metadata.js';
export { countImports, countImportedBy } from './count.js';
export { formatScopeOutput, formatQuickBriefOutput } from './format/index.js';
export { createScopeError, createBriefError } from './errors.js';
export { getScopeForExternal } from './external.js';