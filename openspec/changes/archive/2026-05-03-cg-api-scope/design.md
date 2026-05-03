## Context

The CodeGraph package provides graph-based code analysis with nodes (FILE, MODULE, EXTERNAL) and edges (IMPORTS, RE_EXPORTS, DYNAMIC_IMPORTS). The graph-structure capability (C6) provides the data model, but lacks query APIs that transform raw graph data into Agent-friendly output.

**Current State**:
- `graph.ts` provides `getNode()`, `outEdges`, `inEdges` for raw traversal
- No structured API for "what does this file export/import?"
- No reverse dependency lookup ("who imports this file?")
- No complexity aggregation or test file association

**Stakeholders**:
- CLI commands (`codegraph scope`, `codegraph brief`) need JSON output
- Impact analysis (C8) needs scope data as input
- Context injection (M4) needs compressed Markdown output for Agent prompts

## Goals / Non-Goals

**Goals:**
- Implement `getScope(target)` API returning structured ScopeResult
- Implement `getQuickBrief(filePath)` API returning QuickBriefResult
- Support FILE, MODULE, EXTERNAL node types as targets
- Generate Agent-friendly compressed Markdown output (≤600 tokens target)
- Define CLI JSON output schema for C10 integration
- Handle all edge cases documented in ambiguity resolution (A1-A6)

**Non-Goals:**
- Token truncation implementation (A3: deferred to Phase 2)
- CALLS edge processing (upstreamCalls/downstreamCalls remain empty in MVP)
- Performance optimization (caching, pre-computation)
- Git history integration for lastModified (uses metadata only)

## Decisions

### D1: Node Type Handling Strategy

**Decision**: normalizeTarget function handles four input types:
1. `FILE:xxx` → direct lookup
2. `MODULE:xxx#yyy` → resolve to parent FILE, optionally return MODULE detail
3. `EXTERNAL:xxx` → special handling (A1 resolution)
4. Plain path → auto-prefix `FILE:`

**Alternatives Considered**:
- Separate functions per type (`getScopeForFile`, `getScopeForModule`) → Rejected: increases API surface, complicates CLI mapping
- Type detection by parsing → Rejected: explicit prefixes clearer

**Rationale**: Single entry point with smart normalization simplifies CLI integration and follows existing ID conventions.

### D2: Edge Count Semantics

**Decision**: countImports/countImportedBy count edges, not unique files (A4 resolution)

**Alternatives Considered**:
- Unique file count → Rejected: loses dependency density information
- Hybrid (both counts) → Rejected: adds complexity for minimal value

**Rationale**: Edge count reflects "how many import relationships" which is more useful for understanding dependency density. A file importing 5 symbols from the same file shows higher coupling than importing 1 symbol.

### D3: DYNAMIC_IMPORTS Reverse Index

**Decision**: extractImportedBy excludes DYNAMIC_IMPORTS edges (A2 resolution)

**Rationale**: Dynamic imports resolve at runtime. We can track that file A dynamically imports something, but the target file B cannot know who dynamically imports it. This is inherent asymmetry in static analysis.

### D4: Complexity Default Value

**Decision**: Return "unknown" when no MODULE data exists (A6 resolution)

**Alternatives Considered**:
- Return "low" → Rejected: misleading, implies analysis was done
- Return null → Rejected: breaks type contract

**Rationale**: "unknown" clearly indicates "not analyzed" vs "low complexity analyzed".

### D5: Output Format Strategy

**Decision**: Dual output - structured data + compressed Markdown

**Alternatives Considered**:
- Only structured JSON → Rejected: requires Agent to format
- Only Markdown → Rejected: limits CLI programmability

**Rationale**: Structured data for CLI/programmatic use, Markdown for Agent context injection.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Large files exceed 600 token target | A3: Phase 2 truncation; MVP documents typical estimates |
| MODULE node lookup O(n) over all nodes | Accept for MVP; add index in optimization phase |
| Test file naming convention misses custom patterns | Document common patterns; allow metadata override |
| EXTERNAL packages without nodes return error | A1: Return scope with empty imports, show importedBy |
| Circular import chains cause redundant output | Accept in MVP; consider deduplication in Phase 2 |

## Migration Plan

No migration required - new capability addition.

**Deployment Steps**:
1. Implement `packages/codegraph/src/api/types.ts`
2. Implement `packages/codegraph/src/api/scope.ts`
3. Add unit tests in `packages/codegraph/tests/unit/api/`
4. Export from `packages/codegraph/src/index.ts`
5. Update README with API usage examples

**Rollback**: Remove api/ directory, revert index.ts exports.

## Open Questions

- Should we pre-compute FILE-level complexity during analysis phase? (Deferred: Phase 2 optimization)
- Should CALLS edges be populated by M2 milestone? (Yes: documented in §1.4 as TODO)
- CLI command implementation timing? (C10: separate change)