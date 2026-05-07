# E2E Test Report: Developer Agent Scenario - "理解项目架构层级"

**Test Date**: 2026-05-08
**Agent Role**: E2E_Tester
**Target**: codegraph CLI `layers` command
**Test Environment**: oh-my-terminator project

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Flows Tested | 3 |
| Flows Passed | 1 |
| Flows Failed | 2 |
| Ready for Release | **NO** - Critical bug detected |

---

## Test Scenarios Executed

### Scenario 1: Default Source-Root Auto-Detection

**Command**: `npx tsx bin/codegraph.ts layers --json` (from packages/codegraph)

**Result**: **FAILED**

```json
{
  "success": false,
  "error": {
    "code": "E_NO_GIT_REPO",
    "message": "Not a git repository. CodeGraph requires a git repository with commits."
  }
}
```

**Issue**: CLI fails to detect git repository when run from subdirectory. The project IS a git repo at root level.

---

### Scenario 2: Verbose Mode from Project Root

**Command**: `npx tsx packages/codegraph/bin/codegraph.ts layers --verbose --json` (from project root)

**Result**: **FAILED - Empty Layers**

```json
{
  "success": true,
  "layers": [],
  "violations": [],
  "healthScore": 100,
  "groups": []
}
```

**Issue**: Auto-detection finds project root (package.json location) but not the source directory. Source root scoring returns 0 confidence for the project root itself.

---

### Scenario 3: Explicit Source-Root

**Command**: `npx tsx packages/codegraph/bin/codegraph.ts layers --source-root packages/codegraph/src --json`

**Result**: **PASSED**

Full output captured successfully with 7 layers, semantic naming, and violation detection.

---

## Issue Analysis

---

## Issue #1: Git Repository Detection Failure

**Type**: 功能缺失 (Functional Bug)
**Severity**: **BLOCKING**
**Priority**: P0

**Description**: CLI fails to detect git repository when run from a subdirectory within a valid git project.

**Reproduction Steps**:
1. Navigate to `packages/codegraph` directory
2. Run `npx tsx bin/codegraph.ts layers --json`
3. Observe `E_NO_GIT_REPO` error

**Expected Result**: CLI should detect git repo at project root and proceed with analysis.
**Actual Result**: Error `Not a git repository` despite valid git repo at `/Users/archy/Projects/StartUp/oh-my-terminator`.

**Root Cause Analysis**:
- The `resolveSourceRoot` function calls `detectSourceRoot(cwd)` which searches UPWARD for markers
- The git check happens BEFORE or INDEPENDENTLY of upward search
- Git repo detection likely checks current directory instead of walking upward

**Impact**: Agents running CLI from subdirectories cannot use auto-detection. Forces explicit `--source-root` for every invocation.

---

## Issue #2: Empty Layers with Auto-Detection

**Type**: 交互问题 (Interaction Issue)
**Severity**: **SERIOUS**
**Priority**: P1

**Description**: Auto-detection returns empty layers when run from project root without explicit source-root.

**Reproduction Steps**:
1. Navigate to project root `/Users/archy/Projects/StartUp/oh-my-terminator`
2. Run `npx tsx packages/codegraph/bin/codegraph.ts layers --json`
3. Observe empty `layers: []` with `healthScore: 100`

**Expected Result**: Should auto-detect `packages/codegraph/src` as source root OR provide guidance.
**Actual Result**: Returns success with empty data, misleading health score of 100.

**Root Cause Analysis**:
- `detectSourceRoot` finds project root (where package.json is)
- Source root scoring at project root returns score=0 (no `src`, `lib`, `app` directory name match)
- Confidence threshold not met, but CLI returns empty success instead of error or guidance

**Impact**: Developer agents receive misleading "healthy" output with no actionable data.

---

## Issue #3: Missing SourceRootMeta in Output

**Type**: 功能缺失 (Feature Gap)
**Severity**: **GENERAL**
**Priority**: P2

**Description**: CLI output does not include `sourceRootMeta` (confidence, candidates, detection method) as required for agent decision support.

**Evidence**: The verbose JSON output shows:
- `sourceRootScore: 0` in suggestions context
- No `sourceRootMeta` field in main output

**Expected Result**: Output should include:
```json
{
  "sourceRootMeta": {
    "detectedPath": "...",
    "confidence": 0.7,
    "candidates": [
      { "path": "...", "score": 25 },
      { "path": "...", "score": 10 }
    ],
    "method": "auto-detect" | "explicit"
  }
}
```

**Actual Result**: No `sourceRootMeta` field. Only hints in suggestions.

**Impact**: Agents cannot understand detection certainty or explore alternative source roots.

---

## Passing Results Analysis

### Layer Inference Accuracy (7-Layer Architecture)

When explicit source-root provided, the 7-layer architecture is **correctly inferred**:

| Layer | Role | Groups | File Count |
|-------|------|--------|------------|
| 1 | Foundation | `__root__` | 8 |
| 2 | Core | `analyzer`, `core`, `git` | 17 |
| 3 | Application | `parser` | 24 |
| 4 | Presentation | `config` | 7 |
| 5 | API Layer | `api` | 50 |
| 6 | Data Layer | `persistence` | 33 |
| 7 | CLI Layer | `cli` | 33 |

**Assessment**: Layer hierarchy reflects actual dependency flow (Foundation → CLI Layer).

---

### Naming Semantic Quality

Layers 5-7 correctly display semantic names with `namingInfo`:

```json
{
  "layer": 5,
  "role": "API Layer",
  "namingInfo": {
    "pattern": "^(api|routes|endpoints)$",
    "isExactMatch": true,
    "finalPriority": 20
  }
}
```

**Assessment**: EXCELLENT - Pattern matching provides semantic context for agent understanding.

---

### Violation Detection

7 violations detected with severity classification:

| From Layer | To Layer | Count | Severity |
|------------|----------|-------|----------|
| analyzer (Layer 2) | cli (Layer 7) | 2 | **critical** |
| git (Layer 2) | persistence (Layer 6) | 1 | **critical** |
| __root__ (Layer 1) | persistence (Layer 6) | 1 | **critical** |
| __root__ (Layer 1) | api (Layer 5) | 1 | **critical** |
| __root__ (Layer 1) | parser (Layer 3) | 2 | moderate |
| config (Layer 4) | api (Layer 5) | 5 | minor |
| __root__ (Layer 1) | core (Layer 2) | 1 | minor |

**Assessment**: GOOD - Violations correctly detected with actionable suggestions.

---

### Agent Decision Support

The output provides useful guidance:

1. **Layer roles**: Clear semantic names help agents understand "where to put new code"
2. **nextSuggested**: `codegraph scope FILE:packages/codegraph/src/analyzer/edge-case-detector.ts`
3. **suggestions**: Cycle detection, structure review, source-root config suggestion

**Assessment**: GOOD - Provides actionable guidance for agent decision-making.

---

## Recommendations

### P0 - Critical Fix Required

1. **Git Repository Detection**: Implement upward search for `.git` directory BEFORE rejecting as non-git repo
2. Test case: Run from any subdirectory within valid git project should succeed

### P1 - Serious Fix Required

1. **Empty Layers Handling**: When auto-detection finds project root but no source directory:
   - Return error with guidance: "Detected project root at X but no source directory. Use --source-root to specify."
   - OR continue upward search for source root candidates
2. Do not return misleading `healthScore: 100` for empty analysis

### P2 - Enhancement

1. **SourceRootMeta**: Add `sourceRootMeta` field to JSON output including:
   - `detectedPath`
   - `confidence`
   - `candidates` (top 3 scored paths)
   - `method` (explicit | auto-detect)

---

## Token Consumption Estimate

| Operation | Estimated Tokens |
|-----------|------------------|
| 3 CLI invocations | ~500 |
| File reads (4 files) | ~4000 |
| Analysis and report writing | ~2000 |
| **Total** | ~6500 tokens |

---

## Visual Evidence

Screenshots not applicable for CLI testing. Raw JSON outputs captured in test execution logs above.

---

## Conclusion

The codegraph CLI `layers` command **core logic works correctly** when explicit source-root is provided. However, the **auto-detection flow has critical bugs** that prevent Developer Agents from using it without manual intervention.

**Verdict**: NOT READY FOR RELEASE until P0 and P1 issues are resolved.

---

**Report Path**: `/Users/archy/Projects/StartUp/oh-my-terminator/docs/e2e/e2e-report-cg-layers.md`