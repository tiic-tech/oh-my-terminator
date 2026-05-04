/**
 * @fileoverview Version pattern matching and BFS migration path finding
 *
 * WHY: Multi-step migrations require finding shortest sequence of scripts
 * that transforms baseline from source to target. BFS ensures shortest path.
 */

import type { MigrationScript } from '../types.js';
import { SchemaVersionImpl } from '../../version.js';
import { getMigrationRegistryForTesting } from './registry.js';

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
  const registry = getMigrationRegistryForTesting();

  for (const [pattern, scripts] of registry.entries()) {
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