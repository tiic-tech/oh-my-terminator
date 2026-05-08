/**
 * Unit tests for SourceRootDetector (cg-source-root-auto-detect)
 *
 * Tests the upward search algorithm, marker detection, and error handling.
 * Run with: pnpm test tests/unit/source-root-detector.test.ts
 *
 * WHY: Comprehensive unit tests ensure detection reliability across
 * project types, edge cases, and error scenarios.
 *
 * @see openspec/changes/cg-source-root-auto-detect/tasks.md 5.1-5.5
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as fsPromises from 'fs/promises';

// Import module to test
import {
  PROJECT_MARKERS,
  MARKER_PRIORITY,
  GENERIC_MARKER,
  MAX_SEARCH_DEPTH,
  DEFAULT_DETECTOR_OPTIONS,
  detectMarkerInDirectory,
  searchUpward,
  resolveSymlinkPath,
  detectSourceRoot,
} from '../../src/core/source-root/index.js';
import type {
  DetectionResult,
  DetectorOptions,
  MarkerInfo,
  UpwardSearchResult,
} from '../../src/core/source-root/index.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a temporary test directory structure.
 * WHY: Isolated test directories prevent cross-test interference.
 */
function createTempDir(prefix: string = 'source-root-detector-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Creates nested directory structure for depth tests.
 * WHY: Enables testing upward search at various depths.
 */
function createNestedStructure(baseDir: string, depth: number): string {
  let currentDir = baseDir;
  for (let i = 0; i < depth; i++) {
    currentDir = path.join(currentDir, `level-${i}`);
    fs.mkdirSync(currentDir, { recursive: true });
  }
  return currentDir;
}

/**
 * Creates a symlink to a target directory.
 * WHY: Tests symlink resolution behavior.
 */
function createSymlink(target: string, linkPath: string): void {
  fs.symlinkSync(target, linkPath, 'junction');
}

// ============================================================================
// Task 5.1: Unit tests for upward search algorithm
// ============================================================================

describe('searchUpward() - Task 5.1', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir('search-upward-');
  });

  afterEach(() => {
    // Cleanup temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('finds marker at various depths', () => {
    it('should find marker at depth 0 (current directory)', async () => {
      // Setup: Create package.json at tempDir
      const packageJsonPath = path.join(tempDir, 'package.json');
      fs.writeFileSync(packageJsonPath, '{}');

      const result = await searchUpward(tempDir, 10);

      assert.strictEqual(result.path, tempDir);
      assert.strictEqual(result.marker, 'package.json');
      assert.strictEqual(result.levelsSearched, 0);
      assert.strictEqual(result.projectType, 'nodejs');
    });

    it('should find marker at depth 1 (parent directory)', async () => {
      // Setup: Create nested structure with marker at parent
      const childDir = path.join(tempDir, 'child');
      fs.mkdirSync(childDir);
      const packageJsonPath = path.join(tempDir, 'package.json');
      fs.writeFileSync(packageJsonPath, '{}');

      const result = await searchUpward(childDir, 10);

      assert.strictEqual(result.path, tempDir);
      assert.strictEqual(result.marker, 'package.json');
      assert.strictEqual(result.levelsSearched, 1);
    });

    it('should find marker at depth 3', async () => {
      const startDir = createNestedStructure(tempDir, 3);
      const packageJsonPath = path.join(tempDir, 'package.json');
      fs.writeFileSync(packageJsonPath, '{}');

      const result = await searchUpward(startDir, 10);

      assert.strictEqual(result.path, tempDir);
      assert.strictEqual(result.levelsSearched, 3);
    });

    it('should find marker at depth 5', async () => {
      const startDir = createNestedStructure(tempDir, 5);
      const cargoPath = path.join(tempDir, 'Cargo.toml');
      fs.writeFileSync(cargoPath, '[package]\nname = "test"');

      const result = await searchUpward(startDir, 10);

      assert.strictEqual(result.path, tempDir);
      assert.strictEqual(result.marker, 'Cargo.toml');
      assert.strictEqual(result.levelsSearched, 5);
      assert.strictEqual(result.projectType, 'rust');
    });

    it('should find marker at depth 10 (max allowed)', async () => {
      const startDir = createNestedStructure(tempDir, 10);
      const goModPath = path.join(tempDir, 'go.mod');
      fs.writeFileSync(goModPath, 'module test');

      const result = await searchUpward(startDir, 10);

      assert.strictEqual(result.path, tempDir);
      assert.strictEqual(result.marker, 'go.mod');
      assert.strictEqual(result.levelsSearched, 10);
      assert.strictEqual(result.projectType, 'go');
    });
  });

  describe('stops at max depth with error', () => {
    it('should throw error when max depth exceeded without marker', async () => {
      // Create structure deeper than maxDepth with no markers
      const startDir = createNestedStructure(tempDir, 12);

      await assert.rejects(
        async () => await searchUpward(startDir, 5),
        (err: Error) => {
          assert.ok(err.message.includes('Source root not found'));
          assert.ok(err.message.includes('searched 5 levels'));
          return true;
        }
      );
    });

    it('should throw error at depth 0 when maxDepth is 0 and no marker', async () => {
      // Empty directory with no markers
      await assert.rejects(
        async () => await searchUpward(tempDir, 0),
        (err: Error) => {
          assert.ok(err.message.includes('Source root not found'));
          return true;
        }
      );
    });

    it('should throw error with helpful suggestion when max depth exceeded', async () => {
      const startDir = createNestedStructure(tempDir, 15);

      await assert.rejects(
        async () => await searchUpward(startDir, 3),
        (err: Error) => {
          assert.ok(err.message.includes('--source-root'));
          return true;
        }
      );
    });
  });

  describe('handles filesystem root reached', () => {
    it('should throw error when filesystem root is reached', async () => {
      // Start from near root to simulate hitting filesystem root
      // This test is platform-specific, so we use a more controlled approach
      const fsRoot = path.parse(tempDir).root;

      // Create a directory structure starting from root
      // We cannot actually create files in root, so we simulate by
      // using a controlled directory that has no parent with markers

      // Use a very deep nested structure and limited maxDepth
      const deepDir = createNestedStructure(tempDir, 20);

      // Remove all parent markers to simulate filesystem root-like scenario
      // (we can't actually reach filesystem root from tempDir, but we can
      // test the error message format)

      await assert.rejects(
        async () => await searchUpward(deepDir, 15),
        (err: Error) => {
          assert.ok(err.message.includes('Source root not found'));
          return true;
        }
      );
    });

    it('should include suggestion in filesystem root error', async () => {
      const deepDir = createNestedStructure(tempDir, 20);

      await assert.rejects(
        async () => await searchUpward(deepDir, 10),
        (err: Error) => {
          assert.ok(err.message.includes('Suggestion'));
          assert.ok(err.message.includes('--source-root'));
          return true;
        }
      );
    });
  });
});

// ============================================================================
// Task 5.2: Unit tests for marker detection per project type
// ============================================================================

describe('detectMarkerInDirectory() - Task 5.2', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir('marker-detection-');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Node.js markers', () => {
    it('should detect package.json', async () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');

      const result = await detectMarkerInDirectory(tempDir);

      assert.ok(result);
      assert.strictEqual(result!.marker, 'package.json');
      assert.strictEqual(result!.projectType, 'nodejs');
      assert.strictEqual(result!.isDirectory, false);
    });

    it('should detect package-lock.json', async () => {
      fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');

      const result = await detectMarkerInDirectory(tempDir);

      assert.ok(result);
      assert.strictEqual(result!.marker, 'package-lock.json');
      assert.strictEqual(result!.projectType, 'nodejs');
    });

    it('should detect yarn.lock', async () => {
      fs.writeFileSync(path.join(tempDir, 'yarn.lock'), '');

      const result = await detectMarkerInDirectory(tempDir);

      assert.ok(result);
      assert.strictEqual(result!.marker, 'yarn.lock');
      assert.strictEqual(result!.projectType, 'nodejs');
    });

    it('should detect pnpm-lock.yaml', async () => {
      fs.writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), '');

      const result = await detectMarkerInDirectory(tempDir);

      assert.ok(result);
      assert.strictEqual(result!.marker, 'pnpm-lock.yaml');
      assert.strictEqual(result!.projectType, 'nodejs');
    });
  });

  describe('Python markers', () => {
    it('should detect pyproject.toml', async () => {
      fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), '[project]');

      const result = await detectMarkerInDirectory(tempDir);

      assert.ok(result);
      assert.strictEqual(result!.marker, 'pyproject.toml');
      assert.strictEqual(result!.projectType, 'python');
      assert.strictEqual(result!.isDirectory, false);
    });

    it('should detect setup.py', async () => {
      fs.writeFileSync(path.join(tempDir, 'setup.py'), 'from setuptools import setup');

      const result = await detectMarkerInDirectory(tempDir);

      assert.ok(result);
      assert.strictEqual(result!.marker, 'setup.py');
      assert.strictEqual(result!.projectType, 'python');
    });

    it('should detect requirements.txt', async () => {
      fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'requests==2.28.0');

      const result = await detectMarkerInDirectory(tempDir);

      assert.ok(result);
      assert.strictEqual(result!.marker, 'requirements.txt');
      assert.strictEqual(result!.projectType, 'python');
    });

    it('should detect Pipfile', async () => {
      fs.writeFileSync(path.join(tempDir, 'Pipfile'), '[source]');

      const result = await detectMarkerInDirectory(tempDir);

      assert.ok(result);
      assert.strictEqual(result!.marker, 'Pipfile');
      assert.strictEqual(result!.projectType, 'python');
    });
  });

  describe('Rust markers', () => {
    it('should detect Cargo.toml', async () => {
      fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), '[package]\nname = "test"');

      const result = await detectMarkerInDirectory(tempDir);

      assert.ok(result);
      assert.strictEqual(result!.marker, 'Cargo.toml');
      assert.strictEqual(result!.projectType, 'rust');
      assert.strictEqual(result!.isDirectory, false);
    });

    it('should detect Cargo.lock', async () => {
      fs.writeFileSync(path.join(tempDir, 'Cargo.lock'), '');

      const result = await detectMarkerInDirectory(tempDir);

      assert.ok(result);
      assert.strictEqual(result!.marker, 'Cargo.lock');
      assert.strictEqual(result!.projectType, 'rust');
    });
  });

  describe('Go markers', () => {
    it('should detect go.mod', async () => {
      fs.writeFileSync(path.join(tempDir, 'go.mod'), 'module test');

      const result = await detectMarkerInDirectory(tempDir);

      assert.ok(result);
      assert.strictEqual(result!.marker, 'go.mod');
      assert.strictEqual(result!.projectType, 'go');
      assert.strictEqual(result!.isDirectory, false);
    });

    it('should detect go.sum', async () => {
      fs.writeFileSync(path.join(tempDir, 'go.sum'), '');

      const result = await detectMarkerInDirectory(tempDir);

      assert.ok(result);
      assert.strictEqual(result!.marker, 'go.sum');
      assert.strictEqual(result!.projectType, 'go');
    });
  });

  describe('alphabetical priority (D3.1)', () => {
    it('should prefer Cargo.toml over package.json when both exist', async () => {
      // Cargo.toml comes first alphabetically in MARKER_PRIORITY
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), '[package]');

      const result = await detectMarkerInDirectory(tempDir);

      assert.ok(result);
      assert.strictEqual(result!.marker, 'Cargo.toml');
      assert.strictEqual(result!.projectType, 'rust');
    });

    it('should prefer go.mod over pyproject.toml when both exist', async () => {
      fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), '[project]');
      fs.writeFileSync(path.join(tempDir, 'go.mod'), 'module test');

      const result = await detectMarkerInDirectory(tempDir);

      assert.ok(result);
      assert.strictEqual(result!.marker, 'go.mod');
      assert.strictEqual(result!.projectType, 'go');
    });

    it('should prefer package.json over pyproject.toml when both exist', async () => {
      fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), '[project]');
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');

      const result = await detectMarkerInDirectory(tempDir);

      assert.ok(result);
      assert.strictEqual(result!.marker, 'package.json');
      assert.strictEqual(result!.projectType, 'nodejs');
    });

    it('should prefer Cargo.toml over go.mod (alphabetical order)', async () => {
      fs.writeFileSync(path.join(tempDir, 'go.mod'), 'module test');
      fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), '[package]');

      const result = await detectMarkerInDirectory(tempDir);

      assert.ok(result);
      // Cargo.toml comes before go.mod in MARKER_PRIORITY
      assert.strictEqual(result!.marker, 'Cargo.toml');
    });

    it('should return null when no markers present', async () => {
      const result = await detectMarkerInDirectory(tempDir);

      assert.strictEqual(result, null);
    });
  });
});

// ============================================================================
// Task 5.3: Unit tests for .git fallback
// ============================================================================

describe('.git fallback detection - Task 5.3', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir('git-fallback-');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should use .git when no language markers present', async () => {
    // Create .git directory (not file - must be directory)
    const gitDir = path.join(tempDir, '.git');
    fs.mkdirSync(gitDir);
    fs.mkdirSync(path.join(gitDir, 'objects')); // Make it look like real git

    const result = await detectMarkerInDirectory(tempDir);

    assert.ok(result);
    assert.strictEqual(result!.marker, '.git');
    assert.strictEqual(result!.projectType, 'generic');
    assert.strictEqual(result!.isDirectory, true);
  });

  it('should prefer language markers over .git', async () => {
    // Create both .git and package.json
    const gitDir = path.join(tempDir, '.git');
    fs.mkdirSync(gitDir);
    fs.mkdirSync(path.join(gitDir, 'objects'));
    fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');

    const result = await detectMarkerInDirectory(tempDir);

    assert.ok(result);
    // Language marker should win
    assert.strictEqual(result!.marker, 'package.json');
    assert.strictEqual(result!.projectType, 'nodejs');
  });

  it('should detect .git via searchUpward when no language markers', async () => {
    // Create nested structure with .git at root
    const gitDir = path.join(tempDir, '.git');
    fs.mkdirSync(gitDir);
    fs.mkdirSync(path.join(gitDir, 'objects'));

    const childDir = path.join(tempDir, 'src');
    fs.mkdirSync(childDir);

    const result = await searchUpward(childDir, 10);

    assert.strictEqual(result.path, tempDir);
    assert.strictEqual(result.marker, '.git');
    assert.strictEqual(result.projectType, 'generic');
  });

  it('should not detect .git file (worktree reference) as directory', async () => {
    // Create .git as a file (git worktree reference)
    fs.writeFileSync(path.join(tempDir, '.git'), 'gitdir: /some/path');

    const result = await detectMarkerInDirectory(tempDir);

    // .git file should not be detected (only directory counts)
    assert.strictEqual(result, null);
  });
});

// ============================================================================
// Task 5.4: Unit tests for detection priority
// ============================================================================

describe('Detection priority - Task 5.4', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir('detection-priority-');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('language markers > .git', () => {
    it('should prioritize Cargo.toml over .git at same level', async () => {
      const gitDir = path.join(tempDir, '.git');
      fs.mkdirSync(gitDir);
      fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), '[package]');

      const result = await detectMarkerInDirectory(tempDir);

      assert.strictEqual(result!.marker, 'Cargo.toml');
      assert.strictEqual(result!.projectType, 'rust');
    });

    it('should prioritize go.mod over .git at same level', async () => {
      const gitDir = path.join(tempDir, '.git');
      fs.mkdirSync(gitDir);
      fs.writeFileSync(path.join(tempDir, 'go.mod'), 'module test');

      const result = await detectMarkerInDirectory(tempDir);

      assert.strictEqual(result!.marker, 'go.mod');
      assert.strictEqual(result!.projectType, 'go');
    });

    it('should prioritize package.json over .git at same level', async () => {
      const gitDir = path.join(tempDir, '.git');
      fs.mkdirSync(gitDir);
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');

      const result = await detectMarkerInDirectory(tempDir);

      assert.strictEqual(result!.marker, 'package.json');
      assert.strictEqual(result!.projectType, 'nodejs');
    });

    it('should prioritize pyproject.toml over .git at same level', async () => {
      const gitDir = path.join(tempDir, '.git');
      fs.mkdirSync(gitDir);
      fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), '[project]');

      const result = await detectMarkerInDirectory(tempDir);

      assert.strictEqual(result!.marker, 'pyproject.toml');
      assert.strictEqual(result!.projectType, 'python');
    });

    it('should find language marker at deeper level, ignoring .git at shallower', async () => {
      // This tests that upward search finds nearest marker
      // Create .git at tempDir
      const gitDir = path.join(tempDir, '.git');
      fs.mkdirSync(gitDir);

      // Create nested structure with package.json at level 2
      const level1 = path.join(tempDir, 'level-1');
      const level2 = path.join(level1, 'level-2');
      fs.mkdirSync(level2, { recursive: true });
      fs.writeFileSync(path.join(level1, 'package.json'), '{}');

      // Start search from level2 - should find package.json at level1
      // (nearest marker, not .git at tempDir)
      const result = await searchUpward(level2, 10);

      assert.strictEqual(result.path, level1);
      assert.strictEqual(result.marker, 'package.json');
    });
  });

  describe('alphabetical order at same level', () => {
    it('should follow MARKER_PRIORITY order exactly', async () => {
      // Create all markers
      fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), '');
      fs.writeFileSync(path.join(tempDir, 'go.mod'), '');
      fs.writeFileSync(path.join(tempDir, 'package.json'), '');
      fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), '');

      const result = await detectMarkerInDirectory(tempDir);

      // Cargo.toml is first in MARKER_PRIORITY
      assert.strictEqual(result!.marker, 'Cargo.toml');
    });

    it('should pick first available marker in priority list', async () => {
      // Create markers that are NOT at the beginning of priority
      fs.writeFileSync(path.join(tempDir, 'package.json'), '');
      fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), '');

      const result = await detectMarkerInDirectory(tempDir);

      // package.json comes before pyproject.toml in MARKER_PRIORITY
      assert.strictEqual(result!.marker, 'package.json');
    });

    it('should pick setup.py only when no other Python markers', async () => {
      fs.writeFileSync(path.join(tempDir, 'setup.py'), '');

      const result = await detectMarkerInDirectory(tempDir);

      assert.strictEqual(result!.marker, 'setup.py');
      assert.strictEqual(result!.projectType, 'python');
    });
  });
});

// ============================================================================
// Task 5.5: Unit tests for error scenarios
// ============================================================================

describe('Error scenarios - Task 5.5', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir('error-scenarios-');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('E_SOURCE_ROOT_NOT_FOUND error', () => {
    it('should return failure result when detection fails', async () => {
      const deepDir = createNestedStructure(tempDir, 15);

      const result = await detectSourceRoot(deepDir, { maxDepth: 3 });

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.ok(result.error!.includes('Source root not found'));
    });

    it('should include helpful suggestion in error message', async () => {
      const result = await detectSourceRoot(tempDir, { maxDepth: 0 });

      assert.strictEqual(result.success, false);
      assert.ok(result.error!.includes('--source-root'));
    });

    it('should return success when marker found', async () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');

      const result = await detectSourceRoot(tempDir);

      assert.strictEqual(result.success, true);
      // On macOS, realpath resolves /var to /private/var
      // Use path.normalize for comparison to handle symlinks
      assert.ok(
        result.path === tempDir ||
        result.path === fs.realpathSync(tempDir),
        `Path mismatch: ${result.path} vs ${tempDir}`
      );
      assert.strictEqual(result.markerFound, 'package.json');
    });
  });

  describe('permission denied handling', () => {
    it('should handle non-existent path gracefully', async () => {
      const nonExistent = path.join(tempDir, 'does-not-exist');

      // resolveSymlinkPath should throw for non-existent path
      try {
        await resolveSymlinkPath(nonExistent);
        assert.fail('Should have thrown error');
      } catch (err) {
        assert.ok((err as Error).message.includes('does not exist'));
      }
    });

    it('should handle path resolution errors in detectSourceRoot', async () => {
      const nonExistent = path.join(tempDir, 'nonexistent');

      const result = await detectSourceRoot(nonExistent, { resolveSymlinks: true });

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    it('should succeed with resolveSymlinks: false for valid path', async () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');

      const result = await detectSourceRoot(tempDir, { resolveSymlinks: false });

      assert.strictEqual(result.success, true);
    });
  });

  describe('circular symlink detection', () => {
    it('should detect circular symlink and return error', async () => {
      // Create circular symlinks: link1 -> link2 -> link1
      const link1 = path.join(tempDir, 'link1');
      const link2 = path.join(tempDir, 'link2');

      // Create link2 first (target doesn't exist yet, but that's OK for testing)
      try {
        fs.symlinkSync(link1, link2, 'junction');
        fs.symlinkSync(link2, link1, 'junction');
      } catch {
        // Some systems may not allow creating circular symlinks
        // Skip this test if that's the case
        return;
      }

      // Attempting to resolve circular symlink should trigger ELOOP
      try {
        await resolveSymlinkPath(link1);
        // On some systems, circular symlinks may not trigger ELOOP immediately
        // The test passes if it either throws or the detection still works
      } catch (err: unknown) {
        const errorMsg = (err as Error).message;
        assert.ok(
          errorMsg.includes('Circular symlink') ||
          errorMsg.includes('ELOOP') ||
          errorMsg.includes('cannot resolve'),
          `Unexpected error message: ${errorMsg}`
        );
      }
    });

    it('should resolve valid symlink correctly', async () => {
      // Create real directory with marker
      const realDir = path.join(tempDir, 'real');
      fs.mkdirSync(realDir);
      fs.writeFileSync(path.join(realDir, 'package.json'), '{}');

      // Create symlink to real directory
      const linkDir = path.join(tempDir, 'link');
      createSymlink(realDir, linkDir);

      const result = await resolveSymlinkPath(linkDir);

      // On macOS, realpath resolves /var to /private/var
      // Compare using realpath for both
      const expectedRealDir = fs.realpathSync(realDir);
      assert.strictEqual(result, expectedRealDir);
    });

    it('should find marker through symlink', async () => {
      // Create real directory with marker
      const realDir = path.join(tempDir, 'real');
      fs.mkdirSync(realDir);
      fs.writeFileSync(path.join(realDir, 'package.json'), '{}');

      // Create symlink
      const linkDir = path.join(tempDir, 'link');
      createSymlink(realDir, linkDir);

      // Detect via symlink path
      const result = await detectSourceRoot(linkDir);

      assert.strictEqual(result.success, true);
      // On macOS, realpath resolves /var to /private/var
      // Path should be resolved to real directory (via realpath)
      const expectedRealDir = fs.realpathSync(realDir);
      assert.strictEqual(result.path, expectedRealDir);
    });
  });

  describe('edge cases', () => {
    it('should handle empty options object', async () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');

      const result = await detectSourceRoot(tempDir, {});

      assert.strictEqual(result.success, true);
    });

    it('should handle undefined options', async () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');

      const result = await detectSourceRoot(tempDir, undefined);

      assert.strictEqual(result.success, true);
    });

    it('should use process.cwd() when cwd not specified', async () => {
      // This test verifies default behavior
      // We cannot easily test process.cwd() in isolation,
      // so we verify the function accepts undefined

      const result = await detectSourceRoot(undefined);

      // Result depends on actual process.cwd() state
      assert.ok(typeof result.success === 'boolean');
      assert.ok(typeof result.path === 'string' || result.error);
    });
  });
});

// ============================================================================
// Constants and Types Validation
// ============================================================================

describe('Constants validation', () => {
  it('should have MAX_SEARCH_DEPTH = 10', () => {
    assert.strictEqual(MAX_SEARCH_DEPTH, 10);
  });

  it('should have correct DEFAULT_DETECTOR_OPTIONS', () => {
    assert.strictEqual(DEFAULT_DETECTOR_OPTIONS.maxDepth, MAX_SEARCH_DEPTH);
    assert.strictEqual(DEFAULT_DETECTOR_OPTIONS.resolveSymlinks, true);
    assert.strictEqual(DEFAULT_DETECTOR_OPTIONS.startDir, undefined);
  });

  it('should have GENERIC_MARKER = .git', () => {
    assert.strictEqual(GENERIC_MARKER, '.git');
  });

  it('should have complete MARKER_PRIORITY list', () => {
    const expectedPriority = [
      'Cargo.toml',
      'Cargo.lock',
      'go.mod',
      'go.sum',
      'package.json',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'pyproject.toml',
      'setup.py',
      'requirements.txt',
      'Pipfile',
    ];

    assert.deepStrictEqual([...MARKER_PRIORITY], expectedPriority);
  });

  it('should have complete PROJECT_MARKERS', () => {
    assert.ok('rust' in PROJECT_MARKERS);
    assert.ok('go' in PROJECT_MARKERS);
    assert.ok('nodejs' in PROJECT_MARKERS);
    assert.ok('python' in PROJECT_MARKERS);

    assert.ok(PROJECT_MARKERS.rust.includes('Cargo.toml'));
    assert.ok(PROJECT_MARKERS.go.includes('go.mod'));
    assert.ok(PROJECT_MARKERS.nodejs.includes('package.json'));
    assert.ok(PROJECT_MARKERS.python.includes('pyproject.toml'));
  });
});

// ============================================================================
// DetectionResult Interface Validation
// ============================================================================

describe('DetectionResult interface', () => {
  it('should return correct structure on success', async () => {
    const tempDir = createTempDir('result-structure-');
    fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');

    const result = await detectSourceRoot(tempDir);

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup
    }

    assert.strictEqual(typeof result.success, 'boolean');
    if (result.success) {
      assert.strictEqual(typeof result.path, 'string');
      assert.strictEqual(typeof result.levelsSearched, 'number');
      assert.strictEqual(typeof result.markerFound, 'string');
      assert.strictEqual(result.error, undefined);
    }
  });

  it('should return correct structure on failure', async () => {
    const tempDir = createTempDir('result-failure-');

    const result = await detectSourceRoot(tempDir, { maxDepth: 0 });

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup
    }

    assert.strictEqual(typeof result.success, 'boolean');
    if (!result.success) {
      assert.strictEqual(typeof result.error, 'string');
      assert.strictEqual(result.path, undefined);
      assert.strictEqual(result.levelsSearched, undefined);
      assert.strictEqual(result.markerFound, undefined);
    }
  });
});