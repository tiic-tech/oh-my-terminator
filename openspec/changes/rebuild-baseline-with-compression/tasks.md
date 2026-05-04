## 1. Types & Configuration

- [x] 1.1 Define `CompressionOptions` interface in types.ts
- [x] 1.2 Define `CompressionConfig` interface in types.ts
- [x] 1.3 Add `schemaVersion` field to `BaselineData` type
- [x] 1.4 Add `jsDocMaxLength`, `jsDocTruncated`, `hasJSDoc` fields to MODULE node type
- [x] 1.5 Define `PathTable` type as `string[]`
- [x] 1.6 Define `CompressedNode` interface (no id, pathIndex)
- [x] 1.7 Define `CompressedEdge` interface (no id, pathIndex references)
- [x] 1.8 Define `IMPORTS_BATCH` edge type with `targetIndexes: number[]`
- [x] 1.9 Define `CliErrorCode.E_INVALID_CONFIG` enum value (already exists in types.ts, verify compatibility)
- [x] 1.10 Write unit tests for compression types

## 2. Compression Module

- [x] 2.1 Create `src/persistence/compression/` directory
- [x] 2.2 Create `src/persistence/compression/index.ts` entry point
- [x] 2.3 Create `src/persistence/compression/id-deduplication.ts`
- [x] 2.4 Implement `removeIds(nodes: Node[]): CompressedNode[]`
- [x] 2.5 Implement `reconstructNodeId(type: string, pathIndex: number): string`
- [x] 2.6 Create `src/persistence/compression/jsdoc-truncate.ts`
- [x] 2.7 Implement `truncateJSDoc(jsDoc: string, maxLength: number): TruncatedJSDoc`
- [x] 2.8 Create `src/persistence/compression/path-table.ts`
- [x] 2.9 Implement `buildPathTable(nodes: Node[], edges: Edge[]): string[]`
- [x] 2.10 Implement `resolvePathIndex(path: string, table: string[]): number`
- [x] 2.11 Implement `resolvePathFromIndex(index: number, table: string[]): string`
- [x] 2.12 Create `src/persistence/compression/edge-batcher.ts`
- [x] 2.13 Implement `batchImportsEdges(edges: Edge[], pathTable: string[]): IMPORTS_BATCH[]` (uses fromIndex/targetIndexes)
- [x] 2.14 Implement `expandBatchedEdges(batches: IMPORTS_BATCH[], pathTable: string[]): Edge[]`
- [x] 2.15 Create `src/persistence/compression/serializer.ts`
- [x] 2.16 Implement `serializeCompressed(graph: Graph, config: CompressionConfig): CompressedBaseline` (schemaVersion as object)
- [x] 2.17 Implement `deserializeCompressed(data: CompressedBaseline): Graph`
- [x] 2.18 Write unit tests for id-deduplication module
- [x] 2.19 Write unit tests for jsdoc-truncate module
- [x] 2.20 Write unit tests for path-table module
- [x] 2.21 Write unit tests for edge-batcher module
- [x] 2.22 Write unit tests for serializer module
- [x] 2.23 Define `CliErrorCode.E_INDEX_OUT_OF_BOUNDS` enum value
- [x] 2.24 Define `CliErrorCode.E_CORRUPTED_BASELINE` enum value
- [x] 2.25 Implement compression error handling in serializer.ts
- [x] 2.26 Write unit tests for compression error handling

## 3. Configuration System

- [ ] 3.1 Create `src/config/` directory
- [ ] 3.2 Create `src/config/load-config.ts`
- [ ] 3.3 Implement `loadCompressionConfig(projectPath: string): CompressionConfig`
- [ ] 3.4 Create `src/config/validate-config.ts`
- [ ] 3.5 Implement `validateCompressionConfig(config: unknown): CompressionConfig | Error`
- [ ] 3.6 Add default config values (jsDocMaxLength: 100)
- [ ] 3.7 Handle missing config file gracefully
- [ ] 3.8 Write unit tests for config loader
- [ ] 3.9 Write unit tests for config validator

## 4. Migration Module

- [x] 4.1 Create `src/persistence/migrations/1.0-to-1.1.ts`
- [x] 4.2 Implement `migrate1_0To1_1(data: BaselineData_1_0): CompressedBaseline`
- [x] 4.3 Implement migration edge case handling (empty baseline, no imports)
- [x] 4.4 Add migration detection to `loadBaseline()`
- [x] 4.5 Write unit tests for 1.0→1.1 migration

## 5. Persistence Integration

- [ ] 5.1 Update `src/persistence/save.ts` to support compression option
- [ ] 5.2 Add `compress` parameter to `saveBaseline()` function
- [ ] 5.3 Update `src/persistence/load.ts` (or create if missing)
- [ ] 5.4 Add schema version detection to `loadBaseline()`
- [ ] 5.5 Implement transparent decompression on load
- [ ] 5.6 Update `src/persistence/index.ts` exports
- [ ] 5.7 Write integration tests for save/load with compression

## 6. CLI Integration

- [ ] 6.1 Add `--compress` flag to analyze command
- [ ] 6.2 Add `--no-compression` flag to analyze command
- [ ] 6.3 Set compression as default (compress: true unless --no-compression)
- [ ] 6.4 Create `src/cli/commands/migrate.ts` for manual migration
- [ ] 6.5 Implement `cg migrate --input <path> --output <path>` command
- [ ] 6.6 Add migration statistics output (size reduction, savings %)
- [ ] 6.7 Register migrate command in CLI entry point
- [ ] 6.8 Add compression stats to analyze/update result output
- [ ] 6.9 Write unit tests for CLI compression flags
- [ ] 6.10 Write unit tests for migrate command
- [ ] 6.11 Add `--compress` flag to update command (inherit analyze behavior)
- [ ] 6.12 Add `--no-compression` flag to update command
- [ ] 6.13 Write unit tests for update command compression flags

## 7. Integration Tests

- [ ] 7.1 Create test fixture: sample 1.0 baseline.json
- [ ] 7.2 Create test fixture: expected 1.1 compressed output
- [ ] 7.3 Write integration test: full compression flow (analyze → save → load)
- [ ] 7.4 Write integration test: migration from 1.0 to 1.1
- [ ] 7.5 Write integration test: config file loading
- [ ] 7.6 Write integration test: CLI migrate command
- [ ] 7.7 Write integration test: compression disabled (--no-compression)
- [ ] 7.8 Verify size reduction meets 20-30% target
- [ ] 7.9 Benchmark decompression performance (target: <50ms for 1MB baseline)
- [ ] 7.10 Benchmark compression performance during save

## 8. Documentation & Finalization

- [ ] 8.1 Update README with compression feature documentation
- [ ] 8.2 Add migration guide for existing users
- [ ] 8.3 Add config file schema documentation
- [ ] 8.4 Document `--no-compression` permanent disable option for backward compat users
- [ ] 8.5 Run full test suite: `pnpm test`
- [ ] 8.6 Run TypeScript type check: `pnpm build`
- [ ] 8.7 Verify 80%+ test coverage