/**
 * C8: Impact Analysis - Main API Entry
 *
 * Provides getImpact API for BFS traversal on IMPORTS edges.
 */

import { CodeGraph } from '../../graph.js';
import {
  type ImpactResult,
  type ImpactError,
  type ImpactOptions,
  ErrorCode,
} from '../types/index.js';
import {
  normalizeTargetsToFile,
  bfsDependents,
  mergeBFSResults,
} from './traverse/index.js';
import {
  formatImpactOutput,
  calculateBlastRadius,
  generateNextSuggested,
  generateWarnings,
} from './format.js';

// Re-export sub-modules for testing
export { normalizeTargetsToFile, bfsDependents, mergeBFSResults, isTestFile } from './traverse/index.js';
export {
  formatImpactOutput,
  calculateBlastRadius,
  generateNextSuggested,
  generateWarnings,
} from './format.js';

/**
 * Create impact error result
 */
function createImpactError(
  code: string,
  message: string,
  startTime: number,
  suggestion?: string
): ImpactError {
  return {
    success: false,
    error: { code, message, suggestion },
    durationMs: Date.now() - startTime,
  };
}

/**
 * Impact Analysis API
 *
 * Find all files that depend on target files via BFS traversal.
 *
 * @param graph - CodeGraph instance
 * @param targets - Target IDs (FILE:xxx or MODULE:xxx#yyy)
 * @param options - Analysis options (maxFiles defaults to 20 for Agent token budgets)
 * @returns ImpactResult or ImpactError
 */
export function getImpact(
  graph: CodeGraph,
  targets: string[],
  options?: ImpactOptions
): ImpactResult | ImpactError {
  const startTime = Date.now();
  // WHY 20: Agent token budgets limited; 83 files = 2000+ tokens too verbose
  const maxFiles = options?.maxFiles ?? 20;

  // Normalize targets to FILE nodes
  const fileTargets = normalizeTargetsToFile(targets);

  // Check if any target exists
  const validTargets: string[] = [];
  for (const target of fileTargets) {
    if (graph.getNode(target)) {
      validTargets.push(target);
    }
  }

  // Error if no valid targets
  if (validTargets.length === 0 && targets.length > 0) {
    return createImpactError(
      ErrorCode.TARGET_NOT_FOUND,
      `Target not found: ${targets[0]}`,
      startTime,
      'Run `codegraph analyze` to build graph first'
    );
  }

  // Run BFS for each target
  const bfsResults = validTargets.map((target) =>
    bfsDependents(graph, new Set([target]), options)
  );

  // Merge results for multi-target queries
  const mergedResult = mergeBFSResults(bfsResults);

  // Apply maxFiles pagination for Agent token budgets
  const totalCount = mergedResult.affectedFiles.length;
  const truncated = totalCount > maxFiles;
  const limitedFiles = truncated
    ? mergedResult.affectedFiles.slice(0, maxFiles)
    : mergedResult.affectedFiles;

  // Calculate blast radius using full count
  const blastRadius = calculateBlastRadius(totalCount);

  // Generate output with truncation info
  const content = formatImpactOutput(
    targets,
    limitedFiles,
    mergedResult.directCount,
    mergedResult.indirectCount,
    truncated,
    totalCount
  );

  const warnings = generateWarnings(mergedResult.affectedFiles);
  const nextSuggested = generateNextSuggested(mergedResult.affectedFiles);

  return {
    success: true,
    targets,
    affectedFiles: limitedFiles,
    summary: {
      total: totalCount, // Full count, not limited by maxFiles
      direct: mergedResult.directCount,
      indirect: mergedResult.indirectCount,
    },
    truncated,
    blastRadius,
    durationMs: Date.now() - startTime,
    warnings,
    nextSuggested,
    content,
  };
}