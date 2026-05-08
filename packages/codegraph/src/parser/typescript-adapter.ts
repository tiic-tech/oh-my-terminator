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
 * ARCHITECTURE FIX: Program must contain all project files for proper module
 * resolution. When parsing files one-by-one, TypeScript cannot resolve relative
 * imports correctly because it doesn't know about other project files.
 *
 * Solution: Use parseAll() with all project files to create a complete Program,
 * then cache results by file path for subsequent parse() calls.
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
 * Uses batch parsing to ensure TypeScript Program contains all project files
 * for correct module resolution.
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

  /** Cached parse results by file path (populated after batch parse) */
  private cachedResults: Map<string, ParserResult> = new Map();

  /** Flag indicating if batch parse has been performed */
  private batchParsed = false;

  /**
   * Create adapter with project context
   *
   * @param projectRoot - Project root directory (required for TypeScriptParser)
   * @throws Error if projectRoot is empty or not a string
   */
  constructor(projectRoot: string) {
    // WHY: "Validate at system boundaries" principle - TypeScript Compiler API
    // requires valid project root for Program creation. Empty paths cause cryptic
    // TypeScript errors during parsing that are hard to debug.
    if (!projectRoot || typeof projectRoot !== 'string' || projectRoot.trim() === '') {
      throw new Error('[TypeScriptParserAdapter] projectRoot must be a non-empty string');
    }
    this.projectRoot = projectRoot;
  }

  /**
   * Perform batch parsing of all files
   *
   * Creates TypeScript Program with all files for correct module resolution.
   * Results are cached for subsequent individual parse() calls.
   *
   * @param filePaths - Array of relative file paths to parse
   */
  async parseBatch(filePaths: string[]): Promise<void> {
    if (this.batchParsed) {
      return; // Already parsed
    }

    // Initialize cached parser
    if (!this.tsParser) {
      this.tsParser = new TypeScriptParser(this.projectRoot);
    }

    // Convert to absolute paths
    const absolutePaths = filePaths.map(p => path.resolve(this.projectRoot, p));

    // Parse all files at once (creates Program with all files)
    const batchResult = this.tsParser.parseAll(absolutePaths);

    // Cache results by source file path
    // TypeScriptParser returns edges with sourceFile as relative path
    // We need to map each file's nodes and edges
    for (const filePath of filePaths) {
      const absolutePath = path.resolve(this.projectRoot, filePath);

      // Find all edges originating from this file
      const fileEdges = batchResult.edges.filter(e =>
        e.from === `FILE:${filePath}`
      );

      // Find EXTERNAL nodes created by this file's imports
      const externalNodeIds = new Set(
        fileEdges
          .filter(e => e.to.startsWith('EXTERNAL:'))
          .map(e => e.to)
      );
      const fileExternalNodes = batchResult.nodes.filter(n =>
        n.type === 'EXTERNAL' && externalNodeIds.has(n.id)
      );

      // Find MODULE nodes from this file (they have file path in their ID)
      // MODULE IDs format: MODULE:filePath#name (see module-id.ts)
      const fileModuleNodes = batchResult.nodes.filter(n =>
        n.type === 'MODULE' && n.id.startsWith(`MODULE:${filePath}#`)
      );

      // Collect warnings for this file
      const fileWarnings = batchResult.warnings.filter(w =>
        w.includes(filePath) || w.includes(absolutePath)
      );

      this.cachedResults.set(filePath, {
        nodes: [...fileExternalNodes, ...fileModuleNodes],
        edges: fileEdges,
        warnings: fileWarnings,
      });
    }

    this.batchParsed = true;
  }

  /**
   * Parse a single TypeScript/JavaScript file
   *
   * Returns cached result from batch parse. Call parseBatch() first with
   * all project files for correct module resolution.
   *
   * If file not in cache, performs standalone parse (limited module resolution).
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
    // Return cached result if available
    const cached = this.cachedResults.get(filePath);
    if (cached) {
      return cached;
    }

    // Fallback: standalone parse (limited module resolution)
    // This happens if parseBatch wasn't called first
    if (!this.tsParser) {
      this.tsParser = new TypeScriptParser(this.projectRoot);
    }

    const absolutePath = path.resolve(this.projectRoot, filePath);
    const result = this.tsParser.parseFile(absolutePath);

    return {
      nodes: result.nodes,
      edges: result.edges,
      warnings: [
        ...result.warnings,
        // WHY: Warn about fallback mode - relative imports may not resolve correctly
        'Standalone parse mode: relative imports may not resolve correctly. Call parseBatch() first for full resolution.',
      ],
    };
  }
}