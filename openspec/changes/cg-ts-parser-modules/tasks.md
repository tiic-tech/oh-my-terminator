## 1. Setup & Types

- [ ] 1.1 Create `packages/codegraph/src/parser/module-extractor.ts` module
- [ ] 1.2 Create `packages/codegraph/src/parser/kind-detector.ts` module
- [ ] 1.3 Create `packages/codegraph/src/parser/complexity.ts` module
- [ ] 1.4 Create `packages/codegraph/src/parser/loc-counter.ts` module
- [ ] 1.5 Create `ModuleExtractResult` interface in module-extractor.ts
- [ ] 1.6 Create `ModuleMetadata` interface extending base GraphNode metadata
- [ ] 1.7 Export types from parser/index.ts

## 2. Kind Classification (D2)

- [ ] 2.1 Implement `detectKind(node: ts.Node): ModuleKind` function
- [ ] 2.2 Classify FunctionDeclaration as `function`
- [ ] 2.3 Classify ClassDeclaration as `class`
- [ ] 2.4 Classify InterfaceDeclaration as `interface`
- [ ] 2.5 Classify TypeAliasDeclaration as `type`
- [ ] 2.6 Classify EnumDeclaration as `type` with enumMembers metadata
- [ ] 2.7 Classify VariableDeclaration with arrow function as `function`
- [ ] 2.8 Classify VariableDeclaration with JSX return as `component`
- [ ] 2.9 Classify other VariableDeclaration as `variable`
- [ ] 2.10 Implement component detection dual criteria (A2)
- [ ] 2.11 Exclude hooks (useXxx) from component classification

## 3. McCabe Complexity Calculation (D3/A4)

- [ ] 3.1 Implement `calculateComplexity(node: ts.Node): number` function
- [ ] 3.2 Count base complexity (1 for each function)
- [ ] 3.3 Add +1 for each `if` statement
- [ ] 3.4 Add +1 for each `else` / `else if`
- [ ] 3.5 Add +1 for each `for` / `while` / `do-while`
- [ ] 3.6 Add +1 for each `switch` case
- [ ] 3.7 Add +1 for each `catch` block
- [ ] 3.8 Add +1 for each `&&` operator
- [ ] 3.9 Add +1 for each `||` operator
- [ ] 3.10 Add +1 for each `??` operator
- [ ] 3.11 Add +1 for each `?:` ternary operator

## 4. LOC Counting (D5/A5)

- [ ] 4.1 Implement `countLOC(sourceFile: ts.SourceFile, node: ts.Node): number` function
- [ ] 4.2 Get node text range from AST
- [ ] 4.3 Split text into lines
- [ ] 4.4 Filter out empty lines
- [ ] 4.5 Filter out single-line comments (`//`)
- [ ] 4.6 Filter out multi-line comment blocks
- [ ] 4.7 Filter out JSDoc comment blocks
- [ ] 4.8 Include import/export lines
- [ ] 4.9 Include type definition lines
- [ ] 4.10 Return filtered line count

## 5. JSDoc Extraction (A3)

- [ ] 5.1 Implement `extractJSDoc(node: ts.Node): string | undefined` function
- [ ] 5.2 Find JSDoc comment range from AST
- [ ] 5.3 Extract text content (strip `/**` and `*/`)
- [ ] 5.4 Truncate at 200 characters
- [ ] 5.5 Add ellipsis if truncated
- [ ] 5.6 Preserve newline characters for readability

## 6. MODULE Node ID Naming (D1/A8/A9/A12)

- [ ] 6.1 Implement `generateModuleId(filePath: string, name: string): string` function
- [ ] 6.2 Format: `MODULE:relativePath#exportName`
- [ ] 6.3 Handle named exports: use declaration name
- [ ] 6.4 Handle named default exports: use function/class name (not "default")
- [ ] 6.5 Handle anonymous default exports: use `"default"`
- [ ] 6.6 Handle multiple anonymous exports: append `_N` suffix
- [ ] 6.7 Handle renamed exports: use exported name (not original)
- [ ] 6.8 Store original name in metadata.originalName for renamed exports

## 7. Module Extraction Core

- [ ] 7.1 Create `ModuleExtractor` class
- [ ] 7.2 Implement `extractModules(sourceFile: ts.SourceFile): ModuleExtractResult` method
- [ ] 7.3 Traverse top-level declarations in SourceFile
- [ ] 7.4 Check if declaration is exported (has export modifier or in export list)
- [ ] 7.5 Skip non-exported declarations
- [ ] 7.6 Create MODULE node for each exported declaration
- [ ] 7.7 Apply kind classification
- [ ] 7.8 Apply complexity calculation
- [ ] 7.9 Apply LOC counting
- [ ] 7.10 Apply JSDoc extraction
- [ ] 7.11 Generate correct MODULE ID
- [ ] 7.12 Handle multiple exports of same symbol (store in metadata.exports)

## 8. Export Declaration Processing

- [ ] 8.1 Process `export function name() {}` syntax
- [ ] 8.2 Process `export class name {}` syntax
- [ ] 8.3 Process `export interface name {}` syntax
- [ ] 8.4 Process `export type name = ...` syntax
- [ ] 8.5 Process `export enum name {}` syntax
- [ ] 8.6 Process `export const name = ...` syntax
- [ ] 8.7 Process `export default function name() {}` syntax
- [ ] 8.8 Process `export default function() {}` syntax (anonymous)
- [ ] 8.9 Process `export default class {}` syntax (anonymous)
- [ ] 8.10 Process `export { name }` syntax
- [ ] 8.11 Process `export { orig as exp }` syntax (renamed)
- [ ] 8.12 Process `export { name } from './file'` syntax (re-export)

## 9. Integration with TypeScriptParser

- [ ] 9.1 Add `extractModules()` call to TypeScriptParser.parseFile()
- [ ] 9.2 Add MODULE nodes to parse result
- [ ] 9.3 Create CONTAINS edges from FILE to MODULE nodes
- [ ] 9.4 Reuse TypeScript Program from C3

## 10. Error Handling

- [ ] 10.1 Catch syntax errors in individual declarations
- [ ] 10.2 Add warning message for syntax errors
- [ ] 10.3 Continue processing other declarations
- [ ] 10.4 Handle missing JSDoc gracefully
- [ ] 10.5 Handle unsupported declaration types gracefully

## 11. Unit Tests

- [ ] 11.1 Test named function export extraction
- [ ] 11.2 Test named class export extraction
- [ ] 11.3 Test named interface export extraction
- [ ] 11.4 Test named type export extraction
- [ ] 11.5 Test named enum export extraction (with enumMembers)
- [ ] 11.6 Test named variable export extraction
- [ ] 11.7 Test named default export (uses function name)
- [ ] 11.8 Test anonymous default export (uses "default")
- [ ] 11.9 Test anonymous default class export
- [ ] 11.10 Test renamed export (uses exported name)
- [ ] 11.11 Test kind classification for all types
- [ ] 11.12 Test component detection (JSX.Element return)
- [ ] 11.13 Test component detection (JSX in body)
- [ ] 11.14 Test hook not classified as component
- [ ] 11.15 Test complexity calculation (simple function = 1)
- [ ] 11.16 Test complexity calculation (if-else = 3)
- [ ] 11.17 Test complexity calculation (switch 3 cases = 4)
- [ ] 11.18 Test complexity calculation (logical operators)
- [ ] 11.19 Test LOC counting (exclude comments)
- [ ] 11.20 Test LOC counting (exclude empty lines)
- [ ] 11.21 Test JSDoc extraction (full)
- [ ] 11.22 Test JSDoc extraction (truncated at 200)
- [ ] 11.23 Test JSDoc extraction (no JSDoc)
- [ ] 11.24 Test multiple exports of same symbol
- [ ] 11.25 Test non-exported declarations skipped
- [ ] 11.26 Test MODULE ID format
- [ ] 11.27 Test metadata.originalName for renamed exports
- [ ] 11.28 Test metadata.namedDefault for named defaults
- [ ] 11.29 Test metadata.enumMembers for enums
- [ ] 11.30 Verify test coverage ≥ 80% for module-extractor

## 12. Integration

- [ ] 12.1 Export ModuleExtractor from parser/index.ts
- [ ] 12.2 Export extractModules function from parser/index.ts
- [ ] 12.3 Export module types from main package index.ts
- [ ] 12.4 Create integration test: scanner → parser (imports + modules) → graph
- [ ] 12.5 Test with fixture project: module-test-project
- [ ] 12.6 Verify MODULE nodes correctly linked to FILE nodes
- [ ] 12.7 Add JSDoc comments to all public functions