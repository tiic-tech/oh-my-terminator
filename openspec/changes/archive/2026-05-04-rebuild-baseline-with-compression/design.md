## Context

Baseline.json files currently store full graph data without optimization. For large repositories:
- codegraph itself: 115KB baseline (manageable)
- Enterprise repos: Estimated 3.2MB+ (exceeds Agent token budgets)

Current schema 1.0 structure:
```json
{
  "nodes": [
    {"id": "FILE:src/analyzer.ts", "type": "FILE", "path": "src/analyzer.ts", ...}
  ],
  "edges": [
    {"id": "IMPORTS:src/a.ts:src/b.ts", "type": "IMPORTS", "source": "src/a.ts", "target": "src/b.ts"}
  ]
}
```

**Redundancies identified**:
1. `id` field duplicates tuple key (FILE:src/analyzer.ts = ["FILE", "src/analyzer.ts"])
2. JSDoc strings can be 200+ chars (documentation nodes)
3. Paths repeated in IMPORTS edges (node_modules dependencies appear 50+ times)
4. IMPORTS edges verbose (one object per edge)

## Goals / Non-Goals

**Goals:**
- Reduce baseline size by 20-60% (Phase 1: 20-30%)
- Preserve backward compatibility via migration (1.0 → 1.1)
- Enable Agent direct file read for <50KB baselines
- Maintain API compatibility (decompression transparent to consumers)

**Non-Goals:**
- Binary serialization (JSON remains human-readable)
- Streaming decompression (baseline loaded in memory)
- Compression configuration UI (config file only)

## Decisions

### D1: ID Field Removal (15-20% savings)

**Decision**: Remove redundant `id` field from nodes and edges. Tuple key `[type, path]` is canonical ID.

**Rationale**: 
- IDs are derived from node/edge content, not arbitrary
- FILE:src/analyzer.ts → ["FILE", "src/analyzer.ts"]
- IMPORTS:src/a:src/b → ["IMPORTS", "src/a", "src/b"]

**Schema change**:
```json
// Before (1.0)
{"id": "FILE:src/analyzer.ts", "type": "FILE", "path": "src/analyzer.ts"}

// After (1.1)
{"type": "FILE", "path": "src/analyzer.ts"}  // ID implicit
```

**API impact**: `getNodeById()` reconstructs ID from tuple.

**Alternative considered**: Keep ID for lookup O(1). Rejected: Map index provides O(1) without storage cost.

### D2: JSDoc Truncation (10-20% savings)

**Decision**: Truncate JSDoc to 100 chars (configurable) with `hasJSDoc: true` flag.

**Rationale**:
- Full JSDoc rarely consumed by Agents (80% use signature only)
- Truncation preserves existence signal (`hasJSDoc`)
- Configurable via `.codegraph/config.json`

**Schema change**:
```json
// Before (1.0)
{"jsDoc": "This function processes the input data and returns a transformed output with validation..."}

// After (1.1) - truncated
{"jsDoc": "This function processes the input data...", "jsDocTruncated": true}

// After (1.1) - no JSDoc
{"hasJSDoc": false}
```

**Config schema**:
```json
{
  "compression": {
    "jsDocMaxLength": 100  // default
  }
}
```

**Alternative considered**: Remove JSDoc entirely. Rejected: Documentation value for Agent reasoning.

### D3: Path Table (String Interning) (10-15% savings)

**Decision**: Create `pathTable: string[]` array, reference by index in nodes/edges.

**Rationale**:
- External dependency paths repeat frequently (e.g., "node_modules/react/index.js" appears 50+ times)
- String interning reduces repetition to single entry
- Index references: `{"type": "FILE", "pathIndex": 42}`

**Schema change**:
```json
{
  "schemaVersion": {"major": 1, "minor": 1, "patch": 0},
  "pathTable": [
    "src/analyzer.ts",
    "src/types.ts",
    "node_modules/react/index.js"
  ],
  "nodes": [
    {"type": "FILE", "pathIndex": 0}
  ],
  "edges": [
    {"type": "IMPORTS", "fromIndex": 0, "toIndex": 2}
  ]
}
```

**Sorting**: Path table sorted by total reference count (node references + edge references). Most frequently used paths get smallest indexes, minimizing index digit length in output.

**Decompression**: Replace `pathIndex` with actual path string.

**Alternative considered**: Dictionary compression. Rejected: More complex, less transparent.

### D4: Edge Batch Compression (5-10% savings)

**Decision**: Group IMPORTS edges by source file as arrays.

**Rationale**:
- IMPORTS edges dominate (70-80% of edges)
- Grouping reduces key repetition
- Format: `{"fromIndex": 0, "targetIndexes": [2, 5, 7]}`

**Schema change**:
```json
// Before (1.0) - 3 edge objects
{"id": "IMPORTS:src/a:src/b", "type": "IMPORTS", "source": "src/a", "target": "src/b"}
{"id": "IMPORTS:src/a:src/c", "type": "IMPORTS", "source": "src/a", "target": "src/c"}
{"id": "IMPORTS:src/a:src/d", "type": "IMPORTS", "source": "src/a", "target": "src/d"}

// After (1.1) - 1 batch object
{"type": "IMPORTS_BATCH", "fromIndex": 0, "targetIndexes": [1, 2, 3]}
```

**Alternative considered**: Keep edge array format. Rejected: Less efficient for high-degree nodes.

### D5: Schema Version Migration

**Decision**: Automatic 1.0 → 1.1 migration on first `cg analyze` with compression.

**Rationale**:
- Existing baselines remain usable
- Migration transforms 1.0 → 1.1 in-memory, writes compressed format
- One-time cost, subsequent updates use 1.1

**Migration flow**:
1. Load baseline.json (detect schemaVersion or assume 1.0)
2. Build pathTable from unique paths
3. Remove `id` fields
4. Truncate JSDoc
5. Batch IMPORTS edges
6. Write as 1.1 format

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Breaking change for manual baseline readers | Migration preserves 1.0 compatibility; documentation warns of format change |
| Decompression overhead on load | Benchmarks: ~50ms for 1MB baseline (acceptable for CLI) |
| JSDoc truncation loses info | Configurable length; `jsDocTruncated` flag signals full content elsewhere |
| Path table index confusion | Validate index bounds; clear error on corruption |
| Batch edges complicate edge iteration | Decompression restores edge array format for API consumers |

## Decisions Resolved

The following decisions were made before implementation:

| Decision | Resolution | Rationale |
|----------|------------|-----------|
| SchemaVersion format | Object `{major, minor, patch}` | Maintains SemVer compatibility with existing types.ts |
| Compression default | Enabled by default | Maximize token savings; `--no-compression` opt-out available |
| Config location | `.codegraph/config.json` | Separate from package.json, dedicated config file |
| GraphEdge field names | `fromIndex/toIndex` in compressed format | Consistent with existing `from/to` naming in types.ts |
| Path table sorting | Total reference count (nodes + edges) | Most frequently referenced paths get smallest indexes |
| Edge batching scope | IMPORTS only (Phase 1) | EXPORTS/CONTAINS batching deferred to Phase 2 |

## Migration Plan

1. **Phase 1 (C10)**: Implement compression (ID removal + JSDoc truncate + path table)
2. **Backward compat**: `loadBaseline()` detects schemaVersion, migrates 1.0 → 1.1
3. **Forward compat**: Write 1.1 format only when compression enabled
4. **Rollback**: Re-run `cg analyze --no-compression` to regenerate 1.0 format

