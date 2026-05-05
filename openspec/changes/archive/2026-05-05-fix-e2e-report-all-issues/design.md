## Context

E2E testing revealed three issues affecting codegraph CLI usability:

1. **P0 Format Validation Bug**: `loadBaseline()` uses `validateBaselineStructure()` which expects 1.0 format (`graph.nodes`, `graph.edges`). But `saveBaseline()` with compression saves 1.1 format (`pathTable`, `nodes`, `edges`) directly. Format mismatch causes validation failure.

2. **P1 Missing CLI Commands**: API functions `getScope()`, `getImpact()`, `getArchitectureLayers()` exist in `src/api/` but are not registered in CLI.

3. **P2 Help Text Issues**: CAC framework shows contradictory default annotations for boolean flags.

**Current State**:
- `detectBaselineFormat()` exists in `packages/codegraph/src/persistence/migrations/1.0-to-1.1.ts` - can be reused
- API functions are fully implemented with tests
- CLI uses CAC framework for command registration (CAC is a CLI framework; use `cli.command('name', 'description').option('--flag', 'desc').action(handler)` pattern)

## Goals / Non-Goals

**Goals:**
- Fix P0: Update can load compressed (1.1) baselines
- Fix P1: Agent can discover scope/impact/layers via `--help`
- Fix P2: Help text is accurate and useful
- Maintain backward compatibility with 1.0 baselines
- Minimal changes to existing code structure

**Non-Goals:**
- Not redesigning compression format
- Not adding new API capabilities
- Not changing JSON output structure

## Decisions

### D1: Format-Aware Validation

**Decision**: Use `detectBaselineFormat()` before validation, dispatch to format-specific validator.

**Rationale**: `detectBaselineFormat()` already exists and correctly identifies 1.0/1.1/legacy. Reusing it avoids duplication.

**Alternatives Considered**:
- A: Single unified validator - rejected: complex conditional logic, hard to maintain
- B: Add `graph` wrapper to 1.1 format - rejected: breaks compression design, increases size

### D2: CLI Command Registration Pattern

**Decision**: Follow existing `analyze/update/migrate` pattern: thin wrapper calling API function, formatter for output.

**Rationale**: Consistent with existing CLI architecture, minimal code duplication.

**Implementation**:
```
scope: command.ts → getScope() → formatScopeJson/Text
impact: command.ts → getImpact() → formatImpactJson/Text  
layers: command.ts → getArchitectureLayers() → formatLayersJson/Text
```

### D3: Help Text Fix Approach

**Decision**: Remove "default: true" annotation, use descriptive text only.

**Rationale**: CAC framework limitation - cannot suppress contradictory default display for negation flags.

**Fix**: `option('--compress', 'Enable compression (default behavior)')` - no default annotation

## Risks / Trade-offs

**Risk**: Validation change may miss edge cases in 1.1 format
→ **Mitigation**: Add comprehensive tests for both formats before/after change

**Risk**: New CLI commands may have different error handling needs
→ **Mitigation**: Follow existing error patterns (CliErrorCode, CliError interface). See `src/types.ts` for CliErrorCode enum and CliError interface

**Trade-off**: Adding commands increases CLI binary size
→ **Acceptable**: Commands are thin wrappers, minimal overhead