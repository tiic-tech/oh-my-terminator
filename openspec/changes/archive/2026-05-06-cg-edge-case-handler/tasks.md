## 1. Edge Case Detection Module

- [x] 1.1 Create `packages/codegraph/src/analyzer/edge-case-detector.ts` with `detectSpecialCases()` function
- [x] 1.2 Implement source file extension list (default: .ts, .tsx, .js, .jsx, .vue)
- [x] 1.3 Implement test file pattern matching (default patterns: *.test.ts, *.spec.ts, tests/**)
- [x] 1.4 Implement `ProjectKind` enum: 'empty' | 'single-file' | 'test-only' | 'normal'
- [x] 1.5 Add unit tests for edge-case-detector.ts

## 2. Test File Filter Module

- [x] 2.1 Create `packages/codegraph/src/analyzer/test-file-filter.ts` with `excludeTestFiles()` function
- [x] 2.2 Implement filter statistics return (filtered count, kept count, filtered file paths)
- [x] 2.3 Add unit tests for test-file-filter.ts

## 3. Empty Project Handler

- [x] 3.1 Create `packages/codegraph/src/analyzer/empty-project-handler.ts` with `handleEmptyProject()` function
- [x] 3.2 Implement user-friendly error message with suggestions
- [x] 3.3 Add unit tests for empty-project-handler.ts

## 4. Single-File Handler

- [x] 4.1 Create `packages/codegraph/src/analyzer/single-file-handler.ts` with `handleSingleFileProject()` function
- [x] 4.2 Implement simplified analysis output (no layer inference)
- [x] 4.3 Handle single-file with internal imports (reclassify as normal)
- [x] 4.4 Add unit tests for single-file-handler.ts

## 5. CLI Integration

- [x] 5.1 Update `packages/codegraph/src/cli/commands/analyze.ts` to call edge case detection before analysis
- [x] 5.2 Update `packages/codegraph/src/cli/commands/update.ts` to call edge case detection before update
- [x] 5.3 Implement JSON output for edge cases (--json flag handling)
- [x] 5.4 Implement text output for edge cases (user-friendly messages)
- [x] 5.5 Add CLI integration tests for edge cases

## 6. Module Index & Exports

- [x] 6.1 Create `packages/codegraph/src/analyzer/index.ts` exporting all edge case modules
- [x] 6.2 Ensure backward compatibility (no breaking changes to existing analyzer API)

## 7. E2E Validation

- [x] 7.1 Test empty project scenario (create empty temp directory)
- [x] 7.2 Test single-file project scenario (create single-file temp project)
- [x] 7.3 Test test-heavy project scenario (verify pre-filter works)
- [x] 7.4 Test normal project scenario (ensure no regression)