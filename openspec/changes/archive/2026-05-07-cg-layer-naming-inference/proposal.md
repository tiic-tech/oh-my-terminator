## Why

E2E Round 2 testing revealed that high-level architecture layers (Layer 5/6/7) display generic names like "Layer 5", "Layer 6", "Layer 7" instead of meaningful semantic names. This reduces the value of architecture visualization and makes it harder for developers to understand their project structure. The current `role` field in LayerAssignment only supports 4 base roles (Foundation, Core, Application, Presentation), leaving higher layers with placeholder names.

## What Changes

- Introduce semantic naming inference for Layer 5/6/7 based on directory structure patterns
- Add a naming rules table mapping common directory names to layer roles (api→API Layer, persistence→Data Layer, cli→CLI Layer, etc.)
- Extend LayerAssignment structure with inferred role name fallback for layers beyond 4
- Integrate naming inference into the existing layer inference pipeline
- Support custom naming rules via configuration extension

## Capabilities

### New Capabilities

- `layer-naming`: Directory-based layer role name inference for high-level layers (5/6/7+)

### Modified Capabilities

- `architecture-layers`: REQUIREMENTS change to extend LayerAssignment.role field with semantic naming for layers beyond the 4 base roles

## Impact

**Affected Code**:
- `packages/codegraph/src/api/layers/inference/core.ts` - integration point
- `packages/codegraph/src/api/layers/inference/layer-assignment.ts` - role assignment extension
- CLI `layers` command output - will display meaningful names instead of "Layer 5/6/7"

**API Changes**:
- LayerAssignment.role field: currently limited to 4 predefined roles, will support dynamic inferred names

**Dependencies**:
- Depends on existing layer inference pipeline (C8/P1 work)
- Depends on DEPTH_PRESETS for dynamic threshold (cg-depth-presets)

**Configuration Extension**:
- `.codegraph/config.json` will support custom naming rules