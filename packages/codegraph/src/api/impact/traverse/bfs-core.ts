/**
 * C8: Impact Analysis - BFS Core Logic
 *
 * WHY: bfsDependents orchestration and BFSResult type.
 * Coordinates the two-phase BFS traversal.
 *
 * Responsibility: Orchestrate BFS phases and build final result.
 */

import type { CodeGraph } from '../../../graph.js';
import type { AffectedFile } from '../../types/index.js';
import {
  collectDirectDependents,
  collectIndirectDependents,
  type VisitedMeta,
} from './bfs-phases.js';

/**
 * BFS traversal result with distance and via tracking
 */
export interface BFSResult {
  /** All affected files with distance and via information */
  affectedFiles: AffectedFile[];
  /** Direct dependents count */
  directCount: number;
  /** Indirect dependents count */
  indirectCount: number;
}

/**
 * Build AffectedFile array from visited map
 */
function buildAffectedFiles(visited: Map<string, VisitedMeta>): AffectedFile[] {
  return Array.from(visited.entries())
    .map(([id, meta]) => ({
      path: id.replace('FILE:', ''),
      distance: meta.distance,
      via: meta.via,
    }))
    .sort((a, b) => a.distance - b.distance);
}

/**
 * BFS traversal to find all dependents
 *
 * C8-6 Resolution: DYNAMIC_IMPORTS edges excluded.
 * C8-4 Resolution: via field uses array format.
 * C8-2 Resolution: maxDepth=0 means direct only.
 *
 * @param graph - CodeGraph instance
 * @param targets - Set of FILE node IDs to start from
 * @param options - Traversal options
 * @returns BFSResult with affected files and counts
 */
export function bfsDependents(
  graph: CodeGraph,
  targets: Set<string>,
  options?: { maxDepth?: number; includeTests?: boolean }
): BFSResult {
  const maxDepth = options?.maxDepth ?? 10;
  const includeTests = options?.includeTests ?? false;

  // Phase 1: Find direct dependents
  const { visited, directSet } = collectDirectDependents(graph, targets, includeTests);

  // C8-2: maxDepth=0 means stop after direct dependents
  if (maxDepth === 0) {
    const affectedFiles = buildAffectedFiles(visited);
    return {
      affectedFiles,
      directCount: directSet.size,
      indirectCount: 0,
    };
  }

  // Phase 2: BFS for indirect dependents
  collectIndirectDependents(graph, directSet, visited, maxDepth, includeTests);

  // Build result
  const indirectCount = visited.size - directSet.size;
  const affectedFiles = buildAffectedFiles(visited);

  return {
    affectedFiles,
    directCount: directSet.size,
    indirectCount,
  };
}