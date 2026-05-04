/**
 * @fileoverview Public exports for baseline loading module
 *
 * WHY: Re-exports from split files and provides main loadBaseline function.
 * Maintains backward compatibility with original baseline.ts exports.
 */

// Re-export from validation module
export {
  validateBaselineStructure,
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
import type { LoadBaselineOptions, LoadBaselineResult } from '../types.js';

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
  if (!readResult.success) {
    return readResult;
  }

  // Step 2: Validate structure and verify integrity
  const validationResult = validateAndCheckIntegrity(readResult.data, cwd, options);
  if (!validationResult.success) {
    return validationResult;
  }

  // Step 3: Check compatibility and execute action
  return handleCompatibilityAndAction(validationResult.baseline, cwd, options);
}