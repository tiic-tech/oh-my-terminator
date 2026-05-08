/**
 * Complexity Calculator Tests: Special Cases
 *
 * Tests for async, generator, and edge cases.
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

describe('calculateComplexity - Async Functions', () => {
  it('should not count async keyword', () => {
    const func = parseFunction('async function test() { return 1; }');
    assert.strictEqual(calculateComplexity(func), 1); // base only
  });

  it('should not count await as decision point', () => {
    const func = parseFunction('async function test() { await fetch(); return 1; }');
    assert.strictEqual(calculateComplexity(func), 1); // base only (await NOT counted)
  });

  it('should count try-catch around await', () => {
    const func = parseFunction(`
      async function test() {
        try { await fetch(); }
        catch (e) { return null; }
      }
    `);
    assert.strictEqual(calculateComplexity(func), 2); // base + catch
  });

  it('should count branching in async function', () => {
    const func = parseFunction(`
      async function test() {
        if (x) { await fetch(); }
        else { await save(); }
      }
    `);
    assert.strictEqual(calculateComplexity(func), 3); // base + if + else
  });
});

describe('calculateComplexity - Generator Functions', () => {
  it('should not count generator syntax', () => {
    const func = parseFunction('function* test() { yield 1; }');
    assert.strictEqual(calculateComplexity(func), 1); // base only
  });

  it('should count branching in generator', () => {
    const func = parseFunction(`
      function* test() {
        if (x) { yield 1; }
        else { yield 2; }
      }
    `);
    assert.strictEqual(calculateComplexity(func), 3); // base + if + else
  });
});

describe('calculateComplexity - Edge Cases', () => {
  it('should handle deeply nested conditions', () => {
    const func = parseFunction(`
      function test() {
        if (a) {
          if (b) {
            if (c) {
              return 1;
            }
          }
        }
      }
    `);
    assert.strictEqual(calculateComplexity(func), 4); // base + 3 ifs
  });

  it('should handle function expression', () => {
    const code = `const fn = function() { if (x) return 1; };`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const varStmt = sourceFile.statements[0] as ts.VariableStatement;
    const decl = varStmt.declarationList.declarations[0];
    const funcExpr = decl.initializer as ts.FunctionExpression;
    assert.strictEqual(calculateComplexity(funcExpr), 2); // base + if
  });

  it('should handle method declaration', () => {
    const code = `class Test { method() { if (x) return 1; } }`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const classDecl = sourceFile.statements[0] as ts.ClassDeclaration;
    const method = classDecl.members[0] as ts.MethodDeclaration;
    assert.strictEqual(calculateComplexity(method), 2); // base + if
  });
});