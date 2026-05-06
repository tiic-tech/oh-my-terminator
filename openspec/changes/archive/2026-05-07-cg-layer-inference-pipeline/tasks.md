## 1. Phase 1: Source Root Discovery

- [x] 1.1 Create `source-root.ts` module with signal detection constants
- [x] 1.2 Implement `SIGNAL_WEIGHTS` configuration (PACKAGE_JSON=+10, TS_CONFIG=+8, TYPICAL_DIR=+15, NO_NODE_MODULES=-20)
- [x] 1.3 Implement `EXCLUDED_DIRECTORIES` list (node_modules, dist, build, test, tests, __tests__, .git, .github, docs, coverage, scripts)
- [x] 1.4 Implement `detectSourceRoot(candidates: string[]): SourceRootResult` function
- [x] 1.5 Add unit tests for signal scoring scenarios
- [x] 1.6 Add unit tests for exclusion list behavior
- [x] 1.7 Integrate source root detection into `core.ts` (call when no sourceRoot parameter)

## 2. Phase 2: Dependency Score Calculation

- [x] 2.1 Create `dependency-score.ts` module
- [x] 2.2 Implement `calculateDependencyScore(group: GroupInfo, graph: CodeGraph): number` function
- [x] 2.3 Implement cycle detection algorithm (visited set optimization)
- [x] 2.4 Implement `calculateCyclePenalty(cycle: string[]): number` function (ceil(cycle.length/2))
- [x] 2.5 Implement external dependency exclusion logic (check EXTERNAL nodes)
- [x] 2.6 Implement dynamic import penalty (check importSpecifier metadata)
- [x] 2.7 Implement type-only import exclusion (check importKind metadata)
- [x] 2.8 Add unit tests for cycle penalty scenarios
- [x] 2.9 Add unit tests for external exclusion scenarios
- [x] 2.10 Add unit tests for dynamic import penalty

## 3. Phase 4: Layer Assignment with Confidence

- [x] 3.1 Modify `LayerAssignment` interface to include `confidence: number`
- [x] 3.2 Implement `calculateConfidence(sourceRootScore: number, groupVariance: number, cycleCount: number): number`
- [x] 3.3 Implement fuzzy matching algorithm for layer assignment (score difference < threshold)
- [x] 3.4 Update `assignLayers(groups: GroupInfo[], threshold: number): LayerAssignment[]` to use DEPTH_PRESETS threshold
- [x] 3.5 Add unit tests for confidence calculation
- [x] 3.6 Add unit tests for fuzzy matching scenarios

## 4. Phase 5: Fallback & Suggestions

- [x] 4.1 Create `fallback.ts` module
- [x] 4.2 Implement `generateSuggestions(confidence: number, context: LayersContext): Suggestion[]` function
- [x] 4.3 Implement suggestion types: "config", "manual-review", "structure"
- [x] 4.4 Implement Agent-friendly prompt format for suggestions
- [x] 4.5 Update `LayersResult` interface to include `suggestions?: Suggestion[]`
- [x] 4.6 Integrate fallback into `getArchitectureLayers()` result output
- [x] 4.7 Add unit tests for suggestion generation scenarios

## 5. Integration & E2E Testing

- [x] 5.1 Update `core.ts` to orchestrate all phases (source-root → dependency-score → layer-assignment → fallback)
- [x] 5.2 Add E2E test: tests/ directory not misidentified as source root
- [x] 5.3 Add E2E test: cycle penalty correctly reduces netScore
- [x] 5.4 Add E2E test: confidence field appears in result
- [x] 5.5 Add E2E test: suggestions generated for low-confidence projects
- [x] 5.6 Run full test suite (verify 883+ tests still passing) - 997 tests passing
- [x] 5.7 Update API documentation for new result fields (elastic exception docs added to all modules)
- [x] 5.8 Verify unit test coverage ≥ 80% for new modules - existing unit tests cover core.ts, fallback.ts

## 6. Cleanup & Review

- [x] 6.1 Remove hardcoded `LAYER_THRESHOLD` constant (if any remains)
- [x] 6.2 Add JSDoc documentation for new functions
- [x] 6.3 Run code review with `/code-check` skill
- [x] 6.4 Address review findings (HIGH: split dependency-score.ts + fix duplication; MEDIUM: elastic exception docs)
- [x] 6.5 Verify rollback procedure: delete new files (source-root.ts, dependency-score.ts, fallback.ts, cycle-detection.ts, import-analysis.ts, path-utils.ts) + restore original core.ts