# scope-query Specification Delta

## Purpose

Extends scope query to display import kind (type-only vs value) information.

## MODIFIED Requirements

### Requirement: Scope query returns import list with type markers

The system SHALL extract all imports from outEdges including IMPORTS, RE_EXPORTS, and DYNAMIC_IMPORTS edges, with importKind metadata.

#### Scenario: Static imports
- **WHEN** file has `import { x } from './utils'`
- **THEN** system returns `"./utils"` in imports list with IMPORTS type
- **AND** import has `kind: 'value'`

#### Scenario: Type-only imports
- **WHEN** file has `import type { User } from './types'`
- **THEN** system returns `"./types"` in imports list with IMPORTS type
- **AND** import has `kind: 'type-only'`

#### Scenario: Mixed imports from same module
- **WHEN** file has both `import type { User }` and `import { formatUser }` from `'./types'`
- **THEN** system returns `"./types"` in imports list twice
- **AND** first entry has `kind: 'type-only'`, second has `kind: 'value'`

#### Scenario: Dynamic imports
- **WHEN** file has `import('./utils')`
- **THEN** system returns `"./utils"` in imports list with DYNAMIC_IMPORTS type
- **AND** dynamic imports always have `kind: 'value'` (no type-only concept)

#### Scenario: External imports
- **WHEN** file imports from `lodash`
- **THEN** system returns `"lodash"` in imports list (EXTERNAL reference)
- **AND** import has `kind: 'value'` (external imports are always value imports)

#### Scenario: ImportInfo interface with kind field
- **WHEN** import is returned in imports list
- **THEN** ImportInfo interface includes `kind: ImportKind` field
- **AND** kind field is required (not optional)
- **AND** kind defaults to 'value' for non-type imports (backward compatibility)