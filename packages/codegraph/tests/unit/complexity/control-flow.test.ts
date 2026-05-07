/**
 * Complexity Calculator Tests: Control Flow
 *
 * Tests for loops and catch blocks.
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

describe('calculateComplexity - Loops', () => {
  it('should count for loop as +1', () => {
    const func = parseFunction('function test() { for (let i = 0; i < 10; i++) {} }');
    assert.strictEqual(calculateComplexity(func), 2); // base + for
  });

  it('should count while loop as +1', () => {
    const func = parseFunction('function test() { while (x > 0) {} }');
    assert.strictEqual(calculateComplexity(func), 2); // base + while
  });

  it('should count do-while loop as +1', () => {
    const func = parseFunction('function test() { do {} while (x > 0); }');
    assert.strictEqual(calculateComplexity(func), 2); // base + do-while
  });

  it('should count for-of loop as +1', () => {
    const func = parseFunction('function test() { for (const item of arr) {} }');
    assert.strictEqual(calculateComplexity(func), 2); // base + for-of
  });

  it('should count for-in loop as +1', () => {
    const func = parseFunction('function test() { for (const key in obj) {} }');
    assert.strictEqual(calculateComplexity(func), 2); // base + for-in
  });

  it('should count multiple loops', () => {
    const func = parseFunction(`
      function test() {
        for (let i = 0; i < 10; i++) {}
        while (x > 0) {}
      }
    `);
    assert.strictEqual(calculateComplexity(func), 3); // base + for + while
  });
});

describe('calculateComplexity - Catch Blocks', () => {
  it('should count catch block as +1', () => {
    const func = parseFunction(`
      function test() {
        try { doSomething(); }
        catch (e) { handleError(); }
      }
    `);
    assert.strictEqual(calculateComplexity(func), 2); // base + catch
  });

  it('should count try-catch-finally', () => {
    const func = parseFunction(`
      function test() {
        try { doSomething(); }
        catch (e) { handleError(); }
        finally { cleanup(); }
      }
    `);
    assert.strictEqual(calculateComplexity(func), 2); // base + catch (finally NOT counted)
  });

  it('should not count try without catch', () => {
    const func = parseFunction('function test() { try { doSomething(); } finally { cleanup(); } }');
    assert.strictEqual(calculateComplexity(func), 1); // base only
  });
});