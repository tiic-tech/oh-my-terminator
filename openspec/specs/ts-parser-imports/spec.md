# ts-parser-imports Specification

## Purpose
TBD - created by archiving change cg-ts-parser-imports. Update Purpose after archive.
## Requirements
### Requirement: Parse TypeScript import declarations

The parser SHALL extract import declarations from TypeScript source files and generate IMPORTS edges between FILE nodes.

#### Scenario: Named import extraction
- **WHEN** source file contains `import { formatDate } from './utils'`
- **THEN** parser generates IMPORTS edge from source FILE to resolved FILE
- **AND** edge metadata.importSpecifier is `"named:formatDate"`
- **AND** edge metadata.line contains the line number

#### Scenario: Default import extraction
- **WHEN** source file contains `import utils from './utils'`
- **THEN** parser generates IMPORTS edge from source FILE to resolved FILE
- **AND** edge metadata.importSpecifier is `"default"`

#### Scenario: Namespace import extraction
- **WHEN** source file contains `import * as utils from './utils'`
- **THEN** parser generates IMPORTS edge from source FILE to resolved FILE
- **AND** edge metadata.importSpecifier is `"namespace"`

#### Scenario: Multiple named imports
- **WHEN** source file contains `import { a, b, c } from './utils'`
- **THEN** parser generates IMPORTS edge from source FILE to resolved FILE
- **AND** edge metadata.importSpecifier is `"named:a,b,c"`

#### Scenario: Side-effect import
- **WHEN** source file contains `import './setup'`
- **THEN** parser generates IMPORTS edge from source FILE to resolved FILE
- **AND** edge metadata.importSpecifier is `"empty"`

### Requirement: Parse TypeScript export declarations

The parser SHALL extract export declarations with source specifiers and generate RE_EXPORTS edges.

#### Scenario: Named re-export
- **WHEN** source file contains `export { formatDate } from './utils'`
- **THEN** parser generates RE_EXPORTS edge from source FILE to resolved FILE
- **AND** edge metadata.importSpecifier is `"named:formatDate"`

#### Scenario: Wildcard re-export
- **WHEN** source file contains `export * from './utils'`
- **THEN** parser generates single RE_EXPORTS edge from source FILE to resolved FILE
- **AND** edge metadata.importSpecifier is `"wildcard"`
- **AND** parser does NOT generate multiple edges for each exported symbol

#### Scenario: Default re-export
- **WHEN** source file contains `export { default } from './utils'`
- **THEN** parser generates RE_EXPORTS edge from source FILE to resolved FILE
- **AND** edge metadata.importSpecifier is `"default"`

### Requirement: Parse dynamic import expressions

The parser SHALL detect dynamic import() calls and generate DYNAMIC_IMPORTS edges.

#### Scenario: Static dynamic import
- **WHEN** source file contains `import('./utils')`
- **THEN** parser generates DYNAMIC_IMPORTS edge from source FILE to resolved FILE
- **AND** edge metadata.importSpecifier is `"dynamic"`

#### Scenario: Dynamic import with variable
- **WHEN** source file contains `import(somePath)` where somePath is a variable
- **THEN** parser generates DYNAMIC_IMPORTS edge with unresolved target
- **AND** edge metadata.importSpecifier is `"dynamic"`
- **AND** edge.to points to EXTERNAL node with placeholder name

#### Scenario: Multiple dynamic imports
- **WHEN** source file contains multiple `import()` calls
- **THEN** parser generates DYNAMIC_IMPORTS edge for each call

### Requirement: Resolve module paths using tsconfig.json

The parser SHALL resolve module specifiers using TypeScript's module resolution, including path aliases from tsconfig.json.

#### Scenario: Relative path resolution
- **WHEN** import specifier is `./utils/format`
- **AND** source file is at `src/components/Button.tsx`
- **THEN** parser resolves to `src/utils/format.ts`
- **AND** edge.to is `"FILE:src/utils/format.ts"`

#### Scenario: Alias path resolution with single match
- **WHEN** tsconfig.json has paths `{"@utils/*": ["src/utils/*"]}`
- **AND** import specifier is `@utils/format`
- **THEN** parser resolves to `src/utils/format.ts`
- **AND** edge.to is `"FILE:src/utils/format.ts"`

#### Scenario: Alias path with multiple matches (A2)
- **WHEN** tsconfig.json has paths `{"@utils/*": ["src/utils/*", "src/shared/utils/*"]}`
- **AND** import specifier is `@utils/helper`
- **AND** `src/utils/helper.ts` exists
- **THEN** parser resolves to `src/utils/helper.ts` (first match wins)
- **AND** parser does NOT try `src/shared/utils/helper.ts`

#### Scenario: Alias path fallback to second match
- **WHEN** tsconfig.json has paths `{"@utils/*": ["src/utils/*", "src/shared/utils/*"]}`
- **AND** import specifier is `@utils/shared-helper`
- **AND** `src/utils/shared-helper.ts` does NOT exist
- **AND** `src/shared/utils/shared-helper.ts` exists
- **THEN** parser resolves to `src/shared/utils/shared-helper.ts`

#### Scenario: tsconfig.json not found
- **WHEN** project root has no tsconfig.json
- **THEN** parser uses default compiler options
- **AND** relative imports are still resolved correctly

### Requirement: Create EXTERNAL nodes for unresolved imports

The parser SHALL create EXTERNAL nodes when module resolution fails to find a project file.

#### Scenario: External package import
- **WHEN** import specifier is `lodash`
- **AND** lodash is not a project file
- **THEN** parser creates EXTERNAL node with id `"EXTERNAL:lodash"`
- **AND** parser generates IMPORTS edge to EXTERNAL node

#### Scenario: External package with subpath
- **WHEN** import specifier is `lodash/debounce`
- **AND** it resolves to an external package
- **THEN** parser creates EXTERNAL node with id `"EXTERNAL:lodash"`
- **AND** edge metadata reflects the subpath import

#### Scenario: Built-in module import
- **WHEN** import specifier is `fs` or `path`
- **THEN** parser creates EXTERNAL node with id `"EXTERNAL:fs"` or `"EXTERNAL:path"`

#### Scenario: Duplicate external imports
- **WHEN** multiple files import from the same external package `lodash`
- **THEN** parser creates single EXTERNAL node `"EXTERNAL:lodash"`
- **AND** parser generates multiple IMPORTS edges to the same EXTERNAL node

### Requirement: Return parse results with nodes and edges

The parser SHALL return a structured ParseResult containing all extracted nodes and edges.

#### Scenario: Successful parse result
- **WHEN** parser processes a valid TypeScript file
- **THEN** result contains nodes array with any EXTERNAL nodes
- **AND** result contains edges array with IMPORTS/RE_EXPORTS/DYNAMIC_IMPORTS edges
- **AND** result contains warnings array (may be empty)

#### Scenario: Parse result for file with multiple imports
- **WHEN** source file has 5 import statements, 2 re-exports, 1 dynamic import
- **THEN** result.edges contains 8 edges (5 IMPORTS + 2 RE_EXPORTS + 1 DYNAMIC_IMPORTS)

#### Scenario: Parse result with warnings
- **WHEN** parser encounters a syntax error or unresolved import
- **THEN** result.warnings contains descriptive warning message
- **AND** parser continues processing other files

### Requirement: Handle parse errors gracefully

The parser SHALL continue parsing when encountering errors and log warnings.

#### Scenario: Syntax error in source file
- **WHEN** source file contains invalid TypeScript syntax
- **THEN** parser adds warning to result.warnings
- **AND** parser continues processing other import statements
- **AND** parser returns partial results

#### Scenario: File read error
- **WHEN** file cannot be read (permission denied, not found)
- **THEN** parser adds warning to result.warnings
- **AND** parser skips the file

### Requirement: Process multiple files

The parser SHALL accept a list of file paths and parse all files efficiently.

#### Scenario: Parse all files from scanner output
- **WHEN** parser receives filesToParse from C2 scanner (e.g., 10 .ts files)
- **THEN** parser creates single TypeScript Program for all files
- **AND** parser processes each file sequentially
- **AND** parser returns combined ParserResult with all nodes and edges

#### Scenario: Empty file list
- **WHEN** parser receives empty filesToParse array
- **THEN** parser returns empty ParserResult (no nodes, no edges)
- **AND** parser does NOT create TypeScript Program

