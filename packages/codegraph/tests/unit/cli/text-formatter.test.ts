import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatAnalyzeText } from '../../../src/cli/output/analyze-text.js';
import { formatUpdateText } from '../../../src/cli/output/update-text.js';
import { formatErrorText } from '../../../src/cli/output/error-text.js';
import type { AnalyzeResult, UpdateResult, CliError } from '../../../src/types.js';
import { CliErrorCode } from '../../../src/types.js';

describe('formatAnalyzeText', () => {
  it('should include summary with stats in primary', () => {
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

    const output = formatAnalyzeText(result);

    assert.ok(output.primary.includes('Analysis complete'));
    assert.ok(output.primary.includes('Files scanned: 10'));
    assert.ok(output.primary.includes('Modules extracted: 25'));
    assert.ok(output.primary.includes('50 imports'));
    assert.ok(output.primary.includes('30 exports'));
    assert.ok(output.primary.includes('15 contains'));
    assert.ok(output.primary.includes('Duration:'));
  });

  it('should NOT include warnings in primary (they go to warnings field)', () => {
    const result: AnalyzeResult = {
      success: true,
      stats: {
        filesScanned: 10,
        modulesExtracted: 25,
        edgesCreated: { imports: 50, exports: 30, contains: 15 },
      },
      durationMs: 1500,
      warnings: ['Skipped 2 files due to parse errors', 'Another warning'],
      nextSuggested: [],
    };

    const output = formatAnalyzeText(result);

    // Warnings are NOT in primary (stdout), they go to warnings field (stderr)
    assert.ok(!output.primary.includes('Warnings:'));
    assert.ok(!output.primary.includes('Skipped 2 files'));

    // Warnings are in the warnings field
    assert.deepStrictEqual(output.warnings, ['Skipped 2 files due to parse errors', 'Another warning']);
  });

  it('should list next suggested in primary', () => {
    const result: AnalyzeResult = {
      success: true,
      stats: {
        filesScanned: 10,
        modulesExtracted: 25,
        edgesCreated: { imports: 50, exports: 30, contains: 15 },
      },
      baseline: {
        path: '.codegraph/baseline.json',
        commitHash: 'abc123',
        timestamp: Date.now(),
      },
      durationMs: 1500,
      warnings: [],
      nextSuggested: ['Run "cg update" after making changes', 'Review the baseline file'],
    };

    const output = formatAnalyzeText(result);

    assert.ok(output.primary.includes('Next suggested:'));
    assert.ok(output.primary.includes('- Run "cg update" after making changes'));
    assert.ok(output.primary.includes('- Review the baseline file'));
  });

  it('should include baseline path in primary when present', () => {
    const result: AnalyzeResult = {
      success: true,
      stats: {
        filesScanned: 10,
        modulesExtracted: 25,
        edgesCreated: { imports: 50, exports: 30, contains: 15 },
      },
      baseline: {
        path: '.codegraph/baseline.json',
        commitHash: 'abc123',
        timestamp: Date.now(),
      },
      durationMs: 1500,
      warnings: [],
      nextSuggested: [],
    };

    const output = formatAnalyzeText(result);

    assert.ok(output.primary.includes('Baseline saved: .codegraph/baseline.json'));
  });

  it('should format duration in seconds for >= 1000ms', () => {
    const result: AnalyzeResult = {
      success: true,
      stats: {
        filesScanned: 10,
        modulesExtracted: 25,
        edgesCreated: { imports: 50, exports: 30, contains: 15 },
      },
      durationMs: 2500,
      warnings: [],
      nextSuggested: [],
    };

    const output = formatAnalyzeText(result);

    assert.ok(output.primary.includes('2.5s'));
  });

  it('should format duration in milliseconds for < 1000ms', () => {
    const result: AnalyzeResult = {
      success: true,
      stats: {
        filesScanned: 10,
        modulesExtracted: 25,
        edgesCreated: { imports: 50, exports: 30, contains: 15 },
      },
      durationMs: 450,
      warnings: [],
      nextSuggested: [],
    };

    const output = formatAnalyzeText(result);

    assert.ok(output.primary.includes('450ms'));
  });

  it('should omit warnings field when no warnings', () => {
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

    const output = formatAnalyzeText(result);
    assert.strictEqual(output.warnings, undefined);
  });
});

describe('formatUpdateText', () => {
  it('should show file counts in primary', () => {
    const result: UpdateResult = {
      success: true,
      changes: {
        added: ['src/a.ts', 'src/b.ts'],
        removed: ['src/old.ts'],
        modified: ['src/c.ts', 'src/d.ts', 'src/e.ts'],
      },
      delta: {
        newNodes: 5,
        removedNodes: 2,
      },
      durationMs: 250,
      warnings: [],
    };

    const output = formatUpdateText(result);

    assert.ok(output.primary.includes('Update complete'));
    assert.ok(output.primary.includes('Changes detected:'));
    assert.ok(output.primary.includes('Added: 2 files'));
    assert.ok(output.primary.includes('Modified: 3 files'));
    assert.ok(output.primary.includes('Removed: 1 files'));
  });

  it('should show node delta in primary', () => {
    const result: UpdateResult = {
      success: true,
      changes: {
        added: [],
        removed: [],
        modified: [],
      },
      delta: {
        newNodes: 10,
        removedNodes: 5,
      },
      durationMs: 250,
      warnings: [],
    };

    const output = formatUpdateText(result);

    assert.ok(output.primary.includes('New nodes: 10'));
    assert.ok(output.primary.includes('Removed nodes: 5'));
  });

  it('should NOT include warnings in primary (they go to warnings field)', () => {
    const result: UpdateResult = {
      success: true,
      changes: {
        added: ['src/new.ts'],
        removed: [],
        modified: [],
      },
      delta: {
        newNodes: 5,
        removedNodes: 0,
      },
      durationMs: 250,
      warnings: ['File src/new.ts parsed with partial results'],
    };

    const output = formatUpdateText(result);

    // Warnings are NOT in primary (stdout)
    assert.ok(!output.primary.includes('Warnings:'));
    assert.ok(!output.primary.includes('File src/new.ts'));

    // Warnings are in warnings field
    assert.deepStrictEqual(output.warnings, ['File src/new.ts parsed with partial results']);
  });
});

describe('formatErrorText', () => {
  it('should show error code and message in primary', () => {
    const error: CliError = {
      success: false,
      error: {
        code: CliErrorCode.E_NO_GIT_REPO,
        message: 'Not in a git repository',
      },
      durationMs: 10,
    };

    const output = formatErrorText(error);

    assert.ok(output.primary.includes('Error: Not in a git repository'));
    assert.ok(output.primary.includes('Code: E_NO_GIT_REPO'));
  });

  it('should show duration in primary', () => {
    const error: CliError = {
      success: false,
      error: {
        code: CliErrorCode.E_PARSE_FAILED,
        message: 'Failed to parse file',
      },
      durationMs: 500,
    };

    const output = formatErrorText(error);

    assert.ok(output.primary.includes('Duration: 500ms'));
  });

  it('should format duration in seconds for >= 1000ms', () => {
    const error: CliError = {
      success: false,
      error: {
        code: CliErrorCode.E_BASELINE_NOT_FOUND,
        message: 'No baseline found',
      },
      durationMs: 1500,
    };

    const output = formatErrorText(error);

    assert.ok(output.primary.includes('Duration: 1.5s'));
  });

  it('should extract error message to errors field', () => {
    const error: CliError = {
      success: false,
      error: {
        code: CliErrorCode.E_PARSE_FAILED,
        message: 'Failed to parse',
      },
      durationMs: 100,
    };

    const output = formatErrorText(error);
    assert.deepStrictEqual(output.errors, ['Failed to parse']);
  });
});