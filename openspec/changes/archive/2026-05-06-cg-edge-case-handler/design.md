## Context

Current analyzer code has basic empty file checking inline but no named functions for edge case handling. The `bfs-phases.ts` has `isTestFile()` function that filters during traversal, not pre-filter at entry. Single-file project handling is completely missing. Design documentation falsely claimed implementation of all three functions.

**Current State**:
- Empty project: `analyzer.ts` has inline check `if (files.length === 0)` but no named function
- Single-file: No handling exists - runs full analysis pipeline inefficiently
- Test files: Filtered during BFS traversal in `bfs-phases.ts`, not pre-filtered

**Stakeholders**: CLI users who analyze edge-case projects (empty repos, single utility files, test-heavy projects)

## Goals / Non-Goals

**Goals:**
- Unified edge case detection at analysis entry point
- Named functions with clear responsibilities and test coverage
- Pre-filter test files before BFS traversal (vs inline during traversal)
- User-friendly messages for edge cases (empty project suggestions, single-file simplified output)
- CLI commands integrate detection before full analysis

**Non-Goals:**
- Custom edge case handlers via config (future enhancement)
- Test file pattern customization (use standard patterns for MVP)
- Partial analysis for test-only projects (treat as normal)

## Decisions

### Decision 1: Pre-filter vs Inline Filter for Test Files

**Chosen**: Pre-filter at analysis entry

**Alternatives**:
- Inline during BFS: Current approach, but inefficient for test-heavy projects
- Post-filter: After analysis complete, but wastes parse effort

**Rationale**: Pre-filter reduces analysis workload significantly for test-heavy projects (e.g., 100 test files, 10 source files). Also provides clearer user feedback about filtered files.

### Decision 2: Edge Case Detection Return Type

**Chosen**: Enum-based result type

```typescript
type ProjectKind = 'empty' | 'single-file' | 'test-only' | 'normal';
type SpecialCaseResult = {
  kind: ProjectKind;
  sourceFiles: string[];
  testFiles: string[];
};
```

**Alternatives**:
- Boolean flags: Multiple flags for empty/single/test-only, confusing
- Exception-based: Throw error for edge cases, but loses information

**Rationale**: Enum provides clear branching logic and carries file lists for handlers.

### Decision 3: Handler Integration Point

**Chosen**: CLI command entry (before calling analyzer)

**Alternatives**:
- Analyzer internal: Handlers inside `analyzeFull()`, but less testable
- Scanner level: During file discovery, but analyzer should orchestrate

**Rationale**: CLI entry provides clean separation - handlers can return early without wasting analysis cycles. Better testability with mock analyzer.

## Risks / Trade-offs

**Risk**: False positives for "empty" projects (e.g., project with only `.json` config files)
→ Mitigation: Check for source file extensions specifically (`.ts`, `.tsx`, `.js`, `.jsx`, `.vue`), not any file

**Risk**: Single-file projects that import from other files (actually multi-file)
→ Mitigation: Check if imports resolve to files within project - if yes, treat as normal

**Trade-off**: Pre-filtering test files may miss edge cases where user wants test analysis
→ Acceptance: MVP scope - can add `--include-tests` flag in future if needed