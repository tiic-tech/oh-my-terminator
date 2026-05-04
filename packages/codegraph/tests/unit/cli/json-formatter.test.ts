import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAnalyzeJson,
  formatUpdateJson,
  formatErrorJson,
} from '../../../src/cli/output/json-formatter.js';
import type { AnalyzeResult, UpdateResult, CliError } from '../../../src/types.js';
import { CliErrorCode } from '../../../src/types.js';

describe('formatAnalyzeJson', () => {
  it('should produce valid JSON string', () => {
    const result: AnalyzeResult = {
      success: true,
      stats: {
        filesScanned: 10,
        modulesExtracted: 25,
        edgesCreated: { imports: 50, exports: 30, contains: 15 },
      },
      durationMs: 1500,
      warnings: [],
      nextSuggested: [],
    };

    const output = formatAnalyzeJson(result);
    assert.ok(typeof output === 'string');

    // Should be parseable as JSON
    const parsed = JSON.parse(output);
    assert.ok(parsed);
  });

  it('should include all required fields', () => {
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

    const output = formatAnalyzeJson(result);
    const parsed = JSON.parse(output);

    assert.strictEqual(parsed.success, true);
    assert.strictEqual(parsed.stats.filesScanned, 10);
    assert.strictEqual(parsed.stats.modulesExtracted, 25);
    assert.strictEqual(parsed.stats.edgesCreated.imports, 50);
    assert.strictEqual(parsed.baseline?.path, '.codegraph/baseline.json');
    assert.strictEqual(parsed.baseline?.commitHash, 'abc123def456');
    assert.strictEqual(parsed.durationMs, 1500);
    assert.strictEqual(parsed.warnings.length, 1);
    assert.strictEqual(parsed.nextSuggested.length, 1);
  });
});

describe('formatUpdateJson', () => {
  it('should produce valid JSON string', () => {
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
      warnings: [],
    };

    const output = formatUpdateJson(result);
    assert.ok(typeof output === 'string');

    // Should be parseable as JSON
    const parsed = JSON.parse(output);
    assert.ok(parsed);
  });

  it('should include changes and delta', () => {
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

    const output = formatUpdateJson(result);
    const parsed = JSON.parse(output);

    assert.strictEqual(parsed.success, true);
    assert.strictEqual(parsed.changes.added.length, 1);
    assert.strictEqual(parsed.changes.added[0], 'src/new-file.ts');
    assert.strictEqual(parsed.changes.removed.length, 1);
    assert.strictEqual(parsed.changes.modified.length, 1);
    assert.strictEqual(parsed.delta.newNodes, 5);
    assert.strictEqual(parsed.delta.removedNodes, 2);
    assert.strictEqual(parsed.warnings.length, 1);
  });
});

describe('formatErrorJson', () => {
  it('should include success: false', () => {
    const error: CliError = {
      success: false,
      error: {
        code: CliErrorCode.E_NO_GIT_REPO,
        message: 'Not in a git repository',
      },
      durationMs: 10,
    };

    const output = formatErrorJson(error);
    const parsed = JSON.parse(output);

    assert.strictEqual(parsed.success, false);
  });

  it('should include error.code and message', () => {
    const error: CliError = {
      success: false,
      error: {
        code: CliErrorCode.E_PARSE_FAILED,
        message: 'Failed to parse src/broken.ts',
      },
      durationMs: 100,
    };

    const output = formatErrorJson(error);
    const parsed = JSON.parse(output);

    assert.strictEqual(parsed.error.code, CliErrorCode.E_PARSE_FAILED);
    assert.strictEqual(parsed.error.message, 'Failed to parse src/broken.ts');
    assert.strictEqual(parsed.durationMs, 100);
  });
});