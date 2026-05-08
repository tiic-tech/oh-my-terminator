/**
 * C8: Impact Analysis - Result Merging
 *
 * WHY: mergeBFSResults handles multi-target queries.
 * Self-contained logic for merging BFS results with distance tracking.
 */

import type { AffectedFile } from '../../types/index.js';
import type { BFSResult } from './bfs-core.js';

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