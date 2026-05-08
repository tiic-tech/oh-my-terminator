# quick-brief

## Purpose

QuickBrief API for FILE nodes - returns minimal statistics including import/importedBy counts, test file flag, deprecated flag, and complexity level.

Designed for quick file overview in AI-driven development workflows with compact Markdown output (≤50 tokens).

## Requirements

### Requirement: QuickBrief accepts file paths

The system SHALL accept file paths with or without FILE: prefix for QuickBrief queries.

#### Scenario: Path with FILE prefix
- **WHEN** user queries `getQuickBrief("FILE:src/utils/format.ts")`
- **THEN** system returns brief statistics for that file

#### Scenario: Plain path
- **WHEN** user queries `getQuickBrief("src/utils/format.ts")`
- **THEN** system auto-prefixes FILE: and returns brief statistics

### Requirement: QuickBrief returns edge counts not file counts

The system SHALL count edges (import relationships) not unique files (A4 resolution).

#### Scenario: Multiple imports from same file
- **WHEN** file has `import { a, b } from './utils'` (2 edges)
- **THEN** `importCount = 2` (not 1)

#### Scenario: Import count includes dynamic imports
- **WHEN** file has static import and dynamic import to same file
- **THEN** both edges are counted in importCount

#### Scenario: ImportedBy excludes dynamic imports
- **WHEN** file is statically imported by 3 files and dynamically imported by 2 files
- **THEN** `importedByCount = 3` (A2 resolution)

### Requirement: QuickBrief returns hasTest flag

The system SHALL return boolean indicating if test file exists.

#### Scenario: Test file exists
- **WHEN** test file is found (via scope query testFile logic)
- **THEN** `hasTest = true`

#### Scenario: No test file
- **WHEN** no test file found
- **THEN** `hasTest = false`

### Requirement: QuickBrief returns deprecated flag

The system SHALL return boolean indicating if any export is deprecated.

#### Scenario: Deprecated export exists
- **WHEN** any MODULE in file has `metadata.deprecated = true`
- **THEN** `deprecated = true`

#### Scenario: No deprecated exports
- **WHEN** no MODULE is deprecated
- **THEN** `deprecated = false`

### Requirement: QuickBrief returns complexity level

The system SHALL return complexity level string, "unknown" when no data (A6 resolution).

#### Scenario: Low complexity
- **WHEN** aggregated complexity value ≤ 5
- **THEN** `complexityLevel = "low"`

#### Scenario: Medium complexity
- **WHEN** aggregated complexity value between 6 and 15
- **THEN** `complexityLevel = "medium"`

#### Scenario: High complexity
- **WHEN** aggregated complexity value > 15
- **THEN** `complexityLevel = "high"`

#### Scenario: Unknown complexity
- **WHEN** no MODULE data available
- **THEN** `complexityLevel = "unknown"`

### Requirement: QuickBrief handles file not found

The system SHALL return structured error when file does not exist.

#### Scenario: File not found
- **WHEN** user queries `getQuickBrief("src/nonexistent.ts")`
- **THEN** returns `{ content: "## Brief: src/nonexistent.ts\n- Status: not found", importCount: 0, ... }`

### Requirement: QuickBrief generates compact Markdown

The system SHALL generate minimal Markdown output (≤50 tokens).

#### Scenario: Standard output
- **WHEN** QuickBrief succeeds
- **THEN** output is `## Brief: <path>\n- Imports: N\n- Imported by: N\n- Test: yes/no\n- Deprecated: yes/no\n- Complexity: level`

#### Scenario: Deprecated warning
- **WHEN** file is deprecated
- **THEN** output shows `Deprecated: yes (WARNING)`

### Requirement: QuickBrief returns CLI-compatible JSON structure

The system SHALL return data mapping to CLI BriefResult schema (C10 integration).

#### Scenario: BriefResult structure
- **WHEN** QuickBrief returns
- **THEN** result includes `success`, `file`, `imports`, `importedBy`, `hasTest`, `deprecated`, `complexityLevel`, `quickFacts[]`, `durationMs`

#### Scenario: quickFacts generation
- **WHEN** brief succeeds
- **THEN** quickFacts includes human-readable summary like "2 imports, 5 dependents"

#### Scenario: Error structure
- **WHEN** file not found
- **THEN** returns `success: false`, `error.code = "E001_TARGET_NOT_FOUND"`