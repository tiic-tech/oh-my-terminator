/**
 * Parser Registry Module
 *
 * Manages registration and selection of language-specific parsers.
 * Implements extensible plugin architecture for multi-language support.
 */

import type { Parser, ParserRegistry } from './types.js';

/**
 * Logger interface for registry debug output
 *
 * Allows callers to provide custom logging implementation.
 * This avoids hardcoding console usage and enables flexible handling.
 */
export interface RegistryLogger {
  /** Log a debug/warning message */
  warn(message: string): void;
}

/**
 * Options for creating a DefaultParserRegistry
 *
 * Provides control over debug output for plugin development scenarios.
 */
export interface ParserRegistryOptions {
  /**
   * Enable debug output for registration operations
   *
   * When true and no logger provided, warnings are collected internally.
   * When a logger is provided, warnings are sent to the logger.
   * Useful for debugging plugin registration order issues.
   * Default: false (no debug output in production)
   */
  debug?: boolean;

  /**
   * Custom logger for debug output
   *
   * When provided, debug messages are sent to this logger instead of console.
   * Enables integration with any logging system.
   */
  logger?: RegistryLogger;
}

/**
 * Default implementation of ParserRegistry
 *
 * Uses Map-based storage for efficient extension lookup.
 * Supports multiple parsers with overlapping extensions (last registered wins).
 *
 * @example
 * ```typescript
 * // Production use (no debug output)
 * const registry = new DefaultParserRegistry();
 *
 * // Development use with custom logger
 * const registry = new DefaultParserRegistry({
 *   debug: true,
 *   logger: { warn: (msg) => console.log(msg) }
 * });
 * ```
 */
export class DefaultParserRegistry implements ParserRegistry {
  /** Parser instances by name */
  private parsers: Map<string, Parser> = new Map();

  /** Extension → Parser mapping (for quick lookup) */
  private extensionMap: Map<string, Parser> = new Map();

  /** Debug mode flag */
  private debug: boolean;

  /** Optional logger for debug output */
  private logger?: RegistryLogger;

  /** Collected warnings (when debug=true but no logger) */
  private warnings: string[] = [];

  /**
   * Create a new registry instance
   *
   * @param options - Registry configuration options
   */
  constructor(options?: ParserRegistryOptions) {
    this.debug = options?.debug ?? false;
    this.logger = options?.logger;
  }

  /**
   * Register a parser
   *
   * Registers all extensions declared by the parser.
   * If an extension was previously registered, the new parser takes precedence.
   * Debug mode captures/sends warnings when extensions are re-registered.
   *
   * INPUT VALIDATION:
   * - parser.name must be non-empty string
   * - parser.extensions must be non-empty array of valid extensions
   * - Extensions must start with '.' and contain only valid characters
   *
   * WHY: "Validate at system boundaries" principle - prevent malformed parsers
   * from corrupting the registry and causing downstream parse failures.
   *
   * @param parser - Parser instance to register
   * @throws Error if parser validation fails
   */
  register(parser: Parser): void {
    // Validate parser.name
    if (!parser.name || typeof parser.name !== 'string' || parser.name.trim() === '') {
      throw new Error('[ParserRegistry] Invalid parser: name must be a non-empty string');
    }

    // Validate parser.extensions
    if (!Array.isArray(parser.extensions) || parser.extensions.length === 0) {
      throw new Error(`[ParserRegistry] Invalid parser "${parser.name}": extensions must be a non-empty array`);
    }

    // Validate each extension format
    for (const ext of parser.extensions) {
      if (typeof ext !== 'string' || !ext.startsWith('.') || ext.length < 2) {
        throw new Error(
          `[ParserRegistry] Invalid parser "${parser.name}": extension "${ext}" must start with '.' and have at least 2 characters (e.g., '.ts')`
        );
      }
    }

    // Store by name
    this.parsers.set(parser.name, parser);

    // Map each extension to this parser (warn on collision if debug enabled)
    for (const ext of parser.extensions) {
      if (this.extensionMap.has(ext)) {
        const existing = this.extensionMap.get(ext);
        // Debug output for plugin development - helps diagnose registration order issues
        // Only enabled via constructor options, never in production by default
        if (this.debug) {
          const message = `[ParserRegistry] Extension ${ext} re-registered: ${existing?.name} → ${parser.name}`;
          if (this.logger) {
            this.logger.warn(message);
          } else {
            this.warnings.push(message);
          }
        }
      }
      this.extensionMap.set(ext, parser);
    }
  }

  /**
   * Get collected debug warnings
   *
   * Returns warnings collected when debug=true but no logger was provided.
   * Useful for inspecting registration issues after batch registration.
   *
   * @returns Array of warning messages
   */
  getWarnings(): string[] {
    return [...this.warnings];
  }

  /**
   * Clear collected warnings
   *
   * Resets the internal warnings array.
   */
  clearWarnings(): void {
    this.warnings = [];
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

  /**
   * Get all registered parser instances
   *
   * Useful for batch operations like parseBatch() that need to iterate
   * over all parsers.
   *
   * @returns Array of all registered Parser instances
   */
  getAllParsers(): Parser[] {
    return Array.from(this.parsers.values());
  }
}