/**
 * Cycle Detection Module
 *
 * WHY separate module: Cycle detection is a distinct algorithmic concern:
 * - DFS-based cycle finding algorithm
 * - Cycle normalization for duplicate prevention
 * - Penalty calculation based on cycle size
 * These differ from import analysis, following coding-taste Rule 1.
 *
 * ELASTIC EXCEPTION (coding-taste Rule 2): File ~116 lines.
 * Well within 150 threshold. Single cohesive unit for cycle detection algorithm.
 */

import type { DirectoryGroup } from '../grouping.js';

// ============================================================================
// Public Interfaces
// ============================================================================

/**
 * Information about a detected cycle
 *
 * WHY: Cycle info includes penalty for consumer use.
 * Penalty is calculated once during detection to avoid recomputation.
 */
export interface CycleInfo {
  /** Groups participating in the cycle */
  groups: string[];
  /** Calculated penalty for this cycle */
  penalty: number;
}

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Detect all cycles in the group dependency graph
 *
 * Uses DFS with visited set optimization.
 * Each cycle is reported once (no duplicate reporting).
 *
 * WHY visited set: Prevents O(n^2) explosion on large graphs.
 * Groups without dependencies are skipped entirely.
 *
 * @param groups - All directory groups
 * @returns Array of detected cycles with penalties
 */
export function detectCycles(groups: Map<string, DirectoryGroup>): CycleInfo[] {
  const cycles: CycleInfo[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  // DFS function to find cycles
  function dfs(groupName: string, path: string[]): void {
    // Skip if already fully processed
    if (visited.has(groupName)) {
      return;
    }

    // Cycle detected: group is in current recursion stack
    if (recursionStack.has(groupName)) {
      // Extract cycle from path
      const cycleStart = path.indexOf(groupName);
      if (cycleStart !== -1) {
        const cyclePath = path.slice(cycleStart);
        // Avoid duplicate cycles
        const normalizedCycle = normalizeCycle(cyclePath);
        if (!isCycleAlreadyFound(cycles, normalizedCycle)) {
          cycles.push({
            groups: normalizedCycle,
            penalty: calculateCyclePenalty(normalizedCycle),
          });
        }
      }
      return;
    }

    recursionStack.add(groupName);
    const group = groups.get(groupName);

    // Visit all dependencies (importsFrom)
    if (group) {
      for (const [dependency] of group.importStats.importsFrom) {
        // Skip external dependencies
        if (dependency === '__external__') {
          continue;
        }
        dfs(dependency, [...path, groupName]);
      }
    }

    recursionStack.delete(groupName);
    visited.add(groupName);
  }

  // Start DFS from each group
  for (const [groupName] of groups) {
    dfs(groupName, []);
  }

  return cycles;
}

/**
 * Calculate penalty for a cycle based on size
 *
 * WHY size-based: Larger cycles indicate deeper architectural issues.
 * ceil(length/2) reflects that larger cycles deserve larger penalties.
 * Each group in cycle receives this penalty (fairness).
 *
 * @param cycle - Groups in the cycle
 * @returns Penalty value (0 for empty cycle)
 */
export function calculateCyclePenalty(cycle: string[]): number {
  if (cycle.length === 0) {
    return 0;
  }
  return Math.ceil(cycle.length / 2);
}

// ============================================================================
// Private Helper Functions
// ============================================================================

/**
 * Normalize cycle for comparison (rotate to smallest alphabetical name)
 *
 * WHY: Same cycle can be discovered from different starting points.
 * Normalization ensures we don't report duplicates.
 */
function normalizeCycle(cycle: string[]): string[] {
  if (cycle.length === 0) {
    return cycle;
  }

  // Find the minimum name to use as canonical start
  const minName = cycle.reduce((min, name) => (name < min ? name : min), cycle[0]);
  const minIndex = cycle.indexOf(minName);

  // Rotate cycle to start at minimum name
  return [...cycle.slice(minIndex), ...cycle.slice(0, minIndex)];
}

/**
 * Check if cycle is already in found cycles list
 */
function isCycleAlreadyFound(cycles: CycleInfo[], normalizedCycle: string[]): boolean {
  return cycles.some(c => {
    if (c.groups.length !== normalizedCycle.length) {
      return false;
    }
    return c.groups.every((g, i) => g === normalizedCycle[i]);
  });
}