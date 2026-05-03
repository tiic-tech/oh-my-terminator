## ADDED Requirements

### Requirement: analyzeFull function
The system SHALL provide an `analyzeFull(cwd: string, options?: AnalysisOptions)` function that performs complete repository analysis.

#### Scenario: Successful full analysis
- **WHEN** user calls `analyzeFull('/path/to/project')` with valid project directory
- **THEN** system returns `FullAnalysisResult` containing complete CodeGraph with FILE, DIRECTORY, MODULE nodes and CONTAINS, IMPORTS edges

#### Scenario: Analysis with custom options
- **WHEN** user calls `analyzeFull('/path', { extensions: ['.ts', '.vue'] })`
- **THEN** system only parses files matching specified extensions

### Requirement: FullAnalysisResult structure
The system SHALL return `FullAnalysisResult` containing graph, stats, and warnings.

#### Scenario: Result contains all components
- **WHEN** analysis completes
- **THEN** result contains:
  - `graph`: CodeGraph with all nodes and edges
  - `stats`: AnalysisStats with timing and counts
  - `warnings`: array of warning strings

#### Scenario: Stats include timing information
- **WHEN** analysis completes
- **THEN** stats contain `scanTimeMs`, `parseTimeMs`, `totalTimeMs`, `filesParsed`, `parseErrors`, `directories`, `files`, `modules`, `edges`

### Requirement: Parser registry
The system SHALL provide `ParserRegistry` for extensible parser selection.

#### Scenario: Register new parser
- **WHEN** system registers parser via `registry.register(parser)`
- **THEN** parser is available for all its declared extensions

#### Scenario: Select parser by extension
- **WHEN** system needs to parse file with extension `.ts`
- **THEN** `registry.getParser('.ts')` returns TypeScriptParser

#### Scenario: Unknown extension handled
- **WHEN** file has extension with no registered parser
- **THEN** system logs warning and skips the file

### Requirement: Continue-on-error pattern
The system SHALL continue analysis when individual file parsing fails.

#### Scenario: Single file parse error
- **WHEN** parsing file A fails with syntax error
- **THEN** system adds warning, increments `parseErrors`, and continues to file B

#### Scenario: Multiple file parse errors
- **WHEN** 3 out of 10 files fail parsing
- **THEN** result graph contains 7 files' nodes/edges, warnings array has 3 entries, stats.parseErrors = 3

#### Scenario: All files fail parsing
- **WHEN** all files fail parsing
- **THEN** result graph contains only C2 scan results (FILE/DIRECTORY nodes), warnings lists all errors

### Requirement: Progress callback
The system SHALL support optional progress reporting via callback.

#### Scenario: Progress callback triggered
- **WHEN** user provides `onProgress` callback
- **THEN** callback is invoked for each phase: scan, parse, merge, complete

#### Scenario: Progress event structure
- **WHEN** callback is invoked during parse phase
- **THEN** event contains `phase: 'parse'`, `current: <number>`, `total: <number>`, `filePath: <string>`

#### Scenario: Silent mode
- **WHEN** user does not provide `onProgress` callback
- **THEN** analysis proceeds silently without callbacks

### Requirement: Empty project handling
The system SHALL handle projects with no parseable files gracefully.

#### Scenario: Empty project
- **WHEN** project directory contains no files matching extensions
- **THEN** result graph contains only root DIRECTORY node, stats.filesParsed = 0, no parse warnings

#### Scenario: No registered extensions match
- **WHEN** project has only `.json` and `.css` files
- **THEN** result graph contains FILE nodes from scan, warnings include "No parseable files found"

### Requirement: Memory efficiency
The system SHALL release AST memory immediately after merging parse results.

#### Scenario: Memory released after parse
- **WHEN** file parsing completes and results merged
- **THEN** TypeScript AST for that file is no longer held in memory

#### Scenario: Large project memory bound
- **WHEN** analyzing 1000 TypeScript files
- **THEN** peak memory usage is less than 256MB

### Requirement: Sequential parsing
The system SHALL parse files sequentially in MVP.

#### Scenario: Files processed in order
- **WHEN** analysis processes filesToParse list
- **THEN** files are parsed one at a time in list order

#### Scenario: No parallel execution
- **WHEN** analyzing project with multiple files
- **THEN** system does not use worker_threads or parallel batches

### Requirement: Integration with C1-C4
The system SHALL correctly integrate existing CodeGraph components.

#### Scenario: C2 Scanner integration
- **WHEN** analysis runs scanDirectory
- **THEN** FILE and DIRECTORY nodes added to graph with CONTAINS edges

#### Scenario: C3 Parser integration
- **WHEN** TypeScriptParser processes file
- **THEN** IMPORTS, RE_EXPORTS edges added, EXTERNAL nodes created for external deps

#### Scenario: C4 ModuleExtractor integration
- **WHEN** TypeScriptParser processes file
- **THEN** MODULE nodes created for exported symbols with DECLARES edges

#### Scenario: C1 CodeGraph integration
- **WHEN** nodes/edges from scanner and parser are merged
- **THEN** graph.addNode() and graph.addEdge() correctly deduplicate and index