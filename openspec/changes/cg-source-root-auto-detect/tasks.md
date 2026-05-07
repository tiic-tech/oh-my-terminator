## 1. Setup

- [x] 1.1 Create SourceRootDetector module in packages/codegraph/src/core/
- [x] 1.2 Define PROJECT_MARKERS constant with language-specific markers and priorities
- [x] 1.3 Define SourceRootDetector interface/types

## 2. Core Detection Logic

- [x] 2.1 Implement upward directory search algorithm (max depth: 10)
- [x] 2.2 Implement marker file detection for Node.js (package.json, package-lock.json, yarn.lock, pnpm-lock.yaml)
- [x] 2.3 Implement marker file detection for Python (pyproject.toml, setup.py, requirements.txt, Pipfile)
- [x] 2.4 Implement marker file detection for Rust (Cargo.toml, Cargo.lock)
- [x] 2.5 Implement marker file detection for Go (go.mod, go.sum)
- [x] 2.6 Implement .git directory fallback detection
- [x] 2.7 Implement symlink resolution during search
- [x] 2.8 Implement detection priority logic (language markers > .git)

## 3. CLI Integration

- [x] 3.1 Add --no-auto-detect flag to CLI global options
- [x] 3.2 Integrate SourceRootDetector into analyze command
- [x] 3.3 Integrate SourceRootDetector into query command
- [x] 3.4 Update CLI argument handling: explicit --source-root takes precedence
- [x] 3.5 Handle --no-auto-detect flag to require explicit --source-root

## 4. Error Handling

- [x] 4.1 Implement clear error message when detection fails (suggest --source-root)
- [x] 4.2 Implement error message for --no-auto-detect without --source-root

## 5. Testing

- [x] 5.1 Write unit tests for upward search algorithm
- [x] 5.2 Write unit tests for marker detection per project type
- [x] 5.3 Write unit tests for .git fallback
- [x] 5.4 Write unit tests for detection priority
- [x] 5.5 Write unit tests for error scenarios
- [x] 5.6 Write integration tests for CLI commands with auto-detection
- [x] 5.7 Write E2E tests for Node.js project detection scenario
- [x] 5.8 Write E2E tests for Python project detection scenario
- [x] 5.9 Write E2E tests for nested project detection scenario
- [x] 5.10 Verify 80%+ test coverage