/**
 * Tests for routeOutput function
 *
 * WHY: Verifies stream routing behavior for stdout/stderr separation.
 * Ensures JSON mode outputs pure JSON to stdout, warnings/errors to stderr.
 */

import assert from 'node:assert';
import { describe, it, mock } from 'node:test';
import { routeOutput } from '../../../src/cli/output/router.js';
import { OutputMode } from '../../../src/cli/output/types.js';
import type { OutputResult } from '../../../src/cli/output/types.js';

describe('routeOutput', () => {
  it('routes primary to stdout in JSON mode', () => {
    const stdoutMock = mock.method(process.stdout, 'write', () => true);
    const stderrMock = mock.method(process.stderr, 'write', () => true);

    const result: OutputResult = {
      primary: '{"success":true}',
    };

    routeOutput(result, OutputMode.JSON);

    // stdout receives primary (pure JSON)
    assert.ok(stdoutMock.mock.calls.length >= 1);
    const stdoutContent = stdoutMock.mock.calls[0]?.arguments[0] as string;
    assert.ok(stdoutContent.includes('{"success":true}'), 'stdout should contain JSON');

    // stderr receives nothing (no warnings/errors)
    assert.strictEqual(stderrMock.mock.calls.length, 0);

    stdoutMock.mock.restore();
    stderrMock.mock.restore();
  });

  it('routes warnings to stderr in JSON mode', () => {
    const stdoutMock = mock.method(process.stdout, 'write', () => true);
    const stderrMock = mock.method(process.stderr, 'write', () => true);

    const result: OutputResult = {
      primary: '{"success":true}',
      warnings: ['Test warning'],
    };

    routeOutput(result, OutputMode.JSON);

    // stdout receives primary only
    assert.ok(stdoutMock.mock.calls.length >= 1);

    // stderr receives warnings
    assert.ok(stderrMock.mock.calls.length >= 1);
    const stderrContent = stderrMock.mock.calls[0]?.arguments[0] as string;
    assert.ok(stderrContent.includes('Test warning'), 'stderr should contain warning');

    stdoutMock.mock.restore();
    stderrMock.mock.restore();
  });

  it('routes errors to stderr in JSON mode', () => {
    const stdoutMock = mock.method(process.stdout, 'write', () => true);
    const stderrMock = mock.method(process.stderr, 'write', () => true);

    const result: OutputResult = {
      primary: '{"success":false}',
      errors: ['Test error'],
    };

    routeOutput(result, OutputMode.JSON);

    // stdout receives primary (JSON error object)
    assert.ok(stdoutMock.mock.calls.length >= 1);

    // stderr receives errors
    assert.ok(stderrMock.mock.calls.length >= 1);
    const stderrContent = stderrMock.mock.calls[0]?.arguments[0] as string;
    assert.ok(stderrContent.includes('Test error'), 'stderr should contain error');

    stdoutMock.mock.restore();
    stderrMock.mock.restore();
  });

  it('routes primary to stdout in TEXT mode', () => {
    const stdoutMock = mock.method(process.stdout, 'write', () => true);
    const stderrMock = mock.method(process.stderr, 'write', () => true);

    const result: OutputResult = {
      primary: 'Analysis complete',
    };

    routeOutput(result, OutputMode.TEXT);

    // stdout receives primary
    assert.ok(stdoutMock.mock.calls.length >= 1);
    const stdoutContent = stdoutMock.mock.calls[0]?.arguments[0] as string;
    assert.ok(stdoutContent.includes('Analysis complete'), 'stdout should contain text');

    stdoutMock.mock.restore();
    stderrMock.mock.restore();
  });

  it('routes warnings to stderr in TEXT mode', () => {
    const stdoutMock = mock.method(process.stdout, 'write', () => true);
    const stderrMock = mock.method(process.stderr, 'write', () => true);

    const result: OutputResult = {
      primary: 'Analysis complete',
      warnings: ['Missing file'],
    };

    routeOutput(result, OutputMode.TEXT);

    // stderr receives warnings
    assert.ok(stderrMock.mock.calls.length >= 1);
    const stderrContent = stderrMock.mock.calls[0]?.arguments[0] as string;
    assert.ok(stderrContent.includes('Missing file'), 'stderr should contain warning');

    stdoutMock.mock.restore();
    stderrMock.mock.restore();
  });

  it('suppresses stdout in SILENT mode', () => {
    const stdoutMock = mock.method(process.stdout, 'write', () => true);
    const stderrMock = mock.method(process.stderr, 'write', () => true);

    const result: OutputResult = {
      primary: 'Should not appear',
      warnings: ['Should be suppressed'],
      errors: ['Only errors shown'],
    };

    routeOutput(result, OutputMode.SILENT);

    // stdout receives nothing
    assert.strictEqual(stdoutMock.mock.calls.length, 0);

    // stderr receives only errors (warnings suppressed)
    assert.ok(stderrMock.mock.calls.length >= 1);
    const stderrContent = stderrMock.mock.calls[0]?.arguments[0] as string;
    assert.ok(stderrContent.includes('Only errors shown'), 'stderr should contain error');
    assert.ok(!stderrContent.includes('Should be suppressed'), 'stderr should NOT contain warning in SILENT mode');

    stdoutMock.mock.restore();
    stderrMock.mock.restore();
  });

  it('throws error if primary is null', () => {
    const result = { primary: null } as unknown as OutputResult;

    assert.throws(
      () => routeOutput(result, OutputMode.JSON),
      /OutputResult.primary is required/,
      'Should throw error for null primary'
    );
  });

  it('throws error if primary is undefined', () => {
    const result = { primary: undefined } as unknown as OutputResult;

    assert.throws(
      () => routeOutput(result, OutputMode.JSON),
      /OutputResult.primary is required/,
      'Should throw error for undefined primary'
    );
  });
});