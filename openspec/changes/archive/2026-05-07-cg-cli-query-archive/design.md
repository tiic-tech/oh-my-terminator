## Design Overview

This is an archival change with no implementation work. The design focuses on verification process and documentation structure.

## Verification Process

### Step 1: CLI Commands Verification

Verify each CLI command exists and matches spec requirements:

| Command | File | Spec Reference | Expected Features |
|---------|------|----------------|-------------------|
| `scope` | `scope.ts` | `cli-api-commands/spec.md` | Pattern query, JSON/text output |
| `impact` | `impact.ts` | `cli-api-commands/spec.md` | Change impact, blast radius |
| `layers` | `layers.ts` | `cli-api-commands/spec.md` | Layer inference, violations |
| `migrate` | `migrate.ts` | `baseline-migration/spec.md` | Schema migration |

### Step 2: Command Registration Verification

Check `src/cli/index.ts` confirms commands are registered with CAC:
- `scope` command registered
- `impact` command registered  
- `layers` command registered
- `migrate` command registered
- Each has `--json` option

### Step 3: Brief Command Status

Verify quick-brief spec requirements:
- Spec defines API (`getQuickBrief`)
- No `brief.ts` CLI command found
- Decision: API-only, no CLI command needed

### Step 4: E2E Test Status

Run tests to verify CLI commands functional:
```bash
npm test --grep "CLI"
```

## Archive Documentation Structure

Archive document should contain:
1. **Implementation Summary**: What was built
2. **Verification Results**: Checklist of verified features
3. **Known Limitations**: Any gaps or partial implementations
4. **Test Coverage**: Relevant test counts
5. **References**: Links to related specs

## No Implementation Work

This change requires:
- No new code files
- No code modifications
- No new tests (existing tests verify functionality)
- Only documentation creation

## Dependencies

**Prerequisites**: None (verification-only change)

**Parallel Work**: Can run in parallel with:
- cg-layer-inference-pipeline archival
- cg-mvp-test-coverage improvements
- cg-mvp-documentation updates

## Estimated Duration

1 hour for:
- CLI command verification (30 min)
- Archive documentation (30 min)

## Verification Success Criteria Checklist

Before marking archival complete, verify:

### CLI Commands Registration
- [ ] Global `--help` shows all commands: analyze, update, migrate, scope, impact, layers
- [ ] `scope --help` shows --json option and usage
- [ ] `impact --help` shows --json option and usage
- [ ] `layers --help` shows --json option and usage
- [ ] `migrate --help` shows --input, --output options

### Test Coverage
- [ ] All smoke tests pass (including scope/impact/layers)
- [ ] API tests exist for scope, impact, layers APIs
- [ ] Formatter tests exist for scope, impact, layers output

### Documentation
- [ ] Archive document created with implementation summary
- [ ] Verification results documented
- [ ] Brief status documented as API-only