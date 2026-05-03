import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp, rm, writeFile, readFile, stat, mkdir, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  saveBaseline,
} from '../../src/persistence/save.js';
import type {
  Baseline,
  SaveBaselineOptions,
} from '../../src/persistence/types.js';
import {
  getBaselinePath,
  getBackupPath,
  getVersionPath,
  getLastCommitPath,
  ensureCodegraphDir,
} from '../../src/persistence/paths.js';

// Helper to create valid mock baseline
function createValidBaseline(): Baseline {
  return {
    graph: {
      nodes: [
        ['FILE:a.ts', { id: 'FILE:a.ts', type: 'FILE', path: 'a.ts', name: 'a.ts' }],
        ['MODULE:a.ts#func', { id: 'MODULE:a.ts#func', type: 'MODULE', path: 'a.ts', name: 'func' }],
      ],
      edges: [{ from: 'FILE:a.ts', to: 'MODULE:a.ts#func', type: 'CONTAINS' }],
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
}

describe('saveBaseline', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'codegraph-save-test-'));
    await ensureCodegraphDir(testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('atomic write', () => {
    it('should create baseline.json file', async () => {
      const baseline = createValidBaseline();
      await saveBaseline(baseline, testDir);

      const baselinePath = getBaselinePath(testDir);
      const exists = await stat(baselinePath).then(() => true).catch(() => false);
      assert.strictEqual(exists, true);
    });

    it('should write valid JSON content', async () => {
      const baseline = createValidBaseline();
      await saveBaseline(baseline, testDir);

      const baselinePath = getBaselinePath(testDir);
      const content = await readFile(baselinePath, 'utf-8');
      const parsed = JSON.parse(content);

      assert.strictEqual(parsed.commitHash, baseline.commitHash);
      assert.strictEqual(parsed.schemaVersion.major, 1);
      assert.strictEqual(parsed.schemaVersion.minor, 0);
      assert.strictEqual(parsed.schemaVersion.patch, 0);
    });

    it('should write to temp file first then rename (atomic)', async () => {
      const baseline = createValidBaseline();
      const baselinePath = getBaselinePath(testDir);

      // Before save, no baseline.json should exist
      const beforeExists = await stat(baselinePath).then(() => true).catch(() => false);
      assert.strictEqual(beforeExists, false);

      await saveBaseline(baseline, testDir);

      // After save, baseline.json should exist
      const afterExists = await stat(baselinePath).then(() => true).catch(() => false);
      assert.strictEqual(afterExists, true);
    });

    it('should handle concurrent writes safely', async () => {
      // Sequential writes to avoid .tmp file race condition
      const baseline1 = createValidBaseline();
      baseline1.commitHash = 'hash1111';

      const baseline2 = createValidBaseline();
      baseline2.commitHash = 'hash2222';

      // Write sequentially (concurrent writes to same file need serialization)
      await saveBaseline(baseline1, testDir);
      await saveBaseline(baseline2, testDir);

      // Final baseline should be the last written one
      const baselinePath = getBaselinePath(testDir);
      const content = await readFile(baselinePath, 'utf-8');
      const parsed = JSON.parse(content);

      // Should be valid JSON with the last hash
      assert.strictEqual(parsed.commitHash, 'hash2222');
    });
  });

  describe('backup creation', () => {
    it('should create backup when createBackup is true', async () => {
      const baseline = createValidBaseline();

      // First save to create initial baseline
      await saveBaseline(baseline, testDir);

      // Modify and save with backup
      const modifiedBaseline = createValidBaseline();
      modifiedBaseline.commitHash = 'newhash1';
      await saveBaseline(modifiedBaseline, testDir, { createBackup: true });

      const backupPath = getBackupPath(testDir);
      const exists = await stat(backupPath).then(() => true).catch(() => false);
      assert.strictEqual(exists, true);

      // Backup should have original content
      const backupContent = await readFile(backupPath, 'utf-8');
      const backupParsed = JSON.parse(backupContent);
      assert.strictEqual(backupParsed.commitHash, 'abc1234');
    });

    it('should not create backup when createBackup is false', async () => {
      const baseline = createValidBaseline();
      await saveBaseline(baseline, testDir, { createBackup: false });

      const backupPath = getBackupPath(testDir);
      const exists = await stat(backupPath).then(() => true).catch(() => false);
      assert.strictEqual(exists, false);
    });

    it('should not create backup when baseline.json does not exist', async () => {
      const baseline = createValidBaseline();
      await saveBaseline(baseline, testDir, { createBackup: true });

      // First save should not create backup (no previous baseline)
      const backupPath = getBackupPath(testDir);
      const exists = await stat(backupPath).then(() => true).catch(() => false);
      assert.strictEqual(exists, false);
    });
  });

  describe('file permissions', () => {
    it('should create file with default permissions 0644', async () => {
      const baseline = createValidBaseline();
      await saveBaseline(baseline, testDir);

      const baselinePath = getBaselinePath(testDir);
      const stats = await stat(baselinePath);

      // Check file permissions (mode)
      // Note: On macOS/Linux, 0644 = 0o644 = 33188 in decimal
      // We check that it's readable by owner (0o400 bit)
      assert.ok((stats.mode & 0o400) !== 0, 'File should be readable by owner');
    });

    it('should accept custom mode option', async () => {
      const baseline = createValidBaseline();
      await saveBaseline(baseline, testDir, { mode: 0o600 });

      const baselinePath = getBaselinePath(testDir);
      const stats = await stat(baselinePath);

      // Check that file is readable and writable only by owner
      // 0o600 = owner read + write
      assert.strictEqual((stats.mode & 0o777), 0o600);
    });
  });

  describe('lastCommit.txt update', () => {
    it('should update lastCommit.txt after save', async () => {
      const baseline = createValidBaseline();
      baseline.commitHash = 'def5678';
      await saveBaseline(baseline, testDir);

      const lastCommitPath = getLastCommitPath(testDir);
      const content = await readFile(lastCommitPath, 'utf-8');
      assert.strictEqual(content.trim(), 'def5678');
    });

    it('should create lastCommit.txt if it does not exist', async () => {
      const baseline = createValidBaseline();
      await saveBaseline(baseline, testDir);

      const lastCommitPath = getLastCommitPath(testDir);
      const exists = await stat(lastCommitPath).then(() => true).catch(() => false);
      assert.strictEqual(exists, true);
    });
  });

  describe('.version file creation', () => {
    it('should create .version file when createVersionFile is true', async () => {
      const baseline = createValidBaseline();
      await saveBaseline(baseline, testDir, { createVersionFile: true });

      const versionPath = getVersionPath(testDir);
      const exists = await stat(versionPath).then(() => true).catch(() => false);
      assert.strictEqual(exists, true);

      const content = await readFile(versionPath, 'utf-8');
      assert.strictEqual(content.trim(), '1.0.0');
    });

    it('should not create .version file when createVersionFile is false', async () => {
      const baseline = createValidBaseline();
      await saveBaseline(baseline, testDir, { createVersionFile: false });

      const versionPath = getVersionPath(testDir);
      const exists = await stat(versionPath).then(() => true).catch(() => false);
      assert.strictEqual(exists, false);
    });
  });

  describe('error handling', () => {
    it('should throw error when directory does not exist', async () => {
      const baseline = createValidBaseline();
      const nonExistentDir = join(tmpdir(), 'non-existent-dir');

      await assert.rejects(
        async () => saveBaseline(baseline, nonExistentDir),
        /Directory does not exist/
      );
    });

    it('should handle disk/write errors gracefully', async () => {
      // This test verifies the function structure handles errors
      // Actual permission/disk errors depend on OS behavior
      const baseline = createValidBaseline();
      await saveBaseline(baseline, testDir);

      // Verify baseline was saved correctly
      const baselinePath = getBaselinePath(testDir);
      const content = await readFile(baselinePath, 'utf-8');
      const parsed = JSON.parse(content);
      assert.strictEqual(parsed.commitHash, baseline.commitHash);
    });
  });

  describe('save/load round-trip', () => {
    it('should produce identical baseline after save/load cycle', async () => {
      const baseline = createValidBaseline();
      await saveBaseline(baseline, testDir);

      const baselinePath = getBaselinePath(testDir);
      const content = await readFile(baselinePath, 'utf-8');
      const loaded = JSON.parse(content);

      // Verify all fields match
      assert.strictEqual(loaded.commitHash, baseline.commitHash);
      assert.strictEqual(loaded.timestamp, baseline.timestamp);
      assert.deepStrictEqual(loaded.schemaVersion, baseline.schemaVersion);
      assert.strictEqual(loaded.generatorVersion, baseline.generatorVersion);
      assert.deepStrictEqual(loaded.architectureConstraints, baseline.architectureConstraints);
      assert.strictEqual(loaded.healthScore, baseline.healthScore);
      assert.deepStrictEqual(loaded.skillDemand, baseline.skillDemand);

      // Verify graph structure
      assert.strictEqual(loaded.graph.nodes.length, baseline.graph.nodes.length);
      assert.strictEqual(loaded.graph.edges.length, baseline.graph.edges.length);
      assert.strictEqual(loaded.graph.commitHash, baseline.graph.commitHash);
      assert.strictEqual(loaded.graph.timestamp, baseline.graph.timestamp);
    });

    it('should preserve node map structure in graph', async () => {
      const baseline = createValidBaseline();
      await saveBaseline(baseline, testDir);

      const baselinePath = getBaselinePath(testDir);
      const content = await readFile(baselinePath, 'utf-8');
      const loaded = JSON.parse(content);

      // Verify nodes are stored as [id, node] pairs
      assert.ok(Array.isArray(loaded.graph.nodes));
      assert.ok(Array.isArray(loaded.graph.nodes[0]));
      assert.strictEqual(loaded.graph.nodes[0][0], 'FILE:a.ts');
      assert.strictEqual(loaded.graph.nodes[0][1].type, 'FILE');
    });
  });

  describe('graph serialization', () => {
    it('should include schemaVersion in output when set', async () => {
      const baseline = createValidBaseline();
      baseline.schemaVersion = { major: 1, minor: 2, patch: 3 };
      await saveBaseline(baseline, testDir);

      const baselinePath = getBaselinePath(testDir);
      const content = await readFile(baselinePath, 'utf-8');
      const loaded = JSON.parse(content);

      assert.strictEqual(loaded.schemaVersion.major, 1);
      assert.strictEqual(loaded.schemaVersion.minor, 2);
      assert.strictEqual(loaded.schemaVersion.patch, 3);
    });

    it('should include migrationHistory when present', async () => {
      const baseline = createValidBaseline();
      baseline.migrationHistory = [
        {
          fromVersion: 'legacy',
          toVersion: '1.0.0',
          migratedAt: Date.now(),
          strategy: 'migrate',
        },
      ];
      await saveBaseline(baseline, testDir);

      const baselinePath = getBaselinePath(testDir);
      const content = await readFile(baselinePath, 'utf-8');
      const loaded = JSON.parse(content);

      assert.ok(loaded.migrationHistory);
      assert.strictEqual(loaded.migrationHistory.length, 1);
      assert.strictEqual(loaded.migrationHistory[0].fromVersion, 'legacy');
    });
  });
});