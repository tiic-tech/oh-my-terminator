/**
 * Import Analysis Module
 *
 * WHY separate module: Import analysis has distinct responsibilities:
 * - Type-only import counting (compile-time only, no runtime dependency)
 * - Dynamic import counting (deferred loading, breaks static analysis)
 * These differ from cycle detection, following coding-taste Rule 1.
 */

import type { CodeGraph } from '../../../graph.js';
import { EdgeType as EdgeTypeEnum } from '../../../types.js';
import type { DirectoryGroup } from '../grouping.js';
import { extractGroupFromPath } from './path-utils.js';

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Count type-only imports between two groups
 *
 * WHY: Type-only imports (`import type { X }`) are erased at compile time.
 * They don't create runtime dependencies and shouldn't penalize score.
 *
 * @param sourceGroup - Source directory group
 * @param targetGroup - Target group name to count imports to
 * @param graph - CodeGraph for edge lookup
 * @param sourceRoot - Source root directory for path normalization (default: 'src')
 */
export function countTypeOnlyImports(
  sourceGroup: DirectoryGroup,
  targetGroup: string,
  graph: CodeGraph,
  sourceRoot: string = 'src'
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

      // Use shared utility for group extraction
      const targetFileGroup = extractGroupFromPath(targetNode.path, sourceRoot);
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
 *
 * @param sourceGroup - Source directory group
 * @param targetGroup - Target group name to count imports to
 * @param graph - CodeGraph for edge lookup
 * @param sourceRoot - Source root directory for path normalization (default: 'src')
 */
export function countDynamicImports(
  sourceGroup: DirectoryGroup,
  targetGroup: string,
  graph: CodeGraph,
  sourceRoot: string = 'src'
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

        const targetFileGroup = extractGroupFromPath(targetNode.path, sourceRoot);
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

        const targetFileGroup = extractGroupFromPath(targetNode.path, sourceRoot);
        if (targetFileGroup === targetGroup) {
          count++;
        }
      }
    }
  }

  return count;
}