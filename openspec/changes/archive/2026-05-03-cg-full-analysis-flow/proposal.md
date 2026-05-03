## Why

CodeGraph needs an orchestration layer to combine the Scanner (C2) and Parser (C3/C4) components into a complete repository analysis workflow. Currently, users must manually call each component and merge results. A unified `analyzeFull()` function will provide a single entry point for full analysis, simplifying CLI commands and enabling downstream features like baseline persistence (C6) and incremental updates.

## What Changes

- **New**: `analyzeFull(cwd, options)` function that orchestrates full repository analysis
- **New**: `FullAnalysisResult` interface returning graph + stats + warnings
- **New**: `ParserRegistry` pattern for extensible parser selection
- **New**: `ProgressCallback` mechanism for optional progress reporting
- **New**: Continue-on-error pattern ensuring partial failures don't stop analysis
- **New**: Sequential parsing flow with immediate AST release for memory efficiency

## Capabilities

### New Capabilities

- `analyzer`: Full repository analysis orchestration - combines C1 graph structure, C2 scanner, C3/C4 parser to produce complete CodeGraph

### Modified Capabilities

<!-- No existing capabilities modified - C5 is purely additive, building on C1-C4 -->

## Impact

**New Code**:
- `packages/codegraph/src/analyzer.ts` - Main `analyzeFull()` function
- `packages/codegraph/src/parser-registry.ts` - ParserRegistry implementation

**Dependencies**:
- Requires C1 (graph-structure) - CodeGraph class for node/edge storage
- Requires C2 (file-scanner) - scanDirectory for FILE/DIRECTORY nodes
- Requires C3 (ts-parser-imports) - IMPORTS/RE_EXPORTS edges
- Requires C4 (module-extractor) - MODULE nodes

**API Changes**:
- Exports `analyzeFull()`, `FullAnalysisResult`, `AnalysisOptions` from `@oh-my-terminator/codegraph`

**CLI Integration** (C9):
- `codegraph analyze` command will call `analyzeFull()`

**No Breaking Changes** - All additions are new exports, existing APIs unchanged.