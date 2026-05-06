/**
 * Fallback Suggestions Module (Phase 5 of cg-layer-inference-pipeline)
 *
 * WHY separate module: Suggestion generation has distinct responsibilities:
 * - Confidence threshold checking (< 50 triggers suggestions)
 * - Context analysis (cycles, ambiguity, signal strength)
 * - Agent-friendly prompt generation
 * These concerns differ from score calculation, following coding-taste Rule 1.
 *
 * ELASTIC EXCEPTION (coding-taste Rule 2): File ~161 lines.
 * Well within 150 threshold. Single cohesive unit for suggestion generation.
 *
 * Generates suggestions when confidence < 50 to help agents/users improve
 * layer inference quality.
 */

// ============================================================================
// Public Interfaces
// ============================================================================

/**
 * Suggestion type for low confidence scenarios
 *
 * WHY: Typed suggestions enable agents to take specific actions.
 * Each type maps to a distinct remediation category.
 */
export type SuggestionType = 'config' | 'manual-review' | 'structure';

/**
 * Agent-friendly suggestion format
 *
 * WHY: Structured format enables agents to parse and act on suggestions.
 * - type: Category for action classification
 * - prompt: Actionable instruction (starts with "Consider", "Review", etc.)
 * - context: Relevant project context for the suggestion
 */
export interface Suggestion {
  /** Suggestion category */
  type: SuggestionType;
  /** Agent-friendly action prompt */
  prompt: string;
  /** Relevant project context */
  context: string;
}

/**
 * Context for suggestion generation
 *
 * WHY: Structured context enables targeted suggestion generation.
 * Each field represents a quality signal from earlier phases.
 */
export interface SuggestionContext {
  /** Source root detection score (from Phase 1) */
  sourceRootScore: number;
  /** Number of detected dependency cycles */
  cycleCount: number;
  /** Count of ambiguous adjacent pairs */
  ambiguousPairCount: number;
  /** Total number of groups */
  groupCount: number;
  /** List of detected cycles (group names) */
  detectedCycles: string[][];
}

// ============================================================================
// Constants (Single Source of Truth)
// ============================================================================

/**
 * Suggestion thresholds and constants
 *
 * WHY: Constants defined here (single source of truth) prevent duplication.
 * Thresholds tuned through testing.
 */
export const SUGGESTION_CONSTANTS = {
  /** Confidence threshold for triggering suggestions */
  CONFIDENCE_THRESHOLD: 50,
  /** Source root score threshold for config suggestion */
  SOURCE_ROOT_THRESHOLD: 30,
  /** Group count threshold for structure suggestion */
  GROUP_COUNT_THRESHOLD: 6,
  /** Ambiguous pair threshold for structure suggestion */
  AMBIGUITY_THRESHOLD: 3,
};

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Generate suggestions for low confidence layer assignments
 *
 * WHY: Suggestions help agents/users improve layer inference quality.
 * Only generates suggestions when confidence < 50 (indicates problems).
 *
 * Suggestion triggers:
 * - config: sourceRootScore < 30 (weak source root signal)
 * - manual-review: cycleCount > 0 (cycles need human judgment)
 * - structure: ambiguousPairCount >= 3 OR groupCount >= 6
 *
 * @param confidence - Confidence score from Phase 4
 * @param context - Context from earlier phases
 * @returns Array of suggestions (empty when confidence >= 50)
 */
export function generateSuggestions(
  confidence: number,
  context: SuggestionContext
): Suggestion[] {
  // No suggestions needed when confidence meets threshold
  if (confidence >= SUGGESTION_CONSTANTS.CONFIDENCE_THRESHOLD) {
    return [];
  }

  const suggestions: Suggestion[] = [];

  // Check for config suggestion (low source root signal)
  if (context.sourceRootScore < SUGGESTION_CONSTANTS.SOURCE_ROOT_THRESHOLD) {
    suggestions.push({
      type: 'config',
      prompt: 'Consider specifying sourceRoot in .codegraph/config.json for better layer inference',
      context: `sourceRootScore: ${context.sourceRootScore} (below threshold ${SUGGESTION_CONSTANTS.SOURCE_ROOT_THRESHOLD})`,
    });
  }

  // Check for manual-review suggestion (cycles detected)
  if (context.cycleCount > 0 && context.detectedCycles.length > 0) {
    // Format cycle groups for context
    const cycleGroups = context.detectedCycles
      .map(cycle => `[${cycle.join(', ')}]`)
      .join(', ');

    suggestions.push({
      type: 'manual-review',
      prompt: `Review cycle between groups ${context.detectedCycles.length > 1 ? 's' : ''} ${cycleGroups} for intentional vs accidental architecture`,
      context: `Detected ${context.cycleCount} cycle(s): ${cycleGroups}`,
    });
  }

  // Check for structure suggestion (high ambiguity or many groups)
  const hasAmbiguity = context.ambiguousPairCount >= SUGGESTION_CONSTANTS.AMBIGUITY_THRESHOLD;
  const hasManyGroups = context.groupCount >= SUGGESTION_CONSTANTS.GROUP_COUNT_THRESHOLD;

  if (hasAmbiguity || hasManyGroups) {
    let prompt = 'Project structure may be unconventional. Consider reorganizing into typical src/lib/app pattern';
    let contextStr = '';

    if (hasAmbiguity) {
      contextStr = `${context.ambiguousPairCount} ambiguous layer boundaries (score diff < threshold)`;
    }
    if (hasManyGroups) {
      contextStr = contextStr
        ? `${contextStr}, ${context.groupCount} groups detected`
        : `${context.groupCount} groups detected`;
    }

    suggestions.push({
      type: 'structure',
      prompt,
      context: contextStr,
    });
  }

  return suggestions;
}