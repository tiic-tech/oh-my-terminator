/**
 * C7: Scope Query API
 *
 * Get complete context for FILE, MODULE, or EXTERNAL nodes.
 */

import { CodeGraph, NodeType, type GraphNode } from '../../types.js';
import {
  type ScopeResult,
  type ScopeError,
  type ExportInfo,
  type ImportInfo,
  type ImportedByInfo,
  ErrorCode,
} from '../types/index.js';
import { normalizeTarget } from './normalize.js';
import { extractExports, extractImports, extractImportedBy } from './extract.js';
import { findTestFile, aggregateComplexity, checkDeprecated, getLastModified } from './metadata.js';
import { formatScopeOutput } from './format/index.js';
import { createScopeError } from './errors.js';
import { getScopeForExternal } from './external.js';

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