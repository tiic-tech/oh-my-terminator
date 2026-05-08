# cli-output-routing Specification

## Purpose
Defines how CLI commands route output to stdout and stderr streams based on output mode.

## ADDED Requirements

### Requirement: JSON mode stream separation
The system SHALL route JSON output and diagnostic messages to separate streams in `--json` mode.

#### Scenario: JSON results to stdout
- **WHEN** command runs with `--json` flag and succeeds
- **THEN** JSON payload is written to stdout via `process.stdout.write()`

#### Scenario: JSON warnings to stderr
- **WHEN** command runs with `--json` flag and produces warnings
- **THEN** warning messages are written to stderr via `console.error()`

#### Scenario: JSON errors to stderr
- **WHEN** command runs with `--json` flag and fails
- **THEN** JSON error object is written to stdout AND diagnostic message to stderr

#### Scenario: Clean JSON piping
- **WHEN** user pipes `--json` output to another tool (e.g., `jq`)
- **THEN** stdout contains only valid JSON, no mixed content

### Requirement: Text mode stream separation
The system SHALL route text output with appropriate stream separation in default mode.

#### Scenario: Text results to stdout
- **WHEN** command runs without `--json` flag
- **THEN** formatted text output is written to stdout

#### Scenario: Text warnings to stderr
- **WHEN** command runs without `--json` flag and produces warnings
- **THEN** warning messages are written to stderr

#### Scenario: Progress indicators to stderr
- **WHEN** command shows progress during operation
- **THEN** progress messages are written to stderr (not stdout)

### Requirement: OutputResult interface
The system SHALL provide an `OutputResult` interface for formatter-to-command communication.

#### Scenario: Primary output field
- **WHEN** formatter produces output
- **THEN** `OutputResult.primary` contains the main content for stdout

#### Scenario: Warnings field
- **WHEN** formatter detects warnings during operation
- **THEN** `OutputResult.warnings` contains array of warning strings for stderr

#### Scenario: Errors field
- **WHEN** formatter handles error conditions
- **THEN** `OutputResult.errors` contains array of error strings for stderr

### Requirement: Command routing implementation
The system SHALL implement stream routing in CLI commands, not in formatters.

#### Scenario: Command handles routing
- **WHEN** CLI command receives formatter output
- **THEN** command inspects `OutputResult` and routes to appropriate streams

#### Scenario: Formatter returns not writes
- **WHEN** formatter is invoked
- **THEN** formatter returns `OutputResult` object instead of writing to streams directly

### Requirement: JSON formatter behavior
The system SHALL ensure JSON formatter returns structured OutputResult.

#### Scenario: JSON formatter returns OutputResult
- **WHEN** `json-formatter.ts` processes data
- **THEN** formatter returns `OutputResult` object with:
  - `primary`: JSON string (validated as valid JSON)
  - `warnings`: array of warning strings (optional)
  - `errors`: array of error strings (optional)

#### Scenario: JSON formatter does NOT write to streams
- **WHEN** `json-formatter.ts` is invoked
- **THEN** formatter does NOT call `process.stdout.write()` or `console.error()`
- **AND** formatter does NOT directly interact with any stream

### Requirement: Text formatter behavior
The system SHALL ensure text formatter returns structured OutputResult with warnings handling.

#### Scenario: Text formatter returns OutputResult
- **WHEN** `text-formatter.ts` processes data
- **THEN** formatter returns `OutputResult` object with:
  - `primary`: formatted text string for stdout
  - `warnings`: array of warning strings for stderr (optional)
  - `errors`: array of error strings for stderr (optional)

#### Scenario: Text formatter warnings handling
- **WHEN** warnings are generated during text formatting
- **THEN** warnings are collected into `OutputResult.warnings` array
- **AND** warnings are NOT included in `primary` content
- **AND** warnings are NOT suppressed

### Requirement: OutputRouter stream routing
The system SHALL provide OutputRouter utility for consistent stream routing.

#### Scenario: JSON mode stdout purity
- **WHEN** `routeOutput()` is called with `OutputMode.JSON`
- **THEN** stdout receives ONLY `primary` content (pure JSON)
- **AND** stderr receives warnings and errors (if present)

#### Scenario: Text mode stdout/stderr separation
- **WHEN** `routeOutput()` is called with `OutputMode.TEXT`
- **THEN** stdout receives `primary` content (formatted text)
- **AND** stderr receives warnings and errors (if present)

#### Scenario: Silent mode stderr only
- **WHEN** `routeOutput()` is called with `OutputMode.SILENT`
- **THEN** stdout receives NO output
- **AND** stderr receives ONLY errors (warnings suppressed)

## Testing Requirements

### Requirement: E2E test assertions
The system SHALL verify stream separation through specific E2E test assertions.

#### Scenario: JSON stdout purity assertion
- **WHEN** E2E test runs command with `--json` flag
- **THEN** test assertion verifies:
  - stdout content IS valid JSON (parseable by `JSON.parse()`)
  - stdout content contains NO warning/error text
  - stderr content MAY contain warnings/errors
  - stderr content does NOT affect stdout purity

#### Scenario: JSON piping to jq assertion
- **WHEN** E2E test pipes `--json` output to `jq`
- **THEN** test assertion verifies:
  - `jq` command succeeds (exit code 0)
  - `jq` output matches expected structure
  - NO "invalid JSON" errors from `jq`

#### Scenario: Text stderr assertion
- **WHEN** E2E test runs command without `--json` flag
- **THEN** test assertion verifies:
  - stdout contains formatted output
  - stderr contains warnings/errors (if generated)
  - stdout and stderr are properly separated

### Requirement: Unit test coverage
The system SHALL provide unit tests for core components.

#### Scenario: OutputRouter unit tests
- **WHEN** unit tests run for `OutputRouter`
- **THEN** tests verify:
  - JSON mode routes primary to stdout
  - JSON mode routes warnings/errors to stderr
  - TEXT mode routes primary to stdout
  - TEXT mode routes warnings/errors to stderr
  - SILENT mode routes only errors to stderr

#### Scenario: Formatter unit tests
- **WHEN** unit tests run for formatters
- **THEN** tests verify:
  - JSON formatter returns OutputResult object
  - Text formatter returns OutputResult object
  - Formatters do NOT write to streams directly