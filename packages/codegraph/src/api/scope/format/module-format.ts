/**
 * C7: Scope Query - MODULE Output Formatting
 *
 * WHY: formatModuleOutput handles MODULE-specific output logic.
 * Separated from formatScopeOutput to keep file under threshold.
 */

import type { GraphNode } from '../../../types.js';
import type { ImportedByInfo, ComplexityInfo } from '../../types/index.js';

/**
 * Format MODULE-specific output
 *
 * Displays kind, JSDoc (truncated), and import dependencies.
 */
export function formatModuleOutput(
  moduleName: string,
  path: string,
  moduleNode: GraphNode,
  importedBy: ImportedByInfo[],
  testFile: string | null,
  complexity: ComplexityInfo,
  deprecated: boolean
): string {
  const kind = moduleNode.metadata?.kind || 'unknown';
  const jsDoc = moduleNode.metadata?.jsDoc
    ? moduleNode.metadata.jsDoc.slice(0, 100) + '...'
    : 'none';

  return `## Scope: ${moduleName} (${path})

### Kind
- ${kind} (exported)

### JSDoc (truncated)
- ${jsDoc}

### Imported by (${importedBy.length})
${importedBy.length > 0 ? importedBy.map(i => `- ${i.file}`).join('\n') : '- none'}

### Metadata
- Test: ${testFile || 'none'}
- Complexity: ${complexity.level} (${complexity.value})
- Deprecated: ${deprecated ? 'yes (WARNING)' : 'no'}
`;
}