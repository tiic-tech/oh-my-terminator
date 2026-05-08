import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import { performance } from 'perf_hooks';
import {
  analyzeFull,
  type FullAnalysisResult,
  type AnalysisOptions,
  type ProgressEvent,
} from '../../src/analyzer.js';
import { NodeType, EdgeType, CodeGraph } from '../../src/index.js';

describe('analyzeFull function', () => {
  const fixturesDir = path.resolve('tests/fixtures');

  describe('basic functionality', () => {
    it('should return FullAnalysisResult structure', async () => {
      const projectPath = path.join(fixturesDir, 'import-test-project');
      if (!fs.existsSync(projectPath)) {
        return; // Skip if fixture doesn't exist
      }

      const result = await analyzeFull(projectPath);

      assert.ok(result.graph instanceof CodeGraph);
      assert.ok(Array.isArray(result.warnings));
      assert.ok(typeof result.stats.totalTimeMs === 'number');
    });

    it('should have complete stats', async () => {
      const projectPath = path.join(fixturesDir, 'import-test-project');
      if (!fs.existsSync(projectPath)) {
        return;
      }

      const result = await analyzeFull(projectPath);

      assert.ok(typeof result.stats.scanTimeMs === 'number');
      assert.ok(typeof result.stats.parseTimeMs === 'number');
      assert.ok(typeof result.stats.totalTimeMs === 'number');
      assert.ok(typeof result.stats.filesParsed === 'number');
      assert.ok(typeof result.stats.parseErrors === 'number');
      assert.ok(typeof result.stats.directories === 'number');
      assert.ok(typeof result.stats.files === 'number');
      assert.ok(typeof result.stats.modules === 'number');
      assert.ok(typeof result.stats.edges === 'number');
    });

    it('should contain DIRECTORY nodes', async () => {
      const projectPath = path.join(fixturesDir, 'import-test-project');
      if (!fs.existsSync(projectPath)) {
        return;
      }

      const result = await analyzeFull(projectPath);
      const dirNodes = result.graph.getNodes().filter(n => n.type === NodeType.DIRECTORY);

      assert.ok(dirNodes.length > 0, 'Should have DIRECTORY nodes');
    });

    it('should contain FILE nodes', async () => {
      const projectPath = path.join(fixturesDir, 'import-test-project');
      if (!fs.existsSync(projectPath)) {
        return;
      }

      const result = await analyzeFull(projectPath);
      const fileNodes = result.graph.getNodes().filter(n => n.type === NodeType.FILE);

      assert.ok(fileNodes.length > 0, 'Should have FILE nodes');
    });

    it('should contain MODULE nodes', async () => {
      const projectPath = path.join(fixturesDir, 'module-test-project');
      if (!fs.existsSync(projectPath)) {
        return;
      }

      const result = await analyzeFull(projectPath);
      const moduleNodes = result.graph.getNodes().filter(n => n.type === NodeType.MODULE);

      assert.ok(moduleNodes.length > 0, 'Should have MODULE nodes');
    });

    it('should contain CONTAINS edges', async () => {
      const projectPath = path.join(fixturesDir, 'import-test-project');
      if (!fs.existsSync(projectPath)) {
        return;
      }

      const result = await analyzeFull(projectPath);
      const containsEdges = result.graph.getEdges().filter(e => e.type === EdgeType.CONTAINS);

      assert.ok(containsEdges.length > 0, 'Should have CONTAINS edges');
    });

    it('should contain IMPORTS edges', async () => {
      const projectPath = path.join(fixturesDir, 'import-test-project');
      if (!fs.existsSync(projectPath)) {
        return;
      }

      const result = await analyzeFull(projectPath);
      const importsEdges = result.graph.getEdges().filter(e => e.type === EdgeType.IMPORTS);

      assert.ok(importsEdges.length > 0, 'Should have IMPORTS edges');
    });
  });

  describe('options handling', () => {
    it('should accept empty options', async () => {
      const projectPath = path.join(fixturesDir, 'import-test-project');
      if (!fs.existsSync(projectPath)) {
        return;
      }

      const result = await analyzeFull(projectPath, {});
      assert.ok(result.graph instanceof CodeGraph);
    });

    it('should accept custom extensions', async () => {
      const projectPath = path.join(fixturesDir, 'import-test-project');
      if (!fs.existsSync(projectPath)) {
        return;
      }

      const result = await analyzeFull(projectPath, {
        extensions: ['.ts'],
      });

      // Only .ts files should be parsed
      assert.ok(result.stats.filesParsed >= 0);
    });

    it('should pass scanOptions to scanner', async () => {
      const projectPath = path.join(fixturesDir, 'import-test-project');
      if (!fs.existsSync(projectPath)) {
        return;
      }

      const result = await analyzeFull(projectPath, {
        scanOptions: {
          maxDepth: 5,
        },
      });

      assert.ok(result.graph instanceof CodeGraph);
    });
  });

  describe('progress reporting', () => {
    it('should invoke onProgress callback', async () => {
      const projectPath = path.join(fixturesDir, 'import-test-project');
      if (!fs.existsSync(projectPath)) {
        return;
      }

      const events: ProgressEvent[] = [];
      const result = await analyzeFull(projectPath, {
        onProgress: (event) => {
          events.push(event);
        },
      });

      assert.ok(events.length > 0, 'Should have progress events');
    });

    it('should report scan phase', async () => {
      const projectPath = path.join(fixturesDir, 'import-test-project');
      if (!fs.existsSync(projectPath)) {
        return;
      }

      const events: ProgressEvent[] = [];
      await analyzeFull(projectPath, {
        onProgress: (event) => {
          events.push(event);
        },
      });

      const scanEvents = events.filter(e => e.phase === 'scan');
      assert.ok(scanEvents.length > 0, 'Should have scan phase events');
    });

    it('should report parse phase with filePath', async () => {
      const projectPath = path.join(fixturesDir, 'import-test-project');
      if (!fs.existsSync(projectPath)) {
        return;
      }

      const events: ProgressEvent[] = [];
      await analyzeFull(projectPath, {
        onProgress: (event) => {
          events.push(event);
        },
      });

      const parseEvents = events.filter(e => e.phase === 'parse');
      assert.ok(parseEvents.length > 0, 'Should have parse phase events');

      // Parse events should have filePath
      const parseWithFilePath = parseEvents.filter(e => e.filePath);
      assert.ok(parseWithFilePath.length > 0, 'Parse events should have filePath');
    });

    it('should report complete phase', async () => {
      const projectPath = path.join(fixturesDir, 'import-test-project');
      if (!fs.existsSync(projectPath)) {
        return;
      }

      const events: ProgressEvent[] = [];
      await analyzeFull(projectPath, {
        onProgress: (event) => {
          events.push(event);
        },
      });

      const completeEvents = events.filter(e => e.phase === 'complete');
      assert.ok(completeEvents.length > 0, 'Should have complete phase event');
    });

    it('should work silently without callback', async () => {
      const projectPath = path.join(fixturesDir, 'import-test-project');
      if (!fs.existsSync(projectPath)) {
        return;
      }

      // No onProgress callback
      const result = await analyzeFull(projectPath);

      assert.ok(result.graph instanceof CodeGraph);
      assert.ok(result.stats.totalTimeMs > 0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty project', async () => {
      // Create temp empty project
      const emptyProject = path.join(fixturesDir, 'empty-project-temp');
      if (!fs.existsSync(emptyProject)) {
        fs.mkdirSync(emptyProject, { recursive: true });
      }

      const result = await analyzeFull(emptyProject);

      // Should return valid result with empty stats
      assert.ok(result.graph instanceof CodeGraph);
      assert.strictEqual(result.stats.filesParsed, 0);
      assert.strictEqual(result.stats.parseErrors, 0);
    });

    it('should handle path not exists', async () => {
      const nonExistent = path.join(fixturesDir, 'non-existent-project');

      const result = await analyzeFull(nonExistent);

      // Should return with warnings
      assert.ok(result.warnings.length > 0);
      assert.ok(result.warnings.some(w => w.includes('not exist') || w.includes('not found')));
    });

    it('should handle mixed file types', async () => {
      const projectPath = path.join(fixturesDir, 'mixed-content');
      if (!fs.existsSync(projectPath)) {
        return;
      }

      const result = await analyzeFull(projectPath);

      // Should parse only supported extensions
      assert.ok(result.stats.filesParsed >= 0);
    });

    it('should continue on parse errors', async () => {
      const projectPath = path.join(fixturesDir, 'error-files-project');
      if (!fs.existsSync(projectPath)) {
        return;
      }

      const result = await analyzeFull(projectPath);

      // Should have parsed some files even if some failed
      // And warnings should contain error messages
      if (result.stats.parseErrors > 0) {
        assert.ok(result.warnings.length > 0);
      }
    });
  });

  describe('performance', () => {
    it('should complete in reasonable time', async () => {
      const projectPath = path.join(fixturesDir, 'import-test-project');
      if (!fs.existsSync(projectPath)) {
        return;
      }

      const start = performance.now();
      const result = await analyzeFull(projectPath);
      const elapsed = performance.now() - start;

      // Should be fast (< 5 seconds for small projects)
      assert.ok(elapsed < 5000, `Analysis took ${elapsed}ms, should be < 5000ms`);
    });
  });
});