/**
 * C8: Architecture Layers - Layer Inference
 *
 * Infers architecture layers from import direction statistics.
 */

import type { DirectoryGroup } from './grouping.js';
import type { LayerAssignment, GroupStats, GroupSummary, LayerViolation, ViolationSeverity } from '../types.js';
import type { CodeGraph } from '../../graph.js';
import { EdgeType } from '../../types.js';
import { getGroupNameFromFile } from './grouping.js';

/**
 * Layer threshold for grouping adjacent scores
 *
 * C8-3 Resolution: Groups with score difference ≤ 2 merge to same layer.
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
 * Score data for a group
 */
interface GroupScore {
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
 * Detect layer violations
 *
 * C8-10: Uses layerGap (renamed from expectedLayerGap).
 * C8-11: Same-layer mutual imports NOT violations.
 */
export function detectLayerViolations(
  graph: CodeGraph,
  groupToLayer: Map<string, number>,
  sourceRoot: string = 'src',
  options?: { warnOnMutualImport?: boolean }
): LayerViolation[] {
  const violations: LayerViolation[] = [];
  const mutualWarnings: string[] = [];
  const violationMap = new Map<string, { count: number; affectedFiles: { from: string; to: string }[] }>();

  // Iterate edges to find actual violating file pairs
  for (const edge of graph.edges) {
    // Only check IMPORTS and RE_EXPORTS
    if (edge.type !== EdgeType.IMPORTS && edge.type !== EdgeType.RE_EXPORTS) {
      continue;
    }

    const fromFile = edge.from;
    const toFile = edge.to;

    // Skip non-FILE edges
    if (!fromFile.startsWith('FILE:') || !toFile.startsWith('FILE:')) {
      continue;
    }

    const fromGroup = getGroupNameFromFile(fromFile, sourceRoot);
    const toGroup = getGroupNameFromFile(toFile, sourceRoot);

    // Skip external or same-group
    if (fromGroup === '__external__' || toGroup === '__external__' || fromGroup === toGroup) {
      continue;
    }

    const fromLayer = groupToLayer.get(fromGroup) ?? 0;
    const toLayer = groupToLayer.get(toGroup) ?? 0;

    // C8-11: Same-layer not violation
    if (fromLayer === toLayer) {
      if (options?.warnOnMutualImport) {
        mutualWarnings.push(`${fromGroup} and ${toGroup} have mutual imports (same layer)`);
      }
      continue;
    }

    // Violation: Low layer imports high layer
    if (fromLayer < toLayer) {
      const key = `${fromGroup}:${toGroup}`;
      const existing = violationMap.get(key);
      const fromPath = fromFile.replace('FILE:', '');
      const toPath = toFile.replace('FILE:', '');

      if (existing) {
        existing.count++;
        // Add unique file pair
        const pairExists = existing.affectedFiles.some(f => f.from === fromPath && f.to === toPath);
        if (!pairExists) {
          existing.affectedFiles.push({ from: fromPath, to: toPath });
        }
      } else {
        violationMap.set(key, {
          count: 1,
          affectedFiles: [{ from: fromPath, to: toPath }],
        });
      }
    }
  }

  // Build violation objects
  for (const [key, data] of violationMap) {
    const [fromGroup, toGroup] = key.split(':');
    const fromLayer = groupToLayer.get(fromGroup) ?? 0;
    const toLayer = groupToLayer.get(toGroup) ?? 0;
    const layerGap = toLayer - fromLayer;
    const severity = calculateSeverity(layerGap);

    violations.push({
      fromGroup,
      toGroup,
      count: data.count,
      affectedFiles: data.affectedFiles,
      layerGap,
      severity,
      suggestion: generateViolationSuggestion(fromGroup, toGroup, layerGap),
    });
  }

  // Sort violations by severity (critical first)
  violations.sort((a, b) => {
    const severityOrder = { critical: 0, moderate: 1, minor: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return violations;
}

/**
 * Calculate violation severity from layerGap
 *
 * C8-5: minor=-5, moderate=-10, critical=-15.
 */
export function calculateSeverity(layerGap: number): ViolationSeverity {
  if (layerGap >= 3) {
    return 'critical';
  }
  if (layerGap === 2) {
    return 'moderate';
  }
  return 'minor';
}

/**
 * Generate violation remediation suggestion
 */
export function generateViolationSuggestion(
  fromGroup: string,
  toGroup: string,
  layerGap: number
): string {
  if (layerGap >= 3) {
    return `Critical violation: ${fromGroup} (lower layer) imports ${toGroup} (higher layer). Consider restructuring architecture`;
  }
  if (layerGap === 2) {
    return `Move shared logic from ${toGroup} to ${fromGroup}, or create a shared middle layer`;
  }
  return `Consider moving the importing file to ${toGroup} directory`;
}

/**
 * Calculate health score from violations
 *
 * C8-5 Resolution: Base 100, subtract by severity weights.
 */
export function calculateLayerHealthScore(violations: LayerViolation[]): number {
  let score = 100;

  for (const violation of violations) {
    switch (violation.severity) {
      case 'minor':
        score -= 5;
        break;
      case 'moderate':
        score -= 10;
        break;
      case 'critical':
        score -= 15;
        break;
    }
  }

  return Math.max(0, score);
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