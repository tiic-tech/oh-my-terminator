/**
 * CLI output formatters
 *
 * Exports JSON and text formatters for CLI command results.
 * Also exports types and router for stream routing.
 */

// JSON formatters
export { formatAnalyzeJson, formatUpdateJson, formatErrorJson } from './json-formatter.js';
export { formatMigrateJson } from './json-formatter.js';

// Text formatters (split by command for maintainability)
export { formatAnalyzeText } from './analyze-text.js';
export { formatUpdateText } from './update-text.js';
export { formatErrorText } from './error-text.js';
export { formatMigrateText } from './migrate-text.js';

// Types and router
export { OutputMode, type OutputResult, type ModeOptions } from './types.js';
export { routeOutput, detectMode, createOutput } from './router.js';

// Shared utilities (for other formatters)
export { formatDuration, formatBytes, formatCompressionStats, optionalArray } from './format-utils.js';