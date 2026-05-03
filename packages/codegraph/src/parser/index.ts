/**
 * TypeScript/JavaScript Parser Module
 *
 * Extracts import relationships and MODULE nodes using TypeScript Compiler API
 */

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
} from './ts-parser.js';

export {
  ModuleExtractor,
  extractModules,
  detectKind,
  calculateComplexity,
  countLOC,
  extractJSDoc,
  generateModuleId,
  type ModuleKind,
  type ModuleMetadata,
  type ModuleExtractResult,
} from './module-extractor.js';