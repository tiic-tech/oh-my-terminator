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
import { detectBaselineFormat } from '../migrations/1.0-to-1.1.js';

// ============================================================================
// Validation Helper
// ============================================================================

/**
 * Validate baseline structure and verify data integrity
 *
 * WHY: Combines two validation phases (structure + integrity) into one helper.
 * Structure validation checks required fields; integrity checks semantic consistency.
 *
 * Format-aware: 1.1 format skips legacy integrity check (structure validation is sufficient).
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
  // Step 1: Structure validation (required fields, types) - format-aware
  const validationResult = validateBaselineStructure(parsed);
  if (!validationResult.valid) {
    return handleFailure('invalid_structure', cwd, options, validationResult);
  }

  // Step 2: Detect format to determine integrity check path
  const format = detectBaselineFormat(parsed);

  // For 1.1 (compressed) format, skip legacy integrity check
  // WHY: 1.1 format has different structure (pathTable, nodes array) - legacy check expects graph.nodes
  // Structure validation already validated the compressed format's integrity
  if (format === '1.1') {
    // Cast to Baseline for downstream compatibility
    // Note: This Baseline has 1.1 structure but will be handled by executeAction
    const baseline = parsed as Baseline;
    return { success: true, baseline };
  }

  // For 1.0/legacy format, perform legacy data integrity verification
  const baseline = parsed as Baseline;

  // Step 3: Data integrity verification (semantic checks for 1.0 format)
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