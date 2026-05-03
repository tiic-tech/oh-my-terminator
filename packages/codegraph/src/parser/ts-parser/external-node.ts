/**
 * External Node Creation
 *
 * Creates EXTERNAL nodes for unresolved package imports.
 */

import { GraphNode, NodeType } from '../../types.js';

/**
 * Create an EXTERNAL node for a package
 *
 * @param packageName - Package name (e.g., 'lodash', '@types/node')
 * @returns GraphNode with EXTERNAL type
 */
export function createExternalNode(packageName: string): GraphNode {
  return {
    id: `EXTERNAL:${packageName}`,
    type: NodeType.EXTERNAL,
    path: packageName,
    name: packageName,
  };
}