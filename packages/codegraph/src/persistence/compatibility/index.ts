/**
 * @fileoverview Public exports for compatibility module
 *
 * WHY: Barrel file provides clean public API for compatibility operations.
 * Consumers import from './compatibility/index.js' instead of individual files.
 *
 * Structure:
 * - check.ts → checkSchemaCompatibility
 * - action.ts → determineAction, executeAction
 * - deserialize.ts → deserializeBaselineGraph (internal, exported for action.ts)
 *
 * Originally extracted from compatibility.ts (315 lines) to comply with
 * coding-taste Rule 2 (max 150 lines per file).
 */

// Public API: Compatibility checking
export { checkSchemaCompatibility } from './check.js';

// Public API: Action handling
export { determineAction, executeAction } from './action.js';

// Internal helper (exported for use by action.ts)
export { deserializeBaselineGraph } from './deserialize.js';