## 1. Setup

- [ ] 1.1 Create SourceRootDetector module in packages/codegraph/src/core/
- [ ] 1.2 Define PROJECT_MARKERS constant with language-specific markers and priorities
- [ ] 1.3 Define SourceRootDetector interface/types

## 2. Core Detection Logic

- [ ] 2.1 Implement upward directory search algorithm (max depth: 10)
- [ ] 2.2 Implement marker file detection for Node.js (package.json, package-lock.json, yarn.lock, pnpm-lock.yaml)
- [ ] 2.3 Implement marker file detection for Python (pyproject.toml, setup.py, requirements.txt, Pipfile)
- [ ] 2.4 Implement marker file detection for Rust (Cargo.toml, Cargo.lock)
- [ ] 2.5 Implement marker file detection for Go (go.mod, go.sum)
- [ ] 2.6 Implement .git directory fallback detection
- [ ] 2.7 Implement symlink resolution during search
- [ ] 2.8 Implement detection priority logic (language markers > .git)

## 3. CLI Integration

- [ ] 3.1 Add --no-auto-detect flag to CLI global options
- [ ] 3.2 Integrate SourceRootDetector into analyze command
- [ ] 3.3 Integrate SourceRootDetector into query command
- [ ] 3.4 Update CLI argument handling: explicit --source-root takes precedence
- [ ] 3.5 Handle --no-auto-detect flag to require explicit --source-root

## 4. Error Handling

- [ ] 4.1 Implement clear error message when detection fails (suggest --source-root)
- [ ] 4.2 Implement error message for --no-auto-detect without --source-root

## 5. Testing

- [ ] 5.1 Write unit tests for upward search algorithm
- [ ] 5.2 Write unit tests for marker detection per project type
- [ ] 5.3 Write unit tests for .git fallback
- [ ] 5.4 Write unit tests for detection priority
- [ ] 5.5 Write unit tests for error scenarios
- [ ] 5.6 Write integration tests for CLI commands with auto-detection
- [ ] 5.7 Write E2E tests for Node.js project detection scenario
- [ ] 5.8 Write E2E tests for Python project detection scenario
- [ ] 5.9 Write E2E tests for nested project detection scenario
- [ ] 5.10 Verify 80%+ test coverage