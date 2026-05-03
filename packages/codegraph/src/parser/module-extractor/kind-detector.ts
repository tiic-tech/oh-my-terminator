/**
 * Module Kind Detector
 *
 * Detects module kind from TypeScript AST nodes
 */

import ts from 'typescript';
import { ModuleKind } from './types.js';

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
    const sf = sourceFile ?? node.getSourceFile();
    // Check if it's a component
    if (sf && isComponentFunction(node, sf)) {
      return 'component';
    }
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
 * Check if FunctionDeclaration is a React component
 */
function isComponentFunction(func: ts.FunctionDeclaration, sourceFile: ts.SourceFile): boolean {
  // Check if hook (useXxx)
  if (func.name && func.name.text.startsWith('use')) {
    return false;
  }

  // Check return type
  const returnType = func.type;
  if (returnType) {
    const typeText = returnType.getText(sourceFile);
    if (typeText.includes('JSX.Element') || typeText.includes('ReactElement') || typeText.includes('React.ReactNode')) {
      return true;
    }
  }

  // Check body for JSX elements
  if (func.body) {
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

  return false;
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