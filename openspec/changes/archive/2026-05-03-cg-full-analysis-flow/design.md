## Context

CodeGraph has completed C1-C4 implementation, providing individual components for graph storage, file scanning, and TypeScript parsing. However, there's no unified entry point to perform a complete repository analysis. Users must manually:
1. Call `scanDirectory()` (C2)
2. Merge scan results into `CodeGraph` (C1)
3. Call parser on each file (C3/C4)
4. Merge parse results into graph

This fragmented approach complicates CLI integration and prevents downstream features like baseline persistence and incremental updates.

**Constraints**:
- C1-C4 APIs are stable and cannot be modified
- No new external dependencies (use existing TypeScript Compiler API)
- Must handle errors gracefully (continue-on-error pattern)
- Memory-efficient for large repositories

## Goals / Non-Goals

**Goals:**
- Provide single `analyzeFull()` function for complete repository analysis
- Return structured `FullAnalysisResult` with graph, stats, and warnings
- Support extensible parser registration for future languages
- Enable optional progress reporting for CLI feedback
- Ensure partial failures don't stop overall analysis

**Non-Goals:**
- Intelligence engine features (architectural constraints, health scores) - deferred to C7/C8
- Baseline persistence - deferred to C6
- Incremental update logic - deferred to C6
- Parallel parsing optimization - MVP uses sequential, can optimize later
- Git integration - not needed for full analysis

## Decisions

### D1: Parser Registration Pattern

**Decision**: Registry pattern with `ParserRegistry` interface

**Alternatives Considered**:
1. Hardcoded mapping in `analyzeFull()` - rejected: not extensible, hard to test
2. Global singleton registry - rejected: hidden dependencies, testing complexity
3. Plugin auto-discovery - rejected: over-engineered for MVP, adds complexity

**Rationale**: Registry pattern provides:
- Extensibility: new parsers register without modifying core
- Testability: can inject mock registry for testing
- Clean separation: parser selection isolated from orchestration

### D2: Error Handling Strategy

**Decision**: Continue-on-error with warning collection

**Alternatives Considered**:
1. Fail-fast on first error - rejected: stops analysis, loses partial results
2. Retry with backoff - rejected: adds complexity, parsing errors often persistent
3. Skip entire batch on error - rejected: too aggressive, loses good files

**Rationale**:
- Single file parsing failure shouldn't affect others
- Users want maximum coverage, even with some failures
- Warning array provides full error context for debugging

### D3: Concurrency Strategy

**Decision**: Sequential parsing (MVP)

**Alternatives Considered**:
1. Parallel parsing with worker_threads - deferred: adds complexity, needs careful memory management
2. Batch parallel with chunking - deferred: similar complexity

**Rationale**:
- Sequential is simpler, easier to debug
- Immediate AST release prevents memory buildup
- Performance acceptable for MVP (<5s for 1000 files)
- Parallel optimization can be added later without API changes

### D4: Return Type Structure

**Decision**: `FullAnalysisResult` with graph, stats, warnings

**Alternatives Considered**:
1. Return only `CodeGraph` - rejected: loses error context, no progress visibility
2. Return tuple `[graph, warnings]` - rejected: less structured, no stats
3. Callback for warnings - rejected: less convenient, mixing patterns

**Rationale**:
- Structured result is easier to consume
- Stats enable performance monitoring and CLI reporting
- Warnings array provides complete error picture

## Risks / Trade-offs

### R1: Memory Usage on Large Projects

**Risk**: Large repositories (10k+ files) may exceed memory limits

**Mitigation**:
- Sequential parsing with immediate AST release
- TypeScript Program disposed after each file
- Memory benchmarking in tests (require <256MB for 1000 files)
- Future: streaming/batching if needed

### R2: Parser Selection Gaps

**Risk**: Files with unrecognized extensions silently skipped

**Mitigation**:
- Log warning for each skipped file
- Stats include `parseErrors` count
- Document supported extensions in API

### R3: Progress Callback Overhead

**Risk**: Frequent callbacks may slow analysis

**Mitigation**:
- Callback optional (default silent)
- Caller controls throttling if needed
- Per-file callback frequency documented

### R4: Integration Complexity

**Risk**: C1-C4 integration may have unexpected edge cases

**Mitigation**:
- Comprehensive integration tests (Section 8 of spec)
- Test fixtures covering C1-C4 interaction
- Existing C1-C4 tests provide baseline confidence