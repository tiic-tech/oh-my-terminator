/**
 * @fileoverview Failure handlers for baseline loading scenarios
 *
 * WHY: Each failure scenario has specific recovery strategy:
 * - file_not_found: Auto rebuild (first run)
 * - parse_error: Return failure, user intervention
 * - invalid_structure: Rebuild or strict failure
 * - corrupted_data: Auto rebuild
 * - schema_incompatible: Use compatResult to decide
 * - permission_error: Return failure
 */

import type {
  LoadBaselineOptions,
  LoadBaselineResult,
  LoadFailureReason,
} from '../types.js';

// ============================================================================
// Strategy Definitions
// ============================================================================

/**
 * Failure handling strategies
 *
 * WHY: Categorizes failure scenarios into recovery patterns:
 * - 'rebuild': Always auto-rebuild (file_not_found, corrupted_data)
 * - 'fail': Always return failure (parse_error, permission_error)
 * - 'strict_fail': Fail in strict mode, else rebuild (invalid_structure)
 * - 'forced_action': Use forceAction if provided, else fail (schema_incompatible)
 */
type FailureStrategy = 'rebuild' | 'fail' | 'strict_fail' | 'forced_action';

/**
 * Strategy mapping for each failure reason
 *
 * WHY: Centralizes strategy decisions for easy maintenance.
 * Each failure reason has a known recovery pattern.
 */
const FAILURE_STRATEGIES: Record<LoadFailureReason, FailureStrategy> = {
  file_not_found: 'rebuild',
  parse_error: 'fail',
  invalid_structure: 'strict_fail',
  corrupted_data: 'rebuild',
  schema_incompatible: 'forced_action',
  permission_error: 'fail',
};

// ============================================================================
// Core Operations
// ============================================================================

/**
 * Execute rebuild operation with error handling
 *
 * WHY: Common pattern for failure scenarios that auto-rebuild.
 * Centralizes rebuild logic to reduce code duplication.
 *
 * @param cwd - Project working directory
 * @param options - Load options with rebuildHandler
 * @param reason - Failure reason for error reporting
 * @returns Load result (success with rebuild, or failure)
 */
async function executeRebuild(
  cwd: string,
  options: LoadBaselineOptions | undefined,
  reason: LoadFailureReason
): Promise<LoadBaselineResult> {
  if (!options?.rebuildHandler) {
    return {
      success: false,
      failure: { reason, details: new Error('Rebuild handler not provided') },
    };
  }

  try {
    const graph = await options.rebuildHandler(cwd);
    return {
      success: true,
      graph,
      executedAction: 'rebuild',
      migrated: false,
    };
  } catch (e) {
    return {
      success: false,
      failure: { reason, details: e },
    };
  }
}

/**
 * Execute forced action for schema incompatibility
 *
 * WHY: Allows bypassing compatibility check with explicit action override.
 * Used when user explicitly chooses action (migrate/rebuild).
 *
 * @param cwd - Project working directory
 * @param options - Load options with actionConfig and rebuildHandler
 * @returns Load result from executed action
 */
async function executeForcedAction(
  cwd: string,
  options: LoadBaselineOptions
): Promise<LoadBaselineResult> {
  try {
    // Import executeAction dynamically to avoid circular dependency
    const { executeAction } = await import('../compatibility.js');
    const actionResult = await executeAction(
      options.actionConfig!.forceAction!,
      null,
      cwd,
      { ...options.actionConfig, rebuildHandler: options.rebuildHandler }
    );
    return {
      success: true,
      graph: actionResult.graph,
      executedAction: actionResult.action,
      migrated: actionResult.migrated,
    };
  } catch (e) {
    return {
      success: false,
      failure: { reason: 'schema_incompatible', details: e },
    };
  }
}

/**
 * Create a failure result
 *
 * WHY: Simple helper for 'fail' strategy cases.
 *
 * @param reason - Failure reason
 * @param details - Failure details
 * @returns Load result with failure
 */
function createFailureResult(
  reason: LoadFailureReason,
  details?: unknown
): LoadBaselineResult {
  return {
    success: false,
    failure: { reason, details },
  };
}

// ============================================================================
// Strategy Application
// ============================================================================

/**
 * Apply failure handling strategy
 *
 * WHY: Unified logic based on strategy type reduces code duplication.
 * Each strategy has clear, centralized handling logic.
 *
 * @param strategy - Failure handling strategy
 * @param reason - Failure reason
 * @param cwd - Project working directory
 * @param options - Load options
 * @param details - Additional failure context
 * @returns Load result based on strategy
 */
async function applyStrategy(
  strategy: FailureStrategy,
  reason: LoadFailureReason,
  cwd: string,
  options?: LoadBaselineOptions,
  details?: unknown
): Promise<LoadBaselineResult> {
  switch (strategy) {
    case 'rebuild':
      return executeRebuild(cwd, options, reason);

    case 'fail':
      return createFailureResult(reason, details);

    case 'strict_fail':
      if (options?.strict) {
        return createFailureResult(reason, details);
      }
      return executeRebuild(cwd, options, reason);

    case 'forced_action':
      if (options?.actionConfig?.forceAction) {
        return executeForcedAction(cwd, options);
      }
      return createFailureResult(reason, details);

    default:
      return createFailureResult(reason, details);
  }
}

// ============================================================================
// Failure Handling
// ============================================================================

/**
 * Handle baseline loading failures
 *
 * WHY: Each failure scenario has specific recovery strategy:
 * - file_not_found: Auto rebuild (first run)
 * - parse_error: Return failure, user intervention
 * - invalid_structure: Rebuild or strict failure
 * - corrupted_data: Auto rebuild
 * - schema_incompatible: Use compatResult to decide
 * - permission_error: Return failure
 *
 * Dispatches based on strategy mapping for unified handling.
 *
 * @param reason - Failure reason enum
 * @param cwd - Project working directory
 * @param options - Load options (rebuildHandler, strict)
 * @param details - Additional failure context
 * @returns Load result (success with rebuild, or failure)
 */
export async function handleFailure(
  reason: LoadFailureReason,
  cwd: string,
  options?: LoadBaselineOptions,
  details?: unknown
): Promise<LoadBaselineResult> {
  // Custom handler takes precedence
  if (options?.onFailure) {
    return options.onFailure(reason, cwd, details);
  }

  // Apply strategy based on failure reason
  const strategy = FAILURE_STRATEGIES[reason];
  return applyStrategy(strategy, reason, cwd, options, details);
}