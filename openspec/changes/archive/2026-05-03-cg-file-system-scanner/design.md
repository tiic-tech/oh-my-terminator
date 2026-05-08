## Context

CodeGraph needs to establish the structural foundation of a repository before any parsing can occur. The file scanner is Change 2 (C2) in the MVP sequence, directly dependent on C1 (graph structure) and providing input to C3 (TS parser).

**Constraints**:
- Node.js 18+ only (no external dependencies)
- Zero npm dependencies beyond what's in C1
- Must integrate with `CodeGraph` from C1
- Output format must be consumable by C3 parser

**Stakeholders**: C3 (parser), C5 (full analysis), C9 (CLI analyze command)

## Goals / Non-Goals

**Goals**:
- Recursively scan project directories up to maxDepth (default 20)
- Create DIRECTORY/FILE nodes following C1 ID format
- Generate CONTAINS edges with recursive strategy (parent → direct children including subdirs)
- Apply default ignore rules without reading .gitignore
- Collect files by extension for parser input
- Return structured `ScanResult` for caller to add to graph

**Non-Goals**:
- Parsing imports (belongs to C3)
- Reading .gitignore or .codegraphignore (MVP limitation)
- Handling symbolic links (skip them)
- Supporting hidden directories (MVP skips them)
- Multi-language extension handling (belongs to M6 plugins)

## Decisions

### 1. Interface: Return Data vs Operate Graph

**Decision**: Scanner returns `ScanResult` data structure, caller adds to `CodeGraph`.

**Rationale**:
- Single direction data flow - easier to test
- Caller controls when/how nodes are added
- Matches pattern used by C3 parser
- Enables parallel scanning + parsing

**Alternatives considered**:
- Direct graph manipulation: Tighter coupling, harder to test
- Callback-based: Complex error handling

### 2. CONTAINS Edge Strategy: Recursive

**Decision**: Parent directory CONTAINS direct children, including subdirectories. Each subdirectory creates its own CONTAINS edges to its children.

**Rationale**:
- Matches Blueprint: "目录→文件或子目录"
- Enables full tree traversal via edges
- Clear parent-child relationship at each level

**Example**:
```
DIRECTORY:src CONTAINS DIRECTORY:src/components
DIRECTORY:src CONTAINS FILE:src/main.ts
DIRECTORY:src/components CONTAINS FILE:src/components/Button.tsx
```

### 3. Root Directory Node ID Format

**Decision**: Root directory ID is `DIRECTORY:.` (using relative path `.`).

**Rationale**:
- Consistent with relative path convention
- Clear indication of project root
- Easy to identify in queries

### 4. Empty Directory Handling

**Decision**: Do not create nodes for empty directories.

**Rationale**:
- Empty directories add no value to dependency analysis
- Reduces graph size
- Simplifies CONTAINS edge generation

### 5. Ignore Rule Matching

**Decision**: Use `startsWith` prefix matching on relative path.

**Rationale**:
- Simple and fast
- Covers most patterns (`.git/`, `node_modules/`)
- MVP scope - no glob patterns needed

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Performance on deep trees (20+ levels) | `maxDepth` option limits recursion |
| Permission errors blocking scan | Catch errors, log warning, continue |
| Large projects (10k+ files) memory usage | Streaming approach not needed for MVP; acceptable for typical repos (<5k files) |
| Symbolic links causing infinite loops | Skip all symbolic links (MVP limitation) |
| Hidden files unexpectedly included | Default `includeHidden: false` |

## Implementation Outline

```
packages/codegraph/src/
├── scanner.ts           # scanDirectory main function (~150 lines)
├── ignore-rules.ts      # DEFAULT_IGNORE_RULES constant (~30 lines)
└── index.ts             # Export scanDirectory, ScanResult types
```

**scanner.ts**:
- `scanDirectory(root, options)`: Main entry
- `scanRecursive()`: Internal recursive traversal
- `shouldIgnore()`: Check ignore rules
- `isParseableFile()`: Check extension
- `createDirectoryNode()`, `createFileNode()`: Node builders
- `createContainsEdge()`: Edge builder

## Open Questions

None. All P0 ambiguities resolved in technical spec document (02_c2_scanner_spec.md).