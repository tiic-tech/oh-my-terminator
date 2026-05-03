/**
 * @oh-my-terminator/codegraph
 *
 * Core graph data structure for repository relationship modeling
 */

export {
  NodeType,
  EdgeType,
  type GraphNode,
  type GraphEdge,
  type ModuleMetadata,
  type EdgeMetadata,
  type SerializedCodeGraph,
  // C5: Analyzer Types
  type FullAnalysisResult,
  type AnalysisStats,
  type AnalysisOptions,
  type ProgressEvent,
  type ProgressCallback,
  // C5: Parser Registry Types
  type ParserResult,
  type Parser,
  type ParserRegistry,
} from './types.js';

export { CodeGraph } from './graph.js';

export {
  DEFAULT_IGNORE_RULES,
  shouldIgnore,
} from './ignore-rules.js';

export {
  scanDirectory,
  isParseableFile,
  createDirectoryNode,
  createFileNode,
  createContainsEdge,
  type ScanResult,
  type ScanOptions,
} from './scanner.js';

export {
  TypeScriptParser,
  parseImports,
  createParserProgram,
  resolveModulePath,
  createExternalNode,
  generateImportEdge,
  generateReExportEdge,
  generateDynamicImportEdge,
  extractPackageName,
  isBuiltinModule,
  type ParseResult,
  type ParserResult,
  type ImportInfo,
  type ParserOptions,
  // C5: TypeScript Parser Adapter
  TypeScriptParserAdapter,
} from './parser/index.js';

// C5: Parser Registry
export { DefaultParserRegistry } from './parser-registry.js';