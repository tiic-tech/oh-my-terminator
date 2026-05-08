## Why

The current layer inference implementation uses hardcoded `LAYER_THRESHOLD=2` and lacks intelligent source root detection, causing `tests/` directory to be misidentified as source code root. This results in poor layer inference quality, directly impacting `getArchitectureLayers` API accuracy - a core M1 MVP capability.

With `cg-depth-presets` (Phase 3) already implemented, Phases 1/2/4/5 of the Hybrid Inference Pipeline remain unimplemented. Completing this pipeline is the final P1 task for M1.

## What Changes

- **Phase 1: Source Root Discovery** - Signal detection system with weighted scoring (PACKAGE_JSON=+10, TS_CONFIG=+8, TYPICAL_DIR=+15) and exclusion list (node_modules, dist, test, tests, __tests__, etc.)
- **Phase 2: Dependency Score Calculation** - Cycle detection with penalty mechanism, external dependency exclusion, dynamic import penalty
- **Phase 4: Layer Assignment** - Dynamic threshold based on DEPTH_PRESETS, fuzzy matching algorithm, confidence tracking per layer
- **Phase 5: Fallback & Suggestions** - Agent-friendly prompt generation, pre-filter integration, default fallback logic when inference fails

## Capabilities

### New Capabilities

- `layer-source-root`: Source root discovery with signal detection and exclusion system
- `layer-dependency-score`: Dependency score calculation with cycle penalty and dynamic import handling

### Modified Capabilities

- `architecture-layers`: REQUIREMENTS changing - layer assignment will use dynamic threshold (DEPTH_PRESETS), confidence tracking, and improved source root detection instead of hardcoded threshold

## Impact

- **Core Files**: `packages/codegraph/src/api/layers/inference/core.ts` (layer assignment logic)
- **New Files**: `source-root.ts`, `dependency-score.ts`, `layer-assignment.ts`, `fallback.ts` in inference directory
- **Dependencies**: Requires `cg-depth-presets` (already completed) for DEPTH_PRESETS configuration
- **API Impact**: `getArchitectureLayers()` output gains confidence field, better source root detection
- **Test Impact**: E2E tests should verify tests/ directory no longer misidentified as source root