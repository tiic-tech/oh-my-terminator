## ADDED Requirements

### Requirement: Layer role name inference from directory patterns

The system SHALL provide a `inferLayerRoleName(groupName: string, rules?: NamingRule[])` function that maps directory group names to semantic layer role names using pattern-based naming rules.

#### Scenario: API directory mapped to API Layer
- **WHEN** group name is "api", "routes", or "endpoints"
- **THEN** system returns role name "API Layer"

#### Scenario: Persistence directory mapped to Data Layer
- **WHEN** group name is "persistence", "data", "storage", or "db"
- **THEN** system returns role name "Data Layer"

#### Scenario: CLI directory mapped to CLI Layer
- **WHEN** group name is "cli", "commands", or "bin"
- **THEN** system returns role name "CLI Layer"

#### Scenario: Services directory mapped to Service Layer
- **WHEN** group name is "services", "workers", or "jobs"
- **THEN** system returns role name "Service Layer"

#### Scenario: Test directory mapped to Test Layer
- **WHEN** group name is "test", "tests", "spec", or "specs"
- **THEN** system returns role name "Test Layer"

#### Scenario: Unmatched directory fallback to generic name
- **WHEN** group name is "unusual-directory-name" with no matching pattern
- **THEN** system returns "Layer N" where N is the layer number

### Requirement: Naming rules structure

The system SHALL define NamingRule with pattern, role, and priority fields.

#### Scenario: NamingRule format
- **WHEN** naming rules are defined
- **THEN** each NamingRule contains:
  - `pattern`: string or RegExp for matching group names
  - `role`: string for the inferred role name
  - `priority`: number for conflict resolution (higher = preferred)

#### Scenario: Default naming rules provided
- **WHEN** system initializes naming inference
- **THEN** DEFAULT_NAMING_RULES array is available with common patterns

#### Scenario: Default rules priority ordering
- **WHEN** DEFAULT_NAMING_RULES are used
- **THEN** API/Data/CLI patterns have priority 10
- **AND** Service patterns have priority 8
- **AND** Utility/Test patterns have priority 5

### Requirement: Pattern matching with priority

The system SHALL match patterns and select highest priority rule on collision.

#### Scenario: Single pattern match
- **WHEN** group name "api" matches only API pattern
- **THEN** system returns "API Layer" role

#### Scenario: Multiple pattern matches with priority
- **WHEN** group name "api-services" matches both "api" (priority 10) and "services" (priority 8)
- **THEN** system returns "API Layer" (higher priority wins)

#### Scenario: Exact match preferred over substring match
- **WHEN** group name "api" matches exact pattern `^(api)$` and substring pattern `api`
- **THEN** system prefers exact match (higher priority or first match)

### Requirement: Custom naming rules configuration

The system SHALL support custom naming rules via `.codegraph/config.json`.

#### Scenario: Custom rule overrides default
- **WHEN** config contains `{ "namingRules": [{ "pattern": "^custom$", "role": "Custom Layer", "priority": 15 }] }`
- **THEN** system merges custom rules with defaults
- **AND** custom rules override defaults on same pattern

#### Scenario: Custom rule for project-specific naming
- **WHEN** project has directory "adapters" that should be named "Integration Layer"
- **AND** config contains `{ "namingRules": [{ "pattern": "^adapters$", "role": "Integration Layer", "priority": 12 }] }`
- **THEN** group "adapters" is assigned role "Integration Layer"

#### Scenario: Empty custom rules uses defaults
- **WHEN** config has no `namingRules` field
- **THEN** system uses DEFAULT_NAMING_RULES only

### Requirement: Naming rule validation

The system SHALL validate custom naming rules on configuration load.

#### Scenario: Valid rule accepted
- **WHEN** rule has valid pattern, role, and priority
- **THEN** rule is added to active rules

#### Scenario: Invalid pattern rejected
- **WHEN** rule has invalid RegExp pattern (e.g., `"(invalid"`)
- **THEN** system logs warning and skips rule
- **AND** system continues with remaining rules

#### Scenario: Missing required field rejected
- **WHEN** rule missing `role` or `priority` field
- **THEN** system logs warning and skips rule

### Requirement: Confidence tracking for naming inference

The system SHALL track and return confidence score for inferred role names.

#### Scenario: High confidence for exact match
- **WHEN** group name matches an anchored pattern (e.g., `^(api)$` exactly)
- **THEN** system returns confidence score of 100

#### Scenario: Medium confidence for substring match
- **WHEN** group name matches a non-anchored pattern (e.g., "api" in "api-services")
- **THEN** system returns confidence score of 80

#### Scenario: Low confidence for fuzzy match
- **WHEN** group name partially matches pattern
- **THEN** system returns confidence score between 50-70

#### Scenario: Zero confidence for no match
- **WHEN** no pattern matches the group name
- **THEN** system returns confidence score of 0 and fallback "Layer N"

### Requirement: Naming accuracy validation criteria

The system SHALL achieve 80%+ naming accuracy for typical project structures.

#### Scenario: Accuracy measurement method
- **WHEN** validating naming inference
- **THEN** accuracy is calculated as: (correctly named layers / total layers 5+) × 100

#### Scenario: Verification test dataset
- **WHEN** running verification tests
- **THEN** test fixtures include:
  - Sample project with known layer structure
  - Expected role names for each layer 5+
  - Count of layers that should receive semantic names

#### Scenario: Accuracy threshold
- **WHEN** running E2E validation
- **THEN** system achieves minimum 80% accuracy on test dataset
- **AND** fallback names used only when no pattern matches

### Requirement: Aggregation for multiple groups in single layer

The system SHALL aggregate role names when a layer contains multiple directory groups.

#### Scenario: Priority-based aggregation
- **WHEN** layer 5 contains groups ["api", "services"]
- **AND** api pattern has priority 10, services pattern has priority 8
- **THEN** system returns role "API Layer" (highest priority wins)

#### Scenario: Tie-breaking with comma-separated names
- **WHEN** layer 5 contains groups ["api", "routes"]
- **AND** both patterns have same priority 10
- **THEN** system returns role "API Layer" (first match in deterministic order)

#### Scenario: No match fallback for mixed groups
- **WHEN** layer 5 contains groups ["api", "unusual-name"]
- **AND** "api" matches but "unusual-name" does not
- **THEN** system returns role based on matched group only