/**
 * Complexity Calculator Tests: Base Cases
 *
 * Tests for base complexity (1) and simple functions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { calculateComplexity } from '../../../src/parser/module-extractor/complexity.js';

/**
 * Helper to parse code and get function node
 */
function parseFunction(code: string): ts.FunctionDeclaration {
  const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
  return sourceFile.statements[0] as ts.FunctionDeclaration;
}

/**
 * Helper to parse arrow function
 */
function parseArrowFunction(code: string): ts.VariableDeclaration {
  const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
  const varStmt = sourceFile.statements[0] as ts.VariableStatement;
  return varStmt.declarationList.declarations[0];
}

describe('calculateComplexity - Base Cases', () => {
  it('should return 1 for empty function', () => {
    const func = parseFunction('function empty() {}');
    assert.strictEqual(calculateComplexity(func), 1);
  });

  it('should return 1 for simple return', () => {
    const func = parseFunction('function simple() { return 1; }');
    assert.strictEqual(calculateComplexity(func), 1);
  });

  it('should return 1 for arrow function with no branching', () => {
    const decl = parseArrowFunction('const fn = () => 1;');
    assert.strictEqual(calculateComplexity(decl), 1);
  });
});

describe('calculateComplexity - Input Validation', () => {
  it('should throw error for non-function node', () => {
    const code = 'const x = 42;';
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const varStmt = sourceFile.statements[0] as ts.VariableStatement;

    assert.throws(
      () => calculateComplexity(varStmt),
      /calculateComplexity requires function-like node/
    );
  });
});