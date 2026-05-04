# impact-analysis Specification

## Purpose
Provides impact analysis via BFS traversal to find all files affected by changes to target files, supporting depth limits, test file exclusion, and blast radius classification.

## Requirements

### Requirement: Impact analysis returns affected files via BFS traversal

The system SHALL provide a `getImpact(targets, options)` function that traverses the graph using BFS on IMPORTS edges to find all files that depend on the target files.

#### Scenario: Single target with direct dependents
- **WHEN** user calls `getImpact(["FILE:src/utils/format.ts"])`
- **THEN** system returns all files that directly import format.ts via IMPORTS edges

#### Scenario: Single target with indirect dependents
- **WHEN** user calls `getImpact(["FILE:src/utils/format.ts"])` and format.ts is imported by services/auth.ts which is imported by pages/Home.tsx
- **THEN** system returns both direct (services/auth.ts) and indirect (pages/Home.tsx) dependents

#### Scenario: Multi-target merge
- **WHEN** user calls `getImpact(["FILE:src/utils/format.ts", "FILE:src/types/api.ts"])`
- **THEN** system merges affected files, taking minimum distance for duplicates (C8-12)

### Requirement: Test files excluded by default

The system SHALL exclude test directory files from impact analysis by default, with configurable inclusion.

#### Scenario: Test file excluded
- **WHEN** src/utils/format.ts is imported by src/__tests__/format.test.ts
- **AND** user calls `getImpact(["FILE:src/utils/format.ts"])` without includeTests option
- **THEN** src/__tests__/format.test.ts is NOT included in affectedFiles

#### Scenario: Test file included via option
- **WHEN** user calls `getImpact(["FILE:src/utils/format.ts"], { includeTests: true })`
- **THEN** test files matching tests/, __tests__/ patterns ARE included in affectedFiles

### Requirement: Depth-limited traversal

The system SHALL support maxDepth option to limit BFS traversal depth.

#### Scenario: maxDepth=0 returns direct dependents only
- **WHEN** user calls `getImpact(["FILE:src/utils/format.ts"], { maxDepth: 0 })`
- **THEN** system returns only direct dependents (distance=1), no indirect dependents

#### Scenario: maxDepth=10 default
- **WHEN** user calls `getImpact` without maxDepth option
- **THEN** system traverses up to depth 10 by default

### Requirement: DYNAMIC_IMPORTS edges excluded

The system SHALL NOT traverse DYNAMIC_IMPORTS edges during impact analysis.

#### Scenario: Dynamic import not counted
- **WHEN** src/index.ts has `import('./utils.js')` dynamic import
- **AND** user calls `getImpact(["FILE:src/utils.js"])`
- **THEN** src/index.ts is NOT included in affectedFiles

### Requirement: Impact result structure

The system SHALL return ImpactResult with structured data.

#### Scenario: Structured output format
- **WHEN** user calls `getImpact(["FILE:src/utils/format.ts"])`
- **THEN** system returns:
  - `content`: formatted text output
  - `affectedFiles`: array of file paths
  - `directDependents`: count of direct dependents
  - `indirectDependents`: count of indirect dependents

### Requirement: MODULE target resolution

The system SHALL resolve MODULE targets to their parent FILE nodes.

#### Scenario: Module target converted to file
- **WHEN** user calls `getImpact(["MODULE:src/utils.ts#formatDate"])`
- **THEN** system resolves to FILE:src/utils.ts and finds file-level dependents

### Requirement: Blast radius classification

The system SHALL classify impact blast radius based on total affected files.

#### Scenario: Low blast radius
- **WHEN** total affected files ≤ 3
- **THEN** blastRadius = "low"

#### Scenario: Medium blast radius
- **WHEN** total affected files is 4-10
- **THEN** blastRadius = "medium"

#### Scenario: High blast radius
- **WHEN** total affected files > 10
- **THEN** blastRadius = "high"

### Requirement: Via path tracking

The system SHALL track dependency paths for indirect dependents.

#### Scenario: Via array format
- **WHEN** pages/Home.tsx depends on services/auth.ts which depends on utils/format.ts
- **AND** user calls `getImpact(["FILE:src/utils/format.ts"])`
- **THEN** pages/Home.tsx entry has `via: ["src/services/auth.ts"]` (C8-4 array format)

#### Scenario: Multiple via paths
- **WHEN** pages/Home.tsx reaches utils/format.ts via both auth.ts and Modal.tsx
- **THEN** via array contains both paths: `["src/services/auth.ts", "src/components/Modal.tsx"]`

### Requirement: Empty result handling

The system SHALL return empty result for isolated files without error.

#### Scenario: Isolated file returns empty
- **WHEN** user calls `getImpact(["FILE:src/isolated.ts"])` and no files import it
- **THEN** system returns success with affectedFiles=[], directDependents=0, indirectDependents=0

### Requirement: Target not found error

The system SHALL return error for non-existent targets.

#### Scenario: Non-existent target error
- **WHEN** user calls `getImpact(["FILE:src/nonexistent.ts"])` and node does not exist in graph
- **THEN** system returns error with code E001_TARGET_NOT_FOUND