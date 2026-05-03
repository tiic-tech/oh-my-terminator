## 1. Setup & Types

- [ ] 1.1 Create `packages/codegraph/src/parser/` directory structure
- [ ] 1.2 Add `typescript` dependency to package.json
- [ ] 1.3 Create `ParseResult` interface in ts-parser.ts
- [ ] 1.4 Create `ParserResult` interface for multi-file parsing
- [ ] 1.5 Create `ImportInfo` interface for extracted import data
- [ ] 1.6 Export types from parser/index.ts

## 2. TypeScript Program Creation

- [ ] 2.1 Implement `createParserProgram(filePaths, projectRoot)` function
- [ ] 2.2 Handle tsconfig.json discovery using `ts.findConfigFile()`
- [ ] 2.3 Handle missing tsconfig.json (use default options)
- [ ] 2.4 Configure compiler options: allowJs=true, checkJs=false, noEmit=true
- [ ] 2.5 Read and apply tsconfig.json compilerOptions

## 3. Import Declaration Parsing

- [ ] 3.1 Implement `extractImports(sourceFile)` function
- [ ] 3.2 Parse `importDeclarations` from SourceFile AST
- [ ] 3.3 Extract named imports: `import { x } from './utils'`
- [ ] 3.4 Extract default imports: `import x from './utils'`
- [ ] 3.5 Extract namespace imports: `import * as x from './utils'`
- [ ] 3.6 Extract side-effect imports: `import './setup'`
- [ ] 3.7 Generate importSpecifier metadata for each import type

## 4. Export Declaration Parsing

- [ ] 4.1 Parse `exportDeclarations` with source specifiers
- [ ] 4.2 Extract named re-exports: `export { x } from './utils'`
- [ ] 4.3 Extract wildcard re-exports: `export * from './utils'`
- [ ] 4.4 Extract default re-exports: `export { default } from './utils'`
- [ ] 4.5 Generate single RE_EXPORTS edge for wildcard (importSpecifier="wildcard")

## 5. Dynamic Import Detection

- [ ] 5.1 Traverse AST for `CallExpression` nodes
- [ ] 5.2 Detect `import()` calls
- [ ] 5.3 Extract string literal arguments from import() calls
- [ ] 5.4 Handle variable arguments in import() (create placeholder EXTERNAL)
- [ ] 5.5 Generate DYNAMIC_IMPORTS edges with importSpecifier="dynamic"

## 6. Module Path Resolution

- [ ] 6.1 Implement `resolveModulePath(specifier, sourceFile, program)` function
- [ ] 6.2 Use `ts.resolveModuleName()` for path resolution
- [ ] 6.3 Resolve relative paths: `./utils`, `../components`
- [ ] 6.4 Resolve alias paths from tsconfig.json paths configuration
- [ ] 6.5 Follow TypeScript first-match-wins strategy for multiple alias matches
- [ ] 6.6 Detect external packages: unresolved paths, node_modules, built-ins

## 7. EXTERNAL Node Creation

- [ ] 7.1 Implement `createExternalNode(packageName)` function
- [ ] 7.2 Extract package name from specifier (e.g., `lodash/debounce` → `lodash`)
- [ ] 7.3 Create EXTERNAL node with id format `EXTERNAL:<packageName>`
- [ ] 7.4 Handle built-in modules (fs, path, etc.)
- [ ] 7.5 Deduplicate EXTERNAL nodes (same package referenced multiple times)

## 8. Edge Generation

- [ ] 8.1 Implement `generateImportEdge(importInfo)` function
- [ ] 8.2 Implement `generateReExportEdge(exportInfo)` function
- [ ] 8.3 Implement `generateDynamicImportEdge(callInfo)` function
- [ ] 8.4 Set edge.from to source FILE node id
- [ ] 8.5 Set edge.to to resolved FILE or EXTERNAL node id
- [ ] 8.6 Set edge.type to correct EdgeType (IMPORTS, RE_EXPORTS, DYNAMIC_IMPORTS)
- [ ] 8.7 Add line number to edge.metadata
- [ ] 8.8 Add importSpecifier to edge.metadata

## 9. Main Parser Class

- [ ] 9.1 Create `TypeScriptParser` class
- [ ] 9.2 Implement `parseFile(sourceFile)` method
- [ ] 9.3 Implement `parseAll(files, projectRoot)` method
- [ ] 9.4 Create single Program instance in parseAll
- [ ] 9.5 Process each file sequentially
- [ ] 9.6 Aggregate results: combine nodes and edges
- [ ] 9.7 Collect warnings from all files

## 10. Error Handling

- [ ] 10.1 Catch syntax errors in individual files
- [ ] 10.2 Add warning message for syntax errors
- [ ] 10.3 Continue parsing other files after error
- [ ] 10.4 Handle file read errors (permission denied, not found)
- [ ] 10.5 Return partial results on error

## 11. Unit Tests

- [ ] 11.1 Test named import extraction
- [ ] 11.2 Test default import extraction
- [ ] 11.3 Test namespace import extraction
- [ ] 11.4 Test multiple named imports extraction
- [ ] 11.5 Test side-effect import extraction
- [ ] 11.6 Test named re-export extraction
- [ ] 11.7 Test wildcard re-export extraction (single edge)
- [ ] 11.8 Test default re-export extraction
- [ ] 11.9 Test dynamic import extraction
- [ ] 11.10 Test relative path resolution
- [ ] 11.11 Test alias path resolution (single match)
- [ ] 11.12 Test alias path resolution (multiple matches, first wins)
- [ ] 11.13 Test alias path resolution (fallback to second match)
- [ ] 11.14 Test EXTERNAL node creation for external packages
- [ ] 11.15 Test EXTERNAL node creation for built-in modules
- [ ] 11.16 Test EXTERNAL node deduplication
- [ ] 11.17 Test importSpecifier metadata format
- [ ] 11.18 Test tsconfig.json not found fallback
- [ ] 11.19 Test syntax error handling
- [ ] 11.20 Test empty file list handling
- [ ] 11.21 Verify test coverage ≥ 80% for parser module

## 12. Integration

- [ ] 12.1 Export TypeScriptParser from parser/index.ts
- [ ] 12.2 Export parseImports function from parser/index.ts
- [ ] 12.3 Export parser types from main package index.ts
- [ ] 12.4 Create integration test: scanner → parser → graph
- [ ] 12.5 Test with fixture project: import-test-project
- [ ] 12.6 Add JSDoc comments to all public functions