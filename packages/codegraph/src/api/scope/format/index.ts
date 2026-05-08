/**
 * C7: Scope Query - Output Formatting Entry
 *
 * WHY: formatScopeOutput was 87 lines (>50 threshold).
 * Split into: formatModuleOutput + formatFileOutput + formatExternalOutput.
 *
 * This file provides:
 * - Re-export of all format sub-modules
 * - formatScopeOutput orchestration that delegates to appropriate formatter
 */

import type { GraphNode } from '../../../types.js';
import type {
  ExportInfo,
  ImportInfo,
  ImportedByInfo,
  ComplexityInfo,
  ModifiedInfo,
} from '../../types/index.js';
import { formatModuleOutput } from './module-format.js';
import { formatFileOutput, formatExternalOutput } from './file-format.js';

// Re-export sub-modules
export { formatModuleOutput } from './module-format.js';
export { formatFileOutput, formatExternalOutput } from './file-format.js';
export { formatQuickBriefOutput } from './brief.js';

/**
 * Generate Agent-friendly Markdown output for Scope query
 *
 * A3 Resolution: MVP does not enforce <=600 token truncation.
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
    return formatModuleOutput(
      moduleNode.name,
      path,
      moduleNode,
      importedBy,
      testFile,
      complexity,
      deprecated
    );
  }

  // FILE or EXTERNAL output
  const isExternal = target.startsWith('EXTERNAL:');
  const headerName = isExternal ? name : path;

  if (isExternal) {
    return formatExternalOutput(
      headerName,
      importedBy,
      testFile,
      complexity,
      deprecated
    );
  }

  return formatFileOutput(
    headerName,
    exports,
    imports,
    importedBy,
    testFile,
    complexity,
    lastModified,
    deprecated
  );
}