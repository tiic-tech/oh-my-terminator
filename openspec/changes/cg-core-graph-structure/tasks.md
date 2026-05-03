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

- [ ] 3.1 Implement `CodeGraph` constructor with empty data structures
- [ ] 3.2 Implement `addNode(node: GraphNode)` - add to nodes Map, init edge indexes
- [ ] 3.3 Implement `addEdge(edge: GraphEdge)` - add to edges array, update inEdges/outEdges
- [ ] 3.4 Implement `removeNode(id: string)` - remove node, edges, cleanup indexes
- [ ] 3.5 Implement `removeEdgesForFile(filePath: string)` - filter edges by file path
- [ ] 3.6 Implement `toJSON()` - convert nodes Map to array format
- [ ] 3.7 Implement `static fromJSON(data)` - reconstruct graph, rebuild indexes
- [ ] 3.8 Export CodeGraph from `index.ts`

## 4. Unit Tests

- [ ] 4.1 Test `addNode` updates nodes Map and initializes edge indexes
- [ ] 4.2 Test `addEdge` updates edges array and both direction indexes
- [ ] 4.3 Test `removeNode` removes node, edges, and cleans up all indexes
- [ ] 4.4 Test `removeEdgesForFile` removes FILE and MODULE edges correctly
- [ ] 4.5 Test `toJSON` produces valid JSON-serializable output
- [ ] 4.6 Test `fromJSON` restores graph with correct indexes
- [ ] 4.7 Test round-trip: `fromJSON(toJSON(graph))` equals original
- [ ] 4.8 Verify test coverage ≥ 80% for types.ts and graph.ts

## 5. Documentation

- [ ] 5.1 Add JSDoc comments to all public interfaces and methods
- [ ] 5.2 Create README.md with package overview and usage example