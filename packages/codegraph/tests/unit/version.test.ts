import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SchemaVersionImpl, CURRENT_SCHEMA_VERSION, GENERATOR_VERSION, LEGACY_VERSION } from '../../src/version.js';

describe('SchemaVersionImpl', () => {
  describe('constructor', () => {
    it('should create valid version with non-negative integers', () => {
      const version = new SchemaVersionImpl(1, 0, 0);
      assert.strictEqual(version.major, 1);
      assert.strictEqual(version.minor, 0);
      assert.strictEqual(version.patch, 0);
    });

    it('should throw on negative major version', () => {
      assert.throws(
        () => new SchemaVersionImpl(-1, 0, 0),
        /Invalid major version/
      );
    });

    it('should throw on negative minor version', () => {
      assert.throws(
        () => new SchemaVersionImpl(1, -1, 0),
        /Invalid minor version/
      );
    });

    it('should throw on negative patch version', () => {
      assert.throws(
        () => new SchemaVersionImpl(1, 0, -1),
        /Invalid patch version/
      );
    });

    it('should throw on non-integer major', () => {
      assert.throws(
        () => new SchemaVersionImpl(1.5, 0, 0),
        /Invalid major version/
      );
    });

    it('should throw on non-integer minor', () => {
      assert.throws(
        () => new SchemaVersionImpl(1, 0.5, 0),
        /Invalid minor version/
      );
    });

    it('should accept version 0.0.0', () => {
      const version = new SchemaVersionImpl(0, 0, 0);
      assert.strictEqual(version.major, 0);
      assert.strictEqual(version.minor, 0);
      assert.strictEqual(version.patch, 0);
    });
  });

  describe('toString', () => {
    it('should return canonical format major.minor.patch', () => {
      const version = new SchemaVersionImpl(1, 2, 3);
      assert.strictEqual(version.toString(), '1.2.3');
    });

    it('should handle zeros correctly', () => {
      const version = new SchemaVersionImpl(1, 0, 0);
      assert.strictEqual(version.toString(), '1.0.0');
    });
  });

  describe('parse', () => {
    it('should parse valid version string', () => {
      const version = SchemaVersionImpl.parse('1.2.3');
      assert.strictEqual(version.major, 1);
      assert.strictEqual(version.minor, 2);
      assert.strictEqual(version.patch, 3);
    });

    it('should throw on missing parts (2 parts)', () => {
      assert.throws(
        () => SchemaVersionImpl.parse('1.2'),
        /Invalid version format/
      );
    });

    it('should throw on missing parts (1 part)', () => {
      assert.throws(
        () => SchemaVersionImpl.parse('1'),
        /Invalid version format/
      );
    });

    it('should throw on too many parts (4 parts)', () => {
      assert.throws(
        () => SchemaVersionImpl.parse('1.2.3.4'),
        /Invalid version format/
      );
    });

    it('should throw on non-numeric part', () => {
      assert.throws(
        () => SchemaVersionImpl.parse('1.a.0'),
        /Invalid version format/
      );
    });

    it('should throw on negative number in string', () => {
      assert.throws(
        () => SchemaVersionImpl.parse('-1.0.0'),
        /Invalid version format/
      );
    });

    it('should throw on empty string', () => {
      assert.throws(
        () => SchemaVersionImpl.parse(''),
        /Invalid version format/
      );
    });

    it('should throw on whitespace in version', () => {
      assert.throws(
        () => SchemaVersionImpl.parse('1. 0.0'),
        /Invalid version format/
      );
    });

    it('should handle leading zeros via parseInt', () => {
      const version = SchemaVersionImpl.parse('01.02.03');
      assert.strictEqual(version.major, 1);
      assert.strictEqual(version.minor, 2);
      assert.strictEqual(version.patch, 3);
    });
  });

  describe('isGreaterThan', () => {
    it('should return true when major is greater', () => {
      const v1 = new SchemaVersionImpl(1, 0, 0);
      const v2 = new SchemaVersionImpl(2, 0, 0);
      assert.strictEqual(v2.isGreaterThan(v1), true);
      assert.strictEqual(v1.isGreaterThan(v2), false);
    });

    it('should return true when minor is greater (same major)', () => {
      const v1 = new SchemaVersionImpl(1, 0, 0);
      const v2 = new SchemaVersionImpl(1, 1, 0);
      assert.strictEqual(v2.isGreaterThan(v1), true);
      assert.strictEqual(v1.isGreaterThan(v2), false);
    });

    it('should return true when patch is greater (same major, minor)', () => {
      const v1 = new SchemaVersionImpl(1, 0, 0);
      const v2 = new SchemaVersionImpl(1, 0, 1);
      assert.strictEqual(v2.isGreaterThan(v1), true);
      assert.strictEqual(v1.isGreaterThan(v2), false);
    });

    it('should return false for equal versions', () => {
      const v1 = new SchemaVersionImpl(1, 2, 3);
      const v2 = new SchemaVersionImpl(1, 2, 3);
      assert.strictEqual(v1.isGreaterThan(v2), false);
      assert.strictEqual(v2.isGreaterThan(v1), false);
    });

    it('should handle complex comparisons correctly', () => {
      const v1 = new SchemaVersionImpl(1, 5, 10);
      const v2 = new SchemaVersionImpl(2, 0, 0);
      const v3 = new SchemaVersionImpl(1, 6, 0);

      assert.strictEqual(v2.isGreaterThan(v1), true);
      assert.strictEqual(v3.isGreaterThan(v1), true);
      assert.strictEqual(v2.isGreaterThan(v3), true);
    });
  });

  describe('isCompatibleWith', () => {
    it('should return true for same major version', () => {
      const v1 = new SchemaVersionImpl(1, 0, 0);
      const v2 = new SchemaVersionImpl(1, 5, 10);
      assert.strictEqual(v1.isCompatibleWith(v2), true);
      assert.strictEqual(v2.isCompatibleWith(v1), true);
    });

    it('should return false for different major version', () => {
      const v1 = new SchemaVersionImpl(1, 0, 0);
      const v2 = new SchemaVersionImpl(2, 0, 0);
      assert.strictEqual(v1.isCompatibleWith(v2), false);
      assert.strictEqual(v2.isCompatibleWith(v1), false);
    });

    it('should return true for version 0.x compatibility', () => {
      const v1 = new SchemaVersionImpl(0, 1, 0);
      const v2 = new SchemaVersionImpl(0, 5, 0);
      assert.strictEqual(v1.isCompatibleWith(v2), true);
    });
  });

  describe('equals', () => {
    it('should return true for identical versions', () => {
      const v1 = new SchemaVersionImpl(1, 2, 3);
      const v2 = new SchemaVersionImpl(1, 2, 3);
      assert.strictEqual(v1.equals(v2), true);
    });

    it('should return false for different versions', () => {
      const v1 = new SchemaVersionImpl(1, 2, 3);
      const v2 = new SchemaVersionImpl(1, 2, 4);
      assert.strictEqual(v1.equals(v2), false);
    });
  });
});

describe('Constants', () => {
  it('should have CURRENT_SCHEMA_VERSION as 1.0.0', () => {
    assert.strictEqual(CURRENT_SCHEMA_VERSION.major, 1);
    assert.strictEqual(CURRENT_SCHEMA_VERSION.minor, 0);
    assert.strictEqual(CURRENT_SCHEMA_VERSION.patch, 0);
  });

  it('should have GENERATOR_VERSION as 1.0.0', () => {
    assert.strictEqual(GENERATOR_VERSION, '1.0.0');
  });

  it('should have LEGACY_VERSION as "legacy"', () => {
    assert.strictEqual(LEGACY_VERSION, 'legacy');
  });
});