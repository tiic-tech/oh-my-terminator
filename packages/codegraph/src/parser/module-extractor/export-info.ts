/**
 * Export Info Utilities
 *
 * Utilities for handling export declarations and getting declaration names
 */

import ts from 'typescript';
import { ExportInfoMap } from './types.js';

/**
 * Collect export info from export declaration
 *
 * @param node - Export declaration node
 * @param exportInfoMap - Map to populate with export info
 */
export function collectExportInfo(
  node: ts.ExportDeclaration,
  exportInfoMap: ExportInfoMap
): void {
  // Check for default keyword
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  const isDefault = modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword);

  // Handle: export default identifier
  if (isDefault && node.exportClause && ts.isIdentifier(node.exportClause)) {
    const internalName = node.exportClause.text;
    const existing = exportInfoMap.get(internalName) ?? { exportTypes: [], exportedNames: [] };
    existing.exportTypes.push('default');
    existing.exportedNames.push(internalName); // default export uses original name
    exportInfoMap.set(internalName, existing);
    return;
  }

  if (!node.exportClause) {
    // export * from './file' - wildcard, skip
    return;
  }

  if (ts.isNamedExports(node.exportClause)) {
    for (const element of node.exportClause.elements) {
      const internalName = element.propertyName?.text ?? element.name.text;
      const exportedName = element.name.text;

      const existing = exportInfoMap.get(internalName) ?? { exportTypes: [], exportedNames: [] };
      existing.exportTypes.push('named');
      existing.exportedNames.push(exportedName);
      exportInfoMap.set(internalName, existing);
    }
  }
}

/**
 * Get declaration name (internal symbol name)
 *
 * @param node - AST node
 * @param sourceFile - Source file for text extraction
 * @returns Declaration name or undefined
 */
export function getDeclarationName(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
  if (ts.isFunctionDeclaration(node) && node.name) {
    return node.name.text;
  }
  if (ts.isClassDeclaration(node) && node.name) {
    return node.name.text;
  }
  if (ts.isInterfaceDeclaration(node)) {
    return node.name.text;
  }
  if (ts.isTypeAliasDeclaration(node)) {
    return node.name.text;
  }
  if (ts.isEnumDeclaration(node)) {
    return node.name.text;
  }
  if (ts.isVariableStatement(node)) {
    // Return first variable name
    const decls = node.declarationList.declarations;
    if (decls.length > 0) {
      return decls[0].name.getText(sourceFile);
    }
  }
  return undefined;
}

/**
 * Safely get modifiers from a node
 *
 * @param node - AST node
 * @returns Modifiers array or undefined
 */
function getModifiersSafe(node: ts.Node): readonly ts.Modifier[] | undefined {
  return ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
}

/**
 * Check if node has a specific modifier kind
 *
 * @param node - AST node to check
 * @param kind - SyntaxKind to look for
 * @returns True if node has the specified modifier
 */
function hasModifierKind(node: ts.Node, kind: ts.SyntaxKind): boolean {
  const modifiers = getModifiersSafe(node);
  return modifiers?.some(m => m.kind === kind) ?? false;
}

/**
 * Check if node is exported
 *
 * @param node - AST node to check
 * @returns True if node has export modifier (either named or default)
 */
export function isExported(node: ts.Node): boolean {
  return hasModifierKind(node, ts.SyntaxKind.ExportKeyword) ||
         hasModifierKind(node, ts.SyntaxKind.DefaultKeyword);
}

/**
 * Check if node has default modifier
 *
 * @param node - AST node to check
 * @returns True if node has default modifier
 */
export function isDefaultExport(node: ts.Node): boolean {
  return hasModifierKind(node, ts.SyntaxKind.DefaultKeyword);
}