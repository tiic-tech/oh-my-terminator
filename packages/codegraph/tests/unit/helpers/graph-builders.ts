/**
 * Test Helpers: Graph Node Builders
 *
 * WHY extracted: Eliminate duplication between complexity.test.ts and complexity-level.test.ts.
 * One Truth principle: Single source for test graph node creation.
 *
 * Usage:
 * ```typescript
 * import { createFileNode, createModuleNode } from './helpers/graph-builders.js';
 * ```
 */

import { NodeType } from '../../../src/types.js';

/**
 * Create a FILE node for testing
 *
 * @param path - File path (e.g., 'src/utils.ts')
 * @returns FILE node with required properties
 */
export function createFileNode(path: string): {
  id: string;
  type: NodeType;
  path: string;
  name: string;
} {
  return {
    id: `FILE:${path}`,
    type: NodeType.FILE,
    path,
    name: path.split('/').pop() ?? path,
  };
}

/**
 * Create a MODULE node with complexity for testing
 *
 * @param path - File path (e.g., 'src/utils.ts')
 * @param name - Module name (e.g., 'myFunction')
 * @param complexity - Cyclomatic complexity value
 * @returns MODULE node with complexity metadata
 */
export function createModuleNode(
  path: string,
  name: string,
  complexity: number
): {
  id: string;
  type: NodeType;
  path: string;
  name: string;
  metadata: { kind: string; complexity: number };
} {
  return {
    id: `MODULE:${path}#${name}`,
    type: NodeType.MODULE,
    path,
    name,
    metadata: { kind: 'function', complexity },
  };
}

/**
 * Create a MODULE node without complexity (class/interface) for testing
 *
 * @param path - File path
 * @param name - Module name
 * @param kind - Module kind (class, interface, variable, etc.)
 * @returns MODULE node with kind metadata (no complexity)
 */
export function createModuleNodeWithoutComplexity(
  path: string,
  name: string,
  kind: string
): {
  id: string;
  type: NodeType;
  path: string;
  name: string;
  metadata: { kind: string };
} {
  return {
    id: `MODULE:${path}#${name}`,
    type: NodeType.MODULE,
    path,
    name,
    metadata: { kind },
  };
}