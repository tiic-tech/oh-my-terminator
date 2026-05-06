/**
 * C8: Architecture Layers - Main API Entry
 *
 * Provides getArchitectureLayers API for layer inference.
 */

import { CodeGraph } from '../../graph.js';
import { NodeType } from '../../types.js';
import {
  ErrorCode,
} from '../types/index.js';
import type {
  LayersResult,
  LayersError,
  LayersOptions,
} from '../types/index.js';
import {
  groupFilesByFirstLevelDirectory,
  computeImportDirectionStats,
} from './grouping.js';
import {
  inferArchitectureLayers,
  detectLayerViolations,
  calculateLayerHealthScore,
  buildGroupSummaries,
  buildGroupToLayerMap,
  getProjectThreshold,
} from './inference/index.js';
import {
  formatLayersOutput,
  generateLayersWarnings,
  generateLayersNextSuggested,
} from './format.js';

// Re-export sub-modules for testing
export {
  groupFilesByFirstLevelDirectory,
  computeImportDirectionStats,
  getGroupNameFromFile,
} from './grouping.js';
export {
  inferArchitectureLayers,
  detectLayerViolations,
  calculateLayerHealthScore,
  calculateSeverity,
  generateViolationSuggestion,
  buildGroupSummaries,
  buildGroupToLayerMap,
} from './inference/index.js';
export {
  formatLayersOutput,
  generateLayersWarnings,
  generateLayersNextSuggested,
} from './format.js';

/**
 * Create layers error result
 */
function createLayersError(
  code: string,
  message: string,
  startTime: number,
  suggestion?: string
): LayersError {
  return {
    success: false,
    error: { code, message, suggestion },
    durationMs: Date.now() - startTime,
  };
}

/**
 * Architecture Layers Analysis API
 *
 * Infer architecture layers from import direction statistics.
 *
 * @param graph - CodeGraph instance
 * @param options - Analysis options
 * @returns LayersResult or LayersError
 */
export function getArchitectureLayers(
  graph: CodeGraph,
  options?: LayersOptions
): LayersResult | LayersError {
  const startTime = Date.now();
  const sourceRoot = options?.sourceRoot ?? 'src';

  // Check for FILE nodes (C8-7: E005 for empty graph)
  let fileCount = 0;
  for (const [, node] of graph.nodes) {
    if (node.type === NodeType.FILE) {
      fileCount++;
    }
  }

  if (fileCount === 0) {
    return createLayersError(
      ErrorCode.EMPTY_GRAPH,
      'Graph contains no FILE nodes - cannot infer architecture layers',
      startTime,
      'Run `codegraph analyze` with valid source directory'
    );
  }

  // Step 1: Group files by first-level directory
  const groups = groupFilesByFirstLevelDirectory(graph, sourceRoot);

  // Step 2: Compute import direction statistics
  computeImportDirectionStats(graph, groups, sourceRoot);

  // Step 3: Infer layers from import statistics
  // Compute threshold: explicit > projectRoot-based > default (2)
  let layerThreshold = 2; // Default fallback
  if (options?.threshold !== undefined) {
    layerThreshold = options.threshold;
  } else if (options?.projectRoot) {
    layerThreshold = getProjectThreshold(options.projectRoot);
  }
  const { layers, groupScores } = inferArchitectureLayers(groups, layerThreshold);

  // Build group-to-layer mapping
  const groupToLayer = buildGroupToLayerMap(layers);

  // Step 4: Detect violations (now with actual file tracking)
  const violations = detectLayerViolations(graph, groupToLayer, sourceRoot, options);

  // Step 5: Calculate health score
  const healthScore = calculateLayerHealthScore(violations);

  // Step 6: Build group summaries
  const groupSummaries = buildGroupSummaries(groupScores, groupToLayer);

  // Step 7: Format output
  const content = formatLayersOutput(layers, violations, healthScore);
  const warnings = generateLayersWarnings(violations, layers);
  const nextSuggested = generateLayersNextSuggested(violations);

  return {
    success: true,
    layers,
    violations,
    healthScore,
    groups: groupSummaries,
    durationMs: Date.now() - startTime,
    warnings,
    nextSuggested,
    content,
  };
}