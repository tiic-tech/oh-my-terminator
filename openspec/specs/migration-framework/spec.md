# migration-framework Specification

## Purpose
Defines the migration system for transforming CodeGraph baselines across schema versions, enabling safe upgrades without data loss.

## Requirements

### Requirement: MigrationScript interface defines transformation contract

The system SHALL define a `MigrationScript` interface with:
- `fromVersion`: string (supports 'x' wildcard for major/minor)
- `toVersion`: string
- `migrate`: function transforming Baseline to Baseline
- `description`: string

#### Scenario: Migration script structure
- **WHEN** a migration script is registered
- **THEN** it contains fromVersion, toVersion, migrate function, and description

### Requirement: registerMigration stores scripts in registry

The system SHALL implement `registerMigration(script: MigrationScript): void` that stores scripts keyed by `${fromVersion}->${toVersion}` in a global Map.

#### Scenario: Migration registered with key
- **WHEN** registerMigration is called with fromVersion="1.0.0", toVersion="1.1.0"
- **THEN** a script entry with key "1.0.0->1.1.0" exists in registry

#### Scenario: Wildcard version key stored
- **WHEN** registerMigration is called with fromVersion="1.x"
- **THEN** the key "1.x->1.1.0" exists in registry

### Requirement: versionMatchesPattern supports wildcard matching

The system SHALL implement `versionMatchesPattern(version: string, pattern: string): boolean` where 'x' in pattern matches any digit:
- "1.0.0" matches "1.0.0" (exact)
- "1.0.0" matches "1.x.0" (wildcard minor)
- "1.0.0" matches "1.0.x" (wildcard patch)
- "1.2.3" matches "1.x.x" (multiple wildcards)

#### Scenario: Exact version match
- **WHEN** versionMatchesPattern("1.0.0", "1.0.0") is called
- **THEN** it returns true

#### Scenario: Wildcard minor match
- **WHEN** versionMatchesPattern("1.5.0", "1.x.0") is called
- **THEN** it returns true

#### Scenario: Wildcard patch match
- **WHEN** versionMatchesPattern("1.0.9", "1.0.x") is called
- **THEN** it returns true

#### Scenario: Non-match returns false
- **WHEN** versionMatchesPattern("2.0.0", "1.x.x") is called
- **THEN** it returns false (major mismatch)

### Requirement: findMigrationPath uses BFS to find shortest path

The system SHALL implement `findMigrationPath(fromV: string, toV: string): MigrationScript[] | null` that:
1. Uses BFS from fromVersion
2. For each step, finds all registered migrations from current version
3. Uses versionMatchesPattern for wildcard matching
4. Returns shortest path or null if no path exists

#### Scenario: Direct migration path found
- **WHEN** findMigrationPath("1.0.0", "1.1.0") is called with direct script registered
- **THEN** it returns array of one script

#### Scenario: Multi-step path found
- **WHEN** findMigrationPath("1.0.0", "1.2.0") is called with scripts 1.0.0->1.1.0 and 1.1.0->1.2.0
- **THEN** it returns array of two scripts in order

#### Scenario: Wildcard path found
- **WHEN** findMigrationPath("1.0.0", "1.2.0") is called with script "1.x->1.2.0"
- **THEN** it returns array containing the wildcard script

#### Scenario: No path returns null
- **WHEN** findMigrationPath("1.0.0", "3.0.0") is called with no intermediate scripts
- **THEN** it returns null

### Requirement: migrateBaseline executes migration with atomicity

The system SHALL implement `migrateBaseline(baseline: Baseline, cwd: string): Promise<Baseline>` that:
1. Creates backup before migration
2. Executes each migration step in path
3. Updates schemaVersion after each step
4. Appends to migrationHistory
5. Saves migrated baseline atomically
6. On failure, restores backup

#### Scenario: Single-step migration executed
- **WHEN** migrateBaseline is called with baseline at 1.0.0 and target 1.1.0
- **THEN** the returned baseline has schemaVersion 1.1.0 and migrationHistory updated

#### Scenario: Multi-step migration executed
- **WHEN** migrateBaseline is called with baseline at 1.0.0 and target 1.2.0 (via 1.1.0)
- **THEN** both migrations are executed in sequence, migrationHistory has two entries

#### Scenario: Backup created before migration
- **WHEN** migrateBaseline is called
- **THEN** baseline.json.bak is created containing original baseline

#### Scenario: Migration failure restores backup
- **WHEN** a migration step throws an error
- **THEN** original baseline is restored from backup file

#### Scenario: No migration path triggers rebuild
- **WHEN** migrateBaseline is called with no registered path
- **THEN** analyzeFull is called and new baseline returned with strategy='rebuild' in migrationHistory

### Requirement: safeMigrateBaseline implements transactional migration

The system SHALL implement `safeMigrateBaseline(baseline: Baseline, cwd: string): Promise<Baseline>` as transactional wrapper:
1. Create backup
2. Try migrateBaseline
3. On success, optionally delete backup
4. On failure, restore backup and throw

#### Scenario: Successful migration completes
- **WHEN** safeMigrateBaseline succeeds
- **THEN** migrated baseline is saved and backup optionally removed

#### Scenario: Failed migration restores
- **WHEN** safeMigrateBaseline throws during migration
- **THEN** baseline.json is restored from .bak before throwing

### Requirement: MigrationRecord tracks migration history

The system SHALL define `MigrationRecord` interface with:
- `fromVersion`: string
- `toVersion`: string
- `migratedAt`: number (timestamp)
- `strategy`: 'migrate' | 'rebuild'
- `checksumBefore`: optional string (baseline hash before)
- `checksumAfter`: optional string (baseline hash after)

#### Scenario: Migration record created
- **WHEN** a migration is executed
- **THEN** a MigrationRecord is appended to baseline.migrationHistory

#### Scenario: Rebuild strategy recorded
- **WHEN** migration fails and rebuild is triggered
- **THEN** the record has strategy='rebuild'

### Requirement: Legacy to 1.0.0 migration script exists

The system SHALL register a default migration script from 'legacy' to '1.0.0' that:
- Adds schemaVersion: {major: 1, minor: 0, patch: 0}
- Adds generatorVersion: "1.0.0"
- Initializes migrationHistory with single record
- Preserves all existing graph data

#### Scenario: Legacy baseline migrated
- **WHEN** migrateBaseline is called with baseline without schemaVersion
- **THEN** the 'legacy->1.0.0' script is used and version is set to 1.0.0

### Requirement: Migration log tracks operations

The system SHALL optionally write migration log to `.codegraph/migration.log` (JSONL format) with entries containing:
- timestamp
- fromVersion
- toVersion
- strategy
- success
- durationMs
- errorMessage (if failed)

#### Scenario: Migration log entry created
- **WHEN** a migration is executed
- **THEN** a log entry is appended to migration.log

#### Scenario: Failed migration logged
- **WHEN** migration fails
- **THEN** log entry has success=false and errorMessage populated