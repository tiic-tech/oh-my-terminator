/**
 * TypeScript Parser Class
 *
 * Main parser implementation for extracting import relationships.
 */

import ts from 'typescript';
import { NodeType, GraphNode } from '../../types.js';
import { ParseResult, ParserResult, ParserOptions } from './types.js';
import { createParserProgram } from './program.js';
import { extractPackageName } from './module-resolution.js';
import { createExternalNode } from './external-node.js';
import { generateImportEdge, generateReExportEdge, generateDynamicImportEdge } from './edge-generator.js';
import { extractImports } from './import-extractor.js';
import { ModuleExtractor } from '../module-extractor/index.js';

/**
 * TypeScript Parser class
 *
 * Extracts import relationships from TypeScript/JavaScript files using
 * TypeScript Compiler API.
 *
 * @example
 * ```typescript
 * const parser = new TypeScriptParser('/path/to/project');
 * const result = parser.parseAll(['/path/to/file1.ts', '/path/to/file2.ts']);
 * result.nodes.forEach(n => graph.addNode(n));
 * result.edges.forEach(e => graph.addEdge(e));
 * ```
 */
export class TypeScriptParser {
  private program: ts.Program | null = null;
  private projectRoot: string;
  private options: ParserOptions;

  /**
   * Create a TypeScript parser instance
   *
   * @param projectRoot - Absolute path to project root directory
   * @param options - Optional parser configuration
   */
  constructor(projectRoot: string, options?: ParserOptions) {
    this.projectRoot = projectRoot;
    this.options = options ?? {};
  }

  /**
   * Parse all files and return combined result
   *
   * Creates a single TypeScript Program instance and processes all files.
   * EXTERNAL nodes are deduplicated across all files.
   *
   * @param filePaths - Absolute paths to TypeScript/JavaScript files
   * @returns ParserResult with nodes, edges, filesParsed count, and warnings
   */
  parseAll(filePaths: string[]): ParserResult {
    const result: ParserResult = {
      nodes: [],
      edges: [],
      filesParsed: 0,
      warnings: [],
    };

    if (filePaths.length === 0) {
      return result;
    }

    // Create single Program instance
    this.program = createParserProgram(filePaths, this.projectRoot, this.options);

    // External nodes deduplication map
    const externalNodes = new Map<string, GraphNode>();

    for (const filePath of filePaths) {
      try {
        const fileResult = this.parseFile(filePath);

        // Deduplicate EXTERNAL nodes
        for (const node of fileResult.nodes) {
          if (node.type === NodeType.EXTERNAL) {
            if (!externalNodes.has(node.id)) {
              externalNodes.set(node.id, node);
              result.nodes.push(node);
            }
          } else {
            result.nodes.push(node);
          }
        }

        result.edges.push(...fileResult.edges);
        result.warnings.push(...fileResult.warnings);
        result.filesParsed++;
      } catch (error) {
        const msg = error instanceof Error
          ? `${error.message}\nStack: ${error.stack}`
          : String(error);
        result.warnings.push(`Error parsing ${filePath}: ${msg}`);
      }
    }

    return result;
  }

  /**
   * Parse a single file
   *
   * @param filePath - Absolute path to the file to parse
   * @returns ParseResult with nodes, edges, and warnings for this file
   */
  parseFile(filePath: string): ParseResult {
    const result: ParseResult = {
      nodes: [],
      edges: [],
      warnings: [],
    };

    // Initialize program if not exists (for standalone parseFile calls)
    if (!this.program) {
      this.program = createParserProgram([filePath], this.projectRoot, this.options);
    }

    const sourceFile = this.program.getSourceFile(filePath);
    if (!sourceFile) {
      result.warnings.push(`Source file not found: ${filePath}`);
      return result;
    }

    // Get relative path
    const relativePath = this.getRelativePath(filePath);

    // Extract imports using the import extractor
    if (this.program) {
      const imports = extractImports(sourceFile, relativePath, this.program, this.projectRoot);

      for (const info of imports) {
        if (info.importType === 'import') {
          result.edges.push(generateImportEdge(info));
        } else if (info.importType === 're-export') {
          result.edges.push(generateReExportEdge(info));
        } else if (info.importType === 'dynamic') {
          result.edges.push(generateDynamicImportEdge(info));
        }

        // Create EXTERNAL node if needed
        if (!info.resolvedPath && info.specifier && info.specifier !== '__dynamic__') {
          const packageName = extractPackageName(info.specifier);
          result.nodes.push(createExternalNode(packageName));
        }
      }
    }

    // Extract MODULE nodes
    if (this.program) {
      const moduleExtractor = new ModuleExtractor(this.program, this.projectRoot);
      const moduleResult = moduleExtractor.extractModules(sourceFile);
      result.nodes.push(...moduleResult.nodes);
      result.edges.push(...moduleResult.edges);
      result.warnings.push(...moduleResult.warnings);
    }

    return result;
  }

  /**
   * Get relative path from absolute path
   *
   * @param absolutePath - Absolute file path
   * @returns Relative path from project root
   */
  private getRelativePath(absolutePath: string): string {
    return absolutePath.replace(this.projectRoot, '').replace(/^[/\\]/, '');
  }
}

/**
 * Convenience function to parse imports from files
 *
 * @param filePaths - Absolute paths to TypeScript/JavaScript files
 * @param projectRoot - Absolute path to project root
 * @param options - Optional parser configuration
 * @returns ParserResult with nodes, edges, and warnings
 */
export function parseImports(
  filePaths: string[],
  projectRoot: string,
  options?: ParserOptions
): ParserResult {
  const parser = new TypeScriptParser(projectRoot, options);
  return parser.parseAll(filePaths);
}