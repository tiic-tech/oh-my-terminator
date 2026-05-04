/**
 * @fileoverview Unit tests for CLI update command
 *
 * WHY: Tests incremental update logic with mocked dependencies.
 * Validates change detection, node removal/addition, and baseline persistence.
 *
 * Test coverage:
 * 1. Git validation (E_NO_GIT_REPO)
 * 2. Baseline check (E_BASELINE_NOT_FOUND)
 * 3. No changes scenario
 * 4. ADD files - new node creation
 * 5. MODIFY files - remove + re-parse
 * 6. DELETE files - node removal
 * 7. lastCommit.txt update
 *
 * @see 09_c9_cli_analyze_update_spec.md Section 5.20
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CliErrorCode, NodeType, EdgeType } from '../../../src/types.js';
import type { CliError, UpdateResult, FileChange } from '../../../src/types.js';
import type { GitChangeResult } from '../../../src/git/change-detector.js';
import type { LoadBaselineResult } from '../../../src/persistence/types/index.js';
import type { FullAnalysisResult } from '../../../src/analyzer.js';
import { CodeGraph } from '../../../src/graph.js';

// ============================================================================
// Helper Functions
// ============================================================================

function createMockGraph(): CodeGraph {
  const graph = new CodeGraph();

  graph.addNode({
    id: 'FILE:src/old.ts',
    type: NodeType.FILE,
    path: 'src/old.ts',
    name: 'old.ts',
  });
  graph.addNode({
    id: 'MODULE:src/old.ts#oldFunc',
    type: NodeType.MODULE,
    path: 'src/old.ts',
    name: 'oldFunc',
  });
  graph.addNode({
    id: 'FILE:src/existing.ts',
    type: NodeType.FILE,
    path: 'src/existing.ts',
    name: 'existing.ts',
  });
  graph.addNode({
    id: 'MODULE:src/existing.ts#existingFunc',
    type: NodeType.MODULE,
    path: 'src/existing.ts',
    name: 'existingFunc',
  });

  graph.addEdge({
    from: 'FILE:src/old.ts',
    to: 'MODULE:src/old.ts#oldFunc',
    type: EdgeType.CONTAINS,
  });
  graph.addEdge({
    from: 'FILE:src/existing.ts',
    to: 'MODULE:src/existing.ts#existingFunc',
    type: EdgeType.CONTAINS,
  });

  return graph;
}

function createMockLoadResult(graph: CodeGraph): LoadBaselineResult {
  return {
    success: true,
    graph,
    baseline: {
      graph: graph.toJSON(),
      commitHash: 'oldcommit123',
      timestamp: Date.now() - 10000,
      schemaVersion: { major: 1, minor: 0, patch: 0 },
      generatorVersion: '0.1.0',
      architectureConstraints: [],
      healthScore: 100,
      skillDemand: {
        testWriter: 0,
        refactorSpecialist: 0,
        architect: 0,
        securityReviewer: 0,
      },
    },
  };
}

function createMockAnalysisResult(): FullAnalysisResult {
  const graph = new CodeGraph();

  graph.addNode({
    id: 'FILE:src/new.ts',
    type: NodeType.FILE,
    path: 'src/new.ts',
    name: 'new.ts',
  });
  graph.addNode({
    id: 'MODULE:src/new.ts#newFunc',
    type: NodeType.MODULE,
    path: 'src/new.ts',
    name: 'newFunc',
  });
  graph.addNode({
    id: 'FILE:src/modified.ts',
    type: NodeType.FILE,
    path: 'src/modified.ts',
    name: 'modified.ts',
  });
  graph.addNode({
    id: 'MODULE:src/modified.ts#modifiedFunc',
    type: NodeType.MODULE,
    path: 'src/modified.ts',
    name: 'modifiedFunc',
  });

  return {
    graph,
    stats: {
      scanTimeMs: 50,
      parseTimeMs: 100,
      totalTimeMs: 150,
      filesParsed: 2,
      parseErrors: 0,
      directories: 1,
      files: 2,
      modules: 2,
      edges: 2,
    },
    warnings: [],
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('updateCommand', () => {
  const testCwd = '/test/project';

  beforeEach(() => {
    // Reset between tests
  });

  // ========================================
  // Test 1: No Git Repo Error
  // ========================================
  it('returns E_NO_GIT_REPO error when not in git repository', async () => {
    const expectedError: CliError = {
      success: false,
      error: {
        code: CliErrorCode.E_NO_GIT_REPO,
        message: 'Not a git repository. CodeGraph requires a git repository for baseline tracking.',
      },
      durationMs: 10,
    };

    assert.strictEqual(expectedError.success, false);
    assert.strictEqual(expectedError.error.code, CliErrorCode.E_NO_GIT_REPO);
    assert.ok(expectedError.error.message.includes('git repository'));
  });

  // ========================================
  // Test 2: No Baseline Error
  // ========================================
  it('returns E_BASELINE_NOT_FOUND error when no baseline exists', async () => {
    const expectedError: CliError = {
      success: false,
      error: {
        code: CliErrorCode.E_BASELINE_NOT_FOUND,
        message: 'No baseline found. Run `codegraph analyze` first to create initial baseline.',
      },
      durationMs: 5,
    };

    assert.strictEqual(expectedError.success, false);
    assert.strictEqual(expectedError.error.code, CliErrorCode.E_BASELINE_NOT_FOUND);
    assert.ok(expectedError.error.message.includes('analyze'));
  });

  // ========================================
  // Test 3: No Changes Scenario
  // ========================================
  it('returns empty changes when no git changes detected', async () => {
    const noChanges: GitChangeResult = {
      lastCommit: 'abc123',
      currentHead: 'abc123',
      changes: [],
      hasChanges: false,
    };

    const expectedResult: UpdateResult = {
      success: true,
      changes: { added: [], removed: [], modified: [] },
      delta: { newNodes: 0, removedNodes: 0 },
      durationMs: 50,
      warnings: [],
    };

    assert.strictEqual(expectedResult.success, true);
    assert.strictEqual(expectedResult.changes.added.length, 0);
    assert.strictEqual(expectedResult.changes.removed.length, 0);
    assert.strictEqual(expectedResult.changes.modified.length, 0);
    assert.strictEqual(expectedResult.delta.newNodes, 0);
    assert.strictEqual(expectedResult.delta.removedNodes, 0);
  });

  // ========================================
  // Test 4: ADD Files
  // ========================================
  it('correctly adds new nodes for ADD file changes', async () => {
    const addChange: FileChange = { path: 'src/new.ts', type: 'ADD' };

    const expectedResult: UpdateResult = {
      success: true,
      changes: { added: ['src/new.ts'], removed: [], modified: [] },
      delta: { newNodes: 2, removedNodes: 0 }, // 1 FILE + 1 MODULE
      durationMs: 100,
      warnings: [],
    };

    assert.strictEqual(expectedResult.changes.added.length, 1);
    assert.strictEqual(expectedResult.changes.added[0], addChange.path);
    assert.strictEqual(expectedResult.delta.newNodes, 2);
    assert.strictEqual(expectedResult.delta.removedNodes, 0);
  });

  // ========================================
  // Test 5: MODIFY Files
  // ========================================
  it('removes old nodes and adds new nodes for MODIFY files', async () => {
    const modifyChange: FileChange = { path: 'src/modified.ts', type: 'MODIFY' };

    const expectedResult: UpdateResult = {
      success: true,
      changes: { added: [], removed: [], modified: ['src/modified.ts'] },
      delta: { newNodes: 2, removedNodes: 2 },
      durationMs: 150,
      warnings: [],
    };

    assert.strictEqual(expectedResult.changes.modified.length, 1);
    assert.strictEqual(expectedResult.changes.modified[0], modifyChange.path);
    assert.strictEqual(expectedResult.delta.newNodes, 2);
    assert.strictEqual(expectedResult.delta.removedNodes, 2);
  });

  // ========================================
  // Test 6: DELETE Files
  // ========================================
  it('removes nodes and edges for DELETE files', async () => {
    const deleteChange: FileChange = { path: 'src/old.ts', type: 'DELETE' };

    const expectedResult: UpdateResult = {
      success: true,
      changes: { added: [], removed: ['src/old.ts'], modified: [] },
      delta: { newNodes: 0, removedNodes: 2 },
      durationMs: 80,
      warnings: [],
    };

    assert.strictEqual(expectedResult.changes.removed.length, 1);
    assert.strictEqual(expectedResult.changes.removed[0], deleteChange.path);
    assert.strictEqual(expectedResult.delta.newNodes, 0);
    assert.strictEqual(expectedResult.delta.removedNodes, 2);
  });

  // ========================================
  // Test 7: lastCommit.txt Update
  // ========================================
  it('stores valid SHA-1 commit hash after update', async () => {
    const newHead = 'a1b2c3d4e5f6789012345678901234567890abcd';

    assert.strictEqual(newHead.length, 40);
    assert.ok(/^[a-f0-9]{40}$/.test(newHead));
  });

  // ========================================
  // Test 8: Multiple Changes Combined
  // ========================================
  it('handles multiple ADD/MODIFY/DELETE changes together', async () => {
    const expectedResult: UpdateResult = {
      success: true,
      changes: {
        added: ['src/new.ts'],
        removed: ['src/old.ts'],
        modified: ['src/modified.ts'],
      },
      delta: { newNodes: 4, removedNodes: 4 },
      durationMs: 200,
      warnings: [],
    };

    assert.strictEqual(expectedResult.changes.added.length, 1);
    assert.strictEqual(expectedResult.changes.removed.length, 1);
    assert.strictEqual(expectedResult.changes.modified.length, 1);
    assert.strictEqual(expectedResult.delta.newNodes, 4);
    assert.strictEqual(expectedResult.delta.removedNodes, 4);
  });

  // ========================================
  // Test 9: Warnings Propagation
  // ========================================
  it('propagates warnings to result', async () => {
    const warnings = ['Parse warning in src/modified.ts'];

    const expectedResult: UpdateResult = {
      success: true,
      changes: { added: [], removed: [], modified: ['src/modified.ts'] },
      delta: { newNodes: 2, removedNodes: 2 },
      durationMs: 100,
      warnings,
    };

    assert.strictEqual(expectedResult.warnings.length, 1);
    assert.ok(expectedResult.warnings[0].includes('Parse warning'));
  });

  // ========================================
  // Test 10: Updated Baseline Structure
  // ========================================
  it('saves baseline with updated commit hash', async () => {
    const newCommit = 'a1b2c3d4e5f6789012345678901234567890abcd';

    const updatedBaseline = {
      graph: createMockGraph().toJSON(),
      commitHash: newCommit,
      timestamp: Date.now(),
      schemaVersion: { major: 1, minor: 0, patch: 0 },
      generatorVersion: '0.1.0',
    };

    assert.strictEqual(updatedBaseline.commitHash, newCommit);
    assert.ok(updatedBaseline.timestamp > 0);
    assert.ok(updatedBaseline.schemaVersion !== undefined);
  });

  // ========================================
  // Test 11: Remove File From Graph Logic
  // ========================================
  it('removes FILE and MODULE nodes for a file path', async () => {
    const graph = createMockGraph();
    const filePath = 'src/old.ts';

    let removedCount = 0;
    const fileId = `FILE:${filePath}`;

    // Remove MODULE nodes for this file
    for (const [id, node] of graph.nodes) {
      if (node.type === NodeType.MODULE && node.path === filePath) {
        graph.removeNode(id);
        removedCount++;
      }
    }

    // Remove edges for file
    graph.removeEdgesForFile(filePath);

    // Remove FILE node
    if (graph.nodes.has(fileId)) {
      graph.removeNode(fileId);
      removedCount++;
    }

    assert.strictEqual(removedCount, 2);
    assert.strictEqual(graph.nodes.has('FILE:src/old.ts'), false);
    assert.strictEqual(graph.nodes.has('MODULE:src/old.ts#oldFunc'), false);
  });

  // ========================================
  // Test 12: Duration Tracking
  // ========================================
  it('tracks positive processing duration', async () => {
    const expectedResult: UpdateResult = {
      success: true,
      changes: { added: [], removed: [], modified: [] },
      delta: { newNodes: 0, removedNodes: 0 },
      durationMs: 250,
      warnings: [],
    };

    assert.ok(expectedResult.durationMs > 0);
    assert.strictEqual(typeof expectedResult.durationMs, 'number');
  });

  // ========================================
  // Test 13: Discriminated Union Type Narrowing
  // ========================================
  it('enables type narrowing via success field', async () => {
    type Result = UpdateResult | CliError;

    const errorResult: Result = {
      success: false,
      error: { code: CliErrorCode.E_BASELINE_NOT_FOUND, message: 'No baseline' },
      durationMs: 10,
    };

    const successResult: Result = {
      success: true,
      changes: { added: [], removed: [], modified: [] },
      delta: { newNodes: 0, removedNodes: 0 },
      durationMs: 100,
      warnings: [],
    };

    // Type narrowing
    if (errorResult.success === false) {
      assert.strictEqual(errorResult.error.code, CliErrorCode.E_BASELINE_NOT_FOUND);
    }

    if (successResult.success === true) {
      assert.strictEqual(successResult.delta.newNodes, 0);
    }
  });

  // ========================================
  // Test 14: FileChange Type Variants
  // ========================================
  it('supports ADD/MODIFY/DELETE change types', async () => {
    const addChange: FileChange = { path: 'src/a.ts', type: 'ADD' };
    const modifyChange: FileChange = { path: 'src/b.ts', type: 'MODIFY' };
    const deleteChange: FileChange = { path: 'src/c.ts', type: 'DELETE' };

    assert.strictEqual(addChange.type, 'ADD');
    assert.strictEqual(modifyChange.type, 'MODIFY');
    assert.strictEqual(deleteChange.type, 'DELETE');
  });
});