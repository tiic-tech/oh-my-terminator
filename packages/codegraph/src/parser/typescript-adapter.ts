/**
 * TypeScript Parser Adapter
 *
 * Adapter that wraps C3 (import extraction) and C4 (module extraction)
 * to implement the unified Parser interface for C5 analyzer.
 *
 * DESIGN NOTE: TypeScriptParser is created once with projectRoot and reused
 * across all files. This is important because TypeScript Compiler API's
 * Program creation is expensive (reads tsconfig, resolves modules).
 *
 * WARNING: TypeScriptParser uses TypeScript Compiler API which reads from
 * filesystem. Pass null for content parameter - file must exist on disk.
 * This is a TypeScript Compiler API limitation.
 */

import path from 'path';
import type { Parser, ParserResult } from '../types.js';
import { TypeScriptParser } from './ts-parser/class.js';

/**
 * TypeScript Parser Adapter
 *
 * Implements Parser interface by wrapping existing TypeScriptParser.
 * Parser instance is cached for reuse across multiple file parses.
 *
 * Supported extensions: .ts, .tsx, .js, .jsx, .mjs, .cjs, .mts, .cts
 */
export class TypeScriptParserAdapter implements Parser {
  /** Parser name */
  name = 'typescript';

  /** Supported file extensions (TypeScript and JavaScript variants) */
  extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];

  /** Indicates file must exist on disk (TypeScript Compiler API requirement) */
  requiresFileOnDisk = true;

  /** Project root directory for TypeScriptParser */
  private projectRoot: string;

  /** Cached TypeScriptParser instance (created once, reused) */
  private tsParser: TypeScriptParser | null = null;

  /**
   * Create adapter with project context
   *
   * @param projectRoot - Project root directory (required for TypeScriptParser)
   */
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Parse a single TypeScript/JavaScript file
   *
   * Uses cached TypeScriptParser which reads from filesystem via Compiler API.
   * Content parameter is null (disk-based parser reads file from disk).
   *
   * @param filePath - Relative file path (file must exist on disk)
   * @param _content - Ignored (underscore prefix indicates intentionally unused)
   * @param _projectRoot - Ignored (uses cached parser's projectRoot from constructor)
   * @returns ParserResult with nodes, edges, warnings
   */
  async parse(
    filePath: string,
    _content: string | null,
    _projectRoot: string
  ): Promise<ParserResult> {
    // Initialize cached parser on first call
    if (!this.tsParser) {
      this.tsParser = new TypeScriptParser(this.projectRoot);
    }

    // TypeScriptParser requires absolute path
    const absolutePath = path.resolve(this.projectRoot, filePath);

    // Use parseFile which handles both imports and modules
    // Note: TypeScriptParser reads from filesystem, not from content param
    const result = this.tsParser.parseFile(absolutePath);

    // Convert to ParserResult (remove filesParsed if present)
    return {
      nodes: result.nodes,
      edges: result.edges,
      warnings: result.warnings,
    };
  }
}