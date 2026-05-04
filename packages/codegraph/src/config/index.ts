/**
 * Configuration module public exports (Task 3.1)
 *
 * WHY: Module-level exports only public symbols.
 * Implementation details (ValidationSuccess, LoadSuccess types) are internal.
 *
 * Public API:
 * - loadCompressionConfig: Load config from project
 * - validateCompressionConfig: Validate config object
 * - DEFAULT_COMPRESSION_OPTIONS: Default values
 * - DEFAULT_COMPRESSION_CONFIG: Full default config
 *
 * @see coding-taste skill - "Module-level re-exports only public symbols"
 */

// Re-export loading function
export { loadCompressionConfig, type LoadResult } from './load-config.js';

// Re-export validation function and result types
export {
  validateCompressionConfig,
  type ValidationResult,
  type ValidationSuccess,
  type ValidationFailure,
} from './validate-config.js';

// Re-export default constants
export {
  DEFAULT_COMPRESSION_OPTIONS,
  DEFAULT_COMPRESSION_CONFIG,
} from './validate-config.js';