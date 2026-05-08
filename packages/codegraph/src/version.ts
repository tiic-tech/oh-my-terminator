/**
 * @fileoverview Schema version management for CodeGraph
 *
 * WHY: Schema version determines baseline compatibility. Different major versions
 * require migration or rebuild, while minor/patch versions are backward compatible.
 *
 * Initial version: 1.0.0
 *
 * VERSION UPDATE RULES:
 * - Major: Breaking changes to NodeType/EdgeType enums, graph structure reorganization
 * - Minor: New optional fields (backward compatible)
 * - Patch: Algorithm optimizations, bug fixes (backward compatible)
 *
 * @see 06_c6_baseline_version_spec.md Section 2
 */

import type { SchemaVersion } from './types.js';

/**
 * Current schema version supported by this CodeGraph implementation
 *
 * WHY: Used for compatibility checking when loading baselines.
 * Baselines with different major versions require migration or rebuild.
 */
export const CURRENT_SCHEMA_VERSION: SchemaVersion = {
  major: 1,
  minor: 0,
  patch: 0
};

/**
 * Generator tool version (independent of schema version)
 *
 * WHY: Tracks which tool version created the baseline, useful for
 * debugging and compatibility with future tool features.
 */
export const GENERATOR_VERSION = '1.0.0';

/**
 * Constant for legacy baselines without schemaVersion field
 *
 * WHY: Avoids magic string 'legacy' throughout the codebase.
 * Legacy baselines always trigger rebuild action.
 */
export const LEGACY_VERSION = 'legacy';

/**
 * SchemaVersion class with comparison methods
 *
 * WHY: Interface alone cannot have methods. Class provides:
 * - parse(): Convert version string to object
 * - toString(): Convert to canonical string format
 * - isGreaterThan(): Compare versions
 * - isCompatibleWith(): Check major version compatibility
 */
export class SchemaVersionImpl implements SchemaVersion {
  major: number;
  minor: number;
  patch: number;

  /**
   * Create a schema version
   *
   * Validates that all parts are non-negative integers using shared validator.
   */
  constructor(major: number, minor: number, patch: number) {
    this.major = SchemaVersionImpl.validateVersionPart(major, 'major');
    this.minor = SchemaVersionImpl.validateVersionPart(minor, 'minor');
    this.patch = SchemaVersionImpl.validateVersionPart(patch, 'patch');
  }

  /**
   * Validate a single version part (static utility)
   *
   * WHY: Constructor validation logic was duplicated across constructor and parse.
   * Centralized validation ensures consistent error messages and reduces code duplication.
   *
   * @param value - Version part value to validate
   * @param name - Name of the part for error messages
   * @returns Validated non-negative integer
   * @throws Error if value is not a non-negative integer
   */
  private static validateVersionPart(value: number, name: 'major' | 'minor' | 'patch'): number {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Invalid ${name} version: ${value} (must be non-negative integer)`);
    }
    return value;
  }

  /**
   * Convert to canonical string format "major.minor.patch"
   */
  toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  }

  /**
   * Parse version string into SchemaVersion object
   *
   * Validates:
   * - Exactly 3 parts separated by dots
   * - Each part is non-negative integer
   * - Each part contains only digits
   */
  static parse(versionStr: string): SchemaVersionImpl {
    if (!versionStr || typeof versionStr !== 'string') {
      throw new Error(`Invalid version format: ${versionStr}`);
    }

    const parts = versionStr.split('.');
    if (parts.length !== 3) {
      throw new Error(`Invalid version format: ${versionStr} (expected 3 parts)`);
    }

    // Validate each part is numeric only
    for (const part of parts) {
      if (!/^\d+$/.test(part)) {
        throw new Error(`Invalid version format: ${versionStr} (part "${part}" is not numeric)`);
      }
    }

    const major = parseInt(parts[0], 10);
    const minor = parseInt(parts[1], 10);
    const patch = parseInt(parts[2], 10);

    return new SchemaVersionImpl(major, minor, patch);
  }

  /**
   * Check if this version is greater than another
   *
   * Comparison order: major → minor → patch
   */
  isGreaterThan(other: SchemaVersion): boolean {
    if (this.major > other.major) return true;
    if (this.major < other.major) return false;
    if (this.minor > other.minor) return true;
    if (this.minor < other.minor) return false;
    return this.patch > other.patch;
  }

  /**
   * Check if versions are compatible (same major version)
   *
   * WHY: SemVer guarantees backward compatibility within same major version.
   */
  isCompatibleWith(other: SchemaVersion): boolean {
    return this.major === other.major;
  }

  /**
   * Check equality with another version
   */
  equals(other: SchemaVersion): boolean {
    return this.major === other.major &&
           this.minor === other.minor &&
           this.patch === other.patch;
  }
}

/**
 * Helper to create SchemaVersion from object
 */
export function createSchemaVersion(obj: SchemaVersion): SchemaVersionImpl {
  return new SchemaVersionImpl(obj.major, obj.minor, obj.patch);
}