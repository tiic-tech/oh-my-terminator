# layer-dependency-score Specification

## Purpose
Calculates dependency scores for architecture layer inference, applying penalties for cycle dependencies and excluding non-runtime dependencies.

## Requirements

### Requirement: Dependency score calculation with cycle penalty

The system SHALL calculate dependency scores considering import/export relationships and applying penalties for cycle dependencies.

#### Scenario: Basic dependency score calculation
- **WHEN** utils group is imported by 10 groups and imports from 3 groups
- **THEN** utils netScore = 10 - 3 = 7

#### Scenario: Cycle penalty applied
- **WHEN** groups A, B, C form a dependency cycle (A→B→C→A)
- **AND** cycle has 3 members
- **THEN** each group in cycle receives penalty = ceil(3/2) = 2
- **AND** each group's netScore is reduced by 2

#### Scenario: No cycle for single dependency
- **WHEN** A imports B but B does not import A
- **THEN** no cycle penalty applied to either group

### Requirement: External dependency exclusion from scoring

The system SHALL exclude external dependencies (node_modules imports) from dependency score calculation.

#### Scenario: External import ignored
- **WHEN** group imports from react (external package)
- **THEN** react import does NOT affect group's importsFrom count

#### Scenario: Mixed internal and external imports
- **WHEN** group imports from utils (internal) and lodash (external)
- **THEN** only utils import counts toward importsFrom

### Requirement: Dynamic import penalty

The system SHALL apply additional penalty for groups using dynamic imports.

#### Scenario: Dynamic import penalty applied
- **WHEN** group uses dynamic import: `import('./module')`
- **THEN** group receives dynamicImportPenalty = 1
- **AND** group's netScore is reduced by 1

#### Scenario: Multiple dynamic imports compound penalty
- **WHEN** group uses 3 dynamic imports
- **THEN** group receives dynamicImportPenalty = 3

### Requirement: Type-only import handling

The system SHALL NOT count type-only imports toward dependency score (type imports don't create runtime dependencies).

#### Scenario: Type import excluded from score
- **WHEN** group uses `import type { Foo } from './utils'`
- **THEN** type import does NOT affect importsFrom count

#### Scenario: Mixed type and value imports
- **WHEN** group imports `import { Bar, type Foo } from './utils'`
- **THEN** only Bar (value import) counts toward importsFrom