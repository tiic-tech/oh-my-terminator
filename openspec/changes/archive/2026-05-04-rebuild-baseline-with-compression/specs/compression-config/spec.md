## ADDED Requirements

### Requirement: Configuration file defines compression settings
The system SHALL read compression configuration from `.codegraph/config.json`.
The configuration SHALL support `jsDocMaxLength` setting (default: 100).
Missing configuration SHALL use default values.

#### Scenario: Config file present
- **WHEN** `.codegraph/config.json` exists with `{"compression": {"jsDocMaxLength": 50}}`
- **THEN** JSDoc SHALL be truncated to 50 characters

#### Scenario: Config file missing
- **WHEN** `.codegraph/config.json` does not exist
- **THEN** default `jsDocMaxLength: 100` SHALL be used

#### Scenario: Partial configuration
- **WHEN** `.codegraph/config.json` contains `{"compression": {}}` (empty object)
- **THEN** all default values SHALL be used

### Requirement: Compression toggle enables/disables optimization
The system SHALL support `--compress` CLI flag to enable compression.
The system SHALL support `--no-compression` CLI flag to disable compression.
Default behavior SHALL enable compression for new baselines.

#### Scenario: Explicit compress flag
- **WHEN** user runs `cg analyze --compress`
- **THEN** baseline SHALL be saved in compressed 1.1 format

#### Scenario: Explicit no-compression flag
- **WHEN** user runs `cg analyze --no-compression`
- **THEN** baseline SHALL be saved in uncompressed 1.0 format

#### Scenario: Default behavior
- **WHEN** user runs `cg analyze` without compression flags
- **THEN** baseline SHALL be saved in compressed 1.1 format

### Requirement: Invalid config values rejected with error
The system SHALL validate configuration values.
Invalid `jsDocMaxLength` (negative, zero, non-integer) SHALL produce error.

#### Scenario: Negative jsDocMaxLength
- **WHEN** config contains `{"compression": {"jsDocMaxLength": -10}}`
- **THEN** CLI SHALL exit with error code E_INVALID_CONFIG
- **THEN** error message SHALL explain valid range

#### Scenario: Non-integer jsDocMaxLength
- **WHEN** config contains `{"compression": {"jsDocMaxLength": 50.5}}`
- **THEN** CLI SHALL exit with error E_INVALID_CONFIG
- **THEN** error message SHALL require integer value