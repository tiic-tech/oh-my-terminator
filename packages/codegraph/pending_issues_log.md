# Pending Issues Log

> Issues deferred from code review that require future attention

---

## Issue Registry

| ID | Severity | File | Issue | Status | Created | Target |
|----|----------|------|-------|--------|---------|--------|
| PI-001 | MEDIUM | scanner.ts:104-225 | `scanRecursive` function 121 lines exceeds 50-line guideline | Deferred | 2026-05-03 | C3+ if complexity grows |
| PI-002 | MEDIUM | scanner.ts | Mutation pattern in result accumulation | Accepted | 2026-05-03 | N/A (appropriate pattern) |
| PI-003 | LOW | scanner.ts:76-79 | Path input lacks boundary validation for CLI/API exposure | Deferred | 2026-05-03 | CLI implementation (C9) |

---

## Issue Details

### PI-001: Long Internal Function

**File:** `scanner.ts:104-225`
**Function:** `scanRecursive`
**Length:** 121 lines

**Analysis:**
- Internal/private function, not public API
- Single responsibility: recursive directory scanning
- Logic is coherent with clear structure:
  - Depth check
  - Ignore rules check
  - Hidden check
  - Directory read with error handling
  - Node creation
  - Entry processing loop

**Deferred Reason:**
- Current implementation is acceptable for internal function
- Public API (`scanDirectory`) is appropriately short (~20 lines)

**Resolution Trigger:**
- If future enhancements add complexity
- When implementing C3 (TypeScript Parser) if scanner grows

**Resolution Plan:**
```typescript
// Potential refactoring:
// - Extract entry processing into processEntry()
// - Extract node creation into createNodesForDirectory()
```

---

### PI-002: Mutation Pattern in Result Collection

**File:** `scanner.ts`
**Pattern:** Result object mutation during scan

**Affected Lines:**
- 158-164: Push directory node, increment stats
- 168-173: Push CONTAINS edge
- 182, 188, 194: Increment skipped count
- 204-210: Push file node
- 213-217: Push CONTAINS edge
- 221: Push to filesToParse

**Analysis:**
- Collector/result accumulation pattern
- Returns fresh result object each call
- No modification of external state
- Immutable input, mutable internal accumulation

**Accepted Reason:**
- Pattern is idiomatic for recursive collection in TypeScript/JavaScript
- Alternative (immutable) would require costly array concatenation at each recursion level
- Performance impact for deep directory trees

**Status:** Accepted — no change needed

---

### PI-003: Path Input Validation

**File:** `scanner.ts:76-79`
**Function:** `scanDirectory(root, options)`

**Issue:**
- Accepts any absolute path without boundary validation
- No check against allowed roots or sandbox boundaries

**Security Context:**
- Currently library-only usage (no CLI/API exposure)
- Caller controls the root path
- If exposed via CLI, malicious paths could scan unintended directories

**Deferred Reason:**
- Internal library function, not user-facing
- Validation responsibility belongs to caller (CLI/API layer)

**Resolution Trigger:**
- CLI implementation (C9)
- API exposure (future)

**Resolution Plan:**
```typescript
// Option A: Add allowedRoots parameter
interface ScanOptions {
  extensions?: string[];
  ignoreRules?: string[];
  includeHidden?: boolean;
  maxDepth?: number;
  allowedRoots?: string[]; // Restrict scanning to these roots
}

// Option B: Document security expectations
/**
 * @param root - Absolute path to scan. Caller must validate path
 *               is within expected project boundaries when used
 *               in CLI or API contexts.
 */

// Option C: Add validation helper
export function validateRoot(root: string, allowedRoots: string[]): boolean {
  const normalized = path.resolve(root);
  return allowedRoots.some(allowed => 
    normalized.startsWith(path.resolve(allowed))
  );
}
```

---

## Review History

| Date | Change | Review Result | Issues Created |
|------|--------|---------------|----------------|
| 2026-05-03 | cg-file-system-scanner | Approved | PI-001, PI-002, PI-003 |

---

## Resolution Policy

1. **CRITICAL/HIGH**: Fix immediately, no deferral
2. **MEDIUM**: Defer if internal/private code with clear rationale
3. **LOW**: Defer to appropriate future milestone

---

**Version**: v1.0
**Created**: 2026-05-03
**Next Review**: After C3 implementation