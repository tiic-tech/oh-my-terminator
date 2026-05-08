# cli-analyze Specification

## Purpose
Defines the CLI analyze command that runs full repository analysis and saves baseline.

## Requirements

### Requirement: Edge case detection before analysis
The system SHALL run edge case detection before starting full analysis.

#### Scenario: Empty project CLI output
- **WHEN** user runs `codegraph analyze` in empty project
- **THEN** CLI outputs: "No source files found to analyze" and exits with code 0 (not error)
- **AND** suggestions displayed: "Check if project has .ts/.js/.vue files"

#### Scenario: Single-file project CLI output
- **WHEN** user runs `codegraph analyze` in single-file project
- **THEN** CLI outputs: "Analyzing single file: <filename>" with simplified stats
- **AND** no layer inference attempted (single file has no architecture)

#### Scenario: Test files filtered notification
- **WHEN** analysis pre-filters test files
- **THEN** CLI outputs: "Filtered X test files, analyzing Y source files"

#### Scenario: Normal project proceeds
- **WHEN** edge case detection returns `kind: 'normal'`
- **THEN** CLI proceeds with standard full analysis pipeline

#### Scenario: Test-only project CLI output
- **WHEN** user runs `codegraph analyze` in test-only project (no production source files)
- **THEN** CLI outputs: "Warning: Only test files found, treating as normal project"
- **AND** CLI proceeds with standard analysis (test files treated as source)

### Requirement: Edge case handling in JSON mode
The system SHALL return structured JSON for edge cases with `--json` flag.

#### Scenario: Empty project JSON output
- **WHEN** user runs `codegraph analyze --json` in empty project
- **THEN** output is `{ success: true, kind: 'empty', message: 'No source files found', suggestions: [...] }`

#### Scenario: Single-file JSON output
- **WHEN** user runs `codegraph analyze --json` in single-file project
- **THEN** output includes `{ success: true, kind: 'single-file', file: '<path>', externalDeps: [...] }`

#### Scenario: Test-only JSON output
- **WHEN** user runs `codegraph analyze --json` in test-only project
- **THEN** output includes `{ success: true, kind: 'test-only', warning: 'Only test files found', testFiles: [<paths>] }`

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

### Requirement: CLI analyze help includes examples
The system SHALL provide usage examples in analyze command help.

#### Scenario: Help shows usage examples
- **WHEN** user runs `codegraph analyze --help`
- **THEN** help output includes examples section with common usage patterns

#### Scenario: Examples show typical workflows
- **WHEN** user views analyze help examples
- **THEN** examples include: basic usage, custom directory, JSON output, no-compression