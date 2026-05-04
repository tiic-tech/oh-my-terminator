## Why

Agent workflows need impact analysis to understand change blast radius before making modifications. Current CodeGraph provides raw graph traversal APIs but lacks structured analysis for "who depends on this file?" queries. This creates a gap for change planning and architecture validation.

**Problem**: Agents cannot efficiently analyze change impact or infer architecture layers without manual graph traversal.
**Why now**: C8 is required before CLI query commands (C10) and architecture constraint engine (M3) can be implemented.

## What Changes

- **New API**: `getImpact(targets)` - Returns affected files via BFS traversal on IMPORTS edges
  - Direct dependents (first layer)
  - Indirect dependents (transitive layer)
  - blastRadius classification (low/medium/high)
  - Depth-limited traversal (maxDepth default 10)
  - Test file exclusion (configurable)

- **New API**: `getArchitectureLayers(sourceRoot)` - Returns inferred architecture layer structure
  - First-level directory grouping
  - Import direction statistics
  - Layer assignment by netScore
  - Layer violation detection
  - healthScore calculation

- **New Types**: `ImpactResult`, `LayersResult`, `LayerAssignment`, `LayerViolation`

- **CLI Integration**: JSON output format defined for `codegraph impact` and `codegraph layers` commands (C10 mapping)

## Capabilities

### New Capabilities

- `impact-analysis`: Impact analysis API - returns affected files via BFS on IMPORTS edges, with depth limiting and blast radius classification
- `architecture-layers`: Architecture layers inference API - groups files by directory, infers layers by import direction, detects violations

### Modified Capabilities

- None (no existing spec-level requirements are being changed)

## Impact

**Affected Code**:
- `packages/codegraph/src/api/` - New module for impact and layers APIs (extends C7 structure)
- `packages/codegraph/src/api/types.ts` - Extended with ImpactResult, LayersResult types
- `packages/codegraph/src/index.ts` - Export new API functions
- `packages/codegraph/tests/unit/api/` - New test directory

**Dependencies**:
- Requires completed `scope-query` (C7) for scope integration
- Requires completed `graph-structure` (nodes, edges, inEdges, outEdges)

**CLI Integration** (C10):
- `codegraph impact <target...> --json` maps to ImpactResult
- `codegraph layers --json` maps to LayersResult

**Resolution Notes** (from ambiguity resolution):
- C8-1: Test files excluded by default (includeTests option)
- C8-2: maxDepth=0 returns only direct dependents
- C8-4: via field uses array format in API
- C8-6: DYNAMIC_IMPORTS excluded (aligns with C7 A2)
- C8-11: Same-layer mutual imports are warnings, not violations
- C8-12: Multi-target: distance=min, via=merged