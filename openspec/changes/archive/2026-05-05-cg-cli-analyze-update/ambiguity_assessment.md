# C9 (cg-cli-analyze-update) Development Readiness Assessment

**Assessment Date**: 2026-05-04
**Goal**: 验证 openspec/changes/cg-cli-analyze-update/ artifacts是否覆盖所有C9开发内容
**Artifacts analyzed**: proposal.md, design.md, tasks.md, 4 spec files

---

## Executive Summary

| Aspect | Status | Details |
|--------|--------|---------|
| **Overall Coverage** | **85% COMPLETE** | 核心功能覆盖，细节有遗漏 |
| **Critical Issues** | 0 | 无阻塞问题 |
| **Risk Issues** | 5 | 实现细节未明确 |
| **Suggestion Issues** | 3 | 改进建议 |
| **Ambiguity Points** | 4 | 需要澄清 |

**Recommended Actions**: 
1. 补充 `isSupportedFile()` 函数定义到 git-integration spec
2. 明确 error codes 定义到 design.md
3. 统一 JSON schema 定义

---

## Artifact Coverage Map

### Coverage Analysis Against Original Requirements

| Source Requirement | Covered | Location | Gap |
|--------------------|---------|----------|-----|
| analyze command | ✓ | cli-analyze/spec.md, tasks §5 | Complete |
| update command | ✓ | cli-update/spec.md, tasks §5 | Missing: no-git handling |
| Git change detection | ✓ | git-integration/spec.md | Missing: `isSupportedFile()` |
| walk API fallback | ◐ | design.md D4 | Mentioned but not detailed |
| fs adapter | ✓ | git-integration/spec.md, Phase 0 done | Complete |
| JSON output | ✓ | cli-output/spec.md, design.md D3 | Schema discrepancy |
| Text output | ✓ | cli-output/spec.md | Complete |
| CLI entry point | ✓ | tasks §6 | Complete |
| removeFileFromGraph | ◐ | 09_spec line 468 | Not in tasks.md explicitly |
| Error codes | ✗ | Not defined | Missing: E_BASELINE_NOT_FOUND etc. |
| Integration tests | ✓ | tasks §7 | Complete |

**Legend**: ✓ Complete | ◐ Partial | ✗ Missing

---

## Issue Analysis

### 🟡 Risk Issues (可能引发bug)

| # | Issue | Location | Original Content | Impact | Resolution |
|---|-------|----------|------------------|--------|------------|
| R1 | **`isSupportedFile()` function not specified** | git-integration/spec.md | "Filter unsupported files" scenario exists but no function signature | Developer may implement incorrectly | Add to spec: `function isSupportedFile(filePath: string): boolean` with extension list |
| R2 | **Error codes not defined** | design.md, specs | "error: { code: string; message: string }" in schema but no specific codes | Inconsistent error handling across commands | Define: `E_NO_GIT_REPO`, `E_BASELINE_NOT_FOUND`, `E_PARSE_FAILED`, `E_WALK_API_FAILED` |
| R3 | **JSON schema discrepancy** | design.md D3 vs cli-structured-output-design.md | `edgesCreated: Record<string, number>` vs `{ imports, exports, contains }` | Type definition confusion | Use explicit interface: `{ imports: number; exports: number; contains: number }` |
| R4 | **update command no-git handling** | cli-update/spec.md | Not specified; cli-analyze has it | Unhandled error case | Add scenario: "Non-git directory error" to cli-update spec |
| R5 | **walk API fallback implementation** | design.md Risk table | "Fallback: iterate commits individually" mentioned | Implementation detail missing | Add `getFileChangesByWalkingCommits()` task to tasks §3 |

### 🟢 Suggestion Issues (改进建议)

| # | Issue | Location | Original Content | Impact | Resolution |
|---|-------|----------|------------------|--------|------------|
| S1 | **`removeFileFromGraph` not explicit in tasks** | tasks.md §5.11 | "Implement node removal via removeEdgesForFile()" | Developer may miss MODULE node removal | Add task: "5.11.1 Remove FILE node and MODULE sub-nodes for changed files" |
| S2 | **Type definition location unclear** | tasks.md §2.1 | "Define AnalyzeResult interface in types.ts" | May conflict with existing types | Specify: "Add to existing `src/types.ts` file, not create new file" |
| S3 | **`--help` output not specified** | tasks.md §6.6 | "Add help text for commands" | Help content undefined | Add to cli-output spec: Requirement for help text format |

---

## Ambiguity Points

### A1: JSON Schema for edgesCreated (CLARIFICATION NEEDED)

**Question**: Should `edgesCreated` be generic `Record<string, number>` or explicit `{ imports, exports, contains }`?

**Options**:
1. Generic: Flexible for future edge types
2. Explicit: Clear structure, type-safe

**Recommendation**: Option 2 (explicit) - MVP edge types are known, better type safety.

### A2: Error Code Namespace (DECISION NEEDED)

**Question**: What error codes should be defined?

**Recommended codes**:
```typescript
enum CliErrorCode {
  E_NO_GIT_REPO = 'E_NO_GIT_REPO',
  E_BASELINE_NOT_FOUND = 'E_BASELINE_NOT_FOUND',
  E_PARSE_FAILED = 'E_PARSE_FAILED',
  E_WALK_API_FAILED = 'E_WALK_API_FAILED',
  E_INVALID_PATH = 'E_INVALID_PATH',
}
```

### A3: supportedExtensions Source (CLARIFICATION NEEDED)

**Question**: Where should `supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs']` be defined?

**Options**:
1. In `change-detector.ts` (local)
2. In `parser-registry.ts` (centralized with parsers)

**Recommendation**: Option 2 - parsers define what they support, change detector queries registry.

### A4: Fallback Strategy Trigger Condition (CLARIFICATION NEEDED)

**Question**: When exactly should walk API fallback be triggered?

**From 09_spec**: 
```typescript
} catch (error) {
  console.warn('walk API failed, falling back to commit-by-commit approach');
  return getFileChangesByWalkingCommits(cwd, fromCommit, toCommit);
}
```

**Recommendation**: Catch any error from `git.walk()`, log warning, use fallback.

---

## Document Update Plan

### Updates to Existing Artifacts

| Document | Section | Action | Content to Add |
|----------|---------|--------|----------------|
| `design.md` | D3 | UPDATE | Change `edgesCreated: Record<string, number>` to explicit interface |
| `design.md` | Decisions | ADD | D5: Error Code Definitions with enum |
| `git-integration/spec.md` | Requirements | ADD | Requirement: `isSupportedFile()` function |
| `git-integration/spec.md` | Scenarios | ADD | Scenario: Non-git directory error for `getHeadCommit` |
| `cli-update/spec.md` | Requirements | ADD | Requirement: Non-git directory error handling |
| `tasks.md` | §3 | ADD | 3.10 Implement `getFileChangesByWalkingCommits()` fallback |
| `tasks.md` | §3 | ADD | 3.11 Define `isSupportedFile()` function |
| `tasks.md` | §5.11 | SPLIT | 5.11 → 5.11a Remove FILE node, 5.11b Remove MODULE sub-nodes |

---

## Developer Checklist

Pre-development verification items derived from analysis:

- [ ] Error codes defined in design.md or types.ts
- [ ] `isSupportedFile()` signature added to git-integration spec
- [ ] JSON schema for edgesCreated finalized (use explicit interface)
- [ ] walk API fallback task added to tasks.md
- [ ] update command error scenarios complete (add no-git case)
- [ ] Type definition location confirmed (existing types.ts)

---

## Appendix: Key References from Original Specs

### From 09_c9_isomorphic_git_spec.md (line 468-499)

```typescript
function removeFileFromGraph(graph: CodeGraph, filePath: string): number {
  let removedCount = 0;
  
  // 1. 找到 FILE 节点
  const fileId = `FILE:${filePath}`;
  const fileNode = graph.nodes.get(fileId);
  
  if (!fileNode) return 0;
  
  // 2. 找到该文件的所有 MODULE 子节点
  const moduleNodesToRemove: string[] = [];
  for (const [id, node] of graph.nodes) {
    if (node.type === NodeType.MODULE && node.path.startsWith(filePath)) {
      moduleNodesToRemove.push(id);
    }
  }
  
  // 3. 移除 MODULE 节点
  for (const moduleId of moduleNodesToRemove) {
    graph.removeNode(moduleId);
    removedCount++;
  }
  
  // 4. 移除 FILE 节点
  graph.removeNode(fileId);
  removedCount++;
  
  // 5. 清除与该文件相关的所有边
  graph.removeEdgesForFile(filePath);
```

### From cli-api-alignment-analysis.md (line 55-74)

```typescript
// Error handling needs JSON format
interface CliError {
  success: false;
  error: {
    code: string;  // 如 E_BASELINE_NOT_FOUND
    message: string;
  };
  durationMs: number;
}
```

---

**Report Version**: v1.0
**Generated**: 2026-05-04
**Assessment Type**: Pre-C9 Development Readiness Check