/**
 * @fileoverview Migration registry for CodeGraph baseline version transitions
 *
 * WHY: Single registry enables all migration scripts to be discovered
 * without explicit imports. Scripts register themselves on import.
 */

import type { MigrationScript } from '../types.js';

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
export function getMigrationRegistryForTesting(): Map<string, MigrationScript[]> {
  return migrationRegistry;
}

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