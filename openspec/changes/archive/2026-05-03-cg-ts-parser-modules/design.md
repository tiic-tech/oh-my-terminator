## Context

MODULE nodes represent the finest granularity in CodeGraph's repository modeling. While C1-C3 established the graph structure and file-level relationships, this change enables symbol-level analysis. 

**Current State**:
- C1 provides: NodeType.MODULE, GraphNode interface with metadata fields (kind, jsDoc, complexity, loc)
- C3 provides: TypeScript Program creation, parser infrastructure patterns
- No MODULE extraction exists yet

**Constraints**:
- Must use TypeScript Compiler API for symbol resolution
- Only exported symbols create MODULE nodes (per blueprint)
- Must handle anonymous and renamed exports
- Must calculate complexity and LOC metrics

**Stakeholders**:
- C5 (CALLS edges): Will extend for function call extraction
- C6-C7 (EXTENDS/IMPLEMENTS): Will use MODULE nodes for inheritance

## Goals / Non-Goals

**Goals**:
- Extract all exported declarations from TypeScript/JavaScript files
- Create MODULE nodes with correct ID format `MODULE:filePath#exportName`
- Determine `kind` classification accurately (function/class/component/interface/type/variable)
- Extract JSDoc comments (first 200 characters)
- Calculate McCabe cyclomatic complexity
- Count effective lines of code (LOC)
- Handle edge cases: anonymous exports, renamed exports, multiple exports

**Non-Goals**:
- CALLS/EXTENDS/IMPLEMENTS edges (M2 milestone)
- Private/unexported symbol extraction
- Cross-file symbol resolution (TypeChecker deep analysis)
- Performance optimization (batch processing, caching)
- Multi-language support (M6)

## Decisions

### D1: MODULE Node ID Naming Strategy (A8, A9, A12 Resolutions)

**Decision**: Use exported name as primary identifier with special handling for edge cases

**Alternatives Considered**:
1. Internal symbol name - Rejected: Doesn't match what consumers see
2. Fully qualified name with namespace - Rejected: Too verbose
3. Exported name with metadata fallback - **Selected**: Matches import resolution

**Resolution Rules**:
| Export Type | MODULE name | MODULE ID | metadata |
|------------|-------------|-----------|----------|
| Named export `export function foo()` | `foo` | `MODULE:file#foo` | `{}` |
| Default export with name `export default function foo()` | `foo` | `MODULE:file#foo` | `{namedDefault:true}` |
| Anonymous default `export default function()` | `default` | `MODULE:file#default` | `{}` |
| Multiple anonymous defaults (rare) | `default_N` | `MODULE:file#default_N` | `{}` |
| Renamed export `export { orig as exp }` | `exp` | `MODULE:file#exp` | `{originalName:"orig"}` |

**Rationale**:
- Exported name matches how other files import the symbol
- Original name preserved in metadata for reference
- `"default"` is conventional for anonymous exports

### D2: Kind Classification Rules

**Decision**: Use AST node type with JSX-specific component detection

**Classification Table**:
| AST Node Type | kind | Additional Metadata |
|--------------|------|---------------------|
| FunctionDeclaration | `function` | `{}` |
| ClassDeclaration | `class` | `{}` |
| InterfaceDeclaration | `interface` | `{}` |
| TypeAliasDeclaration | `type` | `{}` |
| EnumDeclaration | `type` | `{enumMembers:["A","B"]}` |
| VariableDeclaration with arrow function | `function` | `{}` |
| VariableDeclaration with JSX return | `component` | `{}` |
| VariableDeclaration with other init | `variable` | `{}` |

**Component Detection (A2 Resolution)**:
- Primary: Return type annotation is `JSX.Element` or `React.ReactElement`
- Secondary: Function body contains JSX elements (`<div>`, `<Component/>`)
- Excluded: React hooks (`useToggle`) - marked as `function` not `component`

### D3: McCabe Cyclomatic Complexity Algorithm (A4 Resolution)

**Decision**: Use McCabe standard with specific AST node counting

**Complexity Rules**:
| AST Pattern | Complexity Addition |
|------------|--------------------|
| Base function | 1 |
| `if` statement | +1 |
| `else` / `else if` | +1 |
| `for` / `while` / `do-while` | +1 |
| `switch` case (each) | +1 |
| `try-catch` (each catch) | +1 |
| `&&` operator | +1 |
| `||` operator | +1 |
| `??` operator | +1 |
| `?:` ternary | +1 |

**Rationale**:
- Standard McCabe definition widely understood
- Matches ESLint complexity rule expectations
- Enables meaningful complexity comparisons

### D4: LOC Counting Rules (A5 Resolution)

**Decision**: Count all non-empty, non-comment lines

**Counting Rules**:
| Line Type | Count? |
|----------|--------|
| Empty line | No |
| Single-line comment (`//`) | No |
| Multi-line comment block | No |
| JSDoc comment block | No |
| Import statement | Yes |
| Export statement | Yes |
| Type definition | Yes |
| Code statement | Yes |

**Rationale**:
- LOC measures code volume, not just "logic"
- Import/export are meaningful lines developers write
- Simpler to implement than complex filtering

### D5: Multiple Exports Handling (A11 Resolution)

**Decision**: Single MODULE node per symbol, metadata tracks all export types

**Example**:
```typescript
function foo() {}
export { foo }           // named
export default foo       // default
```

Creates: `MODULE:file#foo` with `metadata.exports = ["named", "default"]`

**Rationale**:
- Single symbol should have single node
- Prevents graph bloat from duplicate nodes
- Export types captured in metadata

### D6: JSDoc Extraction Strategy

**Decision**: Extract first 200 characters, preserving structure

**Implementation**:
- Read JSDoc comment range from AST
- Extract text content (without `/**` and `*/`)
- Truncate at 200 chars with ellipsis if needed
- Preserve newline characters for readability

### D7: Module Structure

**Decision**: Create focused modules for each capability

```
packages/codegraph/src/parser/
├─ module-extractor.ts    # Main extraction logic
├─ kind-detector.ts       # Kind classification
├─ complexity.ts          # McCabe complexity calculation
├─ loc-counter.ts         # LOC counting
└─ index.ts               # Exports
```

**Rationale**:
- Separation of concerns for testability
- Each module < 200 lines target
- Reusable utilities (complexity could be used elsewhere)

## Risks / Trade-offs

### R1: TypeChecker Dependency for Symbol Resolution
**Risk**: Deep TypeChecker usage may impact performance on large projects
**Mitigation**: Use shallow AST traversal where possible, TypeChecker only for ambiguous cases

### R2: Component Detection Accuracy
**Risk**: JSX detection may miss functional components without JSX.Element annotation
**Mitigation**: Use both type annotation and body content detection (dual criteria)

### R3: Anonymous Export Naming Collision
**Risk**: Multiple anonymous exports may create naming conflicts
**Mitigation**: Numeric suffix `_N` ensures uniqueness (rare edge case)

### R4: LOC Definition Variability
**Risk**: LOC definitions vary across tools, may not match expectations
**Mitigation**: Document rules clearly, match conventional understanding

## Open Questions

None - All ambiguities resolved in c4_ambiguity_resolution.md