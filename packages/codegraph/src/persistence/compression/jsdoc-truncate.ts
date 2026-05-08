/**
 * @fileoverview JSDoc truncation module
 *
 * WHY: Full JSDoc rarely consumed by Agents (80% use signature only).
 * Truncation preserves existence signal (hasJSDoc) while reducing baseline size.
 * Configurable via .codegraph/config.json (default: 100 chars).
 *
 * @see design.md D2: JSDoc Truncation decision
 */

/**
 * Result of JSDoc truncation operation
 *
 * WHY: Structured result enables consumers to:
 * - Use truncated content (jsDoc)
 * - Know if truncation occurred (jsDocTruncated)
 * - Detect existence without content (hasJSDoc)
 */
export interface TruncatedJSDocResult {
  /** Truncated JSDoc content (undefined if no JSDoc) */
  jsDoc?: string;
  /** Whether JSDoc was truncated from original (undefined if no JSDoc) */
  jsDocTruncated?: boolean;
  /** Whether original JSDoc exists (false if undefined/null/empty/whitespace-only) */
  hasJSDoc: boolean;
}

/**
 * Default maximum JSDoc length
 *
 * WHY: 100 characters balances readability with size reduction.
 * Agents typically consume first 50-80 chars for context.
 */
export const DEFAULT_JSDOC_MAX_LENGTH = 100;

/**
 * Truncate JSDoc to specified maximum length
 *
 * Truncation rules:
 * - Empty/undefined/null/whitespace-only → hasJSDoc: false, jsDoc: undefined
 * - Short JSDoc (≤ maxLength) → hasJSDoc: true, jsDocTruncated: false
 * - Long JSDoc (> maxLength) → hasJSDoc: true, jsDocTruncated: true, append '...'
 *
 * @param jsDoc - Original JSDoc string (may be undefined/null/empty)
 * @param maxLength - Maximum length before truncation (default: 100)
 * @returns TruncatedJSDocResult with truncated content and metadata
 *
 * @example
 * ```ts
 * truncateJSDoc(undefined, 100);
 * // { hasJSDoc: false }
 *
 * truncateJSDoc('Short description', 100);
 * // { jsDoc: 'Short description', jsDocTruncated: false, hasJSDoc: true }
 *
 * truncateJSDoc('Very long description...', 20);
 * // { jsDoc: 'Very long descri...', jsDocTruncated: true, hasJSDoc: true }
 * ```
 */
export function truncateJSDoc(
  jsDoc: string | undefined | null,
  maxLength: number = DEFAULT_JSDOC_MAX_LENGTH
): TruncatedJSDocResult {
  // Handle undefined/null
  if (jsDoc === undefined || jsDoc === null) {
    return {
      jsDoc: undefined,
      jsDocTruncated: undefined,
      hasJSDoc: false,
    };
  }

  // Trim whitespace
  const trimmedDoc = jsDoc.trim();

  // Handle empty/whitespace-only
  if (trimmedDoc === '') {
    return {
      jsDoc: undefined,
      jsDocTruncated: undefined,
      hasJSDoc: false,
    };
  }

  // Handle maxLength <= 0 edge case
  if (maxLength <= 0) {
    return {
      jsDoc: '...',
      jsDocTruncated: true,
      hasJSDoc: true,
    };
  }

  // Check if truncation needed
  if (trimmedDoc.length <= maxLength) {
    return {
      jsDoc: trimmedDoc,
      jsDocTruncated: false,
      hasJSDoc: true,
    };
  }

  // Truncate with ellipsis
  const truncated = trimmedDoc.slice(0, maxLength) + '...';

  return {
    jsDoc: truncated,
    jsDocTruncated: true,
    hasJSDoc: true,
  };
}