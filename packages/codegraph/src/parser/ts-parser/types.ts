/**
 * TypeScript Parser Type Definitions
 *
 * Core types for TypeScript/JavaScript import parsing.
 */

import ts from 'typescript';

/**
 * Result of parsing a single file
 */
export interface ParseResult {
  /** EXTERNAL nodes created for unresolved imports */
  nodes: GraphNode[];

  /** IMPORTS, RE_EXPORTS, DYNAMIC_IMPORTS edges */
  edges: GraphEdge[];

  /** Non-fatal error/warning messages */
  warnings: string[];
}

/**
 * Result of parsing multiple files
 */
export interface ParserResult {
  /** All EXTERNAL nodes (deduplicated) */
  nodes: GraphNode[];

  /** All edges from all files */
  edges: GraphEdge[];

  /** Number of files successfully parsed */
  filesParsed: number;

  /** All warnings from all files */
  warnings: string[];
}

/**
 * Extracted import information
 */
export interface ImportInfo {
  /** Source file path (relative) */
  sourceFile: string;

  /** Import specifier (e.g., './utils', 'lodash') */
  specifier: string;

  /** Resolved file path (relative) or null for external */
  resolvedPath: string | null;

  /** Line number in source file */
  line: number;

  /** Import type */
  importType: 'import' | 're-export' | 'dynamic';

  /** Import specifier metadata (default, named:x, namespace, wildcard, dynamic, empty) */
  importSpecifier: string;
}

/**
 * Options for parser
 */
export interface ParserOptions {
  /** Custom compiler options (overrides tsconfig) */
  compilerOptions?: ts.CompilerOptions;

  /** Skip files with syntax errors */
  skipErrors?: boolean;
}

// Import types from core types module
import { GraphNode, GraphEdge } from '../../types.js';