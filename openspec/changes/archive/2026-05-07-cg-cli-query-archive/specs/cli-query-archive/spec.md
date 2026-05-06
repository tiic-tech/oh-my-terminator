# cli-query-archive Specification

## Purpose

Archival verification for C10 (CLI query commands). Documents verification process without introducing new requirements.

## Requirements

### Requirement: CLI commands verification checklist

The archival process SHALL verify that implemented CLI commands match their specification requirements.

#### Scenario: Scope command verified
- **WHEN** archival process checks `scope.ts`
- **THEN** file exists with pattern query support and JSON/text output

#### Scenario: Impact command verified
- **WHEN** archival process checks `impact.ts`
- **THEN** file exists with change impact analysis and blast radius output

#### Scenario: Layers command verified
- **WHEN** archival process checks `layers.ts`
- **THEN** file exists with layer inference and violation detection

#### Scenario: Migrate command verified
- **WHEN** archival process checks `migrate.ts`
- **THEN** file exists with baseline schema migration support

### Requirement: Brief CLI command status documented

The archival process SHALL document that quick-brief is API-only, not a CLI command.

#### Scenario: Brief API documented
- **WHEN** archival process checks `quick-brief/spec.md`
- **THEN** spec defines `getQuickBrief` API requirement
- **AND** no `brief.ts` CLI command exists
- **AND** archival notes this as intentional (API-only)

### Requirement: Archive documentation created

The archival process SHALL create archive documentation summarizing C10 state.

#### Scenario: Archive document structure
- **WHEN** archive is created
- **THEN** document includes: implementation summary, verification results, test coverage, known limitations

### Requirement: Tests passing verified

The archival process SHALL verify existing tests cover CLI commands.

#### Scenario: Test suite verified
- **WHEN** `npm test` runs
- **THEN** all CLI-related tests pass
- **AND** no new tests needed (existing coverage sufficient)