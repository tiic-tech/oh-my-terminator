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

The system SHALL implement `validateBaselineStructure(data: unknown): ValidationResult` that validates:
- Required fields: `graph`, `commitHash`, `timestamp`
- `graph.nodes` is array
- `graph.edges` is array
- `timestamp` is number
- `commitHash` is string
- Optional `schemaVersion` structure if present

#### Scenario: Missing required fields detected
- **WHEN** validateBaselineStructure is called with object missing `commitHash`
- **THEN** result.errors contains "Missing required field: commitHash"

#### Scenario: Invalid graph nodes detected
- **WHEN** validateBaselineStructure is called with `graph.nodes` as string
- **THEN** result.errors contains "graph.nodes must be an array"

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