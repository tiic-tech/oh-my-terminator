# impact-analysis Specification (Delta)

## Purpose
Provides impact analysis via BFS traversal to find all files affected by changes to target files, supporting depth limits, test file exclusion, and blast radius classification.

This delta adds path format hints when target not found.

## ADDED Requirements

### Requirement: Path format hint on target not found

The system SHALL provide path format hints when target path does not match expected format.

#### Scenario: Path format hint for FILE not found
- **WHEN** user calls `getImpact(["FILE:src/analyzer/index.ts"])` and target not found
- **THEN** error message includes: `Hint: Use full path format: packages/<pkg>/src/<file>.ts`
- **AND** suggestion mentions checking path relative to project root

#### Scenario: Path format hint for plain path not found
- **WHEN** user calls `getImpact(["src/analyzer/index.ts"])` and target not found
- **THEN** error message includes: `Hint: In monorepos, use packages/codegraph/src/analyzer/index.ts`
- **AND** suggests checking actual file location

#### Scenario: Path format hint suppression for valid format
- **WHEN** user uses correct path format and target not found
- **THEN** error message shows simple "Target not found" without format hint
- **AND** indicates file may not exist in analyzed codebase

#### Scenario: CLI error output with hint
- **WHEN** impact command target not found via CLI
- **THEN** stderr shows friendly error with path hint
- **AND** JSON output includes `error.suggestion` field with hint