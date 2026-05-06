## 1. Parser Type Extension

- [x] 1.1 Add `ImportKind` type to `packages/codegraph/src/parser/ts-parser/types.ts`
- [x] 1.2 Add `importKind` field to `ParsedImportInfo` interface
- [x] 1.3 Add unit tests for ImportKind type definition

## 2. Import Extractor Modification
Target: `packages/codegraph/tests/unit/parser/ts-parser/import-extractor.test.ts`

- [x] 2.1 Detect `importClause.isTypeOnly` in `import-extractor.ts`
- [x] 2.2 Set `importKind` based on `isTypeOnly` value
- [x] 2.3 Handle side-effect imports (default to 'value')
- [x] 2.4 Add unit tests for type-only import detection
- [x] 2.5 Add unit tests for regular import detection
- [x] 2.6 Add unit tests for mixed imports (type + value)

## 3. Edge Metadata Update

- [x] 3.1 Update `edge-generator.ts` to include `importKind` in IMPORTS edge metadata
- [x] 3.2 Update `edge-generator.ts` to include `importKind` in RE_EXPORTS edge metadata
  > Note: Regular re-exports (export { X } from './types') only. `export type { X } from './types'` syntax not in MVP scope - those edges default to importKind='value'.
- [x] 3.3 Add unit tests for edge metadata with importKind

## 4. Scope Query Display

- [x] 4.1 Update scope command to display import kind in output
- [x] 4.2 Add `kind` field to import list in ScopeResult
- [x] 4.3 Add unit tests for scope query with type imports
- [x] 4.4 Update scope Markdown output to show type/value distinction

## 5. Integration Tests
Target: `packages/codegraph/tests/e2e/import-type.test.ts`

- [ ] 5.1 Test file with `import type { X } from './types'`
- [ ] 5.2 Test file with `import { X } from './types'`
- [ ] 5.3 Test file with both type and value imports
- [ ] 5.4 Verify IMPORTS edge has correct importKind
  > Verification: `expect(edge.metadata.importKind).toBe('type-only')` for import type statements
- [ ] 5.5 Verify scope query displays import kind correctly
  > Verification: Output contains `[type-only]` marker for type imports