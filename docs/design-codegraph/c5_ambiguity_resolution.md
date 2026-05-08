# C5 (Full Analysis Flow) Ambiguity Resolution Log

**Resolution Date**: 2026-05-03
**Resolver**: Claude Code Agent
**Change ID**: C5 - `cg-full-analysis-flow`
**Spec Document**: `05_c5_full_analysis_flow_spec.md`

---

## Executive Summary

Nine ambiguities identified in the readiness review have been analyzed against the C5 spec:
- **A1-A9**: All ambiguities from the review are **RESOLVED** by the spec
- **A10-A12**: Three new ambiguities identified during analysis - **RESOLVED** by cross-reference with C1/C3 specs

C5 is now **READY** for OpenSpec creation.

---

## Resolution Details

### A1: Parser Registration Mechanism (RESOLVED - P0)

**Original Question**: How are parsers registered and selected for different file types?

**Example Scenario**:
```typescript
// How do we register parsers for .ts, .js, .vue, .py files?
// Where is the registration stored?
// How does analyzeFull() find the right parser?
```

**Options Considered**:
1. Option 1: Hardcoded parser mapping in analyzeFull
2. Option 2: Global singleton registry
3. Option 3: Registry pattern with explicit registration

**Resolution Decision**: **Option 3 - Registry pattern with ParserRegistry interface**

**Rationale**:
1. Extensible - new parsers can be registered without modifying analyzeFull
2. Testable - registry can be mocked or replaced
3. Clean separation - parser selection logic isolated from orchestration
4. Matches common plugin architecture patterns

**Implementation Guidance**:
- Use `DefaultParserRegistry` implementation (Section 3.3)
- Register TypeScriptParser at initialization (Section 3.4)
- Select parser via `registry.getParser(extension)` (Section 4.4)
- Parser interface defines `name`, `extensions`, `parse()` (Section 3.1)

**Spec Reference**: `05_c5_full_analysis_flow_spec.md` Section 3

**Updated In**:
- No updates needed - spec fully defines the mechanism

---

### A2: Error Handling/Aggregation Strategy (RESOLVED - P0)

**Original Question**: When a single file fails parsing, should the entire analysis fail or continue?

**Example Scenario**:
```typescript
// Project with 100 files, 3 have syntax errors
// Should analyzeFull:
// - Throw exception and abort?
// - Return partial results with error count?
// - Continue and collect all errors?
```

**Options Considered**:
1. Option 1: Fail-fast - abort on first error
2. Option 2: Collect errors, fail at end
3. Option 3: Continue-on-error, return partial graph + warnings

**Resolution Decision**: **Option 3 - Continue-on-error pattern**

**Rationale**:
1. Single file failure shouldn't block entire project analysis
2. Partial graph is still useful for understanding project structure
3. Warnings list provides comprehensive error report
4. Stats.parseErrors enables quality metrics
5. Consistent with C2 Scanner error handling

**Implementation Guidance**:
- Parser errors: Record warning, increment parseErrors, continue (Section 5.2)
- Scanner errors: Merge warnings, continue (Section 5.3)
- Error classification: Scanner-level, Parser-level, Merge-level (Section 5.1)
- Final result always returns `{ graph, stats, warnings }`

**Spec Reference**: `05_c5_full_analysis_flow_spec.md` Section 5

**Updated In**:
- No updates needed - spec fully defines error handling

---

### A3: Return Type Specification (RESOLVED - P0)

**Original Question**: What exactly does analyzeFull() return?

**Example Scenario**:
```typescript
// What type is returned?
// Does it include error information?
// Does it include statistics?
// Is the graph mutable or frozen?
```

**Options Considered**:
1. Option 1: Return just CodeGraph
2. Option 2: Return { graph, errors }
3. Option 3: Return FullAnalysisResult with graph, stats, warnings

**Resolution Decision**: **Option 3 - FullAnalysisResult interface**

**Rationale**:
1. Graph alone insufficient for understanding analysis quality
2. Stats enable performance monitoring and optimization
3. Warnings provide actionable feedback for fixing issues
4. Single return type simplifies API contract
5. Enables CLI to display comprehensive summary

**Implementation Guidance**:
- Interface: `FullAnalysisResult { graph, stats, warnings }` (Section 2.2)
- Stats: `AnalysisStats` with timing and counts (Section 2.3)
- Warnings: `string[]` for human-readable error messages
- Graph: `CodeGraph` instance (mutable, caller may freeze)

**Spec Reference**: `05_c5_full_analysis_flow_spec.md` Section 2.2, 2.3

**Updated In**:
- No updates needed - spec fully defines return type

---

### A4: Scope Boundary (RESOLVED - P0)

**Original Question**: Does C5 include intelligence engine features or just orchestration?

**Example Scenario**:
```typescript
// Should analyzeFull also:
// - Detect cycles?
// - Infer architecture layers?
// - Calculate maturity scores?
// Or just assemble C1-C4 results?
```

**Options Considered**:
1. Option 1: Include intelligence features (cycle detection, layer inference)
2. Option 2: Pure orchestration - only combine C1-C4
3. Option 3: Configurable - optional intelligence features

**Resolution Decision**: **Option 2 - Pure orchestration only**

**Rationale**:
1. C5 is defined as "组合 C1-C4 组件" (Section 1.1)
2. Intelligence features belong to C7/C8 (API layer) and M3 milestone
3. Simpler MVP - orchestration first, intelligence later
4. Clear separation of concerns
5. Enables incremental delivery

**Implementation Guidance**:
- C5 only: Scan → Parse → Merge (Section 4.1)
- Intelligence features: Use M3 changes (C18-C26 in develop_changes_plan.md)
- Cycle detection: C18 `cg-cycle-detection`
- Layer inference: C19 `cg-layer-inference`
- Maturity scoring: C22 `cg-maturity-scoring`

**Spec Reference**: `05_c5_full_analysis_flow_spec.md` Section 1.1, 4.1

**Updated In**:
- No updates needed - scope clearly defined

---

### A5: Concurrency/Sequencing Approach (RESOLVED - P1)

**Original Question**: Should file parsing be sequential or parallel?

**Example Scenario**:
```typescript
// 1000 files to parse
// Sequential: Simple but slow
// Parallel: Fast but memory-intensive
// Which for MVP?
```

**Options Considered**:
1. Option 1: Fully parallel (Promise.all)
2. Option 2: Sequential (for loop with await)
3. Option 3: Batched parallel (chunks with concurrency limit)

**Resolution Decision**: **Option 2 - Sequential parsing for MVP**

**Rationale**:
1. Simple implementation - no concurrency complexity
2. Memory-friendly - AST released after each file
3. MVP prioritizes correctness over performance
4. Parallel parsing noted as future optimization (Section 7.1)
5. worker_threads mentioned for later enhancement

**Implementation Guidance**:
- Use sequential loop: `for (const file of files) { await parse() }` (Section 4.4)
- Immediate AST release after merge (Section 7.2)
- No intermediate storage (Section 7.3)
- Performance target: 100 files < 5s (Section 8.1 T04)

**Spec Reference**: `05_c5_full_analysis_flow_spec.md` Section 7.1, 7.2

**Updated In**:
- No updates needed - approach clearly defined

---

### A6: Progress Reporting Mechanism (RESOLVED - P1)

**Original Question**: How should progress be reported during long analysis?

**Example Scenario**:
```typescript
// Analyzing 500 files
// How to show progress?
// Console output? Callback? Event stream?
// What granularity?
```

**Options Considered**:
1. Option 1: Console logging (console.log)
2. Option 2: Event emitter pattern
3. Option 3: Optional callback with ProgressEvent

**Resolution Decision**: **Option 3 - Optional ProgressCallback**

**Rationale**:
1. Optional - default silent mode for programmatic use
2. Callback enables CLI progress bars, IDE integration
3. Structured events with phase, current, total, message
4. No dependency on specific UI framework
5. Testable - can capture callback invocations

**Implementation Guidance**:
- Type: `ProgressCallback = (event: ProgressEvent) => void` (Section 2.5)
- Event: `{ phase, current, total, message?, filePath? }`
- Phases: 'scan' | 'parse' | 'merge' | 'complete'
- Trigger per-file in parse phase (Section 4.4)
- Silent when `options.onProgress` undefined (Section 4.4)

**Spec Reference**: `05_c5_full_analysis_flow_spec.md` Section 2.5, 4.4

**Updated In**:
- No updates needed - mechanism clearly defined

---

### A7: Empty Project Handling (RESOLVED - P2)

**Original Question**: What happens when analyzing a project with no parseable files?

**Example Scenario**:
```typescript
// Empty directory or only .md/.json files
// Should analyzeFull:
// - Throw error?
// - Return null?
// - Return empty graph?
```

**Options Considered**:
1. Option 1: Throw "No parseable files" error
2. Option 2: Return null/undefined
3. Option 3: Return valid result with empty graph

**Resolution Decision**: **Option 3 - Return valid result with empty graph**

**Rationale**:
1. Valid project state - not an error condition
2. Graph still contains DIRECTORY/FILE nodes from scanner
3. stats.filesParsed = 0 reflects reality
4. warnings may note "No parseable files found"
5. Consistent return type - no special cases

**Implementation Guidance**:
- Check: `if (scanResult.filesToParse.length === 0)` (Section 6.1)
- Return: `{ graph, stats, warnings }` with filesParsed=0
- Graph: Contains C2 scan results (DIRECTORY/FILE nodes)
- Warning: Optional "No parseable files" message
- Test case: T02 "Empty project analysis" (Section 8.1)

**Spec Reference**: `05_c5_full_analysis_flow_spec.md` Section 6.1

**Updated In**:
- No updates needed - handling clearly defined

---

### A8: Large Repository Memory Strategy (RESOLVED - P2)

**Original Question**: How to handle memory for large projects (1000+ files)?

**Example Scenario**:
```typescript
// 5000 files project
// TypeScript Program holds all ASTs?
// Memory grows to 500MB+?
// How to limit?
```

**Options Considered**:
1. Option 1: Load all ASTs, process at end
2. Option 2: Stream processing with file batches
3. Option 3: Sequential parsing with immediate AST release

**Resolution Decision**: **Option 3 - Sequential parsing + immediate AST release**

**Rationale**:
1. Minimal memory footprint - only one AST at a time
2. TypeScript Program created per-file (from C3 spec) or disposed after
3. Simple implementation - no batching complexity
4. Sufficient for MVP (1000 files < 5s target)
5. Worker_threads for parallel future optimization

**Implementation Guidance**:
- Sequential loop processes one file at a time (Section 7.2)
- AST released after `mergeParserResult()` returns
- TypeScript Program disposed after parsing (C3 spec Section 9.3)
- No intermediate JSON storage (Section 7.3)
- Memory target: < 256MB (C3 spec Section 10.8 P03)

**Spec Reference**: `05_c5_full_analysis_flow_spec.md` Section 6.4, 7.2

**Updated In**:
- No updates needed - strategy clearly defined

---

### A9: Git Dependency Handling (RESOLVED - P2)

**Original Question**: Does C5 require Git for baseline or version tracking?

**Example Scenario**:
```typescript
// analyzeFull() needs to:
// - Detect project commit?
// - Store lastCommit.txt?
// - Or is that C6's job?
```

**Options Considered**:
1. Option 1: Git-required - fail if no .git
2. Option 2: Git-optional - graceful degradation
3. Option 3: No Git dependency for C5

**Resolution Decision**: **Option 3 - No Git dependency for C5 MVP**

**Rationale**:
1. C5 is full analysis - no incremental/baseline needs
2. Git operations belong to C6 (baseline persistence) and C9 (update command)
3. Full analysis works on any directory, Git or not
4. Simpler MVP - no external tool dependency
5. Git integration clearly in M2 scope (C14 cascade update)

**Implementation Guidance**:
- C5 `analyzeFull()` has no Git dependency (Section 6.5)
- C6 `persistBaseline()` handles Git commit detection
- C9 `update` command uses isomorphic-git for file changes
- Test fixtures don't require Git repository

**Spec Reference**: `05_c5_full_analysis_flow_spec.md` Section 6.5

**Updated In**:
- No updates needed - boundary clearly defined

---

### A10: Parser Instantiation Configuration (RESOLVED - NEW)

**Original Question**: How does TypeScriptParser get tsconfig.json configuration?

**Example Scenario**:
```typescript
// In Section 9.1: new TypeScriptParser()
// But TypeScript needs baseUrl/paths from tsconfig
// How is this passed?
```

**Options Considered**:
1. Option 1: Parser constructor takes CompilerOptions
2. Option 2: Parser receives projectRoot at parse time
3. Option 3: Parser discovers tsconfig internally

**Resolution Decision**: **Option 2/3 - Parser receives projectRoot, discovers tsconfig**

**Rationale**:
1. C3 spec defines: `parseFiles(filePaths, projectRoot)` (Section 11.4)
2. Parser internally locates tsconfig via `ts.findConfigFile()` (C3 Section 2.1)
3. CompilerOptions merged from default + tsconfig (C3 Section 2.4)
4. No constructor arguments needed - configuration at parse time
5. Flexible - same parser instance works for multiple projects

**Implementation Guidance**:
- TypeScriptParser instantiation: `new TypeScriptParser()` (no args)
- Parse call: `parser.parse(filePath, content, cwd)` (Section 3.1)
- Tsconfig discovery: Internal in parser (C3 Section 2.1)
- CompilerOptions: Merged default + tsconfig (C3 Section 2.2, 2.4)

**Spec Reference**: 
- `05_c5_full_analysis_flow_spec.md` Section 9.1
- `03_c3_ts_parser_spec.md` Section 2.1, 11.4

**Updated In**:
- Cross-reference to C3 spec resolves this

---

### A11: Graph Merge Conflict Handling (RESOLVED - NEW)

**Original Question**: What happens if multiple parser results contain nodes with same ID?

**Example Scenario**:
```typescript
// Two files both export 'format' function
// Both create MODULE:src/utils/format.ts#format?
// Duplicate node ID in graph?
```

**Options Considered**:
1. Option 1: Throw error on duplicate
2. Option 2: Overwrite existing node
3. Option 3: Skip duplicate (idempotent add)

**Resolution Decision**: **Option 3 - Idempotent addNode (skip duplicates)**

**Rationale**:
1. MODULE nodes have unique IDs: `MODULE:filePath#exportName`
2. Different files export different functions - IDs naturally unique
3. C1 CodeGraph.addNode() should be idempotent (standard graph behavior)
4. Same file parsed twice shouldn't duplicate nodes
5. Merge handles scan nodes (FILE) + parse nodes (MODULE) without conflict

**Implementation Guidance**:
- Node ID uniqueness guaranteed by construction: `MODULE:file#name`
- `graph.addNode()` idempotent - no error on existing ID
- Merge flow: scan nodes first, then parse nodes (Section 4.1)
- Test: Duplicate parse should not create duplicate nodes

**Spec Reference**:
- `05_c5_full_analysis_flow_spec.md` Section 4.5
- C1 spec should define addNode idempotency

**Updated In**:
- C1 spec should confirm addNode idempotency
- No C5 changes needed

---

### A12: Progress Reporting Frequency (RESOLVED - NEW)

**Original Question**: How often is progress callback invoked?

**Example Scenario**:
```typescript
// 1000 files
// Callback per-file = 1000 invocations
// Too many? Need throttling?
// Or batched progress?
```

**Options Considered**:
1. Option 1: Throttled - minimum interval (e.g., 100ms)
2. Option 2: Batched - every N files (e.g., 10 files)
3. Option 3: Per-file - caller may throttle

**Resolution Decision**: **Option 3 - Per-file, caller responsible for throttling**

**Rationale**:
1. Spec shows per-file callback in loop (Section 4.4)
2. Callers can throttle if needed (UI frameworks have debounce utilities)
3. Simpler implementation - no internal throttling logic
4. Exact progress tracking - current/total always accurate
5. Test case T09 expects "N callbacks" (Section 8.3)

**Implementation Guidance**:
- Callback per-file: After each `await parser.parse()` (Section 4.4)
- Event includes: `{ current, total, filePath }`
- No internal throttling in analyzeFull
- CLI may throttle for display (separate concern)

**Spec Reference**: `05_c5_full_analysis_flow_spec.md` Section 4.4, 8.3

**Updated In**:
- No updates needed - frequency implied by code

---

## Documentation Updates Made

| Document | Section | Update Type |
|----------|---------|-------------|
| `05_c5_full_analysis_flow_spec.md` | All | Already complete - no updates needed |
| `c5_ambiguity_resolution.md` | (new) | Resolution log created |

---

## Cross-Reference Verification

Ambiguities resolved via cross-reference to existing specs:

| Ambiguity | Cross-Reference | Resolution Source |
|-----------|-----------------|-------------------|
| A10: Parser Config | C3 Section 2.1, 11.4 | Parser discovers tsconfig internally |
| A11: Graph Merge | C1 (implied) | addNode idempotent |
| A12: Progress Frequency | C5 Section 4.4, 8.3 | Per-file, test case confirms |

---

## Test Fixture Requirements

C5 test fixtures should cover all resolved ambiguities:

| Ambiguity | Test Scenario | Fixture |
|-----------|---------------|---------|
| A1 | Parser registration | `registry.register(new TypeScriptParser())` unit test |
| A2 | Error handling | Fixture with syntax error files (T05, T06) |
| A3 | Return type | Integration test verifying FullAnalysisResult |
| A4 | Scope boundary | No cycle detection in C5 output |
| A5 | Sequential parsing | Verify order matches scan result order |
| A6 | Progress callback | Test with callback capturing events (T09, T10, T11) |
| A7 | Empty project | Empty fixture directory (T02) |
| A8 | Memory strategy | Large fixture (100+ files) memory monitoring |
| A9 | Git independence | Test fixture without .git directory |
| A10 | Parser config | Fixture with tsconfig.json paths aliases |
| A11 | Graph merge | Duplicate node handling verification |
| A12 | Progress frequency | Count callback invocations (T09) |

---

## C5 Readiness Status

| Criterion | Previous Status | Current Status |
|-----------|-----------------|----------------|
| Input/Output Definitions | NEEDS_CLARIFICATION | **READY** |
| Ambiguous Terms | NEEDS_CLARIFICATION | **READY** |
| Dependencies | READY | READY |
| Testable Specifications | PARTIAL | **READY** |
| Implementation Approach | NEEDS_CLARIFICATION | **READY** |
| Parser Registration | P0 NEEDS_CLARIFICATION | **READY** |
| Error Handling | P0 NEEDS_CLARIFICATION | **READY** |
| Return Type | P0 NEEDS_CLARIFICATION | **READY** |
| Scope Boundary | P0 NEEDS_CLARIFICATION | **READY** |
| Concurrency | P1 NEEDS_CLARIFICATION | **READY** |
| Progress Reporting | P1 NEEDS_CLARIFICATION | **READY** |
| Empty Project | P2 NEEDS_CLARIFICATION | **READY** |
| Large Repo Memory | P2 NEEDS_CLARIFICATION | **READY** |
| Git Dependency | P2 NEEDS_CLARIFICATION | **READY** |

**Overall Status**: **READY FOR OPENSPEC CREATION**

---

## Next Steps

1. Create OpenSpec change using `/opsx:new cg-full-analysis-flow`
2. Generate proposal.md with resolved ambiguity decisions
3. Generate design.md with FullAnalysisResult schema
4. Generate specs/analyzer/spec.md with test scenarios
5. Begin implementation following spec Section 9.1 pattern

---

## Appendix: Spec Coverage Matrix

| Spec Section | Coverage | Ambiguities Resolved |
|--------------|----------|---------------------|
| Section 1: Overview | Complete | A4 (scope) |
| Section 2: Interfaces | Complete | A3 (return), A6 (progress) |
| Section 3: Parser Registry | Complete | A1 (registration) |
| Section 4: Analysis Flow | Complete | A5 (concurrency), A12 (frequency) |
| Section 5: Error Handling | Complete | A2 (error strategy) |
| Section 6: Edge Cases | Complete | A7 (empty), A8 (memory), A9 (git) |
| Section 7: Performance | Complete | A5, A8 (optimization) |
| Section 8: Test Scenarios | Complete | All testable |
| Section 9: Integration | Complete | A10 (parser config) |

---

## Appendix: Resolution Timeline

| Time | Action |
|------|--------|
| 10:00 | C5 spec read and analyzed |
| 10:10 | A1-A9 (original ambiguities) reviewed |
| 10:20 | A1-A9 confirmed RESOLVED by spec |
| 10:30 | A10-A12 (new ambiguities) identified |
| 10:40 | C3/C4 specs cross-referenced |
| 10:50 | A10-A12 confirmed RESOLVED by cross-reference |
| 11:00 | Resolution log documented |

---

**Resolution Complete**
**Document Version**: v1.0
**Created**: 2026-05-03