/**
 * Unit tests for compression error handling (Tasks 2.23-2.26)
 *
 * Tests error classes and error handling for compression operations.
 * Run with: pnpm test tests/unit/compression-errors.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CompressionError,
  IndexOutOfBoundsError,
  CorruptedBaselineError,
} from '../../src/persistence/compression/errors.js';
import { CliErrorCode } from '../../src/types.js';

// ============================================================================
// Task 2.23: E_INDEX_OUT_OF_BOUNDS error code (verify exists)
// ============================================================================
describe('E_INDEX_OUT_OF_BOUNDS error code (Task 2.23)', () => {
  it('should be defined in CliErrorCode enum', () => {
    assert.strictEqual(CliErrorCode.E_INDEX_OUT_OF_BOUNDS, 'E_INDEX_OUT_OF_BOUNDS');
  });
});

// ============================================================================
// Task 2.24: E_CORRUPTED_BASELINE error code (verify exists)
// ============================================================================
describe('E_CORRUPTED_BASELINE error code (Task 2.24)', () => {
  it('should be defined in CliErrorCode enum', () => {
    assert.strictEqual(CliErrorCode.E_CORRUPTED_BASELINE, 'E_CORRUPTED_BASELINE');
  });
});

// ============================================================================
// Task 2.25: CompressionError class
// ============================================================================
describe('CompressionError class (Task 2.25)', () => {
  it('should create error with CliErrorCode', () => {
    const error = new CompressionError(
      CliErrorCode.E_INDEX_OUT_OF_BOUNDS,
      'Index 100 exceeds bounds'
    );

    assert.strictEqual(error.name, 'CompressionError');
    assert.strictEqual(error.code, CliErrorCode.E_INDEX_OUT_OF_BOUNDS);
    assert.strictEqual(error.message, 'Index 100 exceeds bounds');
  });

  it('should be an instance of Error', () => {
    const error = new CompressionError(
      CliErrorCode.E_CORRUPTED_BASELINE,
      'Invalid JSON structure'
    );

    assert.ok(error instanceof Error);
    assert.ok(error instanceof CompressionError);
  });

  it('should preserve stack trace', () => {
    const error = new CompressionError(
      CliErrorCode.E_INDEX_OUT_OF_BOUNDS,
      'Test error'
    );

    assert.ok(error.stack);
    assert.ok(error.stack.includes('CompressionError'));
  });
});

// ============================================================================
// Task 2.25: IndexOutOfBoundsError specialized class
// ============================================================================
describe('IndexOutOfBoundsError class (Task 2.25)', () => {
  it('should create error with index details', () => {
    const error = new IndexOutOfBoundsError(100, 10);

    assert.strictEqual(error.code, CliErrorCode.E_INDEX_OUT_OF_BOUNDS);
    assert.strictEqual(error.index, 100);
    assert.strictEqual(error.maxIndex, 10);
    assert.ok(error.message.includes('100'));
    assert.ok(error.message.includes('10'));
  });

  it('should handle zero max index', () => {
    const error = new IndexOutOfBoundsError(0, 0);

    assert.strictEqual(error.index, 0);
    assert.strictEqual(error.maxIndex, 0);
  });

  it('should be instance of CompressionError', () => {
    const error = new IndexOutOfBoundsError(5, 3);

    assert.ok(error instanceof CompressionError);
    assert.ok(error instanceof Error);
  });
});

// ============================================================================
// Task 2.25: CorruptedBaselineError specialized class
// ============================================================================
describe('CorruptedBaselineError class (Task 2.25)', () => {
  it('should create error with reason', () => {
    const error = new CorruptedBaselineError('Missing required field: pathTable');

    assert.strictEqual(error.code, CliErrorCode.E_CORRUPTED_BASELINE);
    assert.ok(error.message.includes('Missing required field'));
    assert.ok(error.message.includes('pathTable'));
  });

  it('should accept optional details', () => {
    const error = new CorruptedBaselineError(
      'Invalid node structure',
      { field: 'type', value: null }
    );

    assert.strictEqual(error.code, CliErrorCode.E_CORRUPTED_BASELINE);
    assert.ok(error.details);
    assert.strictEqual(error.details?.field, 'type');
    assert.strictEqual(error.details?.value, null);
  });

  it('should be instance of CompressionError', () => {
    const error = new CorruptedBaselineError('Test corruption');

    assert.ok(error instanceof CompressionError);
    assert.ok(error instanceof Error);
  });
});

// ============================================================================
// Task 2.26: Error handling in validation scenarios
// ============================================================================
describe('Error handling scenarios (Task 2.26)', () => {
  it('should throw IndexOutOfBoundsError when path index invalid', () => {
    const pathTable = ['src/a.ts', 'src/b.ts'];

    assert.throws(
      () => {
        const index = 100;
        if (index >= pathTable.length) {
          throw new IndexOutOfBoundsError(index, pathTable.length - 1);
        }
      },
      (err: Error) => {
        assert.ok(err instanceof IndexOutOfBoundsError);
        assert.strictEqual(err.code, CliErrorCode.E_INDEX_OUT_OF_BOUNDS);
        return true;
      }
    );
  });

  it('should throw CorruptedBaselineError when baseline invalid', () => {
    const baseline = { pathTable: null }; // Invalid structure

    assert.throws(
      () => {
        if (!Array.isArray(baseline.pathTable)) {
          throw new CorruptedBaselineError('pathTable must be an array');
        }
      },
      (err: Error) => {
        assert.ok(err instanceof CorruptedBaselineError);
        assert.strictEqual(err.code, CliErrorCode.E_CORRUPTED_BASELINE);
        return true;
      }
    );
  });

  it('should handle edge case: empty pathTable', () => {
    const pathTable: string[] = [];
    const index = 0;

    // Accessing index 0 in empty array should throw
    assert.throws(
      () => {
        if (pathTable.length === 0) {
          throw new IndexOutOfBoundsError(index, -1, 'Path table is empty');
        }
      },
      IndexOutOfBoundsError
    );
  });
});