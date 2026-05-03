## 1. Setup & Types

- [x] 1.1 Create `ignore-rules.ts` with DEFAULT_IGNORE_RULES constant
- [x] 1.2 Create `ScanResult` interface in scanner.ts
- [x] 1.3 Create `ScanOptions` interface with default values
- [x] 1.4 Export types from index.ts

## 2. Core Scanner Implementation

- [x] 2.1 Implement `scanDirectory(root, options)` main function
- [x] 2.2 Implement `shouldIgnore(relativePath, rules)` helper
- [x] 2.3 Implement `isParseableFile(filename, extensions)` helper
- [x] 2.4 Implement `createDirectoryNode(relativePath)` helper
- [x] 2.5 Implement `createFileNode(relativePath)` helper
- [x] 2.6 Implement `createContainsEdge(parentId, childId)` helper
- [x] 2.7 Implement recursive traversal with maxDepth check
- [x] 2.8 Handle permission errors gracefully (catch + warning + continue)
- [x] 2.9 Skip symbolic links (check entry.isSymbolicLink())
- [x] 2.10 Skip empty directories (no node created)
- [x] 2.11 Skip hidden files/dirs when includeHidden=false

## 3. CONTAINS Edge Generation

- [x] 3.1 Generate CONTAINS edge for each file in directory
- [x] 3.2 Generate CONTAINS edge for each subdirectory
- [x] 3.3 Create root directory node with ID "DIRECTORY:."
- [x] 3.4 Track parent-child relationships during traversal

## 4. File Collection

- [x] 4.1 Collect files matching default extensions (.ts, .tsx, .js, .jsx, .mjs)
- [x] 4.2 Support custom extensions via options.extensions
- [x] 4.3 Return filesToParse as relative paths

## 5. Statistics & Warnings

- [x] 5.1 Track directories count in stats
- [x] 5.2 Track files count in stats
- [x] 5.3 Track skipped count in stats
- [x] 5.4 Log warning for maxDepth exceeded
- [x] 5.5 Log warning for permission denied
- [x] 5.6 Log warning for non-existent root path

## 6. Unit Tests

- [x] 6.1 Test valid root path returns populated result
- [x] 6.2 Test invalid root path returns empty result + warning
- [x] 6.3 Test DIRECTORY node ID format
- [x] 6.4 Test FILE node ID format
- [x] 6.5 Test root directory ID is "DIRECTORY:."
- [x] 6.6 Test empty directories are skipped
- [x] 6.7 Test CONTAINS edge generation (files)
- [x] 6.8 Test CONTAINS edge generation (subdirectories)
- [x] 6.9 Test recursive CONTAINS strategy
- [x] 6.10 Test node_modules is ignored
- [x] 6.11 Test .git directory is ignored
- [x] 6.12 Test ignore rule prefix matching
- [x] 6.13 Test TypeScript files collected in filesToParse
- [x] 6.14 Test custom extensions override defaults
- [x] 6.15 Test hidden files skipped by default
- [x] 6.16 Test includeHidden option enables hidden items
- [x] 6.17 Test maxDepth exceeded warning
- [x] 6.18 Test permission denied handling
- [x] 6.19 Test symbolic links skipped
- [x] 6.20 Test stats accuracy
- [x] 6.21 Verify test coverage ≥ 80% for scanner.ts

## 7. Integration

- [x] 7.1 Export scanDirectory from index.ts
- [x] 7.2 Create integration test: scan fixture → add to graph → verify structure
- [x] 7.3 Add JSDoc comments to all public functions