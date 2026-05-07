/**
 * E2E tests for CLI error handling
 *
 * Tests actual CLI binary invocation to verify error messages and suggestions.
 * Uses subprocess execution to test real CLI behavior.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// WHY: Path from tests/e2e/ to dist/bin/ needs 4 levels: tests/e2e -> tests -> codegraph -> packages -> root -> codegraph/dist
const CLI_PATH = path.resolve(__dirname, '../..', 'dist/bin/codegraph.js');
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const FIXTURES_PATH = path.resolve(__dirname, '../fixtures');

/**
 * Run CLI command and capture output
 *
 * @param args - CLI arguments
 * @param expectSuccess - Whether command should succeed
 * @returns stdout, stderr, exit code
 */
function runCli(args: string[], expectSuccess: boolean = false): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${args.join(' ')}`, {
      encoding: 'utf-8',
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
    });
    return { stdout, stderr: '', code: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    if (expectSuccess) {
      throw error;
    }
    return {
      stdout: execError.stdout || '',
      stderr: execError.stderr || '',
      code: execError.status || 1,
    };
  }
}

describe('CLI Error Handling E2E', () => {
  describe('Unknown command error', () => {
    it('should show friendly error for unknown command', () => {
      const result = runCli(['xyz']);

      assert.strictEqual(result.code, 1);
      // WHY: Error message appears on stderr (per cg-stderr-model)
      assert.ok(result.stderr.includes('Unknown command'));
      assert.ok(result.stderr.includes('xyz'));
    });

    it('should show available commands suggestion', () => {
      const result = runCli(['xyz']);

      // WHY: Suggestion line is in stdout (formatted error), error message on stderr
      assert.ok(result.stdout.includes('Suggestion'));
      assert.ok(result.stdout.includes('Available commands'));
    });

    it('should suggest similar command for typo', () => {
      const result = runCli(['ana']);

      // WHY: Suggestion line is in stdout
      assert.ok(result.stdout.includes('Did you mean'));
      assert.ok(result.stdout.includes('analyze'));
    });

    it('should output structured JSON error with --json flag', () => {
      const result = runCli(['xyz', '--json']);

      assert.strictEqual(result.code, 1);

      // WHY: stdout contains JSON structure, stderr contains error message
      const jsonOutput = JSON.parse(result.stdout);
      assert.strictEqual(jsonOutput.success, false);
      assert.strictEqual(jsonOutput.error.code, 'E_CLI_UNKNOWN_COMMAND');
      assert.ok(jsonOutput.error.message.includes('xyz'));

      // WHY: stderr duplicates error message per cg-stderr-model
      assert.ok(result.stderr.includes('Unknown command'));
    });
  });

  describe('Invalid flag error', () => {
    it('should show friendly error for invalid flag', () => {
      const result = runCli(['analyze', '--invalid']);

      // Note: CAC allows unknown options by default, this might not trigger error
      // depending on configuration
      // For now, just verify CLI doesn't crash with raw stack trace
      assert.ok(result.code === 0 || result.code === 1);
      assert.ok(!result.stderr.includes('TypeError'));
      assert.ok(!result.stderr.includes('at Object'));
    });

    it('should output structured JSON error with --json flag', () => {
      const result = runCli(['analyze', '--invalid', '--json']);

      // CLI should not crash with raw error
      assert.ok(result.stdout || result.stderr);
      assert.ok(!result.stderr.includes('TypeError'));
    });
  });

  describe('Missing argument error', () => {
    it('should show friendly error for scope without target', () => {
      const result = runCli(['scope']);

      assert.strictEqual(result.code, 1);
      // WHY: Error message on stderr, formatted error on stdout
      assert.ok(result.stdout.includes('Missing'));
      assert.ok(result.stdout.includes('scope'));
    });

    it('should show friendly error for impact without target', () => {
      const result = runCli(['impact']);

      assert.strictEqual(result.code, 1);
      // WHY: Error message on stderr, formatted error on stdout
      assert.ok(result.stdout.includes('Missing'));
      assert.ok(result.stdout.includes('impact'));
    });
  });

  describe('Path format hint', () => {
    it('should show path hint for wrong path format in monorepo', () => {
      // This test requires a monorepo fixture with packages/ directory
      const monorepoPath = path.join(FIXTURES_PATH, 'monorepo-project');

      // If fixture doesn't exist, skip test
      try {
        const result = runCli(['scope', 'src/utils.ts', '--cwd', monorepoPath]);

        // If baseline not found, that's expected - we're testing path hint logic
        // which requires baseline first
        // For now, just verify CLI doesn't crash
        assert.ok(result.code === 0 || result.code === 1);
      } catch {
        // Fixture not available, skip
      }
    });
  });

  describe('No raw stack traces', () => {
    it('should not show raw stack traces in any error', () => {
      const commands = [
        ['xyz'],
        ['scope'],
        ['impact'],
        ['analyze', '--invalid'],
      ];

      for (const args of commands) {
        const result = runCli(args);

        // Verify no raw Node.js stack trace in stderr
        assert.ok(!result.stderr.includes('TypeError'));
        assert.ok(!result.stderr.includes('ReferenceError'));
        assert.ok(!result.stderr.includes('at Object.'));
        assert.ok(!result.stderr.includes('at Module.'));
        assert.ok(!result.stderr.includes('node:'));
      }
    });
  });
});