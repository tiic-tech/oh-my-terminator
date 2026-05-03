# version-compatibility Specification

## Purpose
Defines schema version management and compatibility checking for CodeGraph baselines, enabling safe upgrades and migration decisions.

## ADDED Requirements

### Requirement: SchemaVersion follows semantic versioning

The system SHALL define a `SchemaVersion` interface with three numeric fields:
- `major`: number (breaking changes)
- `minor`: number (backward-compatible features)
- `patch`: number (backward-compatible fixes)

And implement methods:
- `toString(): string` returning "major.minor.patch"
- `parse(versionStr: string): SchemaVersion` static method
- `isGreaterThan(other: SchemaVersion): boolean`
- `isCompatibleWith(other: SchemaVersion): boolean` (major match)

#### Scenario: Version string parsing
- **WHEN** SchemaVersion.parse("1.2.3") is called
- **THEN** the result has major=1, minor=2, patch=3

#### Scenario: Invalid version format rejected
- **WHEN** SchemaVersion.parse("1.2") is called
- **THEN** an Error is thrown with message containing "Invalid version format"

#### Scenario: Version string output
- **WHEN** a SchemaVersion {major: 1, minor: 0, patch: 0} calls toString()
- **THEN** it returns "1.0.0"

#### Scenario: Greater than comparison
- **WHEN** SchemaVersion(1, 1, 0).isGreaterThan(SchemaVersion(1, 0, 0)) is called
- **THEN** it returns true

#### Scenario: Compatible with same major
- **WHEN** SchemaVersion(1, 2, 0).isCompatibleWith(SchemaVersion(1, 0, 5)) is called
- **THEN** it returns true (same major)

#### Scenario: Incompatible with different major
- **WHEN** SchemaVersion(2, 0, 0).isCompatibleWith(SchemaVersion(1, 0, 0)) is called
- **THEN** it returns false (different major)

### Requirement: Version string validation is strict

The system SHALL validate version strings in SchemaVersion.parse:
- Exactly three parts separated by dots
- Each part is non-negative integer
- Each part contains only digits

#### Scenario: Negative number rejected
- **WHEN** SchemaVersion.parse("-1.0.0") is called
- **THEN** an Error is thrown

#### Scenario: Non-numeric rejected
- **WHEN** SchemaVersion.parse("1.a.0") is called
- **THEN** an Error is thrown

### Requirement: checkSchemaCompatibility returns detailed result

The system SHALL implement `checkSchemaCompatibility(baseline: Baseline, currentVersion: SchemaVersion): CompatibilityResult` returning:
- `compatible`: boolean
- `reason`: CompatibilityReason enum value
- `action`: CompatibilityAction recommendation
- `message`: human-readable description
- `details`: optional version strings

#### Scenario: Legacy baseline detected
- **WHEN** checkSchemaCompatibility is called with baseline without schemaVersion
- **THEN** result.compatible is false, result.reason is 'legacy_baseline', result.action is 'rebuild'

#### Scenario: Major version mismatch (baseline higher)
- **WHEN** checkSchemaCompatibility is called with baseline schemaVersion 2.0.0 and current 1.0.0
- **THEN** result.compatible is false, result.reason is 'major_version_mismatch', result.action is 'error'

#### Scenario: Major version mismatch (baseline lower)
- **WHEN** checkSchemaCompatibility is called with baseline schemaVersion 0.9.0 and current 1.0.0
- **THEN** result.compatible is false, result.reason is 'major_version_mismatch', result.action is 'migrate'

#### Scenario: Minor version outdated
- **WHEN** checkSchemaCompatibility is called with baseline schemaVersion 1.0.0 and current 1.1.0
- **THEN** result.compatible is true, result.reason is 'minor_version_old', result.action is 'migrate'

#### Scenario: Patch version outdated
- **WHEN** checkSchemaCompatibility is called with baseline schemaVersion 1.0.0 and current 1.0.1
- **THEN** result.compatible is true, result.reason is 'patch_version_old', result.action is 'proceed'

#### Scenario: Version match
- **WHEN** checkSchemaCompatibility is called with matching versions
- **THEN** result.compatible is true, result.reason is 'version_match', result.action is 'proceed'

### Requirement: determineAction selects strategy based on reason

The system SHALL implement `determineAction(result: CompatibilityResult, config?: ActionConfig): CompatibilityAction` following the strategy matrix:
- `legacy_baseline` → rebuild
- `major_version_mismatch` (baseline > current) → error
- `major_version_mismatch` (baseline < current) → migrate
- `minor_version_old` → migrate if autoMigrate, else proceed
- `patch_version_old` → proceed
- `version_match` → proceed

#### Scenario: AutoMigrate affects minor version decision
- **WHEN** determineAction is called for 'minor_version_old' with `autoMigrate: true`
- **THEN** it returns 'migrate'

#### Scenario: AutoMigrate disabled proceeds with minor
- **WHEN** determineAction is called for 'minor_version_old' with `autoMigrate: false`
- **THEN** it returns 'proceed'

#### Scenario: ForceAction overrides default
- **WHEN** determineAction is called with `forceAction: 'rebuild'`
- **THEN** it returns 'rebuild' regardless of reason

### Requirement: CompatibilityAction enum defines four strategies

The system SHALL define `CompatibilityAction` type with four values:
- 'error': Report error, terminate operation
- 'rebuild': Execute full re-analysis
- 'migrate': Execute migration script
- 'proceed': Use baseline directly

#### Scenario: Error action terminates
- **WHEN** executeAction receives 'error'
- **THEN** IncompatibleBaselineError is thrown

#### Scenario: Rebuild action calls analyzeFull
- **WHEN** executeAction receives 'rebuild' and user confirms
- **THEN** analyzeFull(cwd) is called and new graph returned

#### Scenario: Migrate action transforms baseline
- **WHEN** executeAction receives 'migrate' with valid baseline
- **THEN** migrateBaseline is called and transformed graph returned

#### Scenario: Proceed action uses baseline directly
- **WHEN** executeAction receives 'proceed' with valid baseline
- **THEN** baseline.graph is returned without modification

### Requirement: Version constants defined at module level

The system SHALL export two constants:
- `CURRENT_SCHEMA_VERSION`: SchemaVersion(1, 0, 0)
- `GENERATOR_VERSION`: "1.0.0"

#### Scenario: Current version is SemVer 1.0.0
- **WHEN** CURRENT_SCHEMA_VERSION is referenced
- **THEN** it equals SchemaVersion with major=1, minor=0, patch=0

### Requirement: LEGACY_VERSION constant defined

The system SHALL define `LEGACY_VERSION = 'legacy'` constant for baseline without schemaVersion.

#### Scenario: Legacy version constant usage
- **WHEN** code references baseline without schemaVersion
- **THEN** LEGACY_VERSION constant is used instead of magic string 'legacy'