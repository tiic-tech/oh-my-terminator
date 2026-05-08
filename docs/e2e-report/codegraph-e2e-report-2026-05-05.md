# CodeGraph E2E Experience Report

**Date**: 2026-05-05
**Tester**: Claude Agent
**Repository**: oh-my-terminator
**Scope**: Full codegraph CLI functionality

---

## 1. Help Information Assessment

| Dimension | Rating | Notes |
|-----------|--------|-------|
| **Information Volume** | ⭐⭐⭐☆☆ | Missing API features (scope, impact, layers) |
| **Information Quality** | ⭐⭐⭐☆☆ | Brief parameter explanations, no usage examples |
| **Agent-Friendly** | ⭐⭐☆☆☆ | Cannot discover all capabilities from help alone |

### Global Help Output

```
Commands:
  analyze [cwd]  Run full analysis and save baseline
  update [cwd]   Run incremental update based on git changes
  migrate        Migrate baseline from 1.0 to 1.1 format
```

### Issues Identified

1. **Missing API commands**: `scope`, `impact`, `layers` not exposed in CLI
2. **No examples**: Each command help lacks usage examples
3. **Contradictory defaults**: `--compress/--no-compression` both show "default: true"

---

## 2. Analyze Functionality

| Dimension | Result |
|-----------|--------|
| **Performance** | ✅ **Excellent** - 1226 files, 2239 modules, 1.3s |
| **Compression** | ✅ **Exceeded target** - 50% reduction (target: 20-30%) |
| **Output Quality** | ✅ **High-density** - Clean JSON structure, complete stats |

### JSON Output Sample

```json
{
  "success": true,
  "stats": {
    "filesScanned": 1226,
    "modulesExtracted": 2239,
    "edgesCreated": {
      "imports": 2392,
      "exports": 2239,
      "contains": 1509
    }
  },
  "compressionStats": {
    "originalSizeBytes": 2447246,
    "compressedSizeBytes": 1226610,
    "savingsPercent": 50
  },
  "durationMs": 1358,
  "nextSuggested": ["codegraph update", "codegraph scope --all"]
}
```

### Strengths

- Compression 50%, exceeds design target
- Output structure suitable for Agent consumption
- Includes `nextSuggested` for workflow guidance

---

## 3. Update Functionality

| Dimension | Result |
|-----------|--------|
| **Status** | ❌ **BLOCKER BUG** - Cannot load compressed baseline format |

### Bug Details

**Symptom**: `update` command returns `E_BASELINE_NOT_FOUND` even when baseline exists

**Root Cause**:
- `saveBaseline()` saves `CompressedBaseline` (1.1 format with `pathTable`)
- `loadBaseline()` validation expects `Baseline` (1.0 format with `graph.nodes`)
- Format mismatch causes validation failure

**Code Location**:
```
packages/codegraph/src/persistence/baseline/validation.ts:104
requiredFields = ['graph', 'commitHash', 'timestamp']
// But 1.1 format has NO 'graph' field!
```

**Evidence**:
```json
// Saved baseline.json (1.1 format)
{
  "schemaVersion": { "major": 1, "minor": 1, "patch": 0 },
  "pathTable": [...],
  "nodes": [...],  // NO 'graph' wrapper!
  "edges": [...]
}
```

---

## 4. Output Information Quality

| Feature | Token Density | Agent Satisfaction | Issues |
|---------|---------------|-------------------|--------|
| **analyze --json** | ⭐⭐⭐⭐☆ High | ✅ Supports understanding | Missing error examples |
| **analyze text** | ⭐⭐⭐☆☆ Medium | ⚠️ Requires parsing | Readable but scattered |
| **baseline.json** | ⭐⭐⭐⭐⭐ Very High | ✅ High-density pathTable | Compressed format effective |

---

## 5. Issues Summary

| Priority | Issue | Impact |
|----------|-------|--------|
| **P0 BLOCKER** | Update cannot load compressed baseline | Update feature completely broken |
| **P1** | Help missing API capabilities (scope/impact/layers) | Agent cannot discover all features |
| **P2** | --compress parameter explanation contradictory | User confusion |
| **P2** | No command examples in help | Requires external documentation |

---

## 6. Recommended Fixes

### P0 Fix: Support Both Formats in Validation

```typescript
// validation.ts needs format-aware validation
export function validateBaselineStructure(data: unknown): ValidationResult {
  const format = detectBaselineFormat(data);

  if (format === '1.1') {
    // CompressedBaseline validation
    return validateCompressedBaselineStructure(data);
  }

  // Baseline (1.0) validation
  // ...existing logic
}

function validateCompressedBaselineStructure(data: unknown): ValidationResult {
  const errors: string[] = [];
  const required = ['pathTable', 'nodes', 'edges', 'commitHash', 'timestamp'];

  for (const field of required) {
    if (!(field in data)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
```

### P1 Fix: Add API Commands to CLI

```typescript
// bin/codegraph.ts needs API command registration
cli.command('scope <query>', 'Query code scope')
cli.command('impact <target>', 'Analyze change impact')
cli.command('layers', 'Show architecture layers')
```

### P2 Fix: Clarify Help Text

```typescript
// Remove contradictory default annotations
.option('--compress', 'Enable compression (default behavior)')
.option('--no-compression', 'Save as uncompressed 1.0 format')
```

---

## 7. Overall Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Help System** | 60/100 | Insufficient info, Agent cannot quickly onboard |
| **Analyze Performance** | 95/100 | Excellent, compression exceeds target |
| **Update Functionality** | 0/100 | BLOCKER BUG, completely broken |
| **Output Quality** | 85/100 | High-density JSON, meets Agent needs |

### Core Conclusion

CodeGraph has high-value data analysis capabilities with:
1. **P0 format compatibility bug** blocking update functionality
2. **Incomplete help system** hiding API capabilities

After fixes, codegraph will meet the goal of "fewer tokens, higher density, better quality information" for Agent workflows.

---

## 8. Next Steps

1. Create OpenSpec change for P0 fix: `fix-compressed-baseline-validation`
2. Create OpenSpec change for P1 fix: `add-cli-api-commands`
3. Run full test suite after fixes
4. Re-run E2E experience validation