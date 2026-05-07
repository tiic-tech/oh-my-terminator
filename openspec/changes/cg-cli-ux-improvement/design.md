## Context

The CodeGraph CLI uses CAC (a lightweight CLI framework) for command parsing. When CAC encounters errors (unknown command, invalid flag, missing argument), it throws `CACError` with raw Node.js stack traces. The current implementation lacks error transformation, resulting in unfriendly UX for non-expert users.

**Current Error Flow**:
```
CACError thrown → Uncaught → Node.js prints stack trace → User confusion
```

**Desired Error Flow**:
```
CACError thrown → Caught at entry point → Error transformer → Friendly message → User understands
```

## Goals / Non-Goals

**Goals**:
- Transform CACError into friendly, actionable error messages
- Provide command suggestions for unknown commands
- Provide flag suggestions for invalid flags
- Add path format hints in scope/impact error messages
- Maintain JSON output compatibility (--json flag errors remain structured)

**Non-Goals**:
- Full error code system for all internal errors (focus on CLI layer only)
- Internationalization/localization of error messages
- Auto-correction of user inputs

## Decisions

### Decision 1: Error transformation at CLI entry point

**Choice**: Catch and transform errors in `bin/codegraph.ts` at the top level.

**Alternatives considered**:
- Per-command error handling: Rejected - too scattered, inconsistent handling
- Middleware approach: Rejected - CAC doesn't support middleware for errors

**Rationale**: Centralized handling ensures consistent error UX across all commands and avoids duplication.

### Decision 2: Error code classification

**Choice**: Define a small set of CLI-specific error codes (E_CLI_*).

**Error codes**:
- `E_CLI_UNKNOWN_COMMAND`: Unknown command entered
- `E_CLI_UNKNOWN_FLAG`: Invalid flag used
- `E_CLI_MISSING_ARG`: Required argument missing
- `E_CLI_TARGET_NOT_FOUND`: Target path not found (scope/impact)
- `E_CLI_INTERNAL`: Unexpected internal error

**Rationale**: Structured error codes enable:
- JSON output consistency (`{ success: false, error: { code, message } }`)
- Programmatic error handling by downstream tools
- Clear documentation of error types

### Decision 3: Path format hint injection

**Choice**: Add path format hint in scope/impact command handlers when target not found.

**Message format**:
```
Target not found: <user-path>
Hint: Use full path format: packages/<pkg>/src/<file>.ts
Available targets: --list-targets flag not yet implemented (planned for future)
```

**Rationale**: Users often try relative paths like `src/analyzer/index.ts` when the actual path is `packages/codegraph/src/analyzer/index.ts`. A simple hint reduces confusion.

### Decision 4: Error output routing

**Choice**: Route errors to stderr in text mode, include in JSON structure in JSON mode.

**Text mode**: Friendly message to stderr
**JSON mode**: Structured error object to stdout (matching existing pattern)

**Rationale**: Maintains consistency with existing cli-output-routing spec.

## Risks / Trade-offs

**Risk**: CACError message format changes in future CAC versions
→ Mitigation: Extract key information via regex patterns, not strict string matching

**Risk**: Over-transformation hides useful debugging information
→ Mitigation: Include original error message in JSON mode for debugging

**Risk**: Path hints become outdated if project structure changes
→ Mitigation: Hints are generic (explain format, not specific paths)