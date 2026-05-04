# cli-analyze Specification

## Purpose
Defines the CLI analyze command that runs full repository analysis and saves baseline.

## Requirements

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

### Requirement: CLI analyze JSON output
The system SHALL support `--json` flag for structured analyze output.

#### Scenario: JSON output format
- **WHEN** user runs `codegraph analyze --json`
- **THEN** system outputs JSON with `success`, `stats`, `baseline`, `durationMs`, `warnings`, `nextSuggested` fields to stdout

#### Scenario: JSON error output
- **WHEN** analysis fails and `--json` flag is set
- **THEN** system outputs JSON with `success: false` and `error` object to stdout (not stderr)

### Requirement: CLI analyze text output
The system SHALL provide human-readable text output as default.

#### Scenario: Text output format
- **WHEN** user runs `codegraph analyze` without `--json`
- **THEN** system outputs summary with files scanned, modules extracted, edges created, baseline path, duration

#### Scenario: Text output with warnings
- **WHEN** analysis encounters parse errors
- **THEN** text output includes warning section listing failed files and reasons