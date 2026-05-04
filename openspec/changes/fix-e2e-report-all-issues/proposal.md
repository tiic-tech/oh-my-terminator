## Why

E2E testing revealed critical bugs blocking codegraph functionality:

1. **P0 BLOCKER**: `update` command cannot load compressed baseline (1.1 format) because validation expects 1.0 format structure. This completely breaks incremental updates.

2. **P1**: CLI help does not expose `scope`, `impact`, `layers` API commands, preventing Agent discovery of core capabilities.

3. **P2**: Help text has contradictory parameter descriptions and lacks usage examples.

These issues prevent effective Agent-driven development workflows with codegraph.

## What Changes

- Fix `validateBaselineStructure()` to support both 1.0 and 1.1 baseline formats
- Add `validateCompressedBaselineStructure()` for 1.1 format validation
- Register `scope`, `impact`, `layers` commands in CLI entry point
- Fix `--compress/--no-compression` help text contradictions
- Add usage examples to CLI command help

## Capabilities

### New Capabilities

- `cli-api-commands`: CLI commands for scope query, impact analysis, and architecture layers inspection

### Modified Capabilities

- `baseline-persistence`: Extend validation requirements to support compressed (1.1) format structure
- `cli-analyze`: Help text improvements with correct parameter descriptions and examples
- `cli-update`: Help text improvements with correct parameter descriptions and examples

## Impact

**Affected Code**:
- `packages/codegraph/src/persistence/baseline/validation.ts` - Format-aware validation
- `packages/codegraph/bin/codegraph.ts` - CLI command registration
- `packages/codegraph/src/cli/commands/` - New command implementations for scope/impact/layers

**API Changes**:
- New CLI commands: `codegraph scope`, `codegraph impact`, `codegraph layers`
- Validation API: `validateCompressedBaselineStructure()` added

**Dependencies**:
- Existing API functions (`getScope`, `getImpact`, `getArchitectureLayers`) are already implemented, need CLI wrappers
- Located in `src/api/scope/index.ts`, `src/api/impact/index.ts`, `src/api/layers/index.ts`