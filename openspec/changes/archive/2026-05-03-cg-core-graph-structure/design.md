## Context

CodeGraph is a TypeScript-only repository modeling tool for AI-driven development. The core graph structure is the foundational layer that all other components depend on: file scanner, parsers, intelligence APIs, and CLI commands.

**Constraints**:
- TypeScript 5.x, Node.js 18+
- No external runtime services (no database, no Python)
- Zero independent LLM calls - all intelligence from graph algorithms
- Results persisted as local JSON in `.codegraph/` directory

**Stakeholders**: Future changes C2-C12 all depend on this structure.

## Goals / Non-Goals

**Goals**:
- Define core types (NodeType, EdgeType, GraphNode, GraphEdge)
- Implement CodeGraph class with bidirectional indexes for O(1) edge lookup
- Provide serialization/deserialization for baseline persistence
- Enable efficient node/edge CRUD with automatic index maintenance

**Non-Goals**:
- Parsing logic (belongs to Change 3/4)
- File system scanning (belongs to Change 2)
- Intelligence APIs (belongs to Change 7/8)
- CLI commands (belongs to Change 9/10)
- Graph algorithms (cycle detection, impact analysis - belongs to later milestones)

## Decisions

### 1. Node ID Format: Type-Prefix + Path

**Decision**: Node IDs use format `<TYPE>:<path>` for DIRECTORY/FILE/EXTERNAL, and `<TYPE>:<path>#<name>` for MODULE.

**Rationale**: 
- Simple string matching for type checking (split on `:`)
- Unique identification without central registry
- Human-readable for debugging and logging

**Alternatives considered**:
- UUID: Hard to debug, requires lookup for path-based queries
- Pure path: Ambiguous for MODULE nodes (same file, different exports)

### 2. Edge Storage: Array + Dual Index Maps

**Decision**: Store edges in flat array `edges: GraphEdge[]` plus two Maps:
- `outEdges: Map<string, GraphEdge[]>` (source → outgoing edges)
- `inEdges: Map<string, GraphEdge[]>` (target → incoming edges)

**Rationale**:
- O(1) lookup for "what imports file X" (inEdges) and "what does file X import" (outEdges)
- Array preserves order for deterministic serialization
- Dual indexes enable efficient traversal in both directions

**Alternatives considered**:
- Single adjacency list: Would need reverse traversal (O(n) for impact analysis)
- Edge-only storage: Would require scanning for all lookups

### 3. Node Storage: Map<string, GraphNode>

**Decision**: Use native JavaScript `Map` for node storage.

**Rationale**:
- O(1) lookup by ID
- Preserves insertion order (useful for deterministic serialization)
- Built-in iteration and size tracking

**Alternatives considered**:
- Object/dictionary: String keys coerce non-string IDs, no size property
- Custom data structure: Overkill for this use case

### 4. Serialization: Map → Array Format

**Decision**: Serialize nodes Map as `[string, GraphNode][]` array format.

**Rationale**:
- JSON.stringify does not preserve Map structure
- Array format is JSON-compatible and compact
- Easy to reconstruct Map with `new Map(serialized.nodes)`

**Alternatives considered**:
- Object with node IDs as keys: Works but loses Map semantics on deserialization
- Custom JSON replacer: Complex and non-standard

### 5. Index Maintenance: Automatic on Every Operation

**Decision**: Every `addNode`, `addEdge`, `removeNode`, `removeEdgesForFile` updates indexes immediately.

**Rationale**:
- Prevents index drift bugs
- Simpler API - no manual index rebuilding
- Consistent state after each operation

**Alternatives considered**:
- Lazy index rebuild: Risk of stale indexes, requires explicit refresh call
- Batch index updates: Requires transaction-like semantics, more complex

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Memory usage for large repos (10k+ files) | Index structures are O(n) - acceptable for typical repos (<5k files). For very large repos, consider lazy loading in M6+. |
| Index consistency during complex operations | All mutation methods maintain indexes automatically. Unit tests verify consistency after each operation. |
| Serialization of metadata fields | Optional metadata fields use JSON-compatible types only (string, number, boolean). No Date objects or custom types. |
| Node ID collision | ID format is deterministic. Adding same node twice overwrites silently. Caller responsible for uniqueness. |

## Implementation Outline

```
packages/codegraph/src/
├── types.ts           # NodeType, EdgeType enums; GraphNode, GraphEdge interfaces
├── graph.ts           # CodeGraph class with CRUD and serialization
└── index.ts           # Public exports
```

**types.ts** (~80 lines):
- NodeType enum (4 values)
- EdgeType enum (7 values)
- GraphNode interface (id, type, path, name, metadata)
- GraphEdge interface (from, to, type, metadata)
- SerializedCodeGraph interface (for JSON format)

**graph.ts** (~150 lines):
- CodeGraph class
- Constructor: initialize empty structures
- addNode(node): add to nodes Map, init indexes
- addEdge(edge): add to edges array, update outEdges/inEdges
- removeNode(id): remove node, remove related edges, cleanup indexes
- removeEdgesForFile(filePath): filter edges, cleanup indexes
- toJSON(): convert Map to array, return serializable object
- fromJSON(data): reconstruct graph, rebuild indexes

## Open Questions

None. Design is complete and ready for implementation.