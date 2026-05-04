/**
 * @fileoverview Structure and data integrity validation for CodeGraph baseline
 *
 * WHY: Validation is isolated for:
 * - Structure validation: Required fields, correct types
 * - Data integrity: Node ID uniqueness, edge reference validity
 * - Reusable validation logic for load/save operations
 */

import type { Baseline, ValidationResult, IntegrityResult } from '../types.js';

// ============================================================================
// Structure Validation Helpers
// ============================================================================

/**
 * Validate graph structure has required fields
 *
 * WHY: Isolates graph-specific validation for better error messages.
 *
 * @param graph - Graph data to validate (unknown type)
 * @returns Array of validation errors
 */
function validateGraphStructure(graph: unknown): string[] {
  const errors: string[] = [];

  if (!graph || typeof graph !== 'object') {
    errors.push('graph must be an object');
    return errors;
  }

  const g = graph as Record<string, unknown>;
  if (!Array.isArray(g.nodes)) {
    errors.push('graph.nodes must be an array');
  }
  if (!Array.isArray(g.edges)) {
    errors.push('graph.edges must be an array');
  }

  return errors;
}

/**
 * Validate schemaVersion structure has required fields
 *
 * WHY: Isolates version-specific validation for schema compatibility.
 *
 * @param version - Schema version data to validate (unknown type)
 * @returns Array of validation errors
 */
function validateSchemaVersion(version: unknown): string[] {
  const errors: string[] = [];

  if (!version || typeof version !== 'object') {
    errors.push('schemaVersion must be an object');
    return errors;
  }

  const v = version as Record<string, unknown>;

  // Type validation
  if (typeof v.major !== 'number') errors.push('schemaVersion.major must be number');
  if (typeof v.minor !== 'number') errors.push('schemaVersion.minor must be number');
  if (typeof v.patch !== 'number') errors.push('schemaVersion.patch must be number');

  // Range validation (only if types are correct)
  if (typeof v.major === 'number' && v.major < 0) {
    errors.push('schemaVersion.major must be non-negative');
  }
  if (typeof v.minor === 'number' && v.minor < 0) {
    errors.push('schemaVersion.minor must be non-negative');
  }
  if (typeof v.patch === 'number' && v.patch < 0) {
    errors.push('schemaVersion.patch must be non-negative');
  }

  return errors;
}

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
    errors.push(...validateGraphStructure(baseline.graph));
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
    errors.push(...validateSchemaVersion(baseline.schemaVersion));
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