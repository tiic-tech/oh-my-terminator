import ts from 'typescript';
import { GraphNode, GraphEdge, NodeType, EdgeType } from '../types.js';
import { ModuleExtractor, ModuleExtractResult } from './module-extractor/index.js';

/**
 * Result of parsing a single file
 */
export interface ParseResult {
  /** EXTERNAL nodes created for unresolved imports */
  nodes: GraphNode[];

  /** IMPORTS, RE_EXPORTS, DYNAMIC_IMPORTS edges */
  edges: GraphEdge[];

  /** Non-fatal error/warning messages */
  warnings: string[];
}

/**
 * Result of parsing multiple files
 */
export interface ParserResult {
  /** All EXTERNAL nodes (deduplicated) */
  nodes: GraphNode[];

  /** All edges from all files */
  edges: GraphEdge[];

  /** Number of files successfully parsed */
  filesParsed: number;

  /** All warnings from all files */
  warnings: string[];
}

/**
 * Extracted import information
 */
export interface ImportInfo {
  /** Source file path (relative) */
  sourceFile: string;

  /** Import specifier (e.g., './utils', 'lodash') */
  specifier: string;

  /** Resolved file path (relative) or null for external */
  resolvedPath: string | null;

  /** Line number in source file */
  line: number;

  /** Import type */
  importType: 'import' | 're-export' | 'dynamic';

  /** Import specifier metadata (default, named:x, namespace, wildcard, dynamic, empty) */
  importSpecifier: string;
}

/**
 * Options for parser
 */
export interface ParserOptions {
  /** Custom compiler options (overrides tsconfig) */
  compilerOptions?: ts.CompilerOptions;

  /** Skip files with syntax errors */
  skipErrors?: boolean;
}

/**
 * Create a TypeScript Program for parsing
 *
 * @param filePaths - Absolute paths to files to parse
 * @param projectRoot - Absolute path to project root
 * @param options - Optional parser configuration
 * @returns TypeScript Program instance
 */
export function createParserProgram(
  filePaths: string[],
  projectRoot: string,
  options?: ParserOptions
): ts.Program {
  // Find tsconfig.json
  const configPath = ts.findConfigFile(projectRoot, ts.sys.fileExists, 'tsconfig.json');

  let compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    allowJs: true,
    checkJs: false,
    noEmit: true,
    resolveJsonModule: true,
  };

  // Read tsconfig.json if found
  if (configPath) {
    const configResult = ts.readConfigFile(configPath, ts.sys.readFile);
    if (!configResult.error) {
      const parsedConfig = ts.parseJsonConfigFileContent(
        configResult.config,
        ts.sys,
        projectRoot
      );
      compilerOptions = { ...compilerOptions, ...parsedConfig.options };
    }
  }

  // Apply custom options
  if (options?.compilerOptions) {
    compilerOptions = { ...compilerOptions, ...options.compilerOptions };
  }

  return ts.createProgram(filePaths, compilerOptions);
}

/**
 * Resolve module specifier to file path
 *
 * Uses TypeScript's module resolution. Returns null for external modules.
 *
 * @param specifier - Import specifier (e.g., './utils', 'lodash')
 * @param sourceFile - Source file path (absolute)
 * @param program - TypeScript Program instance
 * @returns Resolved file path (absolute) or null for external
 */
export function resolveModulePath(
  specifier: string,
  sourceFile: string,
  program: ts.Program
): string | null {
  const compilerOptions = program.getCompilerOptions();

  const resolved = ts.resolveModuleName(specifier, sourceFile, compilerOptions, ts.sys);

  if (resolved.resolvedModule) {
    return resolved.resolvedModule.resolvedFileName;
  }

  return null;
}

/**
 * Check if a specifier is a built-in Node.js module
 */
const BUILTIN_MODULES = new Set([
  'fs', 'path', 'os', 'crypto', 'util', 'stream', 'events', 'buffer',
  'http', 'https', 'url', 'net', 'dns', 'child_process', 'cluster',
  ' readline', 'repl', 'vm', 'module', 'assert', 'console', 'process',
  'timers', 'zlib', 'punycode', 'string_decoder', 'querystring',
]);

export function isBuiltinModule(specifier: string): boolean {
  // Handle node: prefix
  if (specifier.startsWith('node:')) {
    return true;
  }
  return BUILTIN_MODULES.has(specifier);
}

/**
 * Extract package name from specifier
 *
 * @param specifier - Import specifier (e.g., 'lodash/debounce', '@utils/format')
 * @returns Package name (e.g., 'lodash', '@utils')
 */
export function extractPackageName(specifier: string): string {
  // Built-in modules
  if (isBuiltinModule(specifier)) {
    return specifier.replace(/^node:/, '');
  }

  // Scoped packages (@scope/package)
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }

  // Regular packages (package/subpath)
  const firstSlash = specifier.indexOf('/');
  return firstSlash > 0 ? specifier.substring(0, firstSlash) : specifier;
}

/**
 * Create an EXTERNAL node for a package
 *
 * @param packageName - Package name (e.g., 'lodash', '@types/node')
 * @returns GraphNode with EXTERNAL type
 */
export function createExternalNode(packageName: string): GraphNode {
  return {
    id: `EXTERNAL:${packageName}`,
    type: NodeType.EXTERNAL,
    path: packageName,
    name: packageName,
  };
}

/**
 * Generate an IMPORTS edge from import info
 */
export function generateImportEdge(info: ImportInfo): GraphEdge {
  const targetId = info.resolvedPath
    ? `FILE:${info.resolvedPath}`
    : `EXTERNAL:${extractPackageName(info.specifier)}`;

  return {
    from: `FILE:${info.sourceFile}`,
    to: targetId,
    type: EdgeType.IMPORTS,
    metadata: {
      line: info.line,
      importSpecifier: info.importSpecifier,
    },
  };
}

/**
 * Generate a RE_EXPORTS edge from import info
 */
export function generateReExportEdge(info: ImportInfo): GraphEdge {
  const targetId = info.resolvedPath
    ? `FILE:${info.resolvedPath}`
    : `EXTERNAL:${extractPackageName(info.specifier)}`;

  return {
    from: `FILE:${info.sourceFile}`,
    to: targetId,
    type: EdgeType.RE_EXPORTS,
    metadata: {
      line: info.line,
      importSpecifier: info.importSpecifier,
    },
  };
}

/**
 * Generate a DYNAMIC_IMPORTS edge from import info
 */
export function generateDynamicImportEdge(info: ImportInfo): GraphEdge {
  const targetId = info.resolvedPath
    ? `FILE:${info.resolvedPath}`
    : `EXTERNAL:${extractPackageName(info.specifier)}`;

  return {
    from: `FILE:${info.sourceFile}`,
    to: targetId,
    type: EdgeType.DYNAMIC_IMPORTS,
    metadata: {
      line: info.line,
      importSpecifier: 'dynamic',
    },
  };
}

/**
 * TypeScript Parser class
 *
 * Extracts import relationships from TypeScript/JavaScript files using
 * TypeScript Compiler API.
 *
 * @example
 * ```typescript
 * const parser = new TypeScriptParser('/path/to/project');
 * const result = parser.parseAll(['/path/to/file1.ts', '/path/to/file2.ts']);
 * result.nodes.forEach(n => graph.addNode(n));
 * result.edges.forEach(e => graph.addEdge(e));
 * ```
 */
export class TypeScriptParser {
  private program: ts.Program | null = null;
  private projectRoot: string;
  private options: ParserOptions;

  /**
   * Create a TypeScript parser instance
   *
   * @param projectRoot - Absolute path to project root directory
   * @param options - Optional parser configuration
   */
  constructor(projectRoot: string, options?: ParserOptions) {
    this.projectRoot = projectRoot;
    this.options = options ?? {};
  }

  /**
   * Parse all files and return combined result
   *
   * Creates a single TypeScript Program instance and processes all files.
   * EXTERNAL nodes are deduplicated across all files.
   *
   * @param filePaths - Absolute paths to TypeScript/JavaScript files
   * @returns ParserResult with nodes, edges, filesParsed count, and warnings
   */
  parseAll(filePaths: string[]): ParserResult {
    const result: ParserResult = {
      nodes: [],
      edges: [],
      filesParsed: 0,
      warnings: [],
    };

    if (filePaths.length === 0) {
      return result;
    }

    // Create single Program instance
    this.program = createParserProgram(filePaths, this.projectRoot, this.options);

    // External nodes deduplication map
    const externalNodes = new Map<string, GraphNode>();

    for (const filePath of filePaths) {
      try {
        const fileResult = this.parseFile(filePath);

        // Deduplicate EXTERNAL nodes
        for (const node of fileResult.nodes) {
          if (node.type === NodeType.EXTERNAL) {
            if (!externalNodes.has(node.id)) {
              externalNodes.set(node.id, node);
            }
          } else {
            result.nodes.push(node);
          }
        }

        result.edges.push(...fileResult.edges);
        result.warnings.push(...fileResult.warnings);
        result.filesParsed++;
      } catch (error) {
        const msg = error instanceof Error
          ? `${error.message}\nStack: ${error.stack}`
          : String(error);
        result.warnings.push(`Error parsing ${filePath}: ${msg}`);
      }
    }

    // Add deduplicated EXTERNAL nodes
    result.nodes.push(...externalNodes.values());

    return result;
  }

  /**
   * Parse a single file
   *
   * @param filePath - Absolute path to the file to parse
   * @returns ParseResult with nodes, edges, and warnings for this file
   */
  parseFile(filePath: string): ParseResult {
    const result: ParseResult = {
      nodes: [],
      edges: [],
      warnings: [],
    };

    // Initialize program if not exists (for standalone parseFile calls)
    if (!this.program) {
      this.program = createParserProgram([filePath], this.projectRoot, this.options);
    }

    const sourceFile = this.program.getSourceFile(filePath);
    if (!sourceFile) {
      result.warnings.push(`Source file not found: ${filePath}`);
      return result;
    }

    // Get relative path
    const relativePath = this.getRelativePath(filePath);

    // Extract imports
    const imports = this.extractImports(sourceFile, relativePath);
    for (const info of imports) {
      if (info.importType === 'import') {
        result.edges.push(generateImportEdge(info));
      } else if (info.importType === 're-export') {
        result.edges.push(generateReExportEdge(info));
      } else if (info.importType === 'dynamic') {
        result.edges.push(generateDynamicImportEdge(info));
      }

      // Create EXTERNAL node if needed
      if (!info.resolvedPath && info.specifier) {
        const packageName = extractPackageName(info.specifier);
        const nodeId = `EXTERNAL:${packageName}`;
        // Note: deduplication happens in parseAll
        result.nodes.push(createExternalNode(packageName));
      }
    }

    // Extract MODULE nodes
    if (this.program) {
      const moduleExtractor = new ModuleExtractor(this.program, this.projectRoot);
      const moduleResult = moduleExtractor.extractModules(sourceFile);
      result.nodes.push(...moduleResult.nodes);
      result.edges.push(...moduleResult.edges);
      result.warnings.push(...moduleResult.warnings);
    }

    return result;
  }

  /**
   * Extract all imports from a source file
   */
  private extractImports(sourceFile: ts.SourceFile, relativePath: string): ImportInfo[] {
    const imports: ImportInfo[] = [];

    // Properly traverse all nodes in the source file
    const visit = (node: ts.Node) => {
      // Import declarations
      if (ts.isImportDeclaration(node)) {
        const specifier = this.getModuleSpecifier(node);
        if (specifier) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
          const resolvedPath = this.resolveSpecifier(specifier, sourceFile.fileName);
          const importSpecifier = this.getImportSpecifierType(node, sourceFile);

          imports.push({
            sourceFile: relativePath,
            specifier,
            resolvedPath,
            line,
            importType: 'import',
            importSpecifier,
          });
        }
        return; // Don't traverse into import declarations
      }

      // Export declarations with source
      if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        const specifier = this.getModuleSpecifier(node);
        if (specifier) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
          const resolvedPath = this.resolveSpecifier(specifier, sourceFile.fileName);
          const importSpecifier = this.getExportSpecifierType(node, sourceFile);

          imports.push({
            sourceFile: relativePath,
            specifier,
            resolvedPath,
            line,
            importType: 're-export',
            importSpecifier,
          });
        }
        return; // Don't traverse into export declarations
      }

      // Dynamic imports (import() calls)
      if (ts.isCallExpression(node)) {
        const exprText = node.expression.getText(sourceFile);
        if (exprText === 'import' || (ts.isIdentifier(node.expression) && node.expression.text === 'import')) {
          const arg = node.arguments[0];
          if (arg && ts.isStringLiteral(arg)) {
            const specifier = arg.text;
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
            const resolvedPath = this.resolveSpecifier(specifier, sourceFile.fileName);

            imports.push({
              sourceFile: relativePath,
              specifier,
              resolvedPath,
              line,
              importType: 'dynamic',
              importSpecifier: 'dynamic',
            });
          } else if (arg) {
            // Variable argument - create placeholder
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
            imports.push({
              sourceFile: relativePath,
              specifier: '__dynamic__',
              resolvedPath: null,
              line,
              importType: 'dynamic',
              importSpecifier: 'dynamic',
            });
          }
        }
      }

      // Continue traversal
      ts.forEachChild(node, visit);
    };

    // Start traversal
    ts.forEachChild(sourceFile, visit);

    return imports;
  }

  /**
   * Get module specifier string from import/export declaration
   */
  private getModuleSpecifier(node: ts.ImportDeclaration | ts.ExportDeclaration): string | null {
    if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      return node.moduleSpecifier.text;
    }
    return null;
  }

  /**
   * Resolve module specifier to relative path
   */
  private resolveSpecifier(specifier: string, sourceFileName: string): string | null {
    if (!this.program) return null;

    const resolved = resolveModulePath(specifier, sourceFileName, this.program);
    if (resolved) {
      return this.getRelativePath(resolved);
    }
    return null;
  }

  /**
   * Get relative path from absolute path
   */
  private getRelativePath(absolutePath: string): string {
    return absolutePath.replace(this.projectRoot, '').replace(/^[/\\]/, '');
  }

  /**
   * Determine import specifier type for metadata
   */
  private getImportSpecifierType(node: ts.ImportDeclaration, sourceFile?: ts.SourceFile): string {
    const importClause = node.importClause;

    if (!importClause) {
      return 'empty'; // Side-effect import: import './setup'
    }

    // Default import
    if (importClause.name) {
      return 'default';
    }

    // Named bindings
    if (importClause.namedBindings) {
      if (ts.isNamespaceImport(importClause.namedBindings)) {
        return 'namespace';
      }
      if (ts.isNamedImports(importClause.namedBindings)) {
        const sf = sourceFile ?? node.getSourceFile();
        const names = importClause.namedBindings.elements
          .map((e) => e.name.getText(sf))
          .join(',');
        return `named:${names}`;
      }
    }

    return 'empty';
  }

  /**
   * Determine export specifier type for metadata
   */
  private getExportSpecifierType(node: ts.ExportDeclaration, sourceFile?: ts.SourceFile): string {
    // Wildcard: export * from './utils'
    if (node.exportClause && ts.isNamespaceExport(node.exportClause)) {
      return 'wildcard';
    }

    // Named re-exports: export { x, y } from './utils'
    if (node.exportClause && ts.isNamedExports(node.exportClause)) {
      const sf = sourceFile ?? node.getSourceFile();
      const names = node.exportClause.elements
        .map((e) => e.name.getText(sf))
        .join(',');
      return `named:${names}`;
    }

    // No export clause: export * from './utils' (implicit wildcard)
    if (!node.exportClause) {
      return 'wildcard';
    }

    return 'empty';
  }
}

/**
 * Convenience function to parse imports from files
 *
 * @param filePaths - Absolute paths to TypeScript/JavaScript files
 * @param projectRoot - Absolute path to project root
 * @param options - Optional parser configuration
 * @returns ParserResult with nodes, edges, and warnings
 */
export function parseImports(
  filePaths: string[],
  projectRoot: string,
  options?: ParserOptions
): ParserResult {
  const parser = new TypeScriptParser(projectRoot, options);
  return parser.parseAll(filePaths);
}