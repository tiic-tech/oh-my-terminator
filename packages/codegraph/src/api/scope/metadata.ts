import { CodeGraph, NodeType, type GraphNode } from '../../types.js';
import { type ComplexityInfo, type ModifiedInfo } from '../types/index.js';

/** Complexity thresholds for level classification
 *
 * WHY adjusted from McCabe's original (10=medium, 20=high):
 * - Modern JS patterns (async/await, optional chaining) add decision points
 * - TypeScript generics and type guards increase apparent complexity
 * - Lambda expressions and functional patterns are idiomatic, not "complex"
 * - Empirical data: modern codebases average 8-12 CC per function
 *
 * Threshold rationale:
 * - low (1-5): Simple, single-purpose, easy to test
 * - medium (6-15): Acceptable, may need minor cleanup
 * - high (16-25): Consider refactoring, test coverage critical
 * - critical (26+): Strong refactoring candidate, risky to maintain
 */
const COMPLEXITY_THRESHOLDS = {
  LOW_MAX: 5,
  MEDIUM_MAX: 15,
  HIGH_MAX: 25,
} as const;

/**
 * Get MODULE nodes for a specific file path
 *
 * WHY extracted: Eliminates repeated graph iteration pattern across 4 functions.
 * One Truth principle: Single source for module node filtering logic.
 *
 * @param graph - CodeGraph instance
 * @param filePath - File path to filter by
 * @returns Array of MODULE nodes for the file
 */
function getModuleNodesForFile(graph: CodeGraph, filePath: string): GraphNode[] {
  const modules: GraphNode[] = [];
  for (const [, node] of graph.nodes) {
    if (node.type === NodeType.MODULE && node.path === filePath) {
      modules.push(node);
    }
  }
  return modules;
}

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
  const modules = getModuleNodesForFile(graph, fileNode.path);
  for (const node of modules) {
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

  const modules = getModuleNodesForFile(graph, fileNode.path);
  for (const node of modules) {
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
 *
 * HIGH Issue Fix: value=0 returns 'unknown' (no analysis), not 'low' (known simple)
 * Rationale: 'low' implies measured simplicity; 'unknown' indicates absent data.
 *
 * Thresholds: low(1-5), medium(6-15), high(16-25), critical(26+), unknown(0)
 */
function getComplexityLevel(value: number): 'low' | 'medium' | 'high' | 'critical' | 'unknown' {
  if (value === 0) return 'unknown';
  if (value <= COMPLEXITY_THRESHOLDS.LOW_MAX) return 'low';
  if (value <= COMPLEXITY_THRESHOLDS.MEDIUM_MAX) return 'medium';
  if (value <= COMPLEXITY_THRESHOLDS.HIGH_MAX) return 'high';
  return 'critical';
}

/**
 * Check if any MODULE in a FILE is deprecated
 *
 * @param graph - CodeGraph instance
 * @param fileNode - FILE node to check
 * @returns True if any export is deprecated
 */
export function checkDeprecated(graph: CodeGraph, fileNode: GraphNode): boolean {
  const modules = getModuleNodesForFile(graph, fileNode.path);
  for (const node of modules) {
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

  const modules = getModuleNodesForFile(graph, fileNode.path);
  for (const node of modules) {
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