## Context

CodeGraph needs a TypeScript/JavaScript parser to extract file-level import relationships. This is the foundation for dependency graph construction, enabling downstream features like impact analysis, scope detection, and architecture inference.

**Current State**:
- C1 provides: NodeType/EdgeType enums, GraphNode/GraphEdge interfaces, CodeGraph class
- C2 provides: scanDirectory() returning filesToParse list
- No parser exists yet

**Constraints**:
- Must use TypeScript Compiler API (no external parsing libraries)
- Must handle tsconfig.json path aliases
- Must work without type checking (for performance)
- Must create EXTERNAL nodes for unresolved imports

**Stakeholders**:
- C4 (MODULE nodes): Will extend this parser for symbol extraction
- C5 (CALLS edges): Will extend for call graph

## Goals / Non-Goals

**Goals**:
- Create TypeScript Program using Compiler API
- Extract IMPORTS edges from import declarations
- Extract RE_EXPORTS edges from export declarations
- Extract DYNAMIC_IMPORTS edges from import() calls
- Resolve module paths using ts.resolveModuleName()
- Create EXTERNAL nodes for external dependencies
- Add importSpecifier metadata to all edges

**Non-Goals**:
- MODULE node extraction (C4)
- CALLS/EXTENDS/IMPLEMENTS edges (M2, C5-C7)
- Type checking or semantic analysis
- Multi-language parser plugin system (M6)
- Performance optimization (caching, parallel processing)

## Decisions

### D1: TypeScript Program Creation Strategy

**Decision**: Create single Program instance for all files, reuse for parsing

**Alternatives Considered**:
1. Create Program per file - Rejected: High overhead, repeated tsconfig parsing
2. Create Program per batch - Rejected: Complex batching logic
3. Single Program instance - **Selected**: Optimal for typical project size (<1000 files)

**Rationale**:
- TypeScript Program caches module resolution
- Single instance avoids repeated tsconfig.json reading
- TypeChecker (future) needs full program context

**Implementation**:
```typescript
function createParserProgram(filePaths: string[], projectRoot: string): ts.Program {
  const configPath = ts.findConfigFile(projectRoot, ts.sys.fileExists);
  const config = configPath ? ts.readConfigFile(configPath, ts.sys.readFile) : {};
  return ts.createProgram(filePaths, {
    allowJs: true,
    checkJs: false,  // Skip type checking for speed
    noEmit: true,
    ...config.compilerOptions
  });
}
```

### D2: Path Alias Resolution Strategy (A2 Resolution)

**Decision**: Use TypeScript's ts.resolveModuleName() directly - first match wins

**Alternatives Considered**:
1. Custom path matching logic - Rejected: Complex, diverges from TS behavior
2. Iterate all matching paths - Rejected: Creates multiple edges, ambiguous
3. Delegate to TypeScript API - **Selected**: Matches actual compiler behavior

**Rationale**:
- TypeScript's resolution is deterministic
- Matches runtime module resolution
- No custom logic needed
- Resolution failures naturally create EXTERNAL nodes

**Implementation**:
```typescript
function resolveModule(specifier: string, sourceFile: string, program: ts.Program): string | null {
  const resolved = ts.resolveModuleName(specifier, sourceFile, program.getCompilerOptions(), ts.sys);
  return resolved.resolvedModule?.resolvedFileName;
}
```

### D3: Wildcard Re-export Handling (A3 Resolution)

**Decision**: Generate single RE_EXPORTS edge with importSpecifier="wildcard"

**Alternatives Considered**:
1. No edge - Rejected: Misses dependency relationship
2. Expand to all exports - Rejected: Graph bloat, requires scanning target file
3. Single edge with wildcard marker - **Selected**: Preserves relationship, prevents bloat

**Rationale**:
- Wildcard exports are a single semantic statement
- Expanding creates unnecessary edges (dozens per wildcard)
- Downstream tools can query target's MODULE nodes if needed
- Consistent with other importSpecifier patterns

**Edge Format**:
```typescript
{
  from: "FILE:src/index.ts",
  to: "FILE:src/utils.ts",
  type: EdgeType.RE_EXPORTS,
  metadata: { line: 5, importSpecifier: "wildcard" }
}
```

### D4: Error Handling Strategy

**Decision**: Graceful degradation - log warnings, continue parsing

**Implementation**:
- tsconfig.json not found → Use default options
- File parse error → Skip file, add warning to result
- Module resolution fails → Create EXTERNAL node

**Warning Categories**:
- `TS_CONFIG_MISSING`: No tsconfig.json found
- `PARSE_ERROR`: TypeScript syntax error
- `MODULE_UNRESOLVED`: Import to external package

## Risks / Trade-offs

### R1: TypeScript Version Compatibility
**Risk**: TypeScript Compiler API changes between versions
**Mitigation**: Pin typescript version in dependencies, test with multiple versions in CI

### R2: Large Project Performance
**Risk**: Single Program instance may be slow for large projects (>5000 files)
**Mitigation**: Accept for MVP, optimize in M2 with batching if needed

### R3: Path Alias Complexity
**Risk**: Complex tsconfig paths configurations may not resolve correctly
**Mitigation**: Follow TypeScript's resolution exactly, test with fixture project

### R4: Parse Error Recovery
**Risk**: Invalid TypeScript syntax may break parsing
**Mitigation**: TypeScript Parser is fault-tolerant, produces partial AST; catch exceptions and continue

## Module Structure

```
packages/codegraph/src/parser/
├─ ts-parser.ts         # Main parser class
│   ├─ TypeScriptParser class
│   ├─ parseFile(sourceFile): ParseResult
│   ├─ parseAll(files): ParserResult
│   └─ extractImports(sourceFile): ImportInfo[]
│
├─ import-resolver.ts   # Module resolution
│   ├─ resolveModulePath(specifier, sourceFile, program): ResolvedPath
│   ├─ isExternalModule(resolved): boolean
│   └─ createExternalNode(packageName): GraphNode
│
├─ edge-generator.ts    # Edge generation
│   ├─ generateImportEdge(importInfo): GraphEdge
│   ├─ generateReExportEdge(exportInfo): GraphEdge
│   └─ generateDynamicImportEdge(callInfo): GraphEdge
│
└─ index.ts             # Public exports
    ├─ TypeScriptParser
    ├─ parseImports(files, projectRoot): ParserResult
    └─ ParserResult interface
```

## Interface Definitions

```typescript
interface ParseResult {
  nodes: GraphNode[];       // EXTERNAL nodes for unresolved imports
  edges: GraphEdge[];       // IMPORTS, RE_EXPORTS, DYNAMIC_IMPORTS edges
  warnings: string[];
}

interface ParserResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  filesParsed: number;
  warnings: string[];
}

interface ImportInfo {
  sourceFile: string;       // Source file path
  specifier: string;        // Import specifier (e.g., './utils', 'lodash')
  resolvedPath: string | null;  // Resolved file path or null for external
  line: number;
  importType: 'import' | 're-export' | 'dynamic';
  importSpecifier: string;  // Metadata value (default, named:x, namespace, wildcard, dynamic, empty)
}
```

## Open Questions

None - All ambiguities resolved in c3_ambiguity_resolution.md (A2, A3)