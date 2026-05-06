# cg-ts-import-type Development Readiness Assessment

## Executive Summary

- **Goal**: Implement TypeScript `import type` detection using `ImportClause.isTypeOnly`
- **Artifacts analyzed**: 6 files (proposal.md, design.md, tasks.md, 3 spec deltas)
- **Existing implementations analyzed**: 7 files (import-extractor.ts, types.ts, utils.ts, edge-generator.ts, extract.ts, scope-types.ts, scope-formatter.ts)
- **Overall assessment**: **可开发但有风险** (Ready to develop with risks)
- **Critical issues**: 0 blocking, 5 high-risk, 4 suggestions
- **Recommended actions**: Clarify ImportInfo type update, scope output format, RE_EXPORTS handling

---

## Artifact Coverage Map

| Artifact | Path | Type | Relation |
|----------|------|------|----------|
| proposal.md | openspec/changes/cg-ts-import-type/proposal.md | Change Definition | Direct |
| design.md | openspec/changes/cg-ts-import-type/design.md | Technical Design | Direct |
| tasks.md | openspec/changes/cg-ts-import-type/tasks.md | Implementation Tasks | Direct |
| ts-import-type spec | openspec/changes/cg-ts-import-type/specs/ts-import-type/spec.md | New Capability Spec | Direct |
| ts-parser-imports spec delta | openspec/changes/cg-ts-import-type/specs/ts-parser-imports/spec.md | Modified Spec | Direct |
| scope-query spec delta | openspec/changes/cg-ts-import-type/specs/scope-query/spec.md | Modified Spec | Direct |
| import-extractor.ts | packages/codegraph/src/parser/ts-parser/import-extractor.ts | Existing Implementation | Target |
| types.ts | packages/codegraph/src/parser/ts-parser/types.ts | Existing Implementation | Target |
| utils.ts | packages/codegraph/src/parser/ts-parser/utils.ts | Existing Implementation | Target |
| edge-generator.ts | packages/codegraph/src/parser/ts-parser/edge-generator.ts | Existing Implementation | Target |
| extract.ts | packages/codegraph/src/api/scope/extract.ts | Existing Implementation | Target |
| scope-types.ts | packages/codegraph/src/api/types/scope-types.ts | Existing Implementation | Target |

---

## Issue Analysis

### Risk Issues (可能引发bug)

| # | Issue Type | Location | Problem | Impact | Resolution |
|---|------------|----------|---------|--------|------------|
| 1 | 缺失 | tasks.md:4.2, scope-types.ts:58-65 | `ImportInfo` interface in scope-types.ts missing `kind` field. Tasks.md mentions adding `kind` field to import list in ScopeResult, but current ImportInfo has no such field. | Developer will add field to wrong location or forget to update ImportInfo | Update scope-types.ts ImportInfo interface: `interface ImportInfo { from: string; type: 'static' | 'dynamic' | 're-export'; specifiers: string[]; kind?: 'type-only' | 'value'; }` |
| 2 | 不一致 | specs/ts-import-type/spec.md:57-59 vs Goal | Spec says "Type-only imports in importedBy: file B's importedBy count still includes file A". But goal is to exclude type imports from dependency score. This is NOT contradiction - importedBy is reverse direction, doesn't affect importsFrom count. | Developer may misunderstand and try to filter importedBy | Clarify in spec: importedBy is reverse direction (who imports me), not importsFrom (who I import). Type exclusion applies to importsFrom only. |
| 3 | 缺失 | tasks.md:4.4, scope-formatter.ts | Task 4.4 says "Update scope Markdown output to show type/value distinction" but no format specified. Design.md only shows JSON format example. | Developer will implement inconsistent display format | Define Markdown format: `- import { User } from './types' (type-only)` or `- './types' [type-only]` |
| 4 | 不明确 | design.md:33-39, types.ts | ImportKind type not defined as standalone type or inline literal. Design.md shows `importKind: 'type-only' | 'value'` but no type declaration. | Inconsistent type definition across files | Add to types.ts: `export type ImportKind = 'type-only' | 'value';` |
| 5 | 不一致 | extract.ts:46-67 | extractImports() currently returns `string[]` (paths only), not objects with metadata. To include importKind, return type must change to `ImportInfo[]` or similar. | Breaking change or missed implementation | Option A: Change extractImports() to return `ImportInfo[]`; Option B: Create new function `extractImportsWithKind()` |

### Suggestion Issues (改进建议)

| # | Issue Type | Location | Problem | Impact | Resolution |
|---|------------|----------|---------|--------|------------|
| 1 | 缺失 | design.md:Non-goals, tasks.md:3.2 | Non-goals say "Modify re-export handling (`export type` syntax not MVP scope)" but tasks.md 3.2 says "Update edge-generator.ts to include importKind in RE_EXPORTS edge metadata". Contradiction? | Developer may skip or implement RE_EXPORTS type handling | Clarify: task 3.2 means RE_EXPORTS edges from regular re-exports (not `export type`). Add note: "`export type { X } from './types'` not in MVP - those RE_EXPORTS edges will have importKind='value' by default" |
| 2 | 缺失 | tasks.md | No test file paths specified. Unit tests listed but where to create them? | Developer may create tests in wrong location | Specify test paths: `packages/codegraph/src/parser/ts-parser/__tests__/import-extractor.test.ts`, `packages/codegraph/src/api/scope/__tests__/extract.test.ts` |
| 3 | 不明确 | utils.ts:47-77 | getImportSpecifierType() has access to `node.importClause` but doesn't check `isTypeOnly`. Implementation should be in this function or separate? | Developer may duplicate logic | Add isTypeOnly detection in utils.ts: `if (importClause.isTypeOnly) { kind = 'type-only'; }` or create new function `getImportKind()` |
| 4 | 缺失 | tasks.md:5.x | Integration tests mention "Verify IMPORTS edge has correct importKind" but no verification method specified. | Developer may write incomplete verification tests | Add verification criteria: `expect(edge.metadata.importKind).toBe('type-only')` |

---

## Ambiguity Decisions Required

| Ambiguity | Options | Default Assumption | Decision Owner |
|-----------|---------|-------------------|----------------|
| ImportInfo.kind field location | A: Add to scope-types.ts ImportInfo; B: Create new ImportInfoWithKind type | A (modify existing) | Developer |
| Scope Markdown format for importKind | A: `[type-only]` suffix; B: Separate line; C: JSON-style inline | A (minimal change) | Developer |
| RE_EXPORTS type handling | A: Always 'value'; B: Check exportClause.isTypeOnly; C: Skip for MVP | C (skip per non-goals) | Clarified in doc |
| extractImports() return type | A: Change to ImportInfo[]; B: Create new function; C: Add metadata separately | B (new function) | Developer |

---

## Document Update Plan

### Updates to Existing Documents

| Document | Action | Content to Preserve | Content to Fix |
|----------|--------|---------------------|----------------|
| design.md | Add section | Decision 1-4 preserved | Add "Decision 5: ImportInfo Type Update" explaining scope-types.ts modification |
| tasks.md | Clarify | Task structure preserved | Add test file paths; clarify task 3.2 (RE_EXPORTS for regular re-exports only) |
| specs/scope-query/spec.md | Add scenario | Existing scenarios preserved | Add "Scenario: ImportInfo with kind field" showing ImportInfo structure |
| specs/ts-import-type/spec.md | Clarify | Existing scenarios preserved | Add clarification note for importedBy vs importsFrom |

### New Documents to Create

| Document Type | Purpose | Key Content |
|---------------|---------|-------------|
| None | - | All changes fit in existing specs |

---

## Developer Checklist

Pre-development verification:

- [ ] Read existing import-extractor.ts implementation
- [ ] Read existing types.ts ParsedImportInfo interface
- [ ] Read existing scope-types.ts ImportInfo interface
- [ ] Understand `ImportClause.isTypeOnly` TypeScript Compiler API
- [ ] Confirm ImportKind type definition approach (standalone type)
- [ ] Confirm extractImports() return type change approach
- [ ] Confirm scope output format (Markdown [type-only] suffix)
- [ ] Understand RE_EXPORTS handling limitation (export type not MVP)

---

## Appendix: Key Code Snippets

### Existing ParsedImportInfo (types.ts:19-37)
```typescript
export interface ParsedImportInfo {
  sourceFile: string;
  specifier: string;
  resolvedPath: string | null;
  line: number;
  importType: 'import' | 're-export' | 'dynamic';
  importSpecifier: string;
  // MISSING: importKind: ImportKind
}
```

### Existing ImportInfo (scope-types.ts:58-65)
```typescript
export interface ImportInfo {
  from: string;
  type: 'static' | 'dynamic' | 're-export';
  specifiers: string[];
  // MISSING: kind: 'type-only' | 'value'
}
```

### Current extractImports() (extract.ts:46-67)
```typescript
export function extractImports(graph: CodeGraph, fileNode: GraphNode): string[] {
  // Returns paths only, no metadata
  // NEEDS: Return type change or new function
}
```

### Current edge metadata (edge-generator.ts:46-56)
```typescript
metadata: {
  line: info.line,
  importSpecifier: info.importSpecifier,
  // MISSING: importKind
}
```

---

## Overall Assessment

**Status**: **可开发但有风险** (Ready to develop with risks)

**Reasoning**:
1. Core implementation approach is clear (ImportClause.isTypeOnly)
2. Type system changes are well-defined (ImportKind type, ParsedImportInfo.importKind)
3. Edge metadata location is clear (edge-generator.ts)
4. Scope output format needs clarification (Markdown vs JSON)
5. extract.ts return type needs decision (change vs new function)
6. RE_EXPORTS handling needs clarification (task 3.2 vs non-goals)

**Confidence Level**: 85% - Implementation can proceed with minor clarifications

---

**Generated**: 2026-05-06
**Analyzer**: ambiguity-clarify skill