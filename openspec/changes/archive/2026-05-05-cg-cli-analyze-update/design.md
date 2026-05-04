## Context

CodeGraph library provides `analyzeFull()` (C5) for full analysis and persistence (C6) for baseline management. The CLI needs to expose these capabilities through command-line interface using `cac` framework, with git-based incremental update via `isomorphic-git`.

**Current state**:
- `analyzeFull()` implemented in `src/analyzer.ts`
- `loadBaseline`, `saveBaseline` in `src/persistence/`
- Phase 0 complete: graph modification methods + fs adapter
- Dependencies: `cac`, `isomorphic-git` to be added

**Constraints**:
- MVP scope: File-level delta, no cascade update (deferred to C14)
- JSON output required for Agent-Friendly parsing
- Must work in Node.js 18+ environment

## Goals / Non-Goals

**Goals:**
- CLI entry point with `analyze` and `update` commands
- JSON output via `--json` flag for all commands
- Git change detection using isomorphic-git
- Text output as human-readable default
- Error handling with structured JSON output

**Non-Goals:**
- Cascade update logic (deferred to C14/M2)
- `brief` command (C10)
- Other query commands (`scope`, `impact`, `layers` - C10)
- Watch mode
- Interactive REPL

## Decisions

### D1: CLI Framework - `cac`

**Choice**: Use `cac` (lightweight CLI framework)

**Alternatives considered**:
- `commander`: Heavier, more features than needed
- `yargs`: Complex API, larger bundle size
- Custom implementation: More work, less tested

**Rationale**: `cac` is minimal (~2KB), ESM-compatible, sufficient for MVP commands. Widely used in Vite ecosystem.

### D2: Git Operations - `isomorphic-git`

**Choice**: Use `isomorphic-git` with custom fs adapter

**Alternatives considered**:
- `simple-git`: Requires git binary, not portable
- Shell `git` commands: Platform-dependent, harder to test
- Native git parsing: Complex, error-prone

**Rationale**: Pure JavaScript, works without git binary, testable in isolated environments. Phase 0 already created fs adapter.

### D3: Output Format - JSON First

**Choice**: All commands support `--json` flag, text as default

**Schema design**:
```typescript
interface AnalyzeResult {
  success: boolean;
  stats: { filesScanned: number; modulesExtracted: number; edgesCreated: { imports: number; exports: number; contains: number } };
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

interface CliError {
  success: false;
  error: { code: string; message: string };
  durationMs: number;
}
```

**Error output**: When `--json` is set, errors go to stdout (not stderr) for agent parsing.

### D4: Incremental Update Strategy - Simplified MVP

**Choice**: "Delete stale nodes + re-parse changed files" without cascade

**Workflow**:
1. Read `lastCommit.txt` for baseline commit
2. Use `git.walk()` to detect file changes (ADD/MODIFY/DELETE)
3. Delete nodes/edges for changed files via `removeEdgesForFile()`
4. Re-parse only ADD/MODIFY files
5. Save updated baseline with new commit hash

**Deferred to C14**: Cascade update (propagate changes to dependents), impact analysis.

### D5: Error Code Definitions

**Choice**: Define explicit error codes for CLI commands

**Codes**:
```typescript
enum CliErrorCode {
  E_NO_GIT_REPO = 'E_NO_GIT_REPO',
  E_BASELINE_NOT_FOUND = 'E_BASELINE_NOT_FOUND',
  E_PARSE_FAILED = 'E_PARSE_FAILED',
  E_WALK_API_FAILED = 'E_WALK_API_FAILED',
  E_INVALID_PATH = 'E_INVALID_PATH',
}
```

**Rationale**: Structured error codes enable programmatic error handling by agents and CI tools.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| **isomorphic-git walk API instability** | Fallback: iterate commits individually (spec provides alternative implementation) |
| **Large repos slow walk** | Filter to supported file types early, limit depth |
| **Missing cascade leads to stale edges** | Document limitation, defer to C14 with clear migration path |
| **fs adapter missing methods** | Phase 0 created adapter, add methods as needed during testing |
| **JSON schema drift** | Define types in `types.ts`, generate schema if needed |

## Migration Plan

**Pre-development** (Phase 0 - COMPLETE):
- Graph modification methods added
- fs adapter created

**Development steps**:
1. Add `cac`, `isomorphic-git` to package.json
2. Create `bin/codegraph.ts` entry point
3. Create CLI types in `types.ts`
4. Implement `detectGitChanges()`, `getHeadCommit()`
5. Implement analyze/update commands
6. Add output formatters
7. Integration tests with fixtures

**No rollback needed**: New functionality, no existing code to migrate.