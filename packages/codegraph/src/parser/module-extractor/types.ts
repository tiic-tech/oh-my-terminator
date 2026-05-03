/**
 * Module Extractor Types
 *
 * Type definitions for module extraction
 */

import { GraphNode, GraphEdge } from '../../types.js';

/**
 * Module kind classification
 */
export type ModuleKind = 'function' | 'class' | 'interface' | 'type' | 'component' | 'variable';

/**
 * Extended metadata for MODULE nodes
 */
export interface ModuleMetadata {
  /** Kind classification */
  kind: ModuleKind;

  /** JSDoc comment (first 200 chars) */
  jsDoc?: string;

  /** McCabe cyclomatic complexity */
  complexity?: number;

  /** Effective lines of code */
  loc?: number;

  /** For named default exports */
  namedDefault?: boolean;

  /** For renamed exports */
  originalName?: string;

  /** For enums */
  enumMembers?: string[];

  /** For multiple exports of same symbol */
  exports?: string[];
}

/**
 * Result of extracting modules from a single file
 */
export interface ModuleExtractResult {
  /** MODULE nodes created */
  nodes: GraphNode[];

  /** CONTAINS edges from FILE to MODULE */
  edges: GraphEdge[];

  /** Non-fatal warnings */
  warnings: string[];
}

/**
 * Export info for tracking symbol exports
 */
export interface ExportInfo {
  /** Export types (named, default) */
  exportTypes: string[];

  /** Exported names */
  exportedNames: string[];
}

/**
 * Export info map type
 */
export type ExportInfoMap = Map<string, ExportInfo>;