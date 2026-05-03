/**
 * Parser Registry Module
 *
 * Manages registration and selection of language-specific parsers.
 * Implements extensible plugin architecture for multi-language support.
 */

import type { Parser, ParserRegistry } from './types.js';

/**
 * Default implementation of ParserRegistry
 *
 * Uses Map-based storage for efficient extension lookup.
 * Supports multiple parsers with overlapping extensions (last registered wins).
 */
export class DefaultParserRegistry implements ParserRegistry {
  /** Parser instances by name */
  private parsers: Map<string, Parser> = new Map();

  /** Extension → Parser mapping (for quick lookup) */
  private extensionMap: Map<string, Parser> = new Map();

  /**
   * Register a parser
   *
   * Registers all extensions declared by the parser.
   * If an extension was previously registered, the new parser takes precedence.
   *
   * @param parser - Parser instance to register
   */
  register(parser: Parser): void {
    // Store by name
    this.parsers.set(parser.name, parser);

    // Map each extension to this parser
    for (const ext of parser.extensions) {
      this.extensionMap.set(ext, parser);
    }
  }

  /**
   * Get parser for a file extension
   *
   * @param extension - File extension (e.g., '.ts', '.tsx')
   * @returns Parser instance or undefined if not registered
   */
  getParser(extension: string): Parser | undefined {
    return this.extensionMap.get(extension);
  }

  /**
   * Check if extension has registered parser
   *
   * @param extension - File extension to check
   * @returns true if parser exists for this extension
   */
  hasParser(extension: string): boolean {
    return this.extensionMap.has(extension);
  }

  /**
   * Get all registered extensions
   *
   * @returns Array of all file extensions with registered parsers
   */
  getAllExtensions(): string[] {
    return Array.from(this.extensionMap.keys());
  }
}