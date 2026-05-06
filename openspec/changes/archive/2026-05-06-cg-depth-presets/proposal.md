## Why

The `LAYER_THRESHOLD = 2` hardcoded value in `core.ts` has no scientific basis and produces inconsistent Layer inference results across different project sizes. Small projects get too few layers, enterprise projects get too many. This impacts the core `getArchitectureLayers()` API (C8) which is essential for M1 MVP functionality.

## What Changes

- **NEW**: `DEPTH_PRESETS` configuration table with 4 project scale tiers
- **NEW**: `detectProjectScale()` function to count source files and classify project size
- **NEW**: `getThresholdForScale()` function for dynamic threshold selection
- **MODIFIED**: `core.ts` replaces hardcoded `LAYER_THRESHOLD = 2` with dynamic selection
- **BREAKING**: None - threshold calculation is internal, API contract unchanged

## Capabilities

### New Capabilities
- `depth-presets`: Configuration table for adaptive depth thresholds based on project scale

### Modified Capabilities
- `architecture-layers`: Threshold selection becomes dynamic (behavior change - uses project scale)

## Impact

**Affected Code**:
- `packages/codegraph/src/api/layers/inference/core.ts` - Replace hardcoded threshold
- `packages/codegraph/src/api/layers/inference/depth-presets.ts` - New configuration table
- `packages/codegraph/src/api/layers/inference/project-scale-detector.ts` - New scale detection

**Dependencies**: C8 (architecture-layers) - modifies threshold selection within existing API

**API Impact**: No public API changes - threshold calculation is internal implementation

**Config Extension**: Future support for `.codegraph/config.json` override (not MVP scope)