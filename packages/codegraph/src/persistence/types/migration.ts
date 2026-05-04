/**
 * @fileoverview Migration script interface
 *
 * WHY: Migration scripts are a self-contained concept with clear contract.
 * Separated to keep migration logic types separate from baseline data types.
 *
 * Contains:
 * - MigrationScript: Interface for version migration scripts
 */

import type { Baseline } from './baseline.js';

/**
 * Migration script interface
 *
 * WHY: Defines contract for version migrations:
 * - fromVersion supports 'x' wildcard (e.g., '1.x' matches all 1.x versions)
 * - migrate function transforms baseline structure
 * - description documents the migration purpose
 */
export interface MigrationScript {
  /** Source version (supports 'x' wildcard) */
  fromVersion: string;
  /** Target version */
  toVersion: string;
  /** Migration transformation function */
  migrate: (baseline: Baseline) => Baseline;
  /** Human-readable description of migration purpose */
  description: string;
}