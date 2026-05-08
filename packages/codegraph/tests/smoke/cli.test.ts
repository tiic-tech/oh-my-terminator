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
 * 4. Scope command registered - scope --help works
 * 5. Impact command registered - impact --help works
 * 6. Layers command registered - layers --help works
 * 7. Migrate command registered - migrate --help works
 * 8. JSON mode stdout purity - stdout contains only valid JSON
 *
 * @see tasks.md 6.9 - Write smoke test for CLI entry point
 * @see cg-cli-query-archive - Verify CLI query commands registration
 * @see cg-stderr-model - Verify stdout/stderr separation
 */

import { spawn } from 'child_process';
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { resolve } from 'path';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const CLI_PATH = resolve(import.meta.dirname, '../../bin/codegraph.ts');
const PACKAGE_DIR = resolve(import.meta.dirname, '../../');

/**
 * Execute CLI command and capture output
 *
 * WHY: Spawns actual process for real-world testing, not just importing module.
 * This catches issues like missing dependencies, import errors, etc.
 *
 * WHY shell: true: Required for pnpm resolution. Safe because args are
 * hardcoded test inputs (e.g., ['--help']), not user-supplied.
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

/**
 * Create a temporary git repository for testing
 */
async function createTestGitRepo(): Promise<string> {
  const tempDir = await mkdtemp(resolve(tmpdir(), 'codegraph-smoke-test-'));

  // Initialize git repo
  execSync('git init', { cwd: tempDir, encoding: 'utf-8' });
  execSync('git config user.email "test@test.com"', { cwd: tempDir, encoding: 'utf-8' });
  execSync('git config user.name "Test User"', { cwd: tempDir, encoding: 'utf-8' });

  // Create src directory
  await mkdir(resolve(tempDir, 'src'));

  return tempDir;
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

  it('shows migrate command help with migrate --help (6.7)', async () => {
    const result = await runCLI(['migrate', '--help']);

    assert.strictEqual(result.exitCode, 0, 'CLI should exit with 0 for migrate help');
    assert.ok(result.stdout.includes('migrate'), 'Output should contain migrate command');
    assert.ok(result.stdout.includes('--input'), 'Help should show --input option');
    assert.ok(result.stdout.includes('--output'), 'Help should show --output option');
    assert.ok(result.stdout.includes('Usage'), 'Help should show usage section');
  });

  it('shows compression flags in analyze --help (6.1-6.3)', async () => {
    const result = await runCLI(['analyze', '--help']);

    assert.strictEqual(result.exitCode, 0, 'CLI should exit with 0 for analyze help');
    assert.ok(result.stdout.includes('--compress'), 'Help should show --compress flag');
    assert.ok(result.stdout.includes('--no-compression'), 'Help should show --no-compression flag');
  });

  it('shows compression flags in update --help (6.11-6.12)', async () => {
    const result = await runCLI(['update', '--help']);

    assert.strictEqual(result.exitCode, 0, 'CLI should exit with 0 for update help');
    assert.ok(result.stdout.includes('--compress'), 'Help should show --compress flag');
    assert.ok(result.stdout.includes('--no-compression'), 'Help should show --no-compression flag');
  });

  it('shows scope command help with scope --help', async () => {
    const result = await runCLI(['scope', '--help']);

    assert.strictEqual(result.exitCode, 0, 'CLI should exit with 0 for scope help');
    assert.ok(result.stdout.includes('scope'), 'Output should contain scope command');
    assert.ok(result.stdout.includes('--json'), 'Help should show --json option');
    assert.ok(result.stdout.includes('Usage'), 'Help should show usage section');
  });

  it('shows impact command help with impact --help', async () => {
    const result = await runCLI(['impact', '--help']);

    assert.strictEqual(result.exitCode, 0, 'CLI should exit with 0 for impact help');
    assert.ok(result.stdout.includes('impact'), 'Output should contain impact command');
    assert.ok(result.stdout.includes('--json'), 'Help should show --json option');
    assert.ok(result.stdout.includes('Usage'), 'Help should show usage section');
  });

  it('shows layers command help with layers --help', async () => {
    const result = await runCLI(['layers', '--help']);

    assert.strictEqual(result.exitCode, 0, 'CLI should exit with 0 for layers help');
    assert.ok(result.stdout.includes('layers'), 'Output should contain layers command');
    assert.ok(result.stdout.includes('--json'), 'Help should show --json option');
    assert.ok(result.stdout.includes('Usage'), 'Help should show usage section');
  });

  // ============================================================================
  // cg-stderr-model: JSON stdout purity tests
  // ============================================================================

  describe('JSON mode stdout purity (cg-stderr-model)', () => {
    it('JSON output to stdout is valid JSON', async () => {
      const testRepo = await createTestGitRepo();

      // Create a simple TypeScript file
      await writeFile(resolve(testRepo, 'src/test.ts'), 'export const test = 1;');
      execSync('git add .', { cwd: testRepo, encoding: 'utf-8' });
      execSync('git commit -m "Initial commit"', { cwd: testRepo, encoding: 'utf-8' });

      try {
        const result = await runCLI(['analyze', testRepo, '--json']);

        // stdout should be valid JSON
        assert.ok(result.stdout.length > 0, 'stdout should have content');

        // Parse stdout as JSON - should succeed
        const parsed = JSON.parse(result.stdout);
        assert.ok(parsed, 'stdout JSON should be parseable');
        assert.strictEqual(parsed.success, true, 'JSON should indicate success');

        // stdout should not contain warning/error text mixed with JSON
        // (warnings go to stderr)
        assert.ok(!result.stdout.includes('Warnings:'), 'stdout should NOT contain warnings section');
      } finally {
        await rm(testRepo, { recursive: true, force: true });
      }
    });

    it('warnings go to stderr in JSON mode', async () => {
      const testRepo = await createTestGitRepo();

      // Create files that might generate warnings
      await writeFile(resolve(testRepo, 'src/test.ts'), 'export const test = 1;');
      execSync('git add .', { cwd: testRepo, encoding: 'utf-8' });
      execSync('git commit -m "Initial commit"', { cwd: testRepo, encoding: 'utf-8' });

      try {
        const result = await runCLI(['analyze', testRepo, '--json']);

        // If warnings exist, they should be in stderr, not stdout
        // stdout should only contain the JSON result
        const stdoutParsed = JSON.parse(result.stdout);
        assert.ok(stdoutParsed, 'stdout should be valid JSON');

        // stderr may contain warnings (or be empty if no warnings)
        // This test verifies the separation, not presence of warnings
      } finally {
        await rm(testRepo, { recursive: true, force: true });
      }
    });

    it('JSON output can be piped to jq', async () => {
      const testRepo = await createTestGitRepo();

      await writeFile(resolve(testRepo, 'src/test.ts'), 'export const test = 1;');
      execSync('git add .', { cwd: testRepo, encoding: 'utf-8' });
      execSync('git commit -m "Initial commit"', { cwd: testRepo, encoding: 'utf-8' });

      try {
        // Run analyze --json and pipe to jq
        const jqResult = execSync(
          `pnpm tsx ${CLI_PATH} analyze ${testRepo} --json | jq '.success'`,
          {
            cwd: PACKAGE_DIR,
            encoding: 'utf-8',
            shell: true,
          }
        );

        // jq should output 'true' (the success field value)
        assert.ok(jqResult.includes('true'), 'jq should parse JSON and extract success=true');
      } finally {
        await rm(testRepo, { recursive: true, force: true });
      }
    });
  });
});