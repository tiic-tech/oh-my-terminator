## 1. Type Definitions

- [ ] 1.1 Create `packages/codegraph/src/api/types.ts` with ScopeResult, QuickBriefResult, ComplexityInfo, ModifiedInfo interfaces
- [ ] 1.2 Add 'unknown' to ComplexityLevel type (A6 resolution)
- [ ] 1.3 Export types from `packages/codegraph/src/api/index.ts`

## 2. Core Scope Query Implementation

- [ ] 2.1 Implement normalizeTarget function with 4 cases (FILE, MODULE, EXTERNAL, PATH) (A1 resolution)
- [ ] 2.2 Implement extractExports function (returns kind:name format, sorted)
- [ ] 2.3 Implement extractImports function (handles IMPORTS, RE_EXPORTS, DYNAMIC_IMPORTS)
- [ ] 2.4 Implement extractImportedBy function (excludes DYNAMIC_IMPORTS per A2 resolution)
- [ ] 2.5 Implement findTestFile function (metadata.testFile + naming convention fallback)
- [ ] 2.6 Implement aggregateComplexity function (returns 'unknown' when no MODULE data per A6 resolution)
- [ ] 2.7 Implement checkDeprecated function
- [ ] 2.8 Implement getScopeForExternal function (A1 resolution)
- [ ] 2.9 Implement formatScopeOutput function (Markdown generation)
- [ ] 2.10 Implement getScope main function with error handling (A5 MODULE warning)

## 3. QuickBrief Implementation

- [ ] 3.1 Implement countImports function (edge count per A4 resolution)
- [ ] 3.2 Implement countImportedBy function (edge count, excludes DYNAMIC_IMPORTS)
- [ ] 3.3 Implement formatQuickBriefOutput function
- [ ] 3.4 Implement getQuickBrief main function

## 4. Module Export

- [ ] 4.1 Create `packages/codegraph/src/api/scope.ts` with all implementations
- [ ] 4.2 Export getScope and getQuickBrief from `packages/codegraph/src/api/index.ts`
- [ ] 4.3 Update `packages/codegraph/src/index.ts` to export API functions

## 5. Unit Tests

- [ ] 5.1 Create test file `packages/codegraph/tests/unit/api/scope.test.ts`
- [ ] 5.2 Add getScope test: FILE node query with exports
- [ ] 5.3 Add getScope test: MODULE node query
- [ ] 5.4 Add getScope test: EXTERNAL node query (A1 verification)
- [ ] 5.5 Add getScope test: Target not found error
- [ ] 5.6 Add getScope test: MODULE not found warning (A5 verification)
- [ ] 5.7 Add getScope test: Isolated file (importedBy empty)
- [ ] 5.8 Add getScope test: Complexity unknown (A6 verification)
- [ ] 5.9 Add getQuickBrief test: Edge count semantics (A4 verification)
- [ ] 5.10 Add getQuickBrief test: File not found
- [ ] 5.11 Add getQuickBrief test: Deprecated flag

## 6. Documentation

- [ ] 6.1 Update README with API usage examples
- [ ] 6.2 Add JSDoc comments to exported functions