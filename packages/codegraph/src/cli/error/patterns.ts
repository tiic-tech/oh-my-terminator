/**
 * CACError Regex Patterns for Message Parsing
 *
 * WHY: CAC error messages follow predictable formats. Regex extraction allows
 * flexible parsing that survives minor CAC version changes.
 *
 * NOTE: Patterns based on actual CAC 6.7.14 source code, not documentation assumptions.
 */

/**
 * CACError regex patterns for message parsing
 */
export const CAC_ERROR_PATTERNS = {
  // WHY: CAC outputs "Unknown option `--xyz`" for invalid flags (with backticks)
  UNKNOWN_OPTION: /^Unknown option `--(.+)`$/,

  // WHY: CAC outputs "option `--xyz` value is missing" for required option without value
  MISSING_OPTION_VALUE: /^option `--(.+)` value is missing$/,

  // WHY: CAC outputs "missing required args for command `cmd-name`" for missing args
  MISSING_REQUIRED_ARGS: /^missing required args for command `(.+)`$/,
};