## 1. Baseline Validation Fix (P0)

- [x] 1.1 Import `detectBaselineFormat` in `validation.ts`
- [x] 1.2 Create `validateCompressedBaselineStructure()` function for 1.1 format
- [x] 1.3 Update `validateBaselineStructure()` to dispatch based on detected format
- [x] 1.4 Add unit tests for 1.1 format validation (valid baseline) (file: tests/unit/persistence/baseline/validation.test.ts)
- [x] 1.5 Add unit tests for 1.1 format validation (missing fields) (file: tests/unit/persistence/baseline/validation.test.ts)
- [x] 1.6 Add unit tests for format detection dispatch logic (file: tests/unit/persistence/baseline/validation.test.ts)
- [x] 1.7 Run full test suite to verify no regressions

## 2. CLI Scope Command (P1)

- [x] 2.1 Create `src/cli/commands/scope.ts` file
- [x] 2.2 Implement `scopeCommand(query, options)` wrapper for `getScope()`
- [x] 2.3 Create `src/cli/output/scope-formatter.ts` for JSON/text output
- [x] 2.4 Implement `formatScopeJson()` and `formatScopeText()` functions
- [x] 2.5 Register `scope` command in `bin/codegraph.ts` with CAC
- [x] 2.6 Add scope command to global help output
- [x] 2.7 Write unit tests for scope command (file: tests/unit/cli/commands/scope.test.ts)
- [x] 2.8 Write unit tests for scope formatters (file: tests/unit/cli/output/scope-formatter.test.ts)

## 3. CLI Impact Command (P1)

- [x] 3.1 Create `src/cli/commands/impact.ts` file
- [x] 3.2 Implement `impactCommand(target, options)` wrapper for `getImpact()`
- [x] 3.3 Create `src/cli/output/impact-formatter.ts` for JSON/text output
- [x] 3.4 Implement `formatImpactJson()` and `formatImpactText()` functions
- [x] 3.5 Register `impact` command in `bin/codegraph.ts` with CAC
- [x] 3.6 Add impact command to global help output
- [x] 3.7 Write unit tests for impact command (file: tests/unit/cli/commands/impact.test.ts)
- [x] 3.8 Write unit tests for impact formatters (file: tests/unit/cli/output/impact-formatter.test.ts)

## 4. CLI Layers Command (P1)

- [x] 4.1 Create `src/cli/commands/layers.ts` file
- [x] 4.2 Implement `layersCommand(options)` wrapper for `getArchitectureLayers()`
- [x] 4.3 Create `src/cli/output/layers-formatter.ts` for JSON/text output
- [x] 4.4 Implement `formatLayersJson()` and `formatLayersText()` functions
- [x] 4.5 Register `layers` command in `bin/codegraph.ts` with CAC
- [x] 4.6 Add layers command to global help output
- [x] 4.7 Write unit tests for layers command (file: tests/unit/cli/commands/layers.test.ts)
- [x] 4.8 Write unit tests for layers formatters (file: tests/unit/cli/output/layers-formatter.test.ts)

## 5. Help Text Improvements (P2)

- [x] 5.1 Update analyze `--compress` option description (remove default annotation)
- [x] 5.2 Update analyze `--no-compression` option description
- [x] 5.3 Update update `--compress` option description (remove default annotation)
- [x] 5.4 Update update `--no-compression` option description
- [x] 5.5 Add examples section to analyze command help
- [x] 5.6 Add examples section to update command help
- [x] 5.7 Add examples section to scope command help
- [x] 5.8 Add examples section to impact command help
- [x] 5.9 Add examples section to layers command help

## 6. Integration Tests

- [ ] 6.1 Write integration test: update with compressed baseline (P0 fix verification) (file: tests/integration/cli-commands.test.ts)
- [ ] 6.2 Write integration test: scope command full flow (file: tests/integration/cli-commands.test.ts)
- [ ] 6.3 Write integration test: impact command full flow (file: tests/integration/cli-commands.test.ts)
- [ ] 6.4 Write integration test: layers command full flow (file: tests/integration/cli-commands.test.ts)
- [ ] 6.5 Write integration test: help shows all commands (file: tests/integration/cli-commands.test.ts)
- [ ] 6.6 Run full test suite: `pnpm test`

## 7. Verification & Finalization

- [ ] 7.1 Run E2E test scenario from original report (update should work now)
- [ ] 7.2 Verify help output shows all 6 commands
- [ ] 7.3 Verify compression flags show correct descriptions
- [ ] 7.4 Run TypeScript type check: `pnpm build`
- [ ] 7.5 Verify 80%+ test coverage