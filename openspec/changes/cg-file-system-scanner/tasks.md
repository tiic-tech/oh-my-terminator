## 1. Setup & Types

- [ ] 1.1 Create `ignore-rules.ts` with DEFAULT_IGNORE_RULES constant
- [ ] 1.2 Create `ScanResult` interface in scanner.ts
- [ ] 1.3 Create `ScanOptions` interface with default values
- [ ] 1.4 Export types from index.ts

## 2. Core Scanner Implementation

- [ ] 2.1 Implement `scanDirectory(root, options)` main function
- [ ] 2.2 Implement `shouldIgnore(relativePath, rules)` helper
- [ ] 2.3 Implement `isParseableFile(filename, extensions)` helper
- [ ] 2.4 Implement `createDirectoryNode(relativePath)` helper
- [ ] 2.5 Implement `createFileNode(relativePath)` helper
- [ ] 2.6 Implement `createContainsEdge(parentId, childId)` helper
- [ ] 2.7 Implement recursive traversal with maxDepth check
- [ ] 2.8 Handle permission errors gracefully (catch + warning + continue)
- [ ] 2.9 Skip symbolic links (check entry.isSymbolicLink())
- [ ] 2.10 Skip empty directories (no node created)
- [ ] 2.11 Skip hidden files/dirs when includeHidden=false

## 3. CONTAINS Edge Generation

- [ ] 3.1 Generate CONTAINS edge for each file in directory
- [ ] 3.2 Generate CONTAINS edge for each subdirectory
- [ ] 3.3 Create root directory node with ID "DIRECTORY:."
- [ ] 3.4 Track parent-child relationships during traversal

## 4. File Collection

- [ ] 4.1 Collect files matching default extensions (.ts, .tsx, .js, .jsx, .mjs)
- [ ] 4.2 Support custom extensions via options.extensions
- [ ] 4.3 Return filesToParse as relative paths

## 5. Statistics & Warnings

- [ ] 5.1 Track directories count in stats
- [ ] 5.2 Track files count in stats
- [ ] 5.3 Track skipped count in stats
- [ ] 5.4 Log warning for maxDepth exceeded
- [ ] 5.5 Log warning for permission denied
- [ ] 5.6 Log warning for non-existent root path

## 6. Unit Tests

- [ ] 6.1 Test valid root path returns populated result
- [ ] 6.2 Test invalid root path returns empty result + warning
- [ ] 6.3 Test DIRECTORY node ID format
- [ ] 6.4 Test FILE node ID format
- [ ] 6.5 Test root directory ID is "DIRECTORY:."
- [ ] 6.6 Test empty directories are skipped
- [ ] 6.7 Test CONTAINS edge generation (files)
- [ ] 6.8 Test CONTAINS edge generation (subdirectories)
- [ ] 6.9 Test recursive CONTAINS strategy
- [ ] 6.10 Test node_modules is ignored
- [ ] 6.11 Test .git directory is ignored
- [ ] 6.12 Test ignore rule prefix matching
- [ ] 6.13 Test TypeScript files collected in filesToParse
- [ ] 6.14 Test custom extensions override defaults
- [ ] 6.15 Test hidden files skipped by default
- [ ] 6.16 Test includeHidden option enables hidden items
- [ ] 6.17 Test maxDepth exceeded warning
- [ ] 6.18 Test permission denied handling
- [ ] 6.19 Test symbolic links skipped
- [ ] 6.20 Test stats accuracy
- [ ] 6.21 Verify test coverage ≥ 80% for scanner.ts

## 7. Integration

- [ ] 7.1 Export scanDirectory from index.ts
- [ ] 7.2 Create integration test: scan fixture → add to graph → verify structure
- [ ] 7.3 Add JSDoc comments to all public functions