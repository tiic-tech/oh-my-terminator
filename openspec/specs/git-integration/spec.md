# git-integration Specification

## Purpose
Defines git integration for change detection between commits using isomorphic-git.

## Requirements

### Requirement: Git change detection function
The system SHALL provide `detectGitChanges()` function using isomorphic-git.

#### Scenario: Detect changes between commits
- **WHEN** `detectGitChanges(cwd)` is called with valid baseline
- **THEN** function returns `{ lastCommit, currentHead, changes: FileChange[], hasChanges }`

#### Scenario: No baseline error
- **WHEN** `.codegraph/lastCommit.txt` does not exist
- **THEN** function throws error "No baseline found"

#### Scenario: No changes when commits equal
- **WHEN** currentHead equals lastCommit
- **THEN** function returns `hasChanges: false, changes: []`

### Requirement: Git HEAD commit function
The system SHALL provide `getHeadCommit()` function.

#### Scenario: Get HEAD hash
- **WHEN** `getHeadCommit(cwd)` is called in git repository
- **THEN** function returns current HEAD commit SHA string

#### Scenario: Non-git directory error
- **WHEN** called in non-git directory
- **THEN** function throws appropriate error

### Requirement: fs adapter for isomorphic-git
The system SHALL provide fs adapter wrapping Node.js fs module.

#### Scenario: Async readFileSync
- **WHEN** isomorphic-git calls `fs.readFileSync`
- **THEN** adapter returns async wrapper that reads file content

#### Scenario: Promises interface
- **WHEN** isomorphic-git uses `fs.promises`
- **THEN** adapter provides Node.js fs/promises interface

### Requirement: File change type classification
The system SHALL classify file changes as ADD, MODIFY, or DELETE.

#### Scenario: Classify added file
- **WHEN** file exists in toCommit but not in fromCommit
- **THEN** change type is 'ADD'

#### Scenario: Classify modified file
- **WHEN** file exists in both commits with different OID
- **THEN** change type is 'MODIFY'

#### Scenario: Classify deleted file
- **WHEN** file exists in fromCommit but not in toCommit
- **THEN** change type is 'DELETE'

#### Scenario: Filter unsupported files
- **WHEN** change detection encounters unsupported file extension
- **THEN** file is excluded from changes array

### Requirement: Supported file type filtering
The system SHALL provide `isSupportedFile()` function to filter files by extension.

#### Scenario: Supported TypeScript file
- **WHEN** file path ends with .ts, .tsx, .js, .jsx, or .mjs
- **THEN** `isSupportedFile()` returns true

#### Scenario: Unsupported file type
- **WHEN** file path ends with unsupported extension (e.g., .py, .go, .rs)
- **THEN** `isSupportedFile()` returns false

#### Scenario: Function signature
- **WHEN** implementing the filter function
- **THEN** use signature: `function isSupportedFile(filePath: string): boolean`
- **AND** supported extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs']