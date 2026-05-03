/**
 * Edge Generation
 *
 * Generates IMPORTS, RE_EXPORTS, and DYNAMIC_IMPORTS edges from import info.
 */

import { GraphEdge, EdgeType } from '../../types.js';
import { ImportInfo } from './types.js';
import { extractPackageName } from './module-resolution.js';

/**
 * Generate an IMPORTS edge from import info
 *
 * @param info - Import information
 * @returns GraphEdge with IMPORTS type
 */
export function generateImportEdge(info: ImportInfo): GraphEdge {
  const targetId = info.resolvedPath
    ? `FILE:${info.resolvedPath}`
    : `EXTERNAL:${extractPackageName(info.specifier)}`;

  return {
    from: `FILE:${info.sourceFile}`,
    to: targetId,
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
 * @param info - Import information (must have importType 're-export')
 * @returns GraphEdge with RE_EXPORTS type
 */
export function generateReExportEdge(info: ImportInfo): GraphEdge {
  const targetId = info.resolvedPath
    ? `FILE:${info.resolvedPath}`
    : `EXTERNAL:${extractPackageName(info.specifier)}`;

  return {
    from: `FILE:${info.sourceFile}`,
    to: targetId,
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
 * @param info - Import information (must have importType 'dynamic')
 * @returns GraphEdge with DYNAMIC_IMPORTS type
 */
export function generateDynamicImportEdge(info: ImportInfo): GraphEdge {
  const targetId = info.resolvedPath
    ? `FILE:${info.resolvedPath}`
    : `EXTERNAL:${extractPackageName(info.specifier)}`;

  return {
    from: `FILE:${info.sourceFile}`,
    to: targetId,
    type: EdgeType.DYNAMIC_IMPORTS,
    metadata: {
      line: info.line,
      importSpecifier: 'dynamic',
    },
  };
}