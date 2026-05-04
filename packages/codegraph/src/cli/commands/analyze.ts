/**
 * @fileoverview CLI analyze command implementation
 *
 * WHY: Provides full repository analysis with baseline persistence.
 * Creates .codegraph/baseline.json and .codegraph/lastCommit.txt for
 * subsequent incremental updates.
 *
 * Flow:
 * 1. Validate project (path existence + git repo + commits)
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
import { getHeadCommit } from '../../git/index.js';
import { validateProject } from '../validation.js';
import {
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
  // Step 2: Run Full Analysis
  // ========================================
  const analysis = await analyzeFull(projectRoot);

  // ========================================
  // Step 3: Calculate Statistics
  // ========================================
  const stats = calculateStats(analysis.stats, analysis.graph);

  // ========================================
  // Step 4: Prepare Baseline
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
  // Step 5: Save Baseline
  // ========================================
  await ensureCodegraphDir(projectRoot);
  await saveBaseline(baseline, projectRoot);

  // ========================================
  // Step 6: Save HEAD Commit
  // ========================================
  const lastCommitPath = getLastCommitPath(projectRoot);
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