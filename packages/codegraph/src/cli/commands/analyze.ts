/**
 * @fileoverview CLI analyze command implementation
 *
 * WHY: Provides full repository analysis with baseline persistence.
 * Creates .codegraph/baseline.json and .codegraph/lastCommit.txt for
 * subsequent incremental updates.
 *
 * Flow: Resolve source root → Validate → Detect edge cases → Run analysis → Save baseline → Return result
 *
 * @see 09_c9_cli_analyze_update_spec.md Section 5.1-5.9
 * @see openspec/changes/cg-source-root-auto-detect/design.md D1-D6
 */

import { writeFile } from 'node:fs/promises';
import { analyzeFull } from '../../analyzer.js';
import { detectSpecialCases } from '../../analyzer/index.js';
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
  type EdgeCaseResult,
} from '../../types.js';
import type { Baseline } from '../../persistence/types/baseline.js';
import { handleEdgeCase, calculateStats } from './analyze-helpers.js';
import { calculateCompressionStats } from './compression-stats.js';
import { resolveSourceRoot } from '../utils/resolve-source-root.js';

// ============================================================================
// Command Options
// ============================================================================

/** Options for analyze command */
export interface AnalyzeOptions {
  /** Output as JSON (for programmatic consumption) */
  json?: boolean;
  /** Enable compression (default: true, use --compress to explicitly enable) */
  compress?: boolean;
  /** Explicit source root directory (overrides auto-detection) */
  sourceRoot?: string;
  /** Disable automatic source root detection (requires --source-root) */
  noAutoDetect?: boolean;
}

// ============================================================================
// Main Command Implementation
// ============================================================================

/**
 * Execute analyze command
 *
 * WHY: Full repository analysis creates baseline for future updates.
 * Handles edge cases gracefully with exit code 0.
 *
 * Source root precedence:
 * 1. Explicit --source-root: validate and use directly
 * 2. --no-auto-detect without --source-root: error
 * 3. Auto-detect from cwd upward
 */
export async function analyzeCommand(
  cwd: string,
  options?: AnalyzeOptions
): Promise<AnalyzeResult | CliError | EdgeCaseResult> {
  const startTime = Date.now();
  const compress = options?.compress ?? true;

  // Step 0: Resolve source root (precedence: explicit > auto-detect > error)
  const sourceRootResult = await resolveSourceRoot({
    sourceRoot: options?.sourceRoot,
    noAutoDetect: options?.noAutoDetect,
    cwd,
  });

  if (!sourceRootResult.success) {
    // WHY: Return CliError directly - durationMs already set by resolveSourceRoot
    return sourceRootResult;
  }

  // Use resolved source root for analysis
  const projectRoot = sourceRootResult.path;

  // Step 1: Validate Project (Path + Git)
  const validation = await validateProject(projectRoot);
  if (!validation.path.isValid) {
    return { success: false, error: validation.path.error!, durationMs: Date.now() - startTime };
  }
  if (!validation.git?.isValid) {
    return { success: false, error: validation.git!.error!, durationMs: Date.now() - startTime };
  }
  const validatedRoot = validation.path.absolutePath;

  // Step 2: Detect Edge Cases (early return for empty/single-file)
  const specialCase = detectSpecialCases(validatedRoot);
  const edgeCaseResult = handleEdgeCase(specialCase, startTime);
  if (edgeCaseResult && edgeCaseResult.kind !== 'test-only') {
    return edgeCaseResult;
  }

  // Step 3: Run Full Analysis
  const analysis = await analyzeFull(validatedRoot);

  // Step 4: Calculate Statistics
  const stats = calculateStats(analysis.stats, analysis.graph);

  // Step 5: Prepare and Save Baseline
  const headCommit = await getHeadCommit(validatedRoot);
  const timestamp = Date.now();

  const baseline: Baseline = {
    graph: analysis.graph.toJSON(),
    commitHash: headCommit,
    timestamp,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    generatorVersion: GENERATOR_VERSION,
    architectureConstraints: [],
    healthScore: 100,
    skillDemand: { testWriter: 0, refactorSpecialist: 0, architect: 0, securityReviewer: 0 },
  };

  await ensureCodegraphDir(validatedRoot);
  const originalSizeBytes = Buffer.byteLength(JSON.stringify(baseline), 'utf-8');
  await saveBaseline(baseline, validatedRoot, { compress });

  // Step 6: Calculate Compression Stats (using shared module)
  const compressionStats = compress
    ? await calculateCompressionStats(validatedRoot, originalSizeBytes)
    : undefined;

  // Step 7: Save HEAD Commit
  const lastCommitPath = getLastCommitPath(validatedRoot);
  await writeFile(lastCommitPath, headCommit, 'utf-8');

  // Step 8: Return Result (immutable warning handling)
  const warnings = edgeCaseResult?.kind === 'test-only'
    ? [edgeCaseResult.warning!, ...analysis.warnings] // WHY: prepend test-only warning to existing warnings
    : analysis.warnings;

  return {
    success: true,
    stats,
    baseline: { path: '.codegraph/baseline.json', commitHash: headCommit, timestamp },
    compressionStats,
    durationMs: Date.now() - startTime,
    warnings,
    nextSuggested: ['codegraph update', 'codegraph scope --all'],
  };
}