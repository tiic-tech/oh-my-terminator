// Import CodeGraph type for use in this file and re-export for consumers
import type { CodeGraph } from './graph.js';
export { CodeGraph } from './graph.js';

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
  /** First 200 characters of JSDoc comment (or truncated based on config) */
  jsDoc?: string;
  /** Whether marked as @deprecated */
  deprecated?: boolean;
  /** Whether JSDoc was truncated from original length */
  jsDocTruncated?: boolean;
  /** Whether this module has JSDoc documentation (true if any JSDoc exists) */
  hasJSDoc?: boolean;

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
 * Import kind metadata for IMPORTS edges
 *
 * WHY: TypeScript 3.8+ introduced `import type` syntax. Type-only imports
 * are erased at compile time and don't create runtime dependencies.
 * This distinction is crucial for:
 * - Dependency score calculation (exclude type imports)
 * - Layer inference accuracy (type imports shouldn't penalize)
 * - Scope analysis (users benefit from seeing type/value distinction)
 *
 * @see design.md D1: Import Kind Metadata Field
 */
export type ImportKind = 'type-only' | 'value';

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
  /** Import kind: type-only (erased at compile) or value (runtime dependency) */
  importKind?: ImportKind;
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
  /**
   * Get all registered parser instances
   * @returns Array of Parser instances
   */
  getAllParsers(): Parser[];
}

// ============================================================================
// C9: CLI Types (Analyze/Update Commands)
// ============================================================================

/**
 * Error codes for CLI operations
 *
 * WHY: Structured error codes enable programmatic error handling and user-friendly messages.
 * Each code maps to a specific failure scenario with actionable guidance.
 */
export enum CliErrorCode {
  /** Not in a git repository - git commands will fail */
  E_NO_GIT_REPO = 'E_NO_GIT_REPO',
  /** Baseline file not found - need to run analyze first */
  E_BASELINE_NOT_FOUND = 'E_BASELINE_NOT_FOUND',
  /** Source file parsing failed - check file syntax */
  E_PARSE_FAILED = 'E_PARSE_FAILED',
  /** CodeGraph API walk failed - graph traversal error */
  E_WALK_API_FAILED = 'E_WALK_API_FAILED',
  /** Invalid path provided - path does not exist or is not accessible */
  E_INVALID_PATH = 'E_INVALID_PATH',
  /** Empty git repository - .git exists but no commits made */
  E_EMPTY_REPO = 'E_EMPTY_REPO',
  /** Invalid configuration - config file has invalid schema or values */
  E_INVALID_CONFIG = 'E_INVALID_CONFIG',
  /** Path table index exceeds bounds - corrupted baseline or invalid reference */
  E_INDEX_OUT_OF_BOUNDS = 'E_INDEX_OUT_OF_BOUNDS',
  /** Baseline file corrupted - invalid JSON or missing required fields */
  E_CORRUPTED_BASELINE = 'E_CORRUPTED_BASELINE',

  // --- CLI Layer Error Codes (C15: CLI UX Improvement) ---
  /** User entered an unknown command (e.g., 'codegraph xyz') */
  E_CLI_UNKNOWN_COMMAND = 'E_CLI_UNKNOWN_COMMAND',
  /** User used an invalid flag (e.g., 'codegraph analyze --invalid') */
  E_CLI_UNKNOWN_FLAG = 'E_CLI_UNKNOWN_FLAG',
  /** Required argument missing (e.g., 'codegraph scope' without target) */
  E_CLI_MISSING_ARG = 'E_CLI_MISSING_ARG',
  /** Target path not found in scope/impact commands */
  E_CLI_TARGET_NOT_FOUND = 'E_CLI_TARGET_NOT_FOUND',
  /** Unexpected internal error (fallback for non-CACError) */
  E_CLI_INTERNAL = 'E_CLI_INTERNAL',
}

/**
 * Statistics from CLI analyze/update operations
 *
 * Tracks processing metrics for performance monitoring and user feedback.
 */
export interface CliResultStats {
  /** Number of files scanned for analysis */
  filesScanned: number;
  /** Number of MODULE nodes extracted from parsed files */
  modulesExtracted: number;
  /** Edge counts by type for dependency tracking */
  edgesCreated: {
    /** Import relationships (FILE → MODULE, MODULE → MODULE) */
    imports: number;
    /** Export relationships (MODULE → FILE) */
    exports: number;
    /** Structural containment (DIRECTORY → FILE, FILE → MODULE) */
    contains: number;
  };
}

/**
 * Compression statistics for CLI results
 *
 * WHY: Shows compression effectiveness to users for token budget awareness.
 * Enables users to understand baseline size reduction.
 */
export interface CompressionStats {
  /** Estimated original size in bytes (before compression) */
  originalSizeBytes: number;
  /** Actual compressed size in bytes */
  compressedSizeBytes: number;
  /** Percentage savings from compression (0-100) */
  savingsPercent: number;
}

/**
 * Edge case result for special project states
 *
 * WHY: Empty/single-file/test-only projects need graceful handling, not errors.
 * CLI should exit 0 with structured output for programmatic consumption.
 *
 * @see analyzer/edge-case-detector.ts for detection logic
 */
export interface EdgeCaseResult {
  /** true - edge cases are valid states, not errors */
  success: true;
  /** Project classification from detectSpecialCases() */
  kind: 'empty' | 'single-file' | 'test-only';
  /** Human-readable message explaining the situation */
  message: string;
  /** Optional suggestions for empty projects */
  suggestions?: string[];
  /** Optional file path for single-file projects */
  file?: string;
  /** Optional external dependencies for single-file projects */
  externalDeps?: string[];
  /** Optional warning for test-only projects */
  warning?: string;
  /** Optional test file list for test-only projects */
  testFiles?: string[];
  /** Processing time in milliseconds */
  durationMs: number;
}

/**
 * Result of CLI analyze command
 *
 * WHY: Structured result enables both programmatic consumption and CLI output formatting.
 * success discriminates between happy path and error cases for type narrowing.
 */
export interface AnalyzeResult {
  /** true for successful analysis, false for errors (literal type for narrowing) */
  success: boolean;
  /** Processing statistics */
  stats: CliResultStats;
  /** Baseline metadata (only present on success) */
  baseline?: {
    /** Path to baseline.json file */
    path: string;
    /** Git commit hash captured during analysis */
    commitHash: string;
    /** Unix timestamp when baseline was created */
    timestamp: number;
  };
  /** Compression statistics (present when compression enabled) */
  compressionStats?: CompressionStats;
  /** Total processing time in milliseconds */
  durationMs: number;
  /** Non-fatal issues that didn't block analysis */
  warnings: string[];
  /** Hints for next actions (e.g., "Run 'cg update' after changes") */
  nextSuggested: string[];
}

/**
 * Result of CLI update command
 *
 * Captures delta between baseline and current state after incremental update.
 */
export interface UpdateResult {
  /** true for successful update, false for errors */
  success: boolean;
  /** File changes detected by git diff */
  changes: {
    /** New files added to the codebase */
    added: string[];
    /** Files removed from the codebase */
    removed: string[];
    /** Files with content modifications */
    modified: string[];
  };
  /** Node delta statistics */
  delta: {
    /** New nodes added to the graph */
    newNodes: number;
    /** Nodes removed from the graph */
    removedNodes: number;
  };
  /** Compression statistics (present when compression enabled) */
  compressionStats?: CompressionStats;
  /** Total processing time in milliseconds */
  durationMs: number;
  /** Non-fatal issues during update */
  warnings: string[];
}

/**
 * Migration statistics for migrate command
 *
 * WHY: Reports migration effectiveness to users.
 * Shows size reduction and path table efficiency.
 */
export interface MigrateStats {
  /** Input baseline size in bytes */
  inputSizeBytes: number;
  /** Output baseline size in bytes */
  outputSizeBytes: number;
  /** Percentage savings from compression (0-100) */
  savingsPercent: number;
  /** Number of entries in path table */
  pathTableEntries: number;
}

/**
 * Result of CLI migrate command
 *
 * WHY: Structured result for manual baseline migration from 1.0 to 1.1 format.
 * Enables users to migrate existing baselines without re-analyzing.
 */
export interface MigrateResult {
  /** true for successful migration, false for errors */
  success: true;
  /** Migration statistics */
  stats: MigrateStats;
  /** Input file path */
  inputPath: string;
  /** Output file path */
  outputPath: string;
  /** Total processing time in milliseconds */
  durationMs: number;
}

/**
 * Options for migrate command
 *
 * WHY: Required paths for manual migration operation.
 */
export interface MigrateOptions {
  /** Input baseline file path (required) */
  input: string;
  /** Output baseline file path (required) */
  output: string;
  /** Output as JSON (for programmatic consumption) */
  json?: boolean;
}

/**
 * CLI error result
 *
 * WHY: success: false is a literal type enabling discriminated union narrowing.
 * When success is false, this interface is guaranteed; when true, AnalyzeResult/UpdateResult.
 */
export interface CliError {
  /** Always false - enables type narrowing via discriminated union */
  success: false;
  /** Structured error information */
  error: {
    /** Error code for programmatic handling */
    code: CliErrorCode;
    /** Human-readable error message */
    message: string;
    /** Optional suggestion for correcting the error (CLI UX improvement) */
    suggestion?: string;
    /** Original error details (only in JSON mode for debugging) */
    debug?: string;
  };
  /** Time elapsed before error occurred */
  durationMs: number;
}

/**
 * File change record for update operations
 *
 * Represents a single file modification detected by git diff.
 */
export interface FileChange {
  /** Relative file path from project root */
  path: string;
  /** Change type classification */
  type: 'ADD' | 'MODIFY' | 'DELETE';
}

// ============================================================================
// C10: Compression Types (Baseline Size Optimization)
// ============================================================================

/**
 * Compression options for baseline serialization
 *
 * WHY: Configurable compression enables trade-off between size and information retention.
 * Default values optimized for Agent token budgets while preserving essential context.
 *
 * @see design.md D1-D4 decisions
 */
export interface CompressionOptions {
  /** Whether compression is enabled (default: true) */
  enabled: boolean;
  /** Maximum JSDoc length before truncation (default: 100) */
  jsDocMaxLength?: number;
}

/**
 * Full compression configuration
 *
 * WHY: Separated from CompressionOptions to allow future extensions
 * (e.g., compression levels, feature-specific toggles).
 */
export interface CompressionConfig {
  /** Compression options */
  compression: CompressionOptions;
}

/**
 * Path table for string interning (deduplication)
 *
 * WHY: External dependency paths repeat frequently (50+ times for popular packages).
 * Path table reduces repetition to single entry, referenced by index.
 *
 * @see design.md D3: Path Table decision
 */
export type PathTable = string[];

/**
 * Metadata for MODULE nodes in compressed format
 *
 * Subset of ModuleMetadata with compression-specific fields.
 * Inherits JSDoc truncation fields from ModuleMetadata.
 */
export interface CompressedModuleMetadata {
  /** Symbol kind */
  kind?: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'component' | 'unknown';
  /** Whether the symbol is exported */
  isExported?: boolean;
  /** Truncated JSDoc comment */
  jsDoc?: string;
  /** Whether JSDoc was truncated */
  jsDocTruncated?: boolean;
  /** Whether this module has JSDoc documentation */
  hasJSDoc?: boolean;
  /** Whether marked as @deprecated */
  deprecated?: boolean;
  /** Cyclomatic complexity */
  complexity?: number;
  /** Lines of code */
  loc?: number;
}

/**
 * Compressed graph node (no id field)
 *
 * WHY: ID is redundant - can be reconstructed from type + pathIndex + name.
 * Removal yields 15-20% size reduction.
 *
 * ID reconstruction rules:
 * - FILE/DIRECTORY/EXTERNAL: `${type}:${pathTable[pathIndex]}`
 * - MODULE: `MODULE:${pathTable[pathIndex]}#${name}`
 *
 * @see design.md D1: ID Field Removal decision
 */
export interface CompressedNode {
  /** Node type */
  type: NodeType;
  /** Index in pathTable for path string */
  pathIndex: number;
  /** Display name (required for MODULE, optional for others) */
  name?: string;
  /** Optional metadata (primarily for MODULE nodes) */
  metadata?: CompressedModuleMetadata;
}

/**
 * Compressed graph edge (no id field)
 *
 * WHY: ID is redundant - can be reconstructed from type + fromIndex + toIndex.
 * Uses pathTable indexes instead of full path strings.
 *
 * @see design.md D1: ID Field Removal decision
 */
export interface CompressedEdge {
  /** Edge type */
  type: EdgeType;
  /** Source node path index in pathTable */
  fromIndex: number;
  /** Target node path index in pathTable */
  toIndex: number;
  /** Optional metadata */
  metadata?: EdgeMetadata;
}

/**
 * IMPORTS_BATCH edge type for batched import relationships
 *
 * WHY: IMPORTS edges dominate (70-80% of edges). Grouping reduces key repetition.
 * One IMPORTS_BATCH replaces multiple IMPORTS edges from same source.
 *
 * @see design.md D4: Edge Batch Compression decision
 */
export interface IMPORTS_BATCH {
  /** Literal type identifier */
  type: 'IMPORTS_BATCH';
  /** Source node path index */
  fromIndex: number;
  /** Target node path indexes (one per import target) */
  targetIndexes: number[];
}

/**
 * Compressed baseline format (schema version 1.1)
 *
 * WHY: Reduces baseline size by 20-60% through:
 * - ID field removal (D1)
 * - JSDoc truncation (D2)
 * - Path table interning (D3)
 * - Edge batching (D4)
 *
 * Backward compatible via migration (1.0 → 1.1).
 *
 * @see design.md for full compression strategy
 */
export interface CompressedBaseline {
  /** Schema version for compatibility tracking */
  schemaVersion?: SchemaVersion;
  /** String interning table for paths */
  pathTable: PathTable;
  /** Compressed nodes (no id, pathIndex references) */
  nodes: CompressedNode[];
  /** Compressed edges (regular or IMPORTS_BATCH) */
  edges: (CompressedEdge | IMPORTS_BATCH)[];
  /** Git commit hash this baseline represents */
  commitHash: string;
  /** Timestamp when baseline was generated */
  timestamp: number;
}