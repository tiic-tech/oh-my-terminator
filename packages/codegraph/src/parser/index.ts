/**
 * TypeScript/JavaScript Parser Module
 *
 * Extracts import relationships using TypeScript Compiler API
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