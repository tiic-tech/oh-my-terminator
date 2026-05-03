import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CODEGRAPH_DIR,
  BASELINE_FILE,
  LAST_COMMIT_FILE,
  VERSION_FILE,
  MIGRATION_LOG_FILE,
  getBaselinePath,
  getLastCommitPath,
  getVersionPath,
  getMigrationLogPath,
  ensureCodegraphDir,
} from '../../src/persistence/paths.js';
import { join } from 'node:path';
import { mkdir, rm, stat } from 'node:fs/promises';

describe('Path Constants', () => {
  it('should have CODEGRAPH_DIR as ".codegraph"', () => {
    assert.strictEqual(CODEGRAPH_DIR, '.codegraph');
  });

  it('should have BASELINE_FILE as "baseline.json"', () => {
    assert.strictEqual(BASELINE_FILE, 'baseline.json');
  });

  it('should have LAST_COMMIT_FILE as "lastCommit.txt"', () => {
    assert.strictEqual(LAST_COMMIT_FILE, 'lastCommit.txt');
  });

  it('should have VERSION_FILE as ".version"', () => {
    assert.strictEqual(VERSION_FILE, '.version');
  });

  it('should have MIGRATION_LOG_FILE as "migration.log"', () => {
    assert.strictEqual(MIGRATION_LOG_FILE, 'migration.log');
  });
});

describe('Path Helper Functions', () => {
  const testCwd = '/test/project';

  it('should return correct baseline path', () => {
    const expected = join(testCwd, '.codegraph', 'baseline.json');
    assert.strictEqual(getBaselinePath(testCwd), expected);
  });

  it('should return correct lastCommit path', () => {
    const expected = join(testCwd, '.codegraph', 'lastCommit.txt');
    assert.strictEqual(getLastCommitPath(testCwd), expected);
  });

  it('should return correct version path', () => {
    const expected = join(testCwd, '.codegraph', '.version');
    assert.strictEqual(getVersionPath(testCwd), expected);
  });

  it('should return correct migration log path', () => {
    const expected = join(testCwd, '.codegraph', 'migration.log');
    assert.strictEqual(getMigrationLogPath(testCwd), expected);
  });

  it('should handle relative cwd paths', () => {
    const relativeCwd = './src/project';
    const expected = join(relativeCwd, '.codegraph', 'baseline.json');
    assert.strictEqual(getBaselinePath(relativeCwd), expected);
  });

  it('should handle cwd with trailing slash', () => {
    const cwdWithSlash = '/test/project/';
    const expected = join(cwdWithSlash, '.codegraph', 'baseline.json');
    assert.strictEqual(getBaselinePath(cwdWithSlash), expected);
  });
});

describe('ensureCodegraphDir', () => {
  const tempDir = join(process.cwd(), 'tests', 'fixtures', 'temp-paths-test');

  it('should create .codegraph directory if it does not exist', async () => {
    const testCwd = join(tempDir, 'test-create');
    const codegraphDir = join(testCwd, '.codegraph');

    // Clean up if exists
    await rm(codegraphDir, { recursive: true, force: true });

    await ensureCodegraphDir(testCwd);

    // Verify directory exists
    const stats = await stat(codegraphDir);
    assert.ok(stats.isDirectory());

    // Cleanup
    await rm(codegraphDir, { recursive: true, force: true });
  });

  it('should not throw if .codegraph directory already exists', async () => {
    const testCwd = join(tempDir, 'test-exists');
    const codegraphDir = join(testCwd, '.codegraph');

    // Create directory first
    await mkdir(codegraphDir, { recursive: true });

    // Call again - should not throw
    await ensureCodegraphDir(testCwd);

    // Verify directory still exists
    const stats = await stat(codegraphDir);
    assert.ok(stats.isDirectory());

    // Cleanup
    await rm(testCwd, { recursive: true, force: true });
  });

  it('should return the path to created directory', async () => {
    const testCwd = join(tempDir, 'test-return');
    const expectedPath = join(testCwd, '.codegraph');

    // Clean up if exists
    await rm(expectedPath, { recursive: true, force: true });

    const result = await ensureCodegraphDir(testCwd);
    assert.strictEqual(result, expectedPath);

    // Cleanup
    await rm(expectedPath, { recursive: true, force: true });
  });
});