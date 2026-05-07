## Why

CLI error handling produces unfriendly output that blocks release readiness. E2E Round3 testing identified three P1 UX issues: invalid commands show empty output, invalid flags display raw CACError stack traces, and missing required arguments show Node.js stack traces. These issues create confusion for non-expert users and prevent clean error recovery.

## What Changes

- Add CACError wrapper at CLI entry point to transform raw errors into friendly messages
- Add error code classification system for consistent error identification
- Add path format guidance in scope/impact commands when target not found
- Add command suggestions when unknown command is entered
- Add flag suggestions when unknown flag is used

## Capabilities

### New Capabilities

- `cli-error-handling`: Friendly error message formatting for CLI commands including unknown command detection, invalid flag handling, missing argument guidance, and CACError transformation

### Modified Capabilities

- `scope-query`: Add path format hint when target not found
- `impact-analysis`: Add path format hint when target not found

## Impact

- **Affected code**:
  - `packages/codegraph/bin/codegraph.ts` - CLI entry point error handling
  - `packages/codegraph/src/cli/commands/scope.ts` - Path format hint
  - `packages/codegraph/src/cli/commands/impact.ts` - Path format hint
- **New files**:
  - `packages/codegraph/src/cli/error-transformer.ts` - CACError to friendly message transformation
  - `packages/codegraph/src/cli/error-codes.ts` - Error code definitions
- **Dependencies**: CAC library (already used), no new external dependencies
- **Testing**: Unit tests for error transformer, E2E tests for error scenarios