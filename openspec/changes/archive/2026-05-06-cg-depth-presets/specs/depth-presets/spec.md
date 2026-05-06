# Depth Presets Specification

## Purpose

Defines adaptive depth threshold configuration for Layer inference based on project scale.

## ADDED Requirements

### Requirement: DEPTH_PRESETS configuration table
The system SHALL define a `DEPTH_PRESETS` configuration table with project scale tiers.

#### Scenario: Preset tiers defined
- **WHEN** system loads depth-presets module
- **THEN** configuration contains 4 tiers: SMALL, MEDIUM, LARGE, ENTERPRISE

#### Scenario: Preset tier values
- **WHEN** system reads DEPTH_PRESETS
- **THEN** each tier contains: `maxFiles` (file count limit), `threshold` (layer threshold)
- **AND** values are: SMALL(50,5), MEDIUM(200,3), LARGE(500,2), ENTERPRISE(Infinity,1)
- **Notation**: (maxFiles, threshold)

### Requirement: detectProjectScale function
The system SHALL provide a `detectProjectScale(projectRoot: string)` function that counts source files.

#### Scenario: Count src directory files
- **WHEN** project has `src/` directory with 100 `.ts/.tsx/.js/.jsx/.vue` files
- **THEN** function returns `fileCount: 100`

#### Scenario: Fallback to project root
- **WHEN** project has no `src/` directory
- **THEN** function counts files in project root (excluding test files)

#### Scenario: Fallback with test exclusion
- **WHEN** project has no `src/` directory and falls back to root
- **THEN** test files are still excluded from count

#### Scenario: Exclude test files from count
- **WHEN** src directory contains 50 source files and 20 test files
- **THEN** function returns `fileCount: 50`

### Requirement: Test file exclusion integration
The system SHALL use existing test-file-filter module for test file detection.

#### Scenario: Import test-file-filter
- **WHEN** module needs to exclude test files
- **THEN** imports `excludeTestFiles` from `../../analyzer/test-file-filter.js`

#### Scenario: Apply exclusion before counting
- **WHEN** files are globbed from directory
- **THEN** calls `excludeTestFiles(files)` before counting

### Requirement: File counting mechanism
The system SHALL count files using recursive glob with filtering.

#### Scenario: Recursive glob src directory
- **WHEN** counting files in src/ directory
- **THEN** glob pattern `**/*.{ts,tsx,js,jsx,vue}` is applied recursively to src/ and all subdirectories

#### Scenario: Count after filtering
- **WHEN** files are globbed and filtered
- **THEN** counts remaining files and returns count

### Requirement: getThresholdForScale function
The system SHALL provide a `getThresholdForScale(fileCount: number)` function that returns appropriate threshold.

#### Scenario: Small project threshold
- **WHEN** fileCount is 30 (≤50)
- **THEN** function returns threshold: 5

#### Scenario: Medium project threshold
- **WHEN** fileCount is 150 (51-200)
- **THEN** function returns threshold: 3

#### Scenario: Large project threshold
- **WHEN** fileCount is 400 (201-500)
- **THEN** function returns threshold: 2

#### Scenario: Enterprise project threshold
- **WHEN** fileCount is 800 (>500)
- **THEN** function returns threshold: 1

#### Scenario: Empty project threshold
- **WHEN** fileCount is 0 (no source files found)
- **THEN** function returns threshold: 5 (SMALL preset default)

### Requirement: Threshold selection is first-match-wins
The system SHALL select threshold by iterating presets and returning first match.

#### Scenario: Presets ordered by increasing maxFiles
- **WHEN** iteration begins
- **THEN** presets checked in order: SMALL → MEDIUM → LARGE → ENTERPRISE

#### Scenario: Stop on first match
- **WHEN** fileCount matches SMALL preset
- **THEN** function returns immediately without checking remaining presets