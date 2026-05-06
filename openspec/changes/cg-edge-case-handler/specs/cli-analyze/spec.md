# CLI Analyze Specification Delta

## Purpose

Updates CLI analyze specification to integrate edge case detection before analysis.

## ADDED Requirements

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