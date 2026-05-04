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
} from '../types.js';
import {
  normalizeTargetsToFile,
  bfsDependents,
  mergeBFSResults,
} from './traverse.js';
import {
  formatImpactOutput,
  calculateBlastRadius,
  generateNextSuggested,
  generateWarnings,
} from './format.js';

// Re-export sub-modules for testing
export { normalizeTargetsToFile, bfsDependents, mergeBFSResults, isTestFile } from './traverse.js';
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
 * @param options - Analysis options
 * @returns ImpactResult or ImpactError
 */
export function getImpact(
  graph: CodeGraph,
  targets: string[],
  options?: ImpactOptions
): ImpactResult | ImpactError {
  const startTime = Date.now();

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

  // Calculate blast radius
  const blastRadius = calculateBlastRadius(mergedResult.affectedFiles.length);

  // Generate output
  const content = formatImpactOutput(
    targets,
    mergedResult.affectedFiles,
    mergedResult.directCount,
    mergedResult.indirectCount
  );

  const warnings = generateWarnings(mergedResult.affectedFiles);
  const nextSuggested = generateNextSuggested(mergedResult.affectedFiles);

  return {
    success: true,
    targets,
    affectedFiles: mergedResult.affectedFiles,
    summary: {
      total: mergedResult.affectedFiles.length,
      direct: mergedResult.directCount,
      indirect: mergedResult.indirectCount,
    },
    blastRadius,
    durationMs: Date.now() - startTime,
    warnings,
    nextSuggested,
    content,
  };
}