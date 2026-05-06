# layer-source-root Specification

## Purpose
Detects source root directories using weighted signal scoring, ensuring accurate layer inference by identifying the true source location in multi-directory projects.

## Requirements

### Requirement: Source root detection with signal scoring

The system SHALL detect source root directories using weighted signal scoring, prioritizing directories with typical project markers and penalizing excluded directories.

#### Scenario: Typical source root detected
- **WHEN** project has src/ with package.json (+10) and tsconfig.json (+8)
- **AND** src/ has typical directory name (+15)
- **THEN** system identifies src/ as source root with total score = 33

#### Scenario: Tests directory excluded
- **WHEN** tests/ directory exists with test files
- **AND** tests/ is in EXCLUDED_DIRECTORIES list
- **THEN** system does NOT consider tests/ as source root candidate

#### Scenario: node_modules heavily penalized
- **WHEN** node_modules/ contains package.json and tsconfig.json
- **THEN** system penalizes node_modules/ with NO_NODE_MODULES signal (-20)
- **AND** node_modules/ score is negative, not selected as source root

### Requirement: Exclusion list for non-source directories

The system SHALL maintain an exclusion list of directories that are never considered as source root candidates.

#### Scenario: Standard excluded directories
- **WHEN** project contains node_modules/, dist/, build/, test/, tests/, __tests__/, .git/, .github/, docs/, coverage/, scripts/
- **THEN** system excludes all these directories from source root candidates

#### Scenario: Nested excluded directory
- **WHEN** project contains src/node_modules/
- **THEN** system excludes src/node_modules/ from candidates (nested exclusion)

### Requirement: Multiple source root candidates handling

The system SHALL select the highest-scored directory as source root when multiple candidates exist.

#### Scenario: Highest score wins
- **WHEN** src/ has score 33 and lib/ has score 28
- **THEN** system selects src/ as primary source root

#### Scenario: Equal scores fallback
- **WHEN** src/ and lib/ both have score 33
- **THEN** system selects alphabetically first candidate as tie-breaker