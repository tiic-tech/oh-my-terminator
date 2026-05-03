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
  /** Symbol kind (function, class, component, etc.) */
  kind?: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'component' | 'unknown';
  /** First 200 characters of JSDoc comment */
  jsDoc?: string;
  /** Cyclomatic complexity */
  complexity?: number;
  /** Lines of code (excluding comments and blank lines) */
  loc?: number;
  /** Whether the symbol is exported */
  isExported?: boolean;
  /** Whether marked as @deprecated */
  deprecated?: boolean;
  /** Associated test file path */
  testFile?: string;
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
}