## Why

CodeGraph needs a foundational graph data structure to model repository relationships at multiple granularities (files, modules, functions). This is the lowest-level infrastructure that all other capabilities depend on. Without it, we cannot build file scanning, parsing, intelligence APIs, or CLI commands.

## What Changes

- **New**: Define `NodeType` enum (FILE, DIRECTORY, MODULE, EXTERNAL)
- **New**: Define `EdgeType` enum (CONTAINS, IMPORTS, EXPORTS, CALLS, EXTENDS, IMPLEMENTS, RE_EXPORTS, DYNAMIC_IMPORTS)
- **New**: Implement `GraphNode` interface with id, type, data, metadata fields
- **New**: Implement `GraphEdge` interface with id, type, source, target, weight fields
- **New**: Implement `CodeGraph` class with:
  - Node/edge CRUD operations
  - Bidirectional index maintenance (outEdges, inEdges, nodesByType)
  - Serialization (`toJSON`) and deserialization (`fromJSON`)
- **New**: Unit tests covering all graph operations

## Capabilities

### New Capabilities
- `graph-structure`: Core graph data model with nodes, edges, and bidirectional indexes. Provides the foundation for all CodeGraph functionality.

### Modified Capabilities
<!-- No existing capabilities are modified - this is foundational infrastructure -->

## Impact

- Creates new package: `packages/codegraph/src/types.ts` and `graph.ts`
- All future changes (C2-C12 in MVP) depend on this structure
- No breaking changes to existing code (this is new infrastructure)