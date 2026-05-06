/**
 * Single File Handler
 *
 * WHY: Single-file projects lack dependency depth for Layer inference.
 * But if imports resolve to project files, reclassify as 'normal' project.
 * CLI should exit 0, not fail, for valid single-file states.
 */

import { type ProjectKind } from './types.js';

/**
 * Result returned when single source file is detected.
 */
export interface SingleFileResult {
  /** Exit code - 0 for graceful handling, not error */
  exitCode: 0;
  /** Path to the single source file */
  filePath: string;
  /** External dependencies (npm packages, not project files) */
  externalDeps: string[];
  /** Project classification after reclassification check */
  kind: ProjectKind;
  /** True if single file imports resolve to project files */
  reclassified: boolean;
}

/**
 * Handle single-file project scenario.
 *
 * WHY: Returns structured analysis for CLI consumption.
 * If imports resolve to files within project, reclassify as 'normal'.
 * This handles cases where scanner detected only one source file,
 * but imports reveal additional project structure.
 *
 * @param filePath - Path to the single source file
 * @param externalDeps - External dependencies (npm packages)
 * @param resolvedImports - Imports that resolve to files within project
 * @returns Structured result with classification and dependencies
 */
export function handleSingleFileProject(
  filePath: string,
  externalDeps: string[],
  resolvedImports: string[]
): SingleFileResult {
  // If imports resolve to project files, it's actually a normal project
  // WHY: Scanner may miss files; import resolution reveals true structure
  const reclassified = resolvedImports.length > 0;
  const kind: ProjectKind = reclassified ? 'normal' : 'single-file';

  return {
    exitCode: 0,
    filePath,
    externalDeps,
    kind,
    reclassified,
  };
}