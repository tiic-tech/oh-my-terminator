/**
 * Declaration Processor
 *
 * Process individual declarations to create MODULE nodes
 */

import ts from 'typescript';
import { ModuleExtractResult, ExportInfoMap } from './types.js';
import { ModuleKind } from './types.js';
import { detectKind } from './kind-detector.js';
import { createModuleNode } from './node-builder.js';
import { isExported, isDefaultExport } from './export-info.js';

/**
 * Process individual declaration
 *
 * @param node - AST node (declaration)
 * @param sourceFile - Source file
 * @param relativePath - Relative file path
 * @param fileId - Parent FILE node ID
 * @param result - Result accumulator
 * @param exportNames - Name collision tracker
 * @param exportInfoMap - Export info map
 */
export function processDeclaration(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  relativePath: string,
  fileId: string,
  result: ModuleExtractResult,
  exportNames: Map<string, number>,
  exportInfoMap: ExportInfoMap
): void {
  let name: string;
  let kind: ModuleKind;
  let hasName = true;
  let isDefault = false;
  let internalName: string | undefined;

  // Check if this is a default export
  isDefault = isDefaultExport(node);

  if (ts.isFunctionDeclaration(node)) {
    name = node.name?.text ?? 'default';
    hasName = !!node.name;
    internalName = node.name?.text;
    kind = detectKind(node, sourceFile);
  } else if (ts.isClassDeclaration(node)) {
    name = node.name?.text ?? 'default';
    hasName = !!node.name;
    internalName = node.name?.text;
    kind = 'class';
  } else if (ts.isInterfaceDeclaration(node)) {
    name = node.name.text;
    internalName = name;
    kind = 'interface';
  } else if (ts.isTypeAliasDeclaration(node)) {
    name = node.name.text;
    internalName = name;
    kind = 'type';
  } else if (ts.isEnumDeclaration(node)) {
    name = node.name.text;
    internalName = name;
    kind = 'type';
  } else if (ts.isVariableStatement(node)) {
    // Handle variable exports
    processVariableStatement(node, sourceFile, relativePath, fileId, result, exportNames, exportInfoMap);
    return;
  } else {
    return;
  }

  // Get export info for this symbol
  const exportInfo = internalName ? exportInfoMap.get(internalName) : undefined;
  const allExportTypes = collectExportTypes(node, isDefault, exportInfo);

  // Use first exported name from export info if available
  const exportName = (exportInfo && exportInfo.exportedNames.length > 0)
    ? exportInfo.exportedNames[0]
    : name;

  createModuleNode({
    node,
    sourceFile,
    relativePath,
    fileId,
    name: exportName,
    kind,
    result,
    exportNames,
    exportInfo: {
      hasName,
      isDefault,
      internalName,
      exportInfoMap,
      allExportTypes,
    },
  });
}

/**
 * Process variable statement declaration
 */
function processVariableStatement(
  node: ts.VariableStatement,
  sourceFile: ts.SourceFile,
  relativePath: string,
  fileId: string,
  result: ModuleExtractResult,
  exportNames: Map<string, number>,
  exportInfoMap: ExportInfoMap
): void {
  const decls = node.declarationList.declarations;
  for (const decl of decls) {
    const varName = decl.name.getText(sourceFile);
    const varKind = detectKind(decl, sourceFile);
    createModuleNode({
      node: decl,
      sourceFile,
      relativePath,
      fileId,
      name: varName,
      kind: varKind,
      result,
      exportNames,
      exportInfo: {
        hasName: true,
        isDefault: false,
        internalName: varName,
        exportInfoMap,
      },
    });
  }
}

/**
 * Collect all export types for a declaration
 */
function collectExportTypes(
  node: ts.Node,
  isDefault: boolean,
  exportInfo?: { exportTypes: string[] }
): string[] {
  const allExportTypes: string[] = [];

  // Add direct export type if declaration has export modifier
  if (isDefault) {
    allExportTypes.push('default');
  } else if (isExported(node)) {
    allExportTypes.push('named');
  }

  // Add indirect export types from export statements
  if (exportInfo) {
    allExportTypes.push(...exportInfo.exportTypes);
  }

  return allExportTypes;
}