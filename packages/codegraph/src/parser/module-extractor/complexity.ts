/**
 * Complexity Calculator
 *
 * Calculate McCabe cyclomatic complexity
 */

import ts from 'typescript';

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