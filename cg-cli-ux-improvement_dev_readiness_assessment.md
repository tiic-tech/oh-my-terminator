# cg-cli-ux-improvement Development Readiness Assessment

## Executive Summary

- **Goal**: CLI UX P1/P2 fixes from E2E Round3 - transform raw CACError stack traces into friendly, actionable error messages
- **Artifacts analyzed**: 6 documents (proposal.md, design.md, tasks.md, 3 spec.md files)
- **Overall assessment**: **可开发但有风险** - Implementation details are partially specified, some ambiguities require resolution before coding
- **Critical issues**: 0 blocking, 4 risk-level, 13 suggestion-level
- **Recommended actions**: Clarify CACError parsing regex patterns, define path format detection logic, unify message formats across documents

## Artifact Coverage Map

| Document | Relevance | Key Content |
|----------|-----------|-------------|
| `proposal.md` | DIRECT | Why/What/Capabilities/Impact - high-level scope |
| `design.md` | DIRECT | Context/Goals/Decisions/Risks - implementation strategy |
| `tasks.md` | DIRECT | 6-section task breakdown with 24 checkboxes |
| `specs/cli-error-handling/spec.md` | DIRECT | 6 requirements with WHEN/THEN scenarios |
| `specs/impact-analysis/spec.md` | INDIRECT | Delta: path format hint addition |
| `specs/scope-query/spec.md` | INDIRECT | Delta: path format hint addition |

## Issue Analysis

### 🔴 Blocking Issues (阻止开发)

None identified. Documents provide sufficient context to begin implementation.

### 🟡 Risk Issues (可能引发bug)

| # | Issue Type | Location | Original Content | Problem Description | Resolution |
|---|------------|----------|------------------|---------------------|------------|
| 1 | 缺失 | design.md:Decision 2 | "Extract key information via regex patterns, not strict string matching" | No regex patterns specified for CACError message parsing. Developer must reverse-engineer CAC error message formats. | Define regex patterns: `^Unknown command '(.+)'$`, `^Unknown option '(.+)'$`, `^Missing required argument (.+)$` |
| 2 | 模糊 | design.md:Decision 3 | `Available targets: --list-targets flag not yet implemented (planned for future)` | Unclear if this text is part of error output or a placeholder note. If included in output, may confuse users. | Remove from error message. Add separate "hint" for future feature if needed. |
| 3 | 缺失 | design.md:Decision 3 + specs | Path format detection logic undefined. Spec says "suppress hint for valid format" but no criteria specified. | Developer cannot implement path format validation without knowing what constitutes "valid format". | Define valid path regex: `^packages/[a-z-]+/src/.+\.ts$` for monorepo format |
| 4 | 不一致 | design.md vs specs | design.md: `Hint: In monorepos, use packages/codegraph/src/analyzer/index.ts` <br> specs: `Hint: Use full path format: packages/<pkg>/src/<file>.ts` | Message format differs between documents. Implementation may output wrong format. | Unify to spec format: generic template with `<pkg>` placeholder |

### 🟢 Suggestion Issues (改进建议)

| # | Issue Type | Location | Original Content | Problem Description | Resolution |
|---|------------|----------|------------------|---------------------|------------|
| 5 | 缺失 | design.md:Decision 2 | Error code `E_CLI_TARGET_NOT_FOUND` defined but no trigger location specified | Developer must search codebase to find where this error should be thrown. | Add to design.md: "Thrown by scope.ts and impact.ts when `getScope()`/`getImpact()` returns null" |
| 6 | 缺失 | specs/cli-error-handling:Scenario | "THEN message includes list of available commands in alphabetical order" | Alphabetical ordering not mentioned in design.md. May be forgotten during implementation. | Add to design.md Decision 3: "Suggestion lists are alphabetically sorted" |
| 7 | 缺失 | design.md + specs | How to generate command/flag suggestions? No mechanism specified. | Developer must figure out how to query CAC for available commands/flags. | Add to design.md: "Suggestions derived from CAC instance via `cac.commands` and command.options" |
| 8 | 不一致 | design.md vs spec | design.md: `{ success: false, error: { code, message } }` <br> spec: `{ "success": false, "error": { "code", "message" }, "durationMs": <ms> }` | `durationMs` field present in spec but absent in design.md. | Add `durationMs` to design.md Decision 4 JSON structure |
| 9 | 缺失 | specs/cli-error-handling | "WHEN error is not a CACError, THEN transformer wraps it as internal error" | No handling specified for analysis-level errors (e.g., parsing errors, import resolution failures). | Add to design.md: "Non-CLI errors pass through with original message, wrapped in E_CLI_INTERNAL" |
| 10 | 模糊 | tasks.md:4.3 | "Implement path format detection (monorepo vs standard)" | No definition of what constitutes monorepo detection. | Add to design.md: "Monorepo detected by presence of `packages/` directory at project root" |
| 11 | 缺失 | tasks.md:5.6 | "Add E2E test for path format hint display" | No specific test scenarios specified. | Add scenarios: (1) wrong path format → hint shown, (2) correct format but file missing → no hint |
| 12 | 缺失 | specs/cli-error-handling | No spec for internal error debugging in JSON mode | Design mentions "Include original error message in JSON mode for debugging" but spec doesn't cover this. | Add spec scenario: "JSON mode includes original error stack in error.debug field" |
| 13 | 模糊 | proposal.md:Capabilities | `cli-error-handling` capability defined as "Friendly error message formatting" | Capability scope unclear - is it just CLI layer or includes all error transformation? | Clarify: "CLI-layer only, internal errors pass through wrapped" |
| 14 | 缺失 | design.md:Risks | "CACError message format changes in future CAC versions" risk noted but no fallback strategy | If regex parsing fails, what is fallback behavior? | Add fallback: "If regex fails to extract info, display raw message with E_CLI_INTERNAL code" |
| 15 | 缺失 | specs/cli-error-handling | "Invalid flag '--invalid-flag'. Available flags: --json, --source-root, --verbose" | Example flags specific to `analyze` command. Should be dynamic per command. | Clarify in spec: "Available flags are command-specific, extracted from CAC command options" |
| 16 | 缺失 | tasks.md:3.4 | "Route structured JSON errors to stdout in JSON mode" | Implementation detail missing - how to detect JSON mode? | Clarify: "JSON mode detected by `process.argv.includes('--json')` before error handling" |
| 17 | 缺失 | specs/impact-analysis + specs/scope-query | Both specs have identical path hint scenarios | Duplication between specs may cause maintenance burden. | Accept duplication - each spec should be self-contained |

## Ambiguity Decisions Required

| Ambiguity | Options | Default Assumption | Decision Owner |
|-----------|---------|-------------------|----------------|
| CACError regex patterns | (A) Hardcode patterns based on CAC version (B) Use flexible regex with fallback | Option B with fallback to raw message | Developer |
| Monorepo detection logic | (A) Check `packages/` directory (B) Check `pnpm-workspace.yaml` (C) Both | Option A - simple check for `packages/` | Developer |
| Path hint suppression regex | (A) `^packages/[a-z-]+/src/.+\.ts$` (B) Any path containing `packages/` | Option A - strict format validation | Developer |
| `durationMs` calculation | (A) From CLI start time (B) From error occurrence time | Option A - total CLI execution time | Developer |

## Document Update Plan

### Updates to Existing Documents

| Document | Action | Content to Preserve | Content to Fix |
|----------|--------|---------------------|----------------|
| `design.md` | ADD | All decisions, context, goals | Add: regex patterns for CACError, path format detection logic, suggestion generation mechanism, `durationMs` in JSON structure, monorepo detection criteria, fallback strategy |
| `design.md` | MODIFY | Decision 3 message format | Unify path hint format to match specs: `Hint: Use full path format: packages/<pkg>/src/<file>.ts` |
| `design.md` | REMOVE | N/A | Remove placeholder text: "Available targets: --list-targets flag not yet implemented" |
| `specs/cli-error-handling/spec.md` | ADD | All scenarios | Add: JSON debug field scenario, command-specific flag extraction, internal error passthrough |
| `tasks.md` | ADD | All task items | Add: regex pattern definition as pre-requisite for 2.2, monorepo detection spec for 4.3 |
| `proposal.md` | CLARIFY | All sections | Clarify capability scope: "CLI-layer error transformation only" |

### New Documents to Create

None required. Existing documents cover all aspects after updates.

## Developer Checklist

Pre-development verification:

- [ ] **CACError regex patterns defined** - Before implementing `transformCACError()`, define patterns for: unknown command, unknown flag, missing argument
- [ ] **Path format validation regex defined** - Before implementing path hint suppression, define valid path format pattern
- [ ] **Monorepo detection criteria defined** - Before implementing task 4.3, define what triggers monorepo hint
- [ ] **JSON structure finalized** - Ensure `durationMs` field included in JSON error output
- [ ] **Suggestion extraction mechanism defined** - Understand CAC API for querying available commands/flags
- [ ] **Fallback strategy defined** - Plan for when regex parsing fails

## Appendix: Key Artifact Contents

### proposal.md - Affected Code
```
- packages/codegraph/bin/codegraph.ts - CLI entry point error handling
- packages/codegraph/src/cli/commands/scope.ts - Path format hint
- packages/codegraph/src/cli/commands/impact.ts - Path format hint
- packages/codegraph/src/cli/error-transformer.ts - CACError to friendly message transformation
- packages/codegraph/src/cli/error-codes.ts - Error code definitions
```

### design.md - Error Codes
```
- E_CLI_UNKNOWN_COMMAND: Unknown command entered
- E_CLI_UNKNOWN_FLAG: Invalid flag used
- E_CLI_MISSING_ARG: Required argument missing
- E_CLI_TARGET_NOT_FOUND: Target path not found (scope/impact)
- E_CLI_INTERNAL: Unexpected internal error
```

### tasks.md - Task Sections
```
1. Setup (2 items)
2. Error Transformer (5 items)
3. CLI Entry Point Integration (4 items)
4. Path Format Hints (4 items)
5. Testing (6 items)
6. Verification (4 items)
```

---

**Assessment Date**: 2026-05-07
**Assessed By**: ambiguity-clarify workflow
**Next Step**: Update design.md with missing implementation details before starting Task 1