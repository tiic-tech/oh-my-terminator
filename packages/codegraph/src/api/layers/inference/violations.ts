/**
 * C8: Architecture Layers - Violation Detection
 *
 * WHY kept together (158 lines, exceeds 150 threshold):
 * - collectViolationsFromEdges + buildViolationObjects + detectLayerViolations form cohesive unit
 * - detectLayerViolations orchestrates the phases, splitting would fragment flow
 * - Original 93-line function already split into 3 focused helpers
 *
 * Responsibility: Detect layer violations by iterating edges and building
 * violation records with severity classification.
 */

import type { CodeGraph } from '../../../graph.js';
import { EdgeType } from '../../../types.js';
import type { LayerViolation, ViolationFilePair } from '../../types/index.js';
import { getGroupNameFromFile } from '../grouping.js';
import { calculateSeverity, generateViolationSuggestion } from './suggestions.js';

/**
 * Raw violation data collected from edges
 */
interface RawViolationData {
  count: number;
  affectedFiles: ViolationFilePair[];
}

/**
 * Collect violations from graph edges
 *
 * Iterates all IMPORTS/RE_EXPORTS edges to find violating file pairs.
 * Returns a map keyed by `${fromGroup}:${toGroup}`.
 */
function collectViolationsFromEdges(
  graph: CodeGraph,
  groupToLayer: Map<string, number>,
  sourceRoot: string,
  options?: { warnOnMutualImport?: boolean }
): Map<string, RawViolationData> {
  const violationMap = new Map<string, RawViolationData>();
  const mutualWarnings: string[] = [];

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
      const fromPath = fromFile.replace('FILE:', '');
      const toPath = toFile.replace('FILE:', '');

      const existing = violationMap.get(key);
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

  return violationMap;
}

/**
 * Build LayerViolation objects from raw violation data
 */
function buildViolationObjects(
  violationMap: Map<string, RawViolationData>,
  groupToLayer: Map<string, number>
): LayerViolation[] {
  const violations: LayerViolation[] = [];

  for (const [key, data] of violationMap) {
    const [fromGroup, toGroup] = key.split(':');
    const fromLayer = groupToLayer.get(fromGroup) ?? 0;
    const toLayer = groupToLayer.get(toGroup) ?? 0;
    const layerGap = toLayer - fromLayer;

    violations.push({
      fromGroup,
      toGroup,
      count: data.count,
      affectedFiles: data.affectedFiles,
      layerGap,
      severity: calculateSeverity(layerGap),
      suggestion: generateViolationSuggestion(fromGroup, toGroup, layerGap),
    });
  }

  return violations;
}

/**
 * Detect layer violations
 *
 * C8-10: Uses layerGap (renamed from expectedLayerGap).
 * C8-11: Same-layer mutual imports NOT violations.
 *
 * @param graph - CodeGraph instance
 * @param groupToLayer - Group to layer mapping
 * @param sourceRoot - Source root directory
 * @param options - Detection options
 * @returns Array of LayerViolation objects
 */
export function detectLayerViolations(
  graph: CodeGraph,
  groupToLayer: Map<string, number>,
  sourceRoot: string = 'src',
  options?: { warnOnMutualImport?: boolean }
): LayerViolation[] {
  // Phase 1: Collect violations from edges
  const violationMap = collectViolationsFromEdges(graph, groupToLayer, sourceRoot, options);

  // Phase 2: Build violation objects
  const violations = buildViolationObjects(violationMap, groupToLayer);

  // Phase 3: Sort by severity (critical first)
  violations.sort((a, b) => {
    const severityOrder = { critical: 0, moderate: 1, minor: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return violations;
}