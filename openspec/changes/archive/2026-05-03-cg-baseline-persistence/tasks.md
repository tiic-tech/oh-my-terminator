# C6: Baseline Persistence Implementation Tasks

> Estimated: 10 days | Priority: CORE | Depends on: C1, C5

---

## 1. Package Setup & Types

- [x] 1.1 Create `packages/codegraph/src/persistence/` directory structure
- [x] 1.2 Create `packages/codegraph/src/persistence/types.ts` with Baseline interface
- [x] 1.3 Add SkillDemand interface to persistence/types.ts (reference Blueprint §3.4)
- [x] 1.4 Add MigrationRecord interface to persistence/types.ts
- [x] 1.5 Add LoadBaselineOptions and LoadBaselineResult interfaces
- [x] 1.6 Add SaveBaselineOptions interface
- [x] 1.7 Add CompatibilityResult, CompatibilityReason, CompatibilityAction types
- [x] 1.8 Add LoadFailureReason type enum
- [x] 1.9 Add ActionConfig, ActionResult, FailureInfo interfaces
- [x] 1.10 Add ValidationResult and IntegrityResult interfaces
- [x] 1.11 Add MigrationScript interface
- [x] 1.12 Create `packages/codegraph/src/version.ts` with CURRENT_SCHEMA_VERSION and GENERATOR_VERSION constants
- [x] 1.13 Add LEGACY_VERSION constant to version.ts
- [x] 1.14 Extend SerializedCodeGraph in types.ts with optional schemaVersion field
- [x] 1.15 Create persistence/index.ts to export all persistence types

## 2. SchemaVersion Implementation

- [x] 2.1 Create `packages/codegraph/src/version.ts` with SchemaVersion class (Note: placed in root version.ts per design)
- [x] 2.2 Implement SchemaVersion constructor with validation (numeric, non-negative)
- [x] 2.3 Implement SchemaVersion.toString() method
- [x] 2.4 Implement SchemaVersion.parse() static method with strict validation
- [x] 2.5 Implement SchemaVersion.isGreaterThan() comparison method
- [x] 2.6 Implement SchemaVersion.isCompatibleWith() method (major match)
- [x] 2.7 Add unit tests for SchemaVersion parsing (valid/invalid formats)
- [x] 2.8 Add unit tests for SchemaVersion comparison operations
- [x] 2.9 Add unit tests for version string validation (negative, non-numeric)

## 3. Directory Paths & Constants

- [x] 3.1 Create `packages/codegraph/src/persistence/paths.ts` with path definitions
- [x] 3.2 Define CODEGRAPH_DIR = '.codegraph' constant
- [x] 3.3 Define BASELINE_FILE, LAST_COMMIT_FILE, VERSION_FILE paths
- [x] 3.4 Define MIGRATION_LOG_FILE path
- [x] 3.5 Implement getBaselinePath(cwd: string) helper function
- [x] 3.6 Implement getLastCommitPath(cwd: string) helper function
- [x] 3.7 Implement ensureCodegraphDir(cwd: string) to create directory if missing

## 4. Compatibility Checking

- [x] 4.1 Create `packages/codegraph/src/persistence/compatibility.ts`
- [x] 4.2 Implement checkSchemaCompatibility(baseline, currentVersion) function
- [x] 4.3 Handle legacy baseline case (no schemaVersion)
- [x] 4.4 Handle major version mismatch cases (baseline higher/lower)
- [x] 4.5 Handle minor version outdated case
- [x] 4.6 Handle patch version outdated case
- [x] 4.7 Handle version match case
- [x] 4.8 Implement determineAction(result, config) function
- [x] 4.9 Add autoMigrate configuration handling in determineAction
- [x] 4.10 Add forceAction override handling in determineAction
- [x] 4.11 Implement executeAction(action, baseline, cwd, config) function
- [x] 4.12 Add IncompatibleBaselineError class
- [x] 4.13 Add unit tests for checkSchemaCompatibility all scenarios
- [x] 4.14 Add unit tests for determineAction strategy matrix
- [x] 4.15 Add unit tests for executeAction error cases

## 5. Baseline Loading & Validation

- [x] 5.1 Create `packages/codegraph/src/persistence/baseline.ts`
- [x] 5.2 Implement validateBaselineStructure(data: unknown) function
- [x] 5.3 Add validation for required fields (graph, commitHash, timestamp)
- [x] 5.4 Add validation for graph.nodes and graph.edges arrays
- [x] 5.5 Add validation for optional schemaVersion structure
- [x] 5.6 Implement verifyDataIntegrity(baseline) function
- [x] 5.7 Add node ID uniqueness check in verifyDataIntegrity
- [x] 5.8 Add node.id matches stored ID check
- [x] 5.9 Add edge reference validity check (from/to exist in nodes)
- [x] 5.10 Add timestamp future check (with 60s tolerance)
- [x] 5.11 Add commitHash format validation (7-40 hex chars)
- [x] 5.12 Implement handleFailure(reason, cwd, options, details) function
- [x] 5.13 Handle file_not_found scenario (trigger rebuild)
- [x] 5.14 Handle parse_error scenario (return failure)
- [x] 5.15 Handle invalid_structure scenario (rebuild or strict failure)
- [x] 5.16 Handle corrupted_data scenario (auto rebuild)
- [x] 5.17 Handle schema_incompatible scenario (respect compatResult)
- [x] 5.18 Handle permission_error scenario (return failure)
- [x] 5.19 Implement loadBaseline(cwd, options) main function with all steps
- [x] 5.20 Add dependency injection support via rebuildHandler option
- [x] 5.21 Add unit tests for validateBaselineStructure
- [x] 5.22 Add unit tests for verifyDataIntegrity
- [x] 5.23 Add unit tests for handleFailure all scenarios
- [x] 5.24 Add unit tests for loadBaseline complete flow

## 6. Baseline Saving (Atomic Write)

- [x] 6.1 Implement saveBaseline(baseline, cwd, options) function
- [x] 6.2 Implement atomic write: write to .tmp file first
- [x] 6.3 Implement atomic rename to final location
- [x] 6.4 Implement optional backup creation (createBackup option)
- [x] 6.5 Implement file permission handling (inherit or default 0644)
- [x] 6.6 Update lastCommit.txt after baseline save
- [x] 6.7 Optionally create .version file
- [x] 6.8 Handle write errors (disk full, permission denied)
- [x] 6.9 Add unit tests for atomic write success
- [x] 6.10 Add unit tests for backup creation
- [x] 6.11 Add integration test for save/load round-trip

## 7. Migration Framework

- [x] 7.1 Create `packages/codegraph/src/persistence/migrations/` directory
- [x] 7.2 Create migrations/index.ts with migration registry Map
- [x] 7.3 Implement registerMigration(script) function
- [x] 7.4 Implement versionMatchesPattern(version, pattern) with 'x' wildcard
- [x] 7.5 Implement findMigrationPath(fromV, toV) with BFS
- [x] 7.6 Add wildcard matching support in findMigrationPath
- [x] 7.7 Implement migrateBaseline(baseline, cwd) function
- [x] 7.8 Execute multi-step migrations in sequence
- [x] 7.9 Update schemaVersion after each migration step
- [x] 7.10 Append to migrationHistory after each step
- [x] 7.11 Implement safeMigrateBaseline with backup/restore
- [x] 7.12 Restore backup on migration failure
- [x] 7.13 Trigger rebuild when no migration path exists
- [x] 7.14 Add checksum fields to MigrationRecord (optional)
- [x] 7.15 Optionally write migration.log entries
- [x] 7.16 Add unit tests for registerMigration
- [x] 7.17 Add unit tests for versionMatchesPattern wildcard matching
- [x] 7.18 Add unit tests for findMigrationPath BFS logic
- [x] 7.19 Add unit tests for migrateBaseline single/multi-step
- [x] 7.20 Add unit tests for safeMigrateBaseline rollback

## 8. Legacy Migration Script

- [x] 8.1 Create migrations/legacy-to-1.0.0.ts
- [x] 8.2 Implement migration adding schemaVersion 1.0.0
- [x] 8.3 Implement migration adding generatorVersion "1.0.0"
- [x] 8.4 Initialize migrationHistory with single record
- [x] 8.5 Preserve all existing graph data unchanged
- [x] 8.6 Register the script in migrations/index.ts
- [x] 8.7 Add unit test for legacy baseline migration

## 9. Graph.ts Modifications

- [x] 9.1 Update CodeGraph.toJSON() to include schemaVersion when set
- [x] 9.2 Add optional schemaVersion property to CodeGraph class
- [x] 9.3 Update CodeGraph.fromJSON() to handle optional schemaVersion
- [x] 9.4 Add unit test for toJSON with schemaVersion
- [x] 9.5 Add unit test for fromJSON with optional schemaVersion

## 10. Index Exports

- [x] 10.1 Update packages/codegraph/src/index.ts to export persistence types
- [x] 10.2 Export loadBaseline, saveBaseline functions
- [x] 10.3 Export migrateBaseline, safeMigrateBaseline functions
- [x] 10.4 Export SchemaVersion class
- [x] 10.5 Export CURRENT_SCHEMA_VERSION, GENERATOR_VERSION constants
- [x] 10.6 Export compatibility functions

## 11. Integration Tests

- [x] 11.1 Create test fixture project with TypeScript files
- [x] 11.2 Add integration test for full analysis → save → load cycle
- [x] 11.3 Add integration test for legacy baseline migration
- [x] 11.4 Add integration test for corrupted baseline recovery
- [x] 11.5 Add integration test for schema incompatible handling
- [x] 11.6 Add integration test for permission error handling
- [x] 11.7 Add integration test for large baseline fixture (performance)
- [x] 11.8 Add integration test for multi-step migration execution

## 12. Documentation

- [x] 12.1 Update README.md with baseline persistence usage
- [x] 12.2 Document .codegraph directory structure
- [x] 12.3 Document CLI version/migrate commands (for C9 reference)
- [x] 12.4 Add API documentation for loadBaseline/saveBaseline
- [x] 12.5 Document migration script writing guide

---

## Summary

| Group | Tasks | Est. Days |
|-------|-------|-----------|
| 1. Package Setup & Types | 15 | 1-2 |
| 2. SchemaVersion Implementation | 9 | 1 |
| 3. Directory Paths & Constants | 7 | 0.5 |
| 4. Compatibility Checking | 15 | 1-2 |
| 5. Baseline Loading & Validation | 24 | 2 |
| 6. Baseline Saving | 11 | 1 |
| 7. Migration Framework | 20 | 2 |
| 8. Legacy Migration Script | 7 | 0.5 |
| 9. Graph.ts Modifications | 5 | 0.5 |
| 10. Index Exports | 6 | 0.5 |
| 11. Integration Tests | 8 | 1 |
| 12. Documentation | 5 | 0.5 |
| **Total** | **122** | **10** |

---

## Notes

- Tasks follow TDD workflow: write test first, then implementation
- Each task group completion triggers checkpoint commit
- Complex groups (5, 7) may be split into batches during implementation
- CLI commands (version, migrate) implemented in C9, this change provides core functions