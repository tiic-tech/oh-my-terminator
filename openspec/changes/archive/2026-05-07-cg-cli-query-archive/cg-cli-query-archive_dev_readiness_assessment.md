# cg-cli-query-archive Development Readiness Assessment

## Executive Summary
- **Goal**: Verify and archive C10 (CLI query commands: scope, impact, layers, migrate)
- **Artifacts analyzed**: 4 change artifacts + 5 related specs + 2 code files
- **Overall assessment**: **Ready with minor documentation fixes**
- **Critical issues**: 0 (no blocking issues)
- **Risk issues**: 4 (documentation gaps)
- **Recommended actions**: Fix file path discrepancy, add verification success criteria

## Artifact Coverage Map

| Document | Location |关联度 | Status |
|----------|----------|--------|--------|
| proposal.md | `openspec/changes/cg-cli-query-archive/` | 直接 | ✅ Complete |
| design.md | `openspec/changes/cg-cli-query-archive/` | 直接 | ✅ Complete |
| tasks.md | `openspec/changes/cg-cli-query-archive/` | 直接 | ✅ Complete |
| cli-query-archive/spec.md | `openspec/changes/cg-cli-query-archive/specs/` | 直接 | ✅ Complete |
| cli-api-commands/spec.md | `openspec/specs/cli-api-commands/` | 参考 | ✅ Exists |
| scope-query/spec.md | `openspec/specs/scope-query/` | 参考 | ✅ Exists |
| impact-analysis/spec.md | `openspec/specs/impact-analysis/` | 参考 | ✅ Exists |
| architecture-layers/spec.md | `openspec/specs/architecture-layers/` | 参考 | ✅ Exists |
| quick-brief/spec.md | `openspec/specs/quick-brief/` | 参考 | ✅ Exists |

## Implementation Verification

### CLI Commands Existence ✅

| Command | File | Expected | Actual | Status |
|---------|------|----------|--------|--------|
| `scope` | `src/cli/commands/scope.ts` | ✅ | ✅ | Verified |
| `impact` | `src/cli/commands/impact.ts` | ✅ | ✅ | Verified |
| `layers` | `src/cli/commands/layers.ts` | ✅ | ✅ | Verified |
| `migrate` | `src/cli/commands/migrate.ts` | ✅ | ✅ | Verified |
| `brief` | N/A | ❌ (API-only) | ❌ | Verified |

### CLI Registration ✅

Location: `bin/codegraph.ts` (CAC framework)

| Requirement | Status |
|-------------|--------|
| scope registered | ✅ Line 102-119 |
| impact registered | ✅ Line 78-99 |
| layers registered | ✅ Line 122-139 |
| migrate registered | ✅ Line 56-75 |
| --json option for each | ✅ All commands have --json |

### Test Coverage ✅

| Test Category | Files | Status |
|---------------|-------|--------|
| API tests | `tests/unit/api/scope.test.ts`, `impact.test.ts`, `layers.test.ts` | ✅ |
| CLI command tests | `tests/unit/cli/commands/scope.test.ts`, `layers.test.ts`, `impact.test.ts` | ✅ |
| Formatter tests | `tests/unit/cli/output/scope-formatter.test.ts`, `impact-formatter.test.ts`, `layers-formatter.test.ts` | ✅ |
| E2E tests | `tests/e2e/layer-inference-pipeline.test.ts` | ✅ |

## Issue Analysis

### 🔴 Blocking Issues (阻止开发)

**None identified** - This is a verification-only change with no code implementation required.

### 🟡 Risk Issues (可能引发问题)

| # | Issue | Type | Location | Original Content | Impact | Resolution |
|---|-------|------|----------|------------------|--------|------------|
| 1 | Incorrect file path in proposal.md | 冲突 | proposal.md:30 | `src/cli/index.ts` | Developer may look for wrong file | Update to `bin/codegraph.ts` (CLI entry) or `src/cli/commands/index.ts` (barrel) |
| 2 | Smoke test gap for query commands | 缺失 | tests/smoke/cli.test.ts | Only tests analyze, update, migrate | Missing verification that scope/impact/layers appear in help output | Add smoke tests for scope, impact, layers --help |
| 3 | No explicit verification success criteria | 缺失 | design.md:10-26 | Table lists "Expected Features" without verification steps | Developer unclear what constitutes "verified" | Add checklist: file exists, command registered, --json option, tests pass |
| 4 | Spec verification scope unclear | 模糊 | design.md:10-26 | Lists spec references without what to verify | Unclear which spec requirements to check | Add specific spec requirements to verify per command |

### 🟢 Suggestion Issues (改进建议)

| # | Issue | Type | Location | Original Content | Impact | Resolution |
|---|-------|------|----------|------------------|--------|------------|
| 1 | No archive document template | 缺失 | design.md:42-49 | Lists structure without template | Developer creates ad-hoc format | Provide archive template with example sections |
| 2 | Brief status documentation unclear | 模糊 | tasks.md:1.6 | "Document brief command status" | Where/format unclear | Specify: document in archive.md under "Known Limitations" section |
| 3 | Original C10 change name missing | 缺失 | proposal.md | No reference to original change name | Traceability gap | Add: "Original change: C10 cg-cli-query-commands (archived as cg-cli-query-archive)" |

## Ambiguity Decisions Required

| Ambiguity | Options | Default Assumption | Decision Owner |
|-----------|---------|-------------------|----------------|
| Verification success criteria | a) File exists + command registered + tests pass / b) Full spec compliance test / c) Manual feature check | Option a (minimal verification for archival) | Developer |
| Brief status documentation location | a) In archive.md / b) In separate brief-status.md / c) In tasks.md completion notes | Option a (archive.md Known Limitations) | Developer |

## Document Update Plan

### Updates to Existing Documents

| Document | Action | Content to Preserve | Content to Fix |
|----------|--------|---------------------|----------------|
| proposal.md:30 | Update | Affected files list | Change `src/cli/index.ts` → `bin/codegraph.ts` |
| design.md:10-26 | Add | Verification process table | Add verification checklist with success criteria |
| tasks.md:1.6 | Clarify | Task description | Add "Document in archive.md Known Limitations section" |
| tests/smoke/cli.test.ts | Add | Existing smoke tests | Add scope, impact, layers --help tests |

### New Documents to Create

| Document Type | Purpose | Key Content |
|---------------|---------|-------------|
| archive.md | Archive documentation | Implementation summary, verification checklist, test coverage, known limitations |

## Developer Checklist

Pre-verification items:

- [ ] Confirm `bin/codegraph.ts` is CLI entry point (not `src/cli/index.ts`)
- [ ] Run `pnpm tsx bin/codegraph.ts --help` to see all commands
- [ ] Run `pnpm tsx bin/codegraph.ts scope --help` to verify scope registered
- [ ] Run `pnpm tsx bin/codegraph.ts impact --help` to verify impact registered
- [ ] Run `pnpm tsx bin/codegraph.ts layers --help` to verify layers registered
- [ ] Run `pnpm test tests/unit/cli/commands/` to verify command tests
- [ ] Confirm `src/cli/commands/brief.ts` does NOT exist (API-only)
- [ ] Create archive.md in `openspec/changes/archive/2026-05-07-cg-cli-query-archive/`

## Key Findings

1. **Implementation Complete**: All CLI commands exist and match spec requirements
2. **CAC Registration Verified**: All commands registered with --json options
3. **Test Coverage Good**: Unit, API, formatter, and E2E tests exist
4. **Smoke Test Gap**: cli.test.ts doesn't verify scope, impact, layers help output
5. **File Path Error**: proposal.md references wrong CLI index path
6. **Brief Status Correct**: quick-brief is API-only, no CLI command needed

## Appendix: Verification Commands

```bash
# Verify CLI entry point
pnpm tsx bin/codegraph.ts --help

# Verify scope command
pnpm tsx bin/codegraph.ts scope --help
pnpm tsx bin/codegraph.ts scope src/utils.ts --json

# Verify impact command
pnpm tsx bin/codegraph.ts impact --help
pnpm tsx bin/codegraph.ts impact src/core.ts --json

# Verify layers command
pnpm tsx bin/codegraph.ts layers --help
pnpm tsx bin/codegraph.ts layers --json

# Run CLI tests
pnpm test tests/unit/cli/commands/scope.test.ts
pnpm test tests/unit/cli/commands/impact.test.ts
pnpm test tests/unit/cli/commands/layers.test.ts
```

---
**Generated**: 2026-05-07
**Assessment Status**: Ready with documentation fixes