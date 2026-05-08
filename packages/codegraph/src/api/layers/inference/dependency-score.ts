/**
 * Dependency Score Calculation Module (Phase 2 of cg-layer-inference-pipeline)
 *
 * WHY separate module: Dependency scoring coordinates multiple analyses:
 * - Import direction counting (importedBy vs importsFrom)
 * - Cycle penalty aggregation (from cycle-detection.ts)
 * - Import exclusions (from import-analysis.ts)
 * This is the main public API for dependency scoring.
 *
 * ELASTIC EXCEPTION (coding-taste Rule 2): File ~125 lines.
 * Well within 150 threshold after splitting cycle/import concerns.
 */

import type { CodeGraph } from '../../../graph.js';
import type { DirectoryGroup } from '../grouping.js';
import { detectCycles, type CycleInfo } from './cycle-detection.js';
import { countTypeOnlyImports, countDynamicImports } from './import-analysis.js';

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

// Re-export for backward compatibility
export { detectCycles, calculateCyclePenalty, type CycleInfo } from './cycle-detection.js';

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
 * @param sourceRoot - Source root directory for path normalization (default: 'src')
 * @returns Complete score breakdown
 */
export function calculateDependencyScore(
  group: DirectoryGroup,
  graph: CodeGraph,
  allGroups: Map<string, DirectoryGroup>,
  sourceRoot: string = 'src'
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
    const typeOnlyCount = countTypeOnlyImports(group, targetGroup, graph, sourceRoot);
    typeOnlyImportCount += typeOnlyCount;

    // Check for dynamic imports
    const dynamicCount = countDynamicImports(group, targetGroup, graph, sourceRoot);
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