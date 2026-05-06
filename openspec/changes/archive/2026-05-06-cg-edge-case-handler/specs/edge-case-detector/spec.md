# Edge Case Detector Specification

## Purpose

Detects special project states at analysis entry to enable appropriate handling before full analysis runs.

## ADDED Requirements

### Requirement: Type definitions
The system SHALL define the following types for edge case detection:

```typescript
type ProjectKind = 'empty' | 'single-file' | 'test-only' | 'normal';

interface SpecialCaseResult {
  kind: ProjectKind;
  sourceFiles: string[];
  testFiles: string[];
}

interface DetectionOptions {
  extensions?: string[];  // Override default source file extensions
  testPatterns?: string[];  // Override default test file patterns
}
```

### Requirement: detectSpecialCases function
The system SHALL provide a `detectSpecialCases(projectRoot: string, options?: DetectionOptions)` function that identifies project kind.

#### Scenario: Empty project detection
- **WHEN** projectRoot contains no files matching source extensions (`.ts`, `.tsx`, `.js`, `.jsx`, `.vue`)
- **THEN** function returns `{ kind: 'empty', sourceFiles: [], testFiles: [] }`

#### Scenario: Single-file project detection
- **WHEN** projectRoot contains exactly 1 source file (excluding test files)
- **THEN** function returns `{ kind: 'single-file', sourceFiles: [<path>], testFiles: [<test paths>] }`

#### Scenario: Normal project detection
- **WHEN** projectRoot contains 2+ source files
- **THEN** function returns `{ kind: 'normal', sourceFiles: [<paths>], testFiles: [<test paths>] }`

#### Scenario: Test-only project detection
- **WHEN** projectRoot contains only test files (no production source files)
- **THEN** function returns `{ kind: 'test-only', sourceFiles: [], testFiles: [<paths>] }`

### Requirement: Source file extension list
The system SHALL use a configurable list of source file extensions for detection.

#### Scenario: Default extensions
- **WHEN** detection runs without custom options
- **THEN** default extensions are `['.ts', '.tsx', '.js', '.jsx', '.vue']`

#### Scenario: Custom extensions
- **WHEN** user provides `options.extensions`
- **THEN** detection uses custom extension list instead of defaults

### Requirement: Test file pattern matching
The system SHALL identify test files using standard patterns.

#### Scenario: Test file patterns
- **WHEN** file path matches patterns: `*.test.ts`, `*.spec.ts`, `*_test.ts`, `tests/**`, `__tests__/**`
- **THEN** file is classified as test file, not source file

#### Scenario: Test file excluded from source count
- **WHEN** single-file project has 1 source file and 10 test files
- **THEN** detection returns `kind: 'single-file'` (test files do not affect kind classification)

### Requirement: Detection performance
The system SHALL complete detection within 100ms for typical projects.

#### Scenario: Small project detection
- **WHEN** project has <100 files
- **THEN** detection completes in <50ms

#### Scenario: Large project detection
- **WHEN** project has 1000+ files
- **THEN** detection completes in <100ms