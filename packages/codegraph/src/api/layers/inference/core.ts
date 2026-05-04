/**
 * C8: Architecture Layers - Core Inference
 *
 * WHY kept together (151 lines, exceeds 150 threshold):
 * - inferArchitectureLayers + buildGroupToLayerMap + buildGroupSummaries share GroupScore/GroupStats types
 * - buildGroupSummaries transforms GroupScore results from inferArchitectureLayers
 * - Splitting would fragment the layer inference core logic into <50 line files
 *
 * Contains layer assignment logic, score calculation, and group-to-layer mapping.
 */

import type { DirectoryGroup } from '../grouping.js';
import type { LayerAssignment, GroupStats, GroupSummary } from '../../types/index.js';

/**
 * Layer threshold for grouping adjacent scores
 *
 * C8-3 Resolution: Groups with score difference <= 2 merge to same layer.
 */
const LAYER_THRESHOLD = 2;

/**
 * Layer role names
 */
const LAYER_ROLES: Record<number, string> = {
  1: 'Foundation',
  2: 'Core',
  3: 'Application',
  4: 'Presentation',
};

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
 * Infer architecture layers from groups
 *
 * C8-3: Uses LAYER_THRESHOLD=2 for adjacent score merging.
 */
export function inferArchitectureLayers(
  groups: Map<string, DirectoryGroup>
): { layers: LayerAssignment[]; groupScores: GroupScore[] } {
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

  // Assign layers using threshold
  const layers: LayerAssignment[] = [];
  let currentLayer = 1;
  let currentLayerGroups: GroupStats[] = [];
  let prevScore = groupScores[0]?.netScore ?? 0;

  for (const score of groupScores) {
    const scoreDiff = Math.abs(score.netScore - prevScore);

    // C8-3: Start new layer if score difference > threshold
    if (scoreDiff > LAYER_THRESHOLD && currentLayerGroups.length > 0) {
      layers.push({
        layer: currentLayer,
        role: LAYER_ROLES[currentLayer] || `Layer ${currentLayer}`,
        groups: currentLayerGroups,
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
    layers.push({
      layer: currentLayer,
      role: LAYER_ROLES[currentLayer] || `Layer ${currentLayer}`,
      groups: currentLayerGroups,
    });
  }

  return { layers, groupScores };
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