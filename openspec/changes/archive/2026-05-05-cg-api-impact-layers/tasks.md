## 1. Setup & Types

- [x] 1.1 Add ImpactResult, LayersResult, LayerAssignment, LayerViolation types to `packages/codegraph/src/api/types.ts`
- [x] 1.2 Add AffectedFile interface with via array format (C8-4)
- [x] 1.3 Create `packages/codegraph/src/api/impact/` directory structure
- [x] 1.4 Create `packages/codegraph/src/api/layers/` directory structure

## 2. Impact Analysis Implementation

- [x] 2.1 Create `packages/codegraph/src/api/impact/index.ts` with main getImpact function
- [x] 2.2 Implement `normalizeTargetsToFile` to convert MODULE targets to FILE nodes
- [x] 2.3 Implement `bfsDependents` with BFS traversal on IMPORTS/RE_EXPORTS edges
- [x] 2.4 Add test file filtering logic (C8-1) with `isTestFile` helper
- [x] 2.5 Add DYNAMIC_IMPORTS exclusion logic (C8-6)
- [x] 2.6 Implement depth-limited traversal with maxDepth option (C8-2)
- [x] 2.7 Implement `formatImpactOutput` for text output generation
- [x] 2.8 Add via path tracking with array format (C8-4)
- [x] 2.9 Implement blast radius classification (low/medium/high)
- [x] 2.10 Add multi-target merge with minimum distance logic (C8-12)

## 3. Architecture Layers Implementation

- [x] 3.1 Create `packages/codegraph/src/api/layers/index.ts` with main getArchitectureLayers function
- [x] 3.2 Implement `groupFilesByFirstLevelDirectory` with __root__ handling
- [x] 3.3 Implement `computeImportDirectionStats` for group import statistics
- [x] 3.4 Implement `getGroupNameFromFile` helper for file-to-group mapping
- [x] 3.5 Implement `inferArchitectureLayers` with netScore calculation
- [x] 3.6 Add LAYER_THRESHOLD grouping logic (threshold=2)
- [x] 3.7 Implement `detectLayerViolations` with layerGap calculation
- [x] 3.8 Add same-layer mutual import handling (C8-11) - warning, not violation
- [x] 3.9 Implement `calculateLayerHealthScore` with severity weights (C8-5)
- [x] 3.10 Implement `formatLayersOutput` for text output generation
- [x] 3.11 Add severity assignment helper (minor/moderate/critical)
- [x] 3.12 Add external dependency exclusion logic

## 4. Exports & Integration

- [x] 4.1 Export getImpact from `packages/codegraph/src/api/index.ts`
- [x] 4.2 Export getArchitectureLayers from `packages/codegraph/src/api/index.ts`
- [x] 4.3 Export all new types from `packages/codegraph/src/api/index.ts`
- [x] 4.4 Add public exports to `packages/codegraph/src/index.ts`
- [x] 4.5 Verify exports align with C7 patterns

## 5. Unit Tests

- [x] 5.1 Create `tests/unit/api/impact.test.ts` following C7 test patterns
- [x] 5.2 Test: single target with direct dependents
- [x] 5.3 Test: single target with indirect dependents (BFS traversal)
- [x] 5.4 Test: multi-target merge with minimum distance
- [x] 5.5 Test: test file exclusion (default and includeTests option)
- [x] 5.6 Test: maxDepth=0 returns direct only
- [x] 5.7 Test: DYNAMIC_IMPORTS excluded from traversal
- [x] 5.8 Test: MODULE target resolution to FILE
- [x] 5.9 Test: isolated file returns empty result
- [x] 5.10 Test: target not found returns E001 error
- [x] 5.11 Create `tests/unit/api/layers.test.ts` following C7 test patterns
- [x] 5.12 Test: first-level directory grouping
- [x] 5.13 Test: __root__ group for root files
- [x] 5.14 Test: layer inference by netScore
- [x] 5.15 Test: adjacent score merging (threshold=2)
- [x] 5.16 Test: layer violation detection (low-to-high)
- [x] 5.17 Test: no violation for high-to-low import
- [x] 5.18 Test: same-layer mutual imports not violation
- [x] 5.19 Test: healthScore calculation with severity weights
- [x] 5.20 Test: empty graph returns E005 error
- [x] 5.21 Test: custom sourceRoot parameter
- [x] 5.22 Test: external dependency exclusion

## 6. Documentation

- [x] 6.1 Update `packages/codegraph/README.md` with impact-analysis capability
- [x] 6.2 Update `packages/codegraph/README.md` with architecture-layers capability
- [x] 6.3 Add API usage examples for getImpact
- [x] 6.4 Add API usage examples for getArchitectureLayers
- [x] 6.5 Document CLI JSON format reference for C10 integration

## 7. Verification

- [x] 7.1 Run all unit tests with `pnpm test`
- [x] 7.2 Verify test coverage ≥ 80%
- [x] 7.3 Run TypeScript type check with `pnpm build`
- [x] 7.4 Verify no breaking changes to existing C7 APIs