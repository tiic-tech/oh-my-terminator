import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CliErrorCode,
  CliResultStats,
  AnalyzeResult,
  UpdateResult,
  CliError,
  FileChange,
} from '../../src/types.js';

describe('CliErrorCode enum', () => {
  it('should contain E_NO_GIT_REPO value', () => {
    assert.strictEqual(CliErrorCode.E_NO_GIT_REPO, 'E_NO_GIT_REPO');
  });

  it('should contain E_BASELINE_NOT_FOUND value', () => {
    assert.strictEqual(CliErrorCode.E_BASELINE_NOT_FOUND, 'E_BASELINE_NOT_FOUND');
  });

  it('should contain E_PARSE_FAILED value', () => {
    assert.strictEqual(CliErrorCode.E_PARSE_FAILED, 'E_PARSE_FAILED');
  });

  it('should contain E_WALK_API_FAILED value', () => {
    assert.strictEqual(CliErrorCode.E_WALK_API_FAILED, 'E_WALK_API_FAILED');
  });

  it('should contain E_INVALID_PATH value', () => {
    assert.strictEqual(CliErrorCode.E_INVALID_PATH, 'E_INVALID_PATH');
  });

  it('should contain E_EMPTY_REPO value', () => {
    assert.strictEqual(CliErrorCode.E_EMPTY_REPO, 'E_EMPTY_REPO');
  });

  it('should have exactly 6 values', () => {
    const values = Object.values(CliErrorCode);
    assert.strictEqual(values.length, 6);
  });
});

describe('CliResultStats interface', () => {
  it('should allow creating stats with all edge types', () => {
    const stats: CliResultStats = {
      filesScanned: 10,
      modulesExtracted: 25,
      edgesCreated: {
        imports: 50,
        exports: 30,
        contains: 15,
      },
    };
    assert.strictEqual(stats.filesScanned, 10);
    assert.strictEqual(stats.modulesExtracted, 25);
    assert.strictEqual(stats.edgesCreated.imports, 50);
    assert.strictEqual(stats.edgesCreated.exports, 30);
    assert.strictEqual(stats.edgesCreated.contains, 15);
  });

  it('should allow zero values', () => {
    const stats: CliResultStats = {
      filesScanned: 0,
      modulesExtracted: 0,
      edgesCreated: {
        imports: 0,
        exports: 0,
        contains: 0,
      },
    };
    assert.strictEqual(stats.filesScanned, 0);
  });
});

describe('AnalyzeResult interface', () => {
  it('should allow creating a successful result', () => {
    const result: AnalyzeResult = {
      success: true,
      stats: {
        filesScanned: 10,
        modulesExtracted: 25,
        edgesCreated: { imports: 50, exports: 30, contains: 15 },
      },
      baseline: {
        path: '.codegraph/baseline.json',
        commitHash: 'abc123def456',
        timestamp: 1234567890,
      },
      durationMs: 1500,
      warnings: ['Skipped 2 files due to parse errors'],
      nextSuggested: ['Run "cg update" after making changes'],
    };
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.baseline?.path, '.codegraph/baseline.json');
    assert.strictEqual(result.durationMs, 1500);
    assert.strictEqual(result.warnings.length, 1);
    assert.strictEqual(result.nextSuggested.length, 1);
  });

  it('should allow creating a result without baseline', () => {
    const result: AnalyzeResult = {
      success: true,
      stats: {
        filesScanned: 0,
        modulesExtracted: 0,
        edgesCreated: { imports: 0, exports: 0, contains: 0 },
      },
      durationMs: 100,
      warnings: [],
      nextSuggested: [],
    };
    assert.strictEqual(result.baseline, undefined);
  });

  it('should allow empty warnings and suggestions', () => {
    const result: AnalyzeResult = {
      success: true,
      stats: {
        filesScanned: 5,
        modulesExtracted: 10,
        edgesCreated: { imports: 20, exports: 15, contains: 8 },
      },
      baseline: {
        path: '.codegraph/baseline.json',
        commitHash: 'abc123',
        timestamp: Date.now(),
      },
      durationMs: 500,
      warnings: [],
      nextSuggested: [],
    };
    assert.strictEqual(result.warnings.length, 0);
    assert.strictEqual(result.nextSuggested.length, 0);
  });
});

describe('UpdateResult interface', () => {
  it('should allow creating a successful update result', () => {
    const result: UpdateResult = {
      success: true,
      changes: {
        added: ['src/new-file.ts'],
        removed: ['src/old-file.ts'],
        modified: ['src/changed-file.ts'],
      },
      delta: {
        newNodes: 5,
        removedNodes: 2,
      },
      durationMs: 250,
      warnings: ['File src/new-file.ts parsed with partial results'],
    };
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.changes.added.length, 1);
    assert.strictEqual(result.changes.removed.length, 1);
    assert.strictEqual(result.changes.modified.length, 1);
    assert.strictEqual(result.delta.newNodes, 5);
    assert.strictEqual(result.delta.removedNodes, 2);
  });

  it('should allow empty changes', () => {
    const result: UpdateResult = {
      success: true,
      changes: {
        added: [],
        removed: [],
        modified: [],
      },
      delta: {
        newNodes: 0,
        removedNodes: 0,
      },
      durationMs: 50,
      warnings: [],
    };
    assert.strictEqual(result.changes.added.length, 0);
    assert.strictEqual(result.delta.newNodes, 0);
  });
});

describe('CliError interface', () => {
  it('should enforce success: false literal', () => {
    const error: CliError = {
      success: false,
      error: {
        code: CliErrorCode.E_NO_GIT_REPO,
        message: 'Not in a git repository',
      },
      durationMs: 10,
    };
    assert.strictEqual(error.success, false);
    assert.strictEqual(error.error.code, CliErrorCode.E_NO_GIT_REPO);
    assert.strictEqual(error.error.message, 'Not in a git repository');
  });

  it('should allow all error codes', () => {
    const errorCodes: CliErrorCode[] = [
      CliErrorCode.E_NO_GIT_REPO,
      CliErrorCode.E_BASELINE_NOT_FOUND,
      CliErrorCode.E_PARSE_FAILED,
      CliErrorCode.E_WALK_API_FAILED,
      CliErrorCode.E_INVALID_PATH,
      CliErrorCode.E_EMPTY_REPO,
    ];

    for (const code of errorCodes) {
      const error: CliError = {
        success: false,
        error: {
          code,
          message: `Error: ${code}`,
        },
        durationMs: 0,
      };
      assert.strictEqual(error.error.code, code);
    }
  });

  it('should support discriminated union narrowing', () => {
    // Type system test: success: false discriminates CliError from AnalyzeResult
    type Result = AnalyzeResult | CliError;

    const errorResult: Result = {
      success: false,
      error: {
        code: CliErrorCode.E_PARSE_FAILED,
        message: 'Failed to parse src/broken.ts',
      },
      durationMs: 100,
    };

    // TypeScript narrows to CliError when success === false
    if (errorResult.success === false) {
      assert.strictEqual(errorResult.error.code, CliErrorCode.E_PARSE_FAILED);
    }
  });
});

describe('FileChange interface', () => {
  it('should allow ADD type', () => {
    const change: FileChange = {
      path: 'src/new-file.ts',
      type: 'ADD',
    };
    assert.strictEqual(change.path, 'src/new-file.ts');
    assert.strictEqual(change.type, 'ADD');
  });

  it('should allow MODIFY type', () => {
    const change: FileChange = {
      path: 'src/modified-file.ts',
      type: 'MODIFY',
    };
    assert.strictEqual(change.type, 'MODIFY');
  });

  it('should allow DELETE type', () => {
    const change: FileChange = {
      path: 'src/deleted-file.ts',
      type: 'DELETE',
    };
    assert.strictEqual(change.type, 'DELETE');
  });

  it('should work in array context', () => {
    const changes: FileChange[] = [
      { path: 'src/a.ts', type: 'ADD' },
      { path: 'src/b.ts', type: 'MODIFY' },
      { path: 'src/c.ts', type: 'DELETE' },
    ];
    assert.strictEqual(changes.length, 3);
    assert.strictEqual(changes[0].type, 'ADD');
    assert.strictEqual(changes[1].type, 'MODIFY');
    assert.strictEqual(changes[2].type, 'DELETE');
  });
});

describe('Type integration', () => {
  it('should create complete analyze flow types', () => {
    // Simulate a complete analyze operation result
    const stats: CliResultStats = {
      filesScanned: 50,
      modulesExtracted: 120,
      edgesCreated: { imports: 200, exports: 100, contains: 50 },
    };

    const result: AnalyzeResult = {
      success: true,
      stats,
      baseline: {
        path: '.codegraph/baseline.json',
        commitHash: 'abc123',
        timestamp: Date.now(),
      },
      durationMs: 3500,
      warnings: ['Some files skipped'],
      nextSuggested: ['Run cg update after changes'],
    };

    assert.strictEqual(result.stats.filesScanned, stats.filesScanned);
    assert.strictEqual(result.success, true);
  });

  it('should create complete update flow types', () => {
    // Simulate file changes from git diff
    const changes: FileChange[] = [
      { path: 'src/new.ts', type: 'ADD' },
      { path: 'src/old.ts', type: 'DELETE' },
    ];

    const updateResult: UpdateResult = {
      success: true,
      changes: {
        added: changes.filter(c => c.type === 'ADD').map(c => c.path),
        removed: changes.filter(c => c.type === 'DELETE').map(c => c.path),
        modified: [],
      },
      delta: {
        newNodes: 5,
        removedNodes: 3,
      },
      durationMs: 200,
      warnings: [],
    };

    assert.strictEqual(updateResult.changes.added.length, 1);
    assert.strictEqual(updateResult.changes.added[0], 'src/new.ts');
    assert.strictEqual(updateResult.changes.removed.length, 1);
    assert.strictEqual(updateResult.changes.removed[0], 'src/old.ts');
  });

  it('should create error flow types', () => {
    const error: CliError = {
      success: false,
      error: {
        code: CliErrorCode.E_BASELINE_NOT_FOUND,
        message: 'No baseline found. Run "cg analyze" first.',
      },
      durationMs: 5,
    };

    // Type narrowing ensures error.error is accessible when success === false
    assert.strictEqual(error.success, false);
    assert.strictEqual(error.error.code, CliErrorCode.E_BASELINE_NOT_FOUND);
    assert.ok(error.error.message.includes('analyze'));
  });
});