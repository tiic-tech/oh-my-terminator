import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NodeType, EdgeType, GraphNode, GraphEdge, SerializedCodeGraph } from '../../src/types.js';

describe('NodeType enum', () => {
  it('should contain DIRECTORY value', () => {
    assert.strictEqual(NodeType.DIRECTORY, 'DIRECTORY');
  });

  it('should contain FILE value', () => {
    assert.strictEqual(NodeType.FILE, 'FILE');
  });

  it('should contain MODULE value', () => {
    assert.strictEqual(NodeType.MODULE, 'MODULE');
  });

  it('should contain EXTERNAL value', () => {
    assert.strictEqual(NodeType.EXTERNAL, 'EXTERNAL');
  });

  it('should have exactly 4 values', () => {
    const values = Object.values(NodeType);
    assert.strictEqual(values.length, 4);
  });
});

describe('EdgeType enum', () => {
  it('should contain CONTAINS value', () => {
    assert.strictEqual(EdgeType.CONTAINS, 'CONTAINS');
  });

  it('should contain IMPORTS value', () => {
    assert.strictEqual(EdgeType.IMPORTS, 'IMPORTS');
  });

  it('should contain EXPORTS value', () => {
    assert.strictEqual(EdgeType.EXPORTS, 'EXPORTS');
  });

  it('should contain CALLS value', () => {
    assert.strictEqual(EdgeType.CALLS, 'CALLS');
  });

  it('should contain EXTENDS value', () => {
    assert.strictEqual(EdgeType.EXTENDS, 'EXTENDS');
  });

  it('should contain IMPLEMENTS value', () => {
    assert.strictEqual(EdgeType.IMPLEMENTS, 'IMPLEMENTS');
  });

  it('should contain RE_EXPORTS value', () => {
    assert.strictEqual(EdgeType.RE_EXPORTS, 'RE_EXPORTS');
  });

  it('should contain DYNAMIC_IMPORTS value', () => {
    assert.strictEqual(EdgeType.DYNAMIC_IMPORTS, 'DYNAMIC_IMPORTS');
  });

  it('should have exactly 8 values', () => {
    const values = Object.values(EdgeType);
    assert.strictEqual(values.length, 8);
  });
});

describe('GraphNode interface', () => {
  it('should allow creating a FILE node', () => {
    const node: GraphNode = {
      id: 'FILE:src/utils.ts',
      type: NodeType.FILE,
      path: 'src/utils.ts',
      name: 'utils.ts',
    };
    assert.strictEqual(node.id, 'FILE:src/utils.ts');
    assert.strictEqual(node.type, NodeType.FILE);
  });

  it('should allow creating a MODULE node with metadata', () => {
    const node: GraphNode = {
      id: 'MODULE:src/utils.ts#formatDate',
      type: NodeType.MODULE,
      path: 'src/utils.ts',
      name: 'formatDate',
      metadata: {
        kind: 'function',
        jsDoc: 'Format a date to string',
        complexity: 2,
        loc: 15,
        isExported: true,
        deprecated: false,
      },
    };
    assert.strictEqual(node.metadata?.kind, 'function');
    assert.strictEqual(node.metadata?.complexity, 2);
  });

  it('should allow creating a DIRECTORY node', () => {
    const node: GraphNode = {
      id: 'DIRECTORY:src',
      type: NodeType.DIRECTORY,
      path: 'src',
      name: 'src',
    };
    assert.strictEqual(node.type, NodeType.DIRECTORY);
  });

  it('should allow creating an EXTERNAL node', () => {
    const node: GraphNode = {
      id: 'EXTERNAL:jsonwebtoken',
      type: NodeType.EXTERNAL,
      path: 'jsonwebtoken',
      name: 'jsonwebtoken',
    };
    assert.strictEqual(node.type, NodeType.EXTERNAL);
  });
});

describe('GraphEdge interface', () => {
  it('should allow creating an IMPORTS edge', () => {
    const edge: GraphEdge = {
      from: 'FILE:src/main.ts',
      to: 'FILE:src/utils.ts',
      type: EdgeType.IMPORTS,
    };
    assert.strictEqual(edge.type, EdgeType.IMPORTS);
    assert.strictEqual(edge.from, 'FILE:src/main.ts');
    assert.strictEqual(edge.to, 'FILE:src/utils.ts');
  });

  it('should allow creating an edge with metadata', () => {
    const edge: GraphEdge = {
      from: 'FILE:src/main.ts',
      to: 'FILE:src/utils.ts',
      type: EdgeType.IMPORTS,
      metadata: {
        line: 5,
        importSpecifier: 'named:formatDate',
      },
    };
    assert.strictEqual(edge.metadata?.line, 5);
    assert.strictEqual(edge.metadata?.importSpecifier, 'named:formatDate');
  });

  it('should allow creating a CONTAINS edge', () => {
    const edge: GraphEdge = {
      from: 'DIRECTORY:src',
      to: 'FILE:src/utils.ts',
      type: EdgeType.CONTAINS,
    };
    assert.strictEqual(edge.type, EdgeType.CONTAINS);
  });
});

describe('SerializedCodeGraph interface', () => {
  it('should allow creating a serialized graph', () => {
    const serialized: SerializedCodeGraph = {
      nodes: [['FILE:src/utils.ts', { id: 'FILE:src/utils.ts', type: NodeType.FILE, path: 'src/utils.ts', name: 'utils.ts' }]],
      edges: [],
      commitHash: 'abc123',
      timestamp: 1234567890,
    };
    assert.strictEqual(serialized.nodes.length, 1);
    assert.strictEqual(serialized.commitHash, 'abc123');
  });
});