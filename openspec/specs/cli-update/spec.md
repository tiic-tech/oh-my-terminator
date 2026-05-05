# cli-update Specification

## Purpose
Defines the CLI update command that performs incremental updates based on git changes.

## Requirements

### Requirement: CLI update command execution
The system SHALL provide a `codegraph update` command that performs incremental update based on git changes.

#### Scenario: Successful incremental update
- **WHEN** user runs `codegraph update` after baseline exists and git has new commits
- **THEN** system detects changed files, removes stale nodes, re-parses changed files, updates baseline

#### Scenario: No changes detected
- **WHEN** user runs `codegraph update` and HEAD equals lastCommit
- **THEN** system outputs "No changes detected" with `hasChanges: false`

#### Scenario: Missing baseline error
- **WHEN** user runs `codegraph update` without prior analyze
- **THEN** system outputs error "No baseline found. Run 'codegraph analyze' first."

### Requirement: CLI update file change detection
The system SHALL detect ADD, MODIFY, DELETE file changes between commits.

#### Scenario: Detect added files
- **WHEN** new files are added since lastCommit
- **THEN** system includes them in changes.added array and parses them

#### Scenario: Detect modified files
- **WHEN** existing files are modified since lastCommit
- **THEN** system includes them in changes.modified array, removes old nodes, re-parses

#### Scenario: Detect deleted files
- **WHEN** files are deleted since lastCommit
- **THEN** system includes them in changes.removed array and removes their nodes/edges

### Requirement: CLI update JSON output
The system SHALL support `--json` flag for structured update output.

#### Scenario: JSON output format
- **WHEN** user runs `codegraph update --json`
- **THEN** system outputs JSON with `success`, `changes`, `delta`, `durationMs`, `warnings` fields

#### Scenario: JSON with change details
- **WHEN** update detects changes
- **THEN** JSON output includes `changes: { added: [], removed: [], modified: [] }` and `delta: { newNodes, removedNodes }`

### Requirement: CLI update git validation
The system SHALL validate git repository before performing update.

#### Scenario: Non-git directory error
- **WHEN** user runs `codegraph update` in a directory without git repository
- **THEN** system outputs error with code `E_NO_GIT_REPO` and message "Not a git repository"

#### Scenario: Git repo validation
- **WHEN** update command starts
- **THEN** system first validates `.git` directory exists
- **AND** throws error if validation fails

#### Scenario: Git error in JSON mode
- **WHEN** git validation fails and `--json` flag is set
- **THEN** JSON output includes `{ success: false, error: { code: 'E_NO_GIT_REPO', message: '...' } }`

### Requirement: CLI update compression options
The system SHALL provide clear compression flag options without contradictory descriptions.

#### Scenario: Default compression behavior
- **WHEN** user runs `codegraph update` without compression flags
- **THEN** updated baseline is saved in compressed 1.1 format by default

#### Scenario: Explicit compress flag
- **WHEN** user runs `codegraph update --compress`
- **THEN** baseline is saved in compressed 1.1 format
- **AND** help shows "Enable compression (default behavior)" without default annotation

#### Scenario: No-compression flag
- **WHEN** user runs `codegraph update --no-compression`
- **THEN** baseline is saved in uncompressed 1.0 format
- **AND** help shows "Save as uncompressed 1.0 format" without default annotation

### Requirement: CLI update help includes examples
The system SHALL provide usage examples in update command help.

#### Scenario: Help shows usage examples
- **WHEN** user runs `codegraph update --help`
- **THEN** help output includes examples section with common usage patterns

#### Scenario: Examples show typical workflows
- **WHEN** user views update help examples
- **THEN** examples include: basic usage, JSON output, no-compression

### Requirement: CLI update loads compressed baselines
The system SHALL successfully load and update compressed (1.1) format baselines.

#### Scenario: Update with compressed baseline
- **WHEN** user runs `codegraph update` with existing 1.1 format baseline
- **THEN** system loads baseline successfully without E_BASELINE_NOT_FOUND error
- **AND** update proceeds with incremental changes