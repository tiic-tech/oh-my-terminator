/**
 * Complexity Calculator
 *
 * Calculate McCabe cyclomatic complexity
 *
 * D3 Resolution: McCabe standard
 * - Base: 1
 * - if: +1, else: +1 (but else-if is NOT counted as separate if)
 * - for/while/do-while/for-of/for-in: +1
 * - switch case: +1 each (default NOT counted as it's fallback path)
 * - catch: +1
 * - && || ??: +1 each
 * - ?: ternary: +1
 *
 * Else-if chain handling (per design.md Decision):
 * - `if (a) {}` → +1 for if
 * - `if (a) {} else {}` → +2 (if + standalone else)
 * - `if (a) {} else if (b) {}` → +1 (else-if is continuation, not separate)
 * - `if (a) {} else if (b) {} else {}` → +2 (if + final else after else-if)
 */

import ts from 'typescript';

/**
 * Check if node is function-like or contains function-like (valid input for complexity)
 *
 * WHY: calculateComplexity only meaningful for functions/methods.
 * Also handles VariableDeclaration containing ArrowFunction/FunctionExpression.
 * Validation prevents silent misuse but allows common patterns.
 */
function isFunctionLikeOrContainsFunction(node: ts.Node): boolean {
  // Direct function-like nodes
  if (ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node) ||
      ts.isConstructorDeclaration(node)) {
    return true;
  }

  // VariableDeclaration with function initializer
  if (ts.isVariableDeclaration(node)) {
    const init = node.initializer;
    return init !== undefined && (
      ts.isArrowFunction(init) || ts.isFunctionExpression(init)
    );
  }

  return false;
}

/**
 * Extract the actual function node for complexity calculation
 *
 * For VariableDeclaration with function initializer, returns the initializer.
 * For direct function-like nodes, returns the node itself.
 */
function extractFunctionNode(node: ts.Node): ts.Node | null {
  if (ts.isVariableDeclaration(node)) {
    const init = node.initializer;
    if (init !== undefined && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
      return init;
    }
    return null;
  }

  if (isFunctionLikeOrContainsFunction(node)) {
    return node;
  }

  return null;
}

/**
 * Traverse else-if chain, handling final else correctly
 *
 * WHY extracted: Reduces nesting depth from 3 to 1 (coding-taste Rule 2).
 * Per McCabe: else-if is continuation, not separate branch.
 * Only final standalone else counts as +1.
 *
 * @param elseIfStmt - The else-if statement to traverse
 * @param visit - Visitor function for nested nodes
 * @param complexity - Complexity counter (mutated)
 */
function traverseElseIfChain(
  elseIfStmt: ts.IfStatement,
  visit: (n: ts.Node) => void,
  complexity: { value: number }
): void {
  // Visit the condition (may contain logical operators)
  visit(elseIfStmt.expression);

  // Visit the thenStatement (may contain nested branches)
  visit(elseIfStmt.thenStatement);

  // Handle else
  if (elseIfStmt.elseStatement) {
    if (ts.isIfStatement(elseIfStmt.elseStatement)) {
      // Another else-if - continue chain without counting
      traverseElseIfChain(elseIfStmt.elseStatement, visit, complexity);
    } else {
      // Final standalone else - count it
      complexity.value++;
      // Visit the else body
      visit(elseIfStmt.elseStatement);
    }
  }
}

/**
 * Handle IfStatement with correct else-if chain counting
 *
 * Per McCabe/design.md:
 * - Each if counts +1
 * - Standalone else (NOT else-if) counts +1
 * - Else-if is NOT counted as separate if (it's continuation of parent's false branch)
 *
 * @param ifStmt - The if statement to handle
 * @param visit - Visitor function for nested nodes
 * @param complexity - Complexity counter (mutated)
 */
function handleIfStatement(
  ifStmt: ts.IfStatement,
  visit: (n: ts.Node) => void,
  complexity: { value: number }
): void {
  // Count the if itself
  complexity.value++;

  // Visit the condition (may contain logical operators)
  visit(ifStmt.expression);

  // Visit the thenStatement (may contain nested branches)
  visit(ifStmt.thenStatement);

  // Handle else chain
  if (ifStmt.elseStatement) {
    if (ts.isIfStatement(ifStmt.elseStatement)) {
      // This is an else-if - don't count as IfStatement
      // Traverse its chain to find final else
      traverseElseIfChain(ifStmt.elseStatement, visit, complexity);
    } else {
      // This is a standalone else - count it
      complexity.value++;
      // Visit the else body
      visit(ifStmt.elseStatement);
    }
  }
}

/**
 * Calculate McCabe cyclomatic complexity
 *
 * @param node - Function AST node (function-like or VariableDeclaration with function initializer)
 * @returns Complexity number
 * @throws Error if node is not function-like or doesn't contain a function
 */
export function calculateComplexity(node: ts.Node): number {
  // Input validation: ensure node is function-like or contains function
  if (!isFunctionLikeOrContainsFunction(node)) {
    throw new Error(
      `calculateComplexity requires function-like node. ` +
      `Received: ${ts.SyntaxKind[node.kind]}. ` +
      `Valid types: FunctionDeclaration, FunctionExpression, ArrowFunction, MethodDeclaration, ` +
      `GetAccessor, SetAccessor, ConstructorDeclaration, or VariableDeclaration with function initializer.`
    );
  }

  // Extract actual function node (handles VariableDeclaration case)
  const functionNode = extractFunctionNode(node) ?? node;

  // Use object to allow mutation in nested functions
  const complexity = { value: 1 }; // Base

  /**
   * Visit AST node and count decision points
   */
  function visit(n: ts.Node): void {
    // if statement - special handling for else-if chains
    if (ts.isIfStatement(n)) {
      handleIfStatement(n, visit, complexity);
      return;
    }

    // for/while/do-while/for-of/for-in
    if (ts.isForStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n) ||
        ts.isForOfStatement(n) || ts.isForInStatement(n)) {
      complexity.value++;
    }

    // switch case (default NOT counted - it's fallback path per McCabe)
    if (ts.isCaseClause(n)) {
      complexity.value++;
    }

    // catch block
    if (ts.isCatchClause(n)) {
      complexity.value++;
    }

    // Binary expressions with logical operators (including ??)
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken ||
          op === ts.SyntaxKind.BarBarToken ||
          op === ts.SyntaxKind.QuestionQuestionToken) {
        complexity.value++;
      }
    }

    // Ternary conditional
    if (ts.isConditionalExpression(n)) {
      complexity.value++;
    }

    // Recursively visit children
    ts.forEachChild(n, visit);
  }

  // Start traversal on the actual function node
  ts.forEachChild(functionNode, visit);
  return complexity.value;
}