# architecture-layers Specification

## Purpose
Provides architecture layer inference from directory structure, detecting layer violations and calculating architecture health scores.

## Requirements

### Requirement: Architecture layers inference from directory structure

The system SHALL provide a `getArchitectureLayers(sourceRoot)` function that groups files by first-level directory and infers architecture layers based on import direction statistics.

#### Scenario: First-level directory grouping
- **WHEN** project has src/utils/format.ts, src/pages/Home.tsx, src/components/Button.tsx
- **AND** user calls `getArchitectureLayers("src")`
- **THEN** system creates groups: "utils", "pages", "components" based on first-level directories

#### Scenario: Root files grouped separately
- **WHEN** project has src/index.ts (no subdirectory)
- **THEN** system creates "__root__" group for root-level files

### Requirement: Layer inference by import direction

The system SHALL infer layer ordering based on net dependency score (importedBy - importsFrom).

#### Scenario: Foundation layer for highly imported groups
- **WHEN** utils group has netScore = 45 (imported by many, imports few)
- **THEN** utils is assigned to Layer 1 (Foundation)

#### Scenario: Presentation layer for importing groups
- **WHEN** pages group has netScore = -30 (imports many, imported by few)
- **THEN** pages is assigned to higher layer (Application/Presentation)

#### Scenario: Adjacent scores merge to same layer
- **WHEN** utils(netScore=45) and types(netScore=43) have difference ≤ LAYER_THRESHOLD(2)
- **THEN** both groups are assigned to same layer

### Requirement: Layer violation detection

The system SHALL detect violations where lower-layer groups import higher-layer groups.

#### Scenario: Violation detected for low-to-high import
- **WHEN** utils (Layer 1) imports pages (Layer 3)
- **THEN** system reports violation: fromGroup="utils", toGroup="pages", layerGap=2

#### Scenario: No violation for high-to-low import
- **WHEN** pages (Layer 3) imports utils (Layer 1)
- **THEN** system does NOT report violation (this is correct layer direction)

#### Scenario: Same-layer mutual imports not violation
- **WHEN** utils/date.ts imports utils/format.ts and vice versa (same layer)
- **THEN** system does NOT report violation (C8-11)

### Requirement: Health score calculation

The system SHALL calculate healthScore based on violation severity.

#### Scenario: Perfect score with no violations
- **WHEN** no layer violations detected
- **THEN** healthScore = 100

#### Scenario: Minor violation penalty
- **WHEN** 1 violation with layerGap=1 detected
- **THEN** healthScore = 95 (100 - 5)

#### Scenario: Moderate violation penalty
- **WHEN** 1 violation with layerGap=2 detected
- **THEN** healthScore = 90 (100 - 10)

#### Scenario: Critical violation penalty
- **WHEN** 1 violation with layerGap≥3 detected
- **THEN** healthScore = 85 (100 - 15)

#### Scenario: Multiple violations compound
- **WHEN** 2 minor + 1 moderate violations detected
- **THEN** healthScore = 80 (100 - 5×2 - 10)

### Requirement: Layers result structure

The system SHALL return LayersResult with structured data.

#### Scenario: Structured output format
- **WHEN** user calls `getArchitectureLayers("src")`
- **THEN** system returns:
  - `content`: formatted text output
  - `layers`: array of LayerAssignment (layer number, role, groups)
  - `violations`: array of LayerViolation
  - `healthScore`: calculated health score

### Requirement: Layer assignment structure

The system SHALL provide LayerAssignment with group statistics.

#### Scenario: Layer assignment format
- **WHEN** layers are inferred
- **THEN** each LayerAssignment contains:
  - `layer`: integer (1-based, 1=bottom)
  - `role`: string ("Foundation", "Core", "Application", "Presentation")
  - `groups`: array of group names in this layer

### Requirement: Layer violation structure

The system SHALL provide LayerViolation with detailed information.

#### Scenario: Violation format
- **WHEN** violation is detected
- **THEN** each LayerViolation contains:
  - `fromGroup`: violating group name
  - `toGroup`: target group name
  - `count`: number of violating imports
  - `layerGap`: layer distance (positive integer)
  - `affectedFiles`: array of violating file pairs

### Requirement: Empty graph error

The system SHALL return error for graph without FILE nodes.

#### Scenario: Empty graph error
- **WHEN** graph contains no FILE nodes
- **AND** user calls `getArchitectureLayers()`
- **THEN** system returns error with code E005_EMPTY_GRAPH

### Requirement: Custom source root support

The system SHALL support custom sourceRoot parameter.

#### Scenario: Non-src project root
- **WHEN** project uses "lib/" as source root instead of "src/"
- **AND** user calls `getArchitectureLayers("lib")`
- **THEN** system groups files under lib/ directory

### Requirement: Severity assignment for violations

The system SHALL assign severity based on layerGap.

#### Scenario: Minor severity
- **WHEN** violation has layerGap = 1
- **THEN** severity = "minor"

#### Scenario: Moderate severity
- **WHEN** violation has layerGap = 2
- **THEN** severity = "moderate"

#### Scenario: Critical severity
- **WHEN** violation has layerGap ≥ 3
- **THEN** severity = "critical"

### Requirement: External dependency exclusion

The system SHALL exclude external dependencies from layer inference.

#### Scenario: External imports not counted
- **WHEN** src/utils/format.ts imports "lodash" (external)
- **THEN** external import does NOT affect layer inference statistics