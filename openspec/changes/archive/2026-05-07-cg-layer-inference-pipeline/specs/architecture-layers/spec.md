## MODIFIED Requirements

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

### Requirement: Layer assignment structure

The system SHALL provide LayerAssignment with group statistics and confidence tracking.

#### Scenario: Layer assignment format
- **WHEN** layers are inferred
- **THEN** each LayerAssignment contains:
  - `layer`: integer (1-based, 1=bottom)
  - `role`: string ("Foundation", "Core", "Application", "Presentation")
  - `groups`: array of group names in this layer
  - `confidence`: integer (0-100, inference quality score)

#### Scenario: High confidence for strong signals
- **WHEN** source root detected with score > 30
- **AND** groups have clear import direction
- **THEN** LayerAssignment confidence = 85-100

#### Scenario: Low confidence triggers fallback
- **WHEN** source root score < 15
- **OR** groups have high cycle dependency
- **THEN** LayerAssignment confidence < 50
- **AND** fallback suggestions are generated

## ADDED Requirements

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

### Requirement: Layer threshold calculation

The system SHALL calculate layer threshold dynamically based on project scale using DEPTH_PRESETS, replacing hardcoded DEFAULT_LAYER_THRESHOLD.

#### Scenario: Threshold from project scale
- **WHEN** getArchitectureLayers analyzes a project
- **THEN** threshold is determined by `getThresholdForScale(detectProjectScale(projectRoot))`
- **AND** DEFAULT_LAYER_THRESHOLD constant (if present) is replaced by dynamic threshold call

#### Scenario: Backward compatibility during transition
- **WHEN** core.ts contains DEFAULT_LAYER_THRESHOLD=2
- **THEN** this is temporary backward compatibility fallback
- **AND** should be replaced with `getThresholdForScale()` call during implementation

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