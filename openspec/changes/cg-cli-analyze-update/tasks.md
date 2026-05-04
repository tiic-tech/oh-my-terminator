## 1. Dependencies & Setup

- [ ] 1.1 Add `cac` to package.json dependencies
- [ ] 1.2 Add `isomorphic-git` to package.json dependencies
- [ ] 1.3 Add `"bin": {"codegraph": "./dist/bin/codegraph.js"}` to package.json
- [ ] 1.4 Create `bin/` directory structure
- [ ] 1.5 Create `src/cli/` directory structure
- [ ] 1.6 Create `src/cli/output/` directory structure

## 2. CLI Types Definition

- [ ] 2.1 Define `AnalyzeResult` interface in types.ts
- [ ] 2.2 Define `UpdateResult` interface in types.ts
- [ ] 2.3 Define `CliResultStats` interface in types.ts
- [ ] 2.4 Define `CliError` interface in types.ts
- [ ] 2.5 Define `FileChange` interface in types.ts
- [ ] 2.6 Write unit tests for CLI type validation

## 3. Git Integration Module

- [ ] 3.1 Create `src/git/change-detector.ts` file
- [ ] 3.2 Implement `detectGitChanges(cwd)` function
- [ ] 3.3 Implement `getFileChangesBetweenCommits()` helper
- [ ] 3.4 Create `src/git/head-commit.ts` file
- [ ] 3.5 Implement `getHeadCommit(cwd)` function
- [ ] 3.6 Create `src/git/index.ts` to export git functions
- [ ] 3.7 Update `src/git/fs-adapter.ts` with additional methods as needed
- [ ] 3.8 Write unit tests for `detectGitChanges()`
- [ ] 3.9 Write unit tests for `getHeadCommit()`
- [ ] 3.10 Implement `getFileChangesByWalkingCommits()` fallback for walk API failures
- [ ] 3.11 Define `isSupportedFile(filePath: string): boolean` function with extension list
- [ ] 3.12 Define `CliErrorCode` enum in types.ts (E_NO_GIT_REPO, E_BASELINE_NOT_FOUND, etc.)

## 4. CLI Output Formatters

- [ ] 4.1 Create `src/cli/output/json-formatter.ts` file
- [ ] 4.2 Implement `formatAnalyzeJson()` function
- [ ] 4.3 Implement `formatUpdateJson()` function
- [ ] 4.4 Implement `formatErrorJson()` function
- [ ] 4.5 Create `src/cli/output/text-formatter.ts` file
- [ ] 4.6 Implement `formatAnalyzeText()` function
- [ ] 4.7 Implement `formatUpdateText()` function
- [ ] 4.8 Implement `formatErrorText()` function
- [ ] 4.9 Create `src/cli/output/index.ts` to export formatters
- [ ] 4.10 Write unit tests for JSON formatter
- [ ] 4.11 Write unit tests for text formatter

## 5. CLI Commands

- [ ] 5.1 Create `src/cli/commands/analyze.ts` file
- [ ] 5.2 Implement `analyzeCommand(cwd, options)` function
- [ ] 5.3 Integrate with `analyzeFull()` from analyzer.ts
- [ ] 5.4 Integrate with `saveBaseline()` from persistence
- [ ] 5.5 Save HEAD commit to `lastCommit.txt`
- [ ] 5.6 Handle error cases (no git repo, parse failures)
- [ ] 5.7 Create `src/cli/commands/update.ts` file
- [ ] 5.8 Implement `updateCommand(cwd, options)` function
- [ ] 5.9 Integrate with `detectGitChanges()`
- [ ] 5.10 Integrate with `loadBaseline()` and `saveBaseline()`
- [ ] 5.11 Remove FILE node and MODULE sub-nodes for changed/deleted files
- [ ] 5.12 Implement `removeFileFromGraph()` helper function
- [ ] 5.13 Clear edges via `removeEdgesForFile()` for changed files
- [ ] 5.14 Re-parse ADD/MODIFY files
- [ ] 5.15 Update `lastCommit.txt` after update
- [ ] 5.16 Handle error cases (no baseline, no changes)
- [ ] 5.17 Implement git repository validation with E_NO_GIT_REPO error
- [ ] 5.18 Create `src/cli/commands/index.ts` to export commands
- [ ] 5.19 Write unit tests for analyze command
- [ ] 5.20 Write unit tests for update command

## 6. CLI Entry Point

- [ ] 6.1 Create `bin/codegraph.ts` entry point
- [ ] 6.2 Initialize `cac` CLI framework
- [ ] 6.3 Register `analyze` command with cac
- [ ] 6.4 Register `update` command with cac
- [ ] 6.5 Add `--json` global option
- [ ] 6.6 Add help text for commands
- [ ] 6.7 Handle global error catching
- [ ] 6.8 Ensure proper ESM module resolution
- [ ] 6.9 Write smoke test for CLI entry point

## 7. Integration Tests

- [ ] 7.1 Create test fixture: sample git repository
- [ ] 7.2 Create test fixture: baseline.json sample
- [ ] 7.3 Create test fixture: lastCommit.txt sample
- [ ] 7.4 Write integration test: analyze command full flow
- [ ] 7.5 Write integration test: update command with ADD changes
- [ ] 7.6 Write integration test: update command with MODIFY changes
- [ ] 7.7 Write integration test: update command with DELETE changes
- [ ] 7.8 Write integration test: update command no changes
- [ ] 7.9 Write integration test: --json flag output format
- [ ] 7.10 Write integration test: error output JSON format
- [ ] 7.11 Run full test suite and verify coverage ≥80%

## 8. Documentation & Finalization

- [ ] 8.1 Update package.json version if needed
- [ ] 8.2 Add CLI usage examples to README
- [ ] 8.3 Verify all tests pass: `pnpm test`
- [ ] 8.4 Run TypeScript type check: `pnpm build`
- [ ] 8.5 Create archive.md when complete