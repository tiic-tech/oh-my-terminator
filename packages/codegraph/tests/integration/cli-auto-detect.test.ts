/**
 * @fileoverview CLI auto-detection integration tests (Batch 5b)
 *
 * WHY: Validates full CLI command flows with source root auto-detection.
 * Tests precedence logic: explicit --source-root > auto-detect > error.
 *
 * Coverage (5.6):
 * - analyze command with auto-detection finds source root
 * - analyze with explicit --source-root bypasses detection
 * - analyze with --no-auto-detect requires --source-root
 * - impact command integration
 * - scope command integration
 * - error messages include suggestions
 *
 * @see tasks.md 5.6 - Write integration tests for CLI commands with auto-detection
 * @see resolve-source-root.ts - Precedence logic implementation
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve, dirname } from 'node:path';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { analyzeCommand } from '../../src/cli/commands/analyze.js';
import { impactCommand, scopeCommand } from '../../src/cli/commands/index.js';
import { CliErrorCode } from '../../src/types.js';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a temporary git repository with project markers
 *
 * WHY: Each test needs isolated git environment with specific markers.
 */
async function createTestGitRepo(markerType?: 'nodejs' | 'python' | 'rust' | 'go'): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'codegraph-auto-detect-test-'));

  // Initialize git repo
  execSync('git init', { cwd: tempDir, encoding: 'utf-8' });
  execSync('git config user.email "test@test.com"', { cwd: tempDir, encoding: 'utf-8' });
  execSync('git config user.name "Test User"', { cwd: tempDir, encoding: 'utf-8' });

  // Create src directory
  await mkdir(join(tempDir, 'src'));

  // Create project marker based on type
  if (markerType === 'nodejs') {
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'test-project', version: '1.0.0' }));
  } else if (markerType === 'python') {
    await writeFile(join(tempDir, 'pyproject.toml'), '[project]\nname = "test-project"\nversion = "1.0.0"\n');
  } else if (markerType === 'rust') {
    await writeFile(join(tempDir, 'Cargo.toml'), '[package]\nname = "test-project"\nversion = "1.0.0"\n');
  } else if (markerType === 'go') {
    await writeFile(join(tempDir, 'go.mod'), 'module test-project\n\ngo 1.21\n');
  }

  return tempDir;
}

/**
 * Add a TypeScript file to repo and commit
 */
async function addFile(repo: string, file: string, content: string): Promise<void> {
  const filePath = join(repo, file);
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(filePath, content);
  execSync(`git add "${file}"`, { cwd: repo, encoding: 'utf-8' });
  execSync(`git commit -m "Add ${file}"`, { cwd: repo, encoding: 'utf-8' });
}

/**
 * Create nested directory structure for testing upward search
 */
async function createNestedStructure(rootRepo: string, nestedPath: string): Promise<string> {
  const nestedDir = join(rootRepo, nestedPath);
  await mkdir(nestedDir, { recursive: true });
  await mkdir(join(nestedDir, 'src'));
  return nestedDir;
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('CLI Auto-Detection Integration Tests (5.6)', () => {
  let testRepo: string;

  beforeEach(async () => {
    testRepo = await createTestGitRepo('nodejs');
  });

  afterEach(async () => {
    await rm(testRepo, { recursive: true, force: true });
  });

  // ============================================================================
  // Test: analyze command with auto-detection finds source root
  // ============================================================================

  describe('analyze command auto-detection', () => {
    it('should find source root when called from nested directory', async () => {
      // Create multiple TypeScript files at root to avoid single-file edge case
      await addFile(testRepo, 'src/main.ts', 'export function main(): string { return "hello"; }');
      await addFile(testRepo, 'src/utils.ts', 'export function helper(): number { return 42; }');

      // Create nested directory structure
      const nestedDir = await createNestedStructure(testRepo, 'packages/lib/src');

      // Call analyze from nested directory (auto-detect should find root)
      const result = await analyzeCommand(nestedDir);

      assert.strictEqual(result.success, true, 'Analyze should succeed via auto-detection');
      assert.ok(result.stats, 'Should have stats (not edge case)');

      // Verify baseline created at root level (not nested)
      const baselinePath = join(testRepo, '.codegraph/baseline.json');
      assert.ok(existsSync(baselinePath), 'Baseline should be at detected root');
    });

    it('should detect Node.js project via package.json marker', async () => {
      await addFile(testRepo, 'src/app.ts', 'export const app = 1;');
      await addFile(testRepo, 'src/utils.ts', 'export const helper = 2;');

      // Call from root - should find package.json
      const result = await analyzeCommand(testRepo);

      assert.strictEqual(result.success, true, 'Should detect via package.json');
      assert.ok(result.stats || result.kind, 'Should have stats or edge case kind');
    });

    it('should detect Python project via pyproject.toml marker', async () => {
      const pythonRepo = await createTestGitRepo('python');
      await addFile(pythonRepo, 'src/main.py', 'def main(): return "hello"');

      try {
        const result = await analyzeCommand(pythonRepo);

        assert.strictEqual(result.success, true, 'Should detect via pyproject.toml');
        await rm(pythonRepo, { recursive: true, force: true });
      } catch (error) {
        await rm(pythonRepo, { recursive: true, force: true });
        throw error;
      }
    });

    it('should detect .git as fallback when no language markers', async () => {
      // Create repo without language markers (only .git from init)
      const bareRepo = await mkdtemp(join(tmpdir(), 'codegraph-bare-test-'));
      execSync('git init', { cwd: bareRepo, encoding: 'utf-8' });
      execSync('git config user.email "test@test.com"', { cwd: bareRepo, encoding: 'utf-8' });
      execSync('git config user.name "Test User"', { cwd: bareRepo, encoding: 'utf-8' });
      await mkdir(join(bareRepo, 'src'));
      await addFile(bareRepo, 'src/code.ts', 'export const x = 1;');

      try {
        const result = await analyzeCommand(bareRepo);

        assert.strictEqual(result.success, true, 'Should detect via .git fallback');
        await rm(bareRepo, { recursive: true, force: true });
      } catch (error) {
        await rm(bareRepo, { recursive: true, force: true });
        throw error;
      }
    });
  });

  // ============================================================================
  // Test: analyze with explicit --source-root bypasses detection
  // ============================================================================

  describe('analyze with explicit --source-root', () => {
    it('should use explicit path bypassing auto-detection', async () => {
      // Create multiple files to avoid single-file edge case
      await addFile(testRepo, 'src/main.ts', 'export function main() {}');
      await addFile(testRepo, 'src/utils.ts', 'export function helper() {}');

      // Create nested directory
      const nestedDir = await createNestedStructure(testRepo, 'deep/nested/path');

      // Call with explicit sourceRoot (should bypass detection)
      const result = await analyzeCommand(nestedDir, { sourceRoot: testRepo });

      assert.strictEqual(result.success, true, 'Should succeed with explicit path');
      assert.ok(result.stats || result.kind, 'Should have stats or edge case kind');
    });

    it('should validate explicit source root exists', async () => {
      // Non-existent path should return error
      const result = await analyzeCommand(testRepo, { sourceRoot: '/nonexistent/path' });

      assert.strictEqual(result.success, false, 'Should fail for non-existent path');
      assert.strictEqual(result.error?.code, CliErrorCode.E_INVALID_PATH, 'Should have invalid path error');
    });
  });

  // ============================================================================
  // Test: analyze with --no-auto-detect requires --source-root
  // ============================================================================

  describe('analyze with --no-auto-detect', () => {
    it('should require --source-root when auto-detect disabled', async () => {
      await addFile(testRepo, 'src/main.ts', 'export function main() {}');

      // Call with noAutoDetect but no sourceRoot - should error
      const result = await analyzeCommand(testRepo, { noAutoDetect: true });

      assert.strictEqual(result.success, false, 'Should fail when no-auto-detect without sourceRoot');
      assert.strictEqual(result.error?.code, CliErrorCode.E_AUTO_DETECT_DISABLED, 'Should have auto-detect disabled error');
    });

    it('should succeed with both --no-auto-detect and --source-root', async () => {
      await addFile(testRepo, 'src/main.ts', 'export function main() {}');

      // Both flags - should work
      const result = await analyzeCommand(testRepo, { noAutoDetect: true, sourceRoot: testRepo });

      assert.strictEqual(result.success, true, 'Should succeed with explicit path when auto-detect disabled');
    });
  });

  // ============================================================================
  // Test: error messages include suggestions
  // ============================================================================

  describe('error messages include suggestions', () => {
    it('should include --source-root suggestion in auto-detect disabled error', async () => {
      await addFile(testRepo, 'src/main.ts', 'export function main() {}');

      const result = await analyzeCommand(testRepo, { noAutoDetect: true });

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.message.includes('--source-root'), 'Error should mention --source-root');
      assert.ok(result.error?.suggestion, 'Should have suggestion field');
    });

    it('should include suggestion when detection fails', async () => {
      // Create directory outside any project (no markers)
      const isolatedDir = await mkdtemp(join(tmpdir(), 'isolated-dir-'));
      await mkdir(join(isolatedDir, 'src'));
      await writeFile(join(isolatedDir, 'src/code.ts'), 'export const x = 1;');

      try {
        const result = await analyzeCommand(isolatedDir);

        assert.strictEqual(result.success, false, 'Should fail in isolated directory');
        assert.ok(result.error?.message.includes('--source-root'), 'Error should suggest --source-root');
        assert.ok(result.error?.suggestion, 'Should have suggestion field');

        await rm(isolatedDir, { recursive: true, force: true });
      } catch (error) {
        await rm(isolatedDir, { recursive: true, force: true });
        throw error;
      }
    });
  });

  // ============================================================================
  // Test: impact command integration
  // ============================================================================

  describe('impact command integration', () => {
    it('should use auto-detected source root for impact query', async () => {
      // Create dependency chain
      await addFile(testRepo, 'src/utils.ts', 'export const util = 1;');
      await addFile(testRepo, 'src/core.ts', 'import { util } from "./utils.js"; export const core = util + 1;');
      await addFile(testRepo, 'src/app.ts', 'import { core } from "./core.js"; export const app = core + 1;');

      // Create baseline
      await analyzeCommand(testRepo);

      // Query impact from nested directory
      const nestedDir = await createNestedStructure(testRepo, 'packages/lib');
      const result = await impactCommand(nestedDir, 'src/utils.ts');

      assert.strictEqual(result.success, true, 'Impact should use auto-detected root');
      assert.ok(result.summary, 'Should have summary');
    });
  });

  // ============================================================================
  // Test: scope command integration
  // ============================================================================

  describe('scope command integration', () => {
    it('should use auto-detected source root for scope query', async () => {
      await addFile(testRepo, 'src/utils.ts', 'export function formatDate(): string { return "formatted"; }');
      await addFile(testRepo, 'src/app.ts', 'import { formatDate } from "./utils.js"; export function main() {}');

      // Create baseline
      await analyzeCommand(testRepo);

      // Query scope from nested directory
      const nestedDir = await createNestedStructure(testRepo, 'packages/lib');
      const result = await scopeCommand(nestedDir, 'src/utils.ts');

      assert.strictEqual(result.success, true, 'Scope should use auto-detected root');
      assert.ok(result.target, 'Should have target');
    });
  });
});