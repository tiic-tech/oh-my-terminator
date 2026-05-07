## 1. Setup

- [ ] 1.1 Create error codes module at `src/cli/error-codes.ts`
- [ ] 1.2 Define CliError interface with code, message, suggestion fields

## 2. Error Transformer

- [ ] 2.1 Create error transformer module at `src/cli/error-transformer.ts`
- [ ] 2.2 Implement `transformCACError()` function for CACError classification
- [ ] 2.3 Implement command suggestion extraction for unknown command errors
- [ ] 2.4 Implement flag suggestion extraction for invalid flag errors
- [ ] 2.5 Implement missing argument detection and usage hint generation

## 3. CLI Entry Point Integration

- [ ] 3.1 Add error catch handler in `bin/codegraph.ts` at CLI entry point
- [ ] 3.2 Integrate error transformer with entry point error handler
- [ ] 3.3 Route transformed errors to stderr in text mode
- [ ] 3.4 Route structured JSON errors to stdout in JSON mode

## 4. Path Format Hints

- [ ] 4.1 Add path format hint to scope command error output
- [ ] 4.2 Add path format hint to impact command error output
- [ ] 4.3 Implement path format detection (monorepo vs standard)
- [ ] 4.4 Add suggestion field to scope/impact JSON error structure

## 5. Testing

- [ ] 5.1 Add unit tests for `transformCACError()` function
- [ ] 5.2 Add unit tests for error code classification
- [ ] 5.3 Add E2E test for unknown command error scenario
- [ ] 5.4 Add E2E test for invalid flag error scenario
- [ ] 5.5 Add E2E test for missing argument error scenario
- [ ] 5.6 Add E2E test for path format hint display

## 6. Verification

- [ ] 6.1 Run all tests and verify 80%+ coverage
- [ ] 6.2 Verify no raw stack traces displayed in text mode
- [ ] 6.3 Verify JSON output structure matches spec
- [ ] 6.4 Run E2E Round4 validation to confirm P1 fixes