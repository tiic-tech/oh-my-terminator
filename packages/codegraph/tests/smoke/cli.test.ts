/**
 * @fileoverview Smoke tests for CLI entry point
 *
 * WHY: Validates that the CLI binary is functional and commands are registered.
 * These tests spawn the actual CLI process to ensure real-world behavior.
 *
 * Test cases:
 * 1. Help flag shows help text with analyze and update commands
 * 2. Analyze command registered - analyze --help works
 * 3. Update command registered - update --help works
 *
 * @see tasks.md 6.9 - Write smoke test for CLI entry point
 */

import { spawn } from 'child_process';
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { resolve } from 'path';

const CLI_PATH = resolve(import.meta.dirname, '../../bin/codegraph.ts');
const PACKAGE_DIR = resolve(import.meta.dirname, '../../');

/**
 * Execute CLI command and capture output
 *
 * WHY: Spawns actual process for real-world testing, not just importing module.
 * This catches issues like missing dependencies, import errors, etc.
 */
async function runCLI(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolvePromise) => {
    const child = spawn('pnpm', ['tsx', CLI_PATH, ...args], {
      cwd: PACKAGE_DIR,
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolvePromise({ stdout, stderr, exitCode: code ?? 0 });
    });
  });
}

describe('CLI smoke tests', () => {
  it('shows help text with --help flag', async () => {
    const result = await runCLI(['--help']);

    assert.strictEqual(result.exitCode, 0, 'CLI should exit with 0 for help');
    assert.ok(result.stdout.includes('codegraph'), 'Output should contain CLI name');
    assert.ok(result.stdout.includes('analyze'), 'Help should list analyze command');
    assert.ok(result.stdout.includes('update'), 'Help should list update command');
    assert.ok(result.stdout.includes('Usage'), 'Help should show usage section');
  });

  it('shows analyze command help with analyze --help', async () => {
    const result = await runCLI(['analyze', '--help']);

    assert.strictEqual(result.exitCode, 0, 'CLI should exit with 0 for analyze help');
    assert.ok(result.stdout.includes('analyze'), 'Output should contain analyze command');
    assert.ok(result.stdout.includes('Usage'), 'Help should show usage section');
  });

  it('shows update command help with update --help', async () => {
    const result = await runCLI(['update', '--help']);

    assert.strictEqual(result.exitCode, 0, 'CLI should exit with 0 for update help');
    assert.ok(result.stdout.includes('update'), 'Output should contain update command');
    assert.ok(result.stdout.includes('Usage'), 'Help should show usage section');
  });
});