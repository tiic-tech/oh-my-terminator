## Why

Users currently must manually specify the source root (`--source-root`) when using codegraph CLI commands. This is cumbersome, error-prone, and creates friction in everyday usage. Most projects have recognizable patterns (package.json, pyproject.toml, Cargo.toml, go.mod) that indicate the source root. Auto-detection reduces cognitive load and makes the CLI more intuitive.

## What Changes

- Add automatic source root detection when `--source-root` is not provided
- Search upward from current directory for project root markers
- Support multiple project types: Node.js, Python, Rust, Go, and generic file-system patterns
- Allow explicit override via `--source-root` flag (existing behavior preserved)
- Add `--no-auto-detect` flag to disable auto-detection when needed

## Capabilities

### New Capabilities

- `source-root-auto-detect`: Automatic detection of project source root based on common project markers and directory structure analysis

### Modified Capabilities

- None - this is additive functionality that preserves existing behavior

## Impact

- CLI commands that accept `--source-root` (analyze, query, scope, impact)
- Core package: SourceRootDetector module
- User experience: Reduced friction, fewer required arguments