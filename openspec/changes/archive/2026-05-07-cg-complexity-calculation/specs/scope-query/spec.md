## MODIFIED Requirements

### Requirement: Scope query returns complexity aggregation

The system SHALL aggregate complexity from MODULE nodes. When MODULE nodes have complexity metadata, MUST return calculated values instead of "unknown".

#### Scenario: FILE complexity aggregation
- **WHEN** file has MODULE nodes with complexity values 3, 5, 7
- **THEN** system returns `{ level: "medium", value: 15 }`
- **AND** level is derived from total value using threshold rules

#### Scenario: MODULE complexity direct
- **WHEN** MODULE node has `metadata.complexity = { level: "medium", value: 8 }`
- **THEN** system returns `{ level: "medium", value: 8 }`

#### Scenario: No MODULE data
- **WHEN** file has no MODULE nodes or no complexity metadata
- **THEN** system returns `{ level: "unknown", value: 0 }`

#### Scenario: Mixed MODULE complexity levels
- **WHEN** file has MODULE nodes with levels ["low", "medium", "high"]
- **THEN** system aggregates values and derives file-level level from total
- **AND** does NOT average or max individual levels

#### Scenario: Complexity threshold application for file aggregation
- **WHEN** file-level total complexity is calculated
- **THEN** system applies threshold rules: 1-5 = "low", 6-15 = "medium", 16-25 = "high", >=26 = "critical"

#### Scenario: File with only class MODULE nodes
- **WHEN** file has MODULE nodes with kind='class' only (no functions)
- **THEN** system returns `{ level: "unknown", value: 0 }` (classes have no complexity)

#### Scenario: File with mixed MODULE kinds
- **WHEN** file has MODULE nodes: class (no complexity), function (complexity=8), variable (no complexity)
- **THEN** system aggregates only function complexity
- **AND** returns `{ level: "medium", value: 8 }`

#### Scenario: Threshold boundary validation
- **WHEN** file-level total is exactly 5
- **THEN** level = "low" (upper boundary)
- **WHEN** file-level total is exactly 6
- **THEN** level = "medium" (lower boundary)
- **WHEN** file-level total is exactly 15
- **THEN** level = "medium" (upper boundary)
- **WHEN** file-level total is exactly 16
- **THEN** level = "high" (lower boundary)