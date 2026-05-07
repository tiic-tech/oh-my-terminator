# scope-query Specification (Delta)

## Purpose

Scope query API for FILE, MODULE, and EXTERNAL nodes - returns complete context information including exports, imports, importedBy, test file association, complexity aggregation, and deprecated status.

This delta adds path format hints when target not found.

## ADDED Requirements

### Requirement: Path format hint on target not found

The system SHALL provide path format hints when target path does not match expected format.

#### Scenario: Path format hint for FILE not found
- **WHEN** user queries `getScope("FILE:src/analyzer/index.ts")` and target not found
- **THEN** error message includes: `Hint: Use full path format: packages/<pkg>/src/<file>.ts`
- **AND** suggestion mentions checking path relative to project root

#### Scenario: Path format hint for plain path not found
- **WHEN** user queries `getScope("src/analyzer/index.ts")` and target not found
- **THEN** error message includes: `Hint: In monorepos, use packages/codegraph/src/analyzer/index.ts`
- **AND** suggests checking actual file location

#### Scenario: Path format hint suppression for valid format
- **WHEN** user uses correct path format and target not found
- **THEN** error message shows simple "Target not found" without format hint
- **AND** indicates file may not exist in analyzed codebase

#### Scenario: CLI error output with hint
- **WHEN** scope command target not found via CLI
- **THEN** stderr shows friendly error with path hint
- **AND** JSON output includes `error.suggestion` field with hint