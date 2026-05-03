## 1. Package Setup

- [x] 1.1 Create `packages/codegraph/` directory structure
- [x] 1.2 Create `package.json` with TypeScript configuration
- [x] 1.3 Create `tsconfig.json` with strict mode and Node.js target

## 2. Core Types (types.ts)

- [x] 2.1 Define `NodeType` enum (DIRECTORY, FILE, MODULE, EXTERNAL)
- [x] 2.2 Define `EdgeType` enum (CONTAINS, IMPORTS, EXPORTS, CALLS, EXTENDS, IMPLEMENTS, RE_EXPORTS, DYNAMIC_IMPORTS)
- [x] 2.3 Define `GraphNode` interface with id, type, path, name, and optional metadata
- [x] 2.4 Define `GraphEdge` interface with from, to, type, and optional metadata
- [x] 2.5 Define `SerializedCodeGraph` interface for JSON serialization format
- [x] 2.6 Export all types from `index.ts`

## 3. CodeGraph Class (graph.ts)

- [x] 3.1 Implement `CodeGraph` constructor with empty data structures
- [x] 3.2 Implement `addNode(node: GraphNode)` - add to nodes Map, init edge indexes
- [x] 3.3 Implement `addEdge(edge: GraphEdge)` - add to edges array, update inEdges/outEdges
- [x] 3.4 Implement `removeNode(id: string)` - remove node, edges, cleanup indexes
- [x] 3.5 Implement `removeEdgesForFile(filePath: string)` - filter edges by file path
- [x] 3.6 Implement `toJSON()` - convert nodes Map to array format
- [x] 3.7 Implement `static fromJSON(data)` - reconstruct graph, rebuild indexes
- [x] 3.8 Export CodeGraph from `index.ts`

## 4. Unit Tests

- [x] 4.1 Test `addNode` updates nodes Map and initializes edge indexes
- [x] 4.2 Test `addEdge` updates edges array and both direction indexes
- [x] 4.3 Test `removeNode` removes node, edges, and cleans up all indexes
- [x] 4.4 Test `removeEdgesForFile` removes FILE and MODULE edges correctly
- [x] 4.5 Test `toJSON` produces valid JSON-serializable output
- [x] 4.6 Test `fromJSON` restores graph with correct indexes
- [x] 4.7 Test round-trip: `fromJSON(toJSON(graph))` equals original
- [x] 4.8 Verify test coverage ≥ 80% for types.ts and graph.ts

## 5. Documentation

- [x] 5.1 Add JSDoc comments to all public interfaces and methods
- [x] 5.2 Create README.md with package overview and usage example