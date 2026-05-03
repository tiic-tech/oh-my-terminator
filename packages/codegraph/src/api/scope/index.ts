/**
 * C7: Scope Query - Main API Entry
 *
 * Provides getScope and getQuickBrief APIs.
 */

import { CodeGraph, NodeType, type GraphNode } from '../../types.js';
import {
  type ScopeResult,
  type ScopeError,
  type QuickBriefResult,
  type QuickBriefError,
  type ExportInfo,
  type ImportInfo,
  type ImportedByInfo,
  ErrorCode,
} from '../types.js';
import { normalizeTarget } from './normalize.js';
import { extractExports, extractImports, extractImportedBy } from './extract.js';
import { findTestFile, aggregateComplexity, checkDeprecated, getLastModified } from './metadata.js';
import { countImports, countImportedBy } from './count.js';
import { formatScopeOutput, formatQuickBriefOutput } from './format.js';

// Re-export all sub-modules for external use (testing, etc.)
export { normalizeTarget } from './normalize.js';
export { extractExports, extractImports, extractImportedBy } from './extract.js';
export { findTestFile, aggregateComplexity, checkDeprecated } from './metadata.js';
export { countImports, countImportedBy } from './count.js';
export { formatScopeOutput, formatQuickBriefOutput } from './format.js';

/**
 * Generate Scope result for EXTERNAL nodes
 *
 * A1 Resolution: Special handling for EXTERNAL packages.
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

/**
 * Create Scope error result
 */
function createScopeError(
  code: string,
  message: string,
  suggestion?: string,
  startTime: number
): ScopeError {
  return {
    success: false,
    error: { code, message, suggestion },
    durationMs: Date.now() - startTime,
  };
}

/**
 * Create QuickBrief error result
 */
function createBriefError(
  code: string,
  message: string,
  suggestion?: string,
  startTime: number
): QuickBriefError {
  return {
    success: false,
    error: { code, message, suggestion },
    durationMs: Date.now() - startTime,
  };
}

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

  // Error: target not found
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
    return { name, kind, id: `MODULE:${fileNode.path}#${name}` };
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
    metadata: { hasTest: testFile !== null, deprecated },
    durationMs: Date.now() - startTime,
    warnings: [],
    nextSuggested: [`codegraph impact ${normalized.originalTarget}`],
    content,
    upstreamCalls: [],
    downstreamCalls: [],
  };
}

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

  const target = filePath.startsWith('FILE:') ? filePath : `FILE:${filePath}`;
  const fileNode = graph.getNode(target);

  if (!fileNode) {
    return createBriefError(
      ErrorCode.TARGET_NOT_FOUND,
      `File not found: ${filePath}`,
      'Run `codegraph analyze` to build graph first',
      startTime
    );
  }

  const importCount = countImports(graph, fileNode);
  const importedByCount = countImportedBy(graph, fileNode);
  const hasTest = findTestFile(graph, fileNode) !== null;
  const deprecated = checkDeprecated(graph, fileNode);
  const complexity = aggregateComplexity(graph, fileNode);
  const complexityLevel = complexity.level;

  const quickFacts: string[] = [];
  quickFacts.push(`${importCount} imports, ${importedByCount} dependents`);
  if (hasTest) quickFacts.push('Has test file');
  if (deprecated) quickFacts.push('Marked @deprecated');

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