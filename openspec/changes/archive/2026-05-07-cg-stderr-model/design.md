## Context

CLI commands currently output all content to stdout, including warnings and diagnostic messages. The `json-formatter.ts` contains a comment "caller handles stderr" but no actual separation logic exists. E2E tests use a `silent` mode workaround to suppress warnings during JSON output verification.

Unix conventions:
- stdout: Program output (what user asked for)
- stderr: Diagnostics, progress, errors (what happened during execution)

Current issue: `--json` output gets corrupted when warnings are mixed with JSON payload, breaking piping to tools like `jq`.

## Goals / Non-Goals

**Goals:**
- Implement proper stdout/stderr separation at CLI command layer
- Enable safe piping of `--json` output to downstream tools
- Remove E2E test `silent` mode workaround
- Maintain backward compatibility for text output mode

**Non-Goals:**
- Changing JSON output schema (structure unchanged)
- Modifying core analysis/update logic (only output routing affected)
- Adding new output formats beyond JSON and text

## Decisions

### Decision 1: CLI Command Layer Routing (not formatter layer)
**Choice**: Stream routing happens in CLI commands, not in formatters.
**Rationale**: Formatters should produce content; commands decide where it goes. This separation of concerns allows:
- Same formatter can be used in different contexts
- Commands can make context-aware routing decisions
- Easier testing (formatters return objects, not write streams)

**Alternatives considered**:
- Formatter writes to streams directly: Violates separation of concerns, harder to test
- Global output manager: Adds complexity, unclear ownership

### Decision 2: Output Object Pattern
**Choice**: Formatters return structured `OutputResult` objects, commands write to streams.
**Rationale**: Enables:
- Commands to inspect output before writing
- Multiple outputs to be combined/routed
- Clean separation between generation and delivery

```typescript
/**
 * Output result structure returned by formatters
 * 
 * Fields:
 * - primary: string (required) - Main output content for stdout
 * - warnings: string[] (optional) - Diagnostic messages for stderr; omitted if empty
 * - errors: string[] (optional) - Error messages for stderr; omitted if empty
 * - metadata: object (optional) - Execution metadata
 * 
 * Null handling:
 * - primary MUST be non-null string (required field)
 * - warnings/errors MAY be undefined (optional fields) or empty array
 * - Empty arrays are semantically equivalent to undefined
 */
interface OutputResult {
  /** Main output content, written to stdout. Always present. */
  primary: string;
  
  /** Warning messages for stderr. Empty array or undefined when no warnings. */
  warnings?: string[];
  
  /** Error messages for stderr. Empty array or undefined when no errors. */
  errors?: string[];
  
  /** Optional execution metadata */
  metadata?: {
    /** Execution duration in milliseconds */
    durationMs?: number;
    /** Command name for logging */
    command?: string;
    /** Additional context-specific data */
    [key: string]: unknown;
  };
}

/**
 * Output mode enum defining routing behavior
 */
enum OutputMode {
  /** JSON mode: JSON output to stdout, warnings/errors to stderr */
  JSON = 'json',
  /** Text mode: Formatted text to stdout, progress to stderr */
  TEXT = 'text',
  /** Silent mode: Only errors to stderr, no stdout output */
  SILENT = 'silent'
}
```

### Decision 3: Command Pattern Implementation
**Choice**: Each CLI command implements routing logic directly.
**Rationale**: Simpler than abstracting routing logic, each command has different output patterns.

**Alternatives considered**:
- Central routing utility: Over-engineering for current scope
- Output writer abstraction: Adds indirection without clear benefit

### Decision 4: OutputRouter Implementation
**Choice**: Central `OutputRouter` utility handles stream routing based on `OutputMode`.
**Rationale**: Provides reusable routing logic while keeping commands simple.

**Implementation**:
```typescript
// cli/output/router.ts

/**
 * Routes OutputResult to appropriate streams based on OutputMode
 * 
 * Behavior:
 * - JSON mode: primary → stdout (pure JSON), warnings/errors → stderr
 * - TEXT mode: primary → stdout (formatted text), warnings/errors → stderr
 * - SILENT mode: errors → stderr only
 */
function routeOutput(result: OutputResult, mode: OutputMode): void {
  // Validate required field
  if (result.primary == null || result.primary === undefined) {
    throw new Error('OutputResult.primary is required and cannot be null');
  }
  
  // stdout: primary content (JSON or formatted text)
  if (result.primary) {
    process.stdout.write(result.primary);
  }
  
  // stderr: warnings + errors (joined with newline)
  const stderrContent = [
    ...(result.warnings || []),
    ...(result.errors || [])
  ].join('\n');
  
  if (stderrContent) {
    process.stderr.write(stderrContent + '\n');
  }
}

/**
 * Detects OutputMode from command options
 */
function detectMode(options: { json?: boolean; silent?: boolean }): OutputMode {
  if (options.json) return OutputMode.JSON;
  if (options.silent) return OutputMode.SILENT;
  return OutputMode.TEXT;
}
```

**Alternatives considered**:
- Commands implement routing directly: Duplicate logic across commands
- Formatter handles routing: Violates separation of concerns

## Risks / Trade-offs

### Risk: Commands forget to route warnings
**Mitigation**: Add test assertions checking stderr isolation in --json mode

### Risk: Breaking existing text output behavior
**Mitigation**: Text mode keeps current behavior (all to stdout except progress), add comparison tests

### Trade-off: More code in commands vs centralization
**Acceptance**: Current scope is small; centralize if pattern repeats across 5+ commands

## Migration Plan

1. Define `OutputResult` interface in output module
2. Update formatters to return `OutputResult` instead of writing
3. Update each CLI command to route output based on mode
4. Remove `silent` flag from E2E tests, add stderr assertions
5. Verify piping `--json` output works with `jq`