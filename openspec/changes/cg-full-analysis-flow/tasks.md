## 1. Type Definitions

- [x] 1.1 Define `FullAnalysisResult` interface in `types.ts`
- [x] 1.2 Define `AnalysisStats` interface with timing and count fields
- [x] 1.3 Define `AnalysisOptions` interface with extensions, onProgress, scanOptions
- [x] 1.4 Define `ProgressEvent` interface with phase, current, total, message, filePath
- [x] 1.5 Define `ProgressCallback` type alias
- [x] 1.6 Export all new types from `index.ts`

## 2. Parser Registry

- [x] 2.1 Define `Parser` interface (name, extensions, parse method)
- [x] 2.2 Define `ParserResult` interface (nodes, edges, warnings)
- [x] 2.3 Define `ParserRegistry` interface (register, getParser, hasParser, getAllExtensions)
- [x] 2.4 Implement `DefaultParserRegistry` class with Map-based storage
- [x] 2.5 Create `parser-registry.ts` module
- [x] 2.6 Export ParserRegistry from `index.ts`

## 3. TypeScript Parser Adapter

- [x] 3.1 Create `TypeScriptParserAdapter` implementing `Parser` interface
- [x] 3.2 Wrap existing C3 import extraction logic
- [x] 3.3 Wrap existing C4 module extraction logic
- [x] 3.4 Return unified `ParserResult` with nodes and edges
- [x] 3.5 Register TypeScriptParserAdapter extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs']
- [x] 3.6 Export TypeScriptParserAdapter from parser module

## 4. Core Analyzer

- [x] 4.1 Create `analyzer.ts` module
- [x] 4.2 Implement `analyzeFull(cwd, options)` main function
- [x] 4.3 Initialize CodeGraph and ParserRegistry
- [x] 4.4 Register TypeScriptParserAdapter at initialization
- [x] 4.5 Call scanDirectory (C2) with options.scanOptions
- [x] 4.6 Merge scan nodes/edges into CodeGraph
- [x] 4.7 Implement file grouping by extension
- [x] 4.8 Implement sequential file parsing loop
- [x] 4.9 Implement parser selection via registry.getParser()
- [x] 4.10 Implement mergeParserResult helper (addNode/addEdge)
- [x] 4.11 Implement continue-on-error pattern with warning collection
- [x] 4.12 Calculate and populate AnalysisStats
- [x] 4.13 Return FullAnalysisResult

## 5. Progress Reporting

- [x] 5.1 Implement progress callback invocation in scan phase
- [x] 5.2 Implement progress callback invocation in parse phase (per-file)
- [x] 5.3 Implement progress callback invocation in complete phase
- [x] 5.4 Skip callback when onProgress is undefined (silent mode)
- [x] 5.5 Include filePath in parse phase ProgressEvent

## 6. Edge Cases

- [x] 6.1 Handle empty project (no parseable files) - return valid result
- [x] 6.2 Handle all files failing parsing - return graph with only scan results
- [x] 6.3 Handle unknown file extensions - log warning, skip file
- [x] 6.4 Handle path not exists - propagate C2 warning
- [x] 6.5 Handle filesToParse.length === 0 - early return with empty stats

## 7. Unit Tests

- [x] 7.1 Test FullAnalysisResult structure validation (analyzer-types.test.ts)
- [x] 7.2 Test AnalysisStats field completeness (analyzer.test.ts)
- [x] 7.3 Test ParserRegistry.register() functionality (parser-registry.test.ts)
- [x] 7.4 Test ParserRegistry.getParser() selection (parser-registry.test.ts)
- [x] 7.5 Test ParserRegistry.getAllExtensions() listing (parser-registry.test.ts)
- [x] 7.6 Test analyzeFull with small fixture project (analyzer.test.ts)
- [x] 7.7 Test analyzeFull with empty fixture (analyzer.test.ts)
- [x] 7.8 Test analyzeFull with mixed file types (analyzer.test.ts)
- [x] 7.9 Test continue-on-error with syntax error fixture (analyzer.test.ts)
- [x] 7.10 Test progress callback invocation counts (analyzer.test.ts)
- [x] 7.11 Test silent mode (no callback) (analyzer.test.ts)
- [x] 7.12 Test unknown extension warning (analyzer.test.ts)

## 8. Integration Tests

- [x] 8.1 Test C1 CodeGraph integration (node/edge merge)
- [x] 8.2 Test C2 Scanner integration (FILE/DIRECTORY nodes)
- [x] 8.3 Test C3 Parser integration (IMPORTS/RE_EXPORTS edges)
- [x] 8.4 Test C4 ModuleExtractor integration (MODULE nodes)
- [x] 8.5 Test complete flow with multi-file fixture
- [x] 8.6 Test EXTERNAL node creation for npm packages
- [x] 8.7 Test graph completeness (all expected nodes/edges present)

## 9. Performance Tests

- [x] 9.1 Create performance-small fixture (20 files) for baseline
- [x] 9.2 Verify totalTime < 2s for 20 files (benchmark tests pass)
- [ ] 9.3 Create 1000-file fixture for scale test (deferred)
- [ ] 9.4 Verify totalTime < 30s for 1000 files (deferred)
- [ ] 9.5 Verify memory usage < 256MB for 1000 files (deferred)
- [x] 9.6 Performance benchmarks in analyzer.bench.ts

## 10. Documentation

- [x] 10.1 Add `analyzeFull()` to package README
- [x] 10.2 Document FullAnalysisResult structure
- [x] 10.3 Document AnalysisOptions configuration
- [x] 10.4 Document ParserRegistry usage
- [x] 10.5 Document ProgressCallback pattern
- [x] 10.6 Add API examples to README
- [x] 10.7 Update package exports in index.ts