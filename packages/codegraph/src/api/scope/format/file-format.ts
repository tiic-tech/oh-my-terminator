/**
 * C7: Scope Query - FILE/EXTERNAL Output Formatting
 *
 * WHY: formatFileOutput handles FILE and EXTERNAL output logic.
 * Separated from formatScopeOutput to keep file under threshold.
 */

import type { ExportInfo, ImportInfo, ImportedByInfo, ComplexityInfo, ModifiedInfo } from '../../types/index.js';

/**
 * Format FILE output
 *
 * Displays exports, imports, imported-by, and metadata.
 */
export function formatFileOutput(
  path: string,
  exports: ExportInfo[],
  imports: ImportInfo[],
  importedBy: ImportedByInfo[],
  testFile: string | null,
  complexity: ComplexityInfo,
  lastModified: ModifiedInfo,
  deprecated: boolean
): string {
  let content = `## Scope: ${path}\n\n`;

  // Exports section
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

  // Imports section
  content += `### Imports (${imports.length})\n`;
  if (imports.length > 0) {
    for (const imp of imports) {
      content += `- ${imp.from} (${imp.type})\n`;
    }
  } else {
    content += '- none (leaf file)\n';
  }
  content += '\n';

  // Imported-by section
  content += `### Imported by (${importedBy.length})\n`;
  if (importedBy.length > 0) {
    content += `- ${importedBy.map(i => i.file).join(', ')}\n`;
  } else {
    content += '- none (isolated)\n';
  }
  content += '\n';

  // Metadata section
  content += '### Metadata\n';
  content += `- Test: ${testFile || 'none'}\n`;
  content += `- Complexity: ${complexity.level} (${complexity.value})\n`;
  if (lastModified.relativeTime) {
    content += `- Modified: ${lastModified.relativeTime}\n`;
  }
  content += `- Deprecated: ${deprecated ? 'yes (WARNING)' : 'no'}\n`;

  return content;
}

/**
 * Format EXTERNAL output
 *
 * External packages have limited data (no exports/imports).
 */
export function formatExternalOutput(
  name: string,
  importedBy: ImportedByInfo[],
  testFile: string | null,
  complexity: ComplexityInfo,
  deprecated: boolean
): string {
  let content = `## Scope: ${name}\n\n`;

  // Imported-by section
  content += `### Imported by (${importedBy.length})\n`;
  if (importedBy.length > 0) {
    content += `- ${importedBy.map(i => i.file).join(', ')}\n`;
  } else {
    content += '- none (isolated)\n';
  }
  content += '\n';

  // Metadata section
  content += '### Metadata\n';
  content += `- Test: ${testFile || 'none'}\n`;
  content += `- Complexity: ${complexity.level} (${complexity.value})\n`;
  content += `- Deprecated: ${deprecated ? 'yes (WARNING)' : 'no'}\n`;

  // Note section
  content += '\n### Note\n- External package from node_modules\n- No exports/imports data available\n';

  return content;
}