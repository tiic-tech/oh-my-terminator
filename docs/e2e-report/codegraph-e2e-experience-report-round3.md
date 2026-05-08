# CodeGraph E2E Experience Report

**Date**: 2026-05-07
**Tester**: E2E_Tester Agent
**Version**: 0.2.0
**Test Environment**: oh-my-terminator repo, codegraph package

## Executive Summary

- **Overall Score**: 7.5/10
- **Key Findings**:
  1. JSON/stderr separation is properly implemented - pure JSON on stdout, logs on stderr
  2. Layers command (C14) works correctly with semantic naming for layers 5+
  3. Default source-root mismatch causes confusion for monorepo usage
- **Recommendations**:
  1. Add source-root auto-detection for monorepo structures
  2. Improve error handling for invalid commands/flags (avoid raw stack traces)
  3. Document full path format requirements for scope/impact commands

---

## Test Results

### 1. Layers Command (C14 Newly Implemented)

| Aspect | Score | Notes |
|--------|-------|-------|
| Semantic names (layers 5+) | 9/10 | "API Layer", "CLI Layer" displayed correctly |
| Verbose output | 9/10 | Pattern matching shown: `[Pattern: ^(api|routes|endpoints)$ (exact, priority: 20)]` |
| JSON output purity | 8/10 | Pure JSON on stdout, warning "6 layer violations detected" on stderr |
| namingInfo in JSON | 10/10 | Includes pattern, isExactMatch, finalPriority |
| Default source-root | 5/10 | Default "src" fails for monorepo; requires explicit `--source-root packages/codegraph/src` |

**Sample Output (Verbose)**:
```
Layer 5: API Layer
  [Pattern: ^(api|routes|endpoints)$ (exact, priority: 20)]
  - api (50 files)
  - persistence (33 files)

Layer 6: CLI Layer
  [Pattern: ^(cli|commands|bin)$ (exact, priority: 20)]
  - cli (25 files)
```

**JSON Output Sample**:
```json
{
  "layer": 5,
  "role": "API Layer",
  "namingInfo": {
    "pattern": "^(api|routes|endpoints)$",
    "isExactMatch": true,
    "finalPriority": 20
  }
}
```

### 2. Analyze Command

| Aspect | Score | Notes |
|--------|-------|-------|
| Graph structure output | 9/10 | Clear summary: Files scanned, Modules extracted, Edges created |
| Module extraction | 10/10 | Correctly extracts 2524 modules from 1306 files |
| Import relationships | 10/10 | Imports, exports, contains edges properly created |
| JSON output purity | 10/10 | Pure JSON on stdout, empty stderr |
| Performance | 9/10 | 1.5s execution time, 50% compression achieved |

**Sample Output**:
```
Analysis complete

Files scanned: 1306
Modules extracted: 2524
Edges created: 2580 imports, 2524 exports, 1728 contains

Baseline saved: .codegraph/baseline.json

Compression stats:
- Original size: 2.68MB
- Compressed size: 1.34MB
- Savings: 50%
Duration: 1.6s
```

### 3. Scope Command

| Aspect | Score | Notes |
|--------|-------|-------|
| Output clarity | 9/10 | Exports, Imports, Imported by sections clearly formatted |
| JSON output purity | 10/10 | Pure JSON on stdout |
| Path format requirement | 6/10 | Requires full path (packages/codegraph/src/...), not intuitive |
| Error handling | 8/10 | Friendly error for nonexistent targets |
| Performance | 10/10 | 36ms execution time |

**Sample Output**:
```
Scope result

Target: FILE:packages/codegraph/src/analyzer/index.ts

Exports:
- variable: DEFAULT_SOURCE_EXTENSIONS
- variable: DEFAULT_TEST_PATTERNS
...

Imports:
- packages/codegraph/src/analyzer/edge-case-detector.ts
- packages/codegraph/src/analyzer/empty-project-handler.ts
...

Imported by:
- packages/codegraph/src/cli/commands/analyze-helpers.ts
- packages/codegraph/src/cli/commands/analyze.ts
```

### 4. Impact Command

| Aspect | Score | Notes |
|--------|-------|-------|
| Output clarity | 9/10 | Direct/Indirect separation, blast radius indicator |
| JSON output purity | 10/10 | Pure JSON on stdout |
| Path format requirement | 6/10 | Same as scope - requires full path |
| Error handling | 8/10 | Friendly error for nonexistent targets |
| Performance | 10/10 | 26ms execution time |

**Sample Output**:
```
Impact analysis complete

Total affected: 5
Direct: 3
Indirect: 2
Blast radius: medium

Affected files:
- packages/codegraph/src/cli/commands/analyze-helpers.ts (direct)
- packages/codegraph/src/cli/commands/analyze.ts (direct)
...
```

### 5. JSON/stderr Separation (P0 Requirement)

| Aspect | Score | Notes |
|--------|-------|-------|
| stdout purity | 10/10 | Pure JSON when properly redirected (1>stdout 2>stderr) |
| stderr content | 9/10 | Warnings and non-JSON output correctly sent to stderr |
| jq compatibility | 10/10 | JSON output successfully pipes to jq |

**Verification**:
```bash
# stdout is pure JSON
$ npx tsx packages/codegraph/bin/codegraph.ts layers --json 1>stdout.json 2>stderr.txt
$ head -1 stdout.json
{"success":true,"layers":[...]}

# stderr contains warnings
$ cat stderr.txt
6 layer violations detected

# jq works
$ npx tsx packages/codegraph/bin/codegraph.ts layers --json 2>/dev/null | jq '.success'
true
```

### 6. Help & Error Handling

| Aspect | Score | Notes |
|--------|-------|-------|
| Main help | 10/10 | Clear command list, usage examples |
| Subcommand help | 10/10 | Detailed options, examples for each command |
| Invalid command | 3/10 | Empty output, no error message shown |
| Invalid flag | 4/10 | Raw Node.js stack trace (CACError) instead of friendly message |
| Missing required arg | 5/10 | Raw Node.js stack trace (CACError) |

**Issues**:
- `codegraph invalid-command` produces empty output (no error)
- `codegraph analyze --invalid-flag` shows raw stack trace:
```
CACError: Unknown option `--invalidFlag`
    at Command.checkUnknownOptions (file://.../cac/dist/index.mjs:400:17)
    ...
Node.js v25.9.0
```

### 7. Performance & UX

| Command | Execution Time | Score | Notes |
|---------|---------------|-------|-------|
| analyze | 1.5s | 9/10 | Fast for 1306 files |
| update | 178ms | 10/10 | Very fast incremental update |
| layers | 109ms | 10/10 | Instant layer inference |
| scope | 36ms | 10/10 | Quick scope query |
| impact | 26ms | 10/10 | Fast impact analysis |

**UX Observations**:
- Output is well-formatted and readable
- "Next suggested" commands provide helpful guidance
- Duration displayed for all commands
- Suggestions for fixing violations are actionable

---

## Issues Found

| Priority | Issue | Location | Fix |
|----------|-------|----------|-----|
| P1 | Default source-root "src" fails for monorepo | layers command | Auto-detect source root or document clearly |
| P1 | Invalid command produces empty output | CLI entry | Show error message for unknown commands |
| P1 | Invalid flag shows raw stack trace | CLI error handling | Catch CACError and format friendly message |
| P2 | Path format not intuitive for scope/impact | scope/impact commands | Show example paths in error message |
| P2 | Missing required arg shows stack trace | CLI error handling | Catch CACError for missing args |

---

## Recommendations

### P1 - Critical UX Issues

1. **Source-root auto-detection**: When running from monorepo root, detect packages/*/src structure automatically
   ```typescript
   // Suggested detection logic
   if (fs.existsSync('packages')) {
     const srcPackages = fs.readdirSync('packages').filter(p => fs.existsSync(`packages/${p}/src`));
     if (srcPackages.length === 1) {
       return `packages/${srcPackages[0]}/src`;
     }
   }
   ```

2. **CLI error handling**: Wrap CACError and show friendly message
   ```typescript
   // Current: Raw stack trace
   // Desired: "Unknown command 'invalid-command'. Available commands: analyze, update, layers..."
   ```

3. **Path format guidance**: When target not found, suggest checking path format
   ```typescript
   // Current: "Target not found: src/analyzer/index.ts"
   // Desired: "Target not found: src/analyzer/index.ts. Try full path: packages/codegraph/src/analyzer/index.ts"
   ```

### P2 - Enhancement Suggestions

1. Add `--list-targets` flag to show available targets for scope/impact
2. Add config file support for default source-root
3. Consider relative path resolution from cwd

---

## Test Coverage Summary

| Flow | Tested | Passed | Issues |
|------|--------|--------|--------|
| analyze (repo root) | Yes | Yes | - |
| analyze (sub-package) | Yes | No | Git repo check fails |
| update | Yes | Yes | - |
| layers (default) | Yes | No | source-root mismatch |
| layers (--source-root) | Yes | Yes | - |
| layers (--verbose) | Yes | Yes | - |
| layers (--json) | Yes | Yes | - |
| scope (valid path) | Yes | Yes | - |
| scope (invalid path) | Yes | Yes | Friendly error |
| scope (--json) | Yes | Yes | - |
| impact (valid path) | Yes | Yes | - |
| impact (invalid path) | Yes | Yes | Friendly error |
| impact (--json) | Yes | Yes | - |
| help (main) | Yes | Yes | - |
| help (subcommand) | Yes | Yes | - |
| error (invalid command) | Yes | No | Empty output |
| error (invalid flag) | Yes | No | Raw stack trace |

---

## Conclusion

**Ready for Release**: Partially (conditional on P1 fixes)

The codegraph CLI demonstrates strong core functionality with proper JSON/stderr separation (P0 requirement met). The C14 layers command implementation works correctly with semantic naming for layers 5+. However, three P1 UX issues should be addressed before general release:

1. Monorepo source-root auto-detection
2. CLI error message formatting
3. Path format guidance for scope/impact

**Recommended Action**: Address P1 issues before wider adoption, or document the current behavior clearly for users.