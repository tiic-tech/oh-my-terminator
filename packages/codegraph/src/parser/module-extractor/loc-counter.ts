/**
 * LOC Counter
 *
 * Count effective lines of code
 */

import ts from 'typescript';

/**
 * Count effective lines of code
 *
 * D5 Resolution:
 * - Include: code, import, export, type definition
 * - Exclude: empty lines, comments
 *
 * @param sourceFile - Source file
 * @param node - AST node to count
 * @returns LOC number
 */
export function countLOC(sourceFile: ts.SourceFile, node: ts.Node): number {
  const start = node.getStart(sourceFile);
  const end = node.getEnd();
  const text = sourceFile.text.substring(start, end);
  const lines = text.split('\n');

  let loc = 0;
  let inCommentBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Empty line
    if (trimmed.length === 0) {
      continue;
    }

    // Handle inline block comments: /* comment */ code
    if (trimmed.includes('/*') && trimmed.includes('*/')) {
      // Extract code outside comment
      const withoutComment = trimmed.replace(/\/\*.*?\*\//g, '').trim();
      if (withoutComment.length > 0) {
        loc++;
      }
      continue;
    }

    // Multi-line comment start (/** also matches /*)
    if (trimmed.startsWith('/*')) {
      inCommentBlock = true;
      continue;
    }

    // In comment block
    if (inCommentBlock) {
      if (trimmed.endsWith('*/')) {
        inCommentBlock = false;
      }
      continue;
    }

    // Single-line comment
    if (trimmed.startsWith('//')) {
      continue;
    }

    // Code line
    loc++;
  }

  return loc;
}