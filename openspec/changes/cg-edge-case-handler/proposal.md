## Why

The design documentation falsely claimed implementation of `handleEmptyProject()`, `handleSingleFileProject()`, and `excludeTestFiles()` functions. These edge case handlers are **P0 priority** because they directly impact user experience when analyzing small or edge-case projects. Current code crashes or produces confusing output for empty projects and single-file projects.

## What Changes

- **NEW**: `detectSpecialCases()` function to identify empty/single-file/normal projects at analysis entry
- **NEW**: `handleEmptyProject()` function with user-friendly error message and suggestions
- **NEW**: `handleSingleFileProject()` function with simplified analysis output
- **NEW**: `excludeTestFiles()` pre-filter function (vs. current inline filter during traversal)
- **MODIFIED**: CLI analyze/update commands integrate edge case detection before full analysis
- **BREAKING**: None - purely additive, existing behavior unchanged for normal projects

## Capabilities

### New Capabilities
- `edge-case-detector`: Detects special project states (empty, single-file, test-only) at analysis entry
- `test-file-filter`: Pre-filters test files before analysis starts (vs. inline filter)

### Modified Capabilities
- `analyzer`: Requirements for empty project handling already exist in spec but implementation was incomplete. This change properly implements the scenarios with named functions.
- `cli-analyze`: Integrates edge case detection before running full analysis

## Impact

**Affected Code**:
- `packages/codegraph/src/analyzer/` - New edge-case-detector.ts, empty-project-handler.ts, single-file-handler.ts, test-file-excluder.ts
- `packages/codegraph/src/cli/commands/analyze.ts` - Add edge case detection before analysis
- `packages/codegraph/src/cli/commands/update.ts` - Add edge case detection before update

**Dependencies**: C1 (graph-structure), C5 (analyzer) - uses existing CodeGraph and analysis flow

**API Impact**: No public API changes - internal handling only

**Test Impact**: New unit tests for all edge case handlers, CLI integration tests