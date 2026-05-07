## Why

CLI `--json` mode currently outputs all content to stdout, including warnings and error messages. This violates Unix conventions where stdout should contain program output and stderr should contain diagnostic/progress messages. Users piping JSON output to other tools receive corrupted JSON due to mixed content streams.

## What Changes

- **CLI command layer** will route output to appropriate streams based on mode:
  - `--json` mode: JSON results → stdout, warnings/errors → stderr
  - Default mode: All output → stdout, progress/warnings → stderr
- **json-formatter.ts** will return structured output objects instead of writing directly
- Commands will handle stream routing at the CLI layer, not in formatter utilities

## Capabilities

### New Capabilities
- `cli-output-routing`: Defines how CLI commands route output to stdout/stderr based on output mode (json vs default)

### Modified Capabilities
- None - this is a new capability layer, not a modification to existing specs

## Impact

- **Affected files**: `cli/commands/*.ts`, `cli/output/json-formatter.ts`, `cli/output/text-formatter.ts`
- **API impact**: Internal only - no public API changes
- **E2E tests**: Tests will need to remove `silent` mode workaround and verify proper stream separation
- **Downstream**: Users can safely pipe `--json` output to jq, other CLI tools