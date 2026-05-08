/**
 * Core Analyzer Module
 *
 * Orchestrates full repository analysis by combining C1-C4 components:
 * - C1: CodeGraph for node/edge storage
 * - C2: Scanner for FILE/DIRECTORY nodes and CONTAINS edges
 * - C3/C4: TypeScriptParser for IMPORTS/MODULE nodes and edges
 */

import path from 'path';
import { performance } from 'perf_hooks';
import {
  type FullAnalysisResult,
  type AnalysisOptions,
  type AnalysisStats,
  type ParserResult,
} from './types.js';
import { CodeGraph } from './graph.js';
import { scanDirectory, type ScanOptions } from './scanner.js';
import { DefaultParserRegistry } from './parser-registry.js';
import { TypeScriptParserAdapter } from './parser/typescript-adapter.js';

/**
 * Perform full repository analysis
 *
 * Scans directory structure, parses all supported files, and builds
 * complete CodeGraph with all nodes and edges.
 *
 * @param cwd - Project root directory (absolute path)
 * @param options - Optional analysis configuration
 * @returns FullAnalysisResult with graph, stats, and warnings
 */
export async function analyzeFull(
  cwd: string,
  options?: AnalysisOptions
): Promise<FullAnalysisResult> {
  const warnings: string[] = [];
  const stats: AnalysisStats = createEmptyStats();
  const startTime = performance.now();

  // Initialize graph and registry
  const graph = new CodeGraph();
  const registry = new DefaultParserRegistry();

  // ========================================
  // Parser Registration (Plugin Architecture)
  // ========================================

  // WHY: Follows "Dependencies Are Invisible Chains" principle.
  // Parser registration is explicit through configuration, not hardcoded.
  // Users can inject custom parsers without modifying analyzer source code.
  //
  // @see coding-taste skill: "Declare dependencies explicitly. Validate before runtime."
  // @see parser-registry.ts: "Extensible plugin architecture for multi-language support"

  // Register user-provided parsers (explicit dependency injection)
  if (options?.parsers && options.parsers.length > 0) {
    for (const parser of options.parsers) {
      registry.register(parser);
    }
  } else {
    // Backward compatibility: Register built-in TypeScript parser if no custom parsers
    // This maintains the default behavior while enabling plugin architecture.
    const tsParser = new TypeScriptParserAdapter(cwd);
    registry.register(tsParser);
  }

  // Determine extensions to parse
  const extensions = options?.extensions ?? registry.getAllExtensions();

  // Progress callback (optional)
  const onProgress = options?.onProgress;

  // ========================================
  // Phase 1: Scan
  // ========================================
  const scanStart = performance.now();

  const scanOptions: ScanOptions = {
    extensions,
    ...options?.scanOptions,
  };

  const scanResult = await scanDirectory(cwd, scanOptions);

  stats.scanTimeMs = performance.now() - scanStart;

  // Collect scan warnings
  if (scanResult.warnings) {
    warnings.push(...scanResult.warnings);
  }

  // Merge scan results into graph
  for (const node of scanResult.nodes) {
    graph.addNode(node);
  }
  for (const edge of scanResult.edges) {
    graph.addEdge(edge);
  }

  // Populate initial stats
  stats.directories = scanResult.stats.directories;
  stats.files = scanResult.stats.files;

  // Report scan progress
  if (onProgress) {
    onProgress({
      phase: 'scan',
      current: 1,
      total: 1,
      message: `Found ${scanResult.filesToParse.length} files to parse`,
    });
  }

  // ========================================
  // Phase 2: Parse
  // ========================================
  const parseStart = performance.now();

  // Group files by extension for efficient parsing
  const filesToParse = scanResult.filesToParse;

  // Check if no files to parse (empty project or no matching extensions)
  if (filesToParse.length === 0) {
    stats.parseTimeMs = 0;
    stats.totalTimeMs = performance.now() - startTime;

    // Report complete
    if (onProgress) {
      onProgress({
        phase: 'complete',
        current: 0,
        total: 0,
        message: 'No parseable files found',
      });
    }

    return {
      graph,
      stats,
      warnings: [...warnings, 'No parseable files found'],
    };
  }

  // ========================================
  // Batch Parse Setup (Architecture Fix)
  // ========================================

  // WHY: TypeScript Compiler API requires Program with all files for correct
  // module resolution. Parsing files one-by-one fails to resolve relative imports
  // because TypeScript doesn't know about other project files.
  //
  // Solution: Call parseBatch() on TypeScript adapters before individual parse() calls.
  // This creates a Program containing all files, enabling correct import resolution.
  //
  // @see TypeScriptParserAdapter.parseBatch(): Creates Program with all files
  // @see coding-taste skill: "Dependencies Are Invisible Chains" - explicit setup

  // Find TypeScript adapters and call parseBatch
  for (const parser of registry.getAllParsers()) {
    // Check if parser has parseBatch method (TypeScriptParserAdapter)
    if ('parseBatch' in parser && typeof parser.parseBatch === 'function') {
      // Filter files for this parser's extensions
      const parserFiles = filesToParse.filter(f =>
        parser.extensions.includes(path.extname(f))
      );
      if (parserFiles.length > 0) {
        await parser.parseBatch(parserFiles);
      }
    }
  }

  // Sequential parsing (now uses cached results from batch parse)
  const totalFiles = filesToParse.length;

  for (let i = 0; i < totalFiles; i++) {
    const filePath = filesToParse[i];
    const ext = path.extname(filePath);

    // Get parser for this extension
    const parser = registry.getParser(ext);

    if (!parser) {
      // No parser for this extension - skip with warning
      warnings.push(`No parser for extension: ${ext} (file: ${filePath})`);
      continue;
    }

    // Report parse progress
    if (onProgress) {
      onProgress({
        phase: 'parse',
        current: i + 1,
        total: totalFiles,
        filePath,
      });
    }

    try {
      // Parse file (disk-based parsers read from filesystem, content=null)
      const parseResult = await parser.parse(filePath, null, cwd);

      // Merge parse result into graph
      mergeParserResult(graph, parseResult);

      // Track successful parse
      stats.filesParsed++;
    } catch (error) {
      // Continue-on-error: record warning with stack trace and continue
      const errorMsg = error instanceof Error
        ? `${error.message}${error.stack ? ` (${error.stack.split('\n')[1]?.trim()})` : ''}`
        : String(error);
      warnings.push(`Parse failed: ${filePath} - ${errorMsg}`);
      stats.parseErrors++;
    }
  }

  stats.parseTimeMs = performance.now() - parseStart;

  // ========================================
  // Phase 3: Finalize stats
  // ========================================

  // Count final graph elements
  stats.modules = graph.getNodes().reduce(
    (count, n) => n.type === 'MODULE' ? count + 1 : count,
    0
  );
  stats.edges = graph.getEdges().length;
  stats.totalTimeMs = performance.now() - startTime;

  // ========================================
  // Phase 4: Complete
  // ========================================

  if (onProgress) {
    onProgress({
      phase: 'complete',
      current: totalFiles,
      total: totalFiles,
      message: `Analysis complete: ${stats.filesParsed} files parsed`,
    });
  }

  return {
    graph,
    stats,
    warnings,
  };
}

/**
 * Create empty stats object
 */
function createEmptyStats(): AnalysisStats {
  return {
    scanTimeMs: 0,
    parseTimeMs: 0,
    totalTimeMs: 0,
    filesParsed: 0,
    parseErrors: 0,
    directories: 0,
    files: 0,
    modules: 0,
    edges: 0,
  };
}

/**
 * Merge parser result into graph
 *
 * Adds all nodes and edges from parse result to the graph.
 */
function mergeParserResult(graph: CodeGraph, result: ParserResult): void {
  for (const node of result.nodes) {
    graph.addNode(node);
  }
  for (const edge of result.edges) {
    graph.addEdge(edge);
  }
}