/**
 * Edge Generation
 *
 * Generates IMPORTS, RE_EXPORTS, and DYNAMIC_IMPORTS edges from import info.
 */

import { GraphEdge, EdgeType } from '../../types.js';
import { ParsedImportInfo } from './types.js';
import { extractPackageName, isNodeModulesPath, extractPackageFromNodeModules } from './module-resolution.js';

/**
 * Compute target ID for an import edge
 *
 * Single source of truth for target ID computation.
 * - Resolved imports to project files → FILE nodes
 * - Resolved imports to node_modules → EXTERNAL nodes (npm packages)
 * - Unresolved imports → EXTERNAL nodes
 *
 * @param info - Parsed import information
 * @returns Target node ID string
 */
function getTargetId(info: ParsedImportInfo): string {
  // No resolved path → external package from specifier
  if (!info.resolvedPath) {
    return `EXTERNAL:${extractPackageName(info.specifier)}`;
  }

  // Resolved to node_modules → treat as EXTERNAL (npm package)
  // TypeScript resolves npm packages to actual .d.ts files in node_modules,
  // but these should be represented as EXTERNAL nodes in the graph.
  if (isNodeModulesPath(info.resolvedPath)) {
    const packageName = extractPackageFromNodeModules(info.resolvedPath);
    return `EXTERNAL:${packageName}`;
  }

  // Resolved to project file → FILE node
  return `FILE:${info.resolvedPath}`;
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