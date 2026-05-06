/**
 * C8: Architecture Layers - Main API Entry
 *
 * Provides getArchitectureLayers API for layer inference.
 *
 * ELASTIC EXCEPTION (coding-taste Rule 2): File ~224 lines, exceeds 150 threshold.
 * NOT split because: Main API entry must orchestrate all phases together.
 * Splitting would fragment the critical orchestration logic:
 * - Source root detection → group creation → import stats → layer inference → suggestions
 * All phases are used sequentially in getArchitectureLayers(), forming a cohesive unit.
 */

import * as path from 'path';
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
  generateSuggestions,
  detectSourceRoot,
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
// Re-export inference sub-modules for E2E testing
export {
  detectSourceRoot,
  detectCycles,
  calculateCyclePenalty,
  calculateConfidence,
  generateSuggestions,
  getProjectThreshold,
  detectProjectScale,
  SIGNAL_WEIGHTS,
  EXCLUDED_DIRECTORIES,
  CONFIDENCE_CONSTANTS,
  SUGGESTION_CONSTANTS,
  type SourceRootResult,
  type SourceRootCandidate,
  type CycleInfo,
  type ConfidenceInputs,
  type Suggestion,
  type SuggestionType,
  type SuggestionContext,
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
 * Get candidate directories for source root detection.
 *
 * WHY: Source root detection needs a list of candidate directories to score.
 * We extract first-level subdirectories from FILE node paths.
 */
function getCandidateDirectories(graph: CodeGraph, projectRoot: string): string[] {
  const candidates: Set<string> = new Set();

  // Add project root itself as candidate
  candidates.add(projectRoot);

  // Extract first-level subdirectories from FILE nodes
  for (const [, node] of graph.nodes) {
    if (node.type === NodeType.FILE && node.path) {
      // Get relative path from project root
      const relativePath = node.path.startsWith(projectRoot)
        ? node.path.slice(projectRoot.length + 1)
        : node.path;

      // Extract first-level directory
      const parts = relativePath.split('/');
      if (parts.length >= 1) {
        const firstDir = parts[0];
        if (firstDir) {
          candidates.add(path.join(projectRoot, firstDir));
        }
      }
    }
  }

  return Array.from(candidates);
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

  // Determine source root: explicit > auto-detect > default 'src'
  let sourceRoot = options?.sourceRoot ?? 'src';
  let sourceRootScore = 0;

  // C8-Phase1: Auto-detect source root when not explicitly provided
  if (!options?.sourceRoot && options?.projectRoot) {
    const candidates = getCandidateDirectories(graph, options.projectRoot);
    const result = detectSourceRoot(candidates);
    if (result.sourceRoot) {
      sourceRoot = result.sourceRoot;
      sourceRootScore = result.score;
    }
  }

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
  const { layers, groupScores, context } = inferArchitectureLayers(groups, layerThreshold, sourceRootScore);

  // Build group-to-layer mapping
  const groupToLayer = buildGroupToLayerMap(layers);

  // Step 4: Detect violations (now with actual file tracking)
  const violations = detectLayerViolations(graph, groupToLayer, sourceRoot, options);

  // Step 5: Calculate health score
  const healthScore = calculateLayerHealthScore(violations);

  // Step 6: Build group summaries
  const groupSummaries = buildGroupSummaries(groupScores, groupToLayer);

  // Step 7: Generate suggestions for low confidence
  const suggestions = generateSuggestions(context.confidence, context);

  // Step 8: Format output
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
    suggestions,
    content,
  };
}