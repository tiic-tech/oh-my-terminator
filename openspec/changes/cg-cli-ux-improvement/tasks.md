## 1. Setup

- [x] 1.1 Create error codes module at `src/cli/error-codes.ts`
- [x] 1.2 Define CliError interface with code, message, suggestion fields

## 2. Error Transformer

- [x] 2.1 Create error transformer module at `src/cli/error-transformer.ts`
- [x] 2.2 Implement `transformCACError()` function for CACError classification
  - **Pre-requisite**: Define CACError regex patterns (see design.md Decision 2)
  - Patterns: UNKNOWN_COMMAND, UNKNOWN_OPTION, MISSING_ARG
- [x] 2.3 Implement command suggestion extraction for unknown command errors
  - Use `cli.commands` map, filter built-in, sort alphabetically
- [x] 2.4 Implement flag suggestion extraction for invalid flag errors
  - Use `command.options` array, flags are **command-specific**
- [x] 2.5 Implement missing argument detection and usage hint generation

## 3. CLI Entry Point Integration

- [x] 3.1 Add error catch handler in `bin/codegraph.ts` at CLI entry point
- [x] 3.2 Integrate error transformer with entry point error handler
- [x] 3.3 Route transformed errors to stderr in text mode
- [x] 3.4 Route structured JSON errors to stdout in JSON mode
  - **Detection**: `process.argv.includes('--json')` before error handling
  - **Structure**: Include `durationMs` (total execution time) and `error.debug` (original error)

## 4. Path Format Hints

- [x] 4.1 Add path format hint to scope command error output
- [x] 4.2 Add path format hint to impact command error output
- [x] 4.3 Implement path format detection (monorepo vs standard)
  - **Monorepo detection**: Check `packages/` directory exists at project root
  - **Valid path regex**: `^packages/[a-z-]+/src/.+\.ts$` → suppress hint if matched
- [x] 4.4 Add suggestion field to scope/impact JSON error structure

## 5. Testing

- [x] 5.1 Add unit tests for `transformCACError()` function
- [x] 5.2 Add unit tests for error code classification
- [ ] 5.3 Add E2E test for unknown command error scenario
- [ ] 5.4 Add E2E test for invalid flag error scenario
- [ ] 5.5 Add E2E test for missing argument error scenario
- [ ] 5.6 Add E2E test for path format hint display
  - **Scenario 1**: Wrong path format (`src/analyzer.ts`) → hint shown
  - **Scenario 2**: Correct format but file missing (`packages/codegraph/src/missing.ts`) → no hint

## 6. Verification

- [ ] 6.1 Run all tests and verify 80%+ coverage
- [x] 6.2 Verify no raw stack traces displayed in text mode
- [x] 6.3 Verify JSON output structure matches spec
- [ ] 6.4 Run E2E Round4 validation to confirm P1 fixes