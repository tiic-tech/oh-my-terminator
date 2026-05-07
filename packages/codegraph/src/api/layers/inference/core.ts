/**
 * C8: Architecture Layers - Core Inference
 *
 * WHY kept together (~176 lines, exceeds 150 threshold):
 * - inferArchitectureLayers + buildGroupToLayerMap + buildGroupSummaries share GroupScore/GroupStats types
 * - buildGroupSummaries transforms GroupScore results from inferArchitectureLayers
 * - Confidence calculation integrates with layer assignment (Phase 4)
 * - Splitting would fragment the layer inference core logic into <50 line files
 *
 * ELASTIC EXCEPTION (coding-taste Rule 2): File exceeds 150 threshold.
 * NOT split because: These functions form a tightly related cohesive unit - all
 * layer inference logic (scoring, assignment, mapping) is used together.
 * Splitting would produce files <50 lines each that fragment this cohesive unit.
 *
 * Contains layer assignment logic, score calculation, confidence, and group-to-layer mapping.
 */

import type { DirectoryGroup } from '../grouping.js';
import type { LayerAssignment, GroupStats, GroupSummary } from '../../types/index.js';
import { LAYER_ROLE_NAMES } from '../../types/index.js';
import {
  calculateConfidence,
  calculateGroupVariance,
  countAmbiguousPairs,
} from './confidence.js';
import { detectCycles } from './dependency-score.js';
import { inferLayerRoleNames } from './layer-naming.js';

/**
 * Default layer threshold for backward compatibility.
 *
 * WHY: Existing callers without explicit threshold get consistent behavior.
 * Value matches DEPTH_PRESETS.LARGE.threshold (historical default).
 */
const DEFAULT_LAYER_THRESHOLD = 2;

/**
 * Score data for a group (internal type)
 */
export interface GroupScore {
  name: string;
  netScore: number;
  importedBy: number;
  importsFrom: number;
  fileCount: number;
}

/**
 * Context for layer inference (used for suggestions)
 *
 * WHY: Enables fallback suggestions without recalculating signals.
 * Contains all factors needed for generateSuggestions().
 */
export interface InferenceContext {
  /** Overall confidence score */
  confidence: number;
  /** Source root detection score */
  sourceRootScore: number;
  /** Number of detected cycles */
  cycleCount: number;
  /** Detected cycles with group names */
  detectedCycles: string[][];
  /** Count of ambiguous adjacent pairs */
  ambiguousPairCount: number;
  /** Total number of groups */
  groupCount: number;
}

/**
 * Determine layer role name with naming info
 *
 * WHY: Layers 1-4 use predefined names (LAYER_ROLE_NAMES), layers 5+ infer from group names.
 * HOW: Pattern matching for semantic role names. Store naming info for verbose output.
 *
 * Extracted to file scope for testability (was nested inside inferArchitectureLayers).
 *
 * @param layerNum - Layer number (1-N)
 * @param layerGroups - Groups in this layer
 * @returns Object with role name and optional naming info for verbose display
 */
export function determineLayerRole(layerNum: number, layerGroups: GroupStats[]): { role: string; namingInfo?: LayerAssignment['namingInfo'] } {
  // Layers 1-4: Use predefined names (historical convention)
  if (layerNum <= 4 && LAYER_ROLE_NAMES[layerNum]) {
    return { role: LAYER_ROLE_NAMES[layerNum] };
  }

  // Layers 5+: Infer semantic name from group names
  const groupNames = layerGroups.map(g => g.name);
  const result = inferLayerRoleNames(groupNames, layerNum);

  // Extract naming info for verbose output (only when matchedRule exists)
  if (result.matchedRule) {
    return {
      role: result.role,
      namingInfo: {
        pattern: result.matchedRule.pattern,
        isExactMatch: result.matchedRule.isExactMatch,
        finalPriority: result.matchedRule.finalPriority,
      },
    };
  }

  return { role: result.role };
}

/**
 * Infer architecture layers from groups
 *
 * C8-3: Uses threshold for adjacent score merging.
 * C8-4: Calculates confidence based on signal strength, consistency, and penalties.
 * Dynamic threshold adapts to project scale via caller.
 *
 * @param groups - Directory groups with import statistics
 * @param threshold - Score difference threshold for layer grouping (default: 2)
 * @param sourceRootScore - Source root detection score for confidence calculation (default: 0)
 * @returns Layer assignments with confidence, group scores, and inference context
 */
export function inferArchitectureLayers(
  groups: Map<string, DirectoryGroup>,
  threshold: number = DEFAULT_LAYER_THRESHOLD,
  sourceRootScore: number = 0
): { layers: LayerAssignment[]; groupScores: GroupScore[]; context: InferenceContext } {
  // Calculate netScore for each group
  const groupScores: GroupScore[] = [];

  for (const [groupName, groupData] of groups) {
    // Skip empty groups
    if (groupData.files.length === 0) {
      continue;
    }

    const importedByCount = Array.from(groupData.importStats.importedBy.values())
      .reduce((sum, c) => sum + c, 0);
    const importsFromCount = Array.from(groupData.importStats.importsFrom.values())
      .reduce((sum, c) => sum + c, 0);

    groupScores.push({
      name: groupName,
      netScore: importedByCount - importsFromCount,
      importedBy: importedByCount,
      importsFrom: importsFromCount,
      fileCount: groupData.files.length,
    });
  }

  // Sort by netScore descending (high score = bottom layer)
  groupScores.sort((a, b) => b.netScore - a.netScore);

  // C8-4: Calculate confidence inputs
  const scores = groupScores.map(g => g.netScore);
  const groupVariance = calculateGroupVariance(scores);
  const ambiguousPairCount = countAmbiguousPairs(scores, threshold);

  // Detect cycles for confidence penalty
  const cycles = detectCycles(groups);
  const cycleCount = cycles.length;

  // Calculate overall confidence
  const confidence = calculateConfidence({
    sourceRootScore,
    groupVariance,
    cycleCount,
    ambiguousPairCount,
  });

  // Assign layers using threshold
  const layers: LayerAssignment[] = [];
  let currentLayer = 1;
  let currentLayerGroups: GroupStats[] = [];
  let prevScore = groupScores[0]?.netScore ?? 0;

  for (const score of groupScores) {
    const scoreDiff = Math.abs(score.netScore - prevScore);

    // C8-3: Start new layer if score difference > threshold
    if (scoreDiff > threshold && currentLayerGroups.length > 0) {
      const { role, namingInfo } = determineLayerRole(currentLayer, currentLayerGroups);
      layers.push({
        layer: currentLayer,
        role,
        groups: currentLayerGroups,
        confidence,
        namingInfo,
      });
      currentLayer++;
      currentLayerGroups = [];
    }

    // Add group to current layer
    currentLayerGroups.push({
      name: score.name,
      fileCount: score.fileCount,
      importedByCount: score.importedBy,
      importsFromCount: score.importsFrom,
    });

    prevScore = score.netScore;
  }

  // Add final layer
  if (currentLayerGroups.length > 0) {
    const { role, namingInfo } = determineLayerRole(currentLayer, currentLayerGroups);
    layers.push({
      layer: currentLayer,
      role,
      groups: currentLayerGroups,
      confidence,
      namingInfo,
    });
  }

  // Build inference context for suggestions
  const context: InferenceContext = {
    confidence,
    sourceRootScore,
    cycleCount,
    detectedCycles: cycles.map(c => c.groups),
    ambiguousPairCount,
    groupCount: groupScores.length,
  };

  return { layers, groupScores, context };
}

/**
 * Build group to layer mapping
 */
export function buildGroupToLayerMap(
  layers: LayerAssignment[]
): Map<string, number> {
  const map = new Map<string, number>();

  for (const layer of layers) {
    for (const group of layer.groups) {
      map.set(group.name, layer.layer);
    }
  }

  return map;
}

/**
 * Build group summaries for output
 */
export function buildGroupSummaries(
  groupScores: GroupScore[],
  groupToLayer: Map<string, number>
): GroupSummary[] {
  return groupScores
    .filter(s => s.fileCount > 0)
    .map(score => ({
      name: score.name,
      assignedLayer: groupToLayer.get(score.name) ?? 0,
      netScore: score.netScore,
    }));
}