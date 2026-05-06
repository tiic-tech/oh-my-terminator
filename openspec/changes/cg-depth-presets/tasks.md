## 1. Configuration Module

- [x] 1.1 Create `packages/codegraph/src/api/layers/inference/depth-presets.ts` with DEPTH_PRESETS table
- [x] 1.2 Define 4 tiers: SMALL(50,5), MEDIUM(200,3), LARGE(500,2), ENTERPRISE(Infinity,1)
- [x] 1.3 Add unit tests for depth-presets configuration

## 2. Scale Detection Module

- [x] 2.1 Create `packages/codegraph/src/api/layers/inference/project-scale-detector.ts`
- [x] 2.2 Implement `detectProjectScale(projectRoot)` - count src/ files (fallback to root)
- [x] 2.3 Implement `getThresholdForScale(fileCount)` - first-match-wins iteration
- [x] 2.4a Import test-file-filter module (excludeTestFiles from ../../analyzer/test-file-filter.js)
- [x] 2.4b Implement recursive glob for src/ files (pattern: **/*.{ts,tsx,js,jsx,vue})
- [x] 2.4c Apply test file exclusion (call excludeTestFiles before counting)
- [x] 2.4d Handle empty src fallback (count root, still exclude tests)
- [x] 2.5 Add unit tests for scale detection functions

## 3. Core Module Update

- [ ] 3.1 Remove hardcoded `LAYER_THRESHOLD = 2` from core.ts
- [ ] 3.2 Import and call `getThresholdForScale(detectProjectScale(projectRoot))`
- [ ] 3.3 Verify getArchitectureLayers uses dynamic threshold
- [ ] 3.4 Add integration tests for threshold selection in layer inference

## 4. Module Exports

- [ ] 4.1 Export depth-presets and scale detector from inference/index.ts
- [ ] 4.2 Ensure backward compatibility (API contract unchanged)

## 5. E2E Validation

- [ ] 5.1 Test small project (create 30-file temp project) - expect threshold=5
- [ ] 5.2 Test medium project (150 files) - expect threshold=3
- [ ] 5.3 Test large project (400 files) - expect threshold=2
- [ ] 5.4 Test enterprise project (800 files) - expect threshold=1
- [ ] 5.5 Verify existing layer inference tests still pass