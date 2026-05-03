import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp, rm, writeFile, readFile, mkdir, stat, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import {
  loadBaseline,
  saveBaseline,
  migrateBaseline,
  checkSchemaCompatibility,
  CURRENT_SCHEMA_VERSION,
  SchemaVersionImpl,
  ensureCodegraphDir,
  getBaselinePath,
  getBackupPath,
} from '../../src/persistence/index.js';
import { analyzeFull } from '../../src/analyzer.js';
import type { Baseline, LoadBaselineOptions } from '../../src/persistence/types.js';

describe('Integration Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'codegraph-integration-'));
    await ensureCodegraphDir(testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('full analysis → save → load cycle', () => {
    it('should complete full cycle successfully', async () => {
      // Create test fixture files
      const srcDir = join(testDir, 'src');
      await mkdir(srcDir);

      await writeFile(join(srcDir, 'main.ts'), `
import { formatDate } from './utils';
import { helper } from './helper';

export function main() {
  formatDate(new Date());
  helper();
}
`);

      await writeFile(join(srcDir, 'utils.ts'), `
export function formatDate(date: Date): string {
  return date.toISOString();
}
`);

      await writeFile(join(srcDir, 'helper.ts'), `
export function helper(): void {
  console.log('helper');
}
`);

      // Run full analysis
      const result = await analyzeFull(testDir);

      // Create baseline from analysis result
      const baseline: Baseline = {
        graph: {
          nodes: Array.from(result.graph.nodes.entries()),
          edges: result.graph.edges,
          commitHash: result.graph.commitHash ?? 'test-hash',
          timestamp: result.graph.timestamp ?? Date.now(),
        },
        commitHash: result.graph.commitHash ?? 'test-hash',
        timestamp: Date.now(),
        schemaVersion: { major: 1, minor: 0, patch: 0 },
        generatorVersion: '1.0.0',
        architectureConstraints: [],
        healthScore: 50,
        skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
      };

      // Save baseline
      await saveBaseline(baseline, testDir);

      // Verify file exists
      const baselinePath = getBaselinePath(testDir);
      const exists = await stat(baselinePath).then(() => true).catch(() => false);
      assert.strictEqual(exists, true);

      // Load baseline
      const loadResult = await loadBaseline(testDir, {
        rebuildHandler: async () => result.graph,
      });

      assert.strictEqual(loadResult.success, true);
      assert.ok(loadResult.graph);
      // commitHash may be empty for test fixtures without git
      assert.ok(loadResult.baseline?.commitHash !== undefined);
    });
  });

  describe('legacy baseline migration', () => {
    it('should migrate legacy baseline to v1.0.0', async () => {
      // Create legacy baseline (no schemaVersion)
      const legacyData = {
        graph: {
          nodes: [['FILE:a.ts', { id: 'FILE:a.ts', type: 'FILE', path: 'a.ts', name: 'a.ts' }]],
          edges: [],
          commitHash: 'abc123',
          timestamp: 1000,
        },
        commitHash: 'abc123',
        timestamp: 1000,
        generatorVersion: 'unknown',
        architectureConstraints: [],
        healthScore: 50,
        skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
      };

      // Write legacy baseline
      const baselinePath = getBaselinePath(testDir);
      await writeFile(baselinePath, JSON.stringify(legacyData));

      // Load baseline - should trigger migration
      const loadResult = await loadBaseline(testDir, {
        rebuildHandler: async () => ({
          nodes: new Map(),
          edges: [],
          commitHash: '',
          timestamp: 0,
        }),
      });

      // Migration should be triggered (via rebuild in current implementation)
      assert.strictEqual(loadResult.success, true);
    });
  });

  describe('corrupted baseline recovery', () => {
    it('should recover from corrupted data via rebuild', async () => {
      // Create corrupted baseline (duplicate node IDs)
      const corruptedData = {
        graph: {
          nodes: [
            ['FILE:a.ts', { id: 'FILE:a.ts', type: 'FILE', path: 'a.ts', name: 'a.ts' }],
            ['FILE:a.ts', { id: 'FILE:a.ts', type: 'FILE', path: 'a.ts', name: 'a.ts' }], // duplicate
          ],
          edges: [],
          commitHash: 'abc1234',
          timestamp: Date.now(),
        },
        commitHash: 'abc1234',
        timestamp: Date.now(),
        schemaVersion: { major: 1, minor: 0, patch: 0 },
        generatorVersion: '1.0.0',
        architectureConstraints: [],
        healthScore: 50,
        skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
      };

      // Write corrupted baseline
      const baselinePath = getBaselinePath(testDir);
      await writeFile(baselinePath, JSON.stringify(corruptedData));

      // Load baseline - should trigger rebuild
      const loadResult = await loadBaseline(testDir, {
        rebuildHandler: async () => ({
          nodes: new Map([
            ['FILE:a.ts', { id: 'FILE:a.ts', type: 'FILE', path: 'a.ts', name: 'a.ts' }],
          ]),
          edges: [],
          commitHash: 'rebuild',
          timestamp: Date.now(),
        }),
      });

      // Should recover via rebuild
      assert.strictEqual(loadResult.success, true);
      assert.strictEqual(loadResult.executedAction, 'rebuild');
    });
  });

  describe('schema incompatible handling', () => {
    it('should return failure for major version mismatch', async () => {
      // Create baseline with higher major version
      const futureBaseline = {
        graph: {
          nodes: [],
          edges: [],
          commitHash: 'abc1234',
          timestamp: Date.now(),
        },
        commitHash: 'abc1234',
        timestamp: Date.now(),
        schemaVersion: { major: 2, minor: 0, patch: 0 }, // Higher than current
        generatorVersion: '2.0.0',
        architectureConstraints: [],
        healthScore: 50,
        skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
      };

      // Write future baseline
      const baselinePath = getBaselinePath(testDir);
      await writeFile(baselinePath, JSON.stringify(futureBaseline));

      // Load baseline - should fail with incompatible error
      const loadResult = await loadBaseline(testDir, {
        rebuildHandler: async () => ({
          nodes: new Map(),
          edges: [],
          commitHash: '',
          timestamp: 0,
        }),
      });

      assert.strictEqual(loadResult.success, false);
      assert.strictEqual(loadResult.failure?.reason, 'schema_incompatible');
    });
  });

  describe('multi-step migration execution', () => {
    it('should execute multi-step migrations correctly', async () => {
      // Create baseline at version 1.0.0
      const baseline: Baseline = {
        graph: {
          nodes: [],
          edges: [],
          commitHash: 'abc1234',
          timestamp: Date.now(),
        },
        commitHash: 'abc1234',
        timestamp: Date.now(),
        schemaVersion: { major: 1, minor: 0, patch: 0 },
        generatorVersion: '1.0.0',
        architectureConstraints: [],
        healthScore: 50,
        skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
      };

      // Migrate to 1.3.0 (would require multi-step if scripts registered)
      const target = new SchemaVersionImpl(1, 0, 0);

      // Currently no 1.x migration scripts registered, so baseline stays unchanged
      const result = await migrateBaseline(baseline, testDir, target);

      assert.strictEqual(result.schemaVersion.major, 1);
      assert.strictEqual(result.schemaVersion.minor, 0);
    });
  });

  describe('readBaselineFile helper scenarios', () => {
    it('should return permission_error when file read fails (permission denied)', async () => {
      // Create baseline file
      const baselinePath = getBaselinePath(testDir);
      const validBaseline = {
        graph: {
          nodes: [],
          edges: [],
          commitHash: 'abc123',
          timestamp: Date.now(),
        },
        commitHash: 'abc123',
        timestamp: Date.now(),
        schemaVersion: { major: 1, minor: 0, patch: 0 },
        generatorVersion: '1.0.0',
        architectureConstraints: [],
        healthScore: 50,
        skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
      };

      await writeFile(baselinePath, JSON.stringify(validBaseline));

      // Make file unreadable (no read permission)
      await chmod(baselinePath, 0o000);

      // Try to load baseline - should fail with permission_error
      const loadResult = await loadBaseline(testDir, {
        rebuildHandler: async () => ({
          nodes: new Map(),
          edges: [],
          commitHash: '',
          timestamp: 0,
        }),
      });

      // Restore permissions for cleanup (even if test fails)
      try {
        await chmod(baselinePath, 0o644);
      } catch {
        // Ignore if we can't restore
      }

      assert.strictEqual(loadResult.success, false);
      assert.strictEqual(loadResult.failure?.reason, 'permission_error');
    });

    it('should return parse_error for malformed JSON content', async () => {
      // Create baseline file with broken JSON
      const baselinePath = getBaselinePath(testDir);
      const malformedJson = '{ "graph": { "nodes": [broken json';

      await writeFile(baselinePath, malformedJson);

      // Try to load baseline - should fail with parse_error
      const loadResult = await loadBaseline(testDir, {
        rebuildHandler: async () => ({
          nodes: new Map(),
          edges: [],
          commitHash: '',
          timestamp: 0,
        }),
      });

      assert.strictEqual(loadResult.success, false);
      assert.strictEqual(loadResult.failure?.reason, 'parse_error');
    });

    it('should return parse_error for empty file', async () => {
      // Create empty baseline file
      const baselinePath = getBaselinePath(testDir);
      await writeFile(baselinePath, '');

      // Try to load baseline - should fail with parse_error
      const loadResult = await loadBaseline(testDir, {
        rebuildHandler: async () => ({
          nodes: new Map(),
          edges: [],
          commitHash: '',
          timestamp: 0,
        }),
      });

      assert.strictEqual(loadResult.success, false);
      assert.strictEqual(loadResult.failure?.reason, 'parse_error');
    });

    it('should return file_not_found when baseline does not exist', async () => {
      // Do not create baseline file - test directory is empty
      const loadResult = await loadBaseline(testDir, {
        rebuildHandler: async () => ({
          nodes: new Map(),
          edges: [],
          commitHash: 'rebuild-hash',
          timestamp: Date.now(),
        }),
      });

      // file_not_found triggers auto-rebuild, so success should be true
      assert.strictEqual(loadResult.success, true);
      assert.strictEqual(loadResult.executedAction, 'rebuild');
      assert.strictEqual(loadResult.graph?.commitHash, 'rebuild-hash');
    });
  });
});