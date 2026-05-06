/**
 * Confidence Calculation Module (Phase 4 of cg-layer-inference-pipeline)
 *
 * WHY separate module: Confidence scoring has distinct responsibilities:
 * - Signal strength assessment (source root detection quality)
 * - Group consistency measurement (score variance)
 * - Penalty calculations (cycles, ambiguity)
 * These concerns differ from layer assignment logic, following coding-taste Rule 1.
 *
 * ELASTIC EXCEPTION (coding-taste Rule 2): File ~176 lines, exceeds 150 threshold.
 * NOT split because: Confidence calculation functions form a tightly cohesive unit -
 * calculateConfidence + calculateGroupVariance + countAmbiguousPairs are used together
 * for layer assignment quality assessment. Splitting would fragment this cohesive unit.
 *
 * Confidence formula:
 * - Base score: 30 (minimum foundation)
 * - Signal strength bonus: +40 if sourceRootScore >= 30
 * - Group consistency bonus: +30 if variance < 20
 * - Cycle penalty: -5 per cycle
 * - Ambiguity penalty: -2 per ambiguous pair
 * - Result: 0-100, clamped and rounded
 */

// ============================================================================
// Public Interfaces
// ============================================================================

/**
 * Inputs for confidence calculation
 *
 * WHY: Structured input enables consumers to provide all factors.
 * Each field represents a distinct quality signal for layer assignment.
 */
export interface ConfidenceInputs {
  /** Source root detection score (from Phase 1) */
  sourceRootScore: number;
  /** Variance of group netScores (consistency measure) */
  groupVariance: number;
  /** Number of detected dependency cycles */
  cycleCount: number;
  /** Count of ambiguous adjacent pairs (score diff < threshold) */
  ambiguousPairCount: number;
}

// ============================================================================
// Constants (Single Source of Truth)
// ============================================================================

/**
 * Confidence scoring constants
 *
 * WHY: Constants defined here (single source of truth) prevent duplication.
 * Thresholds and penalties are tuned through testing.
 */
export const CONFIDENCE_CONSTANTS = {
  /** Minimum base score (foundation) */
  BASE_SCORE: 30,
  /** Signal strength bonus threshold */
  SIGNAL_THRESHOLD: 30,
  /** Signal strength bonus value */
  SIGNAL_BONUS: 40,
  /** Group consistency bonus threshold */
  VARIANCE_THRESHOLD: 20,
  /** Group consistency bonus value */
  CONSISTENCY_BONUS: 30,
  /** Penalty per detected cycle */
  CYCLE_PENALTY: 5,
  /** Penalty per ambiguous adjacent pair */
  AMBIGUITY_PENALTY: 2,
  /** Maximum confidence */
  MAX_CONFIDENCE: 100,
  /** Minimum confidence */
  MIN_CONFIDENCE: 0,
};

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Calculate confidence score for layer assignment
 *
 * Confidence indicates reliability of layer assignment:
 * - High (80-100): Strong signals, consistent scores, no cycles
 * - Medium (50-79): Moderate signals or some penalties
 * - Low (0-49): Weak signals, high penalties, or ambiguous scores
 *
 * @param inputs - Confidence input factors
 * @returns Confidence score (0-100, rounded to integer)
 */
export function calculateConfidence(inputs: ConfidenceInputs): number {
  const {
    sourceRootScore,
    groupVariance,
    cycleCount,
    ambiguousPairCount,
  } = inputs;

  // Start with base score
  let confidence = CONFIDENCE_CONSTANTS.BASE_SCORE;

  // Add signal strength bonus (strong source root detection)
  if (sourceRootScore >= CONFIDENCE_CONSTANTS.SIGNAL_THRESHOLD) {
    confidence += CONFIDENCE_CONSTANTS.SIGNAL_BONUS;
  }

  // Add group consistency bonus (low variance = consistent scores)
  if (groupVariance < CONFIDENCE_CONSTANTS.VARIANCE_THRESHOLD) {
    confidence += CONFIDENCE_CONSTANTS.CONSISTENCY_BONUS;
  }

  // Apply cycle penalty (cycles indicate architectural issues)
  confidence -= cycleCount * CONFIDENCE_CONSTANTS.CYCLE_PENALTY;

  // Apply ambiguity penalty (ambiguous scores indicate unclear layers)
  confidence -= ambiguousPairCount * CONFIDENCE_CONSTANTS.AMBIGUITY_PENALTY;

  // Clamp to 0-100 range
  confidence = Math.max(CONFIDENCE_CONSTANTS.MIN_CONFIDENCE, confidence);
  confidence = Math.min(CONFIDENCE_CONSTANTS.MAX_CONFIDENCE, confidence);

  // Round to integer
  return Math.round(confidence);
}

/**
 * Calculate variance of group scores
 *
 * WHY: Variance measures consistency of layer assignment.
 * Low variance indicates groups cluster naturally into layers.
 * High variance indicates groups span wide score range.
 *
 * @param scores - Array of group netScores
 * @returns Variance value (sum of squared deviations from mean)
 */
export function calculateGroupVariance(scores: number[]): number {
  if (scores.length === 0) {
    return 0;
  }

  // Calculate mean
  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;

  // Calculate variance (sum of squared deviations)
  const variance = scores.reduce((sum, s) => {
    const deviation = s - mean;
    return sum + deviation * deviation;
  }, 0);

  return variance;
}

/**
 * Count ambiguous adjacent pairs in sorted scores
 *
 * WHY: Adjacent groups with small score difference are "ambiguous" -
 * they could reasonably belong to same or different layers.
 * High ambiguity indicates threshold sensitivity.
 *
 * @param sortedScores - Group scores sorted by netScore descending
 * @param threshold - Score difference threshold for layer separation
 * @returns Count of adjacent pairs with diff < threshold
 */
export function countAmbiguousPairs(
  sortedScores: number[],
  threshold: number
): number {
  if (sortedScores.length < 2) {
    return 0;
  }

  let ambiguousCount = 0;

  for (let i = 0; i < sortedScores.length - 1; i++) {
    const diff = Math.abs(sortedScores[i] - sortedScores[i + 1]);
    if (diff < threshold) {
      ambiguousCount++;
    }
  }

  return ambiguousCount;
}