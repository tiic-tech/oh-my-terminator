# architecture-layers Specification

## Purpose
Provides architecture layer inference from directory structure, detecting layer violations and calculating architecture health scores.

## Requirements

### Requirement: Architecture layers inference from directory structure

The system SHALL provide a `getArchitectureLayers(sourceRoot)` function that groups files by first-level directory and infers architecture layers based on import direction statistics, using intelligent source root detection when sourceRoot is not provided.

#### Scenario: First-level directory grouping
- **WHEN** project has src/utils/format.ts, src/pages/Home.tsx, src/components/Button.tsx
- **AND** user calls `getArchitectureLayers("src")`
- **THEN** system creates groups: "utils", "pages", "components" based on first-level directories

#### Scenario: Root files grouped separately
- **WHEN** project has src/index.ts (no subdirectory)
- **THEN** system creates "__root__" group for root-level files

#### Scenario: Auto source root detection when parameter omitted
- **WHEN** user calls `getArchitectureLayers()` without sourceRoot
- **AND** project has src/ with package.json (+10) and tsconfig.json (+8)
- **THEN** system uses signal scoring to detect src/ as source root automatically

#### Scenario: Tests directory excluded from auto detection
- **WHEN** user calls `getArchitectureLayers()` without sourceRoot
- **AND** project contains tests/ directory
- **THEN** system does NOT select tests/ as source root (in exclusion list)

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

The system SHALL provide LayerAssignment with group statistics, confidence tracking, and semantic role names for layers beyond 4.

#### Scenario: Layer assignment format
- **WHEN** layers are inferred
- **THEN** each LayerAssignment contains:
  - `layer`: integer (1-based, 1=bottom)
  - `role`: string (semantic name from LAYER_ROLE_NAMES for layers 1-4, inferred name for layers 5+)
  - `groups`: array of group names in this layer
  - `confidence`: integer (0-100, inference quality score)

#### Scenario: Standard role names for layers 1-4
- **WHEN** layer number is 1, 2, 3, or 4
- **THEN** role is "Foundation", "Core", "Application", or "Presentation" (from LAYER_ROLE_NAMES)

#### Scenario: Semantic name inference for layer 5+
- **WHEN** layer number is 5 or higher
- **AND** group names match naming rules patterns
- **THEN** role is inferred from group directory names (e.g., "API Layer", "Data Layer")

#### Scenario: Fallback to generic name for unmatched layer 5+
- **WHEN** layer number is 5 or higher
- **AND** no naming rule matches group names
- **THEN** role is "Layer N" where N is the layer number

#### Scenario: High confidence for strong signals
- **WHEN** source root detected with score > 30
- **AND** groups have clear import direction
- **THEN** LayerAssignment confidence = 85-100

#### Scenario: Low confidence triggers fallback
- **WHEN** source root score < 15
- **OR** groups have high cycle dependency
- **THEN** LayerAssignment confidence < 50
- **AND** fallback suggestions are generated

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

### Requirement: Layer threshold calculation

The system SHALL calculate layer threshold dynamically based on project scale using DEPTH_PRESETS, replacing hardcoded DEFAULT_LAYER_THRESHOLD.

#### Scenario: Threshold from project scale
- **WHEN** getArchitectureLayers analyzes a project
- **THEN** threshold is determined by `getThresholdForScale(detectProjectScale(projectRoot))`
- **AND** DEFAULT_LAYER_THRESHOLD constant (if present) is replaced by dynamic threshold call

#### Scenario: No hardcoded threshold
- **WHEN** system initializes layer inference
- **THEN** no hardcoded LAYER_THRESHOLD constant exists in core.ts

#### Scenario: Threshold adapts to project size
- **WHEN** small project (<50 files) is analyzed
- **THEN** layer inference uses threshold: 5
- **AND** when large project (>500 files) is analyzed
- **THEN** layer inference uses threshold: 1

#### Scenario: Backward compatibility during transition
- **WHEN** core.ts contains DEFAULT_LAYER_THRESHOLD=2
- **THEN** this is temporary backward compatibility fallback
- **AND** should be replaced with `getThresholdForScale()` call during implementation

### Requirement: External dependency exclusion

The system SHALL exclude external dependencies from layer inference.

#### Scenario: External imports not counted
- **WHEN** src/utils/format.ts imports "lodash" (external)
- **THEN** external import does NOT affect layer inference statistics

### Requirement: Confidence tracking for layer inference

The system SHALL track inference confidence based on signal strength and dependency clarity.

#### Scenario: Confidence from source root signal
- **WHEN** source root detected with score >= 30
- **THEN** confidence receives +40 contribution

#### Scenario: Confidence from group consistency
- **WHEN** all groups have netScore variance < 20
- **THEN** confidence receives +30 contribution

#### Scenario: Confidence penalty for cycles
- **WHEN** groups participate in dependency cycles
- **THEN** confidence penalty = 5 per cycle

#### Scenario: Confidence penalty for ambiguity
- **WHEN** adjacent groups have score difference < threshold
- **THEN** confidence penalty = 2 per ambiguous pair

### Requirement: Fallback suggestions generation

The system SHALL generate Agent-friendly suggestions when confidence < 50.

#### Scenario: Low confidence triggers suggestions
- **WHEN** layer inference confidence < 50
- **THEN** LayersResult includes `suggestions` field with actionable prompts

#### Scenario: Suggestions format
- **WHEN** suggestions are generated
- **THEN** each suggestion contains:
  - `type`: string ("config", "manual-review", "structure")
  - `prompt`: string (Agent-friendly action prompt)
  - `context`: string (relevant project context)

#### Scenario: Config suggestion
- **WHEN** source root detection is ambiguous
- **THEN** suggestion type = "config"
- **AND** prompt = "Consider specifying sourceRoot in .codegraph/config.json"

#### Scenario: Manual review suggestion
- **WHEN** cycle dependencies detected
- **THEN** suggestion type = "manual-review"
- **AND** prompt = "Review cycle between groups X, Y, Z for intentional vs accidental"

### Requirement: Cycle dependency penalty in scoring

The system SHALL apply penalty to groups participating in dependency cycles.

#### Scenario: Cycle detected and penalized
- **WHEN** groups A, B, C form cycle (A→B→C→A)
- **THEN** each group's netScore reduced by ceil(cycle.length/2) = 2

#### Scenario: Multiple cycles compound penalty
- **WHEN** group participates in 2 different cycles
- **THEN** group's penalty = sum of all cycle penalties