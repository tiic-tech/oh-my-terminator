## Why

CodeGraph needs to scan project directories to establish the foundational structure of the repository graph. Before we can parse imports or analyze dependencies, we must first identify what files and directories exist. This scanner creates the structural foundation (DIRECTORY/FILE nodes + CONTAINS edges) that all subsequent analysis depends on.

## What Changes

- **New**: Implement `scanDirectory(root, options)` function that recursively traverses project directories
- **New**: Create DIRECTORY nodes for each non-empty directory with ID format `DIRECTORY:<relativePath>`
- **New**: Create FILE nodes for each file with ID format `FILE:<relativePath>`
- **New**: Generate CONTAINS edges linking directories to their direct children (files and subdirectories)
- **New**: Implement default ignore rules (`.git/`, `node_modules/`, `dist/`, etc.)
- **New**: Collect files by extension for downstream parser consumption
- **New**: Define `ScanResult` interface returning nodes, edges, filesToParse, stats, warnings
- **New**: Unit tests covering recursive traversal, ignore rules, CONTAINS edge generation

## Capabilities

### New Capabilities
- `file-scanner`: Recursively scan project directories, generate DIRECTORY/FILE nodes and CONTAINS edges. Returns structured data for integration with CodeGraph.

### Modified Capabilities
<!-- No existing capabilities are modified - this is new foundational infrastructure -->

## Impact

- Creates new module: `packages/codegraph/src/scanner.ts` and `ignore-rules.ts`
- C3 (TS Parser) depends on this for file list input
- C5 (Full Analysis Flow) depends on this to populate graph structure
- No breaking changes (new infrastructure following C1 graph structure)