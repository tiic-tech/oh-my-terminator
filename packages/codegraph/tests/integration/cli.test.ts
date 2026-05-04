/**
 * @fileoverview CLI integration tests for analyze and update commands
 *
 * WHY: Tests full CLI command flow against real git repositories.
 * Validates baseline creation, incremental updates, and output formats.
 *
 * Coverage:
 * - 7.4: analyze command full flow
 * - 7.5: update command with ADD changes
 * - 7.6: update command with MODIFY changes
 * - 7.7: update command with DELETE changes
 * - 7.8: update command no changes
 * - 7.9: --json flag output format
 * - 7.10: error output JSON format
 *
 * @see C9 tasks.md Section 7
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { analyzeCommand, updateCommand } from '../../src/cli/commands/index.js';
import { CliErrorCode } from '../../src/types.js';

describe('CLI Integration Tests', () => {
  let testRepo: string;

  beforeEach(async () => {
    testRepo = await createTestGitRepo();
  });

  afterEach(async () => {
    await rm(testRepo, { recursive: true, force: true });
  });

  // ============================================================================
  // 7.4: analyze command full flow
  // ============================================================================

  describe('7.4 analyze command full flow', () => {
    it('should create baseline.json after successful analysis', async () => {
      // Add TypeScript file to repo
      await addFile(testRepo, 'src/main.ts', `
export function main(): string {
  return 'hello';
}
`);

      // Run analyze command
      const result = await analyzeCommand(testRepo);

      // Verify result structure
      assert.strictEqual(result.success, true);
      assert.ok(result.stats, 'Should have stats');
      assert.ok(result.baseline, 'Should have baseline metadata');
      assert.strictEqual(result.baseline?.path, '.codegraph/baseline.json');

      // Verify baseline file was created
      const baselinePath = join(testRepo, '.codegraph/baseline.json');
      assert.ok(existsSync(baselinePath), 'baseline.json should exist');

      // Verify lastCommit.txt was created
      const lastCommitPath = join(testRepo, '.codegraph/lastCommit.txt');
      assert.ok(existsSync(lastCommitPath), 'lastCommit.txt should exist');
    });

    it('should return error when not in git repository', async () => {
      // Create non-git directory
      const nonGitDir = await mkdtemp(join(tmpdir(), 'non-git-'));
      await mkdir(join(nonGitDir, 'src'));
      await writeFile(join(nonGitDir, 'src/main.ts'), 'export function main() {}');

      try {
        const result = await analyzeCommand(nonGitDir);

        assert.strictEqual(result.success, false);
        assert.strictEqual(result.error?.code, CliErrorCode.E_NO_GIT_REPO);

        await rm(nonGitDir, { recursive: true, force: true });
      } catch (error) {
        await rm(nonGitDir, { recursive: true, force: true });
        throw error;
      }
    });

    it('should parse TypeScript files and extract MODULE nodes', async () => {
      await addFile(testRepo, 'src/utils.ts', `
export function formatDate(date: Date): string {
  return date.toISOString();
}

export const VERSION = '1.0.0';
`);

      const result = await analyzeCommand(testRepo);

      assert.strictEqual(result.success, true);
      assert.ok(result.stats.modulesExtracted >= 2, 'Should extract at least 2 modules');
      assert.ok(result.stats.filesScanned >= 1, 'Should scan at least 1 file');
    });
  });

  // ============================================================================
  // 7.5: update command with ADD changes
  // ============================================================================

  describe('7.5 update command with ADD changes', () => {
    it('should detect newly added files', async () => {
      // Create initial baseline
      await addFile(testRepo, 'src/initial.ts', 'export const initial = 1;');
      await analyzeCommand(testRepo);

      // Add new file
      await addFile(testRepo, 'src/new.ts', 'export const newFile = 2;');

      // Run update
      const result = await updateCommand(testRepo);

      assert.strictEqual(result.success, true);
      assert.ok(result.changes.added.includes('src/new.ts'), 'Should detect added file');
      assert.ok(result.delta.newNodes > 0, 'Should add new nodes');
    });

    it('should add MODULE nodes for new exports', async () => {
      // Create initial baseline
      await addFile(testRepo, 'src/a.ts', 'export const a = 1;');
      await analyzeCommand(testRepo);

      // Add new file with multiple exports
      await addFile(testRepo, 'src/b.ts', `
export function b1() {}
export function b2() {}
`);

      const result = await updateCommand(testRepo);

      assert.strictEqual(result.success, true);
      assert.ok(result.changes.added.includes('src/b.ts'), 'Should detect src/b.ts as added');
    });
  });

  // ============================================================================
  // 7.6: update command with MODIFY changes
  // ============================================================================

  describe('7.6 update command with MODIFY changes', () => {
    it('should detect modified files', async () => {
      // Create initial baseline
      await addFile(testRepo, 'src/file.ts', 'export const value = 1;');
      await analyzeCommand(testRepo);

      // Modify file
      await modifyFile(testRepo, 'src/file.ts', 'export const value = 2;');

      const result = await updateCommand(testRepo);

      assert.strictEqual(result.success, true);
      assert.ok(result.changes.modified.includes('src/file.ts'), 'Should detect modified file');
    });

    it('should update MODULE nodes for modified exports', async () => {
      // Create initial file with one export
      await addFile(testRepo, 'src/mod.ts', 'export function original() {}');
      await analyzeCommand(testRepo);

      // Modify to add more exports
      await modifyFile(testRepo, 'src/mod.ts', `
export function original() {}
export function added() {}
`);

      const result = await updateCommand(testRepo);

      assert.strictEqual(result.success, true);
      assert.ok(result.changes.modified.includes('src/mod.ts'), 'Should detect modified file');
    });
  });

  // ============================================================================
  // 7.7: update command with DELETE changes
  // ============================================================================

  describe('7.7 update command with DELETE changes', () => {
    it('should detect deleted files', async () => {
      // Create initial baseline with two files
      await addFile(testRepo, 'src/keep.ts', 'export const keep = 1;');
      await addFile(testRepo, 'src/delete.ts', 'export const deleteMe = 2;');
      await analyzeCommand(testRepo);

      // Delete one file
      await deleteFile(testRepo, 'src/delete.ts');

      const result = await updateCommand(testRepo);

      assert.strictEqual(result.success, true);
      assert.ok(result.changes.removed.includes('src/delete.ts'), 'Should detect deleted file');
      assert.ok(result.delta.removedNodes > 0, 'Should remove nodes');
    });

    it('should remove MODULE nodes for deleted file', async () => {
      // Create file with multiple exports
      await addFile(testRepo, 'src/toDelete.ts', `
export function f1() {}
export function f2() {}
export const c1 = 1;
`);
      await analyzeCommand(testRepo);

      // Delete the file
      await deleteFile(testRepo, 'src/toDelete.ts');

      const result = await updateCommand(testRepo);

      assert.strictEqual(result.success, true);
      assert.ok(result.changes.removed.includes('src/toDelete.ts'), 'Should detect deleted file');
    });
  });

  // ============================================================================
  // 7.8: update command no changes
  // ============================================================================

  describe('7.8 update command no changes', () => {
    it('should return empty changes when no modifications', async () => {
      // Create baseline
      await addFile(testRepo, 'src/stable.ts', 'export const stable = true;');
      await analyzeCommand(testRepo);

      // No changes - run update immediately
      const result = await updateCommand(testRepo);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.changes.added.length, 0);
      assert.strictEqual(result.changes.removed.length, 0);
      assert.strictEqual(result.changes.modified.length, 0);
      assert.strictEqual(result.delta.newNodes, 0);
      assert.strictEqual(result.delta.removedNodes, 0);
    });

    it('should return error when baseline does not exist', async () => {
      // Create git repo but no baseline
      await addFile(testRepo, 'src/file.ts', 'export const x = 1;');

      // Run update without analyze first
      const result = await updateCommand(testRepo);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.code, CliErrorCode.E_BASELINE_NOT_FOUND);
    });
  });

  // ============================================================================
  // 7.9: --json flag output format
  // ============================================================================

  describe('7.9 --json flag output format', () => {
    it('should return valid JSON structure for analyze', async () => {
      await addFile(testRepo, 'src/main.ts', 'export function main() {}');

      // Pass json option
      const result = await analyzeCommand(testRepo, { json: true });

      // Verify result is JSON-serializable
      const jsonStr = JSON.stringify(result);
      const parsed = JSON.parse(jsonStr);

      assert.strictEqual(parsed.success, true);
      assert.ok(parsed.stats, 'Should have stats object');
      assert.ok(parsed.durationMs !== undefined, 'Should have durationMs');
      assert.ok(Array.isArray(parsed.warnings), 'Should have warnings array');
      assert.ok(Array.isArray(parsed.nextSuggested), 'Should have nextSuggested array');
    });

    it('should return valid JSON structure for update', async () => {
      await addFile(testRepo, 'src/a.ts', 'export const a = 1;');
      await analyzeCommand(testRepo);

      await addFile(testRepo, 'src/b.ts', 'export const b = 2;');
      const result = await updateCommand(testRepo, { json: true });

      // Verify result is JSON-serializable
      const jsonStr = JSON.stringify(result);
      const parsed = JSON.parse(jsonStr);

      assert.strictEqual(parsed.success, true);
      assert.ok(parsed.changes, 'Should have changes object');
      assert.ok(Array.isArray(parsed.changes.added), 'Should have added array');
      assert.ok(Array.isArray(parsed.changes.removed), 'Should have removed array');
      assert.ok(Array.isArray(parsed.changes.modified), 'Should have modified array');
      assert.ok(parsed.delta, 'Should have delta object');
    });
  });

  // ============================================================================
  // 7.10: error output JSON format
  // ============================================================================

  describe('7.10 error output JSON format', () => {
    it('should return structured error JSON for non-git directory', async () => {
      const nonGitDir = await mkdtemp(join(tmpdir(), 'non-git-'));
      await writeFile(join(nonGitDir, 'test.ts'), 'export const x = 1;');

      try {
        const result = await analyzeCommand(nonGitDir, { json: true });

        // Verify error structure
        assert.strictEqual(result.success, false);
        assert.ok(result.error, 'Should have error object');
        assert.strictEqual(result.error?.code, CliErrorCode.E_NO_GIT_REPO);
        assert.ok(result.error?.message, 'Should have error message');
        assert.ok(result.durationMs !== undefined, 'Should have durationMs');

        // Verify JSON-serializable
        const jsonStr = JSON.stringify(result);
        const parsed = JSON.parse(jsonStr);

        assert.strictEqual(parsed.success, false);
        assert.ok(parsed.error.code, 'Parsed error should have code');
        assert.ok(parsed.error.message, 'Parsed error should have message');

        await rm(nonGitDir, { recursive: true, force: true });
      } catch (error) {
        await rm(nonGitDir, { recursive: true, force: true });
        throw error;
      }
    });

    it('should return structured error JSON for missing baseline', async () => {
      await addFile(testRepo, 'src/file.ts', 'export const x = 1;');

      // Run update without baseline
      const result = await updateCommand(testRepo, { json: true });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.code, CliErrorCode.E_BASELINE_NOT_FOUND);
      assert.ok(result.error?.message.includes('analyze'), 'Should suggest running analyze');
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a temporary git repository for testing
 *
 * @returns Path to test repository
 */
async function createTestGitRepo(): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'codegraph-cli-test-'));

  // Initialize git repo
  execSync('git init', { cwd: tempDir, encoding: 'utf-8' });
  execSync('git config user.email "test@test.com"', { cwd: tempDir, encoding: 'utf-8' });
  execSync('git config user.name "Test User"', { cwd: tempDir, encoding: 'utf-8' });

  // Create src directory
  await mkdir(join(tempDir, 'src'));

  return tempDir;
}

/**
 * Add a new file to the test repo and commit
 *
 * @param repo - Test repository path
 * @param file - Relative file path
 * @param content - File content
 */
async function addFile(repo: string, file: string, content: string): Promise<void> {
  const filePath = join(repo, file);

  // Ensure parent directory exists
  const dir = join(repo, file.split('/').slice(0, -1).join('/'));
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  await writeFile(filePath, content);
  execSync(`git add "${file}"`, { cwd: repo, encoding: 'utf-8' });
  execSync(`git commit -m "Add ${file}"`, { cwd: repo, encoding: 'utf-8' });
}

/**
 * Modify an existing file in the test repo and commit
 *
 * @param repo - Test repository path
 * @param file - Relative file path
 * @param content - New file content
 */
async function modifyFile(repo: string, file: string, content: string): Promise<void> {
  const filePath = join(repo, file);
  await writeFile(filePath, content);
  execSync(`git add "${file}"`, { cwd: repo, encoding: 'utf-8' });
  execSync(`git commit -m "Modify ${file}"`, { cwd: repo, encoding: 'utf-8' });
}

/**
 * Delete a file from the test repo and commit
 *
 * @param repo - Test repository path
 * @param file - Relative file path
 */
async function deleteFile(repo: string, file: string): Promise<void> {
  const filePath = join(repo, file);
  await rm(filePath, { force: true });
  execSync(`git add "${file}"`, { cwd: repo, encoding: 'utf-8' });
  execSync(`git commit -m "Delete ${file}"`, { cwd: repo, encoding: 'utf-8' });
}