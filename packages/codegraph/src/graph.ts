import { GraphNode, GraphEdge, SerializedCodeGraph } from './types.js';

/**
 * CodeGraph - Core graph data structure for repository modeling
 *
 * Maintains nodes, edges, and bidirectional indexes for efficient traversal.
 * All mutation operations automatically maintain index consistency.
 *
 * @example
 * ```typescript
 * const graph = new CodeGraph();
 * graph.addNode({ id: 'FILE:src/main.ts', type: NodeType.FILE, ... });
 * graph.addEdge({ from: 'FILE:src/main.ts', to: 'FILE:src/utils.ts', type: EdgeType.IMPORTS });
 * ```
 */
export class CodeGraph {
  /** Node storage: id → GraphNode */
  nodes: Map<string, GraphNode> = new Map();

  /** All edges in the graph */
  edges: GraphEdge[] = [];

  /** Reverse index: target node id → incoming edges */
  inEdges: Map<string, GraphEdge[]> = new Map();

  /** Forward index: source node id → outgoing edges */
  outEdges: Map<string, GraphEdge[]> = new Map();

  /** Git commit hash this graph represents */
  commitHash: string = '';

  /** Timestamp when graph was generated */
  timestamp: number = 0;

  /**
   * Add a node to the graph
   *
   * Initializes empty edge index arrays for the node.
   * If node with same id exists, it will be overwritten.
   *
   * @param node - The node to add
   */
  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
    // Initialize empty edge index arrays
    if (!this.outEdges.has(node.id)) {
      this.outEdges.set(node.id, []);
    }
    if (!this.inEdges.has(node.id)) {
      this.inEdges.set(node.id, []);
    }
  }

  /**
   * Get all nodes as an array
   *
   * @returns Array of all GraphNode objects
   */
  getNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all edges
   *
   * @returns Array of all GraphEdge objects
   */
  getEdges(): GraphEdge[] {
    return this.edges;
  }

  /**
   * Get a node by id
   *
   * @param id - Node id
   * @returns Node or undefined if not found
   */
  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Add an edge to the graph
   *
   * Updates both outEdges (source) and inEdges (target) indexes.
   * Assumes source and target nodes already exist.
   *
   * @param edge - The edge to add
   */
  addEdge(edge: GraphEdge): void {
    this.edges.push(edge);

    // Update forward index (source → outgoing edges)
    const outList = this.outEdges.get(edge.from);
    if (outList) {
      outList.push(edge);
    } else {
      this.outEdges.set(edge.from, [edge]);
    }

    // Update reverse index (target → incoming edges)
    const inList = this.inEdges.get(edge.to);
    if (inList) {
      inList.push(edge);
    } else {
      this.inEdges.set(edge.to, [edge]);
    }
  }

  /**
   * Remove a node and all its related edges
   *
   * Removes:
   * - The node from nodes Map
   * - All edges where node is source or target
   * - Edge index entries for the node
   *
   * @param id - The node id to remove
   */
  removeNode(id: string): void {
    // Remove all edges where this node is source
    const outEdges = this.outEdges.get(id) || [];
    for (const edge of outEdges) {
      this.removeEdgeFromArray(edge);
      // Clean up target's inEdges
      const targetInEdges = this.inEdges.get(edge.to);
      if (targetInEdges) {
        const idx = targetInEdges.indexOf(edge);
        if (idx >= 0) {
          targetInEdges.splice(idx, 1);
        }
      }
    }

    // Remove all edges where this node is target
    const inEdges = this.inEdges.get(id) || [];
    for (const edge of inEdges) {
      this.removeEdgeFromArray(edge);
      // Clean up source's outEdges
      const sourceOutEdges = this.outEdges.get(edge.from);
      if (sourceOutEdges) {
        const idx = sourceOutEdges.indexOf(edge);
        if (idx >= 0) {
          sourceOutEdges.splice(idx, 1);
        }
      }
    }

    // Remove node and its index entries
    this.nodes.delete(id);
    this.outEdges.delete(id);
    this.inEdges.delete(id);
  }

  /**
   * Remove all edges related to a file
   *
   * Removes edges where:
   * - Source or target is FILE node with matching path
   * - Source or target is MODULE node with matching path
   *
   * @param filePath - The file path to match
   */
  removeEdgesForFile(filePath: string): void {
    const edgesToRemove = this.edges.filter(edge => {
      // Check source
      const sourceNode = this.nodes.get(edge.from);
      if (sourceNode && (sourceNode.type === 'FILE' || sourceNode.type === 'MODULE')) {
        if (sourceNode.path === filePath) {
          return true;
        }
      }
      // Check target
      const targetNode = this.nodes.get(edge.to);
      if (targetNode && (targetNode.type === 'FILE' || targetNode.type === 'MODULE')) {
        if (targetNode.path === filePath) {
          return true;
        }
      }
      return false;
    });

    // Remove each edge and update indexes
    for (const edge of edgesToRemove) {
      this.removeEdgeFromArray(edge);
      // Clean up indexes
      const outList = this.outEdges.get(edge.from);
      if (outList) {
        const idx = outList.indexOf(edge);
        if (idx >= 0) {
          outList.splice(idx, 1);
        }
      }
      const inList = this.inEdges.get(edge.to);
      if (inList) {
        const idx = inList.indexOf(edge);
        if (idx >= 0) {
          inList.splice(idx, 1);
        }
      }
    }
  }

  /**
   * Serialize the graph to JSON format
   *
   * Converts nodes Map to array format for JSON compatibility.
   *
   * @returns Serialized graph object
   */
  toJSON(): SerializedCodeGraph {
    return {
      nodes: Array.from(this.nodes.entries()),
      edges: this.edges,
      commitHash: this.commitHash,
      timestamp: this.timestamp,
    };
  }

  /**
   * Deserialize a graph from JSON format
   *
   * Reconstructs nodes Map and rebuilds all edge indexes.
   *
   * @param data - Serialized graph data
   * @returns Restored CodeGraph instance
   */
  static fromJSON(data: SerializedCodeGraph): CodeGraph {
    const graph = new CodeGraph();

    // Restore nodes
    graph.nodes = new Map(data.nodes);

    // Restore edges and rebuild indexes
    for (const edge of data.edges) {
      graph.edges.push(edge);

      // Rebuild outEdges
      const outList = graph.outEdges.get(edge.from);
      if (outList) {
        outList.push(edge);
      } else {
        graph.outEdges.set(edge.from, [edge]);
      }

      // Rebuild inEdges
      const inList = graph.inEdges.get(edge.to);
      if (inList) {
        inList.push(edge);
      } else {
        graph.inEdges.set(edge.to, [edge]);
      }
    }

    // Restore metadata
    graph.commitHash = data.commitHash;
    graph.timestamp = data.timestamp;

    // Initialize edge indexes for nodes without edges
    for (const [id] of graph.nodes) {
      if (!graph.outEdges.has(id)) {
        graph.outEdges.set(id, []);
      }
      if (!graph.inEdges.has(id)) {
        graph.inEdges.set(id, []);
      }
    }

    return graph;
  }

  /**
   * Helper: Remove an edge from the edges array
   */
  private removeEdgeFromArray(edge: GraphEdge): void {
    const idx = this.edges.indexOf(edge);
    if (idx >= 0) {
      this.edges.splice(idx, 1);
    }
  }
}