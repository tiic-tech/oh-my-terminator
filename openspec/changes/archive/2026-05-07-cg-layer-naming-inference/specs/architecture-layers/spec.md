## MODIFIED Requirements

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