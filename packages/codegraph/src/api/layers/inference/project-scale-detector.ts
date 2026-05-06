/**
 * C8: Architecture Layers - Project Scale Detector
 *
 * WHY: Layer threshold should adapt to project complexity.
 * Small projects need aggressive depth (threshold=5), enterprise needs conservative (threshold=1).
 *
 * Uses file counting to determine scale, then applies preset thresholds.
 * Test files excluded to count only production code complexity.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getThresholdForScale } from './depth-presets.js';
import { excludeTestFiles } from '../../../analyzer/test-file-filter.js';

/**
 * Supported source file extensions for counting.
 * WHY: TypeScript/JavaScript/Vue are primary targets for CodeGraph analysis.
 */
const SOURCE_EXTENSIONS_NO_DOT = ['ts', 'tsx', 'js', 'jsx', 'vue'];

/**
 * Detect project scale by counting source files.
 *
 * WHY: File count is a reliable proxy for project complexity.
 * - Small (<50): Simple architecture, aggressive depth
 * - Medium (<200): Moderate complexity, balanced threshold
 * - Large (<500): Complex architecture, conservative threshold
 * - Enterprise: Full-scale systems, most conservative threshold
 *
 * Process:
 * 1. Check if src/ exists (conventional source root)
 * 2. Fall back to project root if src/ missing
 * 3. Scan recursively for source files
 * 4. Exclude test files before counting
 *
 * @param projectRoot - Absolute or relative path to project root
 * @returns Number of source files (excluding test files)
 */
export function detectProjectScale(projectRoot: string): number {
  // WHY: Resolve to absolute path for consistent fs operations
  const absoluteRoot = path.resolve(projectRoot);

  // WHY: Defensive check - non-existent paths return 0 instead of crashing
  if (!fs.existsSync(absoluteRoot)) {
    return 0;
  }

  // Check for conventional src/ directory
  const srcDir = path.join(absoluteRoot, 'src');
  const targetDir = fs.existsSync(srcDir) ? srcDir : absoluteRoot;

  // WHY: Single-pass recursive scan is faster than glob operations
  const allFiles = scanSourceFiles(targetDir);

  // WHY: Test files shouldn't inflate complexity metrics
  const { kept } = excludeTestFiles(allFiles);

  return kept.length;
}

/**
 * Get threshold for project (convenience function).
 *
 * WHY: Combines scale detection with threshold selection in single call.
 * Callers can use this directly instead of calling detectProjectScale + getThresholdForScale.
 *
 * @param projectRoot - Absolute or relative path to project root
 * @returns Layer threshold appropriate for project scale
 */
export function getProjectThreshold(projectRoot: string): number {
  const fileCount = detectProjectScale(projectRoot);
  return getThresholdForScale(fileCount);
}

/**
 * Recursively scan directory for source files.
 *
 * WHY: Single-pass scan with extension filtering is efficient.
 * Node 18+ recursive option eliminates manual traversal overhead.
 *
 * @param root - Directory to scan
 * @returns Relative paths to source files (extensions: ts/tsx/js/jsx/vue)
 */
function scanSourceFiles(root: string): string[] {
  // WHY: readdirSync with recursive option handles nested directories efficiently
  const entries = fs.readdirSync(root, { recursive: true, withFileTypes: true });

  const files: string[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    // WHY: Extension check is faster than pattern matching for source files
    const ext = path.extname(entry.name).slice(1); // Remove dot
    if (SOURCE_EXTENSIONS_NO_DOT.includes(ext)) {
      // WHY: Relative paths work across different project structures
      const relativePath = path.relative(
        root,
        path.join(entry.parentPath ?? root, entry.name)
      );
      files.push(relativePath);
    }
  }

  return files;
}