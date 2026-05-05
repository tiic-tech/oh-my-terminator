/**
 * @fileoverview Action determination and execution for compatibility handling
 *
 * WHY: Translates compatibility check results into actual operations:
 * - error: Throw exception
 * - rebuild: Call rebuildHandler
 * - migrate: Call migration framework
 * - proceed: Return baseline graph directly
 *
 * Format-aware: Handles both 1.0 (legacy) and 1.1 (compressed) baseline formats.
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
import type { CompressedBaseline } from '../../types.js';
import { IncompatibleBaselineError } from '../types/index.js';
import { migrateBaseline } from '../migrations/index.js';
import { deserializeBaselineGraph } from './deserialize.js';
import { detectBaselineFormat } from '../migrations/1.0-to-1.1.js';
import { deserializeCompressed } from '../compression/serializer.js';

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
 * Execute compatibility action with format-aware deserialization
 *
 * WHY: Translates action decision into actual operation:
 * - error: Throw exception
 * - rebuild: Call rebuildHandler (or analyzeFull)
 * - migrate: Call migration framework
 * - proceed: Return baseline graph directly
 *
 * Format handling:
 * - 1.1 (compressed): Use deserializeCompressed directly on CompressedBaseline
 * - 1.0 (legacy): Use deserializeBaselineGraph on baseline.graph
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
      // Deserialize migrated graph with format detection
      const migratedGraph = deserializeBaselineWithFormatDetection(migratedBaseline);
      return {
        graph: migratedGraph,
        action: 'migrate',
        migrated: true,
      };

    case 'proceed':
      if (!baseline) {
        throw new Error('Cannot proceed: no baseline loaded');
      }
      // Deserialize baseline with format detection
      const proceedGraph = deserializeBaselineWithFormatDetection(baseline);
      return {
        graph: proceedGraph,
        action: 'proceed',
        migrated: false,
      };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Deserialize baseline with format detection
 *
 * WHY: Baselines can be 1.0 (graph.nodes/edges) or 1.1 (pathTable/nodes/edges).
 * This helper detects format and uses appropriate deserialization path.
 *
 * @param baseline - Baseline to deserialize (may be 1.0 or 1.1 structure)
 * @returns Deserialized CodeGraph instance
 */
function deserializeBaselineWithFormatDetection(baseline: Baseline): import('../../graph.js').CodeGraph {
  const format = detectBaselineFormat(baseline);

  switch (format) {
    case '1.1':
      // Compressed format - deserialize directly using CompressedBaseline path
      // Cast to CompressedBaseline for proper deserialization
      return deserializeCompressed(baseline as unknown as CompressedBaseline);

    case '1.0':
    case 'legacy':
      // Legacy format - use graph property with SerializedCodeGraph structure
      return deserializeBaselineGraph(baseline.graph);

    default:
      throw new Error(`Unknown baseline format during deserialization: ${format}`);
  }
}