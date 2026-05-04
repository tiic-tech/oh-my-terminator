/**
 * @fileoverview File I/O helpers for baseline loading
 *
 * WHY: Isolates file operations with proper error handling:
 * - File existence check
 * - Safe file reading with JSON parsing
 * - Error propagation for failure handlers
 */

import { readFile, stat } from 'node:fs/promises';
import type { LoadBaselineOptions, LoadBaselineResult } from '../types/index.js';
import { handleFailure } from './failure-handlers.js';

// ============================================================================
// File Helpers
// ============================================================================

/**
 * Check if file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse baseline JSON file
 *
 * WHY: Isolates file I/O and JSON parsing with proper error handling.
 * Returns parsed data on success, or failure result for caller to return.
 *
 * @param path - Absolute path to baseline file
 * @param cwd - Project working directory (for failure handler)
 * @param options - Load options (for failure handler)
 * @returns Object with parsed data on success, or LoadBaselineResult on failure
 */
export async function readBaselineFile(
  path: string,
  cwd: string,
  options?: LoadBaselineOptions
): Promise<{ success: true; data: unknown } | LoadBaselineResult> {
  // Check file exists
  if (!await fileExists(path)) {
    return await handleFailure('file_not_found', cwd, options);
  }

  // Read file content
  let rawContent: string;
  try {
    rawContent = await readFile(path, 'utf-8');
  } catch (e) {
    return await handleFailure('permission_error', cwd, options, e);
  }

  // Parse JSON
  try {
    const parsed = JSON.parse(rawContent);
    return { success: true, data: parsed };
  } catch (e) {
    return await handleFailure('parse_error', cwd, options, e);
  }
}