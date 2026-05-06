/**
 * @fileoverview Helper functions for update command
 *
 * WHY: Separated from update.ts because these functions have different reasons to change:
 * - handleUpdateEdgeCase: Changes when edge case detection logic changes
 * - removeFileFromGraph: Changes when graph node structure changes
 *
 * These helpers are ~80 lines total, keeping update.ts focused on orchestration.
 */

import { NodeType } from '../../types.js';
import type { CodeGraph } from '../../graph.js';
import type { SpecialCaseResult, EdgeCaseResult } from '../../types.js';

// ============================================================================
// Edge Case Handling
// ============================================================================

/**
 * Handle edge cases for update command
 *
 * WHY: After file deletions, project might become empty/single-file.
 * Returns EdgeCaseResult for empty case (no files to update).
 * Returns null for normal/single-file/test-only to proceed with update.
 *
 * @param specialCase - Detection result from detectSpecialCases()
 * @param startTime - Start timestamp for duration calculation
 * @returns EdgeCaseResult for empty, null for other cases
 */
export function handleUpdateEdgeCase(
  specialCase: SpecialCaseResult,
  startTime: number
): EdgeCaseResult | null {
  const durationMs = Date.now() - startTime;

  switch (specialCase.kind) {
    case 'empty': {
      // WHY: Project became empty after deletions - cannot update
      return {
        success: true,
        kind: 'empty',
        message: 'No source files found. Project may have been cleared.',
        suggestions: [
          'Check if source files were accidentally deleted',
          'Re-run codegraph analyze after restoring files',
        ],
        durationMs,
      };
    }

    case 'single-file': {
      // WHY: Single file: proceed with update but note the state
      // Update can still work with single file
      return {
        success: true,
        kind: 'single-file',
        message: `Project now has single file: ${specialCase.sourceFiles[0]}`,
        file: specialCase.sourceFiles[0],
        durationMs,
      };
    }

    case 'test-only': {
      // WHY: Test-only: proceed with update, warning added to result
      return {
        success: true,
        kind: 'test-only',
        message: 'Project contains only test files.',
        warning: `Warning: Only test files found (${specialCase.testFiles.length} files). Treating as normal project.`,
        testFiles: specialCase.testFiles,
        durationMs,
      };
    }

    case 'normal':
      // WHY: Normal project: proceed with standard update
      return null;

    default:
      // WHY: Exhaustive check - TypeScript ensures all cases handled
      throw new Error(`Unknown project kind: ${specialCase.kind}`);
  }
}

// ============================================================================
// Graph Cleanup
// ============================================================================

/**
 * Remove FILE node and all MODULE sub-nodes for a file
 *
 * WHY: Part of incremental update - must clean old nodes before re-parse.
 * Changes when graph node structure changes (separate reason from update orchestration).
 *
 * @param graph - CodeGraph instance
 * @param filePath - Relative file path
 * @returns Number of nodes removed
 */
export function removeFileFromGraph(graph: CodeGraph, filePath: string): number {
  let count = 0;
  const fileId = `FILE:${filePath}`;

  // WHY: Find and remove all MODULE nodes for this file first
  // MODULE nodes depend on FILE node, so remove them before FILE node
  for (const [id, node] of graph.nodes) {
    if (node.type === NodeType.MODULE && node.path === filePath) {
      graph.removeNode(id);
      count++;
    }
  }

  // WHY: Remove edges for this file (imports, exports, contains)
  // Edges reference nodes, clean them up
  graph.removeEdgesForFile(filePath);

  // WHY: Remove FILE node last, after its dependent MODULE nodes
  if (graph.nodes.has(fileId)) {
    graph.removeNode(fileId);
    count++;
  }

  return count;
}