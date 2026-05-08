/**
 * TypeScript/JavaScript Parser Module
 *
 * Extracts import relationships and MODULE nodes using TypeScript Compiler API.
 */

// Types
export {
  type ParserResult,
  type ParsedImportInfo,
  type ParserOptions,
} from './types.js';

// Program creation
export {
  createParserProgram,
  resolveModulePath,
  type ParserProgramResult,
} from './program.js';

// Module Resolution Utilities
export {
  isBuiltinModule,
  extractPackageName,
  isNodeModulesPath,
  extractPackageFromNodeModules,
} from './module-resolution.js';

// External Node Creation
export {
  createExternalNode,
} from './external-node.js';

// Edge Generation
export {
  generateImportEdge,
  generateReExportEdge,
  generateDynamicImportEdge,
} from './edge-generator.js';

// Path Utilities
export {
  getRelativePath,
} from './path-utils.js';

// Parser Class and Convenience Function
export {
  TypeScriptParser,
  parseImports,
} from './class.js';