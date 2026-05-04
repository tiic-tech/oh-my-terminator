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

## CLI Usage

### Installation
```bash
pnpm install
pnpm build
```

### Commands

#### analyze
Run full analysis and save baseline:
```bash
codegraph analyze [cwd]
codegraph analyze --json  # JSON output
```

#### update
Incremental update based on git changes:
```bash
codegraph update [cwd]
codegraph update --json  # JSON output
```

### Output Format

JSON output (--json):
```json
{
  "success": true,
  "stats": { "filesScanned": 42, ... },
  "durationMs": 2300
}
```

Text output (default):
```
✓ Analysis complete
Files scanned: 42
Duration: 2.3s
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

## Baseline Persistence (C6)

### Overview

Baseline persistence enables incremental updates by storing graph state between sessions.

### .codegraph Directory Structure

```
.codegraph/
├── baseline.json     # Complete graph data with metadata
├── lastCommit.txt    # Git commit hash for version tracking
├── .version          # Quick version check (optional)
└── migration.log     # Migration audit trail (optional)
```

### loadBaseline(cwd, options?)

Load baseline with full validation and compatibility checking.

```typescript
import { loadBaseline } from '@oh-my-terminator/codegraph';

const result = await loadBaseline('./project', {
  rebuildHandler: async (cwd) => {
    // Custom rebuild logic
    return await analyzeFull(cwd).graph;
  }
});

if (result.success) {
  console.log(`Loaded ${result.graph.nodes.size} nodes`);
} else {
  console.log(`Failed: ${result.failure?.reason}`);
}
```

### saveBaseline(baseline, cwd, options?)

Save baseline with atomic write (temp file → rename).

```typescript
import { saveBaseline, Baseline } from '@oh-my-terminator/codegraph';

const baseline: Baseline = {
  graph: {
    nodes: Array.from(graph.nodes.entries()),
    edges: graph.edges,
    commitHash: 'abc123',
    timestamp: Date.now(),
  },
  commitHash: 'abc123',
  timestamp: Date.now(),
  schemaVersion: { major: 1, minor: 0, patch: 0 },
  generatorVersion: '1.0.0',
  architectureConstraints: [],
  healthScore: 50,
  skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
};

await saveBaseline(baseline, './project', {
  createBackup: true,       // Create .bak file before write
  createVersionFile: true,  // Create .version file
  mode: 0o644,              // File permissions
});
```

### Schema Version

```typescript
import { SchemaVersionImpl, CURRENT_SCHEMA_VERSION } from '@oh-my-terminator/codegraph';

const version = SchemaVersionImpl.parse('1.2.3');
console.log(version.major);  // 1
console.log(version.minor);  // 2
console.log(version.patch);  // 3

console.log(version.isCompatibleWith(CURRENT_SCHEMA_VERSION));  // true (same major)
```

### Compatibility Checking

```typescript
import { checkSchemaCompatibility, determineAction } from '@oh-my-terminator/codegraph';

const result = checkSchemaCompatibility(baseline, CURRENT_SCHEMA_VERSION);

console.log(result.compatible);  // true/false
console.log(result.reason);      // 'version_match', 'major_version_mismatch', etc.
console.log(result.action);      // 'proceed', 'migrate', 'rebuild', 'error'
```

### Migration Framework

```typescript
import { migrateBaseline, registerMigration, MigrationScript } from '@oh-my-terminator/codegraph';

// Custom migration script
const migration: MigrationScript = {
  fromVersion: '1.0.0',
  toVersion: '1.1.0',
  description: 'Add healthScore field',
  migrate: (baseline) => {
    baseline.healthScore = 50;
    return baseline;
  },
};

registerMigration(migration);

// Execute migration
const migrated = await migrateBaseline(baseline, cwd);
```

### Error Handling

Load failures are handled with specific recovery strategies:

| Reason | Strategy |
|--------|----------|
| `file_not_found` | Auto rebuild (first run) |
| `parse_error` | Return failure, user intervention |
| `invalid_structure` | Rebuild or strict failure |
| `corrupted_data` | Auto rebuild |
| `schema_incompatible` | Use compatResult to decide |
| `permission_error` | Return failure |

## Scope Query API (C7)

### Overview

Scope query APIs provide Agent-friendly context information for graph nodes. Designed for AI agents that need concise, structured output without traversing raw graph data.

### getScope(graph, target)

Get complete context for FILE, MODULE, or EXTERNAL nodes.

```typescript
import { getScope } from '@oh-my-terminator/codegraph';

// FILE node query
const result = getScope(graph, 'FILE:src/utils/format.ts');
if (result.success) {
  console.log(result.exports);     // Export symbols
  console.log(result.imports);      // Import relationships
  console.log(result.importedBy);   // Reverse dependencies
  console.log(result.complexity);   // Aggregated complexity
  console.log(result.content);      // Agent-friendly Markdown
}

// MODULE node query
const moduleResult = getScope(graph, 'MODULE:src/utils/format.ts#formatDate');

// EXTERNAL package query
const extResult = getScope(graph, 'EXTERNAL:lodash');

// Plain path (auto-prefix FILE:)
const pathResult = getScope(graph, 'src/utils/format.ts');
```

### ScopeResult

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Operation status |
| target | string | Query target ID |
| exports | ExportInfo[] | Exported symbols (kind, name, id) |
| imports | ImportInfo[] | Import relationships |
| importedBy | ImportedByInfo[] | Reverse dependencies |
| testFile | string | null | Associated test file |
| complexity | ComplexityInfo | level + value ('unknown' when no data) |
| metadata | object | hasTest, deprecated flags |
| content | string | Agent-friendly Markdown output |
| durationMs | number | Query execution time |

### Key Resolutions

- **A1**: EXTERNAL nodes return importedBy only (no exports/imports)
- **A2**: DYNAMIC_IMPORTS excluded from importedBy (runtime-resolved)
- **A4**: Edge counts, not file counts (reflects dependency density)
- **A5**: MODULE not found returns specific warning with suggestion
- **A6**: Complexity "unknown" when no MODULE data (not misleading "low")

### getQuickBrief(graph, filePath)

Get minimal statistics for a FILE node.

```typescript
import { getQuickBrief } from '@oh-my-terminator/codegraph';

const brief = getQuickBrief(graph, 'src/utils/format.ts');
if (brief.success) {
  console.log(brief.imports);        // Edge count
  console.log(brief.importedBy);     // Edge count
  console.log(brief.hasTest);        // Test file exists
  console.log(brief.deprecated);     // Any export deprecated
  console.log(brief.complexityLevel); // low/medium/high/unknown
  console.log(brief.quickFacts);     // Human-readable summary
}
```

### QuickBriefResult

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Operation status |
| file | string | File path |
| imports | number | Import edge count |
| importedBy | number | Imported-by edge count |
| hasTest | boolean | Test file exists |
| deprecated | boolean | Any export deprecated |
| complexityLevel | string | low/medium/high/unknown |
| quickFacts | string[] | Human-readable summary |
| content | string | Compact Markdown output |

### Internal Helpers (for testing)

```typescript
import {
  normalizeTarget,    // Target normalization
  extractExports,     // Export extraction
  extractImports,     // Import extraction
  extractImportedBy,  // Imported-by extraction
  findTestFile,       // Test file association
  aggregateComplexity, // Complexity aggregation
  checkDeprecated,    // Deprecated detection
  countImports,       // Import edge count
  countImportedBy,    // Imported-by edge count
} from '@oh-my-terminator/codegraph';
```

## Impact Analysis API (C8)

### Overview

Impact analysis provides BFS traversal on IMPORTS edges to find all files affected by changes to target files.

### getImpact(graph, targets, options?)

Find all dependents of target files.

```typescript
import { getImpact } from '@oh-my-terminator/codegraph';

// Single target
const result = getImpact(graph, ['FILE:src/utils/format.ts']);
if (result.success) {
  console.log(result.summary.total);     // Total affected files
  console.log(result.summary.direct);    // Direct dependents
  console.log(result.summary.indirect);  // Indirect dependents
  console.log(result.blastRadius);       // low/medium/high/unknown
  console.log(result.content);           // Agent-friendly Markdown
}

// Multi-target merge
const multiResult = getImpact(graph, [
  'FILE:src/utils/format.ts',
  'FILE:src/types/api.ts'
]);

// MODULE target (resolves to parent FILE)
const moduleResult = getImpact(graph, ['MODULE:src/utils.ts#formatDate']);

// Options
const limitedResult = getImpact(graph, ['FILE:src/utils/format.ts'], {
  maxDepth: 0,       // C8-2: Only direct dependents
  includeTests: true // C8-1: Include test files
});
```

### ImpactResult

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Operation status |
| targets | string[] | Query target IDs |
| affectedFiles | AffectedFile[] | Affected files with distance/via |
| summary | object | total, direct, indirect counts |
| blastRadius | string | low (≤3), medium (4-10), high (>10), unknown |
| content | string | Agent-friendly Markdown output |
| durationMs | number | Query execution time |

### AffectedFile

| Field | Type | Description |
|-------|------|-------------|
| path | string | File path (without FILE: prefix) |
| distance | number | 1=direct, 2+=indirect |
| via | string[] | C8-4: Intermediate dependency paths (array format) |

### Key Resolutions

- **C8-1**: Test files excluded by default (`includeTests` option)
- **C8-2**: `maxDepth=0` returns only direct dependents
- **C8-4**: `via` field uses array format (supports multi-path)
- **C8-6**: DYNAMIC_IMPORTS edges excluded from traversal
- **C8-8**: Blast radius: 3=low boundary, 10=medium boundary
- **C8-12**: Multi-target: distance=min, via=merged

### Internal Helpers (for testing)

```typescript
import {
  normalizeTargetsToFile,  // Target → FILE conversion
  bfsDependents,           // BFS traversal core
  mergeBFSResults,         // Multi-target merge
  isTestFile,              // Test file detection
  calculateBlastRadius,    // Blast radius classification
} from '@oh-my-terminator/codegraph';
```

## Architecture Layers API (C8)

### Overview

Architecture layers inference groups files by first-level directory and determines layer hierarchy from import direction statistics.

### getArchitectureLayers(graph, options?)

Infer architecture layers from import relationships.

```typescript
import { getArchitectureLayers } from '@oh-my-terminator/codegraph';

const result = getArchitectureLayers(graph);
if (result.success) {
  console.log(result.layers);       // Layer assignments
  console.log(result.violations);   // Layer violations detected
  console.log(result.healthScore);  // 0-100 score
  console.log(result.content);      // Agent-friendly Markdown
}

// Options
const customResult = getArchitectureLayers(graph, {
  sourceRoot: 'lib',           // Custom source root
  warnOnMutualImport: true     // C8-11: Warn on same-layer mutual imports
});
```

### LayersResult

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Operation status |
| layers | LayerAssignment[] | Inferred layer structure |
| violations | LayerViolation[] | Detected violations |
| healthScore | number | 0-100 (100=perfect) |
| groups | GroupSummary[] | Group summaries with netScore |
| content | string | Agent-friendly Markdown output |

### LayerAssignment

| Field | Type | Description |
|-------|------|-------------|
| layer | number | Layer number (1=bottom/Foundation) |
| role | string | Foundation/Core/Application/Presentation |
| groups | GroupStats[] | Groups in this layer |

### LayerViolation

| Field | Type | Description |
|-------|------|-------------|
| fromGroup | string | Violating group (low layer) |
| toGroup | string | Target group (high layer) |
| count | number | Violation count |
| layerGap | number | C8-10: Layer distance (positive) |
| severity | string | minor/moderate/critical |
| suggestion | string | Remediation suggestion |

### Health Score Calculation (C8-5)

```
Base score: 100
Penalties:
- minor violation (layerGap=1): -5
- moderate violation (layerGap=2): -10
- critical violation (layerGap≥3): -15
Minimum: 0
```

### Key Resolutions

- **C8-3**: LAYER_THRESHOLD=2 for adjacent score merging
- **C8-5**: Health score with severity weights
- **C8-7**: E005 error for empty graph
- **C8-10**: `layerGap` (renamed from expectedLayerGap)
- **C8-11**: Same-layer mutual imports NOT violations

### Internal Helpers (for testing)

```typescript
import {
  groupFilesByFirstLevelDirectory,  // File grouping
  computeImportDirectionStats,      // Import statistics
  inferArchitectureLayers,          // Layer inference
  detectLayerViolations,            // Violation detection
  calculateLayerHealthScore,        // Health score
  calculateSeverity,                // Severity (minor/moderate/critical)
} from '@oh-my-terminator/codegraph';