# baseline-persistence Specification

## Purpose
Defines how CodeGraph analysis results are persisted to the filesystem, enabling incremental updates and version management.

## Requirements

### Requirement: Baseline directory structure follows convention

The system SHALL create and manage a `.codegraph/` directory at the project root with the following structure:
- `baseline.json`: Complete graph data with metadata
- `lastCommit.txt`: Git commit hash for version tracking
- `.version`: Optional file for quick version check

#### Scenario: Directory structure created on first analysis
- **WHEN** `analyzeFull()` completes for a project without existing baseline
- **THEN** a `.codegraph/` directory is created with `baseline.json` and `lastCommit.txt`

#### Scenario: Version file optionally created
- **WHEN** baseline is saved with `createVersionFile: true` option
- **THEN** a `.version` file is created containing schema and generator versions

### Requirement: Baseline interface contains complete metadata

The system SHALL define a `Baseline` interface with the following required fields:
- `graph`: SerializedCodeGraph
- `commitHash`: string
- `timestamp`: number
- `schemaVersion`: SchemaVersion
- `generatorVersion`: string
- `architectureConstraints`: string[]
- `healthScore`: number
- `skillDemand`: SkillDemand

And optional fields:
- `migrationHistory`: MigrationRecord[]
- `deprecated`: boolean

#### Scenario: Baseline contains all required metadata
- **WHEN** a baseline is created from analysis results
- **THEN** it includes graph, commitHash, timestamp, schemaVersion, generatorVersion, architectureConstraints, healthScore, and skillDemand

#### Scenario: Migration history is optional
- **WHEN** a baseline is created fresh (not migrated)
- **THEN** migrationHistory is undefined or empty

### Requirement: saveBaseline uses atomic write strategy

The system SHALL implement `saveBaseline(baseline: Baseline, cwd: string, options?: SaveBaselineOptions)` that writes baseline to disk using atomic operations:
1. Write to temporary file (`.tmp` suffix)
2. Rename temp file to final location (POSIX atomic operation)
3. Optionally create backup before write

#### Scenario: Atomic write prevents partial corruption
- **WHEN** saveBaseline is called and disk becomes full during write
- **THEN** the original baseline.json remains intact (temp file write failed)

#### Scenario: Backup created before migration
- **WHEN** saveBaseline is called with `createBackup: true`
- **THEN** a `.bak` file is created before writing new baseline

#### Scenario: File permissions inherited or defaulted
- **WHEN** saveBaseline writes a new baseline
- **THEN** file permissions are inherited from existing or default to 0644

### Requirement: loadBaseline handles all failure scenarios

The system SHALL implement `loadBaseline(cwd: string, options?: LoadBaselineOptions)` that handles six failure scenarios:
- `file_not_found`: No baseline exists
- `parse_error`: JSON parsing failed
- `invalid_structure`: Structure validation failed
- `corrupted_data`: Data integrity check failed
- `schema_incompatible`: Version incompatible
- `permission_error`: File permission denied

#### Scenario: File not found triggers rebuild
- **WHEN** loadBaseline is called and baseline.json does not exist
- **THEN** the result includes `executedAction: 'rebuild'` with a new graph

#### Scenario: Parse error returns failure
- **WHEN** loadBaseline is called and baseline.json contains invalid JSON
- **THEN** the result includes `success: false` with `failure.reason: 'parse_error'`

#### Scenario: Invalid structure triggers rebuild (non-strict mode)
- **WHEN** loadBaseline is called with invalid structure and `strict: false`
- **THEN** the result includes `executedAction: 'rebuild'`

#### Scenario: Invalid structure returns failure (strict mode)
- **WHEN** loadBaseline is called with invalid structure and `strict: true`
- **THEN** the result includes `success: false` with `failure.reason: 'invalid_structure'`

### Requirement: Dependency injection for rebuild handler

The system SHALL support `rebuildHandler` option in `LoadBaselineOptions` for dependency injection, allowing CLI layer to inject custom analysis handlers with progress reporting.

#### Scenario: Default rebuild handler uses analyzeFull
- **WHEN** loadBaseline triggers rebuild and no custom rebuildHandler is provided
- **THEN** `analyzeFull()` is called to generate new graph

#### Scenario: Custom rebuild handler is invoked
- **WHEN** loadBaseline triggers rebuild and custom `rebuildHandler` is provided
- **THEN** the custom handler is called instead of analyzeFull

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

### Requirement: Data integrity verification checks consistency

The system SHALL implement `verifyDataIntegrity(baseline: Baseline): IntegrityResult` that checks:
- Node IDs are unique
- Node.id matches stored ID
- Edge references exist in nodes
- Timestamp is not in future (with 60s tolerance)
- commitHash format is valid (7-40 hex chars)

#### Scenario: Duplicate node IDs detected
- **WHEN** verifyDataIntegrity is called with duplicate node ID "FILE:a.ts"
- **THEN** result.errors contains "Duplicate node ID: FILE:a.ts"

#### Scenario: Edge references missing node
- **WHEN** verifyDataIntegrity is called with edge referencing non-existent node "FILE:b.ts"
- **THEN** result.errors contains "Edge references missing target node: FILE:b.ts"

#### Scenario: Future timestamp detected
- **WHEN** verifyDataIntegrity is called with timestamp more than 60 seconds in future
- **THEN** result.errors contains "Timestamp is in the future"

### Requirement: SkillDemand interface matches Blueprint definition

The system SHALL define `SkillDemand` interface matching Blueprint Section 3.4:
- `testWriter`: number (0-1 demand level)
- `refactorSpecialist`: number
- `architect`: number
- `securityReviewer`: number

#### Scenario: SkillDemand fields are numeric
- **WHEN** a SkillDemand object is created
- **THEN** all fields are numbers between 0 and 1

### Requirement: Serialization writes compressed format
The `saveBaseline()` function SHALL support compression mode.
When compression enabled, output SHALL use 1.1 schema format.
When compression disabled, output SHALL use 1.0 schema format.

#### Scenario: Save with compression
- **WHEN** `saveBaseline(graph, { compress: true })` is called
- **THEN** output file SHALL contain `schemaVersion: "1.1"`
- **THEN** nodes SHALL NOT have `id` fields
- **THEN** `pathTable` SHALL be present

#### Scenario: Save without compression
- **WHEN** `saveBaseline(graph, { compress: false })` is called
- **THEN** output file SHALL NOT contain `schemaVersion`
- **THEN** nodes SHALL have `id` fields
- **THEN** `pathTable` SHALL NOT be present

### Requirement: Deserialization handles both formats
The `loadBaseline()` function SHALL detect schema version.
Schema 1.0 SHALL be migrated to internal representation.
Schema 1.1 SHALL be decompressed to internal representation.

#### Scenario: Load 1.1 baseline
- **WHEN** baseline contains `schemaVersion: "1.1"`
- **THEN** path indexes SHALL be resolved to full paths
- **THEN** IMPORTS_BATCH SHALL be expanded to individual edges
- **THEN** internal graph SHALL match original uncompressed structure

#### Scenario: Load 1.0 baseline
- **WHEN** baseline lacks `schemaVersion` field
- **THEN** data SHALL be loaded directly without decompression
- **THEN** internal graph SHALL match baseline structure

### Requirement: Internal graph representation unchanged
Compression SHALL be transparent to Graph API.
All graph methods (getNodes, getEdges, getNeighbors) SHALL work identically.

#### Scenario: API compatibility after decompression
- **WHEN** a compressed baseline is loaded
- **THEN** `graph.getNodeById("FILE:src/analyzer.ts")` SHALL return the node
- **THEN** `graph.getEdges()` SHALL return expanded edge objects with `id` fields
- **THEN** API consumers SHALL NOT detect compression occurred