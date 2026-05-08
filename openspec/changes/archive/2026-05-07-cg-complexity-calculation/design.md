## Context

CodeGraph currently has no code complexity metrics. The scope command returns `"level": "unknown", "value": 0` for all files, making complexity metadata meaningless. Users cannot identify high-complexity code needing refactoring attention.

The existing architecture has:
- TypeScriptParser producing MODULE nodes with metadata
- Scope query aggregating MODULE metadata for FILE complexity
- MODULE node structure supporting arbitrary metadata fields

This design adds Cyclomatic Complexity calculation integrated into the parsing pipeline.

## Goals / Non-Goals

**Goals:**
- Calculate Cyclomatic Complexity for TypeScript/JavaScript functions
- Store complexity on MODULE node metadata
- Aggregate file-level complexity from MODULE nodes
- Classify complexity into meaningful levels (low/medium/high/critical)
- Integrate with scope query to return meaningful values

**Non-Goals:**
- Other complexity metrics (Halstead, maintainability index) - future enhancement
- Complexity calculation for non-TypeScript languages - requires language-specific implementations
- Real-time complexity monitoring - static analysis only
- Complexity trending over time - baseline persistence feature

## Decisions

### Decision: Complexity scope - MODULE kinds that receive calculation

**Complexity is calculated ONLY for MODULE nodes with `kind === 'function' || kind === 'component'`**:

| ModuleKind | Complexity Calculated? | Reason |
|------------|------------------------|--------|
| 'function' | YES | Functions have decision points |
| 'component' | YES | Components are functions returning JSX |
| 'class' | NO | Classes aggregate method complexity |
| 'interface' | NO | Interfaces have no executable code |
| 'type' | NO | Type aliases have no executable code |
| 'variable' | NO | Non-function variables have no decision points |

**Edge cases**:
- Class methods do NOT create separate MODULE nodes - methods are part of class MODULE
- Nested functions inside exported functions do NOT create separate MODULE nodes - complexity is part of parent
- Arrow functions exported at top level DO create MODULE nodes with `kind='function'`
- Hooks (`useXxx`) are classified as `kind='function'`, NOT `kind='component'`

### Decision: Use Cyclomatic Complexity as primary metric

**Rationale**: Cyclomatic Complexity is well-established, easy to calculate from AST, and directly correlates with test coverage needs. McCabe's formula: CC = E - N + 2P where E = edges, N = nodes, P = connected components.

**Alternatives considered**:
- Halstead Volume: More comprehensive but harder to explain to users
- Maintainability Index: Combines multiple metrics but hides individual factors
- Lines of Code: Too simplistic, doesn't capture decision complexity

### Decision: Calculate at function level, aggregate at file level

**Rationale**: Function-level granularity enables:
- Identifying specific functions needing refactoring
- Accurate aggregation without counting inter-function complexity
- Module-level metadata already exists in CodeGraph

### Decision: Complexity level thresholds

| Level | Range | Description |
|-------|-------|-------------|
| low | 1-5 | Simple, easy to understand |
| medium | 6-15 | Moderate complexity, acceptable |
| high | 16-25 | Complex, should consider refactoring |
| critical | 26+ | Very complex, needs attention |

**Rationale**: Based on McCabe's original recommendations (CC > 10 is concerning) adjusted for modern JavaScript patterns (async/await, callbacks add decision points).

### Decision: AST-based calculation via TypeScript compiler API

**Rationale**: Already using TypeScript compiler API for parsing. Decision points detected by traversing AST for:
- If/else statements
- Switch cases
- Loops (for, while, do-while, for-of, for-in)
- Conditional expressions (ternary)
- Catch blocks
- Logical operators (&&, ||, ??)

**Logical operator counting**: Each logical operator counts +1 independently:
- `a && b` → 1 operator (+1)
- `a && b && c` → 2 operators (+2)
- `a && b || c` → 2 operators (+2)
- `a ?? b` → 1 operator (+1)

**Else-if chain handling**: McCabe standard counts else-if as part of if chain, not separate:
- `if (a) {} else if (b) {}` → +1 for if (else-if is continuation)
- `if (a) {} else {}` → +2 (if + standalone else)

**Alternatives considered**:
- ESLint complexity rule: Would require additional dependency and doesn't integrate with our MODULE nodes
- Custom tokenizer: More complex, less accurate than AST traversal

### Decision: Store as MODULE node metadata field

**Rationale**: MODULE nodes already have metadata. Adding `complexity: { level, value }` fits existing architecture without schema changes.

## Risks / Trade-offs

**Risk: Async/await patterns may inflate complexity**
→ Guidance: Async functions naturally have higher CC due to implicit branching in promise handling:
  - `await` does NOT add complexity (it's a suspension point, not a branch)
  - `try/catch` around await adds +1 for catch block
  - Promise chains with `.catch()` callback are handled by catch block detection
  - Document that async functions typically have 2-3 higher CC baseline
  → Mitigation: Document that async functions naturally have higher CC due to implicit branching. Adjust thresholds accordingly.

**Risk: Complex arrow functions not detected as MODULE nodes**
→ Clarification: Arrow functions ARE detected as MODULE nodes when exported at top level (`export const fn = () => {}`). They receive `kind='function'` and complexity is calculated. Nested arrow functions inside exported functions do NOT create separate MODULE nodes - their complexity is part of the parent function.

**Risk: Performance impact on large projects**
→ Performance targets:
  - Max time per file: <100ms for typical files (<500 LOC)
  - Max time per file: <500ms for large files (<2000 LOC)
  - Memory limit: <50MB additional overhead for complexity calculation
  - Complexity calculation is O(n) AST traversal, negligible compared to parsing. Profile if >10k files.

**Trade-off: Single metric vs. comprehensive analysis**
→ Accept: Start with CC, add Halstead/maintainability index as future enhancement when user feedback requests it.

**Error handling edge cases**:
- Malformed AST nodes: Return `{ level: "unknown", value: 0 }` if AST traversal fails
- Missing function body: Return `{ level: "unknown", value: 0 }` for declaration without body
- Empty body functions: Return `{ level: "low", value: 1 }` (base complexity)
- Syntax errors in source: TypeScript parser handles gracefully, complexity calculated on valid portions

## Migration Plan

No migration needed - new feature adds metadata to existing structure. Files without MODULE nodes continue to return `{ level: "unknown", value: 0 }`.

**Deployment steps**:
1. Add `complexity-calculator.ts` to analyzer package
2. Integrate into TypeScriptParser during MODULE extraction
3. Update scope query metadata builder to use calculated values

## Open Questions

None - design is straightforward with clear integration points.