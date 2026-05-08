import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { scanDirectory, ScanResult, ScanOptions } from '../../src/scanner.js';
import { NodeType, EdgeType } from '../../src/types.js';

// Helper to create test fixture paths
const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');

describe('scanDirectory', () => {
  describe('ScanResult structure', () => {
    it('should return nodes array', async () => {
      const result = await scanDirectory(fixturesDir);
      assert.ok(Array.isArray(result.nodes));
    });

    it('should return edges array', async () => {
      const result = await scanDirectory(fixturesDir);
      assert.ok(Array.isArray(result.edges));
    });

    it('should return filesToParse array', async () => {
      const result = await scanDirectory(fixturesDir);
      assert.ok(Array.isArray(result.filesToParse));
    });

    it('should return stats object', async () => {
      const result = await scanDirectory(fixturesDir);
      assert.ok(typeof result.stats === 'object');
      assert.ok(typeof result.stats.directories === 'number');
      assert.ok(typeof result.stats.files === 'number');
      assert.ok(typeof result.stats.skipped === 'number');
    });

    it('should return warnings array', async () => {
      const result = await scanDirectory(fixturesDir);
      assert.ok(Array.isArray(result.warnings));
    });
  });

  describe('invalid root path', () => {
    it('should return empty result for non-existent path', async () => {
      const result = await scanDirectory('/non/existent/path');
      assert.strictEqual(result.nodes.length, 0);
      assert.strictEqual(result.edges.length, 0);
      assert.strictEqual(result.filesToParse.length, 0);
    });

    it('should add warning for non-existent path', async () => {
      const result = await scanDirectory('/non/existent/path');
      assert.ok(result.warnings.length > 0);
      assert.ok(result.warnings[0].includes('not found') || result.warnings[0].includes('does not exist'));
    });
  });

  describe('DIRECTORY node ID format', () => {
    it('should create DIRECTORY nodes with correct ID format', async () => {
      // Create a simple test fixture first
      const testDir = path.join(fixturesDir, 'simple');
      const result = await scanDirectory(testDir);

      const dirNodes = result.nodes.filter(n => n.type === NodeType.DIRECTORY);
      for (const node of dirNodes) {
        assert.ok(node.id.startsWith('DIRECTORY:'));
      }
    });

    it('should create root directory with ID "DIRECTORY:."', async () => {
      const testDir = path.join(fixturesDir, 'simple');
      const result = await scanDirectory(testDir);

      const rootDir = result.nodes.find(n => n.id === 'DIRECTORY:.');
      assert.ok(rootDir, 'Root directory node should exist with ID "DIRECTORY:."');
    });
  });

  describe('FILE node ID format', () => {
    it('should create FILE nodes with correct ID format', async () => {
      const testDir = path.join(fixturesDir, 'simple');
      const result = await scanDirectory(testDir);

      const fileNodes = result.nodes.filter(n => n.type === NodeType.FILE);
      for (const node of fileNodes) {
        assert.ok(node.id.startsWith('FILE:'));
      }
    });
  });

  describe('CONTAINS edges', () => {
    it('should create CONTAINS edges for files', async () => {
      const testDir = path.join(fixturesDir, 'simple');
      const result = await scanDirectory(testDir);

      const containsEdges = result.edges.filter(e => e.type === EdgeType.CONTAINS);
      assert.ok(containsEdges.length > 0);

      for (const edge of containsEdges) {
        assert.strictEqual(edge.type, EdgeType.CONTAINS);
        assert.ok(edge.from.startsWith('DIRECTORY:'));
        assert.ok(edge.to.startsWith('FILE:') || edge.to.startsWith('DIRECTORY:'));
      }
    });

    it('should create CONTAINS edges for subdirectories', async () => {
      const testDir = path.join(fixturesDir, 'nested');
      const result = await scanDirectory(testDir);

      // Find edge where parent CONTAINS child directory
      const dirToDirEdges = result.edges.filter(
        e => e.type === EdgeType.CONTAINS && e.to.startsWith('DIRECTORY:')
      );
      assert.ok(dirToDirEdges.length > 0, 'Should have CONTAINS edges to subdirectories');
    });
  });

  describe('ignore rules', () => {
    it('should ignore node_modules', async () => {
      const testDir = path.join(fixturesDir, 'with-node_modules');
      const result = await scanDirectory(testDir);

      // Should not have any nodes with node_modules in path
      const nodeModulesNodes = result.nodes.filter(
        n => n.path.includes('node_modules')
      );
      assert.strictEqual(nodeModulesNodes.length, 0);
    });

    it('should ignore .git directory', async () => {
      const testDir = path.join(fixturesDir, 'with-git');
      const result = await scanDirectory(testDir);

      const gitNodes = result.nodes.filter(n => n.path.includes('.git'));
      assert.strictEqual(gitNodes.length, 0);
    });
  });

  describe('file collection by extension', () => {
    it('should collect .ts files', async () => {
      const testDir = path.join(fixturesDir, 'simple');
      const result = await scanDirectory(testDir);

      const tsFiles = result.filesToParse.filter(f => f.endsWith('.ts'));
      assert.ok(tsFiles.length > 0);
    });

    it('should collect .tsx files', async () => {
      const testDir = path.join(fixturesDir, 'tsx-files');
      const result = await scanDirectory(testDir);

      const tsxFiles = result.filesToParse.filter(f => f.endsWith('.tsx'));
      assert.ok(tsxFiles.length > 0);
    });

    it('should not collect .json files by default', async () => {
      const testDir = path.join(fixturesDir, 'mixed-files');
      const result = await scanDirectory(testDir);

      const jsonFiles = result.filesToParse.filter(f => f.endsWith('.json'));
      assert.strictEqual(jsonFiles.length, 0);
    });

    it('should support custom extensions', async () => {
      const testDir = path.join(fixturesDir, 'mixed-files');
      const result = await scanDirectory(testDir, { extensions: ['.json', '.md'] });

      assert.ok(result.filesToParse.some(f => f.endsWith('.json')));
      assert.ok(result.filesToParse.some(f => f.endsWith('.md')));
    });
  });

  describe('hidden files', () => {
    it('should skip hidden files by default', async () => {
      const testDir = path.join(fixturesDir, 'hidden-files');
      const result = await scanDirectory(testDir);

      const hiddenNodes = result.nodes.filter(n => n.name.startsWith('.'));
      assert.strictEqual(hiddenNodes.length, 0);
    });

    it('should include hidden files when includeHidden=true', async () => {
      const testDir = path.join(fixturesDir, 'hidden-files');
      const result = await scanDirectory(testDir, { includeHidden: true });

      const hiddenNodes = result.nodes.filter(n => n.name.startsWith('.'));
      assert.ok(hiddenNodes.length > 0);
    });
  });

  describe('maxDepth', () => {
    it('should stop at maxDepth', async () => {
      const testDir = path.join(fixturesDir, 'deep-nested');
      const result = await scanDirectory(testDir, { maxDepth: 2 });

      assert.ok(result.warnings.some(w => w.includes('depth') || w.includes('Max')));
    });
  });

  describe('stats', () => {
    it('should count directories correctly', async () => {
      const testDir = path.join(fixturesDir, 'nested');
      const result = await scanDirectory(testDir);

      const actualDirs = result.nodes.filter(n => n.type === NodeType.DIRECTORY).length;
      assert.strictEqual(result.stats.directories, actualDirs);
    });

    it('should count files correctly', async () => {
      const testDir = path.join(fixturesDir, 'simple');
      const result = await scanDirectory(testDir);

      const actualFiles = result.nodes.filter(n => n.type === NodeType.FILE).length;
      assert.strictEqual(result.stats.files, actualFiles);
    });
  });

  describe('empty directories', () => {
    it('should create nodes for empty directories (graph structure completeness)', async () => {
      // WHY: Empty directories are valid nodes representing logical grouping.
      // Creating nodes ensures graph structure completeness for downstream tools.
      const testDir = path.join(fixturesDir, 'with-empty-dir');
      const result = await scanDirectory(testDir);

      // Empty directory should have a DIRECTORY node
      const emptyDirNode = result.nodes.find(n => n.path.includes('empty'));
      assert.notStrictEqual(emptyDirNode, undefined);
      assert.strictEqual(emptyDirNode?.type, NodeType.DIRECTORY);
      assert.strictEqual(emptyDirNode?.name, 'empty');
    });
  });

  describe('symbolic links', () => {
    it('should skip symbolic links', async () => {
      const testDir = path.join(fixturesDir, 'with-symlinks');
      const result = await scanDirectory(testDir);

      // Symlink should not create a node
      const symlinkNodes = result.nodes.filter(n => n.name === 'link');
      assert.strictEqual(symlinkNodes.length, 0);
    });
  });
});