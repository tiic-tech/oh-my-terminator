# C3 (TypeScript Parser - Imports) OpenSpec Readiness Assessment

**Assessment Date**: 2026-05-03
**Assessor**: Claude Code Agent
**Change ID**: C3 - `cg-ts-parser-imports`
**Target Milestone**: M1 - MVP

---

## Executive Summary

| Criterion | Status | Details |
|-----------|--------|---------|
| Input/Output Definitions | READY | Clear interfaces defined in blueprint |
| Ambiguous Terms | NEEDS_CLARIFICATION | 3 items require resolution |
| Dependencies | READY | C1 and C2 fully implemented |
| Testable Specifications | PARTIAL | Test fixtures not yet created |
| Implementation Approach | READY | Detailed in blueprint 4.2 |

**Overall Readiness**: **NEEDS_CLARIFICATION**

C3 can proceed to openspec creation after resolving 3 minor ambiguities and preparing test fixtures.

---

## 1. C3 Scope Summary

### 1.1 Change Definition (from develop_changes_plan.md)

```
Change 3: TS/JS Parser - Import Extraction [PARSER]

Name: cg-ts-parser-imports
Duration: 2 days
Dependencies: C1 (graph structure), C2 (file scanner)

Goals:
- Based on TypeScript Compiler API, extract file-level import relationships
- Generate IMPORTS, RE_EXPORTS, DYNAMIC_IMPORTS edges
- Module path resolution (relative and alias paths)
- Create EXTERNAL nodes for external dependencies

Verification:
- Test fixture repository imports correctly extracted
- Alias paths (tsconfig.json paths) correctly resolved
- External dependencies correctly marked

Deliverables:
packages/codegraph/src/parser/
├─ ts-parser.ts       # TypeScript parser main logic
├─ import-resolver.ts # Module path resolution
└─ index.ts           # Parser exports
```

### 1.2 Technical Specification (from 01_origin_blueprint.md 4.2)

The blueprint provides detailed implementation guidance:

1. **Create TypeScript Program** (4.2.1):
   - Use `ts.createProgram()` with file paths and project root
   - Read `tsconfig.json` for paths configuration
   - Configure options: `allowJs: true`, `checkJs: false`, `noEmit: true`

2. **Extract Import Relationships** (4.2.2):
   - Traverse `importDeclarations`, `exportDeclarations`, `importEqualsDeclaration`
   - Handle dynamic `import()` calls
   - Use `ts.resolveModuleName()` for path resolution
   - Generate edge types: IMPORTS, RE_EXPORTS, DYNAMIC_IMPORTS

3. **External Dependency Handling**:
   - When module resolution fails to find project file
   - Create EXTERNAL node with ID format `EXTERNAL:packageName`

---

## 2. Documentation Status Analysis

### 2.1 Documentation Completeness Checklist

| Document Type | C1 Status | C2 Status | C3 Status | Notes |
|---------------|-----------|-----------|-----------|-------|
| proposal.md | COMPLETE | COMPLETE | NOT_CREATED | Defines Why/What/Capabilities/Impact |
| design.md | COMPLETE | COMPLETE | NOT_CREATED | Context/Goals/Decisions/Risks |
| specs/*/spec.md | COMPLETE | COMPLETE | NOT_CREATED | ADDED requirements format |
| tasks.md | COMPLETE | COMPLETE | NOT_CREATED | Granular task breakdown |
| .openspec.yaml | COMPLETE | COMPLETE | NOT_CREATED | Schema configuration |

### 2.2 Required Artifacts for C3

To match C1/C2 documentation completeness, C3 needs:

1. **proposal.md** (~50 lines):
   - Why: Import extraction is prerequisite for MODULE node generation (C4)
   - What Changes: Parser module creation, import resolver, edge generation
   - Capabilities: `ts-import-parser`
   - Impact: Creates parser module, C4/C5 depend on it

2. **design.md** (~150 lines):
   - Context: TS Compiler API usage, constraints
   - Goals: Extract IMPORTS edges, resolve paths, mark external deps
   - Non-Goals: MODULE nodes (C4), CALLS edges (M2), complex type analysis
   - Decisions: Program creation strategy, path resolution approach
   - Risks: tsconfig.json absence, alias path complexity
   - Implementation Outline: Module structure, function signatures

3. **specs/ts-parser/spec.md** (~200 lines):
   - ADDED requirements format (Scenario-based)
   - Import declaration parsing
   - Export declaration handling
   - Dynamic import detection
   - Path resolution rules
   - EXTERNAL node creation criteria

4. **tasks.md** (~100 lines):
   - Setup tasks (package structure)
   - Core parser implementation
   - Import resolver implementation
   - Edge generation
   - Unit tests
   - Integration tests

---

## 3. Ambiguity Assessment

### 3.1 Identified Ambiguities

| # | Ambiguity | Location | Severity | Resolution Needed |
|---|-----------|----------|----------|-------------------|
| A1 | `tsconfig.json` not found fallback | blueprint 4.2.1 | LOW | Already specified: "use default config" |
| A2 | Multiple alias paths for same module | blueprint 4.2.2 | MEDIUM | Not specified - needs decision |
| A3 | Handling `export * from` wildcard exports | blueprint 4.2.2 | MEDIUM | Not specified - needs decision |

### 3.2 Ambiguity Details

#### A1: tsconfig.json Not Found (LOW - RESOLVED)

**Blueprint Statement** (4.2.1):
> "尝试读取 tsconfig.json，若不存在则使用默认配置"

**Status**: Already resolved. Default config is acceptable.

#### A2: Multiple Alias Paths (MEDIUM - NEEDS DECISION)

**Question**: When `tsconfig.json` has multiple path aliases matching a module specifier, which takes precedence?

**Example**:
```json
{
  "paths": {
    "@utils/*": ["src/utils/*", "src/shared/utils/*"],
    "@shared/*": ["src/shared/*"]
  }
}
```

**Options**:
1. First match wins (TypeScript default behavior)
2. All matches generate edges
3. Follow TypeScript's resolution order exactly

**Recommended**: Follow TypeScript's resolution order exactly (Option 3).

#### A3: Wildcard Re-exports (MEDIUM - NEEDS DECISION)

**Question**: How to handle `export * from './utils'` wildcard exports?

**Example**:
```typescript
// src/index.ts
export * from './utils';  // What edges are generated?
```

**Options**:
1. Generate single RE_EXPORTS edge without specifier
2. Expand to all named exports from target file
3. Mark as special case in edge metadata

**Recommended**: Generate single RE_EXPORTS edge with metadata `importSpecifier: "wildcard"` (Option 3).

### 3.3 Ambiguity Resolution Actions

| Action | Owner | Priority |
|--------|-------|----------|
| A2: Add decision to design.md | Developer before openspec | HIGH |
| A3: Add decision to design.md | Developer before openspec | HIGH |

---

## 4. Dependency Check

### 4.1 C1 (Graph Structure) Status

| Component | Status | Implementation |
|-----------|--------|----------------|
| NodeType enum | IMPLEMENTED | `packages/codegraph/src/types.ts` |
| EdgeType enum | IMPLEMENTED | `packages/codegraph/src/types.ts` |
| GraphNode interface | IMPLEMENTED | `packages/codegraph/src/types.ts` |
| GraphEdge interface | IMPLEMENTED | `packages/codegraph/src/types.ts` |
| CodeGraph class | IMPLEMENTED | `packages/codegraph/src/graph.ts` |
| addNode/addEdge methods | IMPLEMENTED | `packages/codegraph/src/graph.ts` |
| Unit tests | IMPLEMENTED | `packages/codegraph/tests/unit/types.test.ts`, `graph.test.ts` |

**C1 Overall**: **COMPLETE** - All tasks verified, tests passing.

### 4.2 C2 (File Scanner) Status

| Component | Status | Implementation |
|-----------|--------|----------------|
| scanDirectory function | IMPLEMENTED | `packages/codegraph/src/scanner.ts` |
| DEFAULT_IGNORE_RULES | IMPLEMENTED | `packages/codegraph/src/ignore-rules.ts` |
| CONTAINS edge generation | IMPLEMENTED | `packages/codegraph/src/scanner.ts` |
| filesToParse collection | IMPLEMENTED | `packages/codegraph/src/scanner.ts` |
| Unit tests | IMPLEMENTED | `packages/codegraph/tests/unit/scanner.test.ts` |
| Integration tests | IMPLEMENTED | `packages/codegraph/tests/integration/scanner-graph.test.ts` |

**C2 Overall**: **COMPLETE** - All tasks verified, tests passing.

### 4.3 Dependency Readiness

```
C3 Dependency Graph:

C1 [COMPLETE] ─────┐
                   │
                   ├────► C3 [READY TO START]
                   │
C2 [COMPLETE] ─────┘

All dependencies satisfied.
```

---

## 5. Testable Specifications Assessment

### 5.1 Test Fixture Requirements

C3 requires test fixtures covering:

| Fixture Type | Required | Status | Notes |
|--------------|----------|--------|-------|
| Basic imports (relative) | REQUIRED | NOT_CREATED | `import { x } from './utils'` |
| Namespace imports | REQUIRED | NOT_CREATED | `import * as utils from './utils'` |
| Default imports | REQUIRED | NOT_CREATED | `import utils from './utils'` |
| Re-exports | REQUIRED | NOT_CREATED | `export { x } from './utils'` |
| Dynamic imports | REQUIRED | NOT_CREATED | `import('./utils')` |
| Alias paths | REQUIRED | NOT_CREATED | `import { x } from '@utils/helper'` |
| External packages | REQUIRED | NOT_CREATED | `import { x } from 'lodash'` |
| Mixed scenarios | REQUIRED | NOT_CREATED | Combination fixture |

### 5.2 Test Coverage Requirements

Per blueprint section 16.1:

- Import/Export scenario coverage:
  - Default imports
  - Named imports
  - Namespace imports
  - Re-exports
  - Dynamic imports
  - Alias path resolution

**Estimated Test Count**: ~25-30 unit tests + 3 integration tests

### 5.3 Test Fixture Preparation Actions

| Action | Priority | Owner |
|--------|----------|-------|
| Create `tests/fixtures/import-test-project/` | HIGH | Before openspec |
| Add tsconfig.json with paths aliases | HIGH | Before openspec |
| Add files covering all import types | HIGH | Before openspec |
| Add external package references | MEDIUM | Can defer to implementation |

---

## 6. Implementation Approach Evaluation

### 6.1 Blueprint Technical Approach

The blueprint (section 4.2) provides:

| Aspect | Specification | Clarity |
|--------|---------------|---------|
| TypeScript Program creation | Detailed code example | HIGH |
| Import extraction traversal | Enumerated node types | HIGH |
| Module resolution | `ts.resolveModuleName()` | HIGH |
| Edge generation | Clear type mapping | HIGH |
| EXTERNAL node creation | Clear criteria | HIGH |

### 6.2 Implementation Complexity Assessment

| Component | Complexity | Risk Level |
|-----------|------------|------------|
| ts.createProgram() | LOW | Low - standard API |
| Import declaration parsing | MEDIUM | Low - well-documented |
| Path resolution (relative) | LOW | Low - straightforward |
| Path resolution (alias) | MEDIUM | Medium - tsconfig paths complexity |
| Dynamic import detection | LOW | Low - single pattern |
| EXTERNAL node detection | LOW | Low - clear fallback |

**Overall Complexity**: **MEDIUM** - manageable with blueprint guidance.

### 6.3 Required Technical Decisions

| Decision | Blueprint Coverage | Needs Addition |
|----------|-------------------|----------------|
| Program caching strategy | Not specified | Optional - can reuse program |
| Parallel file parsing | Not specified | Optional - performance enhancement |
| Parse error handling | Not specified | Required - graceful degradation |
| tsconfig extends handling | Not specified | Optional - follow TS behavior |

---

## 7. C2 Comparison Analysis

### 7.1 Documentation Completeness Comparison

```
C2 Documentation Artifacts:
├─ proposal.md (40 lines) ────────── C3 needs similar
├─ design.md (120 lines) ─────────── C3 needs ~150 lines (more decisions)
├─ specs/file-scanner/spec.md ────── C3 needs specs/ts-parser/spec.md
├─ tasks.md (25 tasks) ───────────── C3 needs ~30 tasks
└─ .openspec.yaml ────────────────── Standard config

C3 will need slightly longer design.md due to:
- More technical decisions (path resolution, wildcards)
- More edge cases in parsing
- tsconfig.json handling
```

### 7.2 Implementation Complexity Comparison

| Factor | C2 (File Scanner) | C3 (TS Parser) |
|--------|-------------------|----------------|
| Core complexity | LOW (fs traversal) | MEDIUM (TS API) |
| Edge cases | ~5 (symlinks, hidden, etc.) | ~15 (import types) |
| External dependencies | 0 | 1 (typescript package) |
| Test fixture needs | Simple directory | TypeScript project |
| Lines of code | ~200 | ~400 estimated |

**C3 is moderately more complex than C2**, but blueprint provides sufficient guidance.

---

## 8. Readiness Decision

### 8.1 Criteria Evaluation

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Input/Output Definitions | PASS | GraphNode/GraphEdge interfaces ready; parser output clear |
| No Ambiguous Terms | FAIL | A2 and A3 need resolution before implementation |
| Dependencies Resolved | PASS | C1 and C2 fully implemented with tests |
| Testable Specifications | PARTIAL | Fixtures not prepared; spec format understood |
| Implementation Approach | PASS | Blueprint 4.2 provides detailed guidance |

### 8.2 Final Decision

**Status**: **NEEDS_CLARIFICATION**

C3 can proceed to openspec creation after:

1. **Resolving 2 ambiguities** (A2: alias paths, A3: wildcard exports)
2. **Preparing test fixtures** (basic import test project)

Estimated preparation time: **0.5 days**

---

## 9. Recommended Actions

### 9.1 Before Creating OpenSpec Change

| Action | Priority | Estimated Time | Owner |
|--------|----------|----------------|-------|
| A2: Decide alias path resolution strategy | HIGH | 15 min | Developer |
| A3: Decide wildcard export handling | HIGH | 15 min | Developer |
| Create test fixture project structure | HIGH | 1 hour | Developer |
| Create fixture tsconfig.json with paths | MEDIUM | 30 min | Developer |
| Review blueprint 4.2 for completeness | LOW | 30 min | Optional |

### 9.2 OpenSpec Creation Sequence

```
Recommended sequence:

1. Create openspec/changes/cg-ts-parser-imports/
2. Generate proposal.md (using /opsx:new)
3. Generate design.md (include A2/A3 decisions)
4. Generate specs/ts-parser/spec.md
5. Generate tasks.md
6. Review and approve artifacts
7. Begin implementation (using /opsx:apply)
```

### 9.3 Estimated Timeline

| Phase | Duration | Notes |
|-------|----------|-------|
| Ambiguity resolution | 0.5 days | A2, A3 decisions |
| OpenSpec artifact creation | 0.5 days | proposal/design/specs/tasks |
| Implementation | 2 days | As estimated in plan |
| Testing | 1 day | Unit + integration tests |
| **Total** | **4 days** | Slightly above 2-day estimate |

---

## 10. Appendix

### 10.1 Reference Documents

- Blueprint: `docs/design-codegraph/01_origin_blueprint.md` section 4.2
- Change Plan: `docs/design-codegraph/develop_changes_plan.md` section 3.2
- C1 Reference: `openspec/changes/cg-core-graph-structure/`
- C2 Reference: `openspec/changes/cg-file-system-scanner/`

### 10.2 Key Interfaces to Use

```typescript
// From C1 - types.ts
interface GraphNode {
  id: string;  // EXTERNAL:packageName for external deps
  type: NodeType;
  path: string;
  name: string;
  metadata?: { ... };
}

interface GraphEdge {
  from: string;  // FILE:sourcePath
  to: string;    // FILE:resolvedPath or EXTERNAL:packageName
  type: EdgeType;  // IMPORTS, RE_EXPORTS, DYNAMIC_IMPORTS
  metadata?: {
    line?: number;
    importSpecifier?: string;  // "default", "named:x", "wildcard"
  };
}

// From C2 - scanner.ts
interface ScanResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  filesToParse: string[];  // Input for C3 parser
}
```

### 10.3 Suggested Test Fixture Structure

```
tests/fixtures/import-test-project/
├─ tsconfig.json          # With paths aliases
├─ src/
│   ├─ index.ts           # Multiple import types
│   ├─ utils.ts           # Named exports
│   ├─ default-export.ts  # Default export
│   ├─ re-export.ts       # Re-export patterns
│   ├─ dynamic-import.ts  # Dynamic import() usage
│   └─ aliased-import.ts  # Uses @utils alias
│   └─ components/
│       └─ Button.tsx     # React component import
├─ external-refs.ts       # References lodash, etc.
```

---

**Assessment Complete**

Next step: Resolve ambiguities A2 and A3, then create openspec change.