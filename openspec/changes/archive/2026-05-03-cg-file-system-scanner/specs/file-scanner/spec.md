## ADDED Requirements

### Requirement: scanDirectory function scans project directories

The system SHALL implement `scanDirectory(root: string, options?: ScanOptions): ScanResult` that recursively traverses the project directory structure starting from the given root path.

#### Scenario: Valid root path returns populated result
- **WHEN** scanDirectory is called with a valid existing directory path
- **THEN** it returns a ScanResult with nodes, edges, filesToParse, stats, and warnings

#### Scenario: Invalid root path returns empty result with warning
- **WHEN** scanDirectory is called with a non-existent path
- **THEN** it returns an empty ScanResult with a warning message

### Requirement: ScanResult interface defines output structure

The system SHALL define `ScanResult` interface with the following fields:
- `nodes: GraphNode[]` - All DIRECTORY and FILE nodes created
- `edges: GraphEdge[]` - All CONTAINS edges generated
- `filesToParse: string[]` - Relative paths of files matching extensions
- `stats: { directories: number; files: number; skipped: number }`
- `warnings: string[]` - Non-fatal error messages

#### Scenario: ScanResult contains all required fields
- **WHEN** a scan completes successfully
- **THEN** the result has nodes array, edges array, filesToParse array, stats object, and warnings array

### Requirement: ScanOptions interface defines configuration

The system SHALL define `ScanOptions` interface with optional fields:
- `extensions?: string[]` - File extensions to collect (default: ['.ts', '.tsx', '.js', '.jsx', '.mjs'])
- `ignoreRules?: string[]` - Custom ignore rules (overrides default)
- `includeHidden?: boolean` - Include hidden files/dirs (default: false)
- `maxDepth?: number` - Maximum recursion depth (default: 20)

#### Scenario: Default options are applied when none provided
- **WHEN** scanDirectory is called without options
- **THEN** default extensions, ignore rules, includeHidden=false, maxDepth=20 are used

### Requirement: DIRECTORY nodes created for non-empty directories

The system SHALL create `GraphNode` with type `NodeType.DIRECTORY` for each non-empty directory encountered during traversal.

#### Scenario: Directory node ID format
- **WHEN** a directory at relative path "src/components" is encountered
- **THEN** a node is created with id "DIRECTORY:src/components"

#### Scenario: Root directory node ID
- **WHEN** the root directory is processed
- **THEN** a node is created with id "DIRECTORY:."

#### Scenario: Empty directories are skipped
- **WHEN** a directory has no files or subdirectories
- **THEN** no node is created for that directory

### Requirement: FILE nodes created for all files

The system SHALL create `GraphNode` with type `NodeType.FILE` for each file encountered during traversal, regardless of extension.

#### Scenario: File node ID format
- **WHEN** a file at relative path "src/main.ts" is encountered
- **THEN** a node is created with id "FILE:src/main.ts"

#### Scenario: All files get nodes regardless of extension
- **WHEN** files with extensions .ts, .json, .css, .md are encountered
- **THEN** FILE nodes are created for all of them

### Requirement: CONTAINS edges use recursive strategy

The system SHALL generate `GraphEdge` with type `EdgeType.CONTAINS` linking each directory to its direct children (files and subdirectories).

#### Scenario: Directory CONTAINS files
- **WHEN** directory "src" contains file "main.ts"
- **THEN** edge is created: from "DIRECTORY:src" to "FILE:src/main.ts"

#### Scenario: Directory CONTAINS subdirectories
- **WHEN** directory "src" contains subdirectory "components"
- **THEN** edge is created: from "DIRECTORY:src" to "DIRECTORY:src/components"

#### Scenario: Subdirectory creates own CONTAINS edges
- **WHEN** directory "src/components" contains file "Button.tsx"
- **THEN** edge is created: from "DIRECTORY:src/components" to "FILE:src/components/Button.tsx"

### Requirement: Default ignore rules exclude common directories

The system SHALL skip directories matching default ignore rules: `.git/`, `node_modules/`, `dist/`, `build/`, `.next/`, `.cache/`, `.codegraph/`, `coverage/`.

#### Scenario: node_modules is ignored
- **WHEN** scanning encounters a node_modules directory
- **THEN** no nodes or edges are created for its contents

#### Scenario: .git directory is ignored
- **WHEN** scanning encounters a .git directory
- **THEN** no nodes or edges are created for its contents

#### Scenario: Ignore rule uses prefix matching
- **WHEN** checking if path "src/node_modules/util" should be ignored
- **THEN** it is ignored because path contains "node_modules/" prefix

### Requirement: Files collected by extension for parsing

The system SHALL collect relative paths of files matching the configured extensions into `filesToParse` array.

#### Scenario: TypeScript files are collected
- **WHEN** scanning finds files "main.ts", "utils.ts", "config.json"
- **THEN** filesToParse contains "main.ts" and "utils.ts" (not "config.json")

#### Scenario: Custom extensions override defaults
- **WHEN** options.extensions is set to ['.py']
- **THEN** only .py files are collected in filesToParse

### Requirement: Hidden files and directories skipped by default

The system SHALL skip files and directories starting with `.` unless `includeHidden: true` is set.

#### Scenario: .env file is skipped
- **WHEN** scanning encounters ".env" file with default options
- **THEN** no node is created for ".env"

#### Scenario: .storybook directory is skipped
- **WHEN** scanning encounters ".storybook" directory with default options
- **THEN** no nodes or edges are created for its contents

#### Scenario: includeHidden enables hidden items
- **WHEN** options.includeHidden is true
- **THEN** hidden files and directories are included in scan

### Requirement: maxDepth prevents infinite recursion

The system SHALL stop recursion when depth exceeds `maxDepth` and log a warning.

#### Scenario: Max depth exceeded warning
- **WHEN** traversal reaches depth 21 with maxDepth=20
- **THEN** traversal stops and warning is added to result.warnings

### Requirement: Permission errors handled gracefully

The system SHALL catch permission errors when reading directories, log a warning, increment skipped count, and continue.

#### Scenario: Permission denied handling
- **WHEN** readdir fails due to permission denied on directory "protected/"
- **THEN** a warning is logged and result.stats.skipped is incremented

### Requirement: Symbolic links are skipped

The system SHALL not follow symbolic links and skip them entirely.

#### Scenario: Symbolic link is skipped
- **WHEN** scanning encounters a symbolic link "link-to-external"
- **THEN** no node is created and it is not traversed

### Requirement: Stats track scan metrics

The system SHALL populate `stats` with counts of directories, files, and skipped items.

#### Scenario: Stats reflect scan results
- **WHEN** scanning a project with 10 directories, 50 files, and 5 skipped items
- **THEN** stats.directories=10, stats.files=50, stats.skipped=5