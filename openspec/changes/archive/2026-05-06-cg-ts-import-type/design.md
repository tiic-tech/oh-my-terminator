## Context

TypeScript 3.8+ introduced `import type` syntax to explicitly import types without runtime dependencies:
```typescript
import type { User } from './types';  // Type-only, erased at compile time
import { User } from './types';       // Value import, creates runtime dependency
```

The TypeScript Compiler API provides `ImportClause.isTypeOnly` to distinguish these. Current parser (C3) treats all imports equally, causing:
- Dependency score inflation (type imports counted as importsFrom)
- Layer inference inaccuracies (groups penalized for type-only dependencies)
- Scope analysis misses type/value distinction

**Stakeholders**: Layer inference (C8), scope query (scope-query), dependency score calculation

## Goals / Non-Goals

**Goals:**
- Detect `import type` statements using `ImportClause.isTypeOnly`
- Add `importKind` metadata to IMPORTS edges
- Exclude type-only imports from dependency score calculation
- Display type import info in scope command

**Non-Goals:**
- Modify re-export handling (`export type` syntax not MVP scope)
- Change dynamic import handling (no type-only concept for dynamic)
- New CLI flags for import type filtering

## Decisions

### Decision 1: Import Kind Metadata Field

**Chosen**: Add `importKind: 'type-only' | 'value'` to ParsedImportInfo

```typescript
interface ParsedImportInfo {
  // ... existing fields
  importKind: 'type-only' | 'value';  // NEW
}
```

**Alternatives**:
- Boolean `isTypeOnly: boolean` - Less explicit, harder to extend
- Extend `importType` enum - Confuses import kind with import mechanism (named/default)

**Rationale**: Clear semantic distinction. `importKind` indicates what's imported (type or value), `importSpecifier` indicates how (named, default, namespace).

### Decision 2: Detection Implementation

**Chosen**: Check `importClause.isTypeOnly` in `ts.isImportDeclaration` handling

```typescript
if (ts.isImportDeclaration(node)) {
  const isTypeOnly = node.importClause?.isTypeOnly ?? false;
  imports.push({
    ...
    importKind: isTypeOnly ? 'type-only' : 'value',
  });
}
```

**Alternatives**:
- Parse syntax text (`/^import type/`) - Less robust, misses edge cases
- Check each import specifier individually - Overkill for MVP

**Rationale**: TypeScript Compiler API provides this directly. Single check covers entire import clause.

### Decision 3: Dependency Score Exclusion

**Chosen**: Filter type-only imports in dependency score calculation

```typescript
// In dependency-score.ts (future cg-layer-inference-pipeline)
const valueImports = imports.filter(i => i.importKind !== 'type-only');
const importsFromCount = valueImports.length;
```

**Alternatives**:
- Separate edge type `TYPE_IMPORTS` - More complex, requires graph schema change
- Keep counting but weight differently - Less clear semantics

**Rationale**: Type imports don't create runtime dependencies. Exclusion matches TypeScript semantics.

### Decision 4: Scope Display

**Chosen**: Add type import column/indicator in scope output

```typescript
// scope.ts output format
{
  imports: [
    { from: './types', kind: 'type-only', specifiers: ['User'] },
    { from: './utils', kind: 'value', specifiers: ['format'] },
  ]
}
```

**Alternatives**:
- Separate section for type imports - More verbose
- No display change - Less useful to users

**Rationale**: Users benefit from seeing what's a type import vs value import.

### Decision 5: ImportInfo Type and Extract Function Update

**Chosen**: Create new function `extractImportsWithKind()` returning `ImportInfo[]`

**Alternatives**:
- Modify existing extractImports() - Breaking change for existing callers
- Add separate metadata map - More complex, two data sources

**Rationale**: New function avoids breaking changes. Existing callers continue using extractImports() for paths-only, new callers use extractImportsWithKind() for full metadata.

**Implementation**:
```typescript
// New function in extract.ts
export function extractImportsWithKind(graph: CodeGraph, fileNode: GraphNode): ImportInfo[] {
  // Returns ImportInfo objects with kind field
}

// Existing function preserved
export function extractImports(graph: CodeGraph, fileNode: GraphNode): string[] {
  // Returns paths only (unchanged)
}
```

### Decision 6: Scope Markdown Output Format

**Chosen**: `[type-only]` suffix on import lines

**Format**:
```markdown
## Imports
- `./utils` [value]
- `./types` [type-only]
- `lodash` (external)
```

**Alternatives**:
- Separate section for type imports - More verbose
- JSON-style inline - Less readable

**Rationale**: Minimal change to existing format. `[type-only]` suffix clearly indicates import kind.

### Decision 7: ImportKind Detection Location

**Chosen**: Add to import-extractor.ts, not utils.ts

**Implementation**:
```typescript
// In import-extractor.ts, during import extraction
const isTypeOnly = node.importClause?.isTypeOnly ?? false;
imports.push({
  // ... existing fields
  importKind: isTypeOnly ? 'type-only' : 'value',
});
```

**Alternatives**:
- Add to getImportSpecifierType() in utils.ts - Function already complex
- Create new getImportKind() function - Redundant, detection happens during extraction

**Rationale**: Detection naturally happens during import extraction. Adding to import-extractor.ts keeps logic together.

## Risks / Trade-offs

**Risk**: Mixed imports (`import { User, formatUser } from './types'` where User is type-only)
→ **Mitigation**: TypeScript handles this - if `import type`, entire clause is type-only. Mixed imports require separate statements.

**Risk**: Re-exports with type (`export type { User } from './types'`)
→ **Mitigation**: MVP scope excludes re-export handling. Document in non-goals.

**Trade-off**: No backward compatibility concern - new field is additive.