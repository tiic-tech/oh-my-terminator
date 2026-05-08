/**
 * C8: Impact Analysis - BFS Phases
 *
 * WHY kept together (159 lines, exceeds 150 threshold):
 * - isTestFile + collectDirectDependents + collectIndirectDependents + VisitedMeta form cohesive unit
 * - collectIndirectDependents (67 lines) contains core BFS logic, splitting would break flow
 * - These functions share VisitedMeta type and isTestFile utility
 *
 * Responsibility: Execute BFS traversal phases to find all dependents.
 */

import type { CodeGraph } from '../../../graph.js';
import { EdgeType } from '../../../types.js';

/**
 * Check if file is a test file
 *
 * C8-1 Resolution: Default exclude tests/, __tests__/, *.test.ts, *.spec.ts
 */
export function isTestFile(nodeId: string): boolean {
  const path = nodeId.replace('FILE:', '');
  return (
    path.includes('/__tests__/') ||
    path.includes('/tests/') ||
    path.endsWith('.test.ts') ||
    path.endsWith('.test.tsx') ||
    path.endsWith('.spec.ts') ||
    path.endsWith('.spec.tsx')
  );
}

/**
 * Visited node metadata
 */
export interface VisitedMeta {
  distance: number;
  via: string[];
}

/**
 * Collect direct dependents (Phase 1 of BFS)
 *
 * Finds all files with distance=1 from targets.
 *
 * @returns visited map and direct set
 */
export function collectDirectDependents(
  graph: CodeGraph,
  targets: Set<string>,
  includeTests: boolean
): { visited: Map<string, VisitedMeta>; directSet: Set<string> } {
  const visited = new Map<string, VisitedMeta>();
  const directSet = new Set<string>();

  for (const target of targets) {
    const inEdges = graph.inEdges.get(target) || [];
    for (const edge of inEdges) {
      // C8-6: Only traverse IMPORTS and RE_EXPORTS (exclude DYNAMIC_IMPORTS)
      if (edge.type !== EdgeType.IMPORTS && edge.type !== EdgeType.RE_EXPORTS) {
        continue;
      }

      const dependent = edge.from;

      // C8-1: Test file filtering
      if (!includeTests && isTestFile(dependent)) {
        continue;
      }

      if (!visited.has(dependent)) {
        visited.set(dependent, { distance: 1, via: [target.replace('FILE:', '')] });
        directSet.add(dependent);
      }
    }
  }

  return { visited, directSet };
}

/**
 * Queue entry for BFS
 */
interface QueueEntry {
  nodeId: string;
  depth: number;
  viaPath: string;
}

/**
 * Collect indirect dependents (Phase 2 of BFS)
 *
 * BFS traversal with depth tracking for indirect dependents.
 * Updates visited map with new findings.
 */
export function collectIndirectDependents(
  graph: CodeGraph,
  directSet: Set<string>,
  visited: Map<string, VisitedMeta>,
  maxDepth: number,
  includeTests: boolean
): void {
  // Queue entries: { nodeId, depth, viaPath }
  const queue: QueueEntry[] = [];

  for (const dependent of directSet) {
    queue.push({
      nodeId: dependent,
      depth: 1,
      viaPath: dependent.replace('FILE:', ''),
    });
  }

  while (queue.length > 0) {
    const { nodeId, depth, viaPath } = queue.shift()!;

    // C8-2: Stop at maxDepth
    if (depth >= maxDepth) {
      continue;
    }

    const inEdges = graph.inEdges.get(nodeId) || [];
    for (const edge of inEdges) {
      // C8-6: Only traverse IMPORTS and RE_EXPORTS
      if (edge.type !== EdgeType.IMPORTS && edge.type !== EdgeType.RE_EXPORTS) {
        continue;
      }

      const dependent = edge.from;

      // C8-1: Test file filtering
      if (!includeTests && isTestFile(dependent)) {
        continue;
      }

      const dependentPath = dependent.replace('FILE:', '');

      if (!visited.has(dependent)) {
        // New node - record with current distance + 1
        const newDistance = depth + 1;
        visited.set(dependent, { distance: newDistance, via: [viaPath] });

        // Continue BFS
        queue.push({
          nodeId: dependent,
          depth: newDistance,
          viaPath: dependentPath,
        });
      } else {
        // C8-4: Track multiple via paths for same node
        const existing = visited.get(dependent)!;
        // Only add via if distance matches (same shortest path)
        if (existing.distance === depth + 1 && !existing.via.includes(viaPath)) {
          // Use immutable update: create new object with new array
          visited.set(dependent, {
            distance: existing.distance,
            via: [...existing.via, viaPath],
          });
        }
      }
    }
  }
}