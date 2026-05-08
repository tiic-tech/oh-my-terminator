/**
 * @fileoverview Structure and data integrity validation for CodeGraph baseline
 *
 * WHY: Validation is isolated for:
 * - Structure validation: Required fields, correct types
 * - Data integrity: Node ID uniqueness, edge reference validity
 * - Reusable validation logic for load/save operations
 * - Format-aware validation: Supports both 1.0 and 1.1 baseline formats
 */

import type { Baseline, ValidationResult, IntegrityResult } from '../types/index.js';
import { detectBaselineFormat } from '../migrations/1.0-to-1.1.js';
import { NodeType, EdgeType } from '../../types.js';

/**
 * Validate compressed baseline (1.1 format) structure
 *
 * WHY: 1.1 format has different structure than 1.0 format.
 * Uses pathTable + nodes + edges instead of graph.nodes + graph.edges.
 *
 * Validates: pathTable is array of strings, nodes/edges arrays exist,
 * commitHash/timestamp fields are present.
 *
 * @param data - Parsed JSON data (unknown type for validation)
 * @returns Validation result with errors list
 */
export function validateCompressedBaselineStructure(data: unknown): ValidationResult {
  const errors: string[] = [];

  // Check data is an object
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Baseline must be an object'] };
  }

  const baseline = data as Record<string, unknown>;

  // Required fields check (1.1 format: pathTable, nodes, edges, commitHash, timestamp)
  const requiredFields = ['pathTable', 'nodes', 'edges', 'commitHash', 'timestamp'];
  for (const field of requiredFields) {
    if (!(field in baseline)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // PathTable validation: must be array of strings
  if ('pathTable' in baseline) {
    if (!Array.isArray(baseline.pathTable)) {
      errors.push('pathTable must be an array');
    } else {
      // Validate each path is a string
      for (let i = 0; i < baseline.pathTable.length; i++) {
        if (typeof baseline.pathTable[i] !== 'string') {
          errors.push(`pathTable[${i}] must be a string`);
        }
      }
    }
  }

  // Nodes validation: must be array of CompressedNode-like objects
  if ('nodes' in baseline) {
    if (!Array.isArray(baseline.nodes)) {
      errors.push('nodes must be an array');
    } else {
      errors.push(...validateCompressedNodesArray(baseline.nodes));
    }
  }

  // Edges validation: must be array of CompressedEdge or IMPORTS_BATCH
  if ('edges' in baseline) {
    if (!Array.isArray(baseline.edges)) {
      errors.push('edges must be an array');
    } else {
      errors.push(...validateCompressedEdgesArray(baseline.edges));
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

  return { valid: errors.length === 0, errors };
}

/**
 * Validate compressed nodes array structure
 *
 * WHY: CompressedNode has required fields: type, pathIndex.
 * Validates minimal structure for loading.
 *
 * @param nodes - Nodes array to validate
 * @returns Array of validation errors
 */
function validateCompressedNodesArray(nodes: unknown[]): string[] {
  const errors: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node || typeof node !== 'object') {
      errors.push(`nodes[${i}] must be an object`);
      continue;
    }

    const n = node as Record<string, unknown>;

    // Required: type must be valid NodeType
    if (!('type' in n)) {
      errors.push(`nodes[${i}] missing required field: type`);
    } else if (typeof n.type !== 'string' || !Object.values(NodeType).includes(n.type as NodeType)) {
      errors.push(`nodes[${i}].type must be a valid NodeType`);
    }

    // Required: pathIndex must be number
    if (!('pathIndex' in n)) {
      errors.push(`nodes[${i}] missing required field: pathIndex`);
    } else if (typeof n.pathIndex !== 'number') {
      errors.push(`nodes[${i}].pathIndex must be a number`);
    }
  }

  return errors;
}

/**
 * Validate compressed edges array structure
 *
 * WHY: CompressedEdge and IMPORTS_BATCH have different required fields.
 * Validates minimal structure for loading.
 *
 * @param edges - Edges array to validate
 * @returns Array of validation errors
 */
function validateCompressedEdgesArray(edges: unknown[]): string[] {
  const errors: string[] = [];

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (!edge || typeof edge !== 'object') {
      errors.push(`edges[${i}] must be an object`);
      continue;
    }

    const e = edge as Record<string, unknown>;

    // Determine edge type
    if (e.type === 'IMPORTS_BATCH') {
      // IMPORTS_BATCH validation
      if (typeof e.fromIndex !== 'number') {
        errors.push(`edges[${i}] (IMPORTS_BATCH) missing or invalid fromIndex`);
      }
      if (!Array.isArray(e.targetIndexes)) {
        errors.push(`edges[${i}] (IMPORTS_BATCH) missing or invalid targetIndexes`);
      }
    } else if (typeof e.type === 'string') {
      // Regular CompressedEdge validation
      if (!Object.values(EdgeType).includes(e.type as EdgeType)) {
        errors.push(`edges[${i}].type must be a valid EdgeType`);
      }
      if (typeof e.fromIndex !== 'number') {
        errors.push(`edges[${i}] missing or invalid fromIndex`);
      }
      if (typeof e.toIndex !== 'number') {
        errors.push(`edges[${i}] missing or invalid toIndex`);
      }
    } else {
      errors.push(`edges[${i}] missing or invalid type field`);
    }
  }

  return errors;
}

// ============================================================================
// Format-Aware Structure Validation
// ============================================================================

/**
 * Validate baseline structure with format detection
 *
 * WHY: Supports both 1.0 (graph.nodes/edges) and 1.1 (pathTable/nodes/edges) formats.
 * Dispatches to appropriate validator based on detected format.
 *
 * @param data - Parsed JSON data (unknown type for validation)
 * @returns Validation result with errors list
 */
export function validateBaselineStructure(data: unknown): ValidationResult {
  // Detect format first
  const format = detectBaselineFormat(data);

  // Dispatch to format-specific validator
  switch (format) {
    case '1.1':
      return validateCompressedBaselineStructure(data);

    case '1.0':
    case 'legacy':
      return validateBaselineStructure_1_0(data);

    default:
      return { valid: false, errors: [`Unknown baseline format: ${format}`] };
  }
}

/**
 * Validate legacy baseline (1.0 format) structure
 *
 * WHY: Preserves original validation logic for backward compatibility.
 * Validates: graph.nodes, graph.edges, commitHash, timestamp.
 *
 * @param data - Parsed JSON data (unknown type for validation)
 * @returns Validation result with errors list
 */
function validateBaselineStructure_1_0(data: unknown): ValidationResult {
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
// Structure Validation Helpers (1.0 Format)
// ============================================================================

/**
 * Validate graph structure has required fields (1.0 format)
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