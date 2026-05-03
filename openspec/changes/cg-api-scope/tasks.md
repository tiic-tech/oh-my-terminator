## 1. Type Definitions

- [x] 1.1 Create `packages/codegraph/src/api/types.ts` with ScopeResult, QuickBriefResult, ComplexityInfo, ModifiedInfo interfaces
- [x] 1.2 Add 'unknown' to ComplexityLevel type (A6 resolution)
- [x] 1.3 Export types from `packages/codegraph/src/api/index.ts`

## 2. Core Scope Query Implementation

- [x] 2.1 Implement normalizeTarget function with 4 cases (FILE, MODULE, EXTERNAL, PATH) (A1 resolution)
- [x] 2.2 Implement extractExports function (returns kind:name format, sorted)
- [x] 2.3 Implement extractImports function (handles IMPORTS, RE_EXPORTS, DYNAMIC_IMPORTS)
- [x] 2.4 Implement extractImportedBy function (excludes DYNAMIC_IMPORTS per A2 resolution)
- [x] 2.5 Implement findTestFile function (metadata.testFile + naming convention fallback)
- [x] 2.6 Implement aggregateComplexity function (returns 'unknown' when no MODULE data per A6 resolution)
- [x] 2.7 Implement checkDeprecated function
- [x] 2.8 Implement getScopeForExternal function (A1 resolution)
- [x] 2.9 Implement formatScopeOutput function (Markdown generation)
- [x] 2.10 Implement getScope main function with error handling (A5 MODULE warning)

## 3. QuickBrief Implementation

- [x] 3.1 Implement countImports function (edge count per A4 resolution)
- [x] 3.2 Implement countImportedBy function (edge count, excludes DYNAMIC_IMPORTS)
- [x] 3.3 Implement formatQuickBriefOutput function
- [x] 3.4 Implement getQuickBrief main function

## 4. Module Export

- [x] 4.1 Create modular `packages/codegraph/src/api/scope/` directory with split files (following coding-taste decomposition)
- [x] 4.2 Export getScope and getQuickBrief from `packages/codegraph/src/api/index.ts`
- [x] 4.3 Update `packages/codegraph/src/index.ts` to export API functions

## 5. Unit Tests

- [x] 5.1 Create test file `packages/codegraph/tests/unit/api/scope.test.ts`
- [x] 5.2 Add getScope test: FILE node query with exports
- [x] 5.3 Add getScope test: MODULE node query
- [x] 5.4 Add getScope test: EXTERNAL node query (A1 verification)
- [x] 5.5 Add getScope test: Target not found error
- [x] 5.6 Add getScope test: MODULE not found warning (A5 verification)
- [x] 5.7 Add getScope test: Isolated file (importedBy empty)
- [x] 5.8 Add getScope test: Complexity unknown (A6 verification)
- [x] 5.9 Add getQuickBrief test: Edge count semantics (A4 verification)
- [x] 5.10 Add getQuickBrief test: File not found
- [x] 5.11 Add getQuickBrief test: Deprecated flag

## 6. Documentation

- [ ] 6.1 Update README with API usage examples
- [ ] 6.2 Add JSDoc comments to exported functions