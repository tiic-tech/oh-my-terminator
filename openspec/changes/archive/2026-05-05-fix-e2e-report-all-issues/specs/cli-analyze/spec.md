## MODIFIED Requirements

### Requirement: CLI analyze command execution
The system SHALL provide a `codegraph analyze` command that runs full repository analysis and saves baseline.

#### Scenario: Successful full analysis
- **WHEN** user runs `codegraph analyze` in a project directory
- **THEN** system scans all supported files, extracts MODULE nodes and edges, saves baseline to `.codegraph/baseline.json`

#### Scenario: Analysis with custom directory
- **WHEN** user runs `codegraph analyze /path/to/project`
- **THEN** system analyzes the specified directory instead of current working directory

#### Scenario: Analysis saves commit hash
- **WHEN** analysis completes successfully
- **THEN** system writes current git HEAD commit hash to `.codegraph/lastCommit.txt`

### Requirement: CLI analyze compression options
The system SHALL provide clear compression flag options without contradictory descriptions.

#### Scenario: Default compression behavior
- **WHEN** user runs `codegraph analyze` without compression flags
- **THEN** baseline is saved in compressed 1.1 format by default

#### Scenario: Explicit compress flag
- **WHEN** user runs `codegraph analyze --compress`
- **THEN** baseline is saved in compressed 1.1 format
- **AND** help shows "Enable compression (default behavior)" without default annotation

#### Scenario: No-compression flag
- **WHEN** user runs `codegraph analyze --no-compression`
- **THEN** baseline is saved in uncompressed 1.0 format
- **AND** help shows "Save as uncompressed 1.0 format" without default annotation

## ADDED Requirements

### Requirement: CLI analyze help includes examples
The system SHALL provide usage examples in analyze command help.

#### Scenario: Help shows usage examples
- **WHEN** user runs `codegraph analyze --help`
- **THEN** help output includes examples section with common usage patterns

#### Scenario: Examples show typical workflows
- **WHEN** user views analyze help examples
- **THEN** examples include: basic usage, custom directory, JSON output, no-compression