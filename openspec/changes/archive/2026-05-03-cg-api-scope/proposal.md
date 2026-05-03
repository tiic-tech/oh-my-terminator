## Why

The CodeGraph needs query APIs to provide meaningful context information for Agent workflows. Current graph data (nodes, edges) is raw and requires manual traversal to answer questions like "what does this file export?" or "who imports this module?". This creates a gap between graph data and Agent-friendly output.

**Problem**: Agents cannot efficiently query file/module context without traversing raw graph structures.
**Why now**: C7 is the foundational query layer required before impact analysis (C8) and context injection (M4) can be implemented.

## What Changes

- **New API**: `getScope(target)` - Returns complete context for FILE/MODULE/EXTERNAL nodes
  - Export list (kind:name format)
  - Import list (with type markers)
  - Imported-by list (reverse dependencies)
  - Test file association
  - Complexity aggregation
  - Deprecated detection
  - Agent-friendly compressed Markdown output

- **New API**: `getQuickBrief(filePath)` - Returns minimal statistics
  - Import/ImportedBy counts (edge counts, not file counts - A4决议)
  - HasTest flag
  - Deprecated flag
  - Complexity level

- **New Types**: `ScopeResult`, `QuickBriefResult`, `ComplexityInfo`

- **CLI Integration**: JSON output format defined for `codegraph scope` and `codegraph brief` commands (C10 mapping)

## Capabilities

### New Capabilities

- `scope-query`: Scope query API for FILE/MODULE/EXTERNAL nodes - returns exports, imports, importedBy, testFile, complexity, deprecated status in structured and Markdown formats
- `quick-brief`: QuickBrief API for minimal file statistics - returns import/importedBy counts, hasTest, deprecated, complexityLevel

### Modified Capabilities

- None (no existing spec-level requirements are being changed)

## Impact

**Affected Code**:
- `packages/codegraph/src/api/` - New module for query APIs
- `packages/codegraph/src/index.ts` - Export new API functions
- `packages/codegraph/tests/unit/api/` - New test directory

**Dependencies**:
- Requires completed `graph-structure` (nodes, edges, inEdges, outEdges)
- Requires completed `baseline-persistence` (graph loading)

**CLI Integration** (C10):
- `codegraph scope <target> --json` maps to ScopeResult
- `codegraph brief <file> --json` maps to BriefResult

**Resolution Notes** (from ambiguity resolution):
- A1: EXTERNAL node handling added to normalizeTarget
- A2: DYNAMIC_IMPORTS excluded from importedBy (runtime-resolved)
- A3: Token truncation deferred to Phase 2
- A4: Count semantics use edge count (not file count)
- A5: MODULE ID not found returns specific warning
- A6: Complexity returns "unknown" when no MODULE data (not "low")