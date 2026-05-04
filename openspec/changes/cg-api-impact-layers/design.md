## Context

CodeGraph provides raw graph traversal APIs (nodes, edges, inEdges, outEdges from C6). C7 added scope-query capabilities. C8 introduces structured analysis APIs for impact analysis and architecture layer inference.

**Background**: The 08_c8_impact_layers_spec.md document provides detailed algorithm specifications with 12 ambiguity resolutions documented in c8_ambiguity_resolution.md.

**Constraints**:
- Must align with C7 scope-query patterns (API structure, error codes)
- Must not include DYNAMIC_IMPORTS edges (C8-6, aligned with C7 A2)
- Must use existing graph data structures (no new node/edge types)

**Stakeholders**:
- CLI commands (C10) will consume these APIs
- Architecture constraint engine (M3) will use layer violations
- Agent workflows need impact analysis for change planning

## Goals / Non-Goals

**Goals:**
- Implement `getImpact(targets)` with BFS traversal on IMPORTS edges
- Implement `getArchitectureLayers(sourceRoot)` with directory grouping and layer inference
- Provide structured output with blast radius classification and health score
- Define CLI JSON output format for C10 integration
- Exclude test files by default (includeTests option)
- Support depth-limited traversal (maxDepth)

**Non-Goals:**
- CALLS edge handling (M2 scope)
- Function-level impact analysis (M2 scope)
- Real-time graph updates (out of MVP scope)
- Circular dependency breaking recommendations (M3 scope)
- Visualization output (CLI text format only, no diagrams)

## Decisions

### D1: BFS Traversal Direction

**Decision**: Use reverse traversal via `inEdges` (from dependent to target)

**Rationale**: 
- IMPORTS edge direction: `from` (dependent) → `to` (imported file)
- To find dependents, traverse reverse: follow `inEdges` to find who imports target
- Alternative (forward traversal from target) would require edge filtering for IMPORTS type

**Alternatives Considered**:
- Forward traversal: More complex edge filtering, less intuitive
- Bidirectional tracking: Overkill for current MVP scope

### D2: Test File Exclusion Strategy

**Decision**: Filter test directories at traversal level, not at result level

**Rationale** (C8-1):
- Prevents test files from entering BFS queue early
- More efficient than post-hoc filtering
- Matches C7 A2 approach for consistency
- Default exclude: `tests/`, `__tests__/`, `*.test.ts`, `*.spec.ts`

**Implementation**: Check `isTestFile(nodeId)` before adding to visited set

### D3: Layer Threshold Value

**Decision**: `LAYER_THRESHOLD = 2` for grouping adjacent scores

**Rationale** (C8-3):
- Small threshold allows fine-grained layer separation
- Adjacent groups with score difference ≤ 2 merge to same layer
- Prevents over-fragmentation of layers

**Formula**: `|scoreA - scoreB| <= LAYER_THRESHOLD → same layer`

### D4: via Field Format

**Decision**: Array format `via: string[]` in API and CLI JSON

**Rationale** (C8-4):
- Supports multi-path scenarios (indirect dependent via multiple routes)
- Structured data easier to parse programmatically
- Text output can simplify with comma-separated display

**Alternative**: Single string with comma separation - rejected for JSON consistency

### D5: healthScore Calculation

**Decision**: Base 100, subtract by severity

**Rationale** (C8-5):
- Simple linear formula, easy to understand
- Severity weights: minor=-5, moderate=-10, critical=-15
- Minimum 0, maximum 100

**Formula**: 
```typescript
healthScore = Math.max(0, 100 - violations.reduce((sum, v) => {
  return sum + (v.layerGap >= 3 ? 15 : v.layerGap === 2 ? 10 : 5);
}, 0));
```

### D6: Same-Layer Mutual Imports

**Decision**: Not violations, optional warning

**Rationale** (C8-11):
- Same-layer mutual imports are architecturally valid (e.g., utils utilities calling each other)
- Warning mode via `options.warnOnMutualImport` flag
- Prevents false-positive violation reports

### D7: Multi-Target Distance Merge

**Decision**: Take minimum distance, merge via paths

**Rationale** (C8-12):
- User cares about shortest impact path
- `distance = min(distancesFromTargets)`
- `via = viaPathsForMinDistance`

## Risks / Trade-offs

### R1: Large Graph Performance
- **Risk**: BFS traversal O(V+E) may be slow for 1000+ file projects
- **Mitigation**: Set default maxDepth=10, use Set for visited tracking, early termination options

### R2: Flat Project Structure
- **Risk**: Projects without clear directory hierarchy may produce meaningless layers
- **Mitigation**: Return `healthScore: 0` with warning for single-layer projects, suggest manual layer config

### R3: Dynamic Import Blind Spot
- **Risk**: DYNAMIC_IMPORTS edges excluded means missing runtime dependencies
- **Mitigation**: Document limitation clearly, suggest complementary runtime analysis tools

### R4: Layer Role Naming
- **Risk**: Generic roles (Foundation/Core/Application/Presentation) may not match all projects
- **Mitigation**: Allow role customization via future config option (M3 scope)

### R5: Test File Detection
- **Risk**: Heuristic detection may miss unconventional test file patterns
- **Mitigation**: Provide `includeTests: true` override, document detection criteria

## Migration Plan

This is a new API addition, no migration required.

**Deployment Steps**:
1. Implement API functions in `packages/codegraph/src/api/impact.ts` and `layers.ts`
2. Export from `packages/codegraph/src/api/index.ts`
3. Update `packages/codegraph/src/index.ts` with public exports
4. Add unit tests following C7 patterns
5. Document CLI JSON format for C10 reference

**Rollback**: Safe to remove exports if issues found (no breaking changes to existing APIs)

## Open Questions

None - all 12 ambiguities resolved in c8_ambiguity_resolution.md:
- C8-1: Test file exclusion ✓
- C8-2: maxDepth=0 semantics ✓
- C8-3: LAYER_THRESHOLD examples ✓
- C8-4: via format ✓
- C8-5: healthScore formula ✓
- C8-6: DYNAMIC_IMPORTS exclusion ✓
- C8-7: Error code extension ✓
- C8-8: blastRadius boundaries ✓
- C8-9: nextSuggested logic ✓
- C8-10: layerGap naming ✓
- C8-11: Same-layer mutual imports ✓
- C8-12: Multi-target merge ✓