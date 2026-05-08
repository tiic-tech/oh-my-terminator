# C3 (TypeScript Parser - Imports) Ambiguity Resolution Log

**Resolution Date**: 2026-05-03
**Resolver**: Claude Code Agent
**Change ID**: C3 - `cg-ts-parser-imports`
**Assessment Document**: `c3_openspec_readiness_assessment.md`

---

## Executive Summary

Two ambiguities identified in the assessment have been resolved:
- **A2**: Multiple alias paths resolution strategy - RESOLVED
- **A3**: Wildcard re-exports handling - RESOLVED

C3 is now **READY** for OpenSpec creation.

---

## Resolution Details

### A2: Multiple Alias Paths Resolution (RESOLVED)

**Original Question**: When `tsconfig.json` has multiple path aliases matching a module specifier, which takes precedence?

**Example Scenario**:
```json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@utils/*": ["utils/*", "shared/utils/*"],
      "@shared/*": ["shared/*"]
    }
  }
}
```

For `import { helper } from '@utils/format'`:
- Option 1: First match wins (`utils/format.ts` if exists)
- Option 2: All matches generate edges
- Option 3: Follow TypeScript's resolution order exactly

**Resolution Decision**: **Option 3 - Follow TypeScript's resolution order exactly**

**Rationale**:
1. TypeScript's `ts.resolveModuleName()` returns the first valid match
2. This is deterministic and matches actual runtime behavior
3. No need to implement custom resolution logic
4. Simplifies implementation by delegating to TypeScript's API

**Implementation Guidance**:
- Use `ts.resolveModuleName()` directly
- Do not iterate through all path possibilities
- The first returned result is the canonical resolution
- If resolution fails, create `EXTERNAL` node

**Updated In**:
- `01_origin_blueprint.md` section 4.2.2
- `develop_changes_plan.md` section 3.2 (C3 verification criteria)

---

### A3: Wildcard Re-exports Handling (RESOLVED)

**Original Question**: How to handle `export * from './utils'` wildcard exports?

**Example Scenario**:
```typescript
// src/index.ts
export * from './utils';  // What edges are generated?
```

- Option 1: Generate single RE_EXPORTS edge without specifier
- Option 2: Expand to all named exports from target file
- Option 3: Mark as special case in edge metadata

**Resolution Decision**: **Option 3 - Single RE_EXPORTS edge with `importSpecifier: "wildcard"`**

**Rationale**:
1. Prevents graph bloat - wildcard exports can re-export dozens of symbols
2. Maintains semantic accuracy - the statement is a single wildcard export
3. Query flexibility - downstream tools can query target's MODULE nodes for details
4. Consistent with other importSpecifier patterns

**Edge Metadata Schema**:
```typescript
{
  from: "FILE:src/index.ts",
  to: "FILE:src/utils.ts",
  type: EdgeType.RE_EXPORTS,
  metadata: {
    line: 5,
    importSpecifier: "wildcard"
  }
}
```

**Updated In**:
- `01_origin_blueprint.md` section 4.2.2
- `develop_changes_plan.md` section 3.2 (C3 verification criteria)

---

## Complete importSpecifier Metadata Schema

As part of the resolution, a comprehensive `importSpecifier` metadata schema was defined:

| Import Type | importSpecifier Value | Example Code |
|-------------|----------------------|--------------|
| Default import | `"default"` | `import utils from './utils'` |
| Named import (single) | `"named:<symbol>"` | `import { formatDate } from './utils'` |
| Named import (multiple) | `"named:<sym1>,<sym2>"` | `import { a, b } from './utils'` |
| Namespace import | `"namespace"` | `import * as utils from './utils'` |
| Wildcard re-export | `"wildcard"` | `export * from './utils'` |
| Dynamic import | `"dynamic"` | `import('./utils')` |
| Side-effect import | `"empty"` | `import './setup'` |

---

## Documentation Updates Made

| Document | Section | Update Type |
|----------|---------|-------------|
| `01_origin_blueprint.md` | 4.2.2 | Added resolution rules + importSpecifier schema |
| `develop_changes_plan.md` | 3.2 (C3) | Added verification criteria for A2/A3 |
| `c3_ambiguity_resolution.md` | (new) | Resolution log created |

---

## Test Fixture Creation

Created comprehensive test fixture project at:
`packages/codegraph/tests/fixtures/import-test-project/`

**Structure**:
```
import-test-project/
├── tsconfig.json                 # With paths aliases for A2 testing
├── src/
│   ├── index.ts                  # Comprehensive import examples
│   ├── config.ts                 # Default export example
│   ├── setup.ts                  # Side-effect import example
│   ├── re-export.ts              # Wildcard + named re-exports (A3)
│   ├── dynamic-import.ts         # Dynamic import() patterns
│   ├── aliased-import.ts         # Alias path imports (A2)
│   ├── external-refs.ts          # External package imports
│   ├── utils/
│   │   ├── format.ts             # Named + default exports
│   │   └── math.ts               # Named exports
│   ├── shared/
│   │   └── utils/
│   │       └── shared-helper.ts  # Second @utils/* path target
│   └── components/
│       └── Button.tsx            # React component (JSX)
```

**Test Coverage**:
- Basic relative imports (named, default, namespace)
- Re-exports (named and wildcard)
- Dynamic imports (multiple patterns)
- Alias path resolution (A2 scenario with multiple paths)
- External package imports
- Side-effect imports
- JSX components

---

## C3 Readiness Status

| Criterion | Previous Status | Current Status |
|-----------|-----------------|----------------|
| Input/Output Definitions | READY | READY |
| Ambiguous Terms | NEEDS_CLARIFICATION | **READY** |
| Dependencies | READY | READY |
| Testable Specifications | PARTIAL | **READY** |
| Implementation Approach | READY | READY |

**Overall Status**: **READY FOR OPENSPEC CREATION**

---

## Next Steps

1. Create OpenSpec change using `/opsx:new cg-ts-parser-imports`
2. Generate proposal.md with resolved ambiguity decisions
3. Generate design.md with importSpecifier schema
4. Generate specs/ts-parser/spec.md with test scenarios
5. Begin implementation

---

## Appendix: Resolution Timeline

| Time | Action |
|------|--------|
| 09:00 | Assessment report reviewed |
| 09:15 | A2 resolution decision made |
| 09:20 | A3 resolution decision made |
| 09:25 | importSpecifier schema defined |
| 09:30 | Blueprint section 4.2.2 updated |
| 09:35 | develop_changes_plan.md updated |
| 09:40 | Test fixture project created |
| 09:50 | Resolution log documented |

---

**Resolution Complete**
**Document Version**: v1.0
**Created**: 2026-05-03