# C10: CLI Query Commands - Archive Summary

**Change**: cg-cli-query-archive
**Archived**: 2026-05-07
**Type**: Archival/Verification

---

## Implementation Summary

### CLI Commands Verified

| Command | File | API | Status |
|---------|------|-----|--------|
| `scope` | `src/cli/commands/scope.ts` | `getScope()` | ✅ Verified |
| `impact` | `src/cli/commands/impact.ts` | `getImpact()` | ✅ Verified |
| `layers` | `src/cli/commands/layers.ts` | `getArchitectureLayers()` | ✅ Verified |
| `migrate` | `src/cli/commands/migrate.ts` | `migrate1_0To1_1()` | ✅ Verified |

### CLI Entry Point

- **File**: `bin/codegraph.ts`
- **Framework**: CAC (Command And Command)
- **Commands Registered**: `analyze`, `update`, `migrate`, `scope`, `impact`, `layers`
- **Features**: Each command has `--json` option for structured output

### Brief Command Status

- **CLI Command**: Not implemented (no `brief.ts`)
- **API**: `getQuickBrief()` exists per `quick-brief/spec.md`
- **Decision**: API-only, no CLI command needed

---

## Verification Results

### Phase 1: CLI Commands

| Check | Result |
|-------|--------|
| scope.ts exists | ✅ |
| scope supports pattern query | ✅ |
| scope supports JSON/text output | ✅ |
| impact.ts exists | ✅ |
| impact supports change impact | ✅ |
| impact supports blast radius | ✅ |
| layers.ts exists | ✅ |
| layers supports layer inference | ✅ |
| layers supports violations | ✅ |
| migrate.ts exists | ✅ |
| migrate supports 1.0→1.1 migration | ✅ |
| CAC command registration | ✅ |
| --json option for all commands | ✅ |

### Phase 2: Testing

| Check | Result |
|-------|--------|
| API tests exist | ✅ scope.test.ts, impact.test.ts, layers.test.ts |
| CLI command tests exist | ✅ commands/scope.test.ts, layers.test.ts, impact.test.ts |
| Formatter tests exist | ✅ scope-formatter.test.ts, impact-formatter.test.ts, layers-formatter.test.ts |
| Smoke tests exist | ✅ cli.test.ts |
| All tests passing | ✅ 1006 tests |

---

## Test Coverage Summary

| Category | Files | Coverage |
|----------|-------|----------|
| API Tests | `tests/unit/api/*.test.ts` | scope, impact, layers |
| CLI Command Tests | `tests/unit/cli/commands/*.test.ts` | scope, impact, layers |
| Formatter Tests | `tests/unit/cli/output/*-formatter.test.ts` | scope, impact, layers |
| Smoke Tests | `tests/smoke/cli.test.ts` | scope, impact, layers --help |

---

## Known Limitations

1. **Brief CLI command not implemented**: The `quick-brief/spec.md` defines the API, but no CLI command exists. This is intentional - the API is sufficient for programmatic use.

2. **No stderr/stdout separation**: The CLI outputs errors to stderr, but there's no formal separation documented in specs. This is acceptable for current MVP.

---

## Related Specs

- `cli-api-commands/spec.md` - CLI query commands requirements
- `scope-query/spec.md` - Scope API requirements
- `impact-analysis/spec.md` - Impact API requirements
- `architecture-layers/spec.md` - Layers API requirements
- `quick-brief/spec.md` - QuickBrief API requirements
- `baseline-migration/spec.md` - Migration requirements

---

## References

- **Original Change**: C10 (cg-cli-query-commands)
- **Verification Change**: cg-cli-query-archive
- **Planning Document**: `docs/design-codegraph/develop_changes_plan_for_m1_remain_target.md`

---

**Archive Date**: 2026-05-07
**Test Status**: 1006 tests passing ✅