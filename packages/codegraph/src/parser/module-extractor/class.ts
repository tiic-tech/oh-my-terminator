/**
 * Module Extractor Class
 *
 * Main class for extracting MODULE nodes from TypeScript source files
 */

import ts from 'typescript';
import { ModuleExtractResult, ExportInfoMap } from './types.js';
import { collectExportInfo, getDeclarationName, isExported } from './export-info.js';
import { processDeclaration } from './declaration-processor.js';
import { processExportDeclaration } from './export-processor.js';

/**
 * Module Extractor class
 */
export class ModuleExtractor {
  private program: ts.Program;
  private projectRoot: string;

  constructor(program: ts.Program, projectRoot: string) {
    this.program = program;
    this.projectRoot = projectRoot;
  }

  /**
   * Extract modules from source file
   */
  extractModules(sourceFile: ts.SourceFile): ModuleExtractResult {
    const result: ModuleExtractResult = {
      nodes: [],
      edges: [],
      warnings: [],
    };

    const relativePath = this.getRelativePath(sourceFile.fileName);
    const fileId = `FILE:${relativePath}`;

    // Track export names to handle duplicates
    const exportNames = new Map<string, number>();

    // First pass: build export info map from all export declarations
    const exportInfoMap: ExportInfoMap = new Map();

    // Collect export info from all export statements
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isExportDeclaration(node)) {
        collectExportInfo(node, exportInfoMap);
      }
      // Handle: export default identifier (ExportAssignment)
      if (ts.isExportAssignment(node)) {
        const isDefault = true; // ExportAssignment is always default
        if (ts.isIdentifier(node.expression)) {
          const internalName = node.expression.text;
          const existing = exportInfoMap.get(internalName) ?? { exportTypes: [], exportedNames: [] };
          existing.exportTypes.push('default');
          existing.exportedNames.push(internalName);
          exportInfoMap.set(internalName, existing);
        }
      }
    });

    // Second pass: process declarations
    ts.forEachChild(sourceFile, (node) => {
      // Check if this declaration is exported (directly or via export statement)
      const symbolName = getDeclarationName(node, sourceFile);
      const isDirectExport = isExported(node);
      const isIndirectExport = symbolName && exportInfoMap.has(symbolName);

      if (isDirectExport || isIndirectExport) {
        processDeclaration(node, sourceFile, relativePath, fileId, result, exportNames, exportInfoMap);
      }
    });

    // Third pass: handle export statements for symbols not declared in file (re-exports)
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isExportDeclaration(node)) {
        processExportDeclaration(node, sourceFile, relativePath, fileId, result, exportNames, exportInfoMap);
      }
    });

    return result;
  }

  /**
   * Get relative path from absolute path
   */
  private getRelativePath(absolutePath: string): string {
    return absolutePath.replace(this.projectRoot, '').replace(/^[/\\]/, '');
  }
}