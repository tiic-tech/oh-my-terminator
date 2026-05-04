/**
 * TypeScript Parser Type Definitions
 *
 * Core types for TypeScript/JavaScript import parsing.
 */

import type { ParserResult } from '../../types.js';
import ts from 'typescript';

// Re-export ParserResult from single truth source (src/types.ts)
export type { ParserResult };

/**
 * Extracted import information (raw parsed data)
 *
 * This represents the raw import data extracted during parsing.
 * Different from api/types.ts ImportInfo which is the formatted API output.
 */
export interface ParsedImportInfo {
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