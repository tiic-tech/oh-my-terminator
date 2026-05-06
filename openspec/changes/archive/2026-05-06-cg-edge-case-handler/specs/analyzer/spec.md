# Analyzer Specification Delta

## Purpose

Updates analyzer specification to properly implement named edge case handler functions.

## MODIFIED Requirements

### Requirement: Empty project handling
The system SHALL handle projects with no parseable files gracefully using named handler functions.

#### Scenario: Empty project
- **WHEN** project directory contains no files matching extensions
- **THEN** `handleEmptyProject()` function returns user-friendly message with suggestions: "No source files found. Check if project has .ts/.js files, or specify extensions with --ext flag"

#### Scenario: No registered extensions match
- **WHEN** project has only `.json` and `.css` files
- **THEN** `handleEmptyProject()` returns message: "No parseable files found (extensions checked: .ts, .tsx, .js, .jsx, .vue)"

#### Scenario: Empty project suggestions
- **WHEN** empty project detected
- **THEN** handler suggests: check git clone completed, verify file extensions, use custom extensions option

### Requirement: Single-file project handling
The system SHALL handle single-file projects efficiently with simplified analysis output.

#### Scenario: Single-file project
- **WHEN** project has exactly 1 source file (excluding tests)
- **THEN** `handleSingleFileProject()` runs simplified analysis, outputs: "Analyzing single file: <filename>. No dependency graph needed."

#### Scenario: Single-file with imports
- **WHEN** single file imports from external packages
- **THEN** analysis shows external dependencies without layer inference (single file has no layer structure)

#### Scenario: Single-file with internal imports
- **WHEN** single file imports from another file within project
- **THEN** detection reclassifies as 'normal' project (actually 2+ source files via import resolution)