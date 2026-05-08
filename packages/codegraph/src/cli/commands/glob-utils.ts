/**
 * Glob Pattern Utilities
 *
 * WHY: Single source of truth for glob pattern matching.
 * Previously duplicated in edge-case-detector.ts and test-file-filter.ts.
 *
 * LIMITATION: Only handles known patterns (asterisk wildcards).
 * Complex globs (braces, character classes) not supported.
 */

/**
 * Convert glob pattern to RegExp.
 *
 * WHY: Known patterns are simple; full glob parser would add dependency.
 * Regex enables single-pass matching vs. multiple string operations.
 */
export function globToRegex(pattern: string, caseInsensitive = false): RegExp {
  // Escape regex special chars except glob wildcards
  // WHY: Prevent regex injection from pattern strings
  let regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex specials
    .replace(/\*/g, '.*');                  // Convert * to regex wildcard

  // Anchor pattern for full match
  // WHY: Prevent partial matches (*.test.ts shouldn't match foo.test.ts.bak)
  if (!pattern.endsWith('/**')) {
    regexStr = '^' + regexStr + '$';
  } else {
    // Directory patterns match prefix (tests/** matches tests/foo/bar.ts)
    // WHY: tests/** should match all files under tests directory
    regexStr = '^' + regexStr.replace('/\\*\\*', '(/.*)?');
  }

  return new RegExp(regexStr, caseInsensitive ? 'i' : '');
}

/**
 * Create matcher function from glob pattern.
 *
 * WHY: Matcher function is reusable; avoids repeated regex creation.
 * Performance: O(1) regex creation, O(n) matching where n = path length.
 */
export function patternToMatcher(
  pattern: string,
  caseInsensitive = false
): (path: string) => boolean {
  const regex = globToRegex(pattern, caseInsensitive);

  return (path: string): boolean => {
    // Empty path guard
    // WHY: Empty strings match unexpected patterns (^.*$ matches empty)
    if (!path) return false;

    // Normalize path separators for cross-platform matching
    // WHY: Windows uses \, Unix uses /; patterns use /
    const normalized = path.replace(/\\/g, '/');
    return regex.test(normalized);
  };
}