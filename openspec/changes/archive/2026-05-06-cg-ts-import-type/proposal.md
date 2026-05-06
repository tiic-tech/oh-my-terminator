## Why

TypeScript `import type` statements (e.g., `import type { Foo } from './bar'`) are used to import types only, without runtime dependency. The current parser treats all imports equally, causing type-only imports to incorrectly affect dependency scores in layer inference and scope analysis.

This matters because:
- Type-only imports don't create runtime dependencies - they're erased at compile time
- Layer inference incorrectly penalizes groups with many type imports (higher importsFrom count)
- Scope analysis misses the distinction between implementation and type dependencies

## What Changes

- **NEW**: `ImportClause.isTypeOnly` detection in import-extractor.ts
- **MODIFIED**: IMPORTS edge metadata with `importKind: 'type-only' | 'value'`
- **MODIFIED**: Dependency score calculation to exclude type-only imports
- **MODIFIED**: CLI scope command to display type import information

## Capabilities

### New Capabilities

- `ts-import-type`: Detection and handling of TypeScript `import type` statements

### Modified Capabilities

- `ts-parser-imports`: Extend import extraction with `isTypeOnly` detection
- `scope-query`: Display type import information in scope output

## Impact

**Affected Code**:
- `packages/codegraph/src/parser/ts-parser/import-extractor.ts` - Add isTypeOnly detection
- `packages/codegraph/src/parser/ts-parser/types.ts` - Add ImportKind type
- `packages/codegraph/src/analyzer/dependency-score.ts` - Exclude type-only imports
- `packages/codegraph/src/cli/commands/scope.ts` - Display type imports

**Dependencies**: C3 (ts-parser-imports) - extends import extraction logic

**API Impact**: No breaking changes - new metadata field is additive