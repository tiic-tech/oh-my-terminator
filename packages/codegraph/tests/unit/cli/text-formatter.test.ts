import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAnalyzeText,
  formatUpdateText,
  formatErrorText,
} from '../../../src/cli/output/text-formatter.js';
import type { AnalyzeResult, UpdateResult, CliError } from '../../../src/types.js';
import { CliErrorCode } from '../../../src/types.js';

describe('formatAnalyzeText', () => {
  it('should include summary with stats', () => {
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

    assert.ok(output.includes('Analysis complete'));
    assert.ok(output.includes('Files scanned: 10'));
    assert.ok(output.includes('Modules extracted: 25'));
    assert.ok(output.includes('50 imports'));
    assert.ok(output.includes('30 exports'));
    assert.ok(output.includes('15 contains'));
    assert.ok(output.includes('Duration:'));
  });

  it('should list warnings if present', () => {
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

    assert.ok(output.includes('Warnings:'));
    assert.ok(output.includes('- Skipped 2 files due to parse errors'));
    assert.ok(output.includes('- Another warning'));
  });

  it('should list next suggested if present', () => {
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

    assert.ok(output.includes('Next suggested:'));
    assert.ok(output.includes('- Run "cg update" after making changes'));
    assert.ok(output.includes('- Review the baseline file'));
  });

  it('should include baseline path when present', () => {
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

    assert.ok(output.includes('Baseline saved: .codegraph/baseline.json'));
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

    assert.ok(output.includes('2.5s'));
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

    assert.ok(output.includes('450ms'));
  });
});

describe('formatUpdateText', () => {
  it('should show file counts', () => {
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

    assert.ok(output.includes('Update complete'));
    assert.ok(output.includes('Changes detected:'));
    assert.ok(output.includes('Added: 2 files'));
    assert.ok(output.includes('Modified: 3 files'));
    assert.ok(output.includes('Removed: 1 files'));
  });

  it('should show node delta', () => {
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

    assert.ok(output.includes('New nodes: 10'));
    assert.ok(output.includes('Removed nodes: 5'));
  });

  it('should list warnings if present', () => {
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

    assert.ok(output.includes('Warnings:'));
    assert.ok(output.includes('- File src/new.ts parsed with partial results'));
  });
});

describe('formatErrorText', () => {
  it('should show error code and message', () => {
    const error: CliError = {
      success: false,
      error: {
        code: CliErrorCode.E_NO_GIT_REPO,
        message: 'Not in a git repository',
      },
      durationMs: 10,
    };

    const output = formatErrorText(error);

    assert.ok(output.includes('Error: Not in a git repository'));
    assert.ok(output.includes('Code: E_NO_GIT_REPO'));
  });

  it('should show duration', () => {
    const error: CliError = {
      success: false,
      error: {
        code: CliErrorCode.E_PARSE_FAILED,
        message: 'Failed to parse file',
      },
      durationMs: 500,
    };

    const output = formatErrorText(error);

    assert.ok(output.includes('Duration: 500ms'));
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

    assert.ok(output.includes('Duration: 1.5s'));
  });
});