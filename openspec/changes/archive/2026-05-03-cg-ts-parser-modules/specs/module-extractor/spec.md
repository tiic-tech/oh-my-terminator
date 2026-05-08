## ADDED Requirements

### Requirement: Extract named exports as MODULE nodes

The parser SHALL extract named export declarations and create MODULE nodes with ID format `MODULE:filePath#exportName`.

#### Scenario: Named function export
- **WHEN** source file contains `export function formatDate() {}`
- **THEN** parser creates MODULE node with id `MODULE:src/utils.ts#formatDate`
- **AND** node.type is `MODULE`
- **AND** node.name is `formatDate`
- **AND** node.path is `src/utils.ts`

#### Scenario: Named class export
- **WHEN** source file contains `export class UserService {}`
- **THEN** parser creates MODULE node with id `MODULE:src/services.ts#UserService`
- **AND** node.metadata.kind is `class`

#### Scenario: Named interface export
- **WHEN** source file contains `export interface UserConfig {}`
- **THEN** parser creates MODULE node with id `MODULE:src/types.ts#UserConfig`
- **AND** node.metadata.kind is `interface`

#### Scenario: Named type export
- **WHEN** source file contains `export type Status = 'active' | 'inactive'`
- **THEN** parser creates MODULE node with id `MODULE:src/types.ts#Status`
- **AND** node.metadata.kind is `type`

#### Scenario: Named enum export
- **WHEN** source file contains `export enum Role { Admin, User }`
- **THEN** parser creates MODULE node with id `MODULE:src/types.ts#Role`
- **AND** node.metadata.kind is `type`
- **AND** node.metadata.enumMembers is `["Admin", "User"]`

#### Scenario: Named variable export
- **WHEN** source file contains `export const API_URL = 'https://api.example.com'`
- **THEN** parser creates MODULE node with id `MODULE:src/config.ts#API_URL`
- **AND** node.metadata.kind is `variable`

### Requirement: Extract default exports as MODULE nodes

The parser SHALL extract default export declarations with proper naming strategy per A8/A12 resolutions.

#### Scenario: Named default export
- **WHEN** source file contains `export default function formatDate() {}`
- **THEN** parser creates MODULE node with id `MODULE:src/utils.ts#formatDate`
- **AND** node.name is `formatDate`
- **AND** node.metadata.namedDefault is `true`

#### Scenario: Anonymous default function
- **WHEN** source file contains `export default function() {}`
- **THEN** parser creates MODULE node with id `MODULE:src/index.ts#default`
- **AND** node.name is `default`

#### Scenario: Anonymous default class
- **WHEN** source file contains `export default class {}`
- **THEN** parser creates MODULE node with id `MODULE:src/index.ts#default`
- **AND** node.name is `default`
- **AND** node.metadata.kind is `class`

#### Scenario: Multiple anonymous exports
- **WHEN** source file has multiple anonymous default exports (rare edge case)
- **THEN** parser creates MODULE nodes with ids `MODULE:file#default`, `MODULE:file#default_1`, etc.

### Requirement: Handle renamed exports

The parser SHALL extract renamed exports using exported name per A9 resolution.

#### Scenario: Renamed export
- **WHEN** source file contains `export { originalName as exportedName }`
- **THEN** parser creates MODULE node with id `MODULE:src/file.ts#exportedName`
- **AND** node.name is `exportedName`
- **AND** node.metadata.originalName is `originalName`

#### Scenario: Renamed re-export
- **WHEN** source file contains `export { format as formatDate } from './utils'`
- **THEN** parser creates MODULE node with id `MODULE:src/index.ts#formatDate`
- **AND** node.metadata.originalName is `format`

### Requirement: Classify kind correctly

The parser SHALL determine `kind` field based on AST node type per D2 classification rules.

#### Scenario: Function kind
- **WHEN** exported declaration is FunctionDeclaration
- **THEN** node.metadata.kind is `function`

#### Scenario: Arrow function in variable
- **WHEN** exported declaration is `export const handler = () => {}`
- **THEN** node.metadata.kind is `function`

#### Scenario: Class kind
- **WHEN** exported declaration is ClassDeclaration
- **THEN** node.metadata.kind is `class`

#### Scenario: Interface kind
- **WHEN** exported declaration is InterfaceDeclaration
- **THEN** node.metadata.kind is `interface`

#### Scenario: Type kind
- **WHEN** exported declaration is TypeAliasDeclaration
- **THEN** node.metadata.kind is `type`

#### Scenario: Variable kind
- **WHEN** exported variable has non-function initial value
- **THEN** node.metadata.kind is `variable`

### Requirement: Detect React components

The parser SHALL identify React components using dual criteria per A2 resolution.

#### Scenario: Component with JSX.Element return type
- **WHEN** function has return type annotation `JSX.Element` or `React.ReactElement`
- **THEN** node.metadata.kind is `component`

#### Scenario: Component with JSX in body
- **WHEN** function body contains JSX elements like `<div>` or `<Button/>`
- **THEN** node.metadata.kind is `component`

#### Scenario: Hook not classified as component
- **WHEN** function name starts with `use` (e.g., `useToggle`)
- **AND** it doesn't return JSX.Element
- **THEN** node.metadata.kind is `function` (not `component`)

### Requirement: Extract JSDoc comments

The parser SHALL extract JSDoc comments, truncating at 200 characters per A3 resolution.

#### Scenario: Full JSDoc extraction
- **WHEN** exported symbol has JSDoc comment shorter than 200 chars
- **THEN** node.metadata.jsDoc contains full comment text

#### Scenario: JSDoc truncation
- **WHEN** exported symbol has JSDoc comment longer than 200 chars
- **THEN** node.metadata.jsDoc contains first 200 chars with ellipsis

#### Scenario: No JSDoc
- **WHEN** exported symbol has no JSDoc comment
- **THEN** node.metadata.jsDoc is undefined or empty

### Requirement: Calculate McCabe complexity

The parser SHALL calculate cyclomatic complexity per D3 McCabe algorithm.

#### Scenario: Simple function
- **WHEN** function has no conditionals
- **THEN** node.metadata.complexity is `1`

#### Scenario: Function with if-else
- **WHEN** function contains one `if` and one `else`
- **THEN** node.metadata.complexity is `3` (base 1 + if 1 + else 1)

#### Scenario: Function with switch
- **WHEN** function has switch with 3 cases
- **THEN** node.metadata.complexity is `4` (base 1 + 3 cases)

#### Scenario: Function with logical operators
- **WHEN** function contains `a && b || c`
- **THEN** node.metadata.complexity is `3` (base 1 + && 1 + || 1)

### Requirement: Count effective lines of code

The parser SHALL count LOC per D5 counting rules.

#### Scenario: Simple function LOC
- **WHEN** function spans 5 lines including braces and return
- **THEN** node.metadata.loc is `5`

#### Scenario: LOC excludes comments
- **WHEN** function has 5 code lines and 3 comment lines
- **THEN** node.metadata.loc is `5`

#### Scenario: LOC excludes empty lines
- **WHEN** function has 5 code lines and 2 empty lines
- **THEN** node.metadata.loc is `5`

### Requirement: Handle multiple exports of same symbol

The parser SHALL create single MODULE node per symbol per A11/D5 resolution.

#### Scenario: Named and default export of same symbol
- **WHEN** source contains `function foo() {}` with `export { foo }` and `export default foo`
- **THEN** parser creates single MODULE node `MODULE:file#foo`
- **AND** node.metadata.exports is `["named", "default"]`

### Requirement: Skip non-exported declarations

The parser SHALL NOT create MODULE nodes for non-exported declarations.

#### Scenario: Private function
- **WHEN** source contains `function privateHelper() {}` without export
- **THEN** parser does NOT create MODULE node for `privateHelper`

#### Scenario: Private class
- **WHEN** source contains `class InternalService {}` without export
- **THEN** parser does NOT create MODULE node

### Requirement: Return parse results with nodes

The parser SHALL return structured results with all extracted MODULE nodes.

#### Scenario: Successful module extraction
- **WHEN** parser processes file with multiple exports
- **THEN** result.nodes contains all MODULE nodes
- **AND** result.warnings contains any non-fatal issues

#### Scenario: Parse error handling
- **WHEN** parser encounters syntax error in file
- **THEN** parser adds warning to result.warnings
- **AND** parser continues processing other files