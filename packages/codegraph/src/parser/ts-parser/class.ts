/**
 * TypeScript Parser Class
 *
 * Main parser implementation for extracting import relationships.
 */

import ts from 'typescript';
import { NodeType, GraphNode, ParserResult } from '../../types.js';
import { ParserOptions } from './types.js';
import { createParserProgram } from './program.js';
import { extractPackageName } from './module-resolution.js';
import { createExternalNode } from './external-node.js';
import { generateImportEdge, generateReExportEdge, generateDynamicImportEdge } from './edge-generator.js';
import { extractImports } from './import-extractor.js';
import { ModuleExtractor } from '../module-extractor/index.js';
import { getRelativePath } from './path-utils.js';

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
   * Parse all files and return combined result.
   *
   * Creates a single TypeScript Program instance holding all source files
   * in memory. For large repositories (>500 files), consider batch processing
   * with parseFile() to reduce memory footprint.
   *
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
    const programResult = createParserProgram(filePaths, this.projectRoot, this.options);
    this.program = programResult.program;
    result.warnings.push(...programResult.warnings);

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
        // filesParsed is initialized to 0 in parseAll, safe to increment
        result.filesParsed = (result.filesParsed ?? 0) + 1;
      } catch (error) {
        const msg = error instanceof Error
          ? `${error.message}${error.stack ? ` (${error.stack.split('\n')[1]?.trim()})` : ''}`
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
   * @returns ParserResult with nodes, edges, and warnings for this file
   */
  parseFile(filePath: string): ParserResult {
    const result: ParserResult = {
      nodes: [],
      edges: [],
      warnings: [],
    };

    // Initialize program if not exists (for standalone parseFile calls)
    if (!this.program) {
      const programResult = createParserProgram([filePath], this.projectRoot, this.options);
      this.program = programResult.program;
      result.warnings.push(...programResult.warnings);
    }

    const sourceFile = this.program.getSourceFile(filePath);
    if (!sourceFile) {
      result.warnings.push(`Source file not found: ${filePath}`);
      return result;
    }

    // Get relative path
    const relativePath = getRelativePath(this.projectRoot, filePath);

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