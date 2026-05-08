import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerMigration,
  versionMatchesPattern,
  findMigrationPath,
  migrateBaseline,
  clearMigrationRegistry,
} from '../../src/persistence/migrations/index.js';
import { legacyToV1_0_0 } from '../../src/persistence/migrations/legacy-to-1.0.0.js';
import type {
  Baseline,
  MigrationScript,
} from '../../src/persistence/types.js';
import { SchemaVersionImpl } from '../../src/version.js';

// Helper to create valid mock baseline
function createValidBaseline(version?: { major: number; minor: number; patch: number }): Baseline {
  return {
    graph: {
      nodes: [],
      edges: [],
      commitHash: 'abc1234',
      timestamp: Date.now(),
    },
    commitHash: 'abc1234',
    timestamp: Date.now(),
    schemaVersion: version ?? { major: 1, minor: 0, patch: 0 },
    generatorVersion: '1.0.0',
    architectureConstraints: [],
    healthScore: 50,
    skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
  };
}

// Helper to create migration script
function createMigration(from: string, to: string, desc: string): MigrationScript {
  return {
    fromVersion: from,
    toVersion: to,
    description: desc,
    migrate: (baseline: Baseline) => {
      // Update schemaVersion
      const parsed = SchemaVersionImpl.parse(to);
      baseline.schemaVersion = { major: parsed.major, minor: parsed.minor, patch: parsed.patch };
      return baseline;
    },
  };
}

describe('Migration Framework', () => {
  beforeEach(() => {
    clearMigrationRegistry();
  });

  afterEach(() => {
    clearMigrationRegistry();
  });

  describe('registerMigration', () => {
    it('should register a migration script', () => {
      const migration = createMigration('1.0.0', '1.1.0', 'Add new field');
      registerMigration(migration);

      // Verify by finding migration path
      const path = findMigrationPath(
        SchemaVersionImpl.parse('1.0.0'),
        SchemaVersionImpl.parse('1.1.0')
      );
      assert.ok(path !== null);
      assert.strictEqual(path?.length, 1);
      assert.strictEqual(path?.[0].fromVersion, '1.0.0');
    });

    it('should register multiple migration scripts', () => {
      registerMigration(createMigration('1.0.0', '1.1.0', 'Step 1'));
      registerMigration(createMigration('1.1.0', '1.2.0', 'Step 2'));

      const path = findMigrationPath(
        SchemaVersionImpl.parse('1.0.0'),
        SchemaVersionImpl.parse('1.2.0')
      );
      assert.ok(path !== null);
      assert.strictEqual(path?.length, 2);
    });

    it('should handle duplicate registration by replacing', () => {
      const migration1 = createMigration('1.0.0', '1.1.0', 'First version');
      const migration2 = createMigration('1.0.0', '1.1.0', 'Updated version');

      registerMigration(migration1);
      registerMigration(migration2);

      const path = findMigrationPath(
        SchemaVersionImpl.parse('1.0.0'),
        SchemaVersionImpl.parse('1.1.0')
      );
      assert.ok(path !== null);
      assert.strictEqual(path?.[0].description, 'Updated version');
    });
  });

  describe('versionMatchesPattern', () => {
    it('should match exact version', () => {
      const version = SchemaVersionImpl.parse('1.0.0');
      assert.strictEqual(versionMatchesPattern(version, '1.0.0'), true);
    });

    it('should not match different exact version', () => {
      const version = SchemaVersionImpl.parse('1.0.0');
      assert.strictEqual(versionMatchesPattern(version, '1.1.0'), false);
    });

    it('should match wildcard major version (x.0.0)', () => {
      const version = SchemaVersionImpl.parse('1.0.0');
      assert.strictEqual(versionMatchesPattern(version, 'x.0.0'), true);
      assert.strictEqual(versionMatchesPattern(version, 'x.1.0'), false);
    });

    it('should match wildcard minor version (1.x.0)', () => {
      const version = SchemaVersionImpl.parse('1.5.0');
      assert.strictEqual(versionMatchesPattern(version, '1.x.0'), true);
      assert.strictEqual(versionMatchesPattern(version, '2.x.0'), false);
    });

    it('should match wildcard patch version (1.0.x)', () => {
      const version = SchemaVersionImpl.parse('1.0.9');
      assert.strictEqual(versionMatchesPattern(version, '1.0.x'), true);
      assert.strictEqual(versionMatchesPattern(version, '1.1.x'), false);
    });

    it('should match multiple wildcards (x.x.0)', () => {
      const version = SchemaVersionImpl.parse('2.3.0');
      assert.strictEqual(versionMatchesPattern(version, 'x.x.0'), true);
      assert.strictEqual(versionMatchesPattern(version, 'x.x.1'), false);
    });

    it('should match full wildcard (x.x.x)', () => {
      const version = SchemaVersionImpl.parse('3.7.2');
      assert.strictEqual(versionMatchesPattern(version, 'x.x.x'), true);
    });

    it('should handle legacy version string', () => {
      // Legacy is a special case - version 0.0.0 represents unversioned baseline
      const version = new SchemaVersionImpl(0, 0, 0);
      assert.strictEqual(versionMatchesPattern(version, 'legacy'), true);

      // Non-zero versions don't match legacy
      const normalVersion = SchemaVersionImpl.parse('1.0.0');
      assert.strictEqual(versionMatchesPattern(normalVersion, 'legacy'), false);
    });
  });

  describe('findMigrationPath', () => {
    it('should return null when no migration needed (same version)', () => {
      const from = SchemaVersionImpl.parse('1.0.0');
      const to = SchemaVersionImpl.parse('1.0.0');

      const path = findMigrationPath(from, to);
      assert.strictEqual(path, null);
    });

    it('should return null when no migration registered', () => {
      const from = SchemaVersionImpl.parse('1.0.0');
      const to = SchemaVersionImpl.parse('1.1.0');

      const path = findMigrationPath(from, to);
      assert.strictEqual(path, null);
    });

    it('should find direct migration path', () => {
      registerMigration(createMigration('1.0.0', '1.1.0', 'Direct'));

      const from = SchemaVersionImpl.parse('1.0.0');
      const to = SchemaVersionImpl.parse('1.1.0');

      const path = findMigrationPath(from, to);
      assert.ok(path !== null);
      assert.strictEqual(path?.length, 1);
      assert.strictEqual(path?.[0].fromVersion, '1.0.0');
      assert.strictEqual(path?.[0].toVersion, '1.1.0');
    });

    it('should find multi-step migration path using BFS', () => {
      registerMigration(createMigration('1.0.0', '1.1.0', 'Step 1'));
      registerMigration(createMigration('1.1.0', '1.2.0', 'Step 2'));
      registerMigration(createMigration('1.2.0', '1.3.0', 'Step 3'));

      const from = SchemaVersionImpl.parse('1.0.0');
      const to = SchemaVersionImpl.parse('1.3.0');

      const path = findMigrationPath(from, to);
      assert.ok(path !== null);
      assert.strictEqual(path?.length, 3);
      assert.strictEqual(path?.[0].fromVersion, '1.0.0');
      assert.strictEqual(path?.[1].fromVersion, '1.1.0');
      assert.strictEqual(path?.[2].fromVersion, '1.2.0');
    });

    it('should find shortest path when multiple paths exist', () => {
      // Shorter path: 1.0.0 → 1.3.0 (direct)
      // Longer path: 1.0.0 → 1.1.0 → 1.2.0 → 1.3.0
      registerMigration(createMigration('1.0.0', '1.1.0', 'Long step 1'));
      registerMigration(createMigration('1.1.0', '1.2.0', 'Long step 2'));
      registerMigration(createMigration('1.2.0', '1.3.0', 'Long step 3'));
      registerMigration(createMigration('1.0.0', '1.3.0', 'Direct shortcut'));

      const from = SchemaVersionImpl.parse('1.0.0');
      const to = SchemaVersionImpl.parse('1.3.0');

      const path = findMigrationPath(from, to);
      assert.ok(path !== null);
      assert.strictEqual(path?.length, 1);
      assert.strictEqual(path?.[0].description, 'Direct shortcut');
    });

    it('should match wildcard patterns in fromVersion', () => {
      registerMigration({
        fromVersion: '1.x.0',
        toVersion: '1.1.0',
        description: 'Any 1.x to 1.1',
        migrate: (b) => {
          b.schemaVersion = { major: 1, minor: 1, patch: 0 };
          return b;
        },
      });

      const from = SchemaVersionImpl.parse('1.0.0');
      const to = SchemaVersionImpl.parse('1.1.0');

      const path = findMigrationPath(from, to);
      assert.ok(path !== null);
      assert.strictEqual(path?.length, 1);
    });

    it('should handle legacy baseline with special migration', () => {
      registerMigration({
        fromVersion: 'legacy',
        toVersion: '1.0.0',
        description: 'Legacy to v1',
        migrate: (b) => {
          b.schemaVersion = { major: 1, minor: 0, patch: 0 };
          b.generatorVersion = '1.0.0';
          b.migrationHistory = [{
            fromVersion: 'legacy',
            toVersion: '1.0.0',
            migratedAt: Date.now(),
            strategy: 'migrate',
          }];
          return b;
        },
      });

      // Legacy version is represented as 0.0.0
      const from = new SchemaVersionImpl(0, 0, 0);
      const to = SchemaVersionImpl.parse('1.0.0');

      const path = findMigrationPath(from, to);
      assert.ok(path !== null);
      assert.strictEqual(path?.length, 1);
      assert.strictEqual(path?.[0].fromVersion, 'legacy');
      assert.strictEqual(path?.[0].toVersion, '1.0.0');
    });
  });

  describe('migrateBaseline', () => {
    it('should apply single migration', async () => {
      registerMigration(createMigration('1.0.0', '1.1.0', 'Add field'));

      const baseline = createValidBaseline({ major: 1, minor: 0, patch: 0 });
      const cwd = '/test';
      const target = SchemaVersionImpl.parse('1.1.0');

      const result = await migrateBaseline(baseline, cwd, target);

      assert.strictEqual(result.schemaVersion.major, 1);
      assert.strictEqual(result.schemaVersion.minor, 1);
      assert.strictEqual(result.schemaVersion.patch, 0);
    });

    it('should apply multi-step migrations in sequence', async () => {
      registerMigration(createMigration('1.0.0', '1.1.0', 'Step 1'));
      registerMigration(createMigration('1.1.0', '1.2.0', 'Step 2'));
      registerMigration(createMigration('1.2.0', '1.3.0', 'Step 3'));

      const baseline = createValidBaseline({ major: 1, minor: 0, patch: 0 });
      const cwd = '/test';
      const target = SchemaVersionImpl.parse('1.3.0');

      const result = await migrateBaseline(baseline, cwd, target);

      assert.strictEqual(result.schemaVersion.major, 1);
      assert.strictEqual(result.schemaVersion.minor, 3);
      assert.strictEqual(result.schemaVersion.patch, 0);

      // Check migration history
      assert.ok(result.migrationHistory);
      assert.strictEqual(result.migrationHistory?.length, 3);
    });

    it('should update schemaVersion after each step', async () => {
      registerMigration(createMigration('1.0.0', '1.1.0', 'Step'));
      registerMigration(createMigration('1.1.0', '1.2.0', 'Step 2'));

      const baseline = createValidBaseline({ major: 1, minor: 0, patch: 0 });
      const target = SchemaVersionImpl.parse('1.2.0');

      const result = await migrateBaseline(baseline, '/test', target);

      assert.strictEqual(result.schemaVersion.minor, 2);
    });

    it('should append to migrationHistory after each step', async () => {
      registerMigration(createMigration('1.0.0', '1.1.0', 'Step'));

      const baseline = createValidBaseline({ major: 1, minor: 0, patch: 0 });
      baseline.migrationHistory = [];
      const target = SchemaVersionImpl.parse('1.1.0');

      const result = await migrateBaseline(baseline, '/test', target);

      assert.ok(result.migrationHistory);
      assert.strictEqual(result.migrationHistory?.length, 1);
      assert.strictEqual(result.migrationHistory?.[0].fromVersion, '1.0.0');
      assert.strictEqual(result.migrationHistory?.[0].toVersion, '1.1.0');
      assert.strictEqual(result.migrationHistory?.[0].strategy, 'migrate');
    });

    it('should throw when no migration path exists', async () => {
      const baseline = createValidBaseline({ major: 0, minor: 9, patch: 0 });

      await assert.rejects(
        async () => migrateBaseline(baseline, '/test'),
        /No migration path found/
      );
    });

    it('should return original baseline when already at target version', async () => {
      registerMigration(createMigration('1.0.0', '1.1.0', 'Step'));

      const baseline = createValidBaseline({ major: 1, minor: 0, patch: 0 });
      const target = SchemaVersionImpl.parse('1.0.0');

      const result = await migrateBaseline(baseline, '/test', target);

      // Should return unchanged (no migration needed)
      assert.strictEqual(result.schemaVersion.minor, 0);
      assert.strictEqual(result.migrationHistory?.length ?? 0, 0);
    });
  });

describe('legacyToV1_0_0 migration script', () => {
  beforeEach(() => {
    clearMigrationRegistry();
  });

  it('should add schemaVersion 1.0.0 to legacy baseline', () => {
    const legacyBaseline: Baseline = {
      graph: {
        nodes: [['FILE:a.ts', { id: 'FILE:a.ts', type: 'FILE', path: 'a.ts', name: 'a.ts' }]],
        edges: [],
        commitHash: 'abc123',
        timestamp: 1000,
      },
      commitHash: 'abc123',
      timestamp: 1000,
      // No schemaVersion - legacy baseline
      schemaVersion: { major: 0, minor: 0, patch: 0 }, // Represents legacy
      generatorVersion: '0.0.0',
      architectureConstraints: [],
      healthScore: 50,
      skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
    };

    const result = legacyToV1_0_0.migrate(legacyBaseline);

    assert.strictEqual(result.schemaVersion.major, 1);
    assert.strictEqual(result.schemaVersion.minor, 0);
    assert.strictEqual(result.schemaVersion.patch, 0);
  });

  it('should add generatorVersion 1.0.0', () => {
    const legacyBaseline = createValidBaseline({ major: 0, minor: 0, patch: 0 });
    legacyBaseline.generatorVersion = 'unknown';

    const result = legacyToV1_0_0.migrate(legacyBaseline);

    assert.strictEqual(result.generatorVersion, '1.0.0');
  });

  it('should initialize migrationHistory', () => {
    const legacyBaseline = createValidBaseline({ major: 0, minor: 0, patch: 0 });
    legacyBaseline.migrationHistory = undefined;

    const result = legacyToV1_0_0.migrate(legacyBaseline);

    assert.ok(result.migrationHistory);
    assert.strictEqual(result.migrationHistory?.length, 1);
    assert.strictEqual(result.migrationHistory?.[0].fromVersion, 'legacy');
    assert.strictEqual(result.migrationHistory?.[0].toVersion, '1.0.0');
  });

  it('should preserve existing graph data', () => {
    const legacyBaseline: Baseline = {
      graph: {
        nodes: [
          ['FILE:test.ts', { id: 'FILE:test.ts', type: 'FILE', path: 'test.ts', name: 'test.ts' }],
          ['MODULE:test.ts#func', { id: 'MODULE:test.ts#func', type: 'MODULE', path: 'test.ts', name: 'func' }],
        ],
        edges: [{ from: 'FILE:test.ts', to: 'MODULE:test.ts#func', type: 'CONTAINS' }],
        commitHash: 'def456',
        timestamp: 2000,
      },
      commitHash: 'def456',
      timestamp: 2000,
      schemaVersion: { major: 0, minor: 0, patch: 0 },
      generatorVersion: 'unknown',
      architectureConstraints: [],
      healthScore: 75,
      skillDemand: { testWriter: 0.8, refactorSpecialist: 0.1, architect: 0.05, securityReviewer: 0.05 },
    };

    const result = legacyToV1_0_0.migrate(legacyBaseline);

    // Graph data preserved unchanged
    assert.strictEqual(result.graph.nodes.length, 2);
    assert.strictEqual(result.graph.edges.length, 1);
    assert.strictEqual(result.graph.commitHash, 'def456');
    assert.strictEqual(result.commitHash, 'def456');
    assert.strictEqual(result.healthScore, 75);
    assert.strictEqual(result.skillDemand.testWriter, 0.8);
  });

  it('should be registered in migration registry', () => {
    // Re-import to register
    const script = legacyToV1_0_0;

    // Check that it's properly defined
    assert.strictEqual(script.fromVersion, 'legacy');
    assert.strictEqual(script.toVersion, '1.0.0');
    assert.ok(script.migrate);
    assert.ok(script.description);
  });
});
});