/**
 * C7: Scope Query and QuickBrief Implementation
 *
 * Provides Agent-friendly APIs for querying CodeGraph context.
 */

import { CodeGraph, NodeType, EdgeType, type GraphNode } from '../types.js';
import {
  type ScopeResult,
  type ScopeError,
  type QuickBriefResult,
  type QuickBriefError,
  type ComplexityInfo,
  type ExportInfo,
  type ImportInfo,
  type ImportedByInfo,
  type ModifiedInfo,
  type NormalizedTarget,
  type TargetType,
  ErrorCode,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

/** Complexity thresholds for level classification */
const COMPLEXITY_THRESHOLDS = {
  LOW_MAX: 5,
  MEDIUM_MAX: 15,
} as const;

// ============================================================================
// normalizeTarget (Task 2.1, A1 Resolution)
// ============================================================================

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
    // MODULE:src/utils/format.ts#formatDate → FILE:src/utils/format.ts
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

  // Case 4: Plain path (no prefix) → auto-prefix FILE:
  const fileId = `FILE:${target}`;
  const fileNode = graph.getNode(fileId);
  return {
    fileNode: fileNode || null,
    moduleNode: null,
    originalTarget: fileId,
    targetType: 'PATH',
  };
}

// ============================================================================
// extractExports (Task 2.2)
// ============================================================================

/**
 * Extract export symbols from a FILE node
 *
 * Returns exports in "kind:name" format, sorted alphabetically.
 *
 * @param graph - CodeGraph instance
 * @param fileNode - FILE node to extract from
 * @returns Array of "kind:name" strings
 */
export function extractExports(graph: CodeGraph, fileNode: GraphNode): string[] {
  if (!fileNode || fileNode.type !== NodeType.FILE) {
    return [];
  }

  const exports: string[] = [];

  // Iterate all nodes, filter MODULEs belonging to this file
  for (const [, node] of graph.nodes) {
    if (node.type !== NodeType.MODULE) continue;
    if (node.path !== fileNode.path) continue;

    // Format: "kind:name" or "name" (no kind defaults to unknown)
    const kind = node.metadata?.kind || 'unknown';
    const name = node.name;
    exports.push(`${kind}:${name}`);
  }

  // Sort alphabetically
  exports.sort();
  return exports;
}

// ============================================================================
// extractImports (Task 2.3)
// ============================================================================

/**
 * Extract import targets from a FILE node's outEdges
 *
 * Handles IMPORTS, RE_EXPORTS, and DYNAMIC_IMPORTS edges.
 *
 * @param graph - CodeGraph instance
 * @param fileNode - FILE node to extract from
 * @returns Array of import target paths (deduplicated, sorted)
 */
export function extractImports(graph: CodeGraph, fileNode: GraphNode): string[] {
  if (!fileNode) return [];

  const imports = new Set<string>();
  const outEdges = graph.outEdges.get(fileNode.id) || [];

  for (const edge of outEdges) {
    // Process IMPORTS, RE_EXPORTS, DYNAMIC_IMPORTS edges
    if (
      edge.type === EdgeType.IMPORTS ||
      edge.type === EdgeType.RE_EXPORTS ||
      edge.type === EdgeType.DYNAMIC_IMPORTS
    ) {
      const targetNode = graph.getNode(edge.to);
      if (targetNode) {
        // Return path (without FILE: or EXTERNAL: prefix)
        imports.add(targetNode.path);
      }
    }
  }

  return Array.from(imports).sort();
}

// ============================================================================
// extractImportedBy (Task 2.4, A2 Resolution)
// ============================================================================

/**
 * Extract reverse dependencies from a node's inEdges
 *
 * A2 Resolution: DYNAMIC_IMPORTS edges are NOT included.
 * Reason: Dynamic imports resolve at runtime - the target cannot know
 * who dynamically imports it. This is inherent asymmetry in static analysis.
 *
 * @param graph - CodeGraph instance
 * @param fileNode - Node to extract from
 * @returns Array of source file paths (deduplicated, sorted)
 */
export function extractImportedBy(graph: CodeGraph, fileNode: GraphNode): string[] {
  if (!fileNode) return [];

  const importedBy = new Set<string>();
  const inEdges = graph.inEdges.get(fileNode.id) || [];

  for (const edge of inEdges) {
    // Process IMPORTS, RE_EXPORTS edges (NOT DYNAMIC_IMPORTS)
    // A2 Resolution: DYNAMIC_IMPORTS excluded from reverse index
    if (edge.type === EdgeType.IMPORTS || edge.type === EdgeType.RE_EXPORTS) {
      const sourceNode = graph.getNode(edge.from);
      if (sourceNode && sourceNode.type === NodeType.FILE) {
        importedBy.add(sourceNode.path);
      }
    }
  }

  return Array.from(importedBy).sort();
}

// ============================================================================
// findTestFile (Task 2.5)
// ============================================================================

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

  // Common test file naming patterns
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

// ============================================================================
// aggregateComplexity (Task 2.6, A6 Resolution)
// ============================================================================

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

// ============================================================================
// checkDeprecated (Task 2.7)
// ============================================================================

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

// ============================================================================
// getLastModified (Internal)
// ============================================================================

/**
 * Extract last modified information from MODULE nodes
 */
function getLastModified(graph: CodeGraph, fileNode: GraphNode): ModifiedInfo {
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

// ============================================================================
// countImports (Task 3.1, A4 Resolution)
// ============================================================================

/**
 * Count import edges for a FILE node
 *
 * A4 Resolution: Counts edges, not unique files.
 * Reason: Edge count reflects dependency density more accurately.
 *
 * @param graph - CodeGraph instance
 * @param fileNode - FILE node
 * @returns Number of import edges
 */
export function countImports(graph: CodeGraph, fileNode: GraphNode): number {
  const outEdges = graph.outEdges.get(fileNode.id) || [];
  return outEdges.filter(
    (e) =>
      e.type === EdgeType.IMPORTS ||
      e.type === EdgeType.RE_EXPORTS ||
      e.type === EdgeType.DYNAMIC_IMPORTS
  ).length;
}

// ============================================================================
// countImportedBy (Task 3.2, A2 Resolution)
// ============================================================================

/**
 * Count imported-by edges for a FILE node
 *
 * A2 Resolution: DYNAMIC_IMPORTS are NOT counted.
 * A4 Resolution: Counts edges, not unique files.
 *
 * @param graph - CodeGraph instance
 * @param fileNode - FILE node
 * @returns Number of imported-by edges
 */
export function countImportedBy(graph: CodeGraph, fileNode: GraphNode): number {
  const inEdges = graph.inEdges.get(fileNode.id) || [];
  return inEdges.filter(
    (e) => e.type === EdgeType.IMPORTS || e.type === EdgeType.RE_EXPORTS
  ).length;
}

// ============================================================================
// formatScopeOutput (Task 2.9)
// ============================================================================

/**
 * Generate Agent-friendly Markdown output for Scope query
 *
 * Target: ≤600 tokens (A3: MVP does not enforce truncation)
 *
 * @param target - Target string
 * @param exports - Export list
 * @param imports - Import list
 * @param importedBy - Imported-by list
 * @param testFile - Test file path
 * @param complexity - Complexity info
 * @param lastModified - Last modified info
 * @param deprecated - Deprecated flag
 * @param moduleNode - Optional MODULE node for MODULE-specific output
 */
export function formatScopeOutput(
  target: string,
  exports: ExportInfo[],
  imports: ImportInfo[],
  importedBy: ImportedByInfo[],
  testFile: string | null,
  complexity: ComplexityInfo,
  lastModified: ModifiedInfo,
  deprecated: boolean,
  moduleNode?: GraphNode | null
): string {
  // Extract path from target
  const pathMatch = target.match(/(?:FILE:|MODULE:)?([^#]+)/);
  const path = pathMatch ? pathMatch[1] : target;
  const name = path.split('/').pop() || path;

  // MODULE-specific output
  if (moduleNode) {
    const kind = moduleNode.metadata?.kind || 'unknown';
    const jsDoc = moduleNode.metadata?.jsDoc
      ? moduleNode.metadata.jsDoc.slice(0, 100) + '...'
      : 'none';

    return `## Scope: ${moduleNode.name} (${path})

### Kind
- ${kind} (exported)

### JSDoc (truncated)
- ${jsDoc}

### Imported by (${importedBy.length})
${importedBy.length > 0 ? importedBy.map(i => `- ${i.file}`).join('\n') : '- none'}

### Metadata
- Test: ${testFile || 'none'}
- Complexity: ${complexity.level} (${complexity.value})
- Deprecated: ${deprecated ? 'yes (WARNING)' : 'no'}
`;
  }

  // FILE or EXTERNAL output
  const isExternal = target.startsWith('EXTERNAL:');
  const headerName = isExternal ? name : path;

  let content = `## Scope: ${headerName}\n\n`;

  // Exports section (skip for EXTERNAL)
  if (!isExternal) {
    content += `### Exports (${exports.length})\n`;
    if (exports.length > 0) {
      // Group exports by kind for compact display
      const byKind: Record<string, string[]> = {};
      for (const exp of exports) {
        if (!byKind[exp.kind]) byKind[exp.kind] = [];
        byKind[exp.kind].push(exp.name);
      }
      for (const [kind, names] of Object.entries(byKind)) {
        content += `- ${kind}:${names.join(', ')}\n`;
      }
    } else {
      content += '- none\n';
    }
    content += '\n';
  }

  // Imports section (skip for EXTERNAL)
  if (!isExternal) {
    content += `### Imports (${imports.length})\n`;
    if (imports.length > 0) {
      for (const imp of imports) {
        content += `- ${imp.from} (${imp.type})\n`;
      }
    } else {
      content += '- none (leaf file)\n';
    }
    content += '\n';
  }

  // Imported by section
  content += `### Imported by (${importedBy.length})\n`;
  if (importedBy.length > 0) {
    content += `- ${importedBy.map(i => i.file).join(', ')}\n`;
  } else {
    content += '- none (isolated)\n';
  }
  content += '\n';

  // Metadata section
  content += '### Metadata\n';
  content += `- Test: ${testFile || 'none'}\n`;
  content += `- Complexity: ${complexity.level} (${complexity.value})\n`;
  if (lastModified.relativeTime) {
    content += `- Modified: ${lastModified.relativeTime}\n`;
  }
  content += `- Deprecated: ${deprecated ? 'yes (WARNING)' : 'no'}\n`;

  // Note for EXTERNAL
  if (isExternal) {
    content += '\n### Note\n- External package from node_modules\n- No exports/imports data available\n';
  }

  return content;
}

// ============================================================================
// formatQuickBriefOutput (Task 3.3)
// ============================================================================

/**
 * Generate compact Markdown output for QuickBrief
 *
 * Target: ≤50 tokens
 */
export function formatQuickBriefOutput(
  filePath: string,
  importCount: number,
  importedByCount: number,
  hasTest: boolean,
  deprecated: boolean,
  complexityLevel: string
): string {
  const fileName = filePath.split('/').pop() || filePath;
  const testStatus = hasTest ? 'yes' : 'no';
  const deprecatedStatus = deprecated ? 'yes (WARNING)' : 'no';

  return `## Brief: ${filePath}
- Imports: ${importCount}
- Imported by: ${importedByCount}
- Test: ${testStatus}
- Deprecated: ${deprecatedStatus}
- Complexity: ${complexityLevel}`;
}

// ============================================================================
// getScopeForExternal (Task 2.8, A1 Resolution)
// ============================================================================

/**
 * Generate Scope result for EXTERNAL nodes
 *
 * A1 Resolution: Special handling for EXTERNAL packages.
 * Returns only importedBy information (no exports/imports).
 */
function getScopeForExternal(
  graph: CodeGraph,
  node: GraphNode,
  startTime: number
): ScopeResult {
  const importedBy = extractImportedBy(graph, node);

  const importedByInfo: ImportedByInfo[] = importedBy.map((file) => ({
    file,
    specifiers: [],
  }));

  const content = formatScopeOutput(
    node.id,
    [],
    [],
    importedByInfo,
    null,
    { level: 'unknown', value: 0 },
    {},
    false,
    null
  );

  return {
    success: true,
    target: node.id,
    exports: [],
    imports: [],
    importedBy: importedByInfo,
    testFile: null,
    complexity: { level: 'unknown', value: 0 },
    lastModified: {},
    metadata: { hasTest: false, deprecated: false },
    durationMs: Date.now() - startTime,
    warnings: [],
    nextSuggested: [`codegraph impact ${node.id}`],
    content,
    upstreamCalls: [],
    downstreamCalls: [],
  };
}

// ============================================================================
// createErrorResult (Internal)
// ============================================================================

function createScopeError(
  code: string,
  message: string,
  suggestion?: string,
  startTime: number
): ScopeError {
  return {
    success: false,
    error: {
      code,
      message,
      suggestion,
    },
    durationMs: Date.now() - startTime,
  };
}

function createBriefError(
  code: string,
  message: string,
  suggestion?: string,
  startTime: number
): QuickBriefError {
  return {
    success: false,
    error: {
      code,
      message,
      suggestion,
    },
    durationMs: Date.now() - startTime,
  };
}

// ============================================================================
// getScope (Task 2.10)
// ============================================================================

/**
 * Scope Query API
 *
 * Get complete context for FILE, MODULE, or EXTERNAL nodes.
 *
 * @param graph - CodeGraph instance
 * @param target - Target ID (FILE:xxx, MODULE:xxx#yyy, EXTERNAL:xxx, or plain path)
 * @returns ScopeResult or ScopeError
 */
export function getScope(graph: CodeGraph, target: string): ScopeResult | ScopeError {
  const startTime = Date.now();

  const normalized = normalizeTarget(graph, target);

  // A5 Resolution: MODULE ID not found - specific warning
  if (normalized.targetType === 'MODULE' && !normalized.moduleNode) {
    return createScopeError(
      ErrorCode.TARGET_NOT_FOUND,
      `MODULE node not found: ${target}`,
      'Check if the export name exists in the file',
      startTime
    );
  }

  // Error handling: target not found
  if (!normalized.fileNode && !normalized.moduleNode) {
    return createScopeError(
      ErrorCode.TARGET_NOT_FOUND,
      `Target not found: ${target}`,
      'Run `codegraph analyze` to build graph first',
      startTime
    );
  }

  // A1 Resolution: EXTERNAL node special handling
  if (normalized.fileNode?.type === NodeType.EXTERNAL) {
    return getScopeForExternal(graph, normalized.fileNode, startTime);
  }

  const fileNode = normalized.fileNode!;
  const moduleNode = normalized.moduleNode;

  // Extract data
  const exportStrings = extractExports(graph, fileNode);
  const importPaths = extractImports(graph, fileNode);
  const importedByPaths = extractImportedBy(graph, fileNode);
  const testFile = findTestFile(graph, fileNode);
  const complexity = aggregateComplexity(graph, fileNode, moduleNode);
  const lastModified = getLastModified(graph, fileNode);
  const deprecated = checkDeprecated(graph, fileNode);

  // Convert to CLI-compatible formats
  const exports: ExportInfo[] = exportStrings.map((str) => {
    const [kind, name] = str.split(':');
    return {
      name,
      kind,
      id: `MODULE:${fileNode.path}#${name}`,
    };
  });

  const imports: ImportInfo[] = importPaths.map((path) => ({
    from: path,
    type: 'static',
    specifiers: [],
  }));

  const importedBy: ImportedByInfo[] = importedByPaths.map((file) => ({
    file,
    specifiers: [],
  }));

  // Generate Markdown output
  const content = formatScopeOutput(
    normalized.originalTarget,
    exports,
    imports,
    importedBy,
    testFile,
    complexity,
    lastModified,
    deprecated,
    moduleNode
  );

  return {
    success: true,
    target: normalized.originalTarget,
    exports,
    imports,
    importedBy,
    testFile,
    complexity,
    lastModified,
    metadata: {
      hasTest: testFile !== null,
      deprecated,
    },
    durationMs: Date.now() - startTime,
    warnings: [],
    nextSuggested: [`codegraph impact ${normalized.originalTarget}`],
    content,
    upstreamCalls: [], // MVP: empty, TODO for M2
    downstreamCalls: [], // MVP: empty, TODO for M2
  };
}

// ============================================================================
// getQuickBrief (Task 3.4)
// ============================================================================

/**
 * QuickBrief API
 *
 * Get minimal statistics for a FILE node.
 *
 * @param graph - CodeGraph instance
 * @param filePath - File path (with or without FILE: prefix)
 * @returns QuickBriefResult or QuickBriefError
 */
export function getQuickBrief(
  graph: CodeGraph,
  filePath: string
): QuickBriefResult | QuickBriefError {
  const startTime = Date.now();

  // Normalize input
  const target = filePath.startsWith('FILE:') ? filePath : `FILE:${filePath}`;
  const fileNode = graph.getNode(target);

  // Error handling: file not found
  if (!fileNode) {
    return createBriefError(
      ErrorCode.TARGET_NOT_FOUND,
      `File not found: ${filePath}`,
      'Run `codegraph analyze` to build graph first',
      startTime
    );
  }

  // Extract statistics
  const importCount = countImports(graph, fileNode);
  const importedByCount = countImportedBy(graph, fileNode);
  const hasTest = findTestFile(graph, fileNode) !== null;
  const deprecated = checkDeprecated(graph, fileNode);
  const complexity = aggregateComplexity(graph, fileNode);
  const complexityLevel = complexity.level;

  // Generate quickFacts
  const quickFacts: string[] = [];
  quickFacts.push(`${importCount} imports, ${importedByCount} dependents`);
  if (hasTest) quickFacts.push('Has test file');
  if (deprecated) quickFacts.push('Marked @deprecated');

  // Generate Markdown output
  const content = formatQuickBriefOutput(
    filePath,
    importCount,
    importedByCount,
    hasTest,
    deprecated,
    complexityLevel
  );

  return {
    success: true,
    file: filePath,
    imports: importCount,
    importedBy: importedByCount,
    hasTest,
    deprecated,
    complexityLevel,
    quickFacts,
    durationMs: Date.now() - startTime,
    content,
  };
}