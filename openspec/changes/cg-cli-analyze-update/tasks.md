## 1. Dependencies & Setup

- [x] 1.1 Add `cac` to package.json dependencies
- [x] 1.2 Add `isomorphic-git` to package.json dependencies
- [x] 1.3 Add `"bin": {"codegraph": "./dist/bin/codegraph.js"}` to package.json
- [x] 1.4 Create `bin/` directory structure
- [x] 1.5 Create `src/cli/` directory structure
- [x] 1.6 Create `src/cli/output/` directory structure

## 2. CLI Types Definition

- [x] 2.1 Define `AnalyzeResult` interface in types.ts
- [x] 2.2 Define `UpdateResult` interface in types.ts
- [x] 2.3 Define `CliResultStats` interface in types.ts
- [x] 2.4 Define `CliError` interface in types.ts
- [x] 2.5 Define `FileChange` interface in types.ts
- [x] 2.6 Write unit tests for CLI type validation

## 3. Git Integration Module

- [x] 3.1 Create `src/git/change-detector.ts` file
- [x] 3.2 Implement `detectGitChanges(cwd)` function
- [x] 3.3 Implement `getFileChangesBetweenCommits()` helper
- [x] 3.4 Create `src/git/head-commit.ts` file
- [x] 3.5 Implement `getHeadCommit(cwd)` function
- [x] 3.6 Create `src/git/index.ts` to export git functions
- [x] 3.7 Update `src/git/fs-adapter.ts` with additional methods as needed
- [ ] 3.8 Write unit tests for `detectGitChanges()`
- [ ] 3.9 Write unit tests for `getHeadCommit()`
- [x] 3.10 Implement `getFileChangesByWalkingCommits()` fallback for walk API failures
- [x] 3.11 Define `isSupportedFile(filePath: string): boolean` function with extension list
- [x] 3.12 Define `CliErrorCode` enum in types.ts (E_NO_GIT_REPO, E_BASELINE_NOT_FOUND, etc.)

## 4. CLI Output Formatters

- [x] 4.1 Create `src/cli/output/json-formatter.ts` file
- [x] 4.2 Implement `formatAnalyzeJson()` function
- [x] 4.3 Implement `formatUpdateJson()` function
- [x] 4.4 Implement `formatErrorJson()` function
- [x] 4.5 Create `src/cli/output/text-formatter.ts` file
- [x] 4.6 Implement `formatAnalyzeText()` function
- [x] 4.7 Implement `formatUpdateText()` function
- [x] 4.8 Implement `formatErrorText()` function
- [x] 4.9 Create `src/cli/output/index.ts` to export formatters
- [ ] 4.10 Write unit tests for JSON formatter
- [ ] 4.11 Write unit tests for text formatter

## 5. CLI Commands

- [x] 5.1 Create `src/cli/commands/analyze.ts` file
- [x] 5.2 Implement `analyzeCommand(cwd, options)` function
- [x] 5.3 Integrate with `analyzeFull()` from analyzer.ts
- [x] 5.4 Integrate with `saveBaseline()` from persistence
- [x] 5.5 Save HEAD commit to `lastCommit.txt`
- [x] 5.6 Handle error cases (no git repo, parse failures)
- [x] 5.7 Create `src/cli/commands/update.ts` file
- [x] 5.8 Implement `updateCommand(cwd, options)` function
- [x] 5.9 Integrate with `detectGitChanges()`
- [x] 5.10 Integrate with `loadBaseline()` and `saveBaseline()`
- [x] 5.11 Remove FILE node and MODULE sub-nodes for changed/deleted files
- [x] 5.12 Implement `removeFileFromGraph()` helper function
- [x] 5.13 Clear edges via `removeEdgesForFile()` for changed files
- [x] 5.14 Re-parse ADD/MODIFY files
- [x] 5.15 Update `lastCommit.txt` after update
- [x] 5.16 Handle error cases (no baseline, no changes)
- [x] 5.17 Implement git repository validation with E_NO_GIT_REPO error
- [x] 5.18 Create `src/cli/commands/index.ts` to export commands
- [ ] 5.19 Write unit tests for analyze command
- [ ] 5.20 Write unit tests for update command

## 6. CLI Entry Point

- [x] 6.1 Create `bin/codegraph.ts` entry point
- [x] 6.2 Initialize `cac` CLI framework
- [x] 6.3 Register `analyze` command with cac
- [x] 6.4 Register `update` command with cac
- [x] 6.5 Add `--json` global option
- [x] 6.6 Add help text for commands
- [x] 6.7 Handle global error catching
- [x] 6.8 Ensure proper ESM module resolution
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