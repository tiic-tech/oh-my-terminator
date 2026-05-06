/**
 * Unit tests for confidence calculation (Phase 4: Layer Assignment with Confidence)
 *
 * Tests the confidence scoring algorithm for layer assignment reliability.
 * Run with: pnpm test tests/unit/layers-confidence.test.ts
 *
 * TDD RED Phase: Tests written before implementation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import module to test (will fail initially - RED phase)
import {
  calculateConfidence,
  type ConfidenceInputs,
} from '../../src/api/layers/inference/confidence.js';

// ============================================================================
// Task 3.2: calculateConfidence() function
// ============================================================================
describe('calculateConfidence() (Task 3.2)', () => {
  // ============================================================================
  // Base score calculation
  // ============================================================================
  describe('Base score', () => {
    it('should return minimum base score of 30 with no bonuses', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 0, // < 30, no bonus
        groupVariance: 100, // >= 20, no bonus
        cycleCount: 0,
        ambiguousPairCount: 0,
      };

      const confidence = calculateConfidence(inputs);

      // Base 30, no bonuses, no penalties
      assert.strictEqual(confidence, 30, 'Minimum base score should be 30');
    });

    it('should clamp to 0 when penalties exceed base', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 0,
        groupVariance: 100,
        cycleCount: 10, // -50 penalty
        ambiguousPairCount: 0,
      };

      const confidence = calculateConfidence(inputs);

      // 30 - 50 = -20, clamped to 0
      assert.strictEqual(confidence, 0, 'Should clamp to 0 minimum');
    });
  });

  // ============================================================================
  // Signal strength bonus
  // ============================================================================
  describe('Signal strength bonus', () => {
    it('should add +40 when sourceRootScore >= 30', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 30, // Exactly threshold
        groupVariance: 100,
        cycleCount: 0,
        ambiguousPairCount: 0,
      };

      const confidence = calculateConfidence(inputs);

      // Base 30 + signal bonus 40 = 70
      assert.strictEqual(confidence, 70, 'Signal strength >= 30 should add +40');
    });

    it('should add +40 when sourceRootScore > 30', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 50,
        groupVariance: 100,
        cycleCount: 0,
        ambiguousPairCount: 0,
      };

      const confidence = calculateConfidence(inputs);

      // Base 30 + signal bonus 40 = 70
      assert.strictEqual(confidence, 70, 'High sourceRootScore should add +40');
    });

    it('should NOT add bonus when sourceRootScore < 30', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 29, // Below threshold
        groupVariance: 100,
        cycleCount: 0,
        ambiguousPairCount: 0,
      };

      const confidence = calculateConfidence(inputs);

      // Base 30, no signal bonus
      assert.strictEqual(confidence, 30, 'sourceRootScore < 30 should not add bonus');
    });
  });

  // ============================================================================
  // Group consistency bonus
  // ============================================================================
  describe('Group consistency bonus', () => {
    it('should add +30 when variance < 20', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 0,
        groupVariance: 19, // Below threshold
        cycleCount: 0,
        ambiguousPairCount: 0,
      };

      const confidence = calculateConfidence(inputs);

      // Base 30 + consistency bonus 30 = 60
      assert.strictEqual(confidence, 60, 'Low variance should add +30');
    });

    it('should add +30 when variance is 0 (perfect consistency)', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 0,
        groupVariance: 0,
        cycleCount: 0,
        ambiguousPairCount: 0,
      };

      const confidence = calculateConfidence(inputs);

      // Base 30 + consistency bonus 30 = 60
      assert.strictEqual(confidence, 60, 'Zero variance should add +30');
    });

    it('should NOT add bonus when variance >= 20', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 0,
        groupVariance: 20, // At threshold
        cycleCount: 0,
        ambiguousPairCount: 0,
      };

      const confidence = calculateConfidence(inputs);

      // Base 30, no consistency bonus
      assert.strictEqual(confidence, 30, 'variance >= 20 should not add bonus');
    });

    it('should NOT add bonus when variance > 20', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 0,
        groupVariance: 50,
        cycleCount: 0,
        ambiguousPairCount: 0,
      };

      const confidence = calculateConfidence(inputs);

      // Base 30, no consistency bonus
      assert.strictEqual(confidence, 30, 'High variance should not add bonus');
    });
  });

  // ============================================================================
  // Combined bonuses
  // ============================================================================
  describe('Combined bonuses', () => {
    it('should achieve max 100 with all bonuses and no penalties', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 50, // >= 30, +40
        groupVariance: 10, // < 20, +30
        cycleCount: 0,
        ambiguousPairCount: 0,
      };

      const confidence = calculateConfidence(inputs);

      // Base 30 + signal 40 + consistency 30 = 100
      assert.strictEqual(confidence, 100, 'All bonuses should yield 100');
    });

    it('should cap at 100 even with bonuses exceeding threshold', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 100, // Far above threshold
        groupVariance: 0, // Perfect consistency
        cycleCount: 0,
        ambiguousPairCount: 0,
      };

      const confidence = calculateConfidence(inputs);

      // Should cap at 100
      assert.strictEqual(confidence, 100, 'Confidence should cap at 100');
    });
  });

  // ============================================================================
  // Cycle penalty
  // ============================================================================
  describe('Cycle penalty', () => {
    it('should apply -5 penalty per cycle', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 50, // +40 bonus
        groupVariance: 10, // +30 bonus
        cycleCount: 1,
        ambiguousPairCount: 0,
      };

      const confidence = calculateConfidence(inputs);

      // 30 + 40 + 30 - 5 = 95
      assert.strictEqual(confidence, 95, '1 cycle should reduce by 5');
    });

    it('should apply -5 penalty for each cycle', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 50,
        groupVariance: 10,
        cycleCount: 3, // -15 penalty
        ambiguousPairCount: 0,
      };

      const confidence = calculateConfidence(inputs);

      // 30 + 40 + 30 - 15 = 85
      assert.strictEqual(confidence, 85, '3 cycles should reduce by 15');
    });

    it('should penalize cycles even with no bonuses', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 0,
        groupVariance: 100,
        cycleCount: 5, // -25 penalty
        ambiguousPairCount: 0,
      };

      const confidence = calculateConfidence(inputs);

      // 30 - 25 = 5
      assert.strictEqual(confidence, 5, 'Cycles should penalize from base');
    });
  });

  // ============================================================================
  // Ambiguity penalty
  // ============================================================================
  describe('Ambiguity penalty', () => {
    it('should apply -2 penalty per ambiguous pair', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 50,
        groupVariance: 10,
        cycleCount: 0,
        ambiguousPairCount: 1, // -2
      };

      const confidence = calculateConfidence(inputs);

      // 30 + 40 + 30 - 2 = 98
      assert.strictEqual(confidence, 98, '1 ambiguous pair should reduce by 2');
    });

    it('should apply -2 for each ambiguous pair', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 50,
        groupVariance: 10,
        cycleCount: 0,
        ambiguousPairCount: 5, // -10
      };

      const confidence = calculateConfidence(inputs);

      // 30 + 40 + 30 - 10 = 90
      assert.strictEqual(confidence, 90, '5 ambiguous pairs should reduce by 10');
    });

    it('should combine cycle and ambiguity penalties', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 50,
        groupVariance: 10,
        cycleCount: 2, // -10
        ambiguousPairCount: 3, // -6
      };

      const confidence = calculateConfidence(inputs);

      // 30 + 40 + 30 - 10 - 6 = 84
      assert.strictEqual(confidence, 84, 'Combined penalties should apply');
    });
  });

  // ============================================================================
  // Clamping behavior
  // ============================================================================
  describe('Clamping to 0-100', () => {
    it('should clamp negative scores to 0', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 0,
        groupVariance: 100,
        cycleCount: 20, // -100 penalty
        ambiguousPairCount: 0,
      };

      const confidence = calculateConfidence(inputs);

      // 30 - 100 = -70, clamped to 0
      assert.strictEqual(confidence, 0, 'Negative should clamp to 0');
    });

    it('should not exceed 100 even with extreme bonuses', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 1000,
        groupVariance: 0,
        cycleCount: 0,
        ambiguousPairCount: 0,
      };

      const confidence = calculateConfidence(inputs);

      assert.strictEqual(confidence, 100, 'Should cap at 100');
    });

    it('should handle zero penalties correctly', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 35, // +40
        groupVariance: 15, // +30
        cycleCount: 0,
        ambiguousPairCount: 0,
      };

      const confidence = calculateConfidence(inputs);

      // 30 + 40 + 30 = 100
      assert.strictEqual(confidence, 100);
    });
  });

  // ============================================================================
  // Edge cases
  // ============================================================================
  describe('Edge cases', () => {
    it('should handle all zeros', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 0,
        groupVariance: 100, // No bonus threshold
        cycleCount: 0,
        ambiguousPairCount: 0,
      };

      const confidence = calculateConfidence(inputs);

      assert.strictEqual(confidence, 30, 'All zeros (variance>=20) should give base');
    });

    it('should return integer confidence (rounded)', () => {
      const inputs: ConfidenceInputs = {
        sourceRootScore: 50,
        groupVariance: 10,
        cycleCount: 1,
        ambiguousPairCount: 1,
      };

      const confidence = calculateConfidence(inputs);

      // 30 + 40 + 30 - 5 - 2 = 93 (integer)
      assert.strictEqual(confidence, 93);
      assert.strictEqual(typeof confidence, 'number');
    });

    it('should handle maximum realistic penalties', () => {
      // Worst case: no bonuses, heavy penalties
      const inputs: ConfidenceInputs = {
        sourceRootScore: 0,
        groupVariance: 100,
        cycleCount: 10, // -50
        ambiguousPairCount: 25, // -50
      };

      const confidence = calculateConfidence(inputs);

      // 30 - 50 - 50 = -70, clamped to 0
      assert.strictEqual(confidence, 0, 'Heavy penalties should clamp to 0');
    });
  });
});