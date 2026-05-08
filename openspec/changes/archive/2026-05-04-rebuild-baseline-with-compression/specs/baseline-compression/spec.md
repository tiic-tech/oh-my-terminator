## ADDED Requirements

### Requirement: ID deduplication removes redundant id field
The system SHALL remove the `id` field from nodes and edges during compression.
The tuple key `[type, path]` SHALL be the canonical identifier for nodes.
The tuple key `[type, source, target]` SHALL be the canonical identifier for edges.

#### Scenario: Node without id field
- **WHEN** a FILE node is serialized with compression enabled
- **THEN** the output SHALL NOT contain an `id` field
- **THEN** the node SHALL contain `type: "FILE"` and `path: "src/analyzer.ts"`
- **THEN** the canonical ID SHALL be derivable as `"FILE:src/analyzer.ts"`

#### Scenario: Edge without id field
- **WHEN** an IMPORTS edge is serialized with compression enabled
- **THEN** the output SHALL NOT contain an `id` field
- **THEN** the edge SHALL contain `type: "IMPORTS"`, `fromIndex: 5`, `toIndex: 10`
- **THEN** the canonical ID SHALL be derivable from path table indexes

### Requirement: JSDoc truncation preserves documentation signal
The system SHALL truncate JSDoc strings to configurable maximum length (default: 100 chars).
The system SHALL set `jsDocTruncated: true` when JSDoc exceeds maximum length.
The system SHALL set `hasJSDoc: false` when no JSDoc exists.

#### Scenario: JSDoc within limit
- **WHEN** a MODULE node has JSDoc of 50 characters
- **THEN** the full JSDoc SHALL be preserved in output
- **THEN** `jsDocTruncated` SHALL NOT be present

#### Scenario: JSDoc exceeds limit
- **WHEN** a MODULE node has JSDoc of 200 characters
- **THEN** the output SHALL contain truncated JSDoc (first 100 chars)
- **THEN** `jsDocTruncated` SHALL be `true`

#### Scenario: No JSDoc
- **WHEN** a MODULE node has no JSDoc documentation
- **THEN** the output SHALL contain `hasJSDoc: false`
- **THEN** no `jsDoc` field SHALL be present

### Requirement: Path table enables string interning
The system SHALL create a `pathTable: string[]` array containing all unique paths.
Nodes and edges SHALL reference paths via `pathIndex` integer indexes.
The path table SHALL be sorted by total reference count (node references + edge references, most common paths first).

#### Scenario: Path table creation
- **WHEN** compressing a baseline with 100 nodes sharing 50 unique paths
- **THEN** `pathTable` SHALL contain exactly 50 entries
- **THEN** each node SHALL reference its path via `pathIndex`

#### Scenario: Shared dependency path
- **WHEN** 30 nodes import from `node_modules/react/index.js`
- **THEN** `pathTable` SHALL contain one entry for that path
- **THEN** all 30 IMPORTS edges SHALL reference same `toIndex`

#### Scenario: Path table sorting
- **WHEN** path `node_modules/react/index.js` appears in 10 nodes and 50 edges
- **THEN** that path SHALL have reference count 60
- **THEN** more frequently referenced paths SHALL have smaller indexes

### Requirement: Edge batching reduces IMPORTS redundancy
The system SHALL group IMPORTS edges by source file into batch objects.
Each batch SHALL contain `type: "IMPORTS_BATCH"`, `fromIndex`, and `toIndexes: number[]`.

#### Scenario: Multiple imports from same source
- **WHEN** `src/analyzer.ts` imports from 5 different modules
- **THEN** one `IMPORTS_BATCH` object SHALL be created
- **THEN** `toIndexes` SHALL contain 5 integer indexes

#### Scenario: Single import preserved as batch
- **WHEN** `src/types.ts` imports from one module only
- **THEN** one `IMPORTS_BATCH` object SHALL be created with `toIndexes: [index]`

### Requirement: Schema version identifies compressed format
The system SHALL include `schemaVersion: {major: 1, minor: 1, patch: 0}` in compressed baselines.
Uncompressed baselines SHALL omit `schemaVersion` (implicit 1.0).

#### Scenario: Compressed baseline version
- **WHEN** compression is enabled during serialization
- **THEN** the output SHALL contain `schemaVersion: {major: 1, minor: 1, patch: 0}`

#### Scenario: Uncompressed baseline version
- **WHEN** compression is disabled
- **THEN** the output SHALL NOT contain `schemaVersion` field
- **THEN** consumers SHALL assume schema 1.0