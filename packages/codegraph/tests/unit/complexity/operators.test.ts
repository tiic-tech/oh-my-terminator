/**
 * Complexity Calculator Tests: Operators
 *
 * Tests for ternary and logical operators.
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

describe('calculateComplexity - Ternary Operator', () => {
  it('should count ternary as +1', () => {
    const func = parseFunction('function test() { return x ? 1 : 2; }');
    assert.strictEqual(calculateComplexity(func), 2); // base + ternary
  });

  it('should count nested ternary', () => {
    const func = parseFunction('function test() { return a ? 1 : b ? 2 : 3; }');
    assert.strictEqual(calculateComplexity(func), 3); // base + ternary + nested ternary
  });

  it('should count ternary in expression', () => {
    const func = parseFunction('function test() { const y = x ? 1 : 2; return y; }');
    assert.strictEqual(calculateComplexity(func), 2); // base + ternary
  });
});

describe('calculateComplexity - Logical Operators', () => {
  it('should count && operator as +1', () => {
    const func = parseFunction('function test() { return a && b; }');
    assert.strictEqual(calculateComplexity(func), 2); // base + &&
  });

  it('should count || operator as +1', () => {
    const func = parseFunction('function test() { return a || b; }');
    assert.strictEqual(calculateComplexity(func), 2); // base + ||
  });

  it('should count ?? (nullish coalescing) as +1', () => {
    const func = parseFunction('function test() { return a ?? b; }');
    assert.strictEqual(calculateComplexity(func), 2); // base + ??
  });

  it('should count multiple logical operators independently', () => {
    const func = parseFunction('function test() { return a && b && c; }');
    assert.strictEqual(calculateComplexity(func), 3); // base + && + && (2 operators)
  });

  it('should count mixed logical operators', () => {
    const func = parseFunction('function test() { return a && b || c; }');
    assert.strictEqual(calculateComplexity(func), 3); // base + && + || (2 operators)
  });

  it('should count logical operators in conditions', () => {
    const func = parseFunction('function test() { if (a && b) { return 1; } }');
    assert.strictEqual(calculateComplexity(func), 3); // base + if + &&
  });

  it('should count deeply nested logical operators', () => {
    const func = parseFunction('function test() { return (a && b) || (c && d); }');
    assert.strictEqual(calculateComplexity(func), 4); // base + && + || + && (3 operators)
  });
});