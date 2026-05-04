/**
 * @fileoverview Action determination and execution for compatibility handling
 *
 * WHY: Translates compatibility check results into actual operations:
 * - error: Throw exception
 * - rebuild: Call rebuildHandler
 * - migrate: Call migration framework
 * - proceed: Return baseline graph directly
 *
 * Originally extracted from compatibility.ts (315 lines) to comply with
 * coding-taste Rule 2 (max 150 lines per file).
 */

import type {
  CompatibilityResult,
  CompatibilityAction,
  ActionConfig,
  ActionResult,
  Baseline,
  RebuildHandler,
} from '../types/index.js';
import { IncompatibleBaselineError } from '../types/index.js';
import { migrateBaseline } from '../migrations/index.js';
import { deserializeBaselineGraph } from './deserialize.js';

/**
 * Determine action based on compatibility result and configuration
 *
 * WHY: Allows user configuration to override default strategy matrix.
 * - forceAction: Override default behavior
 * - autoMigrate: Enable automatic minor version migration
 * - allowRebuild: Enable automatic rebuild without confirmation
 *
 * @param result - Compatibility check result
 * @param config - Optional configuration overrides
 * @returns Final action to execute
 */
export function determineAction(
  result: CompatibilityResult,
  config?: ActionConfig
): CompatibilityAction {
  // User override takes precedence
  if (config?.forceAction) {
    return config.forceAction;
  }

  // Default strategy matrix
  switch (result.reason) {
    case 'legacy_baseline':
      return 'rebuild';

    case 'major_version_mismatch':
      // Already determined in checkSchemaCompatibility based on version comparison
      return result.action;

    case 'minor_version_old':
      // Optional migration based on config
      return config?.autoMigrate ? 'migrate' : 'proceed';

    case 'patch_version_old':
      return 'proceed';

    case 'version_match':
      return 'proceed';

    default:
      // Safety default for unknown cases
      return 'error';
  }
}

/**
 * Execute compatibility action
 *
 * WHY: Translates action decision into actual operation:
 * - error: Throw exception
 * - rebuild: Call rebuildHandler (or analyzeFull)
 * - migrate: Call migration framework
 * - proceed: Return baseline graph directly
 *
 * @param action - Action to execute
 * @param baseline - Loaded baseline (may be null for rebuild)
 * @param cwd - Project working directory
 * @param config - Optional configuration with rebuildHandler
 * @returns Action result with graph and metadata
 */
export async function executeAction(
  action: CompatibilityAction,
  baseline: Baseline | null,
  cwd: string,
  config?: ActionConfig & { rebuildHandler?: RebuildHandler }
): Promise<ActionResult> {
  switch (action) {
    case 'error':
      throw new IncompatibleBaselineError(
        'Baseline schema incompatible with current version. ' +
        'See documentation for recovery options.'
      );

    case 'rebuild':
      // Use provided rebuildHandler or throw if not available
      if (!config?.rebuildHandler) {
        throw new Error('Rebuild handler not provided - cannot rebuild baseline');
      }
      const graph = await config.rebuildHandler(cwd);
      return {
        graph,
        action: 'rebuild',
        migrated: false,
      };

    case 'migrate':
      if (!baseline) {
        throw new Error('Cannot migrate: no baseline loaded');
      }
      // Execute migration framework to transform baseline to current version
      const migratedBaseline = migrateBaseline(baseline, cwd);
      // Deserialize migrated graph into CodeGraph instance
      const migratedGraph = deserializeBaselineGraph(migratedBaseline.graph);
      return {
        graph: migratedGraph,
        action: 'migrate',
        migrated: true,
      };

    case 'proceed':
      if (!baseline) {
        throw new Error('Cannot proceed: no baseline loaded');
      }
      // Deserialize baseline.graph with structure validation
      const proceedGraph = deserializeBaselineGraph(baseline.graph);
      return {
        graph: proceedGraph,
        action: 'proceed',
        migrated: false,
      };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}