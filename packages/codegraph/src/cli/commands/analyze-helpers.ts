/**
 * @fileoverview Helper functions for CLI analyze command
 *
 * WHY: Extracted from analyze.ts to keep file under 150 lines.
 * These helpers handle edge case detection and statistics calculation,
 * separate responsibilities from main command orchestration.
 *
 * @see analyze.ts for main command implementation
 */

import {
  handleEmptyProject,
  handleSingleFileProject,
  type SpecialCaseResult,
} from '../../analyzer/index.js';
import {
  type CliResultStats,
  type EdgeCaseResult,
  EdgeType,
} from '../../types.js';

// ============================================================================
// Edge Case Handling
// ============================================================================

/**
 * Handle edge cases detected before full analysis
 *
 * WHY: Edge cases are valid states, not errors. CLI should exit 0 with
 * user-friendly output. Returns null for 'normal' and 'test-only' cases
 * (test-only proceeds with analysis but logs warning).
 *
 * @param specialCase - Detection result from detectSpecialCases()
 * @param startTime - Start timestamp for duration calculation
 * @returns EdgeCaseResult for empty/single-file, null for normal/test-only
 */
export function handleEdgeCase(
  specialCase: SpecialCaseResult,
  startTime: number
): EdgeCaseResult | null {
  const durationMs = Date.now() - startTime;

  switch (specialCase.kind) {
    case 'empty': {
      const result = handleEmptyProject();
      return {
        success: true,
        kind: 'empty',
        message: result.message,
        suggestions: result.suggestions,
        durationMs,
      };
    }

    case 'single-file': {
      // WHY: Single file has no layer inference possible - architecture layers need multiple files
      const filePath = specialCase.sourceFiles[0];
      const result = handleSingleFileProject(filePath, [], []);
      return {
        success: true,
        kind: 'single-file',
        message: `Analyzing single file: ${filePath}. No architecture layers needed.`,
        file: result.filePath,
        externalDeps: result.externalDeps,
        durationMs,
      };
    }

    case 'test-only': {
      // WHY: Test-only is unusual but valid - proceed with analysis, add warning for visibility
      return {
        success: true,
        kind: 'test-only',
        message: 'Proceeding with analysis of test-only project.',
        warning: `Warning: Only test files found, treating as normal project. Found ${specialCase.testFiles.length} test files.`,
        testFiles: specialCase.testFiles,
        durationMs,
      };
    }

    case 'normal':
      // WHY: Normal project proceeds with standard analysis flow
      return null;

    default:
      // WHY: Exhaustive check - TypeScript ensures all cases handled, runtime safety for edge cases
      throw new Error(`Unknown project kind: ${specialCase.kind}`);
  }
}

// ============================================================================
// Statistics Calculation
// ============================================================================

/**
 * Calculate CLI result statistics from analysis stats and graph
 *
 * WHY: Separate stats calculation from main flow - this is a pure transformation
 * that can be tested independently and reused if needed.
 *
 * @param analysisStats - Statistics from analyzer (filesParsed, modules, edges)
 * @param graph - The CodeGraph instance with getEdges() method
 * @returns CliResultStats for result output
 */
export function calculateStats(
  analysisStats: {
    filesParsed: number;
    modules: number;
    edges: number;
  },
  graph: { getEdges: () => { type: EdgeType }[] }
): CliResultStats {
  const edges = graph.getEdges();

  // WHY: Edge type counts help users understand graph structure
  // IMPORTS: module dependencies
  // EXPORTS: file → module relationships
  // CONTAINS: directory → file relationships
  let imports = 0;
  let exports = 0;
  let contains = 0;

  for (const edge of edges) {
    switch (edge.type) {
      case EdgeType.IMPORTS:
        imports++;
        break;
      case EdgeType.EXPORTS:
        exports++;
        break;
      case EdgeType.CONTAINS:
        contains++;
        break;
      default:
        // WHY: Other edge types (CALLS, EXTENDS, etc.) not tracked in CliResultStats
        // They exist in graph but aren't part of summary stats
        break;
    }
  }

  return {
    filesScanned: analysisStats.filesParsed,
    modulesExtracted: analysisStats.modules,
    edgesCreated: {
      imports,
      exports,
      contains,
    },
  };
}