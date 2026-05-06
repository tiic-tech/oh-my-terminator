# Test File Filter Specification

## Purpose

Pre-filters test files before analysis starts to reduce workload and provide clear feedback.

## ADDED Requirements

### Requirement: Type definitions
The system SHALL define the following types for test file filtering:

```typescript
interface TestPatterns {
  customPatterns?: string[];  // Override default test patterns
  includePatterns?: string[];  // Additional patterns to include (merged with defaults)
}

interface FilterResult {
  kept: string[];  // Files that passed filter (non-test files)
  filtered: number;  // Count of filtered test files
  filteredFiles: string[];  // Paths of filtered test files
}
```

### Requirement: excludeTestFiles function
The system SHALL provide an `excludeTestFiles(files: string[], patterns?: TestPatterns)` function that filters out test files.

#### Scenario: Filter test files from list
- **WHEN** input list contains `['src/utils.ts', 'src/utils.test.ts', 'tests/main.ts']`
- **THEN** function returns `['src/utils.ts']` (test files removed)

#### Scenario: Empty result from all-test list
- **WHEN** input list contains only test files
- **THEN** function returns empty array `[]`

#### Scenario: No test files in input
- **WHEN** input list contains no files matching test patterns
- **THEN** function returns original list unchanged

### Requirement: Default test patterns
The system SHALL use standard test file patterns by default.

#### Scenario: Default patterns
- **WHEN** filter runs without custom patterns
- **THEN** default patterns match:
  - `*.test.ts`, `*.test.tsx`, `*.test.js`, `*.test.jsx`
  - `*.spec.ts`, `*.spec.tsx`, `*.spec.js`, `*.spec.jsx`
  - `*_test.ts`, `*_test.js`
  - `tests/**`, `__tests__/**`
  - `test/**`, `spec/**`

### Requirement: Custom test patterns
The system SHALL support custom test file patterns.

#### Scenario: Custom patterns override defaults
- **WHEN** user provides `patterns.customPatterns`
- **THEN** filter uses custom patterns instead of defaults

### Requirement: Filter statistics
The system SHALL return filtering statistics.

#### Scenario: Statistics returned
- **WHEN** filtering completes
- **THEN** result includes `{ filtered: <count>, kept: <count>, filteredFiles: [<paths>] }`

#### Scenario: Statistics used for logging
- **WHEN** CLI runs with pre-filter
- **THEN** logs show "Filtered X test files, analyzing Y source files"