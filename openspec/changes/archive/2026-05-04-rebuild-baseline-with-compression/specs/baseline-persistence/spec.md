## ADDED Requirements

### Requirement: Serialization writes compressed format
The `saveBaseline()` function SHALL support compression mode.
When compression enabled, output SHALL use 1.1 schema format.
When compression disabled, output SHALL use 1.0 schema format.

#### Scenario: Save with compression
- **WHEN** `saveBaseline(graph, { compress: true })` is called
- **THEN** output file SHALL contain `schemaVersion: "1.1"`
- **THEN** nodes SHALL NOT have `id` fields
- **THEN** `pathTable` SHALL be present

#### Scenario: Save without compression
- **WHEN** `saveBaseline(graph, { compress: false })` is called
- **THEN** output file SHALL NOT contain `schemaVersion`
- **THEN** nodes SHALL have `id` fields
- **THEN** `pathTable` SHALL NOT be present

### Requirement: Deserialization handles both formats
The `loadBaseline()` function SHALL detect schema version.
Schema 1.0 SHALL be migrated to internal representation.
Schema 1.1 SHALL be decompressed to internal representation.

#### Scenario: Load 1.1 baseline
- **WHEN** baseline contains `schemaVersion: "1.1"`
- **THEN** path indexes SHALL be resolved to full paths
- **THEN** IMPORTS_BATCH SHALL be expanded to individual edges
- **THEN** internal graph SHALL match original uncompressed structure

#### Scenario: Load 1.0 baseline
- **WHEN** baseline lacks `schemaVersion` field
- **THEN** data SHALL be loaded directly without decompression
- **THEN** internal graph SHALL match baseline structure

### Requirement: Internal graph representation unchanged
Compression SHALL be transparent to Graph API.
All graph methods (getNodes, getEdges, getNeighbors) SHALL work identically.

#### Scenario: API compatibility after decompression
- **WHEN** a compressed baseline is loaded
- **THEN** `graph.getNodeById("FILE:src/analyzer.ts")` SHALL return the node
- **THEN** `graph.getEdges()` SHALL return expanded edge objects with `id` fields
- **THEN** API consumers SHALL NOT detect compression occurred