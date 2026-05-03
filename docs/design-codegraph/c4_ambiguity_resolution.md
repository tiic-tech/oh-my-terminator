# C4 (TypeScript Parser - MODULE Nodes) Ambiguity Resolution Log

**Resolution Date**: 2026-05-03
**Resolver**: Claude Code Agent
**Change ID**: C4 - `cg-ts-parser-modules`
**Assessment Document**: `c4_openspec_readiness_assessment.md` (to be created)

---

## Executive Summary

Eight ambiguities identified in the assessment have been resolved:
- **A8**: Anonymous export handling - RESOLVED (HIGH)
- **A9**: Renamed export handling - RESOLVED (HIGH)
- **A12**: Default export naming strategy - RESOLVED (HIGH)
- **A4**: Cyclomatic complexity calculation method - RESOLVED (MEDIUM)
- **A5**: LOC counting rules - RESOLVED (MEDIUM)
- **A2**: Component type judgment criteria - RESOLVED (MEDIUM)
- **A10**: Enum classification归属 - RESOLVED (MEDIUM)
- **A11**: Multiple exports handling - RESOLVED (MEDIUM)

C4 is now **READY** for OpenSpec creation.

---

## Resolution Details

### A8: Anonymous Export Handling (RESOLVED - HIGH)

**Original Question**: How to name MODULE nodes for anonymous exports (e.g., `export default function() { }`)?

**Example Scenario**:
```typescript
// src/anonymous.ts
export default function() { return 'anonymous'; }
export default class { constructor() {} }
```

**Options Considered**:
1. Option 1: Use `"anonymous"` as name, ID as `MODULE:file#anonymous` - Simple but ambiguous for multiple anonymous exports
2. Option 2: Use `"default"` as name, ID as `MODULE:file#default` - Matches export syntax, but conflicts with named default exports
3. Option 3: Use `"default"` with numeric suffix for duplicates - `MODULE:file#default`, `MODULE:file#default_1` - Handles multiple cases

**Resolution Decision**: **Option 3 - Use `"default"` with numeric suffix for duplicates**

**Rationale**:
1. `"default"` directly reflects the export keyword used, semantic accuracy
2. Numeric suffix (`_1`, `_2`, ...) only applied when multiple anonymous defaults exist in same file
3. First anonymous default uses `"default"` without suffix, maintaining simplicity for common case
4. Clear disambiguation without arbitrary names like `"anonymous"`

**Implementation Guidance**:
- Parse file, count anonymous default exports
- First: `name = "default"`, `id = "MODULE:filePath#default"`
- Second+: `name = "default"`, `id = "MODULE:filePath#default_N"` (N = 1, 2, ...)
- Record in metadata: `{ exportType: "default", anonymous: true, anonymousIndex: N }`

**Updated In**:
- `01_origin_blueprint.md` section 4.2.3
- `develop_changes_plan.md` section 3.2 (C4 verification criteria)

---

### A9: Renamed Export Handling (RESOLVED - HIGH)

**Original Question**: For renamed exports like `export { originalName as exportedName }`, which name should be used for MODULE node?

**Example Scenario**:
```typescript
// src/utils.ts
function formatDateInternal() { }
export { formatDateInternal as formatDate };

// What MODULE node should be created?
// - MODULE:src/utils.ts#formatDateInternal ?
// - MODULE:src/utils.ts#formatDate ?
```

**Options Considered**:
1. Option 1: Use original name (`formatDateInternal`) - Matches source definition location
2. Option 2: Use exported name (`formatDate`) - Matches how consumers import it
3. Option 3: Create two nodes linking both - Duplicate nodes, complexity

**Resolution Decision**: **Option 2 - Use exported name (`formatDate`)**

**Rationale**:
1. MODULE nodes represent the public API surface - exported name is what consumers use
2. Import resolution depends on exported name, not internal name
3. getScope() should show names that match import statements
4. Internal name is still accessible via metadata.originalName

**Implementation Guidance**:
- MODULE node: `name = exportedName`, `id = "MODULE:filePath#exportedName"`
- metadata: `{ originalName: "formatDateInternal", exportType: "named" }`
- For simple exports without rename: `name = originalName = exportedName`

**Updated In**:
- `01_origin_blueprint.md` section 4.2.3
- `develop_changes_plan.md` section 3.2 (C4 verification criteria)

---

### A12: Default Export Naming Strategy (RESOLVED - HIGH)

**Original Question**: How to handle named default exports like `export default function myFunc() {}`?

**Example Scenario**:
```typescript
// src/config.ts
export default function getConfig() { return config; }

// Should this create:
// - Single MODULE node with name "getConfig"?
// - Single MODULE node with name "default"?
// - Two MODULE nodes (getConfig + default)?
```

**Options Considered**:
1. Option 1: Create node with original name (`getConfig`) - Preserves function identity
2. Option 2: Create node with `"default"` - Matches how it's imported (`import x from ...`)
3. Option 3: Single node with original name, metadata marks as default - Hybrid approach

**Resolution Decision**: **Option 3 - Single node with original name, metadata marks as default**

**Rationale**:
1. Named default exports have explicit identity (`getConfig`) - unlike anonymous exports
2. Single node avoids duplication - the function is one entity
3. metadata.exportType = "default" clarifies it's the default export
4. Consumers import as `import getConfig from './config'` or `import myName from './config'`
5. Original name is semantically meaningful for documentation and analysis

**Implementation Guidance**:
- MODULE node: `name = "getConfig"`, `id = "MODULE:src/config.ts#getConfig"`
- metadata: `{ exportType: "default", namedDefault: true }`
- Contrast with anonymous: anonymous default uses `"default"` as name (per A8)

**Updated In**:
- `01_origin_blueprint.md` section 4.2.3
- `develop_changes_plan.md` section 3.2 (C4 verification criteria)

---

### A4: Cyclomatic Complexity Calculation Method (RESOLVED - MEDIUM)

**Original Question**: What specific algorithm should be used for calculating cyclomatic complexity?

**Example Scenario**:
```typescript
function process(data) {
  if (data.valid) {           // +1?
    for (let item of data.items) {  // +1?
      switch (item.type) {    // +1 base?
        case 'A': return 1;   // +1?
        case 'B': return 2;   // +1?
        default: return 0;
      }
    }
  }
  try {                       // +1?
    riskyOp();
  } catch (e) {               // +1?
    handleError();
  }
  return data.value && data.ok ? 1 : 0;  // +1 for &&? +1 for ?:
}
```

**Options Considered**:
1. Option 1: McCabe standard - if/else/for/while/case/try-catch/&&/||/?each +1
2. Option 2: ESLint complexity rule - counts decision points only
3. Option 3: Simplified - only count if/for/while/switch case (exclude operators)

**Resolution Decision**: **Option 1 - McCabe standard with clear counting rules**

**Rationale**:
1. McCabe's original definition is industry standard
2. Covers all decision points including logical operators
3. ESLint uses similar approach, tool consistency
4. Clear rules make implementation deterministic

**Implementation Guidance**:
- Base complexity = 1 (single path)
- Add +1 for each:
  - `if`, `else`, `else if`
  - `for`, `while`, `do-while`
  - `switch` statement (base +1)
  - Each `case` clause (excluding default)
  - `catch` clause in try-catch
  - `&&`, `||` logical operators
  - `?:` ternary operator
  - `??.` nullish coalescing (optional)
- Implementation: traverse AST, count specific node types

**Complexity Node Types**:
```typescript
const COMPLEXITY_NODES = {
  IfStatement: 1,
  ForStatement: 1,
  WhileStatement: 1,
  DoWhileStatement: 1,
  SwitchStatement: 1,  // base
  CaseClause: 1,       // each case
  CatchClause: 1,
  BinaryExpression: (op) => op === '&&' || op === '||' ? 1 : 0,
  ConditionalExpression: 1,
};
```

**Updated In**:
- `01_origin_blueprint.md` section 4.2.3
- `develop_changes_plan.md` section 3.2 (C4 verification criteria)

---

### A5: LOC (Lines of Code) Counting Rules (RESOLVED - MEDIUM)

**Original Question**: What should be filtered when counting effective LOC?

**Example Scenario**:
```typescript
// src/service.ts
import { Service } from './base';  // Count or skip?
import type { Config } from './types';  // Count or skip?

/** 
 * Documentation comment
 * @param data - input
 */  // Count or skip?
export function process(data: Config): Result {  // Count?
  const result = compute(data);  // Count
  // inline comment  // Count or skip?
  return result;  // Count
}
```

**Options Considered**:
1. Option 1: Count all non-empty, non-comment lines
2. Option 2: Exclude imports/exports/type definitions (implementation only)
3. Option 3: Count non-empty, non-comment, non-import-export lines

**Resolution Decision**: **Option 1 - Count all non-empty, non-comment lines**

**Rationale**:
1. LOC measures code volume for complexity estimation
2. Import/export lines are part of the module's operational code
3. Type definitions (interface/type) contribute to maintenance burden
4. Simpler implementation, consistent with common LOC tools
5. Filtering imports would undercount barrel files (index.ts with re-exports)

**Implementation Guidance**:
- Count lines containing non-whitespace characters
- Exclude:
  - Single-line comments (`// ...`)
  - Multi-line comments (`/* ... */`)
  - JSDoc comments (`/** ... */`)
- Include:
  - Import/export statements
  - Type/interface definitions
  - Function/class declarations
  - All implementation lines

**LOC Algorithm**:
```typescript
function countLOC(source: string): number {
  const lines = source.split('\n');
  let count = 0;
  let inMultiLineComment = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines
    if (trimmed.length === 0) continue;
    
    // Handle multi-line comments
    if (inMultiLineComment) {
      if (trimmed.includes('*/')) inMultiLineComment = false;
      continue;
    }
    
    // Skip single-line comments
    if (trimmed.startsWith('//')) continue;
    
    // Start multi-line comment
    if (trimmed.startsWith('/*') || trimmed.startsWith('/**')) {
      if (!trimmed.includes('*/')) inMultiLineComment = true;
      continue;
    }
    
    count++;
  }
  return count;
}
```

**Updated In**:
- `01_origin_blueprint.md` section 4.2.3
- `develop_changes_plan.md` section 3.2 (C4 verification criteria)

---

### A2: Component Type Judgment Criteria (RESOLVED - MEDIUM)

**Original Question**: How to determine if a MODULE is `kind: "component"` vs `kind: "function"`?

**Example Scenario**:
```typescript
// React component patterns
export function Button({ label }) {       // JSX return?
  return <button>{label}</button>;
}

export const Card = ({ title }) => (      // JSX body?
  <div className="card">{title}</div>
);

export function useLocalStorage() {       // Hook, not component
  const [value, setValue] = useState();
  return [value, setValue];               // No JSX
}

export function formatDate(date) {        // Pure function
  return date.toLocaleDateString();       // No JSX
}
```

**Options Considered**:
1. Option 1: Check return type annotation is JSX.Element
2. Option 2: Check if function body contains JSX elements
3. Option 3: Combine both - return type OR JSX in body

**Resolution Decision**: **Option 3 - Return type JSX.Element OR JSX elements in body**

**Rationale**:
1. Explicit JSX.Element return type is definitive indicator
2. JSX elements in body indicate component even without type annotation
3. Covers both typed and untyped React code
4. Excludes hooks (no JSX return/body) from component classification
5. Handles common patterns: function components, arrow function components

**Implementation Guidance**:
- Check return type annotation: `JSX.Element`, `React.ReactElement`, `React.ReactNode`
- Check body for JSX elements: `<TagName...>` syntax
- Priority:
  1. If return type is JSX-related → `kind: "component"`
  2. If body contains JSX element(s) → `kind: "component"`
  3. Otherwise → `kind: "function"`
- Special case: Function name starts with `use` + body has hooks → still `kind: "function"` (React hook)

**Component Detection Logic**:
```typescript
const JSX_RETURN_TYPES = ['JSX.Element', 'React.ReactElement', 'React.ReactNode'];

function determineKind(decl: ts.FunctionDeclaration | ts.VariableDeclaration): string {
  // Check return type annotation
  const returnType = getReturnType(decl);
  if (JSX_RETURN_TYPES.some(t => returnType?.includes(t))) {
    return 'component';
  }
  
  // Check function body for JSX
  const body = getFunctionBody(decl);
  if (containsJSX(body)) {
    // Exception: React hooks (name starts with 'use')
    if (decl.name && decl.name.getText().startsWith('use')) {
      return 'function';
    }
    return 'component';
  }
  
  return 'function';
}

function containsJSX(node: ts.Node): boolean {
  // Traverse for JSX elements: JsxSelfClosingElement, JsxOpeningElement
  return hasNodeOfType(node, 
    ts.SyntaxKind.JsxSelfClosingElement, 
    ts.SyntaxKind.JsxOpeningElement
  );
}
```

**Updated In**:
- `01_origin_blueprint.md` section 4.2.3
- `develop_changes_plan.md` section 3.2 (C4 verification criteria)

---

### A10: Enum Classification (RESOLVED - MEDIUM)

**Original Question**: Should `EnumDeclaration` be classified as `kind: "type"` or `kind: "variable"`?

**Example Scenario**:
```typescript
// src/status.ts
export enum Status {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
  Pending = 'PENDING',
}

// Should MODULE kind be "type" or "variable"?
```

**Options Considered**:
1. Option 1: `kind: "type"` - Enum is a type definition in TypeScript semantics
2. Option 2: `kind: "variable"` - Enum generates runtime object with values
3. Option 3: New `kind: "enum"` - Special category for enums

**Resolution Decision**: **Option 1 - `kind: "type"`**

**Rationale**:
1. TypeScript treats enum as type construct - can be used in type annotations
2. Blueprint section 3.1 lists kind options: function/class/variable/interface/type/component/unknown
3. Enum is closer to interface/type (defining shapes) than variable (data holders)
4. Consistent enum usage: `Status.Active` suggests runtime, but `x: Status` suggests type
5. Adding new `kind` would expand enum unnecessarily; `type` covers enum adequately

**Implementation Guidance**:
- EnumDeclaration → `kind: "type"`
- metadata: `{ enumMembers: ['Active', 'Inactive', 'Pending'] }`
- Still counts as exported MODULE node

**Updated In**:
- `01_origin_blueprint.md` section 4.2.3
- `develop_changes_plan.md` section 3.2 (C4 verification criteria)

---

### A11: Multiple Exports Handling (RESOLVED - MEDIUM)

**Original Question**: When a symbol is exported multiple ways (named + default), should multiple MODULE nodes be created?

**Example Scenario**:
```typescript
// src/api.ts
function fetchData() { }

export { fetchData };           // Named export
export default fetchData;       // Also default export

// Should this create:
// - Single MODULE node?
// - Two MODULE nodes (named + default)?
```

**Options Considered**:
1. Option 1: Single MODULE node with metadata recording all export types
2. Option 2: Multiple MODULE nodes for each export path (duplication)
3. Option 3: Single node, highest precedence export determines name

**Resolution Decision**: **Option 1 - Single MODULE node with metadata.exports array**

**Rationale**:
1. One code entity (function `fetchData`) = one MODULE node
2. Multiple exports don't create new entities, just different access paths
3. metadata.exports captures all export mechanisms
4. Avoids graph bloat from duplicate nodes
5. getScope() shows all export ways via metadata

**Implementation Guidance**:
- Single MODULE node: `id = "MODULE:src/api.ts#fetchData"`
- metadata: `{ exports: ["named", "default"], isExported: true }`
- exports array elements: `"named"`, `"default"`, `"renamed:<newName>"`
- For `export { fetchData as getData }`:
  - Single node with name `"getData"` (per A9)
  - metadata: `{ exports: ["named"], originalName: "fetchData" }`

**Metadata Schema**:
```typescript
interface ModuleMetadata {
  kind: ModuleKind;
  exports: ExportType[];  // ["named", "default"] or ["named"] etc.
  exportType?: ExportType;  // Primary export type (deprecated, use exports)
  originalName?: string;  // If renamed
  // ... other fields
}

type ExportType = 'named' | 'default' | 'renamed' | 'wildcard';
```

**Updated In**:
- `01_origin_blueprint.md` section 4.2.3
- `develop_changes_plan.md` section 3.2 (C4 verification criteria)

---

## Complete MODULE Node Metadata Schema

As part of the resolution, a comprehensive MODULE metadata schema was defined:

```typescript
interface ModuleMetadata {
  // Classification
  kind: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'component' | 'unknown';
  
  // Export information (resolved via A8-A12)
  exports: ExportType[];
  isExported: boolean;
  originalName?: string;      // For renamed exports (A9)
  namedDefault?: boolean;     // For named default exports (A12)
  anonymous?: boolean;        // For anonymous exports (A8)
  anonymousIndex?: number;    // For multiple anonymous defaults (A8)
  
  // Documentation
  jsDoc?: string;             // First 200 chars
  
  // Complexity metrics (resolved via A4, A5)
  complexity?: number;        // McCabe cyclomatic complexity
  loc?: number;               // Non-empty, non-comment lines
  
  // Status markers
  deprecated?: boolean;       // @deprecated tag
  
  // Enum-specific (A10)
  enumMembers?: string[];     // For kind: "type" enums
  
  // Dynamic fields (incremental update)
  testFile?: string;
  lastModifiedCommit?: string;
  changeFrequency?: number;
}

type ExportType = 'named' | 'default' | 'renamed' | 'wildcard';
```

---

## MODULE Kind Classification Summary

| AST Node Type | kind Value | Special Cases |
|---------------|------------|---------------|
| FunctionDeclaration | `function` | If returns JSX → `component` (A2) |
| ArrowFunction (exported const) | `function` | If returns JSX → `component` (A2) |
| ClassDeclaration | `class` | - |
| InterfaceDeclaration | `interface` | - |
| TypeAliasDeclaration | `type` | - |
| EnumDeclaration | `type` | (A10 resolution) |
| VariableStatement (non-function) | `variable` | - |

---

## Documentation Updates Made

| Document | Section | Update Type |
|----------|---------|-------------|
| `01_origin_blueprint.md` | 4.2.3 | Added MODULE node generation rules + metadata schema |
| `develop_changes_plan.md` | 3.2 (C4) | Added verification criteria for all ambiguities |
| `c4_ambiguity_resolution.md` | (new) | Resolution log created |

---

## Test Fixture Creation

Created comprehensive test fixture project at:
`packages/codegraph/tests/fixtures/module-test-project/`

**Structure**:
```
module-test-project/
├── tsconfig.json                 # Basic config
├── src/
│   ├── anonymous-export.ts       # A8: Anonymous default exports
│   ├── renamed-export.ts         # A9: Renamed exports (originalName as exportedName)
│   ├── named-default.ts          # A12: Named default export
│   ├── multiple-exports.ts       # A11: Same symbol exported multiple ways
│   ├── complexity-test.ts        # A4: Various complexity patterns
│   ├── loc-test.ts               # A5: LOC counting scenarios
│   ├── component-detection.tsx   # A2: Component vs function detection
│   ├── enum-declaration.ts       # A10: Enum classification
│   ├── all-kinds.ts              # Comprehensive kind types
│   ├── utils/
│   │   ├── format.ts             # Helper functions
│   │   └── types.ts              # Type definitions
│   └── components/
│       ├── Button.tsx            # React component (JSX return)
│       ├── Card.tsx              # Arrow function component
│       └── useToggle.ts          # Hook (not component despite hooks)
```

**Test Coverage**:
- Anonymous exports (single and multiple) - A8
- Renamed exports with originalName metadata - A9
- Named default exports with metadata - A12
- Multiple export paths (named + default) - A11
- Complexity calculation validation - A4
- LOC counting scenarios - A5
- Component vs function detection - A2
- Enum as type classification - A10

---

## C4 Readiness Status

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

1. Create OpenSpec change using `/opsx:new cg-ts-parser-modules`
2. Generate proposal.md with resolved ambiguity decisions
3. Generate design.md with MODULE metadata schema
4. Generate specs/ts-parser/spec.md with test scenarios
5. Begin implementation

---

## Appendix: Resolution Timeline

| Time | Action |
|------|--------|
| 09:00 | Assessment requirements reviewed |
| 09:10 | A8 resolution decision made (anonymous exports) |
| 09:15 | A9 resolution decision made (renamed exports) |
| 09:20 | A12 resolution decision made (named default exports) |
| 09:30 | A4 resolution decision made (complexity algorithm) |
| 09:35 | A5 resolution decision made (LOC counting) |
| 09:40 | A2 resolution decision made (component detection) |
| 09:45 | A10 resolution decision made (enum classification) |
| 09:50 | A11 resolution decision made (multiple exports) |
| 09:55 | MODULE metadata schema defined |
| 10:00 | Blueprint section 4.2.3 updated |
| 10:05 | develop_changes_plan.md updated |
| 10:10 | Test fixture project created |
| 10:20 | Resolution log documented |

---

**Resolution Complete**
**Document Version**: v1.0
**Created**: 2026-05-03