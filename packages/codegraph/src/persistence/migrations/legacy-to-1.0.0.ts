/**
 * @fileoverview Legacy baseline migration script
 *
 * WHY: Baselines without schemaVersion field (pre-v1.0) need migration
 * to current schema. This script:
 * - Adds schemaVersion 1.0.0
 * - Adds generatorVersion "1.0.0"
 * - Initializes migrationHistory with single record
 * - Preserves all existing graph data unchanged
 *
 * @see 06_c6_baseline_version_spec.md Section 3.3
 */

import type { Baseline, MigrationScript } from '../types.js';

/**
 * Legacy to 1.0.0 migration script
 *
 * Handles baselines with no schemaVersion field:
 * - Sets schemaVersion to 1.0.0
 * - Sets generatorVersion to 1.0.0
 * - Initializes migrationHistory
 * - Preserves graph data
 */
export const legacyToV1_0_0: MigrationScript = {
  fromVersion: 'legacy',
  toVersion: '1.0.0',
  description: 'Add schemaVersion and generatorVersion to legacy baseline',

  migrate: (baseline: Baseline): Baseline => {
    // Create new baseline object (immutable update)
    const migrated: Baseline = {
      ...baseline,
      schemaVersion: { major: 1, minor: 0, patch: 0 },
      generatorVersion: '1.0.0',
      migrationHistory: baseline.migrationHistory ? [...baseline.migrationHistory] : [],
    };

    // Add migration record
    migrated.migrationHistory.push({
      fromVersion: 'legacy',
      toVersion: '1.0.0',
      migratedAt: Date.now(),
      strategy: 'migrate',
    });

    // Preserve all existing graph data - no modifications needed

    return migrated;
  },
};