/**
 * C7: Scope Query - Metadata Processing
 *
 * Find test files, aggregate complexity, check deprecated status.
 */

import { CodeGraph, NodeType, type GraphNode } from '../../types.js';
import { type ComplexityInfo, type ModifiedInfo } from '../types/index.js';

/** Complexity thresholds for level classification */
const COMPLEXITY_THRESHOLDS = {
  LOW_MAX: 5,
  MEDIUM_MAX: 15,
} as const;

/**
 * Find associated test file for a FILE node
 *
 * Priority:
 * 1. MODULE metadata.testFile
 * 2. Naming convention matching
 *
 * @param graph - CodeGraph instance
 * @param fileNode - FILE node to find test for
 * @returns Test file path or null
 */
export function findTestFile(graph: CodeGraph, fileNode: GraphNode): string | null {
  // Priority 1: Check MODULE nodes for metadata.testFile
  for (const [, node] of graph.nodes) {
    if (node.type !== NodeType.MODULE) continue;
    if (node.path !== fileNode.path) continue;

    if (node.metadata?.testFile) {
      return node.metadata.testFile;
    }
  }

  // Priority 2: Naming convention matching
  const filePath = fileNode.path;

  const testPatterns = [
    filePath.replace(/\.ts$/, '.test.ts'),
    filePath.replace(/\.tsx$/, '.test.tsx'),
    filePath.replace(/^src\//, 'src/__tests__/'),
    filePath.replace(/^src\//, 'tests/'),
    filePath.replace(/\.ts$/, '.spec.ts'),
  ];

  for (const testPath of testPatterns) {
    const testId = `FILE:${testPath}`;
    if (graph.getNode(testId)) {
      return testPath;
    }
  }

  return null;
}

/**
 * Aggregate complexity from MODULE nodes
 *
 * A6 Resolution: Returns "unknown" when no MODULE data exists.
 * Reason: "low" implies known low complexity, "unknown" indicates no analysis.
 *
 * @param graph - CodeGraph instance
 * @param fileNode - FILE node
 * @param moduleNode - Optional MODULE node for direct complexity
 * @returns Complexity info with level and value
 */
export function aggregateComplexity(
  graph: CodeGraph,
  fileNode: GraphNode,
  moduleNode?: GraphNode | null
): ComplexityInfo {
  // MODULE node: direct return
  if (moduleNode && moduleNode.metadata?.complexity !== undefined) {
    const value = moduleNode.metadata.complexity;
    return { level: getComplexityLevel(value), value };
  }

  // FILE node: aggregate
  if (!fileNode) {
    return { level: 'unknown', value: 0 };
  }

  let totalComplexity = 0;
  let hasModuleData = false;

  for (const [, node] of graph.nodes) {
    if (node.type !== NodeType.MODULE) continue;
    if (node.path !== fileNode.path) continue;

    if (node.metadata?.complexity !== undefined) {
      totalComplexity += node.metadata.complexity;
      hasModuleData = true;
    }
  }

  // A6 Resolution: Return "unknown" when no MODULE data
  if (!hasModuleData) {
    return { level: 'unknown', value: 0 };
  }

  return { level: getComplexityLevel(totalComplexity), value: totalComplexity };
}

/**
 * Determine complexity level from numeric value
 */
function getComplexityLevel(value: number): 'low' | 'medium' | 'high' {
  if (value <= COMPLEXITY_THRESHOLDS.LOW_MAX) return 'low';
  if (value <= COMPLEXITY_THRESHOLDS.MEDIUM_MAX) return 'medium';
  return 'high';
}

/**
 * Check if any MODULE in a FILE is deprecated
 *
 * @param graph - CodeGraph instance
 * @param fileNode - FILE node to check
 * @returns True if any export is deprecated
 */
export function checkDeprecated(graph: CodeGraph, fileNode: GraphNode): boolean {
  for (const [, node] of graph.nodes) {
    if (node.type !== NodeType.MODULE) continue;
    if (node.path !== fileNode.path) continue;

    if (node.metadata?.deprecated) {
      return true;
    }
  }
  return false;
}

/**
 * Extract last modified information from MODULE nodes
 *
 * @param graph - CodeGraph instance
 * @param fileNode - FILE node
 * @returns Modified info with commit and relative time
 */
export function getLastModified(graph: CodeGraph, fileNode: GraphNode): ModifiedInfo {
  const result: ModifiedInfo = {};

  let latestCommit: string | undefined;
  let maxFrequency = 0;

  for (const [, node] of graph.nodes) {
    if (node.type !== NodeType.MODULE) continue;
    if (node.path !== fileNode.path) continue;

    if (node.metadata?.lastModifiedCommit) {
      latestCommit = node.metadata.lastModifiedCommit;
    }
    if (node.metadata?.changeFrequency !== undefined) {
      maxFrequency = Math.max(maxFrequency, node.metadata.changeFrequency);
    }
  }

  if (latestCommit) {
    result.commit = latestCommit;
  }

  if (maxFrequency > 0) {
    result.relativeTime = `${maxFrequency} commits in last 30 days`;
  }

  return result;
}