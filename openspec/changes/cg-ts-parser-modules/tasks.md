## 1. Setup & Types

- [x] 1.1 Create `packages/codegraph/src/parser/module-extractor.ts` module
- [x] 1.2 Create `packages/codegraph/src/parser/kind-detector.ts` module (merged into module-extractor.ts per D7)
- [x] 1.3 Create `packages/codegraph/src/parser/complexity.ts` module (merged into module-extractor.ts per D7)
- [x] 1.4 Create `packages/codegraph/src/parser/loc-counter.ts` module (merged into module-extractor.ts per D7)
- [x] 1.5 Create `ModuleExtractResult` interface in module-extractor.ts
- [x] 1.6 Create `ModuleMetadata` interface extending base GraphNode metadata
- [x] 1.7 Export types from parser/index.ts

## 2. Kind Classification (D2)

- [x] 2.1 Implement `detectKind(node: ts.Node): ModuleKind` function
- [x] 2.2 Classify FunctionDeclaration as `function`
- [x] 2.3 Classify ClassDeclaration as `class`
- [x] 2.4 Classify InterfaceDeclaration as `interface`
- [x] 2.5 Classify TypeAliasDeclaration as `type`
- [x] 2.6 Classify EnumDeclaration as `type` with enumMembers metadata
- [x] 2.7 Classify VariableDeclaration with arrow function as `function`
- [x] 2.8 Classify VariableDeclaration with JSX return as `component`
- [x] 2.9 Classify other VariableDeclaration as `variable`
- [x] 2.10 Implement component detection dual criteria (A2)
- [x] 2.11 Exclude hooks (useXxx) from component classification

## 3. McCabe Complexity Calculation (D3/A4)

- [x] 3.1 Implement `calculateComplexity(node: ts.Node): number` function
- [x] 3.2 Count base complexity (1 for each function)
- [x] 3.3 Add +1 for each `if` statement
- [x] 3.4 Add +1 for each `else` / `else if`
- [x] 3.5 Add +1 for each `for` / `while` / `do-while`
- [x] 3.6 Add +1 for each `switch` case
- [x] 3.7 Add +1 for each `catch` block
- [x] 3.8 Add +1 for each `&&` operator
- [x] 3.9 Add +1 for each `||` operator
- [x] 3.10 Add +1 for each `??` operator
- [x] 3.11 Add +1 for each `?:` ternary operator

## 4. LOC Counting (D5/A5)

- [x] 4.1 Implement `countLOC(sourceFile: ts.SourceFile, node: ts.Node): number` function
- [x] 4.2 Get node text range from AST
- [x] 4.3 Split text into lines
- [x] 4.4 Filter out empty lines
- [x] 4.5 Filter out single-line comments (`//`)
- [x] 4.6 Filter out multi-line comment blocks
- [x] 4.7 Filter out JSDoc comment blocks
- [x] 4.8 Include import/export lines
- [x] 4.9 Include type definition lines
- [x] 4.10 Return filtered line count

## 5. JSDoc Extraction (A3)

- [x] 5.1 Implement `extractJSDoc(node: ts.Node): string | undefined` function
- [x] 5.2 Find JSDoc comment range from AST
- [x] 5.3 Extract text content (strip `/**` and `*/`)
- [x] 5.4 Truncate at 200 characters
- [x] 5.5 Add ellipsis if truncated
- [x] 5.6 Preserve newline characters for readability

## 6. MODULE Node ID Naming (D1/A8/A9/A12)

- [x] 6.1 Implement `generateModuleId(filePath: string, name: string): string` function
- [x] 6.2 Format: `MODULE:relativePath#exportName`
- [x] 6.3 Handle named exports: use declaration name
- [x] 6.4 Handle named default exports: use function/class name (not "default")
- [x] 6.5 Handle anonymous default exports: use `"default"`
- [x] 6.6 Handle multiple anonymous exports: append `_N` suffix
- [x] 6.7 Handle renamed exports: use exported name (not original)
- [x] 6.8 Store original name in metadata.originalName for renamed exports

## 7. Module Extraction Core

- [x] 7.1 Create `ModuleExtractor` class
- [x] 7.2 Implement `extractModules(sourceFile: ts.SourceFile): ModuleExtractResult` method
- [x] 7.3 Traverse top-level declarations in SourceFile
- [x] 7.4 Check if declaration is exported (has export modifier or in export list)
- [x] 7.5 Skip non-exported declarations
- [x] 7.6 Create MODULE node for each exported declaration
- [x] 7.7 Apply kind classification
- [x] 7.8 Apply complexity calculation
- [x] 7.9 Apply LOC counting
- [x] 7.10 Apply JSDoc extraction
- [x] 7.11 Generate correct MODULE ID
- [ ] 7.12 Handle multiple exports of same symbol (store in metadata.exports)

## 8. Export Declaration Processing

- [x] 8.1 Process `export function name() {}` syntax
- [x] 8.2 Process `export class name {}` syntax
- [x] 8.3 Process `export interface name {}` syntax
- [x] 8.4 Process `export type name = ...` syntax
- [x] 8.5 Process `export enum name {}` syntax
- [x] 8.6 Process `export const name = ...` syntax
- [x] 8.7 Process `export default function name() {}` syntax
- [x] 8.8 Process `export default function() {}` syntax (anonymous)
- [x] 8.9 Process `export default class {}` syntax (anonymous)
- [x] 8.10 Process `export { name }` syntax
- [x] 8.11 Process `export { orig as exp }` syntax (renamed)
- [ ] 8.12 Process `export { name } from './file'` syntax (re-export)

## 9. Integration with TypeScriptParser

- [x] 9.1 Add `extractModules()` call to TypeScriptParser.parseFile()
- [x] 9.2 Add MODULE nodes to parse result
- [x] 9.3 Create CONTAINS edges from FILE to MODULE nodes
- [x] 9.4 Reuse TypeScript Program from C3

## 10. Error Handling

- [x] 10.1 Catch syntax errors in individual declarations
- [x] 10.2 Add warning message for syntax errors
- [x] 10.3 Continue processing other declarations
- [x] 10.4 Handle missing JSDoc gracefully
- [x] 10.5 Handle unsupported declaration types gracefully

## 11. Unit Tests

- [x] 11.1 Test named function export extraction
- [x] 11.2 Test named class export extraction
- [x] 11.3 Test named interface export extraction
- [x] 11.4 Test named type export extraction
- [x] 11.5 Test named enum export extraction (with enumMembers)
- [x] 11.6 Test named variable export extraction
- [x] 11.7 Test named default export (uses function name)
- [x] 11.8 Test anonymous default export (uses "default")
- [x] 11.9 Test anonymous default class export
- [x] 11.10 Test renamed export (uses exported name)
- [x] 11.11 Test kind classification for all types
- [x] 11.12 Test component detection (JSX.Element return)
- [x] 11.13 Test component detection (JSX in body)
- [x] 11.14 Test hook not classified as component
- [x] 11.15 Test complexity calculation (simple function = 1)
- [x] 11.16 Test complexity calculation (if-else = 3)
- [x] 11.17 Test complexity calculation (switch 3 cases = 4)
- [x] 11.18 Test complexity calculation (logical operators)
- [x] 11.19 Test LOC counting (exclude comments)
- [x] 11.20 Test LOC counting (exclude empty lines)
- [x] 11.21 Test JSDoc extraction (full)
- [x] 11.22 Test JSDoc extraction (truncated at 200)
- [x] 11.23 Test JSDoc extraction (no JSDoc)
- [x] 11.24 Test multiple exports of same symbol
- [x] 11.25 Test non-exported declarations skipped
- [x] 11.26 Test MODULE ID format
- [x] 11.27 Test metadata.originalName for renamed exports
- [x] 11.28 Test metadata.namedDefault for named defaults
- [x] 11.29 Test metadata.enumMembers for enums
- [x] 11.30 Verify test coverage ≥ 80% for module-extractor

## 12. Integration

- [x] 12.1 Export ModuleExtractor from parser/index.ts
- [x] 12.2 Export extractModules function from parser/index.ts
- [x] 12.3 Export module types from main package index.ts
- [ ] 12.4 Create integration test: scanner → parser (imports + modules) → graph
- [ ] 12.5 Test with fixture project: module-test-project
- [x] 12.6 Verify MODULE nodes correctly linked to FILE nodes
- [ ] 12.7 Add JSDoc comments to all public functions