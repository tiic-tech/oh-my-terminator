/**
 * Node Builder
 *
 * Build MODULE nodes with metadata
 */

import ts from 'typescript';
import { GraphNode, NodeType, EdgeType } from '../../types.js';
import { ModuleKind, ModuleMetadata, ModuleExtractResult, ExportInfoMap } from './types.js';
import { generateModuleId } from './module-id.js';
import { extractJSDoc, isDeprecated } from './jsdoc-extractor.js';
import { calculateComplexity } from './complexity.js';
import { countLOC } from './loc-counter.js';
import { isExported } from './export-info.js';

/**
 * Options for creating a MODULE node
 *
 * Groups related parameters for better decomposition
 */
export interface CreateModuleNodeOptions {
  // Core context
  node: ts.Node;
  sourceFile: ts.SourceFile;
  relativePath: string;
  fileId: string;

  // Module identity
  name: string;
  kind: ModuleKind;

  // Result containers
  result: ModuleExtractResult;
  exportNames: Map<string, number>;

  // Export info (grouped)
  exportInfo: {
    hasName: boolean;
    isDefault: boolean;
    internalName?: string;
    exportInfoMap?: ExportInfoMap;
    allExportTypes?: string[];
  };
}

/**
 * Create MODULE node with all metadata
 */
export function createModuleNode(options: CreateModuleNodeOptions): void {
  const {
    node,
    sourceFile,
    relativePath,
    fileId,
    name,
    kind,
    result,
    exportNames,
    exportInfo,
  } = options;

  const {
    hasName,
    isDefault,
    internalName,
    exportInfoMap,
    allExportTypes,
  } = exportInfo;
  // Handle duplicate names (anonymous defaults)
  let finalName = name;
  const count = exportNames.get(name) ?? 0;
  if (count > 0) {
    finalName = `${name}_${count}`;
  }
  exportNames.set(name, count + 1);

  // Generate ID
  const moduleId = generateModuleId(relativePath, finalName);

  // Extract metadata
  const metadata = buildMetadata(
    node,
    sourceFile,
    kind,
    hasName,
    isDefault,
    internalName,
    name,
    allExportTypes
  );

  // Create node
  const moduleNode: GraphNode = {
    id: moduleId,
    type: NodeType.MODULE,
    path: relativePath,
    name: finalName,
    metadata,
  };

  result.nodes.push(moduleNode);

  // Create CONTAINS edge
  result.edges.push({
    from: fileId,
    to: moduleId,
    type: EdgeType.CONTAINS,
  });
}

/**
 * Build metadata for MODULE node
 *
 * @param node - AST node
 * @param sourceFile - Source file
 * @param kind - Module kind
 * @param hasName - Whether declaration has a name
 * @param isDefault - Whether this is a default export
 * @param internalName - Internal symbol name
 * @param exportName - Exported name
 * @param allExportTypes - All export types
 * @returns ModuleMetadata object
 */
export function buildMetadata(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  kind: ModuleKind,
  hasName: boolean,
  isDefault: boolean,
  internalName?: string,
  exportName?: string,
  allExportTypes?: string[]
): ModuleMetadata {
  const metadata: ModuleMetadata = {
    kind,
    // All MODULE nodes are exported by definition
    // (MODULE nodes are only created for exported symbols)
    isExported: true,
  };

  // Check for @deprecated in JSDoc
  if (isDeprecated(node, sourceFile)) {
    metadata.deprecated = true;
  }

  // JSDoc (text content)
  const jsdoc = extractJSDoc(node, sourceFile);
  if (jsdoc) {
    metadata.jsDoc = jsdoc;
  }

  // Complexity (for functions/methods)
  if (kind === 'function' || kind === 'component') {
    metadata.complexity = calculateComplexity(node);
    metadata.loc = countLOC(sourceFile, node);
  }

  // Named default (export default function name() {})
  if (isDefault && hasName) {
    metadata.namedDefault = true;
  }

  // For renamed exports (internalName !== name)
  if (internalName && exportName && internalName !== exportName) {
    metadata.originalName = internalName;
  }

  // For enums
  if (ts.isEnumDeclaration(node)) {
    metadata.enumMembers = node.members.map(m => m.name.getText(sourceFile));
  }

  // Add exports metadata if multiple export types exist
  if (allExportTypes && allExportTypes.length > 1) {
    metadata.exports = allExportTypes;
  }

  return metadata;
}

/**
 * Create a simple MODULE node for re-exports or unknown types
 *
 * NOTE: For re-exports, we cannot detect @deprecated because
 * the original declaration is in another file. The deprecated
 * status should be checked from the original symbol's file.
 *
 * @param relativePath - Relative file path
 * @param fileId - Parent FILE node ID
 * @param exportedName - Exported name
 * @param originalName - Original name (if renamed)
 * @param kind - Module kind (default 'variable')
 * @param result - Result accumulator
 * @param exportNames - Name collision tracker
 */
export function createSimpleModuleNode(
  relativePath: string,
  fileId: string,
  exportedName: string,
  originalName?: string,
  kind: ModuleKind = 'variable',
  result: ModuleExtractResult,
  exportNames: Map<string, number>
): void {
  // Handle duplicates
  let finalName = exportedName;
  const count = exportNames.get(exportedName) ?? 0;
  if (count > 0) {
    finalName = `${exportedName}_${count}`;
  }
  exportNames.set(exportedName, count + 1);

  const moduleId = generateModuleId(relativePath, finalName);

  const metadata: ModuleMetadata = {
    kind,
    // Re-exports are exported by definition
    isExported: true,
  };
  if (originalName && originalName !== exportedName) {
    metadata.originalName = originalName;
  }

  result.nodes.push({
    id: moduleId,
    type: NodeType.MODULE,
    path: relativePath,
    name: finalName,
    metadata,
  });

  result.edges.push({
    from: fileId,
    to: moduleId,
    type: EdgeType.CONTAINS,
  });
}