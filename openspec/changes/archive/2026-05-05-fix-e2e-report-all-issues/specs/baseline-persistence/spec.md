## MODIFIED Requirements

### Requirement: Structure validation checks required fields

The system SHALL implement `validateBaselineStructure(data: unknown): ValidationResult` that validates based on detected format:

For 1.0 format (has `graph.nodes`/`graph.edges`):
- Required fields: `graph`, `commitHash`, `timestamp`
- `graph.nodes` is array
- `graph.edges` is array
- `timestamp` is number
- `commitHash` is string
- Optional `schemaVersion` structure if present

For 1.1 format (has `pathTable`):
- Required fields: `pathTable`, `nodes`, `edges`, `commitHash`, `timestamp`
- `pathTable` is array of strings
- `nodes` is array
- `edges` is array
- `timestamp` is number
- `commitHash` is string
- `schemaVersion` with major/minor/patch numbers

#### Scenario: Missing required fields detected (1.0 format)
- **WHEN** validateBaselineStructure is called with 1.0 format missing `commitHash`
- **THEN** result.errors contains "Missing required field: commitHash"

#### Scenario: Invalid graph nodes detected (1.0 format)
- **WHEN** validateBaselineStructure is called with 1.0 format and `graph.nodes` as string
- **THEN** result.errors contains "graph.nodes must be an array"

#### Scenario: 1.1 format validation passes
- **WHEN** validateBaselineStructure is called with valid 1.1 format with `pathTable`, `nodes`, `edges`
- **THEN** result.valid is true and result.errors is empty

#### Scenario: Missing pathTable detected (1.1 format)
- **WHEN** validateBaselineStructure is called with 1.1 format missing `pathTable`
- **THEN** result.errors contains "Missing required field: pathTable"

## ADDED Requirements

### Requirement: Format-aware validation dispatch
The system SHALL detect baseline format before validation and dispatch to appropriate validator.

#### Scenario: 1.1 format uses compressed validator
- **WHEN** validateBaselineStructure receives data with `pathTable` array
- **THEN** system calls `validateCompressedBaselineStructure()` internally

#### Scenario: 1.0 format uses legacy validator
- **WHEN** validateBaselineStructure receives data with `graph.nodes`/`graph.edges`
- **THEN** system calls legacy validation logic for 1.0 format

### Requirement: Compressed baseline structure validator
The system SHALL implement `validateCompressedBaselineStructure(data: unknown): ValidationResult` for 1.1 format.

#### Scenario: Valid compressed baseline
- **WHEN** validateCompressedBaselineStructure is called with valid 1.1 data
- **THEN** result.valid is true with empty errors array

#### Scenario: Invalid nodes array
- **WHEN** validateCompressedBaselineStructure is called with `nodes` as object (not array)
- **THEN** result.errors contains "nodes must be an array"