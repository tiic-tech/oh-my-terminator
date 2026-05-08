/**
 * Configuration validation module (Tasks 3.4-3.6)
 *
 * Validates CompressionConfig and provides default values.
 *
 * WHY: Schema is the truth. Validation flows from schema.
 * One definition for defaults, used by both validation and loading.
 *
 * @see coding-taste skill - "One Truth, Not Two"
 */

import type { CompressionOptions, CompressionConfig } from '../types.js';
import { CliErrorCode } from '../types.js';
import type { NamingRule } from '../api/layers/inference/naming-rules.js';
import {
  type NamingRulesValidationResult,
  validateNamingRules,
} from './naming-rules-config.js';

// ============================================================================
// Task 3.1: Full Config Schema (Combined Compression + NamingRules)
// ============================================================================

/**
 * Full configuration schema combining compression and naming rules
 *
 * WHY: Single source of truth for all config options.
 * Naming rules are optional - user can omit and get defaults.
 *
 * @see design.md Decision 4 - namingRules field added to config schema
 */
export interface CodeGraphConfig {
  /** Compression options (required) */
  compression: CompressionOptions;
  /** Optional naming rules for layer inference (merged with defaults) */
  namingRules?: NamingRule[];
}

// ============================================================================
// Task 3.6: Default Compression Options
// ============================================================================

/**
 * Default compression options
 *
 * WHY: Centralized defaults prevent duplication across loading and validation.
 * Default values optimized for Agent token budgets while preserving essential context.
 *
 * @see design.md D2: JSDoc truncation to 100 characters
 */
export const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  enabled: true,
  jsDocMaxLength: 100,
};

/**
 * Default compression config (wraps options)
 */
export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  compression: DEFAULT_COMPRESSION_OPTIONS,
};

// ============================================================================
// Task 3.4-3.5: Validation Result Types
// ============================================================================

/**
 * Result of validation when successful
 */
export interface ValidationSuccess {
  success: true;
  config: CompressionConfig;
}

/**
 * Result of validation when failed
 *
 * WHY: Discriminated union enables type narrowing.
 * success: false guarantees error field exists.
 */
export interface ValidationFailure {
  success: false;
  error: {
    code: CliErrorCode.E_INVALID_CONFIG;
    message: string;
  };
}

/**
 * Validation result (discriminated union)
 */
export type ValidationResult = ValidationSuccess | ValidationFailure;

// ============================================================================
// Task 3.4-3.5: Validation Function
// ============================================================================

/**
 * Validate compression configuration
 *
 * Validates that:
 * - compression.enabled is boolean (required)
 * - compression.jsDocMaxLength is positive number (optional, defaults to 100)
 *
 * @param config - Unknown config object to validate
 * @returns ValidationResult with success/failure discriminated union
 *
 * @example
 * ```ts
 * const result = validateCompressionConfig({ compression: { enabled: true } });
 * if (result.success) {
 *   console.log(result.config.compression.enabled); // true
 * } else {
 *   console.log(result.error.message); // Validation error
 * }
 * ```
 */
export function validateCompressionConfig(config: unknown): ValidationResult {
  // Null/undefined check
  if (config === null || config === undefined) {
    return {
      success: false,
      error: {
        code: CliErrorCode.E_INVALID_CONFIG,
        message: 'Configuration is null or undefined',
      },
    };
  }

  // Object type check
  if (typeof config !== 'object') {
    return {
      success: false,
      error: {
        code: CliErrorCode.E_INVALID_CONFIG,
        message: `Configuration must be an object, got ${typeof config}`,
      },
    };
  }

  // Safe cast after type check
  const cfg = config as Record<string, unknown>;

  // compression field check
  if (!('compression' in cfg)) {
    return {
      success: false,
      error: {
        code: CliErrorCode.E_INVALID_CONFIG,
        message: 'Configuration missing required "compression" field',
      },
    };
  }

  const compression = cfg.compression;

  // compression must be object
  if (typeof compression !== 'object' || compression === null) {
    return {
      success: false,
      error: {
        code: CliErrorCode.E_INVALID_CONFIG,
        message: '"compression" field must be an object',
      },
    };
  }

  const comp = compression as Record<string, unknown>;

  // enabled field check (required)
  if (!('enabled' in comp)) {
    return {
      success: false,
      error: {
        code: CliErrorCode.E_INVALID_CONFIG,
        message: 'Configuration missing required "compression.enabled" field',
      },
    };
  }

  // enabled must be boolean
  if (typeof comp.enabled !== 'boolean') {
    return {
      success: false,
      error: {
        code: CliErrorCode.E_INVALID_CONFIG,
        message: `"compression.enabled" must be boolean, got ${typeof comp.enabled}`,
      },
    };
  }

  // jsDocMaxLength check (optional)
  if ('jsDocMaxLength' in comp) {
    const jsDocMaxLength = comp.jsDocMaxLength;

    // Must be number
    if (typeof jsDocMaxLength !== 'number') {
      return {
        success: false,
        error: {
          code: CliErrorCode.E_INVALID_CONFIG,
          message: `"compression.jsDocMaxLength" must be number, got ${typeof jsDocMaxLength}`,
        },
      };
    }

    // Must be positive (greater than 0)
    if (jsDocMaxLength <= 0) {
      return {
        success: false,
        error: {
          code: CliErrorCode.E_INVALID_CONFIG,
          message: `"compression.jsDocMaxLength" must be positive number, got ${jsDocMaxLength}`,
        },
      };
    }

    // Must be integer (reasonable constraint)
    if (!Number.isInteger(jsDocMaxLength)) {
      return {
        success: false,
        error: {
          code: CliErrorCode.E_INVALID_CONFIG,
          message: `"compression.jsDocMaxLength" must be integer, got ${jsDocMaxLength}`,
        },
      };
    }
  }

  // Build validated config with defaults
  const validatedConfig: CompressionConfig = {
    compression: {
      enabled: comp.enabled,
      jsDocMaxLength: (comp.jsDocMaxLength as number | undefined) ?? DEFAULT_COMPRESSION_OPTIONS.jsDocMaxLength,
    },
  };

  return {
    success: true,
    config: validatedConfig,
  };
}

// ============================================================================
// Task 3.2: Full Config Validation (Compression + NamingRules)
// ============================================================================

/**
 * Full config validation result with naming rules
 */
export interface FullValidationSuccess {
  success: true;
  config: CompressionConfig;
  /** Validated naming rules (empty if no config) */
  namingRules: NamingRule[];
}

export interface FullValidationFailure {
  success: false;
  error: {
    code: CliErrorCode.E_INVALID_CONFIG;
    message: string;
  };
}

export type FullValidationResult = FullValidationSuccess | FullValidationFailure;

/**
 * Validate full configuration including naming rules
 *
 * WHY: Single validation entry point for all config options.
 * Naming rules are validated separately and returned even if some are invalid.
 *
 * @param config - Unknown config object to validate
 * @returns FullValidationResult with config and naming rules
 *
 * @example
 * ```ts
 * const result = validateFullConfig({
 *   compression: { enabled: true },
 *   namingRules: [{ pattern: '^api$', role: 'API Layer', priority: 15 }]
 * });
 * if (result.success) {
 *   console.log(result.config.compression.enabled); // true
 *   console.log(result.namingRules.length); // 1 + defaults
 * }
 * ```
 */
export function validateFullConfig(config: unknown): FullValidationResult {
  // First validate compression config (required)
  const compressionResult = validateCompressionConfig(config);

  if (!compressionResult.success) {
    // Return FullValidationFailure (same structure as ValidationFailure)
    // TypeScript narrowing: compressionResult is ValidationFailure here
    const failed = compressionResult as ValidationFailure;
    return {
      success: false,
      error: failed.error,
    };
  }

  // Validate naming rules (optional)
  const cfg = config as Record<string, unknown>;
  let namingRules: NamingRule[] = [];

  if ('namingRules' in cfg) {
    const rulesResult: NamingRulesValidationResult = validateNamingRules(cfg.namingRules);
    namingRules = rulesResult.validRules;
    // Invalid rules already logged via console.warn in validateNamingRules
  }

  return {
    success: true,
    config: compressionResult.config,
    namingRules,
  };
}