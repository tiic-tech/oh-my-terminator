# ts-import-type Specification

## Purpose

Detect and handle TypeScript `import type` statements, distinguishing type-only imports from value imports.

## Requirements

### Requirement: Type-only import detection

The system SHALL detect TypeScript `import type` statements using the Compiler API's `ImportClause.isTypeOnly` property.

#### Scenario: Import type statement detected
- **WHEN** source file contains `import type { User } from './types'`
- **THEN** parser detects `importClause.isTypeOnly === true`
- **AND** parser marks import as `importKind: 'type-only'`

#### Scenario: Regular import statement detected
- **WHEN** source file contains `import { User } from './types'`
- **THEN** parser detects `importClause.isTypeOnly === false`
- **AND** parser marks import as `importKind: 'value'`

#### Scenario: Mixed import declarations
- **WHEN** source file contains both `import type { User }` and `import { formatUser }`
- **THEN** each import declaration is processed independently
- **AND** first is marked `type-only`, second is marked `value`

#### Scenario: Import declaration without clause
- **WHEN** source file contains side-effect import `import './setup'`
- **THEN** parser marks as `importKind: 'value'` (default)
- **AND** no type-only semantics apply

### Requirement: ImportKind metadata field

The system SHALL add `importKind` field to parsed import information.

#### Scenario: ParsedImportInfo with importKind
- **WHEN** parser extracts import information
- **THEN** `ParsedImportInfo` includes `importKind: 'type-only' | 'value'`

#### Scenario: ImportKind in edge metadata
- **WHEN** parser generates IMPORTS edge
- **THEN** edge metadata includes `importKind` field

#### Scenario: Default importKind
- **WHEN** import is not a type-only import
- **THEN** `importKind` defaults to `'value'`

### Requirement: Type-only imports excluded from dependency score

The system SHALL exclude type-only imports from dependency score calculations in layer inference.

> **Note**: Type exclusion applies to `importsFrom` (outgoing imports) only. The `importedBy` count (incoming/reverse direction) still includes type-only importers because:
> - importedBy tracks who imports THIS module (reverse dependency)
> - importsFrom tracks what THIS module imports (forward dependency)
> - Dependency score is calculated from importsFrom, so excluding type imports there is correct
> - importedBy count is informational, not used in scoring

#### Scenario: Type-only imports not counted
- **WHEN** group has 5 value imports and 3 type-only imports
- **THEN** dependency score uses `importsFrom = 5` (only value imports)

#### Scenario: Type-only imports in importedBy
- **WHEN** file A has `import type { User }` from file B
- **THEN** file B's `importedBy` count still includes file A (reverse direction unchanged)

#### Scenario: Layer inference unaffected by type imports
- **WHEN** group only has type-only imports to higher layers
- **THEN** group's layer assignment is not penalized for these imports