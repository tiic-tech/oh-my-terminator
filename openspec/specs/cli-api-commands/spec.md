# cli-api-commands Specification

## Purpose
Defines CLI commands for querying code graph data: scope, impact, and layers analysis.

## Requirements

### Requirement: CLI scope command execution
The system SHALL provide a `codegraph scope` command that queries code scope by semantic patterns.

#### Scenario: Scope query with pattern
- **WHEN** user runs `codegraph scope "function:authenticate"` 
- **THEN** system returns matching MODULE nodes with their scope metadata

#### Scenario: Scope JSON output
- **WHEN** user runs `codegraph scope "class:User" --json`
- **THEN** system outputs JSON with `success`, `results`, `query`, `durationMs` fields

#### Scenario: Scope text output
- **WHEN** user runs `codegraph scope "module:utils"` without `--json`
- **THEN** system outputs human-readable list of matching nodes with paths

### Requirement: CLI impact command execution
The system SHALL provide a `codegraph impact` command that analyzes change impact on dependent files.

#### Scenario: Impact analysis for target file
- **WHEN** user runs `codegraph impact "FILE:src/utils/format.ts"`
- **THEN** system returns all files that depend on the target file

#### Scenario: Impact JSON output
- **WHEN** user runs `codegraph impact "FILE:src/core.ts" --json`
- **THEN** system outputs JSON with `success`, `affectedFiles`, `blastRadius`, `durationMs` fields

#### Scenario: Impact text output
- **WHEN** user runs `codegraph impact "MODULE:src/auth#login"` without `--json`
- **THEN** system outputs human-readable list of affected files grouped by direct/indirect dependents

### Requirement: CLI layers command execution
The system SHALL provide a `codegraph layers` command that shows architecture layer inference.

#### Scenario: Layers analysis
- **WHEN** user runs `codegraph layers`
- **THEN** system returns architecture layer assignments with group mappings

#### Scenario: Layers JSON output
- **WHEN** user runs `codegraph layers --json`
- **THEN** system outputs JSON with `success`, `layers`, `violations`, `healthScore`, `durationMs` fields

#### Scenario: Layers text output
- **WHEN** user runs `codegraph layers` without `--json`
- **THEN** system outputs human-readable layer hierarchy with violation warnings

### Requirement: API commands discoverable via help
The system SHALL expose `scope`, `impact`, `layers` commands in global help output.

#### Scenario: Global help shows all commands
- **WHEN** user runs `codegraph --help`
- **THEN** help output includes: `analyze`, `update`, `migrate`, `scope`, `impact`, `layers`

#### Scenario: Command-specific help available
- **WHEN** user runs `codegraph scope --help`
- **THEN** system outputs scope command usage with available options

### Requirement: API commands registered in CLI entry point
The system SHALL register scope, impact, layers commands in `bin/codegraph.ts` using CAC framework.

#### Scenario: Commands registered with CAC pattern
- **WHEN** CLI entry point initializes
- **THEN** scope, impact, layers commands are registered using `cli.command('name [args]', 'description')`
- **AND** each command has `--json` option for structured output

#### Scenario: Commands appear in global help
- **WHEN** user runs `codegraph --help`
- **THEN** help output lists all 6 commands: analyze, update, migrate, scope, impact, layers