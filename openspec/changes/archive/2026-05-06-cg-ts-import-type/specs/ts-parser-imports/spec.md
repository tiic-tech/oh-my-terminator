# ts-parser-imports Specification Delta

## Purpose

Extends import extraction to detect TypeScript `import type` statements.

## MODIFIED Requirements

### Requirement: Parse TypeScript import declarations

The parser SHALL extract import declarations from TypeScript source files and generate IMPORTS edges between FILE nodes, including type-only detection.

#### Scenario: Named import extraction
- **WHEN** source file contains `import { formatDate } from './utils'`
- **THEN** parser generates IMPORTS edge from source FILE to resolved FILE
- **AND** edge metadata.importSpecifier is `"named:formatDate"`
- **AND** edge metadata.importKind is `"value"`
- **AND** edge metadata.line contains the line number

#### Scenario: Type-only named import extraction
- **WHEN** source file contains `import type { User } from './types'`
- **THEN** parser generates IMPORTS edge from source FILE to resolved FILE
- **AND** edge metadata.importSpecifier is `"named:User"`
- **AND** edge metadata.importKind is `"type-only"`
- **AND** edge metadata.line contains the line number

#### Scenario: Default import extraction
- **WHEN** source file contains `import utils from './utils'`
- **THEN** parser generates IMPORTS edge from source FILE to resolved FILE
- **AND** edge metadata.importSpecifier is `"default"`
- **AND** edge metadata.importKind is `"value"`

#### Scenario: Type-only default import
- **WHEN** source file contains `import type User from './types'`
- **THEN** parser generates IMPORTS edge from source FILE to resolved FILE
- **AND** edge metadata.importSpecifier is `"default"`
- **AND** edge metadata.importKind is `"type-only"`

#### Scenario: Namespace import extraction
- **WHEN** source file contains `import * as utils from './utils'`
- **THEN** parser generates IMPORTS edge from source FILE to resolved FILE
- **AND** edge metadata.importSpecifier is `"namespace"`
- **AND** edge metadata.importKind is `"value"`

#### Scenario: Type-only namespace import
- **WHEN** source file contains `import type * as Types from './types'`
- **THEN** parser generates IMPORTS edge from source FILE to resolved FILE
- **AND** edge metadata.importSpecifier is `"namespace"`
- **AND** edge metadata.importKind is `"type-only"`

#### Scenario: Side-effect import
- **WHEN** source file contains `import './setup'`
- **THEN** parser generates IMPORTS edge from source FILE to resolved FILE
- **AND** edge metadata.importSpecifier is `"empty"`
- **AND** edge metadata.importKind is `"value"`

#### Scenario: Multiple named imports
- **WHEN** source file contains `import { a, b, c } from './utils'`
- **THEN** parser generates IMPORTS edge from source FILE to resolved FILE
- **AND** edge metadata.importSpecifier is `"named:a,b,c"`
- **AND** edge metadata.importKind is `"value"`

### Requirement: ImportKind type definition

The system SHALL define ImportKind as a standalone type for type consistency across modules.

#### Scenario: ImportKind type exported
- **WHEN** parser types are imported from the parser module
- **THEN** ImportKind type is available as a named export
- **AND** ImportKind is defined as `type ImportKind = 'type-only' | 'value'`
- **AND** ImportKind is used in IMPORTS edge metadata type definitions