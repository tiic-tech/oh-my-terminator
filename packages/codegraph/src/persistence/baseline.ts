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
  CompatibilityResult,
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
 * Handle file_not_found failure - auto rebuild for first run
 *
 * WHY: Missing baseline indicates first run, should auto-rebuild.
 *
 * @param cwd - Project working directory
 * @param options - Load options with rebuildHandler
 * @returns Load result with rebuilt graph
 */
async function handleFileNotFound(
  cwd: string,
  options?: LoadBaselineOptions
): Promise<LoadBaselineResult> {
  return executeRebuild(cwd, options, 'file_not_found');
}

/**
 * Handle parse_error failure - return failure for user intervention
 *
 * WHY: JSON parse errors require manual file inspection/repair.
 * Cannot auto-recover without knowing what user intended.
 *
 * @param details - Parse error context (original error)
 * @returns Load result with failure
 */
async function handleParseError(
  details?: unknown
): Promise<LoadBaselineResult> {
  return {
    success: false,
    failure: { reason: 'parse_error', details },
  };
}

/**
 * Handle invalid_structure failure - rebuild or strict failure
 *
 * WHY: Structure validation failed. In strict mode, fail immediately.
 * In non-strict mode, attempt auto-rebuild.
 *
 * @param cwd - Project working directory
 * @param options - Load options (strict mode, rebuildHandler)
 * @param details - Validation errors
 * @returns Load result (rebuild success or failure)
 */
async function handleInvalidStructure(
  cwd: string,
  options?: LoadBaselineOptions,
  details?: unknown
): Promise<LoadBaselineResult> {
  if (options?.strict) {
    return {
      success: false,
      failure: { reason: 'invalid_structure', details },
    };
  }
  return executeRebuild(cwd, options, 'invalid_structure');
}

/**
 * Handle corrupted_data failure - auto rebuild
 *
 * WHY: Integrity check failed (duplicate IDs, missing refs).
 * Auto-rebuild is safest recovery strategy.
 *
 * @param cwd - Project working directory
 * @param options - Load options with rebuildHandler
 * @param details - Integrity errors
 * @returns Load result (rebuild success or failure)
 */
async function handleCorruptedData(
  cwd: string,
  options?: LoadBaselineOptions,
  details?: unknown
): Promise<LoadBaselineResult> {
  return executeRebuild(cwd, options, 'corrupted_data');
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
  options?: LoadBaselineOptions
): Promise<LoadBaselineResult> {
  try {
    const actionResult = await executeAction(
      options!.actionConfig!.forceAction!,
      null,
      cwd,
      { ...options!.actionConfig, rebuildHandler: options!.rebuildHandler }
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
 * Handle schema_incompatible failure - use compatResult to decide
 *
 * WHY: Schema version mismatch requires version-specific handling.
 * Force action override can bypass compatibility check.
 *
 * @param cwd - Project working directory
 * @param options - Load options with actionConfig
 * @param details - Compatibility result with recommended action
 * @returns Load result based on action configuration
 */
async function handleSchemaIncompatible(
  cwd: string,
  options?: LoadBaselineOptions,
  details?: unknown
): Promise<LoadBaselineResult> {
  if (options?.actionConfig?.forceAction) {
    return executeForcedAction(cwd, options);
  }

  return {
    success: false,
    failure: { reason: 'schema_incompatible', details },
  };
}

/**
 * Handle permission_error failure - return failure
 *
 * WHY: Permission denied requires user intervention (fix permissions).
 * Cannot auto-recover without proper filesystem access.
 *
 * @param details - Permission error context
 * @returns Load result with failure
 */
async function handlePermissionError(
  details?: unknown
): Promise<LoadBaselineResult> {
  return {
    success: false,
    failure: { reason: 'permission_error', details },
  };
}

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
 * Dispatches to specialized handler functions for each failure type.
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

  // Dispatch to specialized handlers
  switch (reason) {
    case 'file_not_found':
      return handleFileNotFound(cwd, options);

    case 'parse_error':
      return handleParseError(details);

    case 'invalid_structure':
      return handleInvalidStructure(cwd, options, details);

    case 'corrupted_data':
      return handleCorruptedData(cwd, options, details);

    case 'schema_incompatible':
      return handleSchemaIncompatible(cwd, options, details);

    case 'permission_error':
      return handlePermissionError(details);

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

/**
 * Read and parse baseline JSON file
 *
 * WHY: Isolates file I/O and JSON parsing with proper error handling.
 * Returns parsed data on success, or failure result for caller to return.
 *
 * @param path - Absolute path to baseline file
 * @param cwd - Project working directory (for failure handler)
 * @param options - Load options (for failure handler)
 * @returns Object with parsed data on success, or LoadBaselineResult on failure
 */
async function readBaselineFile(
  path: string,
  cwd: string,
  options?: LoadBaselineOptions
): Promise<{ success: true; data: unknown } | LoadBaselineResult> {
  // Check file exists
  if (!await fileExists(path)) {
    return handleFailure('file_not_found', cwd, options);
  }

  // Read file content
  let rawContent: string;
  try {
    rawContent = await readFile(path, 'utf-8');
  } catch (e) {
    return handleFailure('permission_error', cwd, options, e);
  }

  // Parse JSON
  try {
    const parsed = JSON.parse(rawContent);
    return { success: true, data: parsed };
  } catch (e) {
    return handleFailure('parse_error', cwd, options, e);
  }
}

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
function validateAndCheckIntegrity(
  parsed: unknown,
  cwd: string,
  options?: LoadBaselineOptions
): { success: true; baseline: Baseline } | LoadBaselineResult {
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
async function handleCompatibilityAndAction(
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
async function executeActionWithFallback(
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
async function handleMigrationNotAvailable(
  baseline: Baseline,
  compatResult: CompatibilityResult,
  cwd: string,
  options?: LoadBaselineOptions
): Promise<LoadBaselineResult> {
  if (options?.rebuildHandler) {
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
  return {
    success: false,
    failure: { reason: 'schema_incompatible', details: new Error('Rebuild handler not provided') },
  };
}

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