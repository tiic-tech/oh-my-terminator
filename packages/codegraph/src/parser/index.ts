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
  isNodeModulesPath,
  extractPackageFromNodeModules,
  type ParserResult,
  type ParsedImportInfo,
  type ParserOptions,
  type ParserProgramResult,
} from './ts-parser/index.js';

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
} from './module-extractor/index.js';

// C5: TypeScript Parser Adapter
export { TypeScriptParserAdapter } from './typescript-adapter.js';