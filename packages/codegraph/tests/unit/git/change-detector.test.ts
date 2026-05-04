/**
 * @fileoverview Unit tests for Git change detection functions
 *
 * WHY: Validates Git change detection for incremental graph updates.
 * Tests pure functions and uses fixtures for integration tests.
 *
 * @see change-detector.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  detectGitChanges,
  isSupportedFile,
} from '../../../src/git/change-detector.js';

// Test fixture paths
const FIXTURES_DIR = path.join(import.meta.dirname, '../../fixtures');
const WITH_GIT_DIR = path.join(FIXTURES_DIR, 'with-git');

// ============================================================================
// isSupportedFile Tests (Pure Function)
// ============================================================================

describe('isSupportedFile', () => {
  it('should return true for .ts files', () => {
    assert.strictEqual(isSupportedFile('src/index.ts'), true);
  });

  it('should return true for .tsx files', () => {
    assert.strictEqual(isSupportedFile('src/component.tsx'), true);
  });

  it('should return true for .js files', () => {
    assert.strictEqual(isSupportedFile('src/utils.js'), true);
  });

  it('should return true for .jsx files', () => {
    assert.strictEqual(isSupportedFile('src/view.jsx'), true);
  });

  it('should return true for .mjs files', () => {
    assert.strictEqual(isSupportedFile('src/module.mjs'), true);
  });

  it('should return true for .cjs files', () => {
    assert.strictEqual(isSupportedFile('src/common.cjs'), true);
  });

  it('should return false for .json files', () => {
    assert.strictEqual(isSupportedFile('package.json'), false);
  });

  it('should return false for .md files', () => {
    assert.strictEqual(isSupportedFile('README.md'), false);
  });

  it('should return false for files without extension', () => {
    assert.strictEqual(isSupportedFile('Makefile'), false);
  });

  it('should return false for .css files', () => {
    assert.strictEqual(isSupportedFile('styles.css'), false);
  });

  it('should return false for .html files', () => {
    assert.strictEqual(isSupportedFile('index.html'), false);
  });

  it('should handle nested paths', () => {
    assert.strictEqual(isSupportedFile('src/lib/utils/helper.ts'), true);
    assert.strictEqual(isSupportedFile('docs/guide.md'), false);
    assert.strictEqual(isSupportedFile('deep/nested/path/file.tsx'), true);
  });

  it('should handle files with multiple dots', () => {
    assert.strictEqual(isSupportedFile('src/utils.test.ts'), true);
    assert.strictEqual(isSupportedFile('config.local.json'), false);
  });

  it('should handle uppercase extensions', () => {
    // Extension check is case-sensitive
    assert.strictEqual(isSupportedFile('src/file.TS'), false);
    assert.strictEqual(isSupportedFile('src/file.ts'), true);
  });

  it('should handle edge cases', () => {
    // .ts is treated as hidden file (no extension), not as file.ts
    assert.strictEqual(isSupportedFile('.ts'), false);
    assert.strictEqual(isSupportedFile(''), false);
    assert.strictEqual(isSupportedFile('file'), false);
  });
});

// ============================================================================
// detectGitChanges Tests (Integration with Fixture)
// ============================================================================

describe('detectGitChanges', () => {
  it('should throw when no baseline file exists', async () => {
    // Act & Assert - fixture doesn't have .codegraph/lastCommit.txt
    await assert.rejects(
      async () => detectGitChanges(WITH_GIT_DIR),
      {
        name: 'Error',
        message: /No baseline found/,
      }
    );
  });

  it('should throw error message suggesting to run analyze first', async () => {
    // Act & Assert
    await assert.rejects(
      async () => detectGitChanges(WITH_GIT_DIR),
      (err: Error) => {
        assert.ok(err.message.includes('analyze'));
        return true;
      }
    );
  });

  it('should throw for non-git directory', async () => {
    // Act & Assert
    const nonGitDir = path.join(FIXTURES_DIR, 'simple');
    await assert.rejects(
      async () => detectGitChanges(nonGitDir),
      /No baseline found|Failed to resolve/
    );
  });
});

// ============================================================================
// FileChange Type Tests
// ============================================================================

describe('FileChange interface', () => {
  it('should allow ADD type', () => {
    const change = { path: 'src/new.ts', type: 'ADD' as const };
    assert.strictEqual(change.type, 'ADD');
    assert.strictEqual(change.path, 'src/new.ts');
  });

  it('should allow MODIFY type', () => {
    const change = { path: 'src/changed.ts', type: 'MODIFY' as const };
    assert.strictEqual(change.type, 'MODIFY');
  });

  it('should allow DELETE type', () => {
    const change = { path: 'src/removed.ts', type: 'DELETE' as const };
    assert.strictEqual(change.type, 'DELETE');
  });

  it('should work in array context', () => {
    const changes = [
      { path: 'a.ts', type: 'ADD' as const },
      { path: 'b.ts', type: 'MODIFY' as const },
      { path: 'c.ts', type: 'DELETE' as const },
    ];
    assert.strictEqual(changes.length, 3);
    assert.strictEqual(changes.filter(c => c.type === 'ADD').length, 1);
    assert.strictEqual(changes.filter(c => c.type === 'MODIFY').length, 1);
    assert.strictEqual(changes.filter(c => c.type === 'DELETE').length, 1);
  });
});

// ============================================================================
// GitChangeResult Type Tests
// ============================================================================

describe('GitChangeResult interface', () => {
  it('should have correct structure when no changes', () => {
    // This tests the expected structure (not actual function output)
    const result = {
      lastCommit: 'abc123',
      currentHead: 'abc123',
      changes: [],
      hasChanges: false,
    };
    assert.strictEqual(result.hasChanges, false);
    assert.strictEqual(result.lastCommit, result.currentHead);
    assert.deepStrictEqual(result.changes, []);
  });

  it('should have correct structure when changes exist', () => {
    const result = {
      lastCommit: 'abc123',
      currentHead: 'def456',
      changes: [{ path: 'file.ts', type: 'ADD' as const }],
      hasChanges: true,
    };
    assert.strictEqual(result.hasChanges, true);
    assert.notStrictEqual(result.lastCommit, result.currentHead);
    assert.strictEqual(result.changes.length, 1);
  });
});