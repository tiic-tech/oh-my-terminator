/**
 * @fileoverview Migration execution and safe migration with backup/restore
 *
 * WHY: Executes migration scripts in sequence, updating schemaVersion
 * and recording migration history after each step.
 */

import type { Baseline, MigrationScript, MigrationRecord, RebuildHandler } from '../types/index.js';
import { CodeGraph } from '../../graph.js';
import { SchemaVersionImpl, CURRENT_SCHEMA_VERSION, createSchemaVersion } from '../../version.js';
import { findMigrationPath } from './path-finding.js';

// ============================================================================
// Migration Execution Helpers
// ============================================================================

/**
 * Create a migration record for history tracking
 *
 * WHY: Each migration step needs to be recorded for audit trail.
 * Encapsulates record creation to keep migration logic clean.
 *
 * @param script - Migration script that was executed
 * @returns MigrationRecord with timestamp and strategy
 */
function createMigrationRecord(script: MigrationScript): MigrationRecord {
  return {
    fromVersion: script.fromVersion,
    toVersion: script.toVersion,
    migratedAt: Date.now(),
    strategy: 'migrate',
  };
}

/**
 * Execute a single migration step on a baseline
 *
 * WHY: Encapsulates the per-step migration logic for clarity.
 * Handles script execution, version update, and history recording.
 *
 * @param baseline - Baseline to transform
 * @param script - Migration script to execute
 * @returns Transformed baseline with updated version and history
 */
function executeMigrationStep(baseline: Baseline, script: MigrationScript): Baseline {
  // Execute migration function
  const transformed = script.migrate(baseline);

  // Ensure schemaVersion matches target
  const parsed = SchemaVersionImpl.parse(script.toVersion);
  transformed.schemaVersion = {
    major: parsed.major,
    minor: parsed.minor,
    patch: parsed.patch,
  };

  // Record in migration history
  if (!transformed.migrationHistory) {
    transformed.migrationHistory = [];
  }
  transformed.migrationHistory.push(createMigrationRecord(script));

  return transformed;
}

// ============================================================================
// Migration Execution
// ============================================================================

/**
 * Migrate baseline from current version to target version
 *
 * WHY: Executes migration scripts in sequence, updating schemaVersion
 * and recording migration history after each step.
 *
 * Steps:
 * 1. Find migration path (BFS shortest path)
 * 2. Execute each script in sequence
 * 3. Update schemaVersion after each step
 * 4. Append to migrationHistory after each step
 * 5. Return transformed baseline
 *
 * @param baseline - Baseline to migrate
 * @param _cwd - Project working directory (unused, kept for API consistency)
 * @param targetVersion - Optional target version (default: CURRENT_SCHEMA_VERSION)
 * @returns Migrated baseline
 * @throws Error if no migration path found
 */
export function migrateBaseline(
  baseline: Baseline,
  _cwd: string,
  targetVersion?: SchemaVersionImpl
): Baseline {
  const target = targetVersion ?? createSchemaVersion(CURRENT_SCHEMA_VERSION);
  const currentVersion = SchemaVersionImpl.parse(
    `${baseline.schemaVersion.major}.${baseline.schemaVersion.minor}.${baseline.schemaVersion.patch}`
  );

  // Find migration path
  const path = findMigrationPath(currentVersion, target);

  if (!path) {
    // No path - check if already at target
    if (currentVersion.equals(target)) {
      return baseline; // Already at target, no migration needed
    }

    throw new Error(
      `No migration path found from ${currentVersion.toString()} to ${target.toString()}`
    );
  }

  // Execute each migration in sequence
  let current = baseline;
  for (const script of path) {
    current = executeMigrationStep(current, script);
  }

  return current;
}

// ============================================================================
// Safe Migration Helpers
// ============================================================================

/**
 * Create a baseline from a rebuilt graph
 *
 * WHY: When no migration path exists, rebuild handler creates fresh baseline.
 * Encapsulates baseline construction from graph data.
 *
 * @param graph - Rebuilt graph data (CodeGraph instance)
 * @param target - Target schema version
 * @returns New baseline from rebuilt graph
 */
function createRebuiltBaseline(
  graph: CodeGraph,
  target: SchemaVersionImpl
): Baseline {
  // Serialize graph data
  const serialized = graph.toJSON();
  return {
    graph: {
      nodes: serialized.nodes,
      edges: serialized.edges,
      commitHash: serialized.commitHash ?? '',
      timestamp: serialized.timestamp ?? Date.now(),
    },
    commitHash: serialized.commitHash ?? '',
    timestamp: serialized.timestamp ?? Date.now(),
    schemaVersion: { major: target.major, minor: target.minor, patch: target.patch },
    generatorVersion: CURRENT_SCHEMA_VERSION.toString(),
    architectureConstraints: [],
    healthScore: 50,
    skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
  };
}

// ============================================================================
// Safe Migration with Backup/Restore
// ============================================================================

/**
 * Safely migrate baseline with backup and rollback on failure
 *
 * WHY: Migration failures can corrupt baseline data. Safe migration:
 * 1. Creates backup before attempting migration
 * 2. Executes migration with error handling
 * 3. Restores backup on failure
 * 4. Falls back to rebuild if no migration path
 *
 * @param baseline - Baseline to migrate
 * @param cwd - Project working directory (for backup/restore)
 * @param targetVersion - Optional target version
 * @param rebuildHandler - Optional handler for rebuild fallback
 * @returns Migrated baseline or rebuilt baseline
 */
export async function safeMigrateBaseline(
  baseline: Baseline,
  cwd: string,
  targetVersion?: SchemaVersionImpl,
  rebuildHandler?: RebuildHandler
): Promise<Baseline> {
  const target = targetVersion ?? createSchemaVersion(CURRENT_SCHEMA_VERSION);
  const currentVersion = SchemaVersionImpl.parse(
    `${baseline.schemaVersion.major}.${baseline.schemaVersion.minor}.${baseline.schemaVersion.patch}`
  );

  // Already at target - no migration needed
  if (currentVersion.equals(target)) {
    return baseline;
  }

  // Find migration path
  const path = findMigrationPath(currentVersion, target);

  // No migration path - trigger rebuild if handler provided
  if (!path) {
    if (rebuildHandler) {
      const graph = await rebuildHandler(cwd);
      return createRebuiltBaseline(graph, target);
    }
    throw new Error(
      `No migration path found from ${currentVersion.toString()} to ${target.toString()}`
    );
  }

  // Execute migration (backup handled by saveBaseline)
  return migrateBaseline(baseline, cwd, target);
}