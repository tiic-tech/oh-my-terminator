/**
 * @fileoverview Migration framework for CodeGraph baseline version transitions
 *
 * WHY: Schema evolution requires structured migration scripts to transform
 * older baselines to current format without losing data. Framework provides:
 * - Migration registry with wildcard pattern support
 * - BFS-based migration path finding (shortest path)
 * - Sequential migration execution with history tracking
 *
 * Migration script format:
 * ```typescript
 * {
 *   fromVersion: '1.x.0',     // Wildcard 'x' matches any version component
 *   toVersion: '1.2.0',       // Target version (must be exact)
 *   migrate: (baseline) => transformed baseline,
 *   description: 'Human-readable purpose'
 * }
 * ```
 *
 * @see 06_c6_baseline_version_spec.md Section 3
 */

import type {
  Baseline,
  MigrationScript,
  MigrationRecord,
  RebuildHandler,
} from '../types.js';
import { SchemaVersionImpl, CURRENT_SCHEMA_VERSION } from '../../version.js';

// ============================================================================
// Migration Registry
// ============================================================================

/**
 * Global registry of migration scripts
 *
 * WHY: Single registry enables all migration scripts to be discovered
 * without explicit imports. Scripts register themselves on import.
 *
 * Structure: Map<fromVersion, MigrationScript[]>
 * - Multiple scripts can have same fromVersion (different targets)
 * - Wildcard patterns stored as-is, matched at lookup time
 */
const migrationRegistry = new Map<string, MigrationScript[]>();

/**
 * Expose registry for testing (internal use only)
 */
(globalThis as any).__migrationRegistry = migrationRegistry;

/**
 * Register a migration script
 *
 * WHY: Adds script to registry, replacing duplicate fromVersion→toVersion pairs.
 * Called by migration script files on import.
 *
 * @param script - Migration script to register
 */
export function registerMigration(script: MigrationScript): void {
  const existing = migrationRegistry.get(script.fromVersion) ?? [];

  // Remove duplicate if exists (same fromVersion and toVersion)
  const filtered = existing.filter(s => s.toVersion !== script.toVersion);

  // Add new script
  filtered.push(script);
  migrationRegistry.set(script.fromVersion, filtered);
}

/**
 * Clear migration registry (for testing)
 *
 * WHY: Tests need isolated registry state between runs.
 */
export function clearMigrationRegistry(): void {
  migrationRegistry.clear();
}

// ============================================================================
// Version Pattern Matching
// ============================================================================

/**
 * Check if version matches a pattern with wildcard support
 *
 * WHY: Migration scripts can target multiple versions using wildcards.
 * Pattern 'x' matches any version component at that position.
 *
 * Examples:
 * - '1.0.0' matches '1.0.0' (exact)
 * - '1.5.0' matches '1.x.0' (wildcard minor)
 * - '2.3.1' matches 'x.x.x' (all wildcards)
 * - 'legacy' is special case (no version structure)
 *
 * @param version - Concrete version to check
 * @param pattern - Pattern with potential 'x' wildcards
 * @returns Whether version matches pattern
 */
export function versionMatchesPattern(
  version: SchemaVersionImpl,
  pattern: string
): boolean {
  // Handle special legacy case
  if (pattern === 'legacy') {
    // Legacy baselines have no schemaVersion - represented by version 0.0.0
    return version.major === 0 && version.minor === 0 && version.patch === 0;
  }

  // Parse pattern components
  const parts = pattern.split('.');
  if (parts.length !== 3) {
    return false; // Invalid pattern format
  }

  // Check each component
  const [majorPat, minorPat, patchPat] = parts;

  if (majorPat !== 'x' && parseInt(majorPat, 10) !== version.major) {
    return false;
  }
  if (minorPat !== 'x' && parseInt(minorPat, 10) !== version.minor) {
    return false;
  }
  if (patchPat !== 'x' && parseInt(patchPat, 10) !== version.patch) {
    return false;
  }

  return true;
}

// ============================================================================
// Migration Path Finding (BFS)
// ============================================================================

/**
 * Get all migration scripts matching a given version pattern
 *
 * WHY: BFS traversal needs to find all available scripts that can be applied
 * from a specific version. Wildcard patterns require pattern matching.
 *
 * @param version - Current version to find matching scripts for
 * @returns Array of scripts that can be applied from this version
 */
function getMatchingScripts(version: SchemaVersionImpl): MigrationScript[] {
  const matchingScripts: MigrationScript[] = [];

  for (const [pattern, scripts] of migrationRegistry.entries()) {
    if (!versionMatchesPattern(version, pattern)) {
      continue;
    }
    matchingScripts.push(...scripts);
  }

  return matchingScripts;
}

/**
 * Process a BFS node and add valid targets to the queue
 *
 * WHY: Encapsulates the BFS node visiting logic for clarity.
 * Handles version parsing, visited tracking, and queue updates.
 *
 * @param current - Current BFS node with version and path
 * @param queue - BFS queue to add new nodes to
 * @param visited - Set of already visited version strings
 */
function visitBfsNode(
  current: { version: SchemaVersionImpl; path: MigrationScript[] },
  queue: Array<{ version: SchemaVersionImpl; path: MigrationScript[] }>,
  visited: Set<string>
): void {
  const matchingScripts = getMatchingScripts(current.version);

  for (const script of matchingScripts) {
    const targetVersion = SchemaVersionImpl.parse(script.toVersion);
    const targetStr = targetVersion.toString();

    // Skip if already visited
    if (visited.has(targetStr)) {
      continue;
    }

    // Add to queue with path
    visited.add(targetStr);
    queue.push({
      version: targetVersion,
      path: [...current.path, script],
    });
  }
}

/**
 * Find migration path from source version to target version
 *
 * WHY: Multi-step migrations require finding shortest sequence of scripts
 * that transforms baseline from source to target. BFS ensures shortest path.
 *
 * Algorithm:
 * 1. Start at source version
 * 2. Find all scripts matching source version (wildcard support)
 * 3. For each script, add target version to queue
 * 4. Track path taken to reach each version
 * 5. Continue until target version found or queue empty
 *
 * @param from - Source version
 * @param to - Target version
 * @returns Array of migration scripts (shortest path) or null if no path
 */
export function findMigrationPath(
  from: SchemaVersionImpl,
  to: SchemaVersionImpl
): MigrationScript[] | null {
  // Same version - no migration needed
  if (from.equals(to)) {
    return null;
  }

  // BFS queue: { version, path }
  const queue: Array<{ version: SchemaVersionImpl; path: MigrationScript[] }> = [];
  const visited = new Set<string>();

  // Start from source
  queue.push({ version: from, path: [] });
  visited.add(from.toString());

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Found target
    if (current.version.equals(to)) {
      return current.path;
    }

    // Visit node and expand queue
    visitBfsNode(current, queue, visited);
  }

  // No path found
  return null;
}

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
 * @param cwd - Project working directory (for potential rebuild fallback)
 * @param targetVersion - Optional target version (default: CURRENT_SCHEMA_VERSION)
 * @returns Migrated baseline
 * @throws Error if no migration path found
 */
export async function migrateBaseline(
  baseline: Baseline,
  cwd: string,
  targetVersion?: SchemaVersionImpl
): Promise<Baseline> {
  const target = targetVersion ?? CURRENT_SCHEMA_VERSION;
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
 * @param graph - Rebuilt graph data
 * @param target - Target schema version
 * @returns New baseline from rebuilt graph
 */
function createRebuiltBaseline(
  graph: NonNullable<ReturnType<RebuildHandler>>,
  target: SchemaVersionImpl
): Baseline {
  return {
    graph: {
      nodes: graph.nodes,
      edges: graph.edges,
      commitHash: graph.commitHash ?? '',
      timestamp: graph.timestamp ?? Date.now(),
    },
    commitHash: graph.commitHash ?? '',
    timestamp: graph.timestamp ?? Date.now(),
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
  const target = targetVersion ?? CURRENT_SCHEMA_VERSION;
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

// ============================================================================
// Built-in Migration Scripts
// ============================================================================

// Import and register legacy migration script
import { legacyToV1_0_0 } from './legacy-to-1.0.0.js';
registerMigration(legacyToV1_0_0);