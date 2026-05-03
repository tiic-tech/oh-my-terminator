# graph-structure Specification

## MODIFIED Requirements

### Requirement: SerializedCodeGraph interface includes optional schemaVersion

The system SHALL define a `SerializedCodeGraph` interface with the following fields:
- `nodes`: [string, GraphNode][] (Map-compatible format)
- `edges`: GraphEdge[]
- `commitHash`: string
- `timestamp`: number
- `schemaVersion`: optional SchemaVersion (for version tracking, backward compatible)

#### Scenario: SerializedCodeGraph without schemaVersion is valid
- **WHEN** a legacy SerializedCodeGraph is deserialized without schemaVersion field
- **THEN** it is accepted and processed normally

#### Scenario: SerializedCodeGraph with schemaVersion preserves version
- **WHEN** a SerializedCodeGraph with schemaVersion {major: 1, minor: 0, patch: 0} is serialized
- **THEN** the schemaVersion field is preserved in JSON output

#### Scenario: Round-trip preserves optional schemaVersion
- **WHEN** a CodeGraph with schemaVersion is serialized with toJSON then deserialized with fromJSON
- **THEN** the schemaVersion is preserved if present, or undefined if not

### Requirement: toJSON includes schemaVersion in output

The system SHALL implement `toJSON(): SerializedCodeGraph` that includes the optional schemaVersion field in the output when set on the CodeGraph instance.

#### Scenario: toJSON outputs schemaVersion when set
- **WHEN** toJSON is called on a CodeGraph with schemaVersion set
- **THEN** the returned SerializedCodeGraph includes schemaVersion field

#### Scenario: toJSON omits schemaVersion when not set
- **WHEN** toJSON is called on a CodeGraph without schemaVersion
- **THEN** the returned SerializedCodeGraph does not include schemaVersion field or it is undefined