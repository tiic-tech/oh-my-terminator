/**
 * C7: EXTERNAL Node Scope Handler
 *
 * A1 Resolution: Special handling for EXTERNAL packages.
 */

import type { CodeGraph } from '../../graph.js';
import { type GraphNode } from '../../types.js';
import { type ScopeResult, type ImportedByInfo } from '../types/index.js';
import { extractImportedBy } from './extract.js';
import { formatScopeOutput } from './format/index.js';

/**
 * Generate Scope result for EXTERNAL nodes
 */
export function getScopeForExternal(
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