## 1. Setup & Types

- [x] 1.1 Create `packages/codegraph/src/parser/` directory structure
- [x] 1.2 Add `typescript` dependency to package.json
- [x] 1.3 Create `ParseResult` interface in ts-parser.ts
- [x] 1.4 Create `ParserResult` interface for multi-file parsing
- [x] 1.5 Create `ImportInfo` interface for extracted import data
- [x] 1.6 Export types from parser/index.ts

## 2. TypeScript Program Creation

- [x] 2.1 Implement `createParserProgram(filePaths, projectRoot)` function
- [x] 2.2 Handle tsconfig.json discovery using `ts.findConfigFile()`
- [x] 2.3 Handle missing tsconfig.json (use default options)
- [x] 2.4 Configure compiler options: allowJs=true, checkJs=false, noEmit=true
- [x] 2.5 Read and apply tsconfig.json compilerOptions

## 3. Import Declaration Parsing

- [x] 3.1 Implement `extractImports(sourceFile)` function
- [x] 3.2 Parse `importDeclarations` from SourceFile AST
- [x] 3.3 Extract named imports: `import { x } from './utils'`
- [x] 3.4 Extract default imports: `import x from './utils'`
- [x] 3.5 Extract namespace imports: `import * as x from './utils'`
- [x] 3.6 Extract side-effect imports: `import './setup'`
- [x] 3.7 Generate importSpecifier metadata for each import type

## 4. Export Declaration Parsing

- [x] 4.1 Parse `exportDeclarations` with source specifiers
- [x] 4.2 Extract named re-exports: `export { x } from './utils'`
- [x] 4.3 Extract wildcard re-exports: `export * from './utils'`
- [x] 4.4 Extract default re-exports: `export { default } from './utils'`
- [x] 4.5 Generate single RE_EXPORTS edge for wildcard (importSpecifier="wildcard")

## 5. Dynamic Import Detection

- [x] 5.1 Traverse AST for `CallExpression` nodes
- [x] 5.2 Detect `import()` calls
- [x] 5.3 Extract string literal arguments from import() calls
- [x] 5.4 Handle variable arguments in import() (create placeholder EXTERNAL)
- [x] 5.5 Generate DYNAMIC_IMPORTS edges with importSpecifier="dynamic"

## 6. Module Path Resolution

- [x] 6.1 Implement `resolveModulePath(specifier, sourceFile, program)` function
- [x] 6.2 Use `ts.resolveModuleName()` for path resolution
- [x] 6.3 Resolve relative paths: `./utils`, `../components`
- [x] 6.4 Resolve alias paths from tsconfig.json paths configuration
- [x] 6.5 Follow TypeScript first-match-wins strategy for multiple alias matches
- [x] 6.6 Detect external packages: unresolved paths, node_modules, built-ins

## 7. EXTERNAL Node Creation

- [x] 7.1 Implement `createExternalNode(packageName)` function
- [x] 7.2 Extract package name from specifier (e.g., `lodash/debounce` → `lodash`)
- [x] 7.3 Create EXTERNAL node with id format `EXTERNAL:<packageName>`
- [x] 7.4 Handle built-in modules (fs, path, etc.)
- [x] 7.5 Deduplicate EXTERNAL nodes (same package referenced multiple times)

## 8. Edge Generation

- [x] 8.1 Implement `generateImportEdge(importInfo)` function
- [x] 8.2 Implement `generateReExportEdge(exportInfo)` function
- [x] 8.3 Implement `generateDynamicImportEdge(callInfo)` function
- [x] 8.4 Set edge.from to source FILE node id
- [x] 8.5 Set edge.to to resolved FILE or EXTERNAL node id
- [x] 8.6 Set edge.type to correct EdgeType (IMPORTS, RE_EXPORTS, DYNAMIC_IMPORTS)
- [x] 8.7 Add line number to edge.metadata
- [x] 8.8 Add importSpecifier to edge.metadata

## 9. Main Parser Class

- [x] 9.1 Create `TypeScriptParser` class
- [x] 9.2 Implement `parseFile(sourceFile)` method
- [x] 9.3 Implement `parseAll(files, projectRoot)` method
- [x] 9.4 Create single Program instance in parseAll
- [x] 9.5 Process each file sequentially
- [x] 9.6 Aggregate results: combine nodes and edges
- [x] 9.7 Collect warnings from all files

## 10. Error Handling

- [x] 10.1 Catch syntax errors in individual files
- [x] 10.2 Add warning message for syntax errors
- [x] 10.3 Continue parsing other files after error
- [x] 10.4 Handle file read errors (permission denied, not found)
- [x] 10.5 Return partial results on error

## 11. Unit Tests

- [x] 11.1 Test named import extraction
- [x] 11.2 Test default import extraction
- [x] 11.3 Test namespace import extraction
- [x] 11.4 Test multiple named imports extraction
- [x] 11.5 Test side-effect import extraction
- [x] 11.6 Test named re-export extraction
- [x] 11.7 Test wildcard re-export extraction (single edge)
- [x] 11.8 Test default re-export extraction
- [x] 11.9 Test dynamic import extraction
- [x] 11.10 Test relative path resolution
- [x] 11.11 Test alias path resolution (single match)
- [x] 11.12 Test alias path resolution (multiple matches, first wins)
- [x] 11.13 Test alias path resolution (fallback to second match)
- [x] 11.14 Test EXTERNAL node creation for external packages
- [x] 11.15 Test EXTERNAL node creation for built-in modules
- [x] 11.16 Test EXTERNAL node deduplication
- [x] 11.17 Test importSpecifier metadata format
- [x] 11.18 Test tsconfig.json not found fallback
- [x] 11.19 Test syntax error handling
- [x] 11.20 Test empty file list handling
- [x] 11.21 Verify test coverage ≥ 80% for parser module

## 12. Integration

- [x] 12.1 Export TypeScriptParser from parser/index.ts
- [x] 12.2 Export parseImports function from parser/index.ts
- [x] 12.3 Export parser types from main package index.ts
- [x] 12.4 Create integration test: scanner → parser → graph
- [x] 12.5 Test with fixture project: import-test-project
- [x] 12.6 Add JSDoc comments to all public functions