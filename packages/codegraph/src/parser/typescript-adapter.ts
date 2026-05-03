/**
 * TypeScript Parser Adapter
 *
 * Adapter that wraps C3 (import extraction) and C4 (module extraction)
 * to implement the unified Parser interface for C5 analyzer.
 *
 * NOTE: TypeScriptParser uses TypeScript Compiler API which reads from filesystem.
 * The content parameter is not directly used - the file must exist on disk.
 * This is a TypeScript Compiler API limitation for MVP.
 */

import path from 'path';
import type { Parser, ParserResult } from '../types.js';
import { TypeScriptParser } from './ts-parser/class.js';

/**
 * TypeScript Parser Adapter
 *
 * Implements Parser interface by wrapping existing TypeScriptParser.
 * Supports .ts, .tsx, .js, .jsx, .mjs extensions.
 */
export class TypeScriptParserAdapter implements Parser {
  /** Parser name */
  name = 'typescript';

  /** Supported file extensions */
  extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

  /**
   * Parse a single TypeScript/JavaScript file
   *
   * Uses TypeScriptParser which reads from filesystem via Compiler API.
   * The content parameter is provided for interface compliance but the file
   * must exist on disk at filePath relative to projectRoot.
   *
   * @param filePath - Relative file path (file must exist on disk)
   * @param content - File content (for interface, actual read from disk)
   * @param projectRoot - Project root directory
   * @returns ParserResult with nodes, edges, warnings
   */
  async parse(
    filePath: string,
    content: string,
    projectRoot: string
  ): Promise<ParserResult> {
    // TypeScriptParser requires absolute path
    const absolutePath = path.resolve(projectRoot, filePath);

    // Create parser instance for this project
    const tsParser = new TypeScriptParser(projectRoot);

    // Use parseFile which handles both imports and modules
    // Note: TypeScriptParser reads from filesystem, not from content param
    const result = tsParser.parseFile(absolutePath);

    // Convert to ParserResult (remove filesParsed if present)
    return {
      nodes: result.nodes,
      edges: result.edges,
      warnings: result.warnings,
    };
  }
}