## 1. Interface Setup

- [x] 1.1 Define `OutputResult` interface in `cli/output/types.ts` with `primary`, `warnings`, and `errors` fields
- [x] 1.2 Add stream routing helper function `routeOutput(output: OutputResult, mode: OutputMode)` in `cli/output/router.ts`

## 2. Formatter Updates

- [x] 2.1 Update `json-formatter.ts` to return `OutputResult` instead of writing to stream
- [x] 2.2 Update `text-formatter.ts` to return `OutputResult` instead of writing to stream
- [x] 2.3 Add unit tests for both formatters returning `OutputResult` objects

## 3. Command Layer Updates

- [x] 3.1 Update `analyze.ts` command to use `routeOutput()` with mode detection
- [x] 3.2 Update `update.ts` command to use `routeOutput()` with mode detection
- [x] 3.3 Update `scope.ts` command to use `routeOutput()` with mode detection (query command)
- [x] 3.4 Update `impact.ts` command to use `routeOutput()` with mode detection (query command)
- [x] 3.5 Update `layers.ts` command to use `routeOutput()` with mode detection (query command)
- [x] 3.6 Update `migrate.ts` command to use `routeOutput()` with mode detection

## 4. E2E Test Cleanup

- [x] 4.1 Remove `silent` mode workaround from E2E tests for `analyze --json`
- [x] 4.2 Add stderr assertions to verify clean JSON in stdout
- [x] 4.3 Add test case for piping `--json` output to `jq`

## 5. Verification

- [x] 5.1 Run full test suite to verify no regressions
- [x] 5.2 Manual test: `codegraph analyze --json | jq '.success'` works correctly
- [x] 5.3 Manual test: text mode output unchanged from previous behavior