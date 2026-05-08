# cli-error-handling Specification

## Purpose
Provides friendly error message formatting for CLI commands, transforming raw CACError stack traces into actionable user messages with suggestions.

## ADDED Requirements

### Requirement: CLI error transformation

The system SHALL transform CACError and other CLI-level errors into friendly, actionable error messages.

#### Scenario: Unknown command error
- **WHEN** user enters an unknown command (e.g., `codegraph unknown-cmd`)
- **THEN** system outputs: `Unknown command 'unknown-cmd'. Available commands: analyze, update, layers, scope, impact`
- **AND** error is routed to stderr in text mode

#### Scenario: Unknown flag error
- **WHEN** user enters an invalid flag (e.g., `codegraph analyze --invalid-flag`)
- **THEN** system outputs: `Invalid flag '--invalid-flag'. Available flags: --json, --source-root, --verbose`
- **AND** error is routed to stderr in text mode

#### Scenario: Missing required argument error
- **WHEN** user omits required argument (e.g., `codegraph scope` without target)
- **THEN** system outputs: `Missing required argument 'target'. Usage: codegraph scope <target>`
- **AND** error is routed to stderr in text mode

#### Scenario: Internal error preservation
- **WHEN** unexpected internal error occurs
- **THEN** system outputs: `Internal error: <brief description>. Please report this issue.`
- **AND** full error details available in JSON mode for debugging

### Requirement: Error code classification

The system SHALL classify CLI errors with structured error codes.

#### Scenario: Error code structure
- **WHEN** any CLI error occurs
- **THEN** error object includes `code` field matching pattern `E_CLI_*`

#### Scenario: Unknown command code
- **WHEN** unknown command error occurs
- **THEN** error code is `E_CLI_UNKNOWN_COMMAND`

#### Scenario: Unknown flag code
- **WHEN** invalid flag error occurs
- **THEN** error code is `E_CLI_UNKNOWN_FLAG`

#### Scenario: Missing argument code
- **WHEN** missing argument error occurs
- **THEN** error code is `E_CLI_MISSING_ARG`

#### Scenario: Target not found code
- **WHEN** target not found error occurs in scope/impact
- **THEN** error code is `E_CLI_TARGET_NOT_FOUND`

### Requirement: JSON mode error structure

The system SHALL output structured JSON errors when `--json` flag is present.

#### Scenario: JSON error format
- **WHEN** error occurs with `--json` flag
- **THEN** stdout receives: `{ "success": false, "error": { "code": "<code>", "message": "<message>", "debug": "<original-error>" }, "durationMs": <ms> }`
- **AND** `error.debug` contains original error stack/message for debugging
- **AND** `durationMs` reflects total CLI execution time (from entry point start)
- **AND** stderr receives diagnostic message (if applicable)

#### Scenario: JSON error to stdout only
- **WHEN** JSON mode error occurs
- **THEN** JSON error object goes to stdout (maintaining output routing spec)
- **AND** stderr may contain supplementary diagnostic info

### Requirement: Command and flag suggestions

The system SHALL provide suggestions when user input is incorrect.

#### Scenario: Command suggestions
- **WHEN** unknown command error occurs
- **THEN** message includes list of available commands in **alphabetical order**
- **AND** commands are extracted from CAC `cli.commands` (excluding built-in: help, version)

#### Scenario: Flag suggestions
- **WHEN** invalid flag error occurs
- **THEN** message includes list of valid flags for that **specific command**
- **NOTE**: Available flags are command-specific (e.g., `analyze` has `--json`, `--verbose`, `--source-root`; `scope` has different flags)
- **AND** flags are extracted from CAC `command.options` and sorted alphabetically

#### Scenario: Usage hint
- **WHEN** missing argument error occurs
- **THEN** message includes correct usage syntax for that command

### Requirement: Error transformer module

The system SHALL provide an error transformer module for CACError handling.

#### Scenario: Transformer function
- **WHEN** `transformCACError(error)` is called
- **THEN** function returns `CliError` object with code, message, and suggestion fields

#### Scenario: Non-CACError passthrough
- **WHEN** error is not a CACError (e.g., analysis-level parsing error, import resolution failure)
- **THEN** transformer wraps it as internal error with `E_CLI_INTERNAL` code
- **AND** original error message is preserved in `error.debug` field (JSON mode)
- **AND** text mode shows: `Internal error: <brief description>. Please report this issue.`
- **NOTE**: CLI-layer only transforms CACError. Internal analysis errors pass through wrapped.

### Requirement: CLI entry point error handling

The system SHALL catch and transform errors at the CLI entry point.

#### Scenario: Entry point error catch
- **WHEN** CLI entry point (`bin/codegraph.ts`) receives error from CAC
- **THEN** entry point catches error and calls error transformer
- **AND** transformed error is routed to appropriate streams

#### Scenario: No stack trace display
- **WHEN** CLI error occurs in text mode
- **THEN** user sees NO raw Node.js stack trace
- **AND** only friendly message is displayed