/**
 * Dependency Score Calculation Module (Phase 2 of cg-layer-inference-pipeline)
 *
 * WHY separate module: Dependency scoring has distinct responsibilities:
 * - Cycle detection (DFS algorithm)
 * - External dependency exclusion
 * - Dynamic/type-only import handling
 * These concerns differ from layer assignment logic, following coding-taste Rule 1.
 *
 * Calculates dependency scores with:
 * - Cycle penalty (larger cycles penalize more)
 * - External dependency exclusion
 * - Dynamic import penalty
 * - Type-only import exclusion
 */

import type { CodeGraph } from '../../../graph.js';
import { EdgeType as EdgeTypeEnum } from '../../../types.js';
import type { DirectoryGroup } from '../grouping.js';

// ============================================================================
// Public Interfaces
// ============================================================================

/**
 * Result of dependency score calculation
 *
 * WHY: Structured result enables consumers to understand score composition.
 * Individual fields allow debugging and score breakdown analysis.
 */
export interface DependencyScoreResult {
  /** Final score after all adjustments */
  netScore: number;
  /** Count of groups importing this group */
  importedBy: number;
  /** Count of groups this group imports (excluding external/type-only) */
  importsFrom: number;
  /** Penalty from cycle membership */
  cyclePenalty: number;
  /** Penalty from dynamic imports */
  dynamicImportPenalty: number;
  /** Count of external dependency imports (excluded from score) */
  externalImportCount: number;
  /** Count of type-only imports (excluded from score) */
  typeOnlyImportCount: number;
}

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
 * Calculate dependency score for a group
 *
 * Score = importedBy - importsFrom - cyclePenalty - dynamicImportPenalty
 *
 * Exclusions from importsFrom:
 * - External dependencies (EXTERNAL node type)
 * - Type-only imports (metadata.importKind === 'type-only')
 * - Dynamic imports add penalty instead of exclusion
 *
 * @param group - Directory group to score
 * @param graph - CodeGraph for edge metadata lookup
 * @param allGroups - All groups for cycle detection
 * @returns Complete score breakdown
 */
export function calculateDependencyScore(
  group: DirectoryGroup,
  graph: CodeGraph,
  allGroups: Map<string, DirectoryGroup>
): DependencyScoreResult {
  // Calculate base counts from importStats
  const importedBy = sumMapValues(group.importStats.importedBy);

  // Count imports, handling exclusions
  let importsFrom = 0;
  let externalImportCount = 0;
  let typeOnlyImportCount = 0;
  let dynamicImportPenalty = 0;

  // Analyze importsFrom for exclusions and penalties
  for (const [targetGroup, count] of group.importStats.importsFrom) {
    // Check if target is external
    if (targetGroup === '__external__') {
      externalImportCount += count;
      continue; // External imports don't count
    }

    // Check for type-only imports via graph edges
    const typeOnlyCount = countTypeOnlyImports(group, targetGroup, graph);
    typeOnlyImportCount += typeOnlyCount;

    // Check for dynamic imports
    const dynamicCount = countDynamicImports(group, targetGroup, graph);
    dynamicImportPenalty += dynamicCount;

    // importsFrom = total - external - type-only (dynamic adds penalty, not exclusion)
    importsFrom += count - typeOnlyCount;
  }

  // Calculate cycle penalty
  const cycles = detectCycles(allGroups);
  const cyclePenalty = calculateGroupCyclePenalty(group.name, cycles);

  // Calculate final netScore
  const netScore = importedBy - importsFrom - cyclePenalty - dynamicImportPenalty;

  return {
    netScore,
    importedBy,
    importsFrom,
    cyclePenalty,
    dynamicImportPenalty,
    externalImportCount,
    typeOnlyImportCount,
  };
}

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
 * Sum all values in a Map
 */
function sumMapValues(map: Map<string, number>): number {
  let sum = 0;
  for (const value of map.values()) {
    sum += value;
  }
  return sum;
}

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

/**
 * Calculate cycle penalty for a specific group
 *
 * WHY: A group may participate in multiple cycles.
 * Sum of all cycle penalties is applied to netScore.
 */
function calculateGroupCyclePenalty(groupName: string, cycles: CycleInfo[]): number {
  return cycles
    .filter(c => c.groups.includes(groupName))
    .reduce((sum, c) => sum + c.penalty, 0);
}

/**
 * Count type-only imports between two groups
 *
 * WHY: Type-only imports (`import type { X }`) are erased at compile time.
 * They don't create runtime dependencies and shouldn't penalize score.
 */
function countTypeOnlyImports(
  sourceGroup: DirectoryGroup,
  targetGroup: string,
  graph: CodeGraph
): number {
  let count = 0;

  // Check all edges from source group files
  for (const fileId of sourceGroup.files) {
    const outEdges = graph.outEdges.get(fileId) || [];
    for (const edge of outEdges) {
      // Only check IMPORTS edges (not RE_EXPORTS or DYNAMIC_IMPORTS)
      if (edge.type !== EdgeTypeEnum.IMPORTS) {
        continue;
      }

      // Check if target is in the targetGroup
      const targetNode = graph.nodes.get(edge.to);
      if (!targetNode) {
        continue;
      }

      // Get group of target file
      const targetFileGroup = getGroupFromPath(targetNode.path);
      if (targetFileGroup !== targetGroup) {
        continue;
      }

      // Check metadata for type-only
      if (edge.metadata?.importKind === 'type-only') {
        count++;
      }
    }
  }

  return count;
}

/**
 * Count dynamic imports between two groups
 *
 * WHY: Dynamic imports (`await import('...')`) indicate deferred loading.
 * They add penalty because they break static dependency analysis.
 */
function countDynamicImports(
  sourceGroup: DirectoryGroup,
  targetGroup: string,
  graph: CodeGraph
): number {
  let count = 0;

  // Check all edges from source group files
  for (const fileId of sourceGroup.files) {
    const outEdges = graph.outEdges.get(fileId) || [];
    for (const edge of outEdges) {
      // Check DYNAMIC_IMPORTS edges
      if (edge.type === EdgeTypeEnum.DYNAMIC_IMPORTS) {
        const targetNode = graph.nodes.get(edge.to);
        if (!targetNode) {
          continue;
        }

        const targetFileGroup = getGroupFromPath(targetNode.path);
        if (targetFileGroup === targetGroup) {
          count++;
        }
      }

      // Also check IMPORTS edges with isDynamic metadata
      if (edge.type === EdgeTypeEnum.IMPORTS && edge.metadata?.isDynamic) {
        const targetNode = graph.nodes.get(edge.to);
        if (!targetNode) {
          continue;
        }

        const targetFileGroup = getGroupFromPath(targetNode.path);
        if (targetFileGroup === targetGroup) {
          count++;
        }
      }
    }
  }

  return count;
}

/**
 * Extract group name from file path (first-level directory)
 *
 * WHY: Helper for matching edges to groups.
 * Same logic as getGroupNameFromFile in grouping.ts.
 */
function getGroupFromPath(path: string): string {
  // Remove leading 'src/' if present
  const normalizedPath = path.startsWith('src/') ? path.slice(4) : path;

  const firstSlash = normalizedPath.indexOf('/');
  if (firstSlash === -1) {
    return '__root__';
  }

  return normalizedPath.slice(0, firstSlash);
}