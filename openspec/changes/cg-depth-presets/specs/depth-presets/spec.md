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

### Requirement: detectProjectScale function
The system SHALL provide a `detectProjectScale(projectRoot: string)` function that counts source files.

#### Scenario: Count src directory files
- **WHEN** project has `src/` directory with 100 TypeScript files
- **THEN** function returns `fileCount: 100`

#### Scenario: Fallback to project root
- **WHEN** project has no `src/` directory
- **THEN** function counts files in project root (excluding test files)

#### Scenario: Exclude test files from count
- **WHEN** src directory contains 50 source files and 20 test files
- **THEN** function returns `fileCount: 50`

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

### Requirement: Threshold selection is first-match-wins
The system SHALL select threshold by iterating presets and returning first match.

#### Scenario: Presets ordered by increasing maxFiles
- **WHEN** iteration begins
- **THEN** presets checked in order: SMALL → MEDIUM → LARGE → ENTERPRISE

#### Scenario: Stop on first match
- **WHEN** fileCount matches SMALL preset
- **THEN** function returns immediately without checking remaining presets