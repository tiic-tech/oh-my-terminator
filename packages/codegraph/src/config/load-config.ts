/**
 * Configuration loading module (Tasks 3.2-3.3, 3.7)
 *
 * Loads CompressionConfig from .codegraph/config.json.
 * Returns default config if file missing (graceful handling).
 *
 * WHY: Dependencies Are Invisible Chains.
 * Config loading is explicit - file path must be provided.
 * No hidden filesystem access without caller knowledge.
 *
 * @see coding-taste skill - "Declare dependencies explicitly"
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CompressionConfig } from '../types.js';
import { CliErrorCode } from '../types.js';
import type { NamingRule } from '../api/layers/inference/naming-rules.js';
import {
  validateCompressionConfig,
  validateFullConfig,
  DEFAULT_COMPRESSION_CONFIG,
  type ValidationResult,
  type ValidationFailure,
  type FullValidationResult,
  type FullValidationFailure,
} from './validate-config.js';
import {
  mergeNamingRules,
  DEFAULT_MERGED_NAMING_RULES,
} from './naming-rules-config.js';

// ============================================================================
// Task 3.2-3.3: Loading Result Types
// ============================================================================

/**
 * Result of loading when successful
 */
export interface LoadSuccess {
  success: true;
  config: CompressionConfig;
}

/**
 * Result of loading when failed
 *
 * WHY: Discriminated union enables type narrowing.
 * Matches ValidationResult pattern for consistency.
 */
export interface LoadFailure {
  success: false;
  error: {
    code: CliErrorCode.E_INVALID_CONFIG;
    message: string;
  };
}

/**
 * Loading result (discriminated union)
 */
export type LoadResult = LoadSuccess | LoadFailure;

// ============================================================================
// Task 3.2-3.3, 3.7: Loading Function
// ============================================================================

/**
 * Config file path relative to project root
 */
const CONFIG_FILE_PATH = '.codegraph/config.json';

/**
 * Load compression configuration from project
 *
 * Behavior:
 * - If config file missing: return default config (no error)
 * - If config file exists but invalid JSON: return error
 * - If config file exists with invalid schema: return error
 * - If config file valid: return validated config with defaults applied
 *
 * @param projectPath - Absolute path to project root directory
 * @returns LoadResult with success/failure discriminated union
 *
 * @example
 * ```ts
 * const result = loadCompressionConfig('/path/to/project');
 * if (result.success) {
 *   console.log(result.config.compression.enabled); // true (default or from config)
 * } else {
 *   console.log(result.error.message); // Parse/validation error
 * }
 * ```
 */
export function loadCompressionConfig(projectPath: string): LoadResult {
  const configFilePath = join(projectPath, CONFIG_FILE_PATH);

  // Task 3.7: Missing config file returns defaults (graceful handling)
  if (!existsSync(configFilePath)) {
    return {
      success: true,
      config: DEFAULT_COMPRESSION_CONFIG,
    };
  }

  // Read file contents
  let rawContent: string;
  try {
    rawContent = readFileSync(configFilePath, 'utf-8');
  } catch (readError) {
    // File exists but cannot be read (permissions, etc.)
    const message =
      readError instanceof Error
        ? `Failed to read config file: ${readError.message}`
        : 'Failed to read config file';
    return {
      success: false,
      error: {
        code: CliErrorCode.E_INVALID_CONFIG,
        message,
      },
    };
  }

  // Parse JSON
  let parsedConfig: unknown;
  try {
    parsedConfig = JSON.parse(rawContent);
  } catch (parseError) {
    // Invalid JSON
    const message =
      parseError instanceof Error
        ? `Invalid JSON in config file: ${parseError.message}`
        : 'Invalid JSON in config file';
    return {
      success: false,
      error: {
        code: CliErrorCode.E_INVALID_CONFIG,
        message,
      },
    };
  }

  // Validate using validation module
  const validationResult: ValidationResult = validateCompressionConfig(parsedConfig);

  if (!validationResult.success) {
    // Validation failed - return error with context
    // TypeScript narrowing: validationResult is ValidationFailure here
    const failed = validationResult as ValidationFailure;
    return {
      success: false,
      error: {
        code: CliErrorCode.E_INVALID_CONFIG,
        message: `Config validation failed: ${failed.error.message}`,
      },
    };
  }

  // Return validated config
  return {
    success: true,
    config: validationResult.config,
  };
}

// ============================================================================
// Task 3.1-3.3: Full Config Loading (Compression + NamingRules)
// ============================================================================

/**
 * Result of loading full config when successful
 */
export interface FullLoadSuccess {
  success: true;
  config: CompressionConfig;
  /** Merged naming rules (defaults + user rules) */
  namingRules: NamingRule[];
}

/**
 * Result of loading full config when failed
 */
export interface FullLoadFailure {
  success: false;
  error: {
    code: CliErrorCode.E_INVALID_CONFIG;
    message: string;
  };
}

/**
 * Full config loading result (discriminated union)
 */
export type FullLoadResult = FullLoadSuccess | FullLoadFailure;

/**
 * Load full configuration including naming rules
 *
 * Behavior:
 * - If config file missing: return default config + default naming rules
 * - If config file exists but invalid JSON: return error
 * - If config file exists with invalid schema: return error
 * - If config file valid: return validated config + merged naming rules
 *
 * @param projectPath - Absolute path to project root directory
 * @returns FullLoadResult with success/failure discriminated union
 *
 * @example
 * ```ts
 * const result = loadFullConfig('/path/to/project');
 * if (result.success) {
 *   console.log(result.config.compression.enabled); // true
 *   console.log(result.namingRules.length); // 12 (defaults) + user rules
 * }
 * ```
 */
export function loadFullConfig(projectPath: string): FullLoadResult {
  const configFilePath = join(projectPath, CONFIG_FILE_PATH);

  // Task 3.7: Missing config file returns defaults
  if (!existsSync(configFilePath)) {
    return {
      success: true,
      config: DEFAULT_COMPRESSION_CONFIG,
      namingRules: DEFAULT_MERGED_NAMING_RULES,
    };
  }

  // Read file contents
  let rawContent: string;
  try {
    rawContent = readFileSync(configFilePath, 'utf-8');
  } catch (readError) {
    const message =
      readError instanceof Error
        ? `Failed to read config file: ${readError.message}`
        : 'Failed to read config file';
    return {
      success: false,
      error: {
        code: CliErrorCode.E_INVALID_CONFIG,
        message,
      },
    };
  }

  // Parse JSON
  let parsedConfig: unknown;
  try {
    parsedConfig = JSON.parse(rawContent);
  } catch (parseError) {
    const message =
      parseError instanceof Error
        ? `Invalid JSON in config file: ${parseError.message}`
        : 'Invalid JSON in config file';
    return {
      success: false,
      error: {
        code: CliErrorCode.E_INVALID_CONFIG,
        message,
      },
    };
  }

  // Validate using full validation
  const validationResult: FullValidationResult = validateFullConfig(parsedConfig);

  if (!validationResult.success) {
    // TypeScript narrowing: validationResult is FullValidationFailure here
    const failed = validationResult as FullValidationFailure;
    return {
      success: false,
      error: {
        code: CliErrorCode.E_INVALID_CONFIG,
        message: `Config validation failed: ${failed.error.message}`,
      },
    };
  }

  // Merge naming rules (defaults + user rules)
  const mergedNamingRules = mergeNamingRules(validationResult.namingRules);

  return {
    success: true,
    config: validationResult.config,
    namingRules: mergedNamingRules,
  };
}