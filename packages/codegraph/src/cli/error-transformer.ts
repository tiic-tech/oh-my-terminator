/**
 * Error Transformer for CLI UX Improvement (Barrel File)
 *
 * WHY: Re-export from decomposed modules for backward compatibility.
 * Original file was 229 lines with multiple concerns - now split into focused modules.
 *
 * Module Structure:
 * - patterns.ts: CAC_ERROR_PATTERNS regex constants
 * - helpers.ts: getAvailableCommands, getAvailableFlags
 * - suggestions.ts: findSimilarCommand, findSimilarFlag
 * - transform.ts: transformCACError, createUnknownCommandError, createTargetNotFoundError, isCACError
 */

// Re-export patterns (for direct use if needed)
export { CAC_ERROR_PATTERNS } from './error/patterns.js';

// Re-export helpers
export { getAvailableCommands, getAvailableFlags } from './error/helpers.js';

// Re-export suggestions (for direct use if needed)
export { findSimilarCommand, findSimilarFlag } from './error/suggestions.js';

// Re-export main transformation functions (primary public API)
export {
  transformCACError,
  createUnknownCommandError,
  createTargetNotFoundError,
  isCACError,
} from './error/transform.js';