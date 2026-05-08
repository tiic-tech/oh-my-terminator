/**
 * @fileoverview Public exports for baseline loading module
 *
 * WHY: Re-exports from split files and provides main loadBaseline function.
 * Maintains backward compatibility with original baseline.ts exports.
 */

// Re-export from validation module
export {
  validateBaselineStructure,
  validateCompressedBaselineStructure,
  verifyDataIntegrity,
} from './validation.js';

// Re-export from failure handlers module
export { handleFailure } from './failure-handlers.js';

// Re-export from action execution module
export {
  executeActionWithFallback,
  handleMigrationNotAvailable,
} from './action-execution.js';

// Import for loadBaseline implementation
import { getBaselinePath } from '../paths.js';
import { readBaselineFile } from './file-helpers.js';
import { validateAndCheckIntegrity, handleCompatibilityAndAction } from './action-execution.js';
import type { LoadBaselineOptions, LoadBaselineResult } from '../types/index.js';

// ============================================================================
// Main Loading Function
// ============================================================================

/**
 * Load baseline with full validation and compatibility checking
 *
 * WHY: Multi-step loading ensures baseline is valid and compatible:
 * 1. File reading and JSON parsing (readBaselineFile)
 * 2. Structure + integrity validation (validateAndCheckIntegrity)
 * 3. Compatibility check + action execution (handleCompatibilityAndAction)
 *
 * Handles rebuild scenarios: When file_not_found or corrupted_data triggers
 * auto-rebuild, the result comes from earlier steps with `graph` already
 * populated, bypassing remaining validation steps.
 *
 * @param cwd - Project working directory
 * @param options - Load options (rebuildHandler, strict, actionConfig)
 * @returns Load result with graph or failure info
 */
export async function loadBaseline(
  cwd: string,
  options?: LoadBaselineOptions
): Promise<LoadBaselineResult> {
  const baselinePath = getBaselinePath(cwd);

  // Step 1: Read and parse baseline file
  const readResult = await readBaselineFile(baselinePath, cwd, options);

  // Check if rebuild was already executed (file_not_found triggers rebuild)
  // WHY: handleFailure for 'rebuild' strategy returns { success: true, graph, executedAction }
  // This doesn't have 'data' field - validation steps should be skipped
  if (readResult.success && 'graph' in readResult) {
    return readResult;
  }

  // Return early for non-rebuild failures
  if (!readResult.success) {
    return readResult;
  }

  // TypeScript narrowing: readResult.success is true, so readResult has 'data' property
  const parsedData = (readResult as { success: true; data: unknown }).data;

  // Step 2: Validate structure and verify integrity
  const validationResult = await validateAndCheckIntegrity(parsedData, cwd, options);

  // Check if rebuild was already executed (corrupted_data triggers rebuild)
  // WHY: handleFailure for 'rebuild' strategy returns { success: true, graph, executedAction }
  if (validationResult.success && 'graph' in validationResult) {
    return validationResult;
  }

  // Return early for non-rebuild validation failures
  if (!validationResult.success) {
    return validationResult;
  }

  // TypeScript narrowing: validationResult.success is true, so validationResult has 'baseline' property
  const baseline = (validationResult as { success: true; baseline: import('../types/index.js').Baseline }).baseline;

  // Step 3: Check compatibility and execute action
  return handleCompatibilityAndAction(baseline, cwd, options);
}