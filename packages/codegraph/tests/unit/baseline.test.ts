import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBaselineStructure,
  verifyDataIntegrity,
  handleFailure,
  loadBaseline,
} from '../../src/persistence/baseline.js';
import type {
  Baseline,
  LoadBaselineOptions,
  LoadBaselineResult,
  LoadFailureReason,
  ValidationResult,
  IntegrityResult,
} from '../../src/persistence/types.js';
import { join } from 'node:path';

// Helper to create valid mock baseline
function createValidBaseline(): Baseline {
  return {
    graph: {
      nodes: [
        ['FILE:a.ts', { id: 'FILE:a.ts', type: 'FILE', path: 'a.ts', name: 'a.ts' }],
        ['MODULE:a.ts#func', { id: 'MODULE:a.ts#func', type: 'MODULE', path: 'a.ts', name: 'func' }],
      ],
      edges: [{ from: 'FILE:a.ts', to: 'MODULE:a.ts#func', type: 'CONTAINS' }],
      commitHash: 'abc1234', // Valid 7-char hash
      timestamp: Date.now(),
    },
    commitHash: 'abc1234', // Valid 7-char hash
    timestamp: Date.now(),
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    generatorVersion: '1.0.0',
    architectureConstraints: [],
    healthScore: 50,
    skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
  };
}

describe('validateBaselineStructure', () => {
  describe('required fields', () => {
    it('should accept valid baseline structure', () => {
      const baseline = createValidBaseline();
      const result = validateBaselineStructure(baseline);
      assert.strictEqual(result.valid, true);
      assert.deepStrictEqual(result.errors, []);
    });

    it('should reject missing graph field', () => {
      const data = { commitHash: 'abc', timestamp: 100 };
      const result = validateBaselineStructure(data);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Missing required field: graph')));
    });

    it('should reject missing commitHash field', () => {
      const data = { graph: { nodes: [], edges: [] }, timestamp: 100 };
      const result = validateBaselineStructure(data);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Missing required field: commitHash')));
    });

    it('should reject missing timestamp field', () => {
      const data = { graph: { nodes: [], edges: [] }, commitHash: 'abc' };
      const result = validateBaselineStructure(data);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Missing required field: timestamp')));
    });

    it('should reject null input', () => {
      const result = validateBaselineStructure(null);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('must be an object')));
    });

    it('should reject non-object input', () => {
      const result = validateBaselineStructure('string');
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('must be an object')));
    });
  });

  describe('graph structure', () => {
    it('should reject graph.nodes not being an array', () => {
      const data = { graph: { nodes: 'invalid', edges: [] }, commitHash: 'abc', timestamp: 100 };
      const result = validateBaselineStructure(data);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('graph.nodes must be an array')));
    });

    it('should reject graph.edges not being an array', () => {
      const data = { graph: { nodes: [], edges: 'invalid' }, commitHash: 'abc', timestamp: 100 };
      const result = validateBaselineStructure(data);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('graph.edges must be an array')));
    });

    it('should accept empty nodes and edges arrays', () => {
      const data = { graph: { nodes: [], edges: [] }, commitHash: 'abc', timestamp: 100 };
      const result = validateBaselineStructure(data);
      assert.strictEqual(result.valid, true);
    });
  });

  describe('field types', () => {
    it('should reject non-number timestamp', () => {
      const baseline = createValidBaseline();
      baseline.timestamp = 'invalid' as any;
      const result = validateBaselineStructure(baseline);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('timestamp must be a number')));
    });

    it('should reject non-string commitHash', () => {
      const baseline = createValidBaseline();
      baseline.commitHash = 123 as any;
      const result = validateBaselineStructure(baseline);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('commitHash must be a string')));
    });
  });

  describe('optional schemaVersion', () => {
    it('should accept valid schemaVersion', () => {
      const baseline = createValidBaseline();
      baseline.schemaVersion = { major: 1, minor: 0, patch: 0 };
      const result = validateBaselineStructure(baseline);
      assert.strictEqual(result.valid, true);
    });

    it('should reject non-numeric schemaVersion.major', () => {
      const baseline = createValidBaseline();
      baseline.schemaVersion = { major: 'invalid' as any, minor: 0, patch: 0 };
      const result = validateBaselineStructure(baseline);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('schemaVersion.major must be number')));
    });

    it('should accept baseline without schemaVersion', () => {
      const baseline = createValidBaseline();
      baseline.schemaVersion = undefined;
      const result = validateBaselineStructure(baseline);
      assert.strictEqual(result.valid, true);
    });
  });
});

describe('verifyDataIntegrity', () => {
  describe('node ID uniqueness', () => {
    it('should detect duplicate node IDs', () => {
      const baseline = createValidBaseline();
      baseline.graph.nodes = [
        ['FILE:a.ts', { id: 'FILE:a.ts', type: 'FILE', path: 'a.ts', name: 'a.ts' }],
        ['FILE:a.ts', { id: 'FILE:a.ts', type: 'FILE', path: 'a.ts', name: 'a.ts' }],
      ];
      baseline.commitHash = 'abc1234'; // Valid 7-char hash
      baseline.graph.commitHash = 'abc1234';
      const result = verifyDataIntegrity(baseline);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Duplicate node ID')));
    });

    it('should accept unique node IDs', () => {
      const baseline: Baseline = {
        graph: {
          nodes: [
            ['FILE:a.ts', { id: 'FILE:a.ts', type: 'FILE', path: 'a.ts', name: 'a.ts' }],
            ['FILE:b.ts', { id: 'FILE:b.ts', type: 'FILE', path: 'b.ts', name: 'b.ts' }],
          ],
          edges: [],
          commitHash: 'abc1234', // Valid 7-char hash
          timestamp: 1000,
        },
        commitHash: 'abc1234', // Valid 7-char hash
        timestamp: 1000,
        schemaVersion: { major: 1, minor: 0, patch: 0 },
        generatorVersion: '1.0.0',
        architectureConstraints: [],
        healthScore: 50,
        skillDemand: { testWriter: 0.5, refactorSpecialist: 0.3, architect: 0.2, securityReviewer: 0.1 },
      };
      const result = verifyDataIntegrity(baseline);
      assert.strictEqual(result.valid, true);
      assert.deepStrictEqual(result.errors, []);
    });
  });

  describe('node.id matches stored ID', () => {
    it('should detect mismatched node.id', () => {
      const baseline = createValidBaseline();
      baseline.graph.nodes = [
        ['FILE:a.ts', { id: 'FILE:b.ts', type: 'FILE', path: 'b.ts', name: 'b.ts' }],
      ];
      const result = verifyDataIntegrity(baseline);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Node ID mismatch')));
    });
  });

  describe('edge references', () => {
    it('should detect edge referencing missing source node', () => {
      const baseline = createValidBaseline();
      baseline.graph.nodes = [
        ['FILE:a.ts', { id: 'FILE:a.ts', type: 'FILE', path: 'a.ts', name: 'a.ts' }],
      ];
      baseline.graph.edges = [
        { from: 'FILE:missing.ts', to: 'FILE:a.ts', type: 'IMPORTS' },
      ];
      const result = verifyDataIntegrity(baseline);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Edge references missing source node')));
    });

    it('should detect edge referencing missing target node', () => {
      const baseline = createValidBaseline();
      baseline.graph.nodes = [
        ['FILE:a.ts', { id: 'FILE:a.ts', type: 'FILE', path: 'a.ts', name: 'a.ts' }],
      ];
      baseline.graph.edges = [
        { from: 'FILE:a.ts', to: 'FILE:missing.ts', type: 'IMPORTS' },
      ];
      const result = verifyDataIntegrity(baseline);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Edge references missing target node')));
    });
  });

  describe('timestamp validation', () => {
    it('should detect future timestamp (beyond 60s tolerance)', () => {
      const baseline = createValidBaseline();
      baseline.commitHash = 'abc1234';
      baseline.graph.commitHash = 'abc1234';
      baseline.timestamp = Date.now() + 120000;
      const result = verifyDataIntegrity(baseline);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Timestamp is in the future')));
    });

    it('should accept past timestamp', () => {
      const baseline = createValidBaseline();
      baseline.commitHash = 'abc1234';
      baseline.graph.commitHash = 'abc1234';
      baseline.timestamp = 1000;
      const result = verifyDataIntegrity(baseline);
      assert.strictEqual(result.valid, true);
    });
  });

  describe('commitHash format', () => {
    it('should accept valid 40-char SHA-1 hash', () => {
      const baseline = createValidBaseline();
      baseline.commitHash = 'abc123def456789012345678901234567890abcd';
      const result = verifyDataIntegrity(baseline);
      assert.strictEqual(result.valid, true);
    });

    it('should accept valid 7-char short hash', () => {
      const baseline = createValidBaseline();
      baseline.commitHash = 'abc1234';
      const result = verifyDataIntegrity(baseline);
      assert.strictEqual(result.valid, true);
    });

    it('should reject invalid commit hash format', () => {
      const baseline = createValidBaseline();
      baseline.commitHash = 'invalid!';
      const result = verifyDataIntegrity(baseline);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Invalid commit hash format')));
    });

    it('should reject too short hash (< 7 chars)', () => {
      const baseline = createValidBaseline();
      baseline.commitHash = 'abc12';
      const result = verifyDataIntegrity(baseline);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Invalid commit hash format')));
    });
  });
});

describe('handleFailure', () => {
  const testCwd = '/test/project';

  describe('file_not_found', () => {
    it('should trigger rebuild when no baseline exists', async () => {
      const rebuildHandler = async () => ({ nodes: [], edges: [], commitHash: '', timestamp: 0 } as any);
      const result = await handleFailure('file_not_found', testCwd, { rebuildHandler });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.executedAction, 'rebuild');
      assert.strictEqual(result.migrated, false);
    });
  });

  describe('parse_error', () => {
    it('should return failure for JSON parse error', async () => {
      const result = await handleFailure('parse_error', testCwd, undefined, new Error('Invalid JSON'));

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.failure?.reason, 'parse_error');
    });
  });

  describe('invalid_structure', () => {
    it('should trigger rebuild in non-strict mode', async () => {
      const rebuildHandler = async () => ({ nodes: [], edges: [], commitHash: '', timestamp: 0 } as any);
      const result = await handleFailure('invalid_structure', testCwd, { strict: false, rebuildHandler });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.executedAction, 'rebuild');
    });

    it('should return failure in strict mode', async () => {
      const result = await handleFailure('invalid_structure', testCwd, { strict: true }, { errors: ['test'] });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.failure?.reason, 'invalid_structure');
    });
  });

  describe('corrupted_data', () => {
    it('should trigger rebuild for corrupted data', async () => {
      const rebuildHandler = async () => ({ nodes: [], edges: [], commitHash: '', timestamp: 0 } as any);
      const result = await handleFailure('corrupted_data', testCwd, { rebuildHandler }, { errors: ['duplicate ID'] });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.executedAction, 'rebuild');
    });
  });

  describe('permission_error', () => {
    it('should return failure for permission error', async () => {
      const result = await handleFailure('permission_error', testCwd, undefined, new Error('EACCES'));

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.failure?.reason, 'permission_error');
    });
  });

  describe('schema_incompatible', () => {
    it('should return failure when no force action configured', async () => {
      const compatResult = { compatible: false, reason: 'major_version_mismatch', action: 'error', message: 'test' };
      const result = await handleFailure('schema_incompatible', testCwd, undefined, compatResult);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.failure?.reason, 'schema_incompatible');
    });
  });
});

describe('loadBaseline', () => {
  // Integration tests require actual file system operations
  // These tests will be added in integration test file
  it('should exist as exportable function', () => {
    assert.ok(typeof loadBaseline === 'function');
  });
});