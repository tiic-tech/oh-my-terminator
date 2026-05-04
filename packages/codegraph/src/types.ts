import type { CodeGraph } from './graph.js';
import type { ScanOptions } from './scanner.js';

// ============================================================================
// C6: Schema Version Types (Baseline Persistence)
// ============================================================================

/**
 * Schema version following semantic versioning (SemVer)
 *
 * WHY: Major version changes indicate breaking changes requiring migration.
 * Minor/patch versions are backward compatible, allowing direct use or optional migration.
 *
 * @see 06_c6_baseline_version_spec.md Section 1.3
 */
export interface SchemaVersion {
  /** Major version - breaking changes require migration or rebuild */
  major: number;
  /** Minor version - backward compatible new features */
  minor: number;
  /** Patch version - backward compatible fixes */
  patch: number;
}

/**
 * Node types in the CodeGraph
 *
 * Each type represents a different granularity of code organization:
 * - DIRECTORY: Folder/container for files
 * - FILE: Source code file
 * - MODULE: Exported symbol (function, class, variable, type)
 * - EXTERNAL: External dependency (node_modules or built-in)
 */
export enum NodeType {
  DIRECTORY = 'DIRECTORY',
  FILE = 'FILE',
  MODULE = 'MODULE',
  EXTERNAL = 'EXTERNAL',
}

/**
 * Edge types representing relationships between nodes
 *
 * Relationship categories:
 * - CONTAINS: Structural (directory → file/subdirectory)
 * - IMPORTS/EXPORTS: Module dependency
 * - CALLS: Function-level invocation
 * - EXTENDS/IMPLEMENTS: Class inheritance
 * - RE_EXPORTS/DYNAMIC_IMPORTS: Special import patterns
 */
export enum EdgeType {
  CONTAINS = 'CONTAINS',
  IMPORTS = 'IMPORTS',
  EXPORTS = 'EXPORTS',
  CALLS = 'CALLS',
  EXTENDS = 'EXTENDS',
  IMPLEMENTS = 'IMPLEMENTS',
  RE_EXPORTS = 'RE_EXPORTS',
  DYNAMIC_IMPORTS = 'DYNAMIC_IMPORTS',
}

/**
 * Metadata for MODULE nodes
 *
 * Contains extracted information about exported symbols
 */
export interface ModuleMetadata {
  // --- Core identity ---
  /** Symbol kind (function, class, component, etc.) */
  kind?: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'component' | 'unknown';
  /** Whether the symbol is exported */
  isExported?: boolean;

  // --- Documentation ---
  /** First 200 characters of JSDoc comment */
  jsDoc?: string;
  /** Whether marked as @deprecated */
  deprecated?: boolean;

  // --- Code metrics ---
  /** Cyclomatic complexity */
  complexity?: number;
  /** Lines of code (excluding comments and blank lines) */
  loc?: number;

  // --- Testing ---
  /** Associated test file path */
  testFile?: string;

  // --- Git metadata ---
  /** Last commit that modified this node */
  lastModifiedCommit?: string;
  /** Modification count in last 30 days */
  changeFrequency?: number;
}

/**
 * Metadata for GraphEdge
 *
 * Contains context about the relationship
 */
export interface EdgeMetadata {
  /** Line number where relationship occurs */
  line?: number;
  /** Whether this is a dynamic import */
  isDynamic?: boolean;
  /** Import specifier (e.g., "default", "named:formatDate") */
  importSpecifier?: string;
  /** Co-change count in git history */
  coChangeCount?: number;
}

/**
 * Graph node representing a code entity
 *
 * ID format rules:
 * - DIRECTORY: "DIRECTORY:relativePath" (e.g., "DIRECTORY:src")
 * - FILE: "FILE:relativePath" (e.g., "FILE:src/utils.ts")
 * - MODULE: "MODULE:filePath#exportName" (e.g., "MODULE:src/utils.ts#formatDate")
 * - EXTERNAL: "EXTERNAL:packageName" (e.g., "EXTERNAL:jsonwebtoken")
 */
export interface GraphNode {
  /** Unique identifier following type-specific format */
  id: string;
  /** Node type */
  type: NodeType;
  /** Relative path (for DIRECTORY/FILE/MODULE) or package name (for EXTERNAL) */
  path: string;
  /** Display name (directory name, file name, export name, or package name) */
  name: string;
  /** Optional metadata (primarily for MODULE nodes) */
  metadata?: ModuleMetadata;
}

/**
 * Graph edge representing a relationship between two nodes
 */
export interface GraphEdge {
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Edge type */
  type: EdgeType;
  /** Optional metadata */
  metadata?: EdgeMetadata;
}

/**
 * Serialized format for CodeGraph persistence
 *
 * Used for storing graph in .codegraph/baseline.json
 */
export interface SerializedCodeGraph {
  /** Nodes as array of [id, node] tuples (Map-compatible format) */
  nodes: [string, GraphNode][];
  /** All edges */
  edges: GraphEdge[];
  /** Git commit hash this graph represents */
  commitHash: string;
  /** Timestamp when graph was generated */
  timestamp: number;
  /** Optional schema version for compatibility tracking (C6) */
  schemaVersion?: SchemaVersion;
}

// ============================================================================
// C5: Analyzer Types (Full Analysis Flow)
// ============================================================================

/**
 * Progress callback for analysis reporting
 *
 * Invoked at each phase with current progress state
 */
export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * Progress event structure
 *
 * Reports current analysis phase and progress
 */
export interface ProgressEvent {
  /** Current phase of analysis */
  phase: 'scan' | 'parse' | 'merge' | 'complete';
  /** Number of items processed so far */
  current: number;
  /** Total items to process */
  total: number;
  /** Optional description message */
  message?: string;
  /** Current file path (only in parse phase) */
  filePath?: string;
}

/**
 * Statistics from full analysis
 *
 * Contains timing and count information
 */
export interface AnalysisStats {
  /** Time spent scanning (ms) */
  scanTimeMs: number;
  /** Time spent parsing (ms) */
  parseTimeMs: number;
  /** Total analysis time (ms) */
  totalTimeMs: number;
  /** Number of files successfully parsed */
  filesParsed: number;
  /** Number of parsing errors */
  parseErrors: number;
  /** DIRECTORY node count */
  directories: number;
  /** FILE node count */
  files: number;
  /** MODULE node count */
  modules: number;
  /** Total edge count */
  edges: number;
}

/**
 * Options for full analysis
 *
 * Controls analysis behavior and output.
 *
 * WHY parsers is optional: Follows "Dependencies Are Invisible Chains" principle.
 * Parser registration is explicit through configuration, not hidden in source code.
 * This enables plugin architecture without modifying core analyzer logic.
 *
 * @see parser-registry.ts - Plugin architecture implementation
 * @see coding-taste skill - "Declare dependencies explicitly"
 */
export interface AnalysisOptions {
  /**
   * Custom parsers to register (plugin architecture).
   * If provided, only these parsers are used.
   * If omitted, built-in TypeScript parser is registered as default.
   * @example [{ name: 'python', extensions: ['.py'], parse: async () => {...} }]
   */
  parsers?: Parser[];
  /** File extensions to parse (default: all registered parser extensions) */
  extensions?: string[];
  /** Progress callback for reporting */
  onProgress?: ProgressCallback;
  /** Scanner options (passed to scanDirectory) */
  scanOptions?: ScanOptions;
}

/**
 * Result of full repository analysis
 *
 * Contains complete graph and metadata
 */
export interface FullAnalysisResult {
  /** Complete CodeGraph with all nodes and edges */
  graph: CodeGraph;
  /** Analysis statistics */
  stats: AnalysisStats;
  /** Non-fatal warning messages */
  warnings: string[];
}

// ============================================================================
// C5: Parser Registry Types
// ============================================================================

/**
 * Result from a single file parse operation
 *
 * Contains extracted nodes, edges, and warnings.
 * For multi-file parsing, filesParsed is populated with the count.
 */
export interface ParserResult {
  /** Nodes extracted from the file */
  nodes: GraphNode[];
  /** Edges extracted from the file */
  edges: GraphEdge[];
  /** Non-fatal warnings during parsing */
  warnings: string[];
  /** Number of files successfully parsed (multi-file batch parsing only) */
  filesParsed?: number;
}

/**
 * Parser interface for language-specific file parsing
 *
 * All language parsers must implement this interface.
 *
 * NOTE: Some parsers (like TypeScript Compiler API) require files to exist on disk.
 * When requiresFileOnDisk=true, pass null for content parameter to indicate disk read.
 * Content-based parsers (default) receive the file content string.
 */
export interface Parser {
  /** Unique parser name (e.g., 'typescript', 'python') */
  name: string;
  /** Supported file extensions (e.g., ['.ts', '.tsx']) */
  extensions: string[];
  /**
   * Whether this parser requires the file to exist on disk.
   * TypeScript Compiler API reads from filesystem, ignoring content parameter.
   * Default: false (content-based parsers)
   */
  requiresFileOnDisk?: boolean;
  /**
   * Parse a single file
   * @param filePath - Relative file path
   * @param content - File content string, or null to indicate disk read (disk-based parsers)
   * @param projectRoot - Project root directory
   * @returns ParserResult with nodes, edges, warnings
   */
  parse(filePath: string, content: string | null, projectRoot: string): Promise<ParserResult>;
}

/**
 * Parser registry interface
 *
 * Manages parser registration and selection
 */
export interface ParserRegistry {
  /**
   * Register a parser
   * @param parser - Parser instance
   */
  register(parser: Parser): void;
  /**
   * Get parser for extension
   * @param extension - File extension (e.g., '.ts')
   * @returns Parser instance or undefined
   */
  getParser(extension: string): Parser | undefined;
  /**
   * Check if extension has registered parser
   * @param extension - File extension
   */
  hasParser(extension: string): boolean;
  /**
   * Get all registered extensions
   * @returns Array of extensions
   */
  getAllExtensions(): string[];
}