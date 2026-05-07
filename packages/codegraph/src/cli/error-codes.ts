/**
 * CLI Error Codes and Types
 *
 * WHY: Re-exports unified error types from src/types.ts for CLI layer convenience.
 * Avoids duplication while providing CLI-specific namespace.
 */

// WHY: Top-level import preferred over dynamic import for type-only references
// - Better IDE support (autocomplete, jump-to-definition)
// - Consistent import style across codebase
// - No runtime overhead for type-only imports
import type { CliErrorCode as CliErrorCodeType, CliError as CliErrorType } from '../types.js';

// Re-export from unified types
export { CliErrorCode, type CliError } from '../types.js';

/**
 * Create a CliError with optional suggestion and debug fields
 *
 * WHY: Factory function ensures consistent error structure across CLI layer.
 */
export function createCliError(
  code: CliErrorCodeType,
  message: string,
  options?: { suggestion?: string; debug?: string },
  durationMs: number = 0
): CliErrorType {
  return {
    success: false,
    error: {
      code,
      message,
      ...options,
    },
    durationMs,
  };
}