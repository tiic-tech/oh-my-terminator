/**
 * Module Extractor
 *
 * Extracts MODULE nodes from TypeScript source files
 */

import ts from 'typescript';
import { ModuleExtractor } from './class.js';
import { detectKind } from './kind-detector.js';
import { calculateComplexity } from './complexity.js';
import { countLOC } from './loc-counter.js';
import { extractJSDoc } from './jsdoc-extractor.js';
import { generateModuleId } from './module-id.js';

// Re-export types
export * from './types.js';

// Re-export functions
export {
  ModuleExtractor,
  detectKind,
  calculateComplexity,
  countLOC,
  extractJSDoc,
  generateModuleId,
};

/**
 * Convenience function to extract modules
 *
 * @param sourceFiles - Array of source files to process
 * @param program - TypeScript program
 * @param projectRoot - Project root path
 * @returns Combined extraction result
 */
export function extractModules(
  sourceFiles: ts.SourceFile[],
  program: ts.Program,
  projectRoot: string
): ModuleExtractResult {
  const extractor = new ModuleExtractor(program, projectRoot);
  const result: ModuleExtractResult = {
    nodes: [],
    edges: [],
    warnings: [],
  };

  for (const sourceFile of sourceFiles) {
    const fileResult = extractor.extractModules(sourceFile);
    result.nodes.push(...fileResult.nodes);
    result.edges.push(...fileResult.edges);
    result.warnings.push(...fileResult.warnings);
  }

  return result;
}

// Import the type for local use
import { ModuleExtractResult } from './types.js';