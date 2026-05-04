/**
 * @fileoverview CLI analyze command implementation
 *
 * WHY: Provides full repository analysis with baseline persistence.
 * Creates .codegraph/baseline.json and .codegraph/lastCommit.txt for
 * subsequent incremental updates.
 *
 * Flow:
 * 1. Git validation (must be in git repo)
 * 2. Run full analysis (scan + parse)
 * 3. Save baseline.json
 * 4. Save lastCommit.txt
 * 5. Return structured result
 *
 * @see 09_c9_cli_analyze_update_spec.md Section 5.1-5.9
 */

import { writeFile } from 'node:fs/promises';
import { analyzeFull } from '../../analyzer.js';
import {
  saveBaseline,
  ensureCodegraphDir,
  getLastCommitPath,
} from '../../persistence/index.js';
import {
  CURRENT_SCHEMA_VERSION,
  GENERATOR_VERSION,
} from '../../version.js';
import {
  getHeadCommit,
  isGitRepo,
} from '../../git/index.js';
import {
  CliErrorCode,
  type AnalyzeResult,
  type CliError,
  type CliResultStats,
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
}

// ============================================================================
// Main Command Implementation
// ============================================================================

/**
 * Execute analyze command
 *
 * Performs full repository analysis and creates baseline for future updates.
 *
 * @param cwd - Project root directory
 * @param options - Command options
 * @returns AnalyzeResult on success, CliError on failure
 */
export async function analyzeCommand(
  cwd: string,
  _options?: AnalyzeOptions
): Promise<AnalyzeResult | CliError> {
  const startTime = Date.now();

  // ========================================
  // Step 1: Git Validation
  // ========================================
  const isGit = await isGitRepo(cwd);
  if (!isGit) {
    return {
      success: false,
      error: {
        code: CliErrorCode.E_NO_GIT_REPO,
        message: 'Not a git repository. CodeGraph requires a git repository for baseline tracking.',
      },
      durationMs: Date.now() - startTime,
    };
  }

  // ========================================
  // Step 2: Run Full Analysis
  // ========================================
  const analysis = await analyzeFull(cwd);

  // ========================================
  // Step 3: Calculate Statistics
  // ========================================
  const stats = calculateStats(analysis.stats, analysis.graph);

  // ========================================
  // Step 4: Prepare Baseline
  // ========================================
  const headCommit = await getHeadCommit(cwd);
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
  // Step 5: Save Baseline
  // ========================================
  await ensureCodegraphDir(cwd);
  await saveBaseline(baseline, cwd);

  // ========================================
  // Step 6: Save HEAD Commit
  // ========================================
  const lastCommitPath = getLastCommitPath(cwd);
  await writeFile(lastCommitPath, headCommit, 'utf-8');

  // ========================================
  // Step 7: Return Result
  // ========================================
  return {
    success: true,
    stats,
    baseline: {
      path: `.codegraph/baseline.json`,
      commitHash: headCommit,
      timestamp,
    },
    durationMs: Date.now() - startTime,
    warnings: analysis.warnings,
    nextSuggested: [
      'codegraph update',
      'codegraph scope --all',
    ],
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

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