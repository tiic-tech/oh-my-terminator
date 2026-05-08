## Why

MODULE nodes represent the finest granularity in CodeGraph's repository modeling - individual exported symbols (functions, classes, components, types, variables). Without MODULE nodes, the graph can only represent file-level relationships, missing critical insights for code navigation, impact analysis at function level, and understanding codebase structure. This change implements MODULE node extraction using TypeScript Compiler API, enabling fine-grained dependency analysis and code intelligence.

## What Changes

- **MODULE Node Creation**: Extract exported declarations (functions, classes, interfaces, types, enums, variables) and create MODULE nodes with ID format `MODULE:filePath#exportName`
- **Kind Classification**: Automatically determine `kind` (function, class, component, interface, type, variable) based on AST node type
- **JSDoc Extraction**: Capture first 200 characters of JSDoc comments for each exported symbol
- **Complexity Calculation**: Compute McCabe cyclomatic complexity for functions/methods
- **LOC Counting**: Count effective lines of code (non-empty, non-comment lines)
- **Component Detection**: Identify React components via JSX.Element return type or JSX elements in function body
- **Anonymous/Renamed Export Handling**: Special naming rules for anonymous exports (using `"default"` with suffix) and renamed exports (using exported name)

## Capabilities

### New Capabilities

- `module-extractor`: MODULE node extraction capability - extracts exported symbols from TypeScript/JavaScript files using TypeScript Compiler API, creates MODULE nodes with proper kind classification, JSDoc metadata, complexity metrics, and LOC statistics

### Modified Capabilities

- None (this is a new capability, no existing specs modified)

## Impact

**Affected Code**:
- New module: `packages/codegraph/src/parser/module-extractor.ts`
- New helpers: `packages/codegraph/src/parser/complexity.ts`, `packages/codegraph/src/parser/loc-counter.ts`, `packages/codegraph/src/parser/kind-detector.ts`
- Existing modules extended: `packages/codegraph/src/parser/ts-parser.ts` (potentially refactor to share program creation)

**Dependencies**:
- C1 (graph-structure): Requires NodeType.MODULE, GraphNode with module metadata fields
- C3 (ts-parser-imports): Requires TypeScript Program creation infrastructure, parser patterns

**Downstream Dependencies**:
- C5 (CALLS edges): Will extend MODULE nodes for call graph extraction
- C6-C7 (EXTENDS/IMPLEMENTS edges): Will use MODULE nodes for inheritance relationships

**External Package**:
- `typescript`: TypeScript Compiler API for AST traversal and symbol resolution