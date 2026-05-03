/**
 * Module ID Generator
 *
 * Generate unique MODULE node identifiers
 */

/**
 * Generate MODULE node ID
 *
 * D1 Resolution: MODULE:filePath#exportName
 *
 * @param filePath - Relative file path
 * @param name - Export name
 * @returns MODULE ID string
 */
export function generateModuleId(filePath: string, name: string): string {
  return `MODULE:${filePath}#${name}`;
}