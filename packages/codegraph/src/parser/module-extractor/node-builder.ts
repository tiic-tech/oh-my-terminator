/**
 * Node Builder
 *
 * Build MODULE nodes with metadata
 */

import ts from 'typescript';
import { GraphNode, NodeType, EdgeType } from '../../types.js';
import { ModuleKind, ModuleMetadata, ModuleExtractResult, ExportInfoMap } from './types.js';
import { generateModuleId } from './module-id.js';
import { extractJSDoc } from './jsdoc-extractor.js';
import { calculateComplexity } from './complexity.js';
import { countLOC } from './loc-counter.js';

/**
 * Create MODULE node with all metadata
 *
 * @param node - AST node
 * @param sourceFile - Source file
 * @param relativePath - Relative file path
 * @param fileId - Parent FILE node ID
 * @param name - Export name
 * @param kind - Module kind
 * @param result - Result accumulator
 * @param exportNames - Name collision tracker
 * @param hasName - Whether declaration has a name
 * @param isDefault - Whether this is a default export
 * @param internalName - Internal symbol name (for renamed exports)
 * @param exportInfoMap - Export info map
 * @param allExportTypes - All export types for this symbol
 */
export function createModuleNode(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  relativePath: string,
  fileId: string,
  name: string,
  kind: ModuleKind,
  result: ModuleExtractResult,
  exportNames: Map<string, number>,
  hasName: boolean,
  isDefault: boolean,
  internalName?: string,
  exportInfoMap?: ExportInfoMap,
  allExportTypes?: string[]
): void {
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
  const metadata: ModuleMetadata = { kind };

  // JSDoc
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

  const metadata: ModuleMetadata = { kind };
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