/**
 * C7: Scope Query - Output Formatting
 *
 * Generate Agent-friendly Markdown output.
 */

import { type GraphNode } from '../../types.js';
import {
  type ExportInfo,
  type ImportInfo,
  type ImportedByInfo,
  type ComplexityInfo,
  type ModifiedInfo,
} from '../types.js';

/**
 * Generate Agent-friendly Markdown output for Scope query
 *
 * A3 Resolution: MVP does not enforce ≤600 token truncation.
 *
 * @param target - Target string
 * @param exports - Export list
 * @param imports - Import list
 * @param importedBy - Imported-by list
 * @param testFile - Test file path
 * @param complexity - Complexity info
 * @param lastModified - Last modified info
 * @param deprecated - Deprecated flag
 * @param moduleNode - Optional MODULE node for MODULE-specific output
 */
export function formatScopeOutput(
  target: string,
  exports: ExportInfo[],
  imports: ImportInfo[],
  importedBy: ImportedByInfo[],
  testFile: string | null,
  complexity: ComplexityInfo,
  lastModified: ModifiedInfo,
  deprecated: boolean,
  moduleNode?: GraphNode | null
): string {
  const pathMatch = target.match(/(?:FILE:|MODULE:)?([^#]+)/);
  const path = pathMatch ? pathMatch[1] : target;
  const name = path.split('/').pop() || path;

  // MODULE-specific output
  if (moduleNode) {
    const kind = moduleNode.metadata?.kind || 'unknown';
    const jsDoc = moduleNode.metadata?.jsDoc
      ? moduleNode.metadata.jsDoc.slice(0, 100) + '...'
      : 'none';

    return `## Scope: ${moduleNode.name} (${path})

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

  // FILE or EXTERNAL output
  const isExternal = target.startsWith('EXTERNAL:');
  const headerName = isExternal ? name : path;

  let content = `## Scope: ${headerName}\n\n`;

  if (!isExternal) {
    content += `### Exports (${exports.length})\n`;
    if (exports.length > 0) {
      const byKind: Record<string, string[]> = {};
      for (const exp of exports) {
        if (!byKind[exp.kind]) byKind[exp.kind] = [];
        byKind[exp.kind].push(exp.name);
      }
      for (const [kind, names] of Object.entries(byKind)) {
        content += `- ${kind}:${names.join(', ')}\n`;
      }
    } else {
      content += '- none\n';
    }
    content += '\n';
  }

  if (!isExternal) {
    content += `### Imports (${imports.length})\n`;
    if (imports.length > 0) {
      for (const imp of imports) {
        content += `- ${imp.from} (${imp.type})\n`;
      }
    } else {
      content += '- none (leaf file)\n';
    }
    content += '\n';
  }

  content += `### Imported by (${importedBy.length})\n`;
  if (importedBy.length > 0) {
    content += `- ${importedBy.map(i => i.file).join(', ')}\n`;
  } else {
    content += '- none (isolated)\n';
  }
  content += '\n';

  content += '### Metadata\n';
  content += `- Test: ${testFile || 'none'}\n`;
  content += `- Complexity: ${complexity.level} (${complexity.value})\n`;
  if (lastModified.relativeTime) {
    content += `- Modified: ${lastModified.relativeTime}\n`;
  }
  content += `- Deprecated: ${deprecated ? 'yes (WARNING)' : 'no'}\n`;

  if (isExternal) {
    content += '\n### Note\n- External package from node_modules\n- No exports/imports data available\n';
  }

  return content;
}

/**
 * Generate compact Markdown output for QuickBrief
 *
 * Target: ≤50 tokens
 */
export function formatQuickBriefOutput(
  filePath: string,
  importCount: number,
  importedByCount: number,
  hasTest: boolean,
  deprecated: boolean,
  complexityLevel: string
): string {
  const fileName = filePath.split('/').pop() || filePath;
  const testStatus = hasTest ? 'yes' : 'no';
  const deprecatedStatus = deprecated ? 'yes (WARNING)' : 'no';

  return `## Brief: ${filePath}
- Imports: ${importCount}
- Imported by: ${importedByCount}
- Test: ${testStatus}
- Deprecated: ${deprecatedStatus}
- Complexity: ${complexityLevel}`;
}