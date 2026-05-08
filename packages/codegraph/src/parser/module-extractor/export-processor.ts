/**
 * Export Processor
 *
 * Process export declarations and re-exports
 */

import ts from 'typescript';
import { ModuleExtractResult, ExportInfoMap } from './types.js';
import { createSimpleModuleNode } from './node-builder.js';

/**
 * Process export declaration (export { x } or export { x as y })
 *
 * @param node - Export declaration node
 * @param _sourceFile - Source file (unused, kept for API consistency)
 * @param relativePath - Relative file path
 * @param fileId - Parent FILE node ID
 * @param result - Result accumulator
 * @param exportNames - Name collision tracker
 * @param exportInfoMap - Export info map
 */
export function processExportDeclaration(
  node: ts.ExportDeclaration,
  _sourceFile: ts.SourceFile,
  relativePath: string,
  fileId: string,
  result: ModuleExtractResult,
  exportNames: Map<string, number>,
  exportInfoMap: ExportInfoMap
): void {
  // Handle re-exports: export { name } from './file'
  if (node.moduleSpecifier) {
    processReExport(node, relativePath, fileId, result, exportNames);
    return;
  }

  if (!node.exportClause) {
    return;
  }

  if (ts.isNamedExports(node.exportClause)) {
    for (const element of node.exportClause.elements) {
      const exportedName = element.name.text;
      const internalName = element.propertyName?.text ?? exportedName;

      // Skip if already processed in processDeclaration (declaration exists in file)
      // This handles cases like: function foo() {} export { foo }
      if (exportInfoMap.has(internalName)) {
        continue; // Already handled in processDeclaration
      }

      // Create MODULE node for exported-only symbols
      createSimpleModuleNode(
        relativePath,
        fileId,
        exportedName,
        result,
        exportNames,
        internalName !== exportedName ? internalName : undefined,
        'variable' // Default, we don't know the actual kind
      );
    }
  }
}

/**
 * Process re-export: export { name } from './file'
 *
 * @param node - Export declaration node
 * @param relativePath - Relative file path
 * @param fileId - Parent FILE node ID
 * @param result - Result accumulator
 * @param exportNames - Name collision tracker
 */
export function processReExport(
  node: ts.ExportDeclaration,
  relativePath: string,
  fileId: string,
  result: ModuleExtractResult,
  exportNames: Map<string, number>
): void {
  if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) {
    return;
  }

  // Get the specifier text for metadata
  if (!node.exportClause) {
    // export * from './file' - wildcard, create no MODULE nodes
    // This would require analyzing the source file which we skip for now
    return;
  }

  if (ts.isNamedExports(node.exportClause)) {
    for (const element of node.exportClause.elements) {
      const exportedName = element.name.text;
      const originalName = element.propertyName?.text ?? exportedName;

      // Create MODULE node for the re-exported symbol
      // Kind is unknown without analyzing source file - use 'variable' as default
      createSimpleModuleNode(
        relativePath,
        fileId,
        exportedName,
        result,
        exportNames,
        originalName !== exportedName ? originalName : undefined,
        'variable'
      );
    }
  }
}