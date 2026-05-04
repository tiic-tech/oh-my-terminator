import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkSchemaCompatibility,
  determineAction,
  executeAction,
} from '../../src/persistence/compatibility/index.js';
import { SchemaVersionImpl, CURRENT_SCHEMA_VERSION, LEGACY_VERSION } from '../../src/version.js';
import type { Baseline, CompatibilityResult, ActionConfig } from '../../src/persistence/types/index.js';
import { IncompatibleBaselineError } from '../../src/persistence/types/index.js';

// Helper to create mock baseline
function createMockBaseline(options: {
  schemaVersion?: { major: number; minor: number; patch: number } | undefined;
  graph?: any;
}): Baseline {
  return {
    graph: options.graph || {
      nodes: [],
      edges: [],
      commitHash: 'abc123',
      timestamp: Date.now(),
    },
    commitHash: 'abc123',
    timestamp: Date.now(),
    schemaVersion: options.schemaVersion,
    generatorVersion: '1.0.0',
    architectureConstraints: [],
    healthScore: 50,
    skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
  };
}

describe('checkSchemaCompatibility', () => {
  const currentVersion = CURRENT_SCHEMA_VERSION;

  describe('legacy baseline', () => {
    it('should return incompatible for baseline without schemaVersion', () => {
      const baseline = createMockBaseline({ schemaVersion: undefined });
      const result = checkSchemaCompatibility(baseline, currentVersion);

      assert.strictEqual(result.compatible, false);
      assert.strictEqual(result.reason, 'legacy_baseline');
      assert.strictEqual(result.action, 'rebuild');
      assert.match(result.message, /Legacy baseline/);
    });
  });

  describe('major version mismatch', () => {
    it('should return error when baseline major is higher (future version)', () => {
      const baseline = createMockBaseline({ schemaVersion: { major: 2, minor: 0, patch: 0 } });
      const result = checkSchemaCompatibility(baseline, currentVersion);

      assert.strictEqual(result.compatible, false);
      assert.strictEqual(result.reason, 'major_version_mismatch');
      assert.strictEqual(result.action, 'error');
      assert.ok(result.details?.baselineVersion);
      assert.ok(result.details?.currentVersion);
    });

    it('should return migrate when baseline major is lower (can upgrade)', () => {
      const baseline = createMockBaseline({ schemaVersion: { major: 0, minor: 9, patch: 0 } });
      const result = checkSchemaCompatibility(baseline, currentVersion);

      assert.strictEqual(result.compatible, false);
      assert.strictEqual(result.reason, 'major_version_mismatch');
      assert.strictEqual(result.action, 'migrate');
    });
  });

  describe('minor version outdated', () => {
    it('should return compatible with migrate action for outdated minor', () => {
      const baseline = createMockBaseline({ schemaVersion: { major: 1, minor: 0, patch: 0 } });
      const newerCurrent = new SchemaVersionImpl(1, 1, 0);
      const result = checkSchemaCompatibility(baseline, newerCurrent);

      assert.strictEqual(result.compatible, true);
      assert.strictEqual(result.reason, 'minor_version_old');
      assert.strictEqual(result.action, 'migrate');
    });

    it('should be compatible when baseline minor is higher', () => {
      const baseline = createMockBaseline({ schemaVersion: { major: 1, minor: 2, patch: 0 } });
      const olderCurrent = new SchemaVersionImpl(1, 1, 0);
      const result = checkSchemaCompatibility(baseline, olderCurrent);

      assert.strictEqual(result.compatible, true);
      assert.strictEqual(result.reason, 'version_match');
      assert.strictEqual(result.action, 'proceed');
    });
  });

  describe('patch version outdated', () => {
    it('should return compatible with proceed action for outdated patch', () => {
      const baseline = createMockBaseline({ schemaVersion: { major: 1, minor: 0, patch: 0 } });
      const newerCurrent = new SchemaVersionImpl(1, 0, 1);
      const result = checkSchemaCompatibility(baseline, newerCurrent);

      assert.strictEqual(result.compatible, true);
      assert.strictEqual(result.reason, 'patch_version_old');
      assert.strictEqual(result.action, 'proceed');
    });
  });

  describe('version match', () => {
    it('should return compatible for exact version match', () => {
      const baseline = createMockBaseline({ schemaVersion: { major: 1, minor: 0, patch: 0 } });
      const result = checkSchemaCompatibility(baseline, currentVersion);

      assert.strictEqual(result.compatible, true);
      assert.strictEqual(result.reason, 'version_match');
      assert.strictEqual(result.action, 'proceed');
    });
  });
});

describe('determineAction', () => {
  describe('default strategy matrix', () => {
    it('should return rebuild for legacy_baseline', () => {
      const result: CompatibilityResult = {
        compatible: false,
        reason: 'legacy_baseline',
        action: 'rebuild',
        message: 'test',
      };
      assert.strictEqual(determineAction(result), 'rebuild');
    });

    it('should return error for major mismatch with baseline higher', () => {
      const result: CompatibilityResult = {
        compatible: false,
        reason: 'major_version_mismatch',
        action: 'error',
        message: 'test',
        details: { baselineVersion: '2.0.0', currentVersion: '1.0.0' },
      };
      assert.strictEqual(determineAction(result), 'error');
    });

    it('should return migrate for major mismatch with baseline lower', () => {
      const result: CompatibilityResult = {
        compatible: false,
        reason: 'major_version_mismatch',
        action: 'migrate',
        message: 'test',
        details: { baselineVersion: '0.9.0', currentVersion: '1.0.0' },
      };
      assert.strictEqual(determineAction(result), 'migrate');
    });

    it('should return migrate for minor_version_old with autoMigrate true', () => {
      const result: CompatibilityResult = {
        compatible: true,
        reason: 'minor_version_old',
        action: 'migrate',
        message: 'test',
      };
      const config: ActionConfig = { autoMigrate: true };
      assert.strictEqual(determineAction(result, config), 'migrate');
    });

    it('should return proceed for minor_version_old with autoMigrate false', () => {
      const result: CompatibilityResult = {
        compatible: true,
        reason: 'minor_version_old',
        action: 'migrate',
        message: 'test',
      };
      const config: ActionConfig = { autoMigrate: false };
      assert.strictEqual(determineAction(result, config), 'proceed');
    });

    it('should return proceed for minor_version_old without config', () => {
      const result: CompatibilityResult = {
        compatible: true,
        reason: 'minor_version_old',
        action: 'migrate',
        message: 'test',
      };
      // Default without config should be proceed
      assert.strictEqual(determineAction(result), 'proceed');
    });

    it('should return proceed for patch_version_old', () => {
      const result: CompatibilityResult = {
        compatible: true,
        reason: 'patch_version_old',
        action: 'proceed',
        message: 'test',
      };
      assert.strictEqual(determineAction(result), 'proceed');
    });

    it('should return proceed for version_match', () => {
      const result: CompatibilityResult = {
        compatible: true,
        reason: 'version_match',
        action: 'proceed',
        message: 'test',
      };
      assert.strictEqual(determineAction(result), 'proceed');
    });
  });

  describe('forceAction override', () => {
    it('should return forceAction when configured', () => {
      const result: CompatibilityResult = {
        compatible: false,
        reason: 'legacy_baseline',
        action: 'rebuild',
        message: 'test',
      };
      const config: ActionConfig = { forceAction: 'migrate' };
      assert.strictEqual(determineAction(result, config), 'migrate');
    });

    it('should allow forcing rebuild even when compatible', () => {
      const result: CompatibilityResult = {
        compatible: true,
        reason: 'version_match',
        action: 'proceed',
        message: 'test',
      };
      const config: ActionConfig = { forceAction: 'rebuild' };
      assert.strictEqual(determineAction(result, config), 'rebuild');
    });
  });
});

describe('executeAction', () => {
  describe('error action', () => {
    it('should throw IncompatibleBaselineError', async () => {
      await assert.rejects(
        async () => executeAction('error', null, '/test'),
        IncompatibleBaselineError
      );
    });
  });

  describe('proceed action', () => {
    it('should return baseline graph when proceeding', async () => {
      const mockGraph = { nodes: [['FILE:a.ts', { id: 'FILE:a.ts', type: 'FILE', path: 'a.ts', name: 'a.ts' }]], edges: [], commitHash: 'abc', timestamp: 100 };
      const baseline = createMockBaseline({ graph: mockGraph });

      const result = await executeAction('proceed', baseline, '/test');
      assert.strictEqual(result.action, 'proceed');
      assert.strictEqual(result.migrated, false);
      // Graph should be from baseline
      assert.ok(result.graph);
    });

    it('should throw when proceed called without baseline', async () => {
      await assert.rejects(
        async () => executeAction('proceed', null, '/test'),
        /Cannot proceed: no baseline loaded/
      );
    });
  });

  describe('rebuild action', () => {
    it('should call rebuildHandler when provided', async () => {
      const mockGraph = { nodes: [], edges: [], commitHash: '', timestamp: 0 };
      const rebuildHandler = async (cwd: string) => mockGraph as any;

      const result = await executeAction('rebuild', null, '/test', { rebuildHandler, allowRebuild: true });
      assert.strictEqual(result.action, 'rebuild');
      assert.strictEqual(result.migrated, false);
    });
  });

  describe('migrate action', () => {
    it('should throw when migrate called without baseline', async () => {
      await assert.rejects(
        async () => executeAction('migrate', null, '/test'),
        /Cannot migrate: no baseline loaded/
      );
    });
  });
});

describe('IncompatibleBaselineError', () => {
  it('should have correct name', () => {
    const error = new IncompatibleBaselineError('test message');
    assert.strictEqual(error.name, 'IncompatibleBaselineError');
  });

  it('should preserve message', () => {
    const error = new IncompatibleBaselineError('Schema incompatible');
    assert.strictEqual(error.message, 'Schema incompatible');
  });

  it('should be instanceof Error', () => {
    const error = new IncompatibleBaselineError('test');
    assert.ok(error instanceof Error);
  });
});