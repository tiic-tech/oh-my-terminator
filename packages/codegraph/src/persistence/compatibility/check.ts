/**
 * @fileoverview Schema version compatibility checking for CodeGraph baselines
 *
 * WHY: Version compatibility determines how to handle baseline loading:
 * - Legacy baselines (no version) → rebuild
 * - Major mismatch → error or migrate
 * - Minor/patch differences → proceed or optional migrate
 *
 * Strategy Matrix:
 * | Reason                    | Action   | Notes                            |
 * |---------------------------|----------|----------------------------------|
 * | legacy_baseline           | rebuild  | No version info                  |
 * | major_version_mismatch    | error    | Baseline higher than current     |
 * | major_version_mismatch    | migrate  | Baseline lower than current      |
 * | minor_version_old         | migrate  | if autoMigrate, else proceed     |
 * | patch_version_old         | proceed  | Compatible                       |
 * | version_match             | proceed  | Exact match                      |
 *
 * @see 06_c6_baseline_version_spec.md Section 2
 *
 * Originally extracted from compatibility.ts (315 lines) to comply with
 * coding-taste Rule 2 (max 150 lines per file).
 */

import { SchemaVersionImpl } from '../../version.js';
import type {
  Baseline,
  SchemaVersion,
  CompatibilityResult,
} from '../types/index.js';

/**
 * Check baseline schema compatibility with current version
 *
 * WHY: Determines whether baseline can be used directly, needs migration,
 * or requires rebuild. Returns detailed result for action determination.
 *
 * @param baseline - Loaded baseline data
 * @param currentVersion - Current tool schema version
 * @returns Compatibility result with recommended action
 */
export function checkSchemaCompatibility(
  baseline: Baseline,
  currentVersion: SchemaVersion
): CompatibilityResult {
  // Case 1: Legacy baseline without schemaVersion field
  if (!baseline.schemaVersion) {
    return {
      compatible: false,
      reason: 'legacy_baseline',
      action: 'rebuild',
      message: 'Legacy baseline without schema version - requires rebuild',
    };
  }

  const baselineV = baseline.schemaVersion;
  const currentV = currentVersion;

  // Case 2: Major version mismatch
  if (baselineV.major !== currentV.major) {
    // Create SchemaVersionImpl for comparison
    const baselineImpl = new SchemaVersionImpl(baselineV.major, baselineV.minor, baselineV.patch);
    const currentImpl = new SchemaVersionImpl(currentV.major, currentV.minor, currentV.patch);

    // Baseline is from future version (higher) - cannot downgrade
    if (baselineImpl.isGreaterThan(currentImpl)) {
      return {
        compatible: false,
        reason: 'major_version_mismatch',
        action: 'error',
        message: `Baseline schema version (${baselineImpl.toString()}) is higher than current (${currentImpl.toString()}) - cannot downgrade`,
        details: {
          baselineVersion: baselineImpl.toString(),
          currentVersion: currentImpl.toString(),
        },
      };
    }

    // Baseline is older - can attempt migration
    return {
      compatible: false,
      reason: 'major_version_mismatch',
      action: 'migrate',
      message: `Major version mismatch: baseline=${baselineImpl.toString()} < current=${currentImpl.toString()}`,
      details: {
        baselineVersion: baselineImpl.toString(),
        currentVersion: currentImpl.toString(),
      },
    };
  }

  // Case 3: Minor version outdated (same major, baseline minor < current)
  if (baselineV.minor < currentV.minor) {
    return {
      compatible: true, // Still usable, but migration recommended
      reason: 'minor_version_old',
      action: 'migrate',
      message: `Baseline minor version outdated: ${baselineV.major}.${baselineV.minor}.${baselineV.patch} < ${currentV.major}.${currentV.minor}.${currentV.patch}`,
    };
  }

  // Case 4: Patch version outdated (same major, same minor, baseline patch < current)
  if (baselineV.patch < currentV.patch) {
    return {
      compatible: true,
      reason: 'patch_version_old',
      action: 'proceed', // Patch differences don't require migration
      message: `Baseline patch version outdated: ${baselineV.major}.${baselineV.minor}.${baselineV.patch} < ${currentV.major}.${currentV.minor}.${currentV.patch}`,
    };
  }

  // Case 5: Baseline version is higher or equal within same major
  // If baseline has higher minor/patch, it's still compatible
  const baselineImpl = new SchemaVersionImpl(baselineV.major, baselineV.minor, baselineV.patch);
  const currentImpl = new SchemaVersionImpl(currentV.major, currentV.minor, currentV.patch);

  if (baselineImpl.isGreaterThan(currentImpl)) {
    // Baseline has newer minor/patch within same major - still compatible
    return {
      compatible: true,
      reason: 'version_match',
      action: 'proceed',
      message: `Baseline version compatible or newer within same major: ${baselineImpl.toString()}`,
    };
  }

  // Case 6: Exact version match
  return {
    compatible: true,
    reason: 'version_match',
    action: 'proceed',
    message: `Version compatible: ${baselineImpl.toString()}`,
  };
}