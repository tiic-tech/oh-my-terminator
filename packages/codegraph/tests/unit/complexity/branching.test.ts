/**
 * Complexity Calculator Tests: Branching
 *
 * Tests for if/else, switch, and combined branching scenarios.
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

describe('calculateComplexity - If/Else Statements', () => {
  it('should count if statement as +1', () => {
    const func = parseFunction('function test() { if (x) { return 1; } }');
    assert.strictEqual(calculateComplexity(func), 2); // base + if
  });

  it('should count if-else as +2 (if + else)', () => {
    const func = parseFunction('function test() { if (x) { return 1; } else { return 2; } }');
    assert.strictEqual(calculateComplexity(func), 3); // base + if + else
  });

  it('should count else-if as part of if chain (not +1)', () => {
    const func = parseFunction(`
      function test() {
        if (a) { return 1; }
        else if (b) { return 2; }
      }
    `);
    // else-if is continuation of if chain, not separate branch
    assert.strictEqual(calculateComplexity(func), 2); // base + if (else-if NOT counted)
  });

  it('should count else-if with final else correctly', () => {
    const func = parseFunction(`
      function test() {
        if (a) { return 1; }
        else if (b) { return 2; }
        else { return 3; }
      }
    `);
    // base + if + else (else-if not counted, but final else is)
    assert.strictEqual(calculateComplexity(func), 3);
  });

  it('should count multiple if statements independently', () => {
    const func = parseFunction(`
      function test() {
        if (a) { x = 1; }
        if (b) { y = 2; }
      }
    `);
    assert.strictEqual(calculateComplexity(func), 3); // base + if + if
  });

  it('should count nested if statements', () => {
    const func = parseFunction(`
      function test() {
        if (a) {
          if (b) { return 1; }
        }
      }
    `);
    assert.strictEqual(calculateComplexity(func), 3); // base + if + nested if
  });
});

describe('calculateComplexity - Switch Statements', () => {
  it('should count each case clause as +1', () => {
    const func = parseFunction(`
      function test() {
        switch (x) {
          case 1: return 'a';
          case 2: return 'b';
          case 3: return 'c';
        }
      }
    `);
    assert.strictEqual(calculateComplexity(func), 4); // base + 3 cases
  });

  it('should count switch with default (default NOT counted per McCabe)', () => {
    const func = parseFunction(`
      function test() {
        switch (x) {
          case 1: return 'a';
          default: return 'b';
        }
      }
    `);
    // Per McCabe: default is fallback path, NOT a decision point
    // base + 1 case only
    assert.strictEqual(calculateComplexity(func), 2);
  });

  it('should not count empty switch', () => {
    const func = parseFunction('function test() { switch (x) {} }');
    assert.strictEqual(calculateComplexity(func), 1); // base only
  });
});

describe('calculateComplexity - Combined Complexity', () => {
  it('should calculate complex function with multiple decision points', () => {
    const func = parseFunction(`
      function complex(x, y, z) {
        if (x > 0) {
          for (let i = 0; i < x; i++) {
            if (y > i) {
              return i;
            }
          }
        } else {
          return z ?? 0;
        }
        return -1;
      }
    `);
    // base + if + for + nested if + else + ?? = 6
    assert.strictEqual(calculateComplexity(func), 6);
  });

  it('should calculate high complexity function (CC > 15)', () => {
    const func = parseFunction(`
      function highComplexity(data) {
        if (data.type === 'A') {
          if (data.level === 1) { return processA1(); }
          else if (data.level === 2) { return processA2(); }
          else if (data.level === 3) { return processA3(); }
          else { return processA(); }
        } else if (data.type === 'B') {
          for (const item of data.items) {
            if (item.active && item.valid) { processItem(item); }
            else { skipItem(item); }
          }
        } else if (data.type === 'C') {
          switch (data.status) {
            case 'pending': return wait();
            case 'active': return run();
            case 'done': return finish();
            case 'error': return handleError();
          }
        } else {
          for (let i = 0; i < data.count; i++) {
            for (let j = 0; j < data.width; j++) {
              if (data.matrix[i][j] > 0) { processCell(i, j); }
            }
          }
        }
        return null;
      }
    `);
    const complexity = calculateComplexity(func);
    // Verify complexity is >= 16 (high threshold)
    assert.ok(complexity >= 16, `Expected high complexity (>=16), got ${complexity}`);
  });
});