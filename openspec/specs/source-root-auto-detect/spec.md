## ADDED Requirements

### Requirement: Auto-detect source root from project markers

The system SHALL automatically detect the project source root when `--source-root` is not provided by searching upward from the current working directory for recognized project marker files.

#### Scenario: Node.js project detection
- **WHEN** user runs a CLI command without `--source-root` from a subdirectory of a Node.js project containing package.json at the root
- **THEN** system detects the directory containing package.json as the source root

#### Scenario: Python project detection
- **WHEN** user runs a CLI command without `--source-root` from a subdirectory of a Python project containing pyproject.toml at the root
- **THEN** system detects the directory containing pyproject.toml as the source root

#### Scenario: Rust project detection
- **WHEN** user runs a CLI command without `--source-root` from a subdirectory of a Rust project containing Cargo.toml at the root
- **THEN** system detects the directory containing Cargo.toml as the source root

#### Scenario: Go project detection
- **WHEN** user runs a CLI command without `--source-root` from a subdirectory of a Go project containing go.mod at the root
- **THEN** system detects the directory containing go.mod as the source root

### Requirement: Fallback to git directory detection

The system SHALL detect the directory containing `.git` as the source root when no language-specific markers are found.

#### Scenario: Generic project with git
- **WHEN** user runs a CLI command without `--source-root` from a project without language markers but containing a .git directory
- **THEN** system detects the directory containing .git as the source root

### Requirement: Allow explicit source root override

The system SHALL use the explicitly provided `--source-root` argument when present, bypassing auto-detection entirely.

#### Scenario: Explicit override takes precedence
- **WHEN** user provides `--source-root /custom/path` argument
- **THEN** system uses `/custom/path` as the source root regardless of detected markers

### Requirement: Allow disabling auto-detection

The system SHALL provide a `--no-auto-detect` flag to disable automatic detection and require explicit `--source-root`.

#### Scenario: Disabled auto-detection requires explicit root
- **WHEN** user provides `--no-auto-detect` without `--source-root`
- **THEN** system fails with error requiring `--source-root` argument

#### Scenario: Disabled auto-detection with explicit root works
- **WHEN** user provides both `--no-auto-detect` and `--source-root /path`
- **THEN** system uses `/path` as source root without attempting detection

### Requirement: Clear error when detection fails

The system SHALL fail with a clear error message when auto-detection cannot find any recognized markers.

#### Scenario: No markers found
- **WHEN** user runs a CLI command without `--source-root` from a directory with no recognized project markers in any parent directory
- **THEN** system fails with error message suggesting to use `--source-root` argument

### Requirement: Detection stops on first marker found

The system SHALL stop searching upward immediately upon finding the first recognized project marker.

#### Scenario: Nested project detection
- **WHEN** user runs CLI from a nested subproject that has its own marker file while parent directory also has markers
- **THEN** system detects the nearest marker directory as source root (closest to cwd)

#### Scenario: Multiple markers at same level
- **WHEN** directory contains both package.json and pyproject.toml
- **THEN** system selects alphabetically first marker (package.json)

#### Scenario: Symlinked directory
- **WHEN** CWD is symlink pointing to /actual/project
- **THEN** system resolves symlink and searches from /actual/project upward

#### Scenario: Filesystem root reached
- **WHEN** no marker found within 10 levels or reaching /
- **THEN** system throws error with suggestion message

**Error Message Template:**
```
"No project root markers found in {startPath} or any parent directory (searched {levels} levels). Use --source-root to specify the source root."
```