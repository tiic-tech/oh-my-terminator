# C9 (cg-cli-analyze-update) Development Readiness Assessment

**Assessment Date**: 2026-05-04
**Assessor**: Claude Code Agent
**Goal**: Evaluate if documentation and codebase support C9 CLI development

---

## Executive Summary

| Aspect | Status | Details |
|--------|--------|---------|
| **Dependencies** | READY | C5 and C6 completed and archived |
| **Codebase Infrastructure** | PARTIAL | analyzer.ts and persistence exist; CLI infrastructure missing; graph modification methods missing |
| **JSON Schema Definition** | DEFINED + GAPS | Schema defined but missing delta fields; types not in types.ts |
| **Library Dependencies** | MISSING + PREPARATION | `cac`, `isomorphic-git` not installed; fs adapter required |
| **Overall Assessment** | **DEVELOPABLE_WITH_PREPARATION** | Requires preparatory work (Category A fixes) before C9 implementation |

**Critical Issues**: 0 (none blocking development)
**Risk Issues**: 5 (requires attention - 2 are pre-C9 fixes)
**Suggestion Issues**: 2 (improvement opportunities)

---

## Scope Boundary Classification

### Purpose

This section clearly categorizes what work belongs to:
- **Pre-C9 preparation** (fixes needed before C9 can start)
- **C9 development scope** (what C9 should implement)
- **Future changes** (deferred to later changes)

---

### Category A: Pre-C9 Fixes (Must Fix Before C9 Development)

These are gaps in C1-C8 that block C9 development. They are **NOT** part of C9 scope.

| # | Issue | Source | Description | Action Required |
|---|-------|--------|-------------|-----------------|
| A1 | **Missing `removeNode()` method** | C1 gap | CodeGraph class lacks `removeNode(id: string)` method for deleting nodes | Add to `src/graph.ts` before C9 starts |
| A2 | **Missing `removeEdgesForFile()` method** | C1 gap | CodeGraph class lacks `removeEdgesForFile(filePath)` method for deleting file edges | Add to `src/graph.ts` before C9 starts |
| A3 | **Missing fs adapter for isomorphic-git** | Infrastructure | isomorphic-git requires fs adapter with both sync and async methods for Node.js | Create `src/git/fs-adapter.ts` before C9 starts |

**Execution Order**: A1, A2 can be done together (both in graph.ts); A3 independent

**Ownership**: These are infrastructure fixes, not C9 tasks. Can be done as:
- Separate mini-change (e.g., "C8.5: Graph Modification Methods")
- Or as Phase 0 tasks before creating C9 artifacts

---

### Category B: C9 Development Scope (What C9 Should Implement)

These are the deliverables for C9 change. All work below assumes Category A items are complete.

| # | Component | Description | Source |
|---|-----------|-------------|--------|
| B1 | **CLI Entry Point** | `bin/codegraph.ts` with cac initialization | develop_changes_plan.md |
| B2 | **CLI Module Structure** | `src/cli/` directory with commands, output subdirs | Assessment |
| B3 | **analyze Command** | Full analysis execution with baseline save | develop_changes_plan.md §15 |
| B4 | **update Command** | Incremental update using `detectGitChanges()` + re-parse | develop_changes_plan.md + 09_spec |
| B5 | **detectGitChanges()** | Git change detection function using isomorphic-git | 09_c9_isomorphic_git_spec.md |
| B6 | **JSON Output Formatter** | `src/cli/output/json-formatter.ts` | cli-structured-output-design.md |
| B7 | **Text Output Formatter** | `src/cli/output/text-formatter.ts` | cli-structured-output-design.md |
| B8 | **`--json` Flag Support** | Global JSON output toggle for all commands | cli-api-alignment-analysis.md (P0) |
| B9 | **CLI Types in types.ts** | `AnalyzeResult`, `UpdateResult`, `CliResultStats` interfaces | Assessment S1 |
| B10 | **Error JSON Format** | Structured error output for `--json` mode | Assessment A7 |
| B11 | **getHeadCommit()** | Helper function to get current HEAD commit hash | 09_c9_isomorphic_git_spec.md |
| B12 | **Integration Tests** | Test fixtures and scenarios for CLI commands | 09_c9_isomorphic_git_spec.md §6 |

**C9 Artifact Deliverables**:
- `openspec/changes/cg-cli-analyze-update/proposal.md`
- `openspec/changes/cg-cli-analyze-update/design.md`
- `openspec/changes/cg-cli-analyze-update/tasks.md`

---

### Category C: Future Change Scope (Not in C9)

These are explicitly deferred to later changes per spec documents.

| # | Feature | Deferred To | Reason | Source |
|---|---------|-------------|--------|--------|
| C1 | **Cascade Update Logic** | C14 (M2) | MVP uses simplified "delete + re-parse"; cascade requires impact analysis | develop_changes_plan.md, 09_spec §4.1 |
| C2 | **`brief` Command** | C10 | C10 scope per develop_changes_plan.md; uses `getQuickBrief` API | develop_changes_plan.md |
| C3 | **Advanced Delta Analysis** | Future | Deeper impact propagation, module-level changes | Future M2+ |
| C4 | **watch Mode** | Future | Continuous monitoring mode not in MVP | Future |
| C5 | **Multi-project Support** | Future | Not in initial CLI scope | Future |

**Key Spec Reference** (from 09_c9_isomorphic_git_spec.md §4.1):

| Scope | Feature | Status |
|-------|---------|--------|
| MVP (C9) | File-level delta detection | Included |
| MVP (C9) | Delete nodes for changed files | Included |
| MVP (C9) | Re-parse changed files | Included |
| M2 (C14) | Cascade update to dependents | Deferred |
| M2 (C14) | Impact propagation | Deferred |

---

## Pre-Development Action Plan

### Phase 0: Fix C1-C8 Gaps (Category A Items)

**Timing**: Before creating C9 artifacts

**Tasks**:
1. [ ] Add `removeNode(id: string)` method to CodeGraph class in `src/graph.ts`
2. [ ] Add `removeEdgesForFile(filePath: string)` method to CodeGraph class in `src/graph.ts`
3. [ ] Add `removeEdge(edge: GraphEdge)` helper method to CodeGraph class
4. [ ] Create `src/git/` directory structure
5. [ ] Create `src/git/fs-adapter.ts` with async wrappers for isomorphic-git
6. [ ] Add unit tests for new graph modification methods
7. [ ] Run test suite to verify no regressions

**Estimated Time**: 2-3 hours

**Verification**: All Category A items complete before Phase 1

---

### Phase 1: Create C9 Artifacts

**Timing**: After Phase 0 complete

**Tasks**:
1. [ ] Create feat branch: `git checkout -b feat/cg-cli-analyze-update`
2. [ ] Create `openspec/changes/cg-cli-analyze-update/` directory
3. [ ] Create `proposal.md` - What, Why, Impact
4. [ ] Create `design.md` - Technical architecture, CLI structure, error handling
5. [ ] Create `tasks.md` - Detailed task breakdown from Category B items
6. [ ] Review artifacts against develop_changes_plan.md and 09_spec

**Estimated Time**: 1-2 hours

---

### Phase 2: Implement C9 (Category B Items)

**Timing**: After artifacts approved

**Order of Implementation**:
1. Dependencies: Install `cac`, `isomorphic-git`
2. Infrastructure: Create `bin/`, `src/cli/` structure
3. Types: Add CLI result types to `types.ts`
4. Git module: Create `detectGitChanges()`, `getHeadCommit()`
5. Commands: Implement `analyze`, `update`
6. Output: Create JSON and text formatters
7. Tests: Integration test fixtures and scenarios

**Estimated Time**: 1.5 days (per develop_changes_plan.md)

---

## Artifact Coverage Map

### Direct Dependencies (C5, C6)

| Artifact | Status | Location | Relevance |
|----------|--------|----------|-----------|
| C5 (cg-full-analysis-flow) | COMPLETED | `openspec/changes/archive/2026-05-03-cg-full-analysis-flow/` | Direct dependency - provides `analyzeFull()` |
| C5 tasks.md | COMPLETE | All 63 tasks checked | `analyzer.ts` implemented |
| C5 design.md | COMPLETE | Parser registry, error handling, concurrency decisions documented |
| C6 (cg-baseline-persistence) | COMPLETED | `openspec/changes/archive/2026-05-03-cg-baseline-persistence/` | Direct dependency - provides `loadBaseline`, `saveBaseline` |
| C6 tasks.md | COMPLETE | All 122 tasks checked | `persistence/` module implemented |
| C6 design.md | COMPLETE | SchemaVersion, atomic write, migration framework documented |

### Indirect Dependencies

| Artifact | Status | Location | Relevance |
|----------|--------|----------|-----------|
| C1 (cg-core-graph-structure) | COMPLETED + GAPS | `archive/2026-05-03-cg-core-graph-structure/` | Provides `CodeGraph` class; **missing removeNode/removeEdgesForFile** |
| C2 (cg-file-system-scanner) | COMPLETED | `archive/2026-05-03-cg-file-system-scanner/` | Provides `scanDirectory()` |
| C3 (cg-ts-parser-imports) | COMPLETED | `archive/2026-05-03-cg-ts-parser-imports/` | Import extraction |
| C4 (cg-ts-parser-modules) | COMPLETED | `archive/2026-05-03-cg-ts-parser-modules/` | MODULE node extraction |
| C7 (cg-api-scope) | COMPLETED | `archive/2026-05-03-cg-api-scope/` | NOT a direct dependency |
| C8 (cg-api-impact-layers) | NEAR_COMPLETE | `openspec/changes/cg-api-impact-layers/` | NOT a direct dependency (C10 needs this) |

### Reference Documents

| Document | Status | Location | Usage |
|----------|--------|----------|-------|
| develop_changes_plan.md | AVAILABLE | `docs/design-codegraph/` | C9 definition source |
| 01_origin_blueprint.md | AVAILABLE | `docs/design-codegraph/` | CLI command reference (§15) |
| 09_c9_isomorphic_git_spec.md | AVAILABLE | `docs/design-codegraph/` | Detailed implementation spec (30KB) |
| cli-api-alignment-analysis.md | AVAILABLE | `docs/design-codegraph/` | CLI-API alignment (P0 requirements) |
| cli-structured-output-design.md | AVAILABLE | `docs/design-codegraph/` | Output format design |
| package CLAUDE.md | AVAILABLE | `packages/codegraph/` | Development workflow guidelines |

---

## Issue Analysis

### Risk Issues (May Cause Bugs or Delays)

| # | Issue | Location | Original Content | Impact | Resolution | Category |
|---|-------|----------|------------------|--------|------------|----------|
| R1 | **CLI infrastructure does not exist** | `packages/codegraph/` | No `bin/` or `src/cli/` directory | Must create entire CLI structure from scratch; adds development time | Create `bin/codegraph.ts` entry point and `src/cli/` module structure before implementing commands | B1, B2 |
| R2 | **`cac` library not installed** | `package.json` | Dependencies: only `typescript: ^5.4.0` | Cannot build CLI without CLI framework | Add `cac` as dependency: `pnpm add cac`; verify version compatibility with ESM | B2 |
| R3 | **`isomorphic-git` not installed** | `package.json` | No git library in dependencies | `update` command cannot get file changes from git history | Add `isomorphic-git` as dependency: `pnpm add isomorphic-git`; verify Node.js 18+ compatibility | B2 |
| R4 | **Missing graph modification methods** | `src/graph.ts` | C1 CodeGraph class lacks `removeNode()` and `removeEdgesForFile()` | update command cannot remove nodes/edges for changed files; blocks C9 implementation | **Pre-C9 Fix**: Add methods to graph.ts (Category A1, A2) | A |
| R5 | **fs adapter not implemented** | New file needed | isomorphic-git requires fs adapter with both sync and async methods | Cannot use isomorphic-git without adapter; blocks C9 implementation | **Pre-C9 Fix**: Create `src/git/fs-adapter.ts` (Category A3) | A |

### Suggestion Issues (Improvement Opportunities)

| # | Issue | Location | Original Content | Impact | Resolution |
|---|-------|----------|------------------|--------|------------|
| S1 | **JSON Schema types not in types.ts** | `packages/codegraph/src/types.ts` | Only C5/C6 types defined; C9 CLI result types missing | TypeScript types for CLI output not formalized; may cause inconsistency | Add `AnalyzeResult`, `UpdateResult`, `CliResultStats` interfaces to types.ts; include delta fields |
| S2 | **No CLI output formatter module** | Current structure | `src/cli/output/` directory not planned in existing modules | Will need to create formatters during implementation | Pre-create `src/cli/output/json-formatter.ts` and `text-formatter.ts` structure |

---

## Ambiguity Analysis

### A1: `cac` Library Integration Pattern (CLARIFIED)

**Ambiguity**: How to integrate `cac` with TypeScript ESM module?

**Resolution**: 
- `cac` supports ESM: `import { cac } from 'cac'`
- Entry point pattern: `bin/codegraph.ts` with `#!/usr/bin/env node`
- Build output: Compile to `dist/bin/codegraph.js` for execution

**Decision**: 
```typescript
// bin/codegraph.ts
import { cac } from 'cac';
import { analyzeCommand } from './src/cli/commands/analyze.js';
import { updateCommand } from './src/cli/commands/update.js';

const cli = cac('codegraph');
cli.command('analyze', 'Run full analysis').action(analyzeCommand);
cli.command('update', 'Run incremental update').action(updateCommand);
cli.help();
cli.parse();
```

### A2: JSON Output Schema Extensibility (CLARIFIED)

**Ambiguity**: Should JSON output schema be strict or allow extra fields?

**Resolution from develop_changes_plan.md**:
- Schema defined with required fields: `success`, `stats`, `durationMs`, `warnings`, `nextSuggested`
- Pattern follows C7/C8 API result types (strict interface)
- Allow optional `baseline` field for analyze result

**Decision**: Use strict TypeScript interfaces:
```typescript
interface AnalyzeResult {
  success: boolean;
  stats: CliResultStats;
  baseline?: { path: string; commitHash: string; timestamp: number };
  durationMs: number;
  warnings: string[];
  nextSuggested: string[];
}

interface UpdateResult {
  success: boolean;
  changes: { added: string[]; removed: string[]; modified: string[] };
  delta: { newNodes: number; removedNodes: number };  // Added per 09_spec
  durationMs: number;
  warnings: string[];
}
```

### A3: `update` Command Incremental Strategy (CLARIFIED)

**Ambiguity**: MVP "simplified incremental" - what exactly is simplified?

**Resolution from develop_changes_plan.md**:
> "MVP简化版: 删除旧节点+重新解析变更文件"

**Decision**: 
1. Read `lastCommit.txt` for previous commit hash
2. Use `isomorphic-git` to get changed files between commits
3. Delete nodes/edges for changed files from graph
4. Re-parse only changed files (no cascade update)
5. Save updated baseline

**Note**: Cascade update deferred to C14 (M2) - Category C1

### A4: Error Output Format for `--json` (CLARIFIED)

**Ambiguity**: How should errors be output when `--json` flag is set?

**Options**:
1. Return JSON with `success: false` and `warnings` containing error message
2. Throw and let CLI framework handle error output
3. Return JSON error object with `error` field

**Resolution from cli-api-alignment-analysis.md**: Option 2 preferred for Agent-Friendly parsing

**Decision**: 
```typescript
// Error output format
{
  "success": false,
  "error": {
    "code": "E_BASLINE_NOT_FOUND",
    "message": "No baseline found. Run 'codegraph analyze' first."
  },
  "warnings": [],
  "durationMs": 0
}
```

### A5: Text Output Format Details (CLARIFIED)

**Ambiguity**: What should default text output look like?

**Resolution from Blueprint §7.1**: Follow `getScope` output pattern:
```
## Analysis Complete
- Files scanned: 42
- Modules extracted: 128
- Edges created: 256
- Duration: 1.2s
- Baseline: .codegraph/baseline.json

Warnings:
- Parse failed: src/broken.ts (syntax error)

Next suggested:
- Run 'codegraph scope <file>' to inspect modules
- Run 'codegraph impact <file>' to check dependencies
```

### A6: Graph Modification Methods Location (CLARIFIED - NEW)

**Ambiguity**: Where should `removeNode()` and `removeEdgesForFile()` methods be implemented?

**Resolution from 09_c9_isomorphic_git_spec.md section 3.2**:
```typescript
// packages/codegraph/src/graph.ts (补充方法)
class CodeGraph {
  // ... 现有方法 ...
  removeNode(id: string): void { ... }
  removeEdgesForFile(filePath: string): void { ... }
  removeEdge(edge: GraphEdge): void { ... }
}
```

**Decision**: Add methods to existing `graph.ts`, not create new file. This is a **Pre-C9 Fix** (Category A).

### A7: Error Output Destination for JSON Mode (CLARIFIED - NEW)

**Ambiguity**: When `--json` is set and an error occurs, should the error JSON go to:
1. stderr as plain text
2. stdout as JSON with `success: false`
3. stderr as JSON

**Resolution from cli-api-alignment-analysis.md section 8**:
> Error JSON format needed for Agent-Friendly parsing

**Decision**: Option 2 - stdout JSON with `success: false`. This allows agents/calling processes to parse errors programmatically.

### A8: fs Adapter Pattern (CLARIFIED - NEW)

**Ambiguity**: How to handle isomorphic-git's requirement for both sync and async fs methods?

**Resolution from 09_c9_isomorphic_git_spec.md section 8.2**:
```typescript
// isomorphic-git 需要的 fs adapter
export const fs = {
  promises: fsPromises,
  readFileSync: async (path: string) => { ... },
  writeFileSync: async (path: string, content: string | Buffer) => { ... },
  // ... 其他必要方法
};
```

**Decision**: Create async wrappers for sync methods in `src/git/fs-adapter.ts`. This is a **Pre-C9 Fix** (Category A).

---

## Dependency Verification

### C5 (cg-full-analysis-flow) - READY

| Requirement | Status | Evidence |
|-------------|--------|----------|
| `analyzeFull()` function exists | VERIFIED | `src/analyzer.ts:35` exports `analyzeFull` |
| `FullAnalysisResult` type defined | VERIFIED | `src/types.ts:255-262` |
| `AnalysisStats` with timing | VERIFIED | `src/types.ts:200-220` includes `totalTimeMs` |
| Progress callback support | VERIFIED | `src/types.ts:176-194` `ProgressCallback` |
| Parser registry pattern | VERIFIED | `src/parser-registry.ts` exports `DefaultParserRegistry` |

### C6 (cg-baseline-persistence) - READY

| Requirement | Status | Evidence |
|-------------|--------|----------|
| `loadBaseline()` function exists | VERIFIED | `src/persistence/baseline/index.ts:45` |
| `saveBaseline()` function exists | VERIFIED | `src/persistence/save.ts` exported via `index.ts` |
| `.codegraph/` path constants | VERIFIED | `src/persistence/paths.ts` defines all paths |
| `SchemaVersion` type | VERIFIED | `src/types.ts:16-23` |
| `Baseline` interface | VERIFIED | `src/persistence/types/index.ts` |
| Atomic write pattern | VERIFIED | C6 design.md D2: temp file + rename |
| `lastCommit.txt` handling | VERIFIED | `LAST_COMMIT_FILE` constant, `getLastCommitPath()` |

### C1 (cg-core-graph-structure) - READY + GAPS

| Requirement | Status | Evidence |
|-------------|--------|----------|
| `CodeGraph` class exists | VERIFIED | `src/graph.ts` exports `CodeGraph` |
| `addNode()` method | VERIFIED | Existing method |
| `addEdge()` method | VERIFIED | Existing method |
| `getNode()` method | VERIFIED | Existing method |
| `getNodesByType()` method | VERIFIED | Existing method |
| `removeNode()` method | **MISSING** | **Pre-C9 Fix Required** |
| `removeEdgesForFile()` method | **MISSING** | **Pre-C9 Fix Required** |
| `removeEdge()` method | **MISSING** | **Pre-C9 Fix Required** |

---

## Codebase Structure Analysis

### Existing Structure (as of 2026-05-04)

```
packages/codegraph/src/
├── analyzer.ts          # C5: analyzeFull() - READY for CLI integration
├── graph.ts             # C1: CodeGraph class (needs modification methods)
├── scanner.ts           # C2: scanDirectory()
├── parser-registry.ts   # C5: DefaultParserRegistry
├── types.ts             # Core types (needs C9 CLI types added)
├── index.ts             # Main exports
├── parser/              # C3/C4: TypeScript parser
├── persistence/         # C6: Baseline operations
│   ├── baseline/        # loadBaseline, validation
│   ├── compatibility/   # Schema version checking
│   ├── migrations/      # Migration framework
│   ├── paths.ts         # .codegraph directory paths
│   └── save.ts          # saveBaseline
└── api/                 # C7/C8: Scope, Impact, Layers APIs
    ├── scope/
    ├── impact/
    ├── layers/
    └── types/           # API-specific types
```

### Required Structure Updates

#### Pre-C9 Updates (Category A)

```
packages/codegraph/src/
├── graph.ts             # UPDATE: Add removeNode, removeEdgesForFile, removeEdge
├── git/                 # NEW: Git operations module
│   ├── fs-adapter.ts    # NEW: isomorphic-git fs adapter
│   └── index.ts         # NEW: Module exports
```

#### C9 Development Structure (Category B)

```
packages/codegraph/
├── bin/
│   └── codegraph.ts     # NEW: CLI entry point
├── src/cli/
│   ├── index.ts         # NEW: CLI module exports
│   ├── commands/
│   │   ├── analyze.ts   # NEW: analyze command implementation
│   │   └── update.ts    # NEW: update command implementation
│   └── output/
│   │   ├── json-formatter.ts  # NEW: JSON output formatting
│   │   └── text-formatter.ts  # NEW: Text output formatting
│   └── types.ts         # NEW: CLI-specific types
├── src/git/
│   ├── fs-adapter.ts    # (Pre-C9)
│   ├── change-detector.ts # NEW: detectGitChanges function
│   ├── head-commit.ts    # NEW: getHeadCommit function
│   └── index.ts         # NEW: Module exports
├── package.json         # UPDATE: Add cac, isomorphic-git, bin field
```

---

## Document Update Plan

### Updates to Existing Documents

| Document | Action | Content to Preserve | Content to Add |
|----------|--------|---------------------|----------------|
| `package.json` | UPDATE | All existing fields | Add `cac`, `isomorphic-git` deps; Add `"bin": {"codegraph": "./dist/bin/codegraph.js"}` |
| `src/types.ts` | EXTEND | All existing types | Add `AnalyzeResult`, `UpdateResult`, `CliResultStats`, `CliError`, `FileChange` interfaces |
| `src/graph.ts` | EXTEND | All existing methods | Add `removeNode(id)`, `removeEdgesForFile(filePath)`, `removeEdge(edge)` methods |
| `src/index.ts` | EXTEND | All existing exports | Export new CLI types (optional - may keep CLI types separate) |

### New Documents to Create

#### Pre-C9 (Category A)

| Document Type | Purpose | Key Content |
|---------------|---------|-------------|
| `src/git/fs-adapter.ts` | isomorphic-git fs adapter | Async wrappers for sync fs methods, promises interface |

#### C9 Development (Category B)

| Document Type | Purpose | Key Content |
|---------------|---------|-------------|
| `bin/codegraph.ts` | CLI entry point | cac initialization, command registration, help text |
| `src/cli/commands/analyze.ts` | Analyze command | Call analyzeFull, save baseline, format output |
| `src/cli/commands/update.ts` | Update command | Load baseline, get git changes, re-parse, save |
| `src/cli/output/json-formatter.ts` | JSON output | Format result as JSON with schema validation |
| `src/cli/output/text-formatter.ts` | Text output | Human-readable output formatting |
| `src/git/change-detector.ts` | Git changes | `detectGitChanges(cwd, fromCommit, toCommit)` |
| `src/git/head-commit.ts` | HEAD commit | `getHeadCommit(cwd)` function |
| `openspec/changes/cg-cli-analyze-update/proposal.md` | Change proposal | What, Why, Impact of CLI commands |
| `openspec/changes/cg-cli-analyze-update/design.md` | Technical design | CLI architecture, error handling, output formats |
| `openspec/changes/cg-cli-analyze-update/tasks.md` | Implementation tasks | Detailed task breakdown |

---

## Developer Checklist

### Phase 0: Pre-C9 Fixes (Category A)

- [ ] Review C1 graph.ts for existing structure
- [ ] Add `removeNode(id: string): void` method to CodeGraph
- [ ] Add `removeEdgesForFile(filePath: string): void` method to CodeGraph
- [ ] Add `removeEdge(edge: GraphEdge): void` helper method
- [ ] Create `src/git/` directory
- [ ] Create `src/git/fs-adapter.ts` with fs adapter implementation
- [ ] Write unit tests for graph modification methods
- [ ] Run test suite: `pnpm test` (verify all pass)

### Phase 1: Pre-Development Verification

- [ ] Verify C5 artifacts in archive: `ls openspec/changes/archive/2026-05-03-cg-full-analysis-flow/`
- [ ] Verify C6 artifacts in archive: `ls openspec/changes/archive/2026-05-03-cg-baseline-persistence/`
- [ ] Verify C8 status: `ls openspec/changes/cg-api-impact-layers/` (not direct dependency)
- [ ] Run C5/C6 tests: `pnpm test` (verify all pass)
- [ ] Add dependencies: `pnpm add cac isomorphic-git`
- [ ] Update package.json bin field

### Phase 1: Create C9 Artifacts

- [ ] Load coding-taste SKILL: `/coding-taste`
- [ ] Create feat branch: `git checkout -b feat/cg-cli-analyze-update`
- [ ] Create change directory: `mkdir -p openspec/changes/cg-cli-analyze-update`
- [ ] Create proposal.md (What, Why, Impact)
- [ ] Create design.md (Technical architecture)
- [ ] Create tasks.md (Task breakdown from Category B)

### Phase 2: Development Flow (per CLAUDE.md)

- [ ] Create CLI types in types.ts (interfaces first - TDD RED)
- [ ] Create `bin/` directory structure
- [ ] Create `src/cli/` directory structure
- [ ] Implement git change detection (detectGitChanges)
- [ ] Implement analyze command with tests
- [ ] Implement update command with tests
- [ ] Implement output formatters
- [ ] Run code-reviewer after implementation
- [ ] Archive change when complete

### Task Estimation

Based on develop_changes_plan.md estimate of 1.5 days + pre-C9 fixes:

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| **Phase 0: Pre-C9 Fixes** | ~7 tasks | 2-3 hours |
| **Phase 1: Artifacts** | ~5 tasks | 1-2 hours |
| **Phase 2: Implementation** | ~49 tasks | 1.5 days |
| **Total** | ~61 tasks | 2 days |

---

## Blocking Issues Summary

**None** - All dependencies are completed and available.

**Preparation Required** - Category A items (graph methods, fs adapter) must be completed before C9 implementation.

---

## Recommended Next Steps

1. **Phase 0**: Fix Category A items (graph modification methods, fs adapter)
2. **Phase 1**: Create C9 change artifacts in `openspec/changes/cg-cli-analyze-update/`
3. **Phase 2**: Add dependencies (`cac`, `isomorphic-git`)
4. **Phase 2**: Create CLI infrastructure (`bin/`, `src/cli/`)
5. **Phase 2**: Begin TDD Development with analyze command tests

---

## Appendix: Key Code References

### analyzeFull() Signature (C5)
```typescript
// src/analyzer.ts:35
export async function analyzeFull(
  cwd: string,
  options?: AnalysisOptions
): Promise<FullAnalysisResult>
```

### loadBaseline() Signature (C6)
```typescript
// src/persistence/baseline/index.ts:45
export async function loadBaseline(
  cwd: string,
  options?: LoadBaselineOptions
): Promise<LoadBaselineResult>
```

### saveBaseline() Signature (C6)
```typescript
// src/persistence/save.ts (exported via index.ts)
export async function saveBaseline(
  baseline: Baseline,
  cwd: string,
  options?: SaveBaselineOptions
): Promise<void>
```

### JSON Schema (Updated with Delta Fields)
```typescript
interface AnalyzeResult {
  success: boolean;
  stats: CliResultStats;
  baseline?: { path: string; commitHash: string; timestamp: number };
  durationMs: number;
  warnings: string[];
  nextSuggested: string[];
}

interface UpdateResult {
  success: boolean;
  changes: { added: string[]; removed: string[]; modified: string[] };
  delta: { newNodes: number; removedNodes: number };
  durationMs: number;
  warnings: string[];
}

interface FileChange {
  path: string;
  type: 'ADD' | 'MODIFY' | 'DELETE';
}
```

### Graph Modification Methods (Pre-C9 Addition)
```typescript
// To be added to src/graph.ts
class CodeGraph {
  removeNode(id: string): void {
    this.nodes.delete(id);
  }
  
  removeEdgesForFile(filePath: string): void {
    // Remove all edges where source or target is in filePath
    for (const edge of this.edges.values()) {
      if (edge.source.startsWith(filePath) || edge.target.startsWith(filePath)) {
        this.edges.delete(edge.id);
      }
    }
  }
  
  removeEdge(edge: GraphEdge): void {
    this.edges.delete(edge.id);
  }
}
```

### fs Adapter Pattern (from 09_spec)
```typescript
// src/git/fs-adapter.ts
import { promises as fsPromises, readFileSync as realReadFileSync } from 'fs';

export const fs = {
  promises: fsPromises,
  readFileSync: async (path: string, options?: any) => {
    return realReadFileSync(path, options);
  },
  // ... other required methods
};
```

---

**Report Version**: v1.1
**Generated**: 2026-05-04
**Updated**: 2026-05-04 (Supplementary Analysis Integration)
**Next Assessment**: After Phase 0 completion