## Why

C10 (cg-cli-query-commands) was implemented in earlier development phases but never formally archived. The CLI commands `scope`, `impact`, `layers` are operational and tested, but missing archive documentation creates traceability gaps. This change verifies implementation completeness, documents the final state, and moves artifacts to archive.

## What Changes

- Verify `scope`, `impact`, `layers` CLI commands implementation status against cli-api-commands spec
- Verify `migrate` command implementation status
- Confirm `brief` CLI command status (spec exists for API, but no CLI command found)
- Create archive documentation summarizing C10 final state
- Move C10 artifacts to `openspec/changes/archive/2026-05-07-cg-cli-query-archive/`

## Capabilities

### New Capabilities

None - this is an archival change, no new functionality introduced.

### Modified Capabilities

None - no requirement changes. This change documents existing state without modifying specs.

## Impact

**Affected Files**:
- `src/cli/commands/scope.ts` - verify implementation
- `src/cli/commands/impact.ts` - verify implementation  
- `src/cli/commands/layers.ts` - verify implementation
- `src/cli/commands/migrate.ts` - verify implementation
- `bin/codegraph.ts` - verify command registration (CAC entry point)

**Affected Specs**:
- `cli-api-commands/spec.md` - reference for verification
- `scope-query/spec.md` - reference for scope command
- `impact-analysis/spec.md` - reference for impact command
- `architecture-layers/spec.md` - reference for layers command
- `quick-brief/spec.md` - reference for brief API (not CLI)

**Dependencies**:
- No code changes required
- Archive documentation creation only