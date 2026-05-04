## Why

Users need a command-line interface to run CodeGraph analysis and track code structure changes over time. The `analyze` command provides full repository analysis, while `update` enables incremental updates based on git history. This is essential for Agent-Friendly workflows where AI tools need structured code context.

Without CLI commands, users must call the library API programmatically, which limits adoption and integration with CI/CD pipelines and AI assistants.

## What Changes

- **New CLI entry point**: `bin/codegraph.ts` using `cac` framework
- **analyze command**: Runs `analyzeFull()` and saves baseline to `.codegraph/`
- **update command**: Detects git changes via isomorphic-git, removes stale nodes, re-parses changed files
- **JSON output**: All commands support `--json` flag for Agent-Friendly consumption
- **Text output**: Human-readable default output with stats, warnings, next steps
- **Git integration**: `detectGitChanges()` and `getHeadCommit()` functions using isomorphic-git

## Capabilities

### New Capabilities

- `cli-analyze`: Full analysis command implementation
- `cli-update`: Incremental update command implementation  
- `cli-output`: JSON and text output formatters
- `git-integration`: Git change detection using isomorphic-git

### Modified Capabilities

(None - this is new functionality)

## Impact

**New files**:
- `bin/codegraph.ts` - CLI entry point
- `src/cli/commands/analyze.ts` - analyze command
- `src/cli/commands/update.ts` - update command
- `src/cli/output/json-formatter.ts` - JSON output
- `src/cli/output/text-formatter.ts` - Text output
- `src/git/change-detector.ts` - detectGitChanges function
- `src/git/head-commit.ts` - getHeadCommit function

**Dependencies**:
- `cac` - CLI framework (to be added)
- `isomorphic-git` - Git operations (to be added)

**Phase 0 completed**: Graph modification methods (`removeNode`, `removeEdge`, `removeEdgesForFile`) and fs adapter for isomorphic-git are already implemented.

**Constraints**:
- MVP scope: File-level delta only, no cascade update (deferred to M2/C14)
- Error output to stdout as JSON when `--json` flag is set
- Baseline stored in `.codegraph/baseline.json` with `lastCommit.txt`