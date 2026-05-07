# scope-query

## Purpose

Scope query API for FILE, MODULE, and EXTERNAL nodes - returns complete context information including exports, imports, importedBy, test file association, complexity aggregation, and deprecated status.

Provides Agent-friendly Markdown output for AI-driven development workflows.

## Requirements

### Requirement: Scope query accepts multiple target types

The system SHALL accept FILE, MODULE, EXTERNAL node IDs and plain file paths as input targets for scope queries.

#### Scenario: FILE node query
- **WHEN** user queries `getScope("FILE:src/utils/format.ts")`
- **THEN** system returns exports, imports, importedBy, testFile, complexity, deprecated for that file

#### Scenario: MODULE node query
- **WHEN** user queries `getScope("MODULE:src/utils/format.ts#formatDate")`
- **THEN** system resolves to parent file and returns MODULE-specific details (kind, jsDoc truncated)

#### Scenario: EXTERNAL node query
- **WHEN** user queries `getScope("EXTERNAL:lodash")`
- **THEN** system returns package name and importedBy list (no exports/imports)

#### Scenario: Plain path query
- **WHEN** user queries `getScope("src/utils/format.ts")`
- **THEN** system auto-prefixes FILE: and returns file scope

### Requirement: Scope query returns export list

The system SHALL extract and return all export symbols for FILE targets, formatted as "kind:name".

#### Scenario: Multiple exports
- **WHEN** file has exports `{ formatDate, formatNumber, DATE_FORMAT }`
- **THEN** system returns `["function:formatDate", "function:formatNumber", "variable:DATE_FORMAT"]`

#### Scenario: Default export
- **WHEN** file has default export
- **THEN** system returns `"default:ExportName"` in exports list

#### Scenario: No exports
- **WHEN** file has no exports
- **THEN** system returns empty array `[]`

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

### Requirement: Scope query returns importedBy list excluding dynamic imports

The system SHALL extract reverse dependencies from inEdges but MUST NOT include DYNAMIC_IMPORTS edges (A2 resolution).

#### Scenario: Static importers
- **WHEN** file A statically imports file B
- **THEN** B's importedBy list includes A

#### Scenario: Dynamic importers excluded
- **WHEN** file A dynamically imports file B
- **THEN** B's importedBy list MUST NOT include A

#### Scenario: Isolated file
- **WHEN** file has no importers
- **THEN** importedBy returns empty array and Markdown shows "none (isolated)"

### Requirement: Scope query returns test file association

The system SHALL find associated test files using metadata.testFile or naming convention fallback.

#### Scenario: Metadata test file
- **WHEN** MODULE node has `metadata.testFile = "src/__tests__/utils.test.ts"`
- **THEN** system returns that path

#### Scenario: Naming convention match
- **WHEN** no metadata.testFile but `src/__tests__/format.test.ts` exists in graph
- **THEN** system returns that path via convention matching

#### Scenario: No test file
- **WHEN** no test file found
- **THEN** system returns `null`

### Requirement: Scope query returns complexity aggregation

The system SHALL aggregate complexity from MODULE nodes. When no MODULE data exists, MUST return "unknown" (A6 resolution).

#### Scenario: FILE complexity aggregation
- **WHEN** file has MODULE nodes with complexity values 3, 5, 7
- **THEN** system returns `{ level: "medium", value: 15 }`

#### Scenario: MODULE complexity direct
- **WHEN** MODULE node has `metadata.complexity = 8`
- **THEN** system returns `{ level: "medium", value: 8 }`

#### Scenario: No MODULE data
- **WHEN** file has no MODULE nodes or no complexity metadata
- **THEN** system returns `{ level: "unknown", value: 0 }`

### Requirement: Scope query returns deprecated status

The system SHALL detect deprecated status by checking MODULE nodes for `metadata.deprecated`.

#### Scenario: Deprecated export
- **WHEN** any MODULE node in file has `metadata.deprecated = true`
- **THEN** system returns `deprecated: true`

#### Scenario: No deprecated exports
- **WHEN** no MODULE nodes are deprecated
- **THEN** system returns `deprecated: false`

### Requirement: Scope query handles target not found

The system SHALL return structured error when target node does not exist.

#### Scenario: FILE not found
- **WHEN** user queries `getScope("FILE:src/nonexistent.ts")`
- **THEN** system returns `{ content: "## Scope Error\n- Target not found: FILE:src/nonexistent.ts", exports: [], ... }`

#### Scenario: MODULE not found
- **WHEN** user queries `getScope("MODULE:src/utils.ts#nonexistentExport")`
- **THEN** system returns warning message with tip to check export name (A5 resolution)

### Requirement: Scope query generates Agent-friendly Markdown

The system SHALL generate compressed Markdown output targeting ≤600 tokens.

#### Scenario: FILE Markdown format
- **WHEN** scope query succeeds for FILE target
- **THEN** output follows template with `## Scope: <path>` header, Exports, Imports, Imported by, Metadata sections

#### Scenario: MODULE Markdown format
- **WHEN** scope query succeeds for MODULE target
- **THEN** output follows template with `## Scope: <name> (<path>)` header, Kind, JSDoc truncated, Imported by sections

#### Scenario: EXTERNAL Markdown format
- **WHEN** scope query succeeds for EXTERNAL target
- **THEN** output shows package name, Imported by count, note about external package

### Requirement: Scope query returns CLI-compatible JSON structure

The system SHALL return data in a format that maps to CLI JSON output (C10 integration).

#### Scenario: ScopeResult structure
- **WHEN** scope query returns
- **THEN** result includes `success`, `target`, `exports[]`, `imports[]`, `importedBy[]`, `testFile`, `complexity`, `metadata`, `durationMs`, `nextSuggested`

#### Scenario: Export ID format
- **WHEN** exports are returned
- **THEN** each export has `id` in format `MODULE:<path>#<name>`

#### Scenario: Error structure
- **WHEN** target not found
- **THEN** returns `success: false`, `error.code = "E001_TARGET_NOT_FOUND"`, `error.suggestion`## MODIFIED Requirements

### Requirement: Scope query returns complexity aggregation

The system SHALL aggregate complexity from MODULE nodes. When MODULE nodes have complexity metadata, MUST return calculated values instead of "unknown".

#### Scenario: FILE complexity aggregation
- **WHEN** file has MODULE nodes with complexity values 3, 5, 7
- **THEN** system returns `{ level: "medium", value: 15 }`
- **AND** level is derived from total value using threshold rules

#### Scenario: MODULE complexity direct
- **WHEN** MODULE node has `metadata.complexity = { level: "medium", value: 8 }`
- **THEN** system returns `{ level: "medium", value: 8 }`

#### Scenario: No MODULE data
- **WHEN** file has no MODULE nodes or no complexity metadata
- **THEN** system returns `{ level: "unknown", value: 0 }`

#### Scenario: Mixed MODULE complexity levels
- **WHEN** file has MODULE nodes with levels ["low", "medium", "high"]
- **THEN** system aggregates values and derives file-level level from total
- **AND** does NOT average or max individual levels

#### Scenario: Complexity threshold application for file aggregation
- **WHEN** file-level total complexity is calculated
- **THEN** system applies threshold rules: 1-5 = "low", 6-15 = "medium", 16-25 = "high", >=26 = "critical"

#### Scenario: File with only class MODULE nodes
- **WHEN** file has MODULE nodes with kind='class' only (no functions)
- **THEN** system returns `{ level: "unknown", value: 0 }` (classes have no complexity)

#### Scenario: File with mixed MODULE kinds
- **WHEN** file has MODULE nodes: class (no complexity), function (complexity=8), variable (no complexity)
- **THEN** system aggregates only function complexity
- **AND** returns `{ level: "medium", value: 8 }`

#### Scenario: Threshold boundary validation
- **WHEN** file-level total is exactly 5
- **THEN** level = "low" (upper boundary)
- **WHEN** file-level total is exactly 6
- **THEN** level = "medium" (lower boundary)
- **WHEN** file-level total is exactly 15
- **THEN** level = "medium" (upper boundary)
- **WHEN** file-level total is exactly 16
- **THEN** level = "high" (lower boundary)