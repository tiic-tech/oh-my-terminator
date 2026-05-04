## ADDED Requirements

### Requirement: Automatic migration on first load
The system SHALL automatically migrate 1.0 baselines to internal 1.1 representation.
Migration SHALL occur transparently during `loadBaseline()`.
Migrated data SHALL be written in 1.1 format on next `saveBaseline()`.

#### Scenario: First load of 1.0 baseline
- **WHEN** existing baseline.json lacks `schemaVersion`
- **THEN** system SHALL build pathTable from unique paths
- **THEN** system SHALL remove `id` fields during internal transformation
- **THEN** graph API SHALL work with migrated data

#### Scenario: Save after migration
- **WHEN** migrated graph is saved with compression enabled
- **THEN** output SHALL be in 1.1 format
- **THEN** subsequent loads SHALL use 1.1 decompression

### Requirement: Migration preserves all graph data
Migration SHALL NOT lose any nodes, edges, or metadata.
All IMPORTS edges SHALL be preserved in batched format.
All node properties (jsDoc, signature, etc.) SHALL be preserved.

#### Scenario: Edge count preserved
- **WHEN** 1.0 baseline has 1000 IMPORTS edges
- **THEN** migrated 1.1 baseline SHALL represent all 1000 edges (batched)
- **THEN** `graph.getEdges()` SHALL return 1000 edges after decompression

#### Scenario: JSDoc preserved
- **WHEN** 1.0 baseline has MODULE node with JSDoc of 150 chars
- **THEN** migrated 1.1 SHALL truncate to 100 chars
- **THEN** `jsDocTruncated: true` SHALL indicate truncation

### Requirement: Migration handles edge cases
Empty baselines SHALL migrate successfully.
Baselines with no IMPORTS edges SHALL migrate successfully.
Baselines with no JSDoc SHALL migrate successfully.

#### Scenario: Empty baseline migration
- **WHEN** 1.0 baseline has empty nodes and edges arrays
- **THEN** migration SHALL produce valid 1.1 baseline
- **THEN** `pathTable` SHALL be empty array

#### Scenario: No IMPORTS edges
- **WHEN** 1.0 baseline has CONTAINS edges only
- **THEN** migration SHALL NOT create any IMPORTS_BATCH objects
- **THEN** CONTAINS edges SHALL be preserved (not batched)

### Requirement: Migration script available for manual use
CLI SHALL provide `cg migrate` command for explicit migration.
Command SHALL accept `--input` and `--output` paths.
Command SHALL report migration statistics (savings percentage).

#### Scenario: Manual migration command
- **WHEN** user runs `cg migrate --input baseline-v1.json --output baseline-v1.1.json`
- **THEN** output file SHALL be in 1.1 format
- **THEN** CLI SHALL print "Size reduced by 25% (115KB → 86KB)"

#### Scenario: Migration with stats
- **WHEN** migration completes successfully
- **THEN** stats SHALL include: original size, compressed size, savings percentage
- **THEN** stats SHALL include: nodes migrated, edges migrated, unique paths

### Requirement: Backward compatibility supported via permanent disable
The system SHALL support `--no-compression` flag for backward compatibility.
Users SHALL be able to permanently disable compression for their workflow.
Baselines saved with `--no-compression` SHALL remain in 1.0 format indefinitely.

#### Scenario: User wants uncompressed baseline permanently
- **WHEN** user runs `cg analyze --no-compression` on all analyze/update operations
- **THEN** baseline SHALL always be saved in 1.0 format
- **THEN** no migration or decompression overhead occurs
- **THEN** graph API SHALL work identically with uncompressed data

#### Scenario: Mixed workflow (some compressed, some uncompressed)
- **WHEN** user runs `cg analyze --compress` initially, then `cg analyze --no-compression`
- **THEN** the new baseline SHALL be saved in 1.0 format (reverting to uncompressed)
- **THEN** this is valid workflow for comparison purposes

#### Scenario: Documenting permanent disable
- **WHEN** user reads migration documentation
- **THEN** documentation SHALL explain `--no-compression` option for backward compat
- **THEN** documentation SHALL warn of larger baseline sizes without compression