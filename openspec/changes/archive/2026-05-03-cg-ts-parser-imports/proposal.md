## Why

File-level import relationships are the foundation of CodeGraph's dependency modeling. Without IMPORTS edges, the graph cannot represent how files depend on each other, making downstream capabilities like impact analysis, scope detection, and architecture layer inference impossible. This change implements the TypeScript Compiler API-based parser to extract import, re-export, and dynamic import relationships from TypeScript/JavaScript files.

## What Changes

- **New Parser Module**: Create `packages/codegraph/src/parser/` directory with TypeScript-based import extraction
- **IMPORTS Edge Generation**: Extract static import declarations and generate IMPORTS edges between FILE nodes
- **RE_EXPORTS Edge Generation**: Extract export declarations and generate RE_EXPORTS edges
- **DYNAMIC_IMPORTS Edge Generation**: Detect dynamic `import()` calls and generate DYNAMIC_IMPORTS edges
- **EXTERNAL Node Creation**: When module resolution fails to find a project file, create EXTERNAL nodes for external dependencies
- **Path Resolution**: Handle relative paths and `tsconfig.json` path aliases using TypeScript's `ts.resolveModuleName()`
- **importSpecifier Metadata**: Add standardized importSpecifier field to edge metadata (default, named, namespace, wildcard, dynamic, empty)

## Capabilities

### New Capabilities

- `ts-parser-imports`: TypeScript/JavaScript import extraction capability - extracts file-level import relationships using TypeScript Compiler API, generates IMPORTS/RE_EXPORTS/DYNAMIC_IMPORTS edges, resolves path aliases, and creates EXTERNAL nodes for external dependencies

### Modified Capabilities

- None (this is a new capability, no existing specs modified)

## Impact

**Affected Code**:
- New module: `packages/codegraph/src/parser/` (ts-parser.ts, import-resolver.ts, index.ts)
- Existing modules used: `packages/codegraph/src/types.ts` (NodeType, EdgeType), `packages/codegraph/src/graph.ts` (CodeGraph)

**Dependencies**:
- C1 (graph-structure): Requires NodeType.FILE, NodeType.EXTERNAL, EdgeType.IMPORTS, EdgeType.RE_EXPORTS, EdgeType.DYNAMIC_IMPORTS, GraphNode, GraphEdge interfaces
- C2 (file-scanner): Requires ScanResult.filesToParse as input for parsing

**Downstream Dependencies**:
- C4 (MODULE nodes): Will depend on parser infrastructure for function/class extraction
- C5 (CALLS edges): Will extend parser for call graph extraction

**External Package**:
- `typescript`: TypeScript Compiler API for program creation and AST traversal