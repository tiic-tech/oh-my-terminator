/**
 * Tests for detectMode function
 *
 * WHY: Verifies mode detection from command options.
 * Priority: json > silent > text (default)
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { detectMode } from '../../../src/cli/output/router.js';
import { OutputMode } from '../../../src/cli/output/types.js';

describe('detectMode', () => {
  it('detects JSON mode from json flag', () => {
    const mode = detectMode({ json: true });
    assert.strictEqual(mode, OutputMode.JSON);
  });

  it('detects SILENT mode from silent flag', () => {
    const mode = detectMode({ silent: true });
    assert.strictEqual(mode, OutputMode.SILENT);
  });

  it('defaults to TEXT mode when no flags', () => {
    const mode = detectMode({});
    assert.strictEqual(mode, OutputMode.TEXT);
  });

  it('prioritizes JSON over SILENT', () => {
    const mode = detectMode({ json: true, silent: true });
    assert.strictEqual(mode, OutputMode.JSON);
  });
});