## Context

Current `core.ts` has hardcoded `LAYER_THRESHOLD = 2` which was chosen arbitrarily during initial implementation. Different project sizes need different thresholds:
- Small projects (<50 files): Too aggressive threshold creates few coarse layers
- Enterprise projects (>500 files): Too lenient threshold creates many fine layers
- Layer inference quality directly impacts `getArchitectureLayers()` API quality

**Current State**:
```typescript
// packages/codegraph/src/api/layers/inference/core.ts
const LAYER_THRESHOLD = 2;  // No scientific basis
```

**Stakeholders**: Users analyzing projects of varying sizes, CLI consumers of `layers` command

## Goals / Non-Goals

**Goals:**
- Replace hardcoded threshold with adaptive configuration
- Define clear project scale tiers (SMALL, MEDIUM, LARGE, ENTERPRISE)
- Dynamic threshold selection based on file count
- Foundation for future config extension (`.codegraph/config.json`)

**Non-Goals:**
- Custom threshold configuration via CLI flags (MVP scope: use defaults)
- User override via `.codegraph/config.json` (future enhancement)
- Real-time threshold adjustment during analysis

## Decisions

### Decision 1: Project Scale Tiers

**Chosen**: 4-tier system (SMALL, MEDIUM, LARGE, ENTERPRISE)

```typescript
const DEPTH_PRESETS = {
  SMALL:     { maxFiles: 50,   threshold: 5 },
  MEDIUM:    { maxFiles: 200,  threshold: 3 },
  LARGE:     { maxFiles: 500,  threshold: 2 },
  ENTERPRISE: { maxFiles: Infinity, threshold: 1 },
};
```

**Alternatives**:
- Linear formula: `threshold = Math.max(1, Math.floor(500 / fileCount))` - too unpredictable
- Continuous scaling: Complex, hard to reason about

**Rationale**: Fixed tiers are predictable and testable. Values based on typical project patterns:
- SMALL: Few dependencies, need 5+ depth to capture structure
- ENTERPRISE: Many dependencies, need tight threshold to avoid layer explosion

### Decision 2: File Count Method

**Chosen**: Count `.ts/.tsx/.js/.jsx/.vue` files in `src/` directory recursively (including all subdirectories)

**Alternatives**:
- All source files in project root: Includes tests, config files - noisy
- Recursive scan of entire repo: Slow, includes irrelevant directories

**Rationale**: `src/` is standard convention for production source. Filtering excludes test files, config files, and build artifacts.

### Decision 3: Threshold Selection Logic

**Chosen**: First-match-wins (iterate presets, return on first match)

```typescript
for (const preset of DEPTH_PRESETS) {
  if (fileCount <= preset.maxFiles) return preset.threshold;
}
```

**Alternatives**:
- Binary search: Overkill for 4 presets
- Switch-case: Harder to extend

**Rationale**: Simple iteration is clear and extensible. Order presets by increasing maxFiles.

## Risks / Trade-offs

**Risk**: Non-standard project structure (no `src/` directory)
→ Mitigation: Fall back to project root file count if `src/` not found

**Risk**: Test files in `src/` inflate count
→ Mitigation: Exclude files matching test patterns (reuse test-file-filter)

**Trade-off**: Fixed tiers may not fit all projects perfectly
→ Acceptance: MVP scope - config override for edge cases comes later