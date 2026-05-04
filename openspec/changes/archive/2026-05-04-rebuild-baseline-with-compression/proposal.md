## Why

Current baseline.json size (115KB in codegraph, potentially 3.2MB+ in large repos) exceeds Agent token budget for direct consumption. Agents must use API instead of reading baseline directly, limiting flexibility. Compression can reduce size 20-60%, enabling baseline file reading for small-to-medium repos and faster API operations for large repos.

## What Changes

- **ID Deduplication**: Remove redundant `id` field from node/edge objects (tuple key is canonical ID)
- **JSDoc Truncation**: Truncate to 100 chars (configurable) or use `hasJSDoc` boolean flag
- **Path Table**: String interning for repeated paths (especially external dependencies)
- **Edge Batch Compression**: Group IMPORTS edges by source file
- **BREAKING**: Schema version bump 1.0 → 1.1 (migration required)

## Capabilities

### New Capabilities

- `baseline-compression`: ID deduplication, JSDoc truncation, path table, edge batching
- `compression-config`: Configurable truncation limits via `.codegraph/config.json`

### Modified Capabilities

- `baseline-persistence`: Serialize/deserialize with compression format
- `baseline-migration`: Add 1.0→1.1 migration script for existing baselines

## Impact

| Area | Change |
|------|--------|
| `src/persistence/save.ts` | Compressed serialization |
| `src/persistence/baseline/` | Deserialize with decompression |
| `src/persistence/migrations/` | 1.0→1.1 migration script |
| `src/types.ts` | Compression config types |
| Baseline size | 20-30% reduction (Phase 1) |
| Token budget | Enables direct file read for <50KB baselines |