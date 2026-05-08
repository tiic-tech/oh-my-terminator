## Why

E2E testing revealed that the `scope` command returns `"level": "unknown", "value": 0` for complexity metadata, making this quality metric meaningless. Users cannot identify high-complexity code that needs refactoring attention. This is a P1 issue blocking meaningful code quality insights.

## What Changes

- **NEW**: Cyclomatic Complexity calculation for TypeScript/JavaScript code
- **NEW**: Function-level complexity metrics stored on MODULE nodes
- **NEW**: File-level complexity aggregation for scope query metadata
- **NEW**: Complexity level classification (low/medium/high/critical)
- **MODIFIED**: TypeScriptParser will calculate complexity during parsing
- **MODIFIED**: Scope query will return meaningful complexity values instead of "unknown"

## Capabilities

### New Capabilities

- `complexity-calculator`: Cyclomatic complexity calculation algorithm for TypeScript/JavaScript code, including function-level analysis, file-level aggregation, and complexity level classification

### Modified Capabilities

- `analyzer`: TypeScriptParser integration to calculate complexity during parsing and store on MODULE nodes
- `scope-query`: Use calculated complexity values instead of returning "unknown" when MODULE nodes have complexity metadata

## Impact

**Affected code**:
- `packages/codegraph/src/analyzer/` - new complexity-calculator module
- `packages/codegraph/src/parser/typescript/` - integration point for complexity calculation
- `packages/codegraph/src/api/scope/` - metadata builder uses complexity data

**APIs**:
- MODULE node `metadata.complexity` field will be populated with calculated values
- Scope query `complexity` result will return meaningful `{ level, value }` objects

**Dependencies**:
- Relies on TypeScript AST traversal (existing)
- Uses existing MODULE node metadata structure