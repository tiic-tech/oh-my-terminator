/**
 * Complexity Level Classification Tests
 *
 * Tests for threshold boundaries: 5→low, 6→medium, 15→medium, 16→high, 25→high, 26→critical
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateComplexity } from '../../src/api/scope/metadata.js';
import { CodeGraph } from '../../src/types.js';
import { createFileNode, createModuleNode, createModuleNodeWithoutComplexity } from './helpers/graph-builders.js';

describe('getComplexityLevel - Threshold Boundaries', () => {
  it('should classify value 1 as low', () => {
    const graph = new CodeGraph();
    const fileNode = createFileNode('src/simple.ts');
    graph.addNode(fileNode);
    graph.addNode(createModuleNode('src/simple.ts', 'fn', 1));

    const result = aggregateComplexity(graph, fileNode);
    assert.strictEqual(result.level, 'low');
    assert.strictEqual(result.value, 1);
  });

  it('should classify value 5 as low (boundary)', () => {
    const graph = new CodeGraph();
    const fileNode = createFileNode('src/boundary.ts');
    graph.addNode(fileNode);
    graph.addNode(createModuleNode('src/boundary.ts', 'fn', 5));

    const result = aggregateComplexity(graph, fileNode);
    assert.strictEqual(result.level, 'low');
    assert.strictEqual(result.value, 5);
  });

  it('should classify value 6 as medium (boundary)', () => {
    const graph = new CodeGraph();
    const fileNode = createFileNode('src/boundary.ts');
    graph.addNode(fileNode);
    graph.addNode(createModuleNode('src/boundary.ts', 'fn', 6));

    const result = aggregateComplexity(graph, fileNode);
    assert.strictEqual(result.level, 'medium');
    assert.strictEqual(result.value, 6);
  });

  it('should classify value 15 as medium (boundary)', () => {
    const graph = new CodeGraph();
    const fileNode = createFileNode('src/boundary.ts');
    graph.addNode(fileNode);
    graph.addNode(createModuleNode('src/boundary.ts', 'fn', 15));

    const result = aggregateComplexity(graph, fileNode);
    assert.strictEqual(result.level, 'medium');
    assert.strictEqual(result.value, 15);
  });

  it('should classify value 16 as high (boundary)', () => {
    const graph = new CodeGraph();
    const fileNode = createFileNode('src/boundary.ts');
    graph.addNode(fileNode);
    graph.addNode(createModuleNode('src/boundary.ts', 'fn', 16));

    const result = aggregateComplexity(graph, fileNode);
    assert.strictEqual(result.level, 'high');
    assert.strictEqual(result.value, 16);
  });

  it('should classify value 25 as high (boundary)', () => {
    const graph = new CodeGraph();
    const fileNode = createFileNode('src/boundary.ts');
    graph.addNode(fileNode);
    graph.addNode(createModuleNode('src/boundary.ts', 'fn', 25));

    const result = aggregateComplexity(graph, fileNode);
    assert.strictEqual(result.level, 'high');
    assert.strictEqual(result.value, 25);
  });

  it('should classify value 26 as critical (boundary)', () => {
    const graph = new CodeGraph();
    const fileNode = createFileNode('src/boundary.ts');
    graph.addNode(fileNode);
    graph.addNode(createModuleNode('src/boundary.ts', 'fn', 26));

    const result = aggregateComplexity(graph, fileNode);
    assert.strictEqual(result.level, 'critical');
    assert.strictEqual(result.value, 26);
  });

  it('should classify value 50 as critical', () => {
    const graph = new CodeGraph();
    const fileNode = createFileNode('src/complex.ts');
    graph.addNode(fileNode);
    graph.addNode(createModuleNode('src/complex.ts', 'fn', 50));

    const result = aggregateComplexity(graph, fileNode);
    assert.strictEqual(result.level, 'critical');
    assert.strictEqual(result.value, 50);
  });
});

describe('aggregateComplexity - FILE Level Aggregation', () => {
  it('should aggregate multiple MODULE complexities', () => {
    const graph = new CodeGraph();
    const fileNode = createFileNode('src/utils.ts');
    graph.addNode(fileNode);
    graph.addNode(createModuleNode('src/utils.ts', 'fn1', 3));
    graph.addNode(createModuleNode('src/utils.ts', 'fn2', 5));
    graph.addNode(createModuleNode('src/utils.ts', 'fn3', 7));

    const result = aggregateComplexity(graph, fileNode);
    assert.strictEqual(result.value, 15); // 3 + 5 + 7
    assert.strictEqual(result.level, 'medium'); // 15 is medium boundary
  });

  it('should return unknown for file with no MODULE nodes', () => {
    const graph = new CodeGraph();
    const fileNode = createFileNode('src/empty.ts');
    graph.addNode(fileNode);

    const result = aggregateComplexity(graph, fileNode);
    assert.strictEqual(result.level, 'unknown');
    assert.strictEqual(result.value, 0);
  });

  it('should return unknown for file with non-function MODULE nodes', () => {
    const graph = new CodeGraph();
    const fileNode = createFileNode('src/types.ts');
    graph.addNode(fileNode);
    // Class and interface MODULE nodes don't have complexity
    graph.addNode(createModuleNodeWithoutComplexity('src/types.ts', 'MyClass', 'class'));
    graph.addNode(createModuleNodeWithoutComplexity('src/types.ts', 'MyInterface', 'interface'));

    const result = aggregateComplexity(graph, fileNode);
    assert.strictEqual(result.level, 'unknown');
    assert.strictEqual(result.value, 0);
  });

  it('should handle file with high complexity total', () => {
    const graph = new CodeGraph();
    const fileNode = createFileNode('src/huge.ts');
    graph.addNode(fileNode);
    graph.addNode(createModuleNode('src/huge.ts', 'fn1', 30));
    graph.addNode(createModuleNode('src/huge.ts', 'fn2', 25));

    const result = aggregateComplexity(graph, fileNode);
    assert.strictEqual(result.value, 55); // 30 + 25
    assert.strictEqual(result.level, 'critical'); // 55 > 25
  });
});

describe('aggregateComplexity - MODULE Level', () => {
  it('should return direct complexity for MODULE node', () => {
    const graph = new CodeGraph();
    const fileNode = createFileNode('src/test.ts');
    const moduleNode = createModuleNode('src/test.ts', 'myFunc', 10);
    graph.addNode(fileNode);
    graph.addNode(moduleNode);

    const result = aggregateComplexity(graph, fileNode, moduleNode);
    assert.strictEqual(result.level, 'medium');
    assert.strictEqual(result.value, 10);
  });

  it('should handle MODULE node with undefined complexity', () => {
    const graph = new CodeGraph();
    const fileNode = createFileNode('src/test.ts');
    const moduleNode = createModuleNodeWithoutComplexity('src/test.ts', 'MyClass', 'class');
    graph.addNode(fileNode);
    graph.addNode(moduleNode);

    const result = aggregateComplexity(graph, fileNode, moduleNode);
    assert.strictEqual(result.level, 'unknown');
    assert.strictEqual(result.value, 0);
  });
});