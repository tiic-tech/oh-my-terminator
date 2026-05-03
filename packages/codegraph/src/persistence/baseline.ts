/**
 * @fileoverview Baseline loading, validation, and persistence for CodeGraph
 *
 * WHY: Baseline persistence enables incremental updates and version tracking.
 * This module handles:
 * - Structure validation: Required fields, correct types
 * - Data integrity: Node ID uniqueness, edge reference validity
 * - Failure handling: Recovery strategies for 6 failure scenarios
 * - Atomic loading: Multi-step validation before use
 *
 * Loading Flow:
 * 1. Check file exists
 * 2. Read and parse JSON
 * 3. Validate structure (required fields)
 * 4. Verify data integrity (semantic checks)
 * 5. Check schema compatibility
 * 6. Execute determined action (proceed/migrate/rebuild/error)
 *
 * @see 06_c6_baseline_version_spec.md Section 4
 */

import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  Baseline,
  LoadBaselineOptions,
  LoadBaselineResult,
  LoadFailureReason,
  FailureInfo,
  ValidationResult,
  IntegrityResult,
  RebuildHandler,
} from './types.js';
import { checkSchemaCompatibility, determineAction, executeAction } from './compatibility.js';
import { getBaselinePath } from './paths.js';
import { CURRENT_SCHEMA_VERSION } from '../version.js';

// ============================================================================
// Structure Validation
// ============================================================================

/**
 * Validate baseline structure has required fields and correct types
 *
 * WHY: Catch structural issues before semantic validation.
 * Validates: required fields, graph structure, type correctness.
 *
 * @param data - Parsed JSON data (unknown type for validation)
 * @returns Validation result with errors list
 */
export function validateBaselineStructure(data: unknown): ValidationResult {
  const errors: string[] = [];

  // Check data is an object
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Baseline must be an object'] };
  }

  const baseline = data as Record<string, unknown>;

  // Required fields check
  const requiredFields = ['graph', 'commitHash', 'timestamp'];
  for (const field of requiredFields) {
    if (!(field in baseline)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Graph structure validation
  if ('graph' in baseline) {
    const graph = baseline.graph;
    if (!graph || typeof graph !== 'object') {
      errors.push('graph must be an object');
    } else {
      const g = graph as Record<string, unknown>;
      if (!Array.isArray(g.nodes)) {
        errors.push('graph.nodes must be an array');
      }
      if (!Array.isArray(g.edges)) {
        errors.push('graph.edges must be an array');
      }
    }
  }

  // Timestamp validation
  if ('timestamp' in baseline && typeof baseline.timestamp !== 'number') {
    errors.push('timestamp must be a number');
  }

  // CommitHash validation
  if ('commitHash' in baseline && typeof baseline.commitHash !== 'string') {
    errors.push('commitHash must be a string');
  }

  // Optional schemaVersion validation
  if ('schemaVersion' in baseline && baseline.schemaVersion !== undefined) {
    const version = baseline.schemaVersion;
    if (!version || typeof version !== 'object') {
      errors.push('schemaVersion must be an object');
    } else {
      const v = version as Record<string, unknown>;
      if (typeof v.major !== 'number') errors.push('schemaVersion.major must be number');
      if (typeof v.minor !== 'number') errors.push('schemaVersion.minor must be number');
      if (typeof v.patch !== 'number') errors.push('schemaVersion.patch must be number');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Data Integrity Verification
// ============================================================================

/**
 * Verify baseline data integrity (semantic validation)
 *
 * WHY: Check semantic consistency after structure validation passes:
 * - Node ID uniqueness
 * - Node.id matches stored ID
 * - Edge references exist
 * - Timestamp reasonable (not future)
 * - CommitHash format valid
 *
 * @param baseline - Structurally valid baseline
 * @returns Integrity result with errors list
 */
export function verifyDataIntegrity(baseline: Baseline): IntegrityResult {
  const errors: string[] = [];

  // Node ID uniqueness check
  const nodeIds = new Set<string>();
  for (const [id, node] of baseline.graph.nodes) {
    if (nodeIds.has(id)) {
      errors.push(`Duplicate node ID: ${id}`);
    }
    nodeIds.add(id);

    // Node.id matches stored ID
    if (node.id !== id) {
      errors.push(`Node ID mismatch: stored=${id}, node.id=${node.id}`);
    }
  }

  // Edge reference validity check
  for (const edge of baseline.graph.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`Edge references missing source node: ${edge.from}`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`Edge references missing target node: ${edge.to}`);
    }
  }

  // Timestamp check (60 second tolerance for clock skew)
  const now = Date.now();
  const tolerance = 60000; // 60 seconds
  if (baseline.timestamp > now + tolerance) {
    errors.push('Timestamp is in the future');
  }

  // CommitHash format check (7-40 hex characters)
  if (baseline.commitHash && !/^[a-f0-9]{7,40}$/.test(baseline.commitHash)) {
    errors.push('Invalid commit hash format');
  }

  return { valid: errors.length === 0, errors };
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

  // Default handling strategies
  switch (reason) {
    case 'file_not_found':
      // No baseline - first run, auto rebuild
      if (!options?.rebuildHandler) {
        return {
          success: false,
          failure: { reason, details: new Error('Rebuild handler not provided') },
        };
      }
      console.log('No baseline found. Running full analysis...');
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

    case 'parse_error':
      // JSON parse error - return failure
      console.error('Failed to parse baseline.json:', details);
      console.log('Options:');
      console.log('  1. Rebuild baseline (codegraph analyze --force)');
      console.log('  2. Restore from backup (if available)');
      return {
        success: false,
        failure: { reason, details },
      };

    case 'invalid_structure':
      // Structure validation failed
      if (options?.strict) {
        return {
          success: false,
          failure: { reason, details },
        };
      }
      // Non-strict mode - auto rebuild
      if (!options?.rebuildHandler) {
        return {
          success: false,
          failure: { reason, details: new Error('Rebuild handler not provided') },
        };
      }
      console.warn('Baseline structure invalid. Rebuilding...');
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

    case 'corrupted_data':
      // Integrity check failed - auto rebuild
      console.error('Baseline data corrupted:', details);
      console.log('Rebuilding baseline...');
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

    case 'schema_incompatible':
      // Version incompatibility - let compatResult determine action
      const compatResult = details as any;
      if (options?.actionConfig?.forceAction) {
        // Force action override
        try {
          const actionResult = await executeAction(
            options.actionConfig.forceAction,
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
            failure: { reason, details: e },
          };
        }
      }
      return {
        success: false,
        failure: { reason, details: compatResult },
      };

    case 'permission_error':
      // Permission denied - return failure
      console.error('Permission denied reading baseline:', details);
      return {
        success: false,
        failure: { reason, details },
      };

    default:
      return {
        success: false,
        failure: { reason, details },
      };
  }
}

// ============================================================================
// File Helpers
// ============================================================================

/**
 * Check if file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Main Loading Function
// ============================================================================

/**
 * Load baseline with full validation and compatibility checking
 *
 * WHY: Multi-step loading ensures baseline is valid and compatible:
 * 1. File existence check
 * 2. JSON parsing
 * 3. Structure validation
 * 4. Data integrity
 * 5. Schema compatibility
 * 6. Action execution
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

  // Step 1: Check file exists
  if (!await fileExists(baselinePath)) {
    return handleFailure('file_not_found', cwd, options);
  }

  // Step 2: Read and parse JSON
  let rawContent: string;
  try {
    rawContent = await readFile(baselinePath, 'utf-8');
  } catch (e) {
    return handleFailure('permission_error', cwd, options, e);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (e) {
    return handleFailure('parse_error', cwd, options, e);
  }

  // Step 3: Structure validation
  const validationResult = validateBaselineStructure(parsed);
  if (!validationResult.valid) {
    return handleFailure('invalid_structure', cwd, options, validationResult);
  }

  const baseline = parsed as Baseline;

  // Step 4: Data integrity verification
  const integrityResult = verifyDataIntegrity(baseline);
  if (!integrityResult.valid) {
    return handleFailure('corrupted_data', cwd, options, integrityResult);
  }

  // Step 5: Schema compatibility check
  const compatResult = checkSchemaCompatibility(baseline, CURRENT_SCHEMA_VERSION);

  // Step 6: Handle incompatibility
  if (!compatResult.compatible) {
    return handleFailure('schema_incompatible', cwd, options, compatResult);
  }

  // Step 7: Determine and execute action
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
    if (e instanceof Error && e.message.includes('Migration framework not yet implemented')) {
      // Migration not available - fall back to rebuild
      if (options?.rebuildHandler) {
        console.log('Migration not available. Rebuilding baseline...');
        const graph = await options.rebuildHandler(cwd);
        return {
          success: true,
          graph,
          baseline,
          compatibility: compatResult,
          executedAction: 'rebuild',
          migrated: false,
        };
      }
    }
    return {
      success: false,
      failure: { reason: 'schema_incompatible', details: e },
    };
  }
}