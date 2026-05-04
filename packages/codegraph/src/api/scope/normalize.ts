/**
 * C7: Scope Query - Target Normalization
 *
 * D1 Resolution: normalizeTarget handles 4 input types in single entry point.
 */

import { CodeGraph, NodeType, type GraphNode } from '../../types.js';
import { type NormalizedTarget, type TargetType } from '../types/index.js';

/**
 * Normalize target input to a valid query target
 *
 * Handles four input types:
 * 1. FILE:xxx → direct lookup
 * 2. MODULE:xxx#yyy → resolve to parent FILE
 * 3. EXTERNAL:xxx → special handling (A1 resolution)
 * 4. Plain path → auto-prefix FILE:
 *
 * @param graph - CodeGraph instance
 * @param target - Target string
 * @returns Normalized target with node references
 */
export function normalizeTarget(graph: CodeGraph, target: string): NormalizedTarget {
  // Case 1: FILE node
  if (target.startsWith('FILE:')) {
    const fileNode = graph.getNode(target);
    return {
      fileNode: fileNode || null,
      moduleNode: null,
      originalTarget: target,
      targetType: 'FILE',
    };
  }

  // Case 2: MODULE node
  if (target.startsWith('MODULE:')) {
    const moduleNode = graph.getNode(target);
    if (!moduleNode) {
      // A5 resolution: MODULE ID not found, return null for warning generation
      return {
        fileNode: null,
        moduleNode: null,
        originalTarget: target,
        targetType: 'MODULE',
      };
    }

    // Resolve parent FILE node
    const filePath = moduleNode.path;
    const fileId = `FILE:${filePath}`;
    const fileNode = graph.getNode(fileId);

    return {
      fileNode: fileNode || null,
      moduleNode,
      originalTarget: target,
      targetType: 'MODULE',
    };
  }

  // Case 3: EXTERNAL node (A1 resolution)
  if (target.startsWith('EXTERNAL:')) {
    const externalNode = graph.getNode(target);
    return {
      fileNode: externalNode || null,
      moduleNode: null,
      originalTarget: target,
      targetType: 'EXTERNAL',
    };
  }

  // Case 4: Plain path → auto-prefix FILE:
  const fileId = `FILE:${target}`;
  const fileNode = graph.getNode(fileId);
  return {
    fileNode: fileNode || null,
    moduleNode: null,
    originalTarget: fileId,
    targetType: 'PATH',
  };
}