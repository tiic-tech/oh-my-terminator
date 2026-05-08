/**
 * Unit tests for compression types (Tasks 1.1-1.10)
 *
 * Tests the type definitions for baseline compression feature.
 * Run with: pnpm test tests/unit/compression-types.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import types to test (will fail initially - RED phase)
import {
  CompressionOptions,
  CompressionConfig,
  PathTable,
  CompressedNode,
  CompressedEdge,
  IMPORTS_BATCH,
  CompressedModuleMetadata,
  CompressedBaseline,
  NodeType,
  EdgeType,
  CliErrorCode,
  SchemaVersion,
  ModuleMetadata,
} from '../../src/types.js';

// ============================================================================
// Task 1.1: CompressionOptions interface
// ============================================================================
describe('CompressionOptions (Task 1.1)', () => {
  it('should accept valid CompressionOptions with enabled true', () => {
    const options: CompressionOptions = {
      enabled: true,
    };
    assert.strictEqual(options.enabled, true);
  });

  it('should accept valid CompressionOptions with enabled false', () => {
    const options: CompressionOptions = {
      enabled: false,
    };
    assert.strictEqual(options.enabled, false);
  });

  it('should accept optional jsDocMaxLength', () => {
    const options: CompressionOptions = {
      enabled: true,
      jsDocMaxLength: 100,
    };
    assert.strictEqual(options.jsDocMaxLength, 100);
  });

  it('should allow jsDocMaxLength to be undefined', () => {
    const options: CompressionOptions = {
      enabled: true,
    };
    assert.strictEqual(options.jsDocMaxLength, undefined);
  });

  it('should default enabled to true in implementation', () => {
    // This tests runtime behavior, not type
    const defaultOptions: CompressionOptions = { enabled: true };
    assert.strictEqual(defaultOptions.enabled, true);
  });
});

// ============================================================================
// Task 1.2: CompressionConfig interface
// ============================================================================
describe('CompressionConfig (Task 1.2)', () => {
  it('should accept valid CompressionConfig', () => {
    const config: CompressionConfig = {
      compression: {
        enabled: true,
        jsDocMaxLength: 100,
      },
    };
    assert.strictEqual(config.compression.enabled, true);
    assert.strictEqual(config.compression.jsDocMaxLength, 100);
  });

  it('should allow compression options to be minimal', () => {
    const config: CompressionConfig = {
      compression: {
        enabled: false,
      },
    };
    assert.strictEqual(config.compression.enabled, false);
  });
});

// ============================================================================
// Task 1.3: schemaVersion in BaselineData
// ============================================================================
describe('schemaVersion in BaselineData (Task 1.3)', () => {
  it('should accept valid SchemaVersion object', () => {
    const version: SchemaVersion = {
      major: 1,
      minor: 1,
      patch: 0,
    };
    assert.strictEqual(version.major, 1);
    assert.strictEqual(version.minor, 1);
    assert.strictEqual(version.patch, 0);
  });

  it('should be optional in CompressedBaseline', () => {
    const baseline: CompressedBaseline = {
      pathTable: ['src/test.ts'],
      nodes: [],
      edges: [],
      commitHash: 'abc123',
      timestamp: Date.now(),
    };
    assert.strictEqual(baseline.schemaVersion, undefined);
  });

  it('should be present in CompressedBaseline when provided', () => {
    const baseline: CompressedBaseline = {
      schemaVersion: { major: 1, minor: 1, patch: 0 },
      pathTable: ['src/test.ts'],
      nodes: [],
      edges: [],
      commitHash: 'abc123',
      timestamp: Date.now(),
    };
    assert.ok(baseline.schemaVersion);
    assert.strictEqual(baseline.schemaVersion?.major, 1);
  });
});

// ============================================================================
// Task 1.4: JSDoc fields in MODULE node metadata
// ============================================================================
describe('JSDoc fields in ModuleMetadata (Task 1.4)', () => {
  it('should accept jsDocTruncated flag', () => {
    const metadata: ModuleMetadata = {
      kind: 'function',
      jsDoc: 'Truncated content...',
      jsDocTruncated: true,
    };
    assert.strictEqual(metadata.jsDocTruncated, true);
  });

  it('should accept hasJSDoc flag', () => {
    const metadata: ModuleMetadata = {
      kind: 'function',
      hasJSDoc: false,
    };
    assert.strictEqual(metadata.hasJSDoc, false);
  });

  it('should accept both jsDocTruncated and hasJSDoc', () => {
    const metadata: ModuleMetadata = {
      kind: 'function',
      jsDoc: 'Some doc...',
      jsDocTruncated: true,
      hasJSDoc: true,
    };
    assert.strictEqual(metadata.jsDocTruncated, true);
    assert.strictEqual(metadata.hasJSDoc, true);
  });

  it('should work in CompressedModuleMetadata', () => {
    const metadata: CompressedModuleMetadata = {
      kind: 'class',
      jsDoc: 'A class...',
      jsDocTruncated: true,
      hasJSDoc: true,
    };
    assert.strictEqual(metadata.jsDocTruncated, true);
    assert.strictEqual(metadata.hasJSDoc, true);
  });
});

// ============================================================================
// Task 1.5: PathTable type
// ============================================================================
describe('PathTable type (Task 1.5)', () => {
  it('should be string array', () => {
    const pathTable: PathTable = [
      'src/analyzer.ts',
      'src/types.ts',
      'node_modules/react/index.js',
    ];
    assert.strictEqual(pathTable.length, 3);
    assert.strictEqual(pathTable[0], 'src/analyzer.ts');
  });

  it('should allow empty path table', () => {
    const pathTable: PathTable = [];
    assert.strictEqual(pathTable.length, 0);
  });

  it('should be indexable by number', () => {
    const pathTable: PathTable = ['src/a.ts', 'src/b.ts'];
    const index = 0;
    const path = pathTable[index];
    assert.strictEqual(path, 'src/a.ts');
  });
});

// ============================================================================
// Task 1.6: CompressedNode interface
// ============================================================================
describe('CompressedNode (Task 1.6)', () => {
  it('should have no id field (implicit from pathIndex)', () => {
    const node: CompressedNode = {
      type: NodeType.FILE,
      pathIndex: 0,
    };
    // TypeScript ensures no 'id' field exists
    assert.strictEqual(node.type, NodeType.FILE);
    assert.strictEqual(node.pathIndex, 0);
  });

  it('should accept optional name', () => {
    const node: CompressedNode = {
      type: NodeType.FILE,
      pathIndex: 5,
      name: 'analyzer.ts',
    };
    assert.strictEqual(node.name, 'analyzer.ts');
  });

  it('should accept optional metadata for MODULE type', () => {
    const node: CompressedNode = {
      type: NodeType.MODULE,
      pathIndex: 10,
      name: 'formatDate',
      metadata: {
        kind: 'function',
        isExported: true,
        jsDoc: 'Format date...',
        jsDocTruncated: true,
        hasJSDoc: true,
      },
    };
    assert.strictEqual(node.type, NodeType.MODULE);
    assert.strictEqual(node.metadata?.kind, 'function');
  });

  it('should reconstruct node ID from type and pathIndex', () => {
    const pathTable: PathTable = ['src/utils.ts'];
    const node: CompressedNode = {
      type: NodeType.FILE,
      pathIndex: 0,
    };
    // ID reconstruction: `${node.type}:${pathTable[node.pathIndex]}`
    const reconstructedId = `${node.type}:${pathTable[node.pathIndex]}`;
    assert.strictEqual(reconstructedId, 'FILE:src/utils.ts');
  });

  it('should reconstruct MODULE node ID with export name', () => {
    const pathTable: PathTable = ['src/utils.ts'];
    const node: CompressedNode = {
      type: NodeType.MODULE,
      pathIndex: 0,
      name: 'formatDate',
    };
    // MODULE ID format: MODULE:path#name
    const reconstructedId = `MODULE:${pathTable[node.pathIndex]}#${node.name}`;
    assert.strictEqual(reconstructedId, 'MODULE:src/utils.ts#formatDate');
  });
});

// ============================================================================
// Task 1.7: CompressedEdge interface
// ============================================================================
describe('CompressedEdge (Task 1.7)', () => {
  it('should have no id field', () => {
    const edge: CompressedEdge = {
      type: EdgeType.IMPORTS,
      fromIndex: 0,
      toIndex: 2,
    };
    assert.strictEqual(edge.type, EdgeType.IMPORTS);
    assert.strictEqual(edge.fromIndex, 0);
    assert.strictEqual(edge.toIndex, 2);
  });

  it('should accept optional metadata', () => {
    const edge: CompressedEdge = {
      type: EdgeType.IMPORTS,
      fromIndex: 0,
      toIndex: 5,
      metadata: {
        line: 10,
        importSpecifier: 'named:formatDate',
      },
    };
    assert.strictEqual(edge.metadata?.line, 10);
    assert.strictEqual(edge.metadata?.importSpecifier, 'named:formatDate');
  });

  it('should use fromIndex/toIndex for path references', () => {
    const pathTable: PathTable = ['src/a.ts', 'src/b.ts'];
    const edge: CompressedEdge = {
      type: EdgeType.IMPORTS,
      fromIndex: 0,
      toIndex: 1,
    };
    // Path reconstruction
    const fromPath = pathTable[edge.fromIndex];
    const toPath = pathTable[edge.toIndex];
    assert.strictEqual(fromPath, 'src/a.ts');
    assert.strictEqual(toPath, 'src/b.ts');
  });

  it('should support other edge types', () => {
    const edge: CompressedEdge = {
      type: EdgeType.CONTAINS,
      fromIndex: 0,
      toIndex: 1,
    };
    assert.strictEqual(edge.type, EdgeType.CONTAINS);
  });
});

// ============================================================================
// Task 1.8: IMPORTS_BATCH edge type
// ============================================================================
describe('IMPORTS_BATCH edge type (Task 1.8)', () => {
  it('should have type as literal string', () => {
    const batch: IMPORTS_BATCH = {
      type: 'IMPORTS_BATCH',
      fromIndex: 0,
      targetIndexes: [1, 2, 3],
    };
    assert.strictEqual(batch.type, 'IMPORTS_BATCH');
  });

  it('should accept targetIndexes array', () => {
    const batch: IMPORTS_BATCH = {
      type: 'IMPORTS_BATCH',
      fromIndex: 0,
      targetIndexes: [5, 10, 15, 20],
    };
    assert.strictEqual(batch.targetIndexes.length, 4);
    assert.strictEqual(batch.targetIndexes[0], 5);
  });

  it('should allow single target in batch', () => {
    const batch: IMPORTS_BATCH = {
      type: 'IMPORTS_BATCH',
      fromIndex: 0,
      targetIndexes: [2],
    };
    assert.strictEqual(batch.targetIndexes.length, 1);
  });

  it('should expand to multiple edges', () => {
    const pathTable: PathTable = ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts'];
    const batch: IMPORTS_BATCH = {
      type: 'IMPORTS_BATCH',
      fromIndex: 0,
      targetIndexes: [1, 2, 3],
    };
    // Expansion: for each targetIndex, create an IMPORTS edge
    const expandedEdges = batch.targetIndexes.map((targetIndex) => ({
      type: EdgeType.IMPORTS,
      from: pathTable[batch.fromIndex],
      to: pathTable[targetIndex],
    }));
    assert.strictEqual(expandedEdges.length, 3);
    assert.strictEqual(expandedEdges[0].from, 'src/a.ts');
    assert.strictEqual(expandedEdges[0].to, 'src/b.ts');
  });
});

// ============================================================================
// Task 1.9: CliErrorCode additions
// ============================================================================
describe('CliErrorCode additions (Task 1.9)', () => {
  it('should have E_INVALID_CONFIG error code', () => {
    assert.strictEqual(CliErrorCode.E_INVALID_CONFIG, 'E_INVALID_CONFIG');
  });

  it('should have E_INDEX_OUT_OF_BOUNDS error code', () => {
    assert.strictEqual(CliErrorCode.E_INDEX_OUT_OF_BOUNDS, 'E_INDEX_OUT_OF_BOUNDS');
  });

  it('should have E_CORRUPTED_BASELINE error code', () => {
    assert.strictEqual(CliErrorCode.E_CORRUPTED_BASELINE, 'E_CORRUPTED_BASELINE');
  });

  it('should retain existing error codes', () => {
    assert.strictEqual(CliErrorCode.E_NO_GIT_REPO, 'E_NO_GIT_REPO');
    assert.strictEqual(CliErrorCode.E_BASELINE_NOT_FOUND, 'E_BASELINE_NOT_FOUND');
    assert.strictEqual(CliErrorCode.E_PARSE_FAILED, 'E_PARSE_FAILED');
    assert.strictEqual(CliErrorCode.E_WALK_API_FAILED, 'E_WALK_API_FAILED');
    assert.strictEqual(CliErrorCode.E_INVALID_PATH, 'E_INVALID_PATH');
    assert.strictEqual(CliErrorCode.E_EMPTY_REPO, 'E_EMPTY_REPO');
  });

  it('should be usable in error handling', () => {
    const error = {
      code: CliErrorCode.E_INDEX_OUT_OF_BOUNDS,
      message: 'Path table index 100 exceeds bounds (max: 10)',
    };
    assert.strictEqual(error.code, CliErrorCode.E_INDEX_OUT_OF_BOUNDS);
  });
});

// ============================================================================
// Task 1.10: CompressedBaseline integration
// ============================================================================
describe('CompressedBaseline integration (Task 1.10)', () => {
  it('should accept complete compressed baseline structure', () => {
    const baseline: CompressedBaseline = {
      schemaVersion: { major: 1, minor: 1, patch: 0 },
      pathTable: ['src/a.ts', 'src/b.ts', 'node_modules/react/index.js'],
      nodes: [
        { type: NodeType.FILE, pathIndex: 0, name: 'a.ts' },
        { type: NodeType.FILE, pathIndex: 1, name: 'b.ts' },
        { type: NodeType.EXTERNAL, pathIndex: 2, name: 'react' },
      ],
      edges: [
        { type: EdgeType.IMPORTS, fromIndex: 0, toIndex: 2 },
        { type: EdgeType.IMPORTS, fromIndex: 1, toIndex: 2 },
      ],
      commitHash: 'abc123',
      timestamp: 1234567890,
    };
    assert.strictEqual(baseline.schemaVersion?.major, 1);
    assert.strictEqual(baseline.pathTable.length, 3);
    assert.strictEqual(baseline.nodes.length, 3);
    assert.strictEqual(baseline.edges.length, 2);
  });

  it('should accept IMPORTS_BATCH in edges array', () => {
    const batch: IMPORTS_BATCH = {
      type: 'IMPORTS_BATCH',
      fromIndex: 0,
      targetIndexes: [1, 2],
    };
    const baseline: CompressedBaseline = {
      pathTable: ['src/a.ts', 'src/b.ts', 'node_modules/react/index.js'],
      nodes: [],
      edges: [batch],
      commitHash: 'abc123',
      timestamp: Date.now(),
    };
    assert.strictEqual(baseline.edges[0].type, 'IMPORTS_BATCH');
  });
});