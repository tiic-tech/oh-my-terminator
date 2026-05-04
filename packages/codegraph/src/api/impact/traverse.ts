/**
 * C8: Impact Analysis - BFS Traversal
 *
 * Implements BFS traversal on IMPORTS edges to find all dependents.
 */

import { CodeGraph } from '../../graph.js';
import { EdgeType } from '../../types.js';
import type { AffectedFile } from '../types.js';

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
 * Normalize target IDs to FILE node IDs
 *
 * Converts MODULE targets to their parent FILE nodes.
 */
export function normalizeTargetsToFile(
  targets: string[]
): Set<string> {
  const fileTargets = new Set<string>();

  for (const target of targets) {
    if (target.startsWith('FILE:')) {
      fileTargets.add(target);
    } else if (target.startsWith('MODULE:')) {
      // MODULE:src/utils.ts#formatDate → FILE:src/utils.ts
      const filePath = target.split('#')[0].replace('MODULE:', 'FILE:');
      fileTargets.add(filePath);
    } else if (target.startsWith('EXTERNAL:')) {
      // EXTERNAL targets not supported for impact analysis
      // Skip silently (will be handled at API level)
      continue;
    } else {
      // Plain path - assume FILE
      fileTargets.add(`FILE:${target}`);
    }
  }

  return fileTargets;
}

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
 * BFS traversal to find all dependents
 *
 * C8-6 Resolution: DYNAMIC_IMPORTS edges excluded.
 * C8-4 Resolution: via field uses array format.
 * C8-2 Resolution: maxDepth=0 means direct only.
 */
export function bfsDependents(
  graph: CodeGraph,
  targets: Set<string>,
  options?: { maxDepth?: number; includeTests?: boolean }
): BFSResult {
  const maxDepth = options?.maxDepth ?? 10;
  const includeTests = options?.includeTests ?? false;

  // Track visited nodes and their metadata
  const visited = new Map<string, { distance: number; via: string[] }>();
  const directSet = new Set<string>();

  // Phase 1: Find direct dependents (distance=1)
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

  // C8-2: maxDepth=0 means stop after direct dependents
  if (maxDepth === 0) {
    const affectedFiles: AffectedFile[] = Array.from(visited.entries()).map(([id, meta]) => ({
      path: id.replace('FILE:', ''),
      distance: meta.distance,
      via: meta.via,
    }));

    return {
      affectedFiles,
      directCount: directSet.size,
      indirectCount: 0,
    };
  }

  // Phase 2: BFS for indirect dependents with depth tracking
  // Queue entries: { nodeId, depth, viaPath }
  const queue: { nodeId: string; depth: number; viaPath: string }[] = [];

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

  // Separate direct and indirect
  const indirectCount = visited.size - directSet.size;

  // Build affected files array
  const affectedFiles: AffectedFile[] = Array.from(visited.entries())
    .map(([id, meta]) => ({
      path: id.replace('FILE:', ''),
      distance: meta.distance,
      via: meta.via,
    }))
    .sort((a, b) => a.distance - b.distance); // Sort by distance

  return {
    affectedFiles,
    directCount: directSet.size,
    indirectCount,
  };
}

/**
 * Merge multiple BFS results for multi-target queries
 *
 * C8-12 Resolution: distance=min, via=merged for minimum distance.
 */
export function mergeBFSResults(results: BFSResult[]): BFSResult {
  const mergedMap = new Map<string, { distance: number; via: string[] }>();

  for (const result of results) {
    for (const file of result.affectedFiles) {
      const existing = mergedMap.get(file.path);
      if (!existing) {
        mergedMap.set(file.path, { distance: file.distance, via: file.via });
      } else {
        // C8-12: Keep minimum distance
        if (file.distance < existing.distance) {
          mergedMap.set(file.path, { distance: file.distance, via: file.via });
        } else if (file.distance === existing.distance) {
          // Merge via paths for same distance using immutable update
          const mergedVia = [...existing.via];
          for (const via of file.via) {
            if (!mergedVia.includes(via)) {
              mergedVia.push(via);
            }
          }
          mergedMap.set(file.path, { distance: existing.distance, via: mergedVia });
        }
      }
    }
  }

  // Rebuild result
  const affectedFiles: AffectedFile[] = Array.from(mergedMap.entries())
    .map(([path, meta]) => ({
      path,
      distance: meta.distance,
      via: meta.via,
    }))
    .sort((a, b) => a.distance - b.distance);

  const directCount = affectedFiles.filter(f => f.distance === 1).length;
  const indirectCount = affectedFiles.filter(f => f.distance > 1).length;

  return {
    affectedFiles,
    directCount,
    indirectCount,
  };
}