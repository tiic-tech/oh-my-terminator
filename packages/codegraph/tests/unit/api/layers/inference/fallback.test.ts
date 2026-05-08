/**
 * Unit tests for fallback suggestions (Phase 5: Fallback & Suggestions)
 *
 * Tests the suggestion generation for low confidence layer assignments.
 * Run with: pnpm test tests/unit/api/layers/inference/fallback.test.ts
 *
 * TDD RED Phase: Tests written before implementation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import module to test (will fail initially - RED phase)
import {
  generateSuggestions,
  type SuggestionContext,
} from '../../../../../src/api/layers/inference/fallback.js';

// ============================================================================
// Task 4.2: generateSuggestions() function
// ============================================================================
describe('generateSuggestions() (Task 4.2)', () => {
  // ============================================================================
  // Confidence threshold: only generate when < 50
  // ============================================================================
  describe('Confidence threshold', () => {
    it('should return empty array when confidence >= 50', () => {
      const context: SuggestionContext = {
        sourceRootScore: 30,
        cycleCount: 0,
        ambiguousPairCount: 0,
        groupCount: 3,
        detectedCycles: [],
      };

      // Confidence >= 50: no suggestions needed
      const suggestions = generateSuggestions(50, context);
      assert.strictEqual(suggestions.length, 0, 'No suggestions when confidence >= 50');
    });

    it('should return empty array when confidence is exactly 50', () => {
      const context: SuggestionContext = {
        sourceRootScore: 30,
        cycleCount: 0,
        ambiguousPairCount: 0,
        groupCount: 3,
        detectedCycles: [],
      };

      const suggestions = generateSuggestions(50, context);
      assert.strictEqual(suggestions.length, 0, 'No suggestions at threshold 50');
    });

    it('should return suggestions when confidence < 50', () => {
      const context: SuggestionContext = {
        sourceRootScore: 10, // Low signal
        cycleCount: 0,
        ambiguousPairCount: 0,
        groupCount: 3,
        detectedCycles: [],
      };

      // Confidence 49: suggestions should be generated
      const suggestions = generateSuggestions(49, context);
      assert.ok(suggestions.length > 0, 'Suggestions generated when confidence < 50');
    });

    it('should return suggestions when confidence is very low (0)', () => {
      const context: SuggestionContext = {
        sourceRootScore: 0,
        cycleCount: 5,
        ambiguousPairCount: 10,
        groupCount: 3,
        detectedCycles: [['utils', 'services', 'components']],
      };

      const suggestions = generateSuggestions(0, context);
      assert.ok(suggestions.length > 0, 'Suggestions generated for confidence 0');
    });
  });

  // ============================================================================
  // Task 4.3: Suggestion types
  // ============================================================================
  describe('Suggestion types (Task 4.3)', () => {
    describe('"config" type', () => {
      it('should suggest config when sourceRootScore is low', () => {
        const context: SuggestionContext = {
          sourceRootScore: 10, // Low score (< 30 threshold)
          cycleCount: 0,
          ambiguousPairCount: 0,
          groupCount: 3,
          detectedCycles: [],
        };

        const suggestions = generateSuggestions(35, context);

        const configSuggestion = suggestions.find(s => s.type === 'config');
        assert.ok(configSuggestion, 'Config suggestion should be present for low sourceRootScore');
        assert.ok(
          configSuggestion!.prompt.includes('sourceRoot'),
          'Config prompt should mention sourceRoot'
        );
      });

      it('should NOT suggest config when sourceRootScore is high', () => {
        const context: SuggestionContext = {
          sourceRootScore: 50, // High score (>= 30 threshold)
          cycleCount: 0,
          ambiguousPairCount: 0,
          groupCount: 3,
          detectedCycles: [],
        };

        const suggestions = generateSuggestions(35, context);

        const configSuggestion = suggestions.find(s => s.type === 'config');
        assert.strictEqual(
          configSuggestion,
          undefined,
          'No config suggestion when sourceRootScore is high'
        );
      });
    });

    describe('"manual-review" type', () => {
      it('should suggest manual-review when cycles detected', () => {
        const context: SuggestionContext = {
          sourceRootScore: 50,
          cycleCount: 2,
          ambiguousPairCount: 0,
          groupCount: 3,
          detectedCycles: [['utils', 'services'], ['lib', 'core', 'app']],
        };

        const suggestions = generateSuggestions(35, context);

        const reviewSuggestion = suggestions.find(s => s.type === 'manual-review');
        assert.ok(reviewSuggestion, 'Manual-review suggestion should be present for cycles');
        assert.ok(
          reviewSuggestion!.prompt.includes('cycle') || reviewSuggestion!.prompt.includes('Review'),
          'Manual-review prompt should mention cycles or review'
        );
        assert.ok(
          reviewSuggestion!.context.includes('utils') ||
            reviewSuggestion!.context.includes('services') ||
            reviewSuggestion!.context.includes('lib'),
          'Context should include cycle group names'
        );
      });

      it('should NOT suggest manual-review when no cycles', () => {
        const context: SuggestionContext = {
          sourceRootScore: 50,
          cycleCount: 0,
          ambiguousPairCount: 5,
          groupCount: 3,
          detectedCycles: [],
        };

        const suggestions = generateSuggestions(35, context);

        const reviewSuggestion = suggestions.find(s => s.type === 'manual-review');
        assert.strictEqual(
          reviewSuggestion,
          undefined,
          'No manual-review suggestion when no cycles'
        );
      });
    });

    describe('"structure" type', () => {
      it('should suggest structure when ambiguous pairs detected', () => {
        const context: SuggestionContext = {
          sourceRootScore: 50,
          cycleCount: 0,
          ambiguousPairCount: 5, // High ambiguity
          groupCount: 6,
          detectedCycles: [],
        };

        const suggestions = generateSuggestions(35, context);

        const structureSuggestion = suggestions.find(s => s.type === 'structure');
        assert.ok(
          structureSuggestion,
          'Structure suggestion should be present for ambiguous pairs'
        );
        assert.ok(
          structureSuggestion!.prompt.includes('structure') ||
            structureSuggestion!.prompt.includes('reorganize'),
          'Structure prompt should mention structure or reorganize'
        );
      });

      it('should suggest structure when many groups but few layers', () => {
        const context: SuggestionContext = {
          sourceRootScore: 50,
          cycleCount: 0,
          ambiguousPairCount: 0,
          groupCount: 10, // Many groups
          detectedCycles: [],
        };

        const suggestions = generateSuggestions(35, context);

        const structureSuggestion = suggestions.find(s => s.type === 'structure');
        assert.ok(
          structureSuggestion,
          'Structure suggestion for many groups with low confidence'
        );
      });

      it('should NOT suggest structure when no ambiguity and few groups', () => {
        const context: SuggestionContext = {
          sourceRootScore: 50,
          cycleCount: 0,
          ambiguousPairCount: 0,
          groupCount: 3, // Few groups, no issues
          detectedCycles: [],
        };

        const suggestions = generateSuggestions(35, context);

        const structureSuggestion = suggestions.find(s => s.type === 'structure');
        assert.strictEqual(
          structureSuggestion,
          undefined,
          'No structure suggestion when structure is clear'
        );
      });
    });
  });

  // ============================================================================
  // Task 4.4: Agent-friendly prompt format
  // ============================================================================
  describe('Agent-friendly prompt format (Task 4.4)', () => {
    it('should return suggestions with type, prompt, and context fields', () => {
      const context: SuggestionContext = {
        sourceRootScore: 10,
        cycleCount: 2,
        ambiguousPairCount: 3,
        groupCount: 6,
        detectedCycles: [['A', 'B', 'C']],
      };

      const suggestions = generateSuggestions(35, context);

      // All suggestions should have required fields
      for (const suggestion of suggestions) {
        assert.ok(suggestion.type, 'Each suggestion should have a type');
        assert.ok(suggestion.prompt, 'Each suggestion should have a prompt');
        assert.ok(suggestion.context, 'Each suggestion should have context');
        assert.ok(
          ['config', 'manual-review', 'structure'].includes(suggestion.type),
          'Type should be one of allowed values'
        );
      }
    });

    it('should provide actionable prompts (not just descriptions)', () => {
      const context: SuggestionContext = {
        sourceRootScore: 10,
        cycleCount: 1,
        ambiguousPairCount: 0,
        groupCount: 3,
        detectedCycles: [['utils', 'services']],
      };

      const suggestions = generateSuggestions(35, context);

      // Prompts should be actionable (start with "Consider" or "Review")
      for (const suggestion of suggestions) {
        assert.ok(
          suggestion.prompt.startsWith('Consider') ||
            suggestion.prompt.startsWith('Review') ||
            suggestion.prompt.startsWith('Project'),
          `Prompt should be actionable: "${suggestion.prompt}"`
        );
      }
    });

    it('should provide relevant context for each suggestion', () => {
      const context: SuggestionContext = {
        sourceRootScore: 10,
        cycleCount: 1,
        ambiguousPairCount: 0,
        groupCount: 3,
        detectedCycles: [['utils', 'services']],
      };

      const suggestions = generateSuggestions(35, context);

      // Config suggestion should mention sourceRootScore
      const configSuggestion = suggestions.find(s => s.type === 'config');
      if (configSuggestion) {
        assert.ok(
          configSuggestion.context.includes('sourceRootScore') ||
            configSuggestion.context.includes('10'),
          'Config context should mention sourceRootScore'
        );
      }

      // Manual-review suggestion should mention cycles
      const reviewSuggestion = suggestions.find(s => s.type === 'manual-review');
      if (reviewSuggestion) {
        assert.ok(
          reviewSuggestion.context.includes('utils') ||
            reviewSuggestion.context.includes('services') ||
            reviewSuggestion.context.includes('cycle'),
          'Manual-review context should mention cycle details'
        );
      }
    });
  });

  // ============================================================================
  // Combined scenarios
  // ============================================================================
  describe('Combined scenarios', () => {
    it('should generate multiple suggestion types when multiple issues present', () => {
      const context: SuggestionContext = {
        sourceRootScore: 10, // Low signal
        cycleCount: 2, // Has cycles
        ambiguousPairCount: 5, // High ambiguity
        groupCount: 8,
        detectedCycles: [['A', 'B'], ['X', 'Y', 'Z']],
      };

      const suggestions = generateSuggestions(25, context);

      // Should have multiple types
      const types = suggestions.map(s => s.type);
      assert.ok(types.includes('config'), 'Should have config suggestion');
      assert.ok(types.includes('manual-review'), 'Should have manual-review suggestion');
      assert.ok(types.includes('structure'), 'Should have structure suggestion');
    });

    it('should not generate suggestions when all signals are healthy', () => {
      const context: SuggestionContext = {
        sourceRootScore: 50, // Good signal
        cycleCount: 0, // No cycles
        ambiguousPairCount: 0, // No ambiguity
        groupCount: 4, // Reasonable count
        detectedCycles: [],
      };

      // Even with low confidence (if passed directly), healthy signals = minimal suggestions
      const suggestions = generateSuggestions(35, context);

      // Should have no suggestions when all healthy
      assert.strictEqual(suggestions.length, 0, 'No suggestions for healthy context');
    });
  });

  // ============================================================================
  // Edge cases
  // ============================================================================
  describe('Edge cases', () => {
    it('should handle empty context gracefully', () => {
      const context: SuggestionContext = {
        sourceRootScore: 0,
        cycleCount: 0,
        ambiguousPairCount: 0,
        groupCount: 0,
        detectedCycles: [],
      };

      const suggestions = generateSuggestions(25, context);

      // Should still generate suggestions based on zero values
      assert.ok(suggestions.length > 0, 'Suggestions generated even with empty context');
    });

    it('should handle extreme cycle count', () => {
      const context: SuggestionContext = {
        sourceRootScore: 50,
        cycleCount: 20,
        ambiguousPairCount: 0,
        groupCount: 10,
        detectedCycles: Array(20).fill(['A', 'B']),
      };

      const suggestions = generateSuggestions(10, context);

      const reviewSuggestion = suggestions.find(s => s.type === 'manual-review');
      assert.ok(reviewSuggestion, 'Manual-review suggestion for extreme cycles');
      assert.ok(
        reviewSuggestion!.context.includes('20') || reviewSuggestion!.context.includes('cycle'),
        'Context should reflect cycle count'
      );
    });

    it('should handle very high ambiguity', () => {
      const context: SuggestionContext = {
        sourceRootScore: 50,
        cycleCount: 0,
        ambiguousPairCount: 50,
        groupCount: 20,
        detectedCycles: [],
      };

      const suggestions = generateSuggestions(10, context);

      const structureSuggestion = suggestions.find(s => s.type === 'structure');
      assert.ok(structureSuggestion, 'Structure suggestion for high ambiguity');
    });
  });
});