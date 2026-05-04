/**
 * Edge Generation
 *
 * Generates IMPORTS, RE_EXPORTS, and DYNAMIC_IMPORTS edges from import info.
 */

import { GraphEdge, EdgeType } from '../../types.js';
import { ParsedImportInfo } from './types.js';
import { extractPackageName } from './module-resolution.js';

/**
 * Compute target ID for an import edge
 *
 * Single source of truth for target ID computation.
 * Resolved imports target FILE nodes, unresolved imports target EXTERNAL nodes.
 *
 * @param info - Parsed import information
 * @returns Target node ID string
 */
function getTargetId(info: ParsedImportInfo): string {
  return info.resolvedPath
    ? `FILE:${info.resolvedPath}`
    : `EXTERNAL:${extractPackageName(info.specifier)}`;
}

/**
 * Generate an IMPORTS edge from import info
 *
 * @param info - Parsed import information
 * @returns GraphEdge with IMPORTS type
 */
export function generateImportEdge(info: ParsedImportInfo): GraphEdge {
  return {
    from: `FILE:${info.sourceFile}`,
    to: getTargetId(info),
    type: EdgeType.IMPORTS,
    metadata: {
      line: info.line,
      importSpecifier: info.importSpecifier,
    },
  };
}

/**
 * Generate a RE_EXPORTS edge from import info
 *
 * @param info - Parsed import information (must have importType 're-export')
 * @returns GraphEdge with RE_EXPORTS type
 */
export function generateReExportEdge(info: ParsedImportInfo): GraphEdge {
  return {
    from: `FILE:${info.sourceFile}`,
    to: getTargetId(info),
    type: EdgeType.RE_EXPORTS,
    metadata: {
      line: info.line,
      importSpecifier: info.importSpecifier,
    },
  };
}

/**
 * Generate a DYNAMIC_IMPORTS edge from import info
 *
 * @param info - Parsed import information (must have importType 'dynamic')
 * @returns GraphEdge with DYNAMIC_IMPORTS type
 */
export function generateDynamicImportEdge(info: ParsedImportInfo): GraphEdge {
  return {
    from: `FILE:${info.sourceFile}`,
    to: getTargetId(info),
    type: EdgeType.DYNAMIC_IMPORTS,
    metadata: {
      line: info.line,
      importSpecifier: 'dynamic',
    },
  };
}