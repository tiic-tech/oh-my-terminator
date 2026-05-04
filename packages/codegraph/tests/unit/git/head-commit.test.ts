/**
 * @fileoverview Unit tests for getHeadCommit and isGitRepo functions
 *
 * WHY: Validates HEAD commit resolution used for baseline tracking.
 * Tests use the with-git fixture for real git operations.
 *
 * @see head-commit.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { getHeadCommit, isGitRepo } from '../../../src/git/head-commit.js';

// Test fixture paths - use monorepo root (which is a git repo)
// tests/unit/git is 5 levels below oh-my-terminator:
// tests/unit/git -> tests/unit -> tests -> codegraph -> packages -> oh-my-terminator
const MONOREPO_ROOT = path.join(import.meta.dirname, '../../../../..');
const FIXTURES_DIR = path.join(import.meta.dirname, '../../fixtures');
const NON_GIT_DIR = path.join(FIXTURES_DIR, 'simple');

describe('getHeadCommit', () => {
  it('should return 40-char SHA for valid git repo', async () => {
    // Act - use monorepo root which is a real git repo
    const result = await getHeadCommit(MONOREPO_ROOT);

    // Assert
    assert.strictEqual(result.length, 40);
    assert.match(result, /^[a-f0-9]{40}$/);
  });

  it('should throw error when not in git repo', async () => {
    // Act & Assert
    await assert.rejects(
      async () => getHeadCommit(NON_GIT_DIR),
      {
        name: 'Error',
        message: /Failed to resolve HEAD/,
      }
    );
  });

  it('should return valid commit hash format', async () => {
    // Act
    const result = await getHeadCommit(MONOREPO_ROOT);

    // Assert - commit hash should be lowercase hex
    assert.ok(/^[a-f0-9]+$/.test(result), 'Commit hash should be lowercase hex characters');
    assert.strictEqual(result.length, 40, 'Commit hash should be exactly 40 characters');
  });

  it('should resolve HEAD reference correctly', async () => {
    // Act - multiple calls should return same commit (HEAD is stable)
    const result1 = await getHeadCommit(MONOREPO_ROOT);
    const result2 = await getHeadCommit(MONOREPO_ROOT);

    // Assert
    assert.strictEqual(result1, result2, 'HEAD should resolve to same commit');
  });
});

describe('isGitRepo', () => {
  it('should return true for valid git repo', async () => {
    // Act - use monorepo root which is a real git repo
    const result = await isGitRepo(MONOREPO_ROOT);

    // Assert
    assert.strictEqual(result, true);
  });

  it('should return false for non-git directory', async () => {
    // Act
    const result = await isGitRepo(NON_GIT_DIR);

    // Assert
    assert.strictEqual(result, false);
  });

  it('should return false for non-existent directory', async () => {
    // Act
    const result = await isGitRepo('/non/existent/path');

    // Assert
    assert.strictEqual(result, false);
  });

  it('should handle valid git repo consistently', async () => {
    // Act - multiple calls should be consistent
    const result1 = await isGitRepo(MONOREPO_ROOT);
    const result2 = await isGitRepo(MONOREPO_ROOT);

    // Assert
    assert.strictEqual(result1, result2);
    assert.strictEqual(result1, true);
  });
});

describe('Git module integration', () => {
  it('should work together: isGitRepo true implies getHeadCommit succeeds', async () => {
    // Act - use monorepo root
    const isRepo = await isGitRepo(MONOREPO_ROOT);

    // Assert
    assert.strictEqual(isRepo, true);

    // If it's a repo, getHeadCommit should work
    if (isRepo) {
      const commit = await getHeadCommit(MONOREPO_ROOT);
      assert.ok(commit, 'Should return valid commit');
    }
  });

  it('should work together: isGitRepo false implies getHeadCommit fails', async () => {
    // Act
    const isRepo = await isGitRepo(NON_GIT_DIR);

    // Assert
    assert.strictEqual(isRepo, false);

    // If not a repo, getHeadCommit should fail
    await assert.rejects(
      async () => getHeadCommit(NON_GIT_DIR),
      /Failed to resolve HEAD/
    );
  });
});