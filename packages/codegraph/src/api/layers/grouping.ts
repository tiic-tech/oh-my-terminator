/**
 * C8: Architecture Layers - Directory Grouping
 *
 * Groups files by first-level directory for layer inference.
 */

import { CodeGraph } from '../../graph.js';
import { NodeType, EdgeType } from '../../types.js';

/**
 * Directory group with import statistics
 */
export interface DirectoryGroup {
  /** Group name (first-level directory or '__root__') */
  name: string;
  /** FILE node IDs in this group */
  files: string[];
  /** Import statistics */
  importStats: {
    /** Which groups import this group and counts */
    importedBy: Map<string, number>;
    /** Which groups this group imports and counts */
    importsFrom: Map<string, number>;
  };
}

/**
 * Get group name from file node ID
 *
 * Returns '__root__' for root-level files, '__external__' for external deps.
 */
export function getGroupNameFromFile(fileId: string, sourceRoot: string): string {
  const path = fileId.replace('FILE:', '');

  // Check if external
  if (!path.startsWith(sourceRoot + '/') && !path.startsWith(sourceRoot)) {
    return '__external__';
  }

  // Extract relative path after sourceRoot
  const pathAfterRoot = path.startsWith(sourceRoot + '/')
    ? path.slice(sourceRoot.length + 1)
    : path;

  const firstSlashIndex = pathAfterRoot.indexOf('/');

  if (firstSlashIndex === -1) {
    // No subdirectory - root file
    return '__root__';
  }

  return pathAfterRoot.slice(0, firstSlashIndex);
}

/**
 * Group files by first-level directory
 *
 * Creates DirectoryGroup for each first-level subdirectory.
 * '__root__' group for root-level files.
 */
export function groupFilesByFirstLevelDirectory(
  graph: CodeGraph,
  sourceRoot: string = 'src'
): Map<string, DirectoryGroup> {
  const groups = new Map<string, DirectoryGroup>();

  // Initialize __root__ group
  groups.set('__root__', {
    name: '__root__',
    files: [],
    importStats: { importedBy: new Map(), importsFrom: new Map() },
  });

  // Iterate FILE nodes
  for (const [nodeId, node] of graph.nodes) {
    if (node.type !== NodeType.FILE) {
      continue;
    }

    // Get group name
    const groupName = getGroupNameFromFile(nodeId, sourceRoot);

    // Skip external dependencies
    if (groupName === '__external__') {
      continue;
    }

    // Initialize group if not exists
    if (!groups.has(groupName)) {
      groups.set(groupName, {
        name: groupName,
        files: [],
        importStats: { importedBy: new Map(), importsFrom: new Map() },
      });
    }

    // Add file to group using immutable update
    const existingGroup = groups.get(groupName)!;
    groups.set(groupName, {
      ...existingGroup,
      files: [...existingGroup.files, nodeId],
    });
  }

  return groups;
}

/**
 * Compute import direction statistics between groups
 *
 * Populates importStats.importedBy and importStats.importsFrom for each group.
 */
export function computeImportDirectionStats(
  graph: CodeGraph,
  groups: Map<string, DirectoryGroup>,
  sourceRoot: string = 'src'
): void {
  // Iterate all edges
  for (const edge of graph.edges) {
    // Only count IMPORTS and RE_EXPORTS
    if (edge.type !== EdgeType.IMPORTS && edge.type !== EdgeType.RE_EXPORTS) {
      continue;
    }

    const fromFile = edge.from;
    const toFile = edge.to;

    // Skip if either is external
    if (!fromFile.startsWith('FILE:') || !toFile.startsWith('FILE:')) {
      continue;
    }

    const fromGroup = getGroupNameFromFile(fromFile, sourceRoot);
    const toGroup = getGroupNameFromFile(toFile, sourceRoot);

    // Skip external groups
    if (fromGroup === '__external__' || toGroup === '__external__') {
      continue;
    }

    // Skip same-group imports
    if (fromGroup === toGroup) {
      continue;
    }

    // Update fromGroup's importsFrom
    const fromGroupData = groups.get(fromGroup);
    if (fromGroupData) {
      const count = fromGroupData.importStats.importsFrom.get(toGroup) || 0;
      fromGroupData.importStats.importsFrom.set(toGroup, count + 1);
    }

    // Update toGroup's importedBy
    const toGroupData = groups.get(toGroup);
    if (toGroupData) {
      const count = toGroupData.importStats.importedBy.get(fromGroup) || 0;
      toGroupData.importStats.importedBy.set(fromGroup, count + 1);
    }
  }
}