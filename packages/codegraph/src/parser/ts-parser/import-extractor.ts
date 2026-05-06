/**
 * Import Extractor
 *
 * Extracts import information from TypeScript source files.
 */

import ts from 'typescript';
import { ParsedImportInfo } from './types.js';
import { getModuleSpecifier, getImportSpecifierType, getExportSpecifierType } from './utils.js';
import { resolveModulePath } from './program.js';
import { getRelativePath } from './path-utils.js';

/**
 * Extract all imports from a source file
 *
 * Handles:
 * - Import declarations: import { x } from './utils'
 * - Export declarations with source: export { x } from './utils'
 * - Dynamic imports: import('./utils')
 *
 * @param sourceFile - TypeScript source file
 * @param relativePath - Relative path for the source file
 * @param program - TypeScript Program for module resolution
 * @param projectRoot - Project root for relative path calculation
 * @returns Array of ParsedImportInfo objects
 */
export function extractImports(
  sourceFile: ts.SourceFile,
  relativePath: string,
  program: ts.Program,
  projectRoot: string
): ParsedImportInfo[] {
  const imports: ParsedImportInfo[] = [];

  // Helper to resolve specifier
  const resolveSpecifier = (specifier: string, sourceFileName: string): string | null => {
    const resolved = resolveModulePath(specifier, sourceFileName, program);
    if (resolved) {
      return getRelativePath(projectRoot, resolved);
    }
    return null;
  };

  // Traverse all nodes in the source file
  const visit = (node: ts.Node) => {
    // Import declarations
    if (ts.isImportDeclaration(node)) {
      const specifier = getModuleSpecifier(node);
      if (specifier) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        const resolvedPath = resolveSpecifier(specifier, sourceFile.fileName);
        const importSpecifier = getImportSpecifierType(node, sourceFile);
        // Detect type-only imports: import type { X } from './types'
        // TypeScript Compiler API provides isTypeOnly on ImportClause
        const isTypeOnly = node.importClause?.isTypeOnly ?? false;

        imports.push({
          sourceFile: relativePath,
          specifier,
          resolvedPath,
          line,
          importType: 'import',
          importSpecifier,
          importKind: isTypeOnly ? 'type-only' : 'value',
        });
      }
      return; // Don't traverse into import declarations
    }

    // Export declarations with source
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const specifier = getModuleSpecifier(node);
      if (specifier) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        const resolvedPath = resolveSpecifier(specifier, sourceFile.fileName);
        const importSpecifier = getExportSpecifierType(node, sourceFile);
        // Detect type-only re-exports: export type { X } from './types'
        // TypeScript Compiler API provides isTypeOnly on ExportDeclaration
        const isTypeOnly = node.isTypeOnly;

        imports.push({
          sourceFile: relativePath,
          specifier,
          resolvedPath,
          line,
          importType: 're-export',
          importSpecifier,
          importKind: isTypeOnly ? 'type-only' : 'value',
        });
      }
      return; // Don't traverse into export declarations
    }

    // Dynamic imports (import() calls)
    if (ts.isCallExpression(node)) {
      const exprText = node.expression.getText(sourceFile);
      if (exprText === 'import' || (ts.isIdentifier(node.expression) && node.expression.text === 'import')) {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteral(arg)) {
          const specifier = arg.text;
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
          const resolvedPath = resolveSpecifier(specifier, sourceFile.fileName);

          imports.push({
            sourceFile: relativePath,
            specifier,
            resolvedPath,
            line,
            importType: 'dynamic',
            importSpecifier: 'dynamic',
            // Dynamic imports have no type-only concept - always value
            importKind: 'value',
          });
        } else if (arg) {
          // Variable argument - create placeholder
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
          imports.push({
            sourceFile: relativePath,
            specifier: '__dynamic__',
            resolvedPath: null,
            line,
            importType: 'dynamic',
            importSpecifier: 'dynamic',
            // Dynamic imports have no type-only concept - always value
            importKind: 'value',
          });
        }
      }
    }

    // Continue traversal
    ts.forEachChild(node, visit);
  };

  // Start traversal
  ts.forEachChild(sourceFile, visit);

  return imports;
}