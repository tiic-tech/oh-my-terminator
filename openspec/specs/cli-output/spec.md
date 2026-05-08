# cli-output Specification

## Purpose
Defines CLI output formatters for JSON and text output formats.

## Requirements

### Requirement: JSON output formatter
The system SHALL provide a JSON output formatter that produces schema-compliant output.

#### Scenario: JSON format compliance
- **WHEN** JSON formatter is invoked with result data
- **THEN** output conforms to defined TypeScript interfaces (AnalyzeResult, UpdateResult, CliError)

#### Scenario: JSON with stats
- **WHEN** analyze/update completes
- **THEN** JSON includes `durationMs` and appropriate stats fields

#### Scenario: JSON error structure
- **WHEN** command fails
- **THEN** JSON formatter outputs `{ success: false, error: { code, message }, durationMs }`

### Requirement: Text output formatter
The system SHALL provide a text output formatter for human-readable output.

#### Scenario: Text analyze output
- **WHEN** analyze completes successfully
- **THEN** text output shows: success indicator, files scanned, modules extracted, edges count, baseline path, duration

#### Scenario: Text update output
- **WHEN** update completes with changes
- **THEN** text output shows: files added/modified/removed, new nodes count, duration

#### Scenario: Text with warnings section
- **WHEN** operation has warnings
- **THEN** text output includes "Warnings:" section with bullet list

#### Scenario: Text with next steps
- **WHEN** analyze completes
- **THEN** text output includes "Next suggested:" section with command suggestions

### Requirement: Output selection by flag
The system SHALL select output format based on `--json` flag.

#### Scenario: Default text output
- **WHEN** no `--json` flag
- **THEN** system uses text formatter

#### Scenario: JSON when flag set
- **WHEN** `--json` flag is present
- **THEN** system uses JSON formatter, outputs to stdout