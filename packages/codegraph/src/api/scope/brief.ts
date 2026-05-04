/**
 * C7: QuickBrief API
 *
 * Get minimal statistics for a FILE node.
 */

import { CodeGraph } from '../../types.js';
import { type QuickBriefResult, type QuickBriefError, ErrorCode } from '../types/index.js';
import { findTestFile, aggregateComplexity, checkDeprecated } from './metadata.js';
import { countImports, countImportedBy } from './count.js';
import { formatQuickBriefOutput } from './format/index.js';
import { createBriefError } from './errors.js';

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