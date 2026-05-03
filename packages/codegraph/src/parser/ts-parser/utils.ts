/**
 * Parser Utilities
 *
 * Helper functions for extracting import/export specifier information.
 */

import ts from 'typescript';

/**
 * Get module specifier string from import/export declaration
 *
 * @param node - Import or export declaration
 * @returns Module specifier string or null if not a string literal
 */
export function getModuleSpecifier(
  node: ts.ImportDeclaration | ts.ExportDeclaration
): string | null {
  if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
    return node.moduleSpecifier.text;
  }
  return null;
}

/**
 * Determine import specifier type for metadata
 *
 * Returns one of:
 * - 'default' - Default import: import x from './utils'
 * - 'namespace' - Namespace import: import * as utils from './utils'
 * - 'named:x,y' - Named imports: import { x, y } from './utils'
 * - 'empty' - Side-effect import: import './setup'
 *
 * @param node - Import declaration
 * @param sourceFile - Optional source file for text extraction
 * @returns Import specifier type string
 */
export function getImportSpecifierType(
  node: ts.ImportDeclaration,
  sourceFile?: ts.SourceFile
): string {
  const importClause = node.importClause;

  if (!importClause) {
    return 'empty'; // Side-effect import: import './setup'
  }

  // Default import
  if (importClause.name) {
    return 'default';
  }

  // Named bindings
  if (importClause.namedBindings) {
    if (ts.isNamespaceImport(importClause.namedBindings)) {
      return 'namespace';
    }
    if (ts.isNamedImports(importClause.namedBindings)) {
      const sf = sourceFile ?? node.getSourceFile();
      const names = importClause.namedBindings.elements
        .map((e) => e.name.getText(sf))
        .join(',');
      return `named:${names}`;
    }
  }

  return 'empty';
}

/**
 * Determine export specifier type for metadata
 *
 * Returns one of:
 * - 'wildcard' - Wildcard re-export: export * from './utils'
 * - 'named:x,y' - Named re-exports: export { x, y } from './utils'
 * - 'empty' - No export clause
 *
 * @param node - Export declaration
 * @param sourceFile - Optional source file for text extraction
 * @returns Export specifier type string
 */
export function getExportSpecifierType(
  node: ts.ExportDeclaration,
  sourceFile?: ts.SourceFile
): string {
  // Wildcard: export * from './utils'
  if (node.exportClause && ts.isNamespaceExport(node.exportClause)) {
    return 'wildcard';
  }

  // Named re-exports: export { x, y } from './utils'
  if (node.exportClause && ts.isNamedExports(node.exportClause)) {
    const sf = sourceFile ?? node.getSourceFile();
    const names = node.exportClause.elements
      .map((e) => e.name.getText(sf))
      .join(',');
    return `named:${names}`;
  }

  // No export clause: export * from './utils' (implicit wildcard)
  if (!node.exportClause) {
    return 'wildcard';
  }

  return 'empty';
}