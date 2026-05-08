/**
 * JSDoc Extractor
 *
 * Extract JSDoc comments from AST nodes and detect @deprecated markers
 */

import ts from 'typescript';

/**
 * Check if JSDoc contains @deprecated marker
 *
 * @param node - AST node
 * @param sourceFile - Optional source file (needed when node.getSourceFile() is undefined)
 * @returns True if JSDoc contains @deprecated tag
 */
export function isDeprecated(node: ts.Node, sourceFile?: ts.SourceFile): boolean {
  const sf = sourceFile ?? node.getSourceFile();
  if (!sf) {
    return false;
  }

  const nodeFullStart = node.getFullStart();
  const comments = ts.getLeadingCommentRanges(sf.text, nodeFullStart);

  if (!comments || comments.length === 0) {
    return false;
  }

  for (const comment of comments) {
    const text = sf.text.substring(comment.pos, comment.end);

    if (text.startsWith('/**') && text.endsWith('*/')) {
      // Check for @deprecated tag (case-insensitive, allows whitespace)
      const deprecatedPattern = /@deprecated/i;
      if (deprecatedPattern.test(text)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extract JSDoc comment from node
 *
 * A3 Resolution: First 200 characters
 *
 * @param node - AST node
 * @param sourceFile - Optional source file (needed when node.getSourceFile() is undefined)
 * @returns JSDoc text or undefined
 */
export function extractJSDoc(node: ts.Node, sourceFile?: ts.SourceFile): string | undefined {
  const sf = sourceFile ?? node.getSourceFile();
  if (!sf) {
    return undefined;
  }

  // Use getFullStart to include leading trivia (comments)
  const nodeFullStart = node.getFullStart();

  // JSDoc comments appear before the node
  const comments = ts.getLeadingCommentRanges(sf.text, nodeFullStart);

  if (!comments || comments.length === 0) {
    return undefined;
  }

  // Find JSDoc comment (/** ... */)
  for (const comment of comments) {
    const text = sf.text.substring(comment.pos, comment.end);

    if (text.startsWith('/**') && text.endsWith('*/')) {
      // Extract content (strip /** and */)
      let content = text.slice(3, -2).trim();

      // Remove leading * from each line
      content = content.split('\n')
        .map(line => line.replace(/^\s*\*\s?/, '').trim())
        .join('\n');

      // Truncate at 200 chars
      if (content.length > 200) {
        return content.substring(0, 200) + '...';
      }

      return content;
    }
  }

  return undefined;
}