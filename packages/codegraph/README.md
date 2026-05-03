# @oh-my-terminator/codegraph

Core graph data structure for CodeGraph - repository relationship modeling for AI-driven development.

## Overview

This package provides the foundational data structures for modeling code repositories as directed graphs. It is designed for AI agents that need to understand project structure without consuming large amounts of tokens reading source code.

### Key Features

- **Multi-granularity modeling**: Files, directories, modules (exported symbols), and external dependencies
- **Bidirectional indexes**: O(1) lookup for both "what does X import" and "who imports X"
- **Serialization support**: Save/load graph state for incremental updates
- **Type-safe**: Full TypeScript implementation with strict mode

## Installation

```bash
npm install @oh-my-terminator/codegraph
```

## Usage

### Basic Usage

```typescript
import { CodeGraph, NodeType, EdgeType } from '@oh-my-terminator/codegraph';

// Create a new graph
const graph = new CodeGraph();

// Add nodes
graph.addNode({
  id: 'FILE:src/main.ts',
  type: NodeType.FILE,
  path: 'src/main.ts',
  name: 'main.ts'
});

graph.addNode({
  id: 'FILE:src/utils.ts',
  type: NodeType.FILE,
  path: 'src/utils.ts',
  name: 'utils.ts'
});

// Add edges (dependencies)
graph.addEdge({
  from: 'FILE:src/main.ts',
  to: 'FILE:src/utils.ts',
  type: EdgeType.IMPORTS
});

// Query relationships
const imports = graph.outEdges.get('FILE:src/main.ts');  // What main.ts imports
const importers = graph.inEdges.get('FILE:src/utils.ts'); // Who imports utils.ts
```

### Adding Module Nodes

```typescript
graph.addNode({
  id: 'MODULE:src/utils.ts#formatDate',
  type: NodeType.MODULE,
  path: 'src/utils.ts',
  name: 'formatDate',
  metadata: {
    kind: 'function',
    jsDoc: 'Format a date to string',
    complexity: 2,
    loc: 15,
    isExported: true
  }
});
```

### Serialization

```typescript
// Save graph state
const serialized = graph.toJSON();
// Write to .codegraph/baseline.json
const json = JSON.stringify(serialized);

// Load graph state
const restored = CodeGraph.fromJSON(JSON.parse(json));
```

### Removing Nodes/Edges

```typescript
// Remove a node and all its related edges
graph.removeNode('FILE:src/main.ts');

// Remove all edges involving a file (for incremental updates)
graph.removeEdgesForFile('src/utils.ts');
```

## Node Types

| Type | Description | ID Format |
|------|-------------|-----------|
| `DIRECTORY` | Folder/container | `DIRECTORY:src` |
| `FILE` | Source file | `FILE:src/utils.ts` |
| `MODULE` | Exported symbol | `MODULE:src/utils.ts#formatDate` |
| `EXTERNAL` | External package | `EXTERNAL:jsonwebtoken` |

## Edge Types

| Type | Description |
|------|-------------|
| `CONTAINS` | Directory → file/subdirectory |
| `IMPORTS` | File → file (static import) |
| `EXPORTS` | File → exported module |
| `CALLS` | Function → function call |
| `EXTENDS` | Class → base class |
| `IMPLEMENTS` | Class → interface |
| `RE_EXPORTS` | Re-export relationship |
| `DYNAMIC_IMPORTS` | Dynamic import() |

## API Reference

### CodeGraph Class

#### Constructor

```typescript
new CodeGraph()
```

Creates an empty graph with initialized data structures.

#### Methods

| Method | Description |
|--------|-------------|
| `addNode(node)` | Add a node, initialize edge indexes |
| `addEdge(edge)` | Add an edge, update bidirectional indexes |
| `removeNode(id)` | Remove node and all related edges |
| `removeEdgesForFile(path)` | Remove edges involving a file |
| `toJSON()` | Serialize graph to JSON format |
| `fromJSON(data)` | Static: deserialize from JSON |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `nodes` | `Map<string, GraphNode>` | All nodes |
| `edges` | `GraphEdge[]` | All edges |
| `inEdges` | `Map<string, GraphEdge[]>` | Target → incoming edges |
| `outEdges` | `Map<string, GraphEdge[]>` | Source → outgoing edges |
| `commitHash` | `string` | Git commit reference |
| `timestamp` | `number` | Generation timestamp |

## License

MIT

## Related Packages

- `@oh-my-terminator/codegraph-parser` - TypeScript parser (planned)
- `@oh-my-terminator/codegraph-cli` - CLI tools (planned)
- `@oh-my-terminator/codegraph-api` - Intelligence APIs (planned)

## Full Analysis (C5)

### analyzeFull(cwd, options?)

Perform complete repository analysis combining scanner and parser.

```typescript
import { analyzeFull } from '@oh-my-terminator/codegraph';

const result = await analyzeFull('./my-project');
console.log(`Parsed ${result.stats.filesParsed} files`);
console.log(`Found ${result.stats.modules} modules`);
```

### FullAnalysisResult

| Field | Type | Description |
|-------|------|-------------|
| graph | CodeGraph | Complete graph with all nodes and edges |
| stats | AnalysisStats | Timing and count statistics |
| warnings | string[] | Non-fatal warning messages |

### AnalysisStats

| Field | Description |
|-------|-------------|
| scanTimeMs | Time spent scanning (ms) |
| parseTimeMs | Time spent parsing (ms) |
| totalTimeMs | Total analysis time (ms) |
| filesParsed | Files successfully parsed |
| parseErrors | Parsing errors |
| directories | DIRECTORY node count |
| files | FILE node count |
| modules | MODULE node count |
| edges | Total edge count |

### AnalysisOptions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| extensions | string[] | ['.ts', '.tsx', '.js', '.jsx', '.mjs'] | File extensions to parse |
| onProgress | ProgressCallback | undefined | Progress callback |
| scanOptions | ScanOptions | undefined | Scanner options |

### Progress Reporting

```typescript
await analyzeFull('./project', {
  onProgress: (event) => {
    console.log(`${event.phase}: ${event.current}/${event.total}`);
  }
});
```

Progress phases: `scan`, `parse`, `complete`

### Parser Registry

Extensible parser system for multi-language support:

```typescript
import { DefaultParserRegistry, TypeScriptParserAdapter } from '@oh-my-terminator/codegraph';

const registry = new DefaultParserRegistry();
registry.register(new TypeScriptParserAdapter());
```