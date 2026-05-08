/**
 * C7: Scope Query - Quick Brief Output
 *
 * WHY: formatQuickBriefOutput is a self-contained utility.
 * Generates compact Markdown for QuickBrief (<=50 tokens target).
 */

/**
 * Generate compact Markdown output for QuickBrief
 *
 * Target: <=50 tokens
 */
export function formatQuickBriefOutput(
  filePath: string,
  importCount: number,
  importedByCount: number,
  hasTest: boolean,
  deprecated: boolean,
  complexityLevel: string
): string {
  const testStatus = hasTest ? 'yes' : 'no';
  const deprecatedStatus = deprecated ? 'yes (WARNING)' : 'no';

  return `## Brief: ${filePath}
- Imports: ${importCount}
- Imported by: ${importedByCount}
- Test: ${testStatus}
- Deprecated: ${deprecatedStatus}
- Complexity: ${complexityLevel}`;
}