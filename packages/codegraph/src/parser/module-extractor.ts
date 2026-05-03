import ts from 'typescript';
import { GraphNode, GraphEdge, NodeType, EdgeType } from '../types.js';

/**
 * Module kind classification
 */
export type ModuleKind = 'function' | 'class' | 'interface' | 'type' | 'component' | 'variable';

/**
 * Extended metadata for MODULE nodes
 */
export interface ModuleMetadata {
  /** Kind classification */
  kind: ModuleKind;

  /** JSDoc comment (first 200 chars) */
  jsDoc?: string;

  /** McCabe cyclomatic complexity */
  complexity?: number;

  /** Effective lines of code */
  loc?: number;

  /** For named default exports */
  namedDefault?: boolean;

  /** For renamed exports */
  originalName?: string;

  /** For enums */
  enumMembers?: string[];

  /** For multiple exports of same symbol */
  exports?: string[];
}

/**
 * Result of extracting modules from a single file
 */
export interface ModuleExtractResult {
  /** MODULE nodes created */
  nodes: GraphNode[];

  /** CONTAINS edges from FILE to MODULE */
  edges: GraphEdge[];

  /** Non-fatal warnings */
  warnings: string[];
}

/**
 * Detect module kind from AST node
 *
 * @param node - TypeScript AST node
 * @param sourceFile - Source file context (for component detection)
 * @returns ModuleKind classification
 */
export function detectKind(node: ts.Node, sourceFile?: ts.SourceFile): ModuleKind {
  // FunctionDeclaration
  if (ts.isFunctionDeclaration(node)) {
    return 'function';
  }

  // ClassDeclaration
  if (ts.isClassDeclaration(node)) {
    return 'class';
  }

  // InterfaceDeclaration
  if (ts.isInterfaceDeclaration(node)) {
    return 'interface';
  }

  // TypeAliasDeclaration
  if (ts.isTypeAliasDeclaration(node)) {
    return 'type';
  }

  // EnumDeclaration
  if (ts.isEnumDeclaration(node)) {
    return 'type';
  }

  // VariableDeclaration
  if (ts.isVariableDeclaration(node)) {
    const init = node.initializer;

    if (init) {
      // Arrow function or function expression
      if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
        // Check if it's a component
        const sf = sourceFile ?? node.getSourceFile();
        if (isComponent(init, sf)) {
          return 'component';
        }
        return 'function';
      }

      // JSX element or React.createElement
      if (ts.isJsxElement(init) || ts.isJsxSelfClosingElement(init)) {
        return 'component';
      }
    }

    return 'variable';
  }

  return 'variable';
}

/**
 * Check if function is a React component
 *
 * A2 Resolution: Dual criteria
 * 1. Return type is JSX.Element or React.ReactElement
 * 2. Body contains JSX elements
 *
 * Excludes hooks (useXxx)
 */
function isComponent(func: ts.ArrowFunction | ts.FunctionExpression, sourceFile: ts.SourceFile): boolean {
  // Check if hook (useXxx)
  const funcName = getFunctionName(func);
  if (funcName && funcName.startsWith('use')) {
    return false;
  }

  // Check return type
  const returnType = func.type;
  if (returnType) {
    const typeText = returnType.getText(sourceFile);
    if (typeText.includes('JSX.Element') || typeText.includes('ReactElement')) {
      return true;
    }
  }

  // Check body for JSX elements
  let hasJsx = false;
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      hasJsx = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(func.body, visit);

  return hasJsx;
}

/**
 * Get function name if available
 */
function getFunctionName(func: ts.ArrowFunction | ts.FunctionExpression): string | undefined {
  // Arrow functions typically don't have names
  // Function expressions may have names
  if (ts.isFunctionExpression(func) && func.name) {
    return func.name.text;
  }
  return undefined;
}

/**
 * Calculate McCabe cyclomatic complexity
 *
 * D3 Resolution: McCabe standard
 * - Base: 1
 * - if: +1, else/else if: +1
 * - for/while/do-while: +1
 * - switch case: +1 each
 * - catch: +1
 * - && || ??: +1
 * - ?: ternary: +1
 *
 * @param node - Function AST node
 * @returns Complexity number
 */
export function calculateComplexity(node: ts.Node): number {
  let complexity = 1; // Base

  const visit = (n: ts.Node) => {
    // if statement
    if (ts.isIfStatement(n)) {
      complexity++;
      // else clause
      if (n.elseStatement) {
        complexity++;
      }
    }

    // for/while/do-while
    if (ts.isForStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n)) {
      complexity++;
    }

    // switch case
    if (ts.isCaseClause(n)) {
      complexity++;
    }

    // catch block
    if (ts.isCatchClause(n)) {
      complexity++;
    }

    // Binary expressions with logical operators
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken ||
          op === ts.SyntaxKind.BarBarToken) {
        complexity++;
      }
    }

    // Nullish coalescing
    if (ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
      complexity++;
    }

    // Ternary conditional
    if (ts.isConditionalExpression(n)) {
      complexity++;
    }

    ts.forEachChild(n, visit);
  };

  ts.forEachChild(node, visit);
  return complexity;
}

/**
 * Count effective lines of code
 *
 * D5 Resolution:
 * - Include: code, import, export, type definition
 * - Exclude: empty lines, comments
 *
 * @param sourceFile - Source file
 * @param node - AST node to count
 * @returns LOC number
 */
export function countLOC(sourceFile: ts.SourceFile, node: ts.Node): number {
  const start = node.getStart(sourceFile);
  const end = node.getEnd();
  const text = sourceFile.text.substring(start, end);
  const lines = text.split('\n');

  let loc = 0;
  let inCommentBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Empty line
    if (trimmed.length === 0) {
      continue;
    }

    // Multi-line comment start
    if (trimmed.startsWith('/*') || trimmed.startsWith('/**')) {
      inCommentBlock = true;
      // Check if it ends on same line
      if (trimmed.endsWith('*/')) {
        inCommentBlock = false;
      }
      continue;
    }

    // In comment block
    if (inCommentBlock) {
      if (trimmed.endsWith('*/')) {
        inCommentBlock = false;
      }
      continue;
    }

    // Single-line comment
    if (trimmed.startsWith('//')) {
      continue;
    }

    // Code line
    loc++;
  }

  return loc;
}

/**
 * Extract JSDoc comment from node
 *
 * A3 Resolution: First 200 characters
 *
 * @param node - AST node
 * @param sourceFile - Optional source file (needed when node.getSourceFile() is undefined)
 * @returns JSDoc text or undefined
 */
export function extractJSDoc(node: ts.Node, sourceFile?: ts.SourceFile): string | undefined {
  const sf = sourceFile ?? node.getSourceFile();
  if (!sf) {
    return undefined;
  }

  // Use getFullStart to include leading trivia (comments)
  const nodeFullStart = node.getFullStart();

  // JSDoc comments appear before the node
  const comments = ts.getLeadingCommentRanges(sf.text, nodeFullStart);

  if (!comments || comments.length === 0) {
    return undefined;
  }

  // Find JSDoc comment (/** ... */)
  for (const comment of comments) {
    const text = sf.text.substring(comment.pos, comment.end);

    if (text.startsWith('/**') && text.endsWith('*/')) {
      // Extract content (strip /** and */)
      let content = text.slice(3, -2).trim();

      // Remove leading * from each line
      content = content.split('\n')
        .map(line => line.replace(/^\s*\*\s?/, '').trim())
        .join('\n');

      // Truncate at 200 chars
      if (content.length > 200) {
        return content.substring(0, 200) + '...';
      }

      return content;
    }
  }

  return undefined;
}

/**
 * Generate MODULE node ID
 *
 * D1 Resolution: MODULE:filePath#exportName
 *
 * @param filePath - Relative file path
 * @param name - Export name
 * @returns MODULE ID string
 */
export function generateModuleId(filePath: string, name: string): string {
  return `MODULE:${filePath}#${name}`;
}

/**
 * Module Extractor class
 */
export class ModuleExtractor {
  private program: ts.Program;
  private projectRoot: string;

  constructor(program: ts.Program, projectRoot: string) {
    this.program = program;
    this.projectRoot = projectRoot;
  }

  /**
   * Extract modules from source file
   */
  extractModules(sourceFile: ts.SourceFile): ModuleExtractResult {
    const result: ModuleExtractResult = {
      nodes: [],
      edges: [],
      warnings: [],
    };

    const relativePath = this.getRelativePath(sourceFile.fileName);
    const fileId = `FILE:${relativePath}`;

    // Track export names to handle duplicates
    const exportNames = new Map<string, number>();

    // Traverse declarations
    ts.forEachChild(sourceFile, (node) => {
      // Check if exported
      if (this.isExported(node)) {
        this.processDeclaration(node, sourceFile, relativePath, fileId, result, exportNames);
      }
    });

    // Also process export declarations
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isExportDeclaration(node)) {
        this.processExportDeclaration(node, sourceFile, relativePath, fileId, result, exportNames);
      }
    });

    return result;
  }

  /**
   * Process individual declaration
   */
  private processDeclaration(
    node: ts.Node,
    sourceFile: ts.SourceFile,
    relativePath: string,
    fileId: string,
    result: ModuleExtractResult,
    exportNames: Map<string, number>
  ): void {
    let name: string;
    let kind: ModuleKind;
    let hasName = true;

    if (ts.isFunctionDeclaration(node)) {
      name = node.name?.text ?? 'default';
      hasName = !!node.name;
      kind = 'function';
    } else if (ts.isClassDeclaration(node)) {
      name = node.name?.text ?? 'default';
      hasName = !!node.name;
      kind = 'class';
    } else if (ts.isInterfaceDeclaration(node)) {
      name = node.name.text;
      kind = 'interface';
    } else if (ts.isTypeAliasDeclaration(node)) {
      name = node.name.text;
      kind = 'type';
    } else if (ts.isEnumDeclaration(node)) {
      name = node.name.text;
      kind = 'type';
    } else if (ts.isVariableStatement(node)) {
      // Handle variable exports
      const decls = node.declarationList.declarations;
      for (const decl of decls) {
        const varName = decl.name.getText(sourceFile);
        const varKind = detectKind(decl, sourceFile);
        this.createModuleNode(decl, sourceFile, relativePath, fileId, varName, varKind, result, exportNames, true);
      }
      return;
    } else {
      return;
    }

    this.createModuleNode(node, sourceFile, relativePath, fileId, name, kind, result, exportNames, hasName);
  }

  /**
   * Create MODULE node with all metadata
   */
  private createModuleNode(
    node: ts.Node,
    sourceFile: ts.SourceFile,
    relativePath: string,
    fileId: string,
    name: string,
    kind: ModuleKind,
    result: ModuleExtractResult,
    exportNames: Map<string, number>,
    hasName: boolean
  ): void {
    // Handle duplicate names (anonymous defaults)
    let finalName = name;
    const count = exportNames.get(name) ?? 0;
    if (count > 0) {
      finalName = `${name}_${count}`;
    }
    exportNames.set(name, count + 1);

    // Generate ID
    const moduleId = generateModuleId(relativePath, finalName);

    // Extract metadata
    const metadata: ModuleMetadata = { kind };

    // JSDoc
    const jsdoc = extractJSDoc(node, sourceFile);
    if (jsdoc) {
      metadata.jsDoc = jsdoc;
    }

    // Complexity (for functions/methods)
    if (kind === 'function' || kind === 'component') {
      metadata.complexity = calculateComplexity(node);
      metadata.loc = countLOC(sourceFile, node);
    }

    // Named default
    if (name !== 'default' && !hasName) {
      metadata.namedDefault = true;
    }

    // For enums
    if (ts.isEnumDeclaration(node)) {
      metadata.enumMembers = node.members.map(m => m.name.getText(sourceFile));
    }

    // Create node
    result.nodes.push({
      id: moduleId,
      type: NodeType.MODULE,
      path: relativePath,
      name: finalName,
      metadata,
    });

    // Create CONTAINS edge
    result.edges.push({
      from: fileId,
      to: moduleId,
      type: EdgeType.CONTAINS,
    });
  }

  /**
   * Process export declaration (export { x } or export { x as y })
   */
  private processExportDeclaration(
    node: ts.ExportDeclaration,
    sourceFile: ts.SourceFile,
    relativePath: string,
    fileId: string,
    result: ModuleExtractResult,
    exportNames: Map<string, number>
  ): void {
    if (!node.exportClause) {
      return;
    }

    if (ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) {
        const exportedName = element.name.text;
        const originalName = element.propertyName?.text ?? exportedName;

        // We need to find the actual declaration
        // For now, create node with exported name
        const kind: ModuleKind = 'variable'; // Default

        const metadata: ModuleMetadata = { kind };
        if (originalName !== exportedName) {
          metadata.originalName = originalName;
        }

        // Handle duplicates
        let finalName = exportedName;
        const count = exportNames.get(exportedName) ?? 0;
        if (count > 0) {
          finalName = `${exportedName}_${count}`;
        }
        exportNames.set(exportedName, count + 1);

        const moduleId = generateModuleId(relativePath, finalName);

        result.nodes.push({
          id: moduleId,
          type: NodeType.MODULE,
          path: relativePath,
          name: finalName,
          metadata,
        });

        result.edges.push({
          from: fileId,
          to: moduleId,
          type: EdgeType.CONTAINS,
        });
      }
    }
  }

  /**
   * Check if node is exported
   */
  private isExported(node: ts.Node): boolean {
    // Check for export modifier
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    if (modifiers) {
      for (const mod of modifiers) {
        if (mod.kind === ts.SyntaxKind.ExportKeyword) {
          // Check for default
          for (const m of modifiers) {
            if (m.kind === ts.SyntaxKind.DefaultKeyword) {
              return true; // export default
            }
          }
          return true; // export
        }
      }
    }
    return false;
  }

  /**
   * Get relative path from absolute path
   */
  private getRelativePath(absolutePath: string): string {
    return absolutePath.replace(this.projectRoot, '').replace(/^[/\\]/, '');
  }
}

/**
 * Convenience function to extract modules
 */
export function extractModules(
  sourceFiles: ts.SourceFile[],
  program: ts.Program,
  projectRoot: string
): ModuleExtractResult {
  const extractor = new ModuleExtractor(program, projectRoot);
  const result: ModuleExtractResult = {
    nodes: [],
    edges: [],
    warnings: [],
  };

  for (const sourceFile of sourceFiles) {
    const fileResult = extractor.extractModules(sourceFile);
    result.nodes.push(...fileResult.nodes);
    result.edges.push(...fileResult.edges);
    result.warnings.push(...fileResult.warnings);
  }

  return result;
}