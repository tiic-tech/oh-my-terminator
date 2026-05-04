/**
 * C8: Impact Analysis - Target Normalization
 *
 * WHY: normalizeTargetsToFile is a self-contained utility function.
 * Converts various target formats to FILE node IDs.
 */

/**
 * Normalize target IDs to FILE node IDs
 *
 * Converts MODULE targets to their parent FILE nodes.
 *
 * @param targets - Array of target IDs (FILE:xxx, MODULE:xxx#yyy, or plain paths)
 * @returns Set of FILE node IDs
 * @throws Error if targets is not an array
 */
export function normalizeTargetsToFile(
  targets: string[]
): Set<string> {
  // WHY: "Validate at system boundaries" principle.
  // Empty array is valid (returns empty set), but null/undefined would cause runtime errors.
  if (!Array.isArray(targets)) {
    throw new Error('[normalizeTargetsToFile] targets must be an array');
  }

  // Early return for empty array (valid input, nothing to process)
  if (targets.length === 0) {
    return new Set<string>();
  }

  const fileTargets = new Set<string>();

  for (const target of targets) {
    if (target.startsWith('FILE:')) {
      fileTargets.add(target);
    } else if (target.startsWith('MODULE:')) {
      // MODULE:src/utils.ts#formatDate -> FILE:src/utils.ts
      const filePath = target.split('#')[0].replace('MODULE:', 'FILE:');
      fileTargets.add(filePath);
    } else if (target.startsWith('EXTERNAL:')) {
      // EXTERNAL targets not supported for impact analysis
      // Skip silently (will be handled at API level)
      continue;
    } else {
      // Plain path - assume FILE
      fileTargets.add(`FILE:${target}`);
    }
  }

  return fileTargets;
}