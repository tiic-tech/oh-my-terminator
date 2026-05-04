/**
 * @fileoverview Action execution and compatibility handling for baseline loading
 *
 * WHY: Handles compatibility check, action determination, and execution
 * including fallback when migration framework is not available.
 */

import type {
  Baseline,
  LoadBaselineOptions,
  LoadBaselineResult,
  CompatibilityResult,
} from '../types/index.js';
import { checkSchemaCompatibility, determineAction, executeAction } from '../compatibility/index.js';
import { CURRENT_SCHEMA_VERSION } from '../../version.js';
import { handleFailure } from './failure-handlers.js';
import { validateBaselineStructure, verifyDataIntegrity } from './validation.js';

// ============================================================================
// Validation Helper
// ============================================================================

/**
 * Validate baseline structure and verify data integrity
 *
 * WHY: Combines two validation phases (structure + integrity) into one helper.
 * Structure validation checks required fields; integrity checks semantic consistency.
 *
 * @param parsed - Parsed JSON data (unknown type for validation)
 * @param cwd - Project working directory (for failure handler)
 * @param options - Load options (for failure handler)
 * @returns Object with validated baseline on success, or LoadBaselineResult on failure
 */
export async function validateAndCheckIntegrity(
  parsed: unknown,
  cwd: string,
  options?: LoadBaselineOptions
): Promise<{ success: true; baseline: Baseline } | LoadBaselineResult> {
  // Step 1: Structure validation (required fields, types)
  const validationResult = validateBaselineStructure(parsed);
  if (!validationResult.valid) {
    return handleFailure('invalid_structure', cwd, options, validationResult);
  }

  const baseline = parsed as Baseline;

  // Step 2: Data integrity verification (semantic checks)
  const integrityResult = verifyDataIntegrity(baseline);
  if (!integrityResult.valid) {
    return handleFailure('corrupted_data', cwd, options, integrityResult);
  }

  return { success: true, baseline };
}

// ============================================================================
// Action Execution
// ============================================================================

/**
 * Check schema compatibility and execute determined action
 *
 * WHY: Handles compatibility check, action determination, and execution
 * including fallback when migration framework is not available.
 *
 * @param baseline - Validated baseline data
 * @param cwd - Project working directory
 * @param options - Load options (actionConfig, rebuildHandler)
 * @returns LoadBaselineResult with graph and action metadata
 */
export async function handleCompatibilityAndAction(
  baseline: Baseline,
  cwd: string,
  options?: LoadBaselineOptions
): Promise<LoadBaselineResult> {
  // Check schema compatibility
  const compatResult = checkSchemaCompatibility(baseline, CURRENT_SCHEMA_VERSION);

  // Handle incompatibility
  if (!compatResult.compatible) {
    return handleFailure('schema_incompatible', cwd, options, compatResult);
  }

  // Determine and execute action with fallback handling
  return executeActionWithFallback(baseline, compatResult, cwd, options);
}

/**
 * Execute action with migration fallback handling
 *
 * WHY: Isolates action execution logic including the fallback when
 * migration framework is not yet implemented.
 *
 * @param baseline - Validated baseline data
 * @param compatResult - Compatibility check result
 * @param cwd - Project working directory
 * @param options - Load options (actionConfig, rebuildHandler)
 * @returns LoadBaselineResult with graph and action metadata
 */
export async function executeActionWithFallback(
  baseline: Baseline,
  compatResult: CompatibilityResult,
  cwd: string,
  options?: LoadBaselineOptions
): Promise<LoadBaselineResult> {
  const action = determineAction(compatResult, options?.actionConfig);
  try {
    const actionResult = await executeAction(action, baseline, cwd, {
      ...options?.actionConfig,
      rebuildHandler: options?.rebuildHandler,
    });

    return {
      success: true,
      graph: actionResult.graph,
      baseline,
      compatibility: compatResult,
      executedAction: actionResult.action,
      migrated: actionResult.migrated,
    };
  } catch (e) {
    // Migration framework not available - fall back to rebuild
    if (e instanceof Error && e.message.includes('Migration framework not yet implemented')) {
      return handleMigrationNotAvailable(baseline, compatResult, cwd, options);
    }
    return {
      success: false,
      failure: { reason: 'schema_incompatible', details: e },
    };
  }
}

/**
 * Handle migration framework not available fallback
 *
 * WHY: When migration is required but framework is not implemented,
 * fall back to full rebuild to maintain functionality.
 *
 * @param baseline - Validated baseline data
 * @param compatResult - Compatibility check result
 * @param cwd - Project working directory
 * @param options - Load options with rebuildHandler
 * @returns LoadBaselineResult with rebuilt graph
 */
export async function handleMigrationNotAvailable(
  baseline: Baseline,
  compatResult: CompatibilityResult,
  cwd: string,
  options?: LoadBaselineOptions
): Promise<LoadBaselineResult> {
  if (options?.rebuildHandler) {
    try {
      const graph = await options.rebuildHandler(cwd);
      return {
        success: true,
        graph,
        baseline,
        compatibility: compatResult,
        executedAction: 'rebuild',
        migrated: false,
      };
    } catch (e) {
      return {
        success: false,
        failure: { reason: 'schema_incompatible', details: e },
      };
    }
  }
  return {
    success: false,
    failure: { reason: 'schema_incompatible', details: new Error('Rebuild handler not provided') },
  };
}