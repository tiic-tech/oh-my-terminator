/**
 * @fileoverview CLI analyze command implementation
 *
 * WHY: Provides full repository analysis with baseline persistence.
 * Creates .codegraph/baseline.json and .codegraph/lastCommit.txt for
 * subsequent incremental updates.
 *
 * Flow:
 * 1. Validate project (path existence + git repo + commits)
 * 2. Detect edge cases (empty/single-file/test-only/normal)
 * 3. Handle edge cases with appropriate output
 * 4. Run full analysis (scan + parse) for normal projects
 * 5. Save baseline.json
 * 6. Save lastCommit.txt
 * 7. Return structured result
 *
 * @see 09_c9_cli_analyze_update_spec.md Section 5.1-5.9
 */

import { writeFile } from 'node:fs/promises';
import { analyzeFull } from '../../analyzer.js';
import {
  detectSpecialCases,
  handleEmptyProject,
  handleSingleFileProject,
  type SpecialCaseResult,
} from '../../analyzer/index.js';
import {
  saveBaseline,
  ensureCodegraphDir,
  getLastCommitPath,
} from '../../persistence/index.js';
import {
  CURRENT_SCHEMA_VERSION,
  GENERATOR_VERSION,
} from '../../version.js';
import { getHeadCommit } from '../../git/index.js';
import { validateProject } from '../validation.js';
import {
  type AnalyzeResult,
  type CliError,
  type CliResultStats,
  type CompressionStats,
  type EdgeCaseResult,
  EdgeType,
} from '../../types.js';
import type { Baseline } from '../../persistence/types/baseline.js';

// ============================================================================
// Command Options
// ============================================================================

/**
 * Options for analyze command
 */
export interface AnalyzeOptions {
  /** Output as JSON (for programmatic consumption) */
  json?: boolean;
  /** Enable compression (default: true, use --compress to explicitly enable) */
  compress?: boolean;
}

// ============================================================================
// Main Command Implementation
// ============================================================================

/**
 * Execute analyze command
 *
 * Performs full repository analysis and creates baseline for future updates.
 * Handles edge cases (empty/single-file/test-only) gracefully with exit code 0.
 *
 * @param cwd - Project root directory
 * @param options - Command options (compress defaults to true)
 * @returns AnalyzeResult on success, CliError on failure, EdgeCaseResult for edge cases
 */
export async function analyzeCommand(
  cwd: string,
  options?: AnalyzeOptions
): Promise<AnalyzeResult | CliError | EdgeCaseResult> {
  const startTime = Date.now();

  // Compression is enabled by default (6.1-6.3)
  // --no-compression sets compress=false, --compress explicitly sets compress=true
  const compress = options?.compress ?? true;

  // ========================================
  // Step 1: Validate Project (Path + Git)
  // ========================================
  const validation = await validateProject(cwd);

  if (!validation.path.isValid) {
    return {
      success: false,
      error: validation.path.error!,
      durationMs: Date.now() - startTime,
    };
  }

  if (!validation.git?.isValid) {
    return {
      success: false,
      error: validation.git!.error!,
      durationMs: Date.now() - startTime,
    };
  }

  // Use validated absolute path
  const projectRoot = validation.path.absolutePath;

  // ========================================
  // Step 2: Detect Edge Cases
  // ========================================
  const specialCase = detectSpecialCases(projectRoot);
  const edgeCaseResult = handleEdgeCase(specialCase, startTime);

  // Return early for empty/single-file cases (skip full analysis)
  // For test-only: log warning but proceed with normal analysis
  if (edgeCaseResult && edgeCaseResult.kind !== 'test-only') {
    return edgeCaseResult;
  }

  // ========================================
  // Step 3: Run Full Analysis (normal or test-only)
  // ========================================
  const analysis = await analyzeFull(projectRoot);

  // ========================================
  // Step 4: Calculate Statistics
  // ========================================
  const stats = calculateStats(analysis.stats, analysis.graph);

  // ========================================
  // Step 5: Prepare Baseline
  // ========================================
  const headCommit = await getHeadCommit(projectRoot);
  const timestamp = Date.now();

  const baseline: Baseline = {
    graph: analysis.graph.toJSON(),
    commitHash: headCommit,
    timestamp,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    generatorVersion: GENERATOR_VERSION,
    architectureConstraints: [],
    healthScore: 100, // Initial baseline has perfect health
    skillDemand: {
      testWriter: 0,
      refactorSpecialist: 0,
      architect: 0,
      securityReviewer: 0,
    },
  };

  // ========================================
  // Step 6: Save Baseline (with compression)
  // ========================================
  await ensureCodegraphDir(projectRoot);

  // Calculate original size estimate (uncompressed JSON)
  const originalSizeBytes = Buffer.byteLength(JSON.stringify(baseline), 'utf-8');

  await saveBaseline(baseline, projectRoot, { compress });

  // ========================================
  // Step 7: Calculate Compression Stats
  // ========================================
  let compressionStats: CompressionStats | undefined;
  if (compress) {
    // Read saved file to get compressed size
    const { readFile } = await import('node:fs/promises');
    const baselinePath = `.codegraph/baseline.json`;
    const fullPath = `${projectRoot}/${baselinePath}`;
    try {
      const savedContent = await readFile(fullPath, 'utf-8');
      const compressedSizeBytes = Buffer.byteLength(savedContent, 'utf-8');
      const savingsPercent = originalSizeBytes > 0
        ? Math.round(((originalSizeBytes - compressedSizeBytes) / originalSizeBytes) * 100)
        : 0;
      compressionStats = {
        originalSizeBytes,
        compressedSizeBytes,
        savingsPercent,
      };
    } catch {
      // If file read fails, skip compression stats
    }
  }

  // ========================================
  // Step 8: Save HEAD Commit
  // ========================================
  const lastCommitPath = getLastCommitPath(projectRoot);
  await writeFile(lastCommitPath, headCommit, 'utf-8');

  // ========================================
  // Step 9: Return Result
  // ========================================
  // Add test-only warning if applicable
  const warnings = analysis.warnings;
  if (edgeCaseResult?.kind === 'test-only') {
    warnings.unshift(edgeCaseResult.warning!);
  }

  const result: AnalyzeResult = {
    success: true,
    stats,
    baseline: {
      path: `.codegraph/baseline.json`,
      commitHash: headCommit,
      timestamp,
    },
    compressionStats,
    durationMs: Date.now() - startTime,
    warnings,
    nextSuggested: [
      'codegraph update',
      'codegraph scope --all',
    ],
  };

  return result;
}

// ============================================================================
// Helper Functions
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
function handleEdgeCase(
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
      // Single file: no layer inference possible
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
      // Test-only: proceed with analysis, but add warning
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
      // Normal project: proceed with standard analysis
      return null;

    default:
      // Exhaustive check - TypeScript ensures all cases handled
      throw new Error(`Unknown project kind: ${specialCase.kind}`);
  }
}

/**
 * Calculate CLI result statistics from analysis stats and graph
 *
 * @param analysisStats - Statistics from analyzer
 * @param graph - The CodeGraph instance
 * @returns CliResultStats for result
 */
function calculateStats(
  analysisStats: {
    filesParsed: number;
    modules: number;
    edges: number;
  },
  graph: { getEdges: () => { type: EdgeType }[] }
): CliResultStats {
  const edges = graph.getEdges();

  // Count edges by type
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
        // Other edge types (CALLS, EXTENDS, etc.) not tracked in CliResultStats
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