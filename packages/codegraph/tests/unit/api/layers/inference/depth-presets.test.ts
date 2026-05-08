import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEPTH_PRESETS,
  PRESET_ORDER,
  getThresholdForScale,
  type DepthPreset,
} from '../../../../../src/api/layers/inference/depth-presets.js';

describe('depth-presets', () => {
  describe('DEPTH_PRESETS', () => {
    it('should define 4 tiers', () => {
      assert.strictEqual(Object.keys(DEPTH_PRESETS).length, 4);
    });

    it('should have SMALL tier with maxFiles:50 and threshold:5', () => {
      assert.strictEqual(DEPTH_PRESETS.SMALL.maxFiles, 50);
      assert.strictEqual(DEPTH_PRESETS.SMALL.threshold, 5);
    });

    it('should have MEDIUM tier with maxFiles:200 and threshold:3', () => {
      assert.strictEqual(DEPTH_PRESETS.MEDIUM.maxFiles, 200);
      assert.strictEqual(DEPTH_PRESETS.MEDIUM.threshold, 3);
    });

    it('should have LARGE tier with maxFiles:500 and threshold:2', () => {
      assert.strictEqual(DEPTH_PRESETS.LARGE.maxFiles, 500);
      assert.strictEqual(DEPTH_PRESETS.LARGE.threshold, 2);
    });

    it('should have ENTERPRISE tier with maxFiles:Infinity and threshold:1', () => {
      assert.strictEqual(DEPTH_PRESETS.ENTERPRISE.maxFiles, Infinity);
      assert.strictEqual(DEPTH_PRESETS.ENTERPRISE.threshold, 1);
    });

    it('should have DepthPreset type structure', () => {
      const preset: DepthPreset = DEPTH_PRESETS.SMALL;
      assert.strictEqual(typeof preset.maxFiles, 'number');
      assert.strictEqual(typeof preset.threshold, 'number');
    });
  });

  describe('PRESET_ORDER', () => {
    it('should define iteration order as SMALL, MEDIUM, LARGE, ENTERPRISE', () => {
      assert.deepStrictEqual(PRESET_ORDER, ['SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']);
    });

    it('should have 4 tiers in order', () => {
      assert.strictEqual(PRESET_ORDER.length, 4);
    });
  });

  describe('getThresholdForScale', () => {
    it('should return 5 for small project (30 files)', () => {
      assert.strictEqual(getThresholdForScale(30), 5);
    });

    it('should return 5 for project at SMALL boundary (50 files)', () => {
      assert.strictEqual(getThresholdForScale(50), 5);
    });

    it('should return 3 for medium project (150 files)', () => {
      assert.strictEqual(getThresholdForScale(150), 3);
    });

    it('should return 3 for project at MEDIUM boundary (200 files)', () => {
      assert.strictEqual(getThresholdForScale(200), 3);
    });

    it('should return 2 for large project (400 files)', () => {
      assert.strictEqual(getThresholdForScale(400), 2);
    });

    it('should return 2 for project at LARGE boundary (500 files)', () => {
      assert.strictEqual(getThresholdForScale(500), 2);
    });

    it('should return 1 for enterprise project (800 files)', () => {
      assert.strictEqual(getThresholdForScale(800), 1);
    });

    it('should return 1 for extremely large project (10000 files)', () => {
      assert.strictEqual(getThresholdForScale(10000), 1);
    });

    it('should return 5 for empty project (0 files)', () => {
      assert.strictEqual(getThresholdForScale(0), 5);
    });

    it('should return 3 for project just above SMALL (51 files)', () => {
      assert.strictEqual(getThresholdForScale(51), 3);
    });

    it('should return 2 for project just above MEDIUM (201 files)', () => {
      assert.strictEqual(getThresholdForScale(201), 2);
    });

    it('should return 1 for project just above LARGE (501 files)', () => {
      assert.strictEqual(getThresholdForScale(501), 1);
    });
  });
});