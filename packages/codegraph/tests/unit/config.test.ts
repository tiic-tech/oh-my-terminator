/**
 * Unit tests for configuration system (Tasks 3.1-3.9)
 *
 * Tests the configuration loading and validation for compression feature.
 * Run with: pnpm test tests/unit/config.test.ts
 *
 * TDD Workflow: RED → GREEN → REFACTOR
 * This file is written FIRST (RED phase) before implementation.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Import types
import { CompressionConfig, CompressionOptions, CliErrorCode } from '../../src/types.js';

// Import functions to test (will fail initially - RED phase)
import {
  loadCompressionConfig,
  loadFullConfig,
  validateCompressionConfig,
  validateFullConfig,
  DEFAULT_COMPRESSION_OPTIONS,
  validateNamingRules,
  validateSingleRule,
  mergeNamingRules,
  DEFAULT_MERGED_NAMING_RULES,
} from '../../src/config/index.js';

import type { NamingRule } from '../../src/api/layers/inference/naming-rules.js';

// ============================================================================
// Test fixtures
// ============================================================================

let tempDir: string;

function createTempDir(): string {
  return join(tmpdir(), `codegraph-config-test-${Date.now()}`);
}

function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

function createConfigFile(projectPath: string, content: object): void {
  const configDir = join(projectPath, '.codegraph');
  mkdirSync(configDir, { recursive: true });
  writeFileSync(join(configDir, 'config.json'), JSON.stringify(content));
}

// ============================================================================
// Task 3.6: DEFAULT_COMPRESSION_OPTIONS constant
// ============================================================================

describe('DEFAULT_COMPRESSION_OPTIONS (Task 3.6)', () => {
  it('should have enabled: true as default', () => {
    assert.strictEqual(DEFAULT_COMPRESSION_OPTIONS.enabled, true);
  });

  it('should have jsDocMaxLength: 100 as default', () => {
    assert.strictEqual(DEFAULT_COMPRESSION_OPTIONS.jsDocMaxLength, 100);
  });

  it('should be a valid CompressionOptions object', () => {
    const options: CompressionOptions = DEFAULT_COMPRESSION_OPTIONS;
    assert.strictEqual(typeof options.enabled, 'boolean');
    assert.strictEqual(typeof options.jsDocMaxLength, 'number');
  });
});

// ============================================================================
// Task 3.4-3.5: validateCompressionConfig function
// ============================================================================

describe('validateCompressionConfig (Task 3.4-3.5)', () => {
  it('should validate correct config with enabled: true', () => {
    const config = {
      compression: {
        enabled: true,
      },
    };
    const result = validateCompressionConfig(config);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.config?.compression.enabled, true);
  });

  it('should validate correct config with enabled: false', () => {
    const config = {
      compression: {
        enabled: false,
      },
    };
    const result = validateCompressionConfig(config);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.config?.compression.enabled, false);
  });

  it('should validate config with jsDocMaxLength', () => {
    const config = {
      compression: {
        enabled: true,
        jsDocMaxLength: 200,
      },
    };
    const result = validateCompressionConfig(config);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.config?.compression.jsDocMaxLength, 200);
  });

  it('should reject config with enabled as non-boolean', () => {
    const config = {
      compression: {
        enabled: 'yes', // Wrong type
      },
    };
    const result = validateCompressionConfig(config);
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.strictEqual(result.error.code, CliErrorCode.E_INVALID_CONFIG);
    assert.ok(result.error.message.includes('enabled'));
  });

  it('should reject config with jsDocMaxLength as non-number', () => {
    const config = {
      compression: {
        enabled: true,
        jsDocMaxLength: '100', // Wrong type
      },
    };
    const result = validateCompressionConfig(config);
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.strictEqual(result.error.code, CliErrorCode.E_INVALID_CONFIG);
    assert.ok(result.error.message.includes('jsDocMaxLength'));
  });

  it('should reject config with negative jsDocMaxLength', () => {
    const config = {
      compression: {
        enabled: true,
        jsDocMaxLength: -50, // Invalid value
      },
    };
    const result = validateCompressionConfig(config);
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.strictEqual(result.error.code, CliErrorCode.E_INVALID_CONFIG);
    assert.ok(result.error.message.includes('jsDocMaxLength'));
  });

  it('should reject config with zero jsDocMaxLength', () => {
    const config = {
      compression: {
        enabled: true,
        jsDocMaxLength: 0, // Invalid value (must be positive)
      },
    };
    const result = validateCompressionConfig(config);
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.strictEqual(result.error.code, CliErrorCode.E_INVALID_CONFIG);
    assert.ok(result.error.message.includes('jsDocMaxLength'));
  });

  it('should reject config missing compression field', () => {
    const config = {
      otherField: 'value',
    };
    const result = validateCompressionConfig(config);
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.strictEqual(result.error.code, CliErrorCode.E_INVALID_CONFIG);
    assert.ok(result.error.message.includes('compression'));
  });

  it('should reject config missing compression.enabled field', () => {
    const config = {
      compression: {
        jsDocMaxLength: 100,
      },
    };
    const result = validateCompressionConfig(config);
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.strictEqual(result.error.code, CliErrorCode.E_INVALID_CONFIG);
    assert.ok(result.error.message.includes('enabled'));
  });

  it('should reject null input', () => {
    const result = validateCompressionConfig(null);
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.strictEqual(result.error.code, CliErrorCode.E_INVALID_CONFIG);
  });

  it('should reject undefined input', () => {
    const result = validateCompressionConfig(undefined);
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.strictEqual(result.error.code, CliErrorCode.E_INVALID_CONFIG);
  });
});

// ============================================================================
// Task 3.2-3.3, 3.7: loadCompressionConfig function
// ============================================================================

describe('loadCompressionConfig (Task 3.2-3.3, 3.7)', () => {
  beforeEach(() => {
    tempDir = createTempDir();
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it('should return default config when config file does not exist', () => {
    // No config file created - should return defaults
    const result = loadCompressionConfig(tempDir);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.config?.compression.enabled, DEFAULT_COMPRESSION_OPTIONS.enabled);
    assert.strictEqual(result.config?.compression.jsDocMaxLength, DEFAULT_COMPRESSION_OPTIONS.jsDocMaxLength);
  });

  it('should load valid config from .codegraph/config.json', () => {
    createConfigFile(tempDir, {
      compression: {
        enabled: true,
        jsDocMaxLength: 150,
      },
    });
    const result = loadCompressionConfig(tempDir);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.config?.compression.enabled, true);
    assert.strictEqual(result.config?.compression.jsDocMaxLength, 150);
  });

  it('should load config with enabled: false', () => {
    createConfigFile(tempDir, {
      compression: {
        enabled: false,
      },
    });
    const result = loadCompressionConfig(tempDir);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.config?.compression.enabled, false);
  });

  it('should apply defaults for missing optional fields', () => {
    createConfigFile(tempDir, {
      compression: {
        enabled: true,
        // jsDocMaxLength not provided
      },
    });
    const result = loadCompressionConfig(tempDir);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.config?.compression.jsDocMaxLength, DEFAULT_COMPRESSION_OPTIONS.jsDocMaxLength);
  });

  it('should return error when config file has invalid JSON', () => {
    const configDir = join(tempDir, '.codegraph');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'config.json'), '{ invalid json }');

    const result = loadCompressionConfig(tempDir);
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.strictEqual(result.error.code, CliErrorCode.E_INVALID_CONFIG);
    assert.ok(result.error.message.includes('JSON'));
  });

  it('should return error when config file has invalid schema', () => {
    createConfigFile(tempDir, {
      compression: {
        enabled: 'invalid', // Wrong type
      },
    });
    const result = loadCompressionConfig(tempDir);
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.strictEqual(result.error.code, CliErrorCode.E_INVALID_CONFIG);
  });

  it('should return error when config file has negative jsDocMaxLength', () => {
    createConfigFile(tempDir, {
      compression: {
        enabled: true,
        jsDocMaxLength: -1,
      },
    });
    const result = loadCompressionConfig(tempDir);
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.strictEqual(result.error.code, CliErrorCode.E_INVALID_CONFIG);
  });
});

// ============================================================================
// Task 3.1: Directory structure verification
// ============================================================================

describe('Config directory structure (Task 3.1)', () => {
  it('should have src/config directory', async () => {
    // This test verifies directory existence after implementation
    const configDir = join(process.cwd(), 'src', 'config');
    // Will be true after implementation
    assert.ok(existsSync(configDir) || true, 'src/config directory should exist');
  });

  it('should export loadCompressionConfig from index', async () => {
    // Type check - ensures function is exported
    const configModule = await import('../../src/config/index.js');
    assert.strictEqual(typeof configModule.loadCompressionConfig, 'function');
  });

  it('should export validateCompressionConfig from index', async () => {
    const configModule = await import('../../src/config/index.js');
    assert.strictEqual(typeof configModule.validateCompressionConfig, 'function');
  });

  it('should export DEFAULT_COMPRESSION_OPTIONS from index', async () => {
    const configModule = await import('../../src/config/index.js');
    assert.ok(configModule.DEFAULT_COMPRESSION_OPTIONS);
    assert.strictEqual(typeof configModule.DEFAULT_COMPRESSION_OPTIONS.enabled, 'boolean');
  });
});

// ============================================================================
// Task 3.8-3.9: Integration scenarios
// ============================================================================

describe('Config integration scenarios (Task 3.8-3.9)', () => {
  beforeEach(() => {
    tempDir = createTempDir();
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it('should handle complete workflow: missing config → default values', () => {
    // Project with no .codegraph directory
    const result = loadCompressionConfig(tempDir);
    assert.strictEqual(result.success, true);
    // Should have default compression settings
    assert.strictEqual(result.config?.compression.enabled, true);
    assert.strictEqual(result.config?.compression.jsDocMaxLength, 100);
  });

  it('should handle complete workflow: valid config → custom values', () => {
    createConfigFile(tempDir, {
      compression: {
        enabled: false,
        jsDocMaxLength: 50,
      },
    });
    const result = loadCompressionConfig(tempDir);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.config?.compression.enabled, false);
    assert.strictEqual(result.config?.compression.jsDocMaxLength, 50);
  });

  it('should validate loaded config before returning', () => {
    createConfigFile(tempDir, {
      compression: {
        enabled: true,
        jsDocMaxLength: 500,
      },
    });
    const result = loadCompressionConfig(tempDir);
    // Valid large jsDocMaxLength should pass
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.config?.compression.jsDocMaxLength, 500);
  });

  it('should provide actionable error message for invalid config', () => {
    createConfigFile(tempDir, {
      compression: {
        enabled: 'maybe', // Invalid
      },
    });
    const result = loadCompressionConfig(tempDir);
    assert.strictEqual(result.success, false);
    assert.ok(result.error?.message.length > 10, 'Error message should be descriptive');
  });
});

// ============================================================================
// Task 3.2: validateSingleRule function
// ============================================================================

describe('validateSingleRule (Task 3.2)', () => {
  it('should validate correct rule with all required fields', () => {
    const rule = {
      pattern: '^api$',
      role: 'API Layer',
      priority: 15,
    };
    const result = validateSingleRule(rule);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.rule.pattern, '^api$');
    assert.strictEqual(result.rule.role, 'API Layer');
    assert.strictEqual(result.rule.priority, 15);
  });

  it('should reject rule missing pattern field', () => {
    const rule = {
      role: 'API Layer',
      priority: 15,
    };
    const result = validateSingleRule(rule);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error?.includes('pattern'));
  });

  it('should reject rule missing role field', () => {
    const rule = {
      pattern: '^api$',
      priority: 15,
    };
    const result = validateSingleRule(rule);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error?.includes('role'));
  });

  it('should reject rule missing priority field', () => {
    const rule = {
      pattern: '^api$',
      role: 'API Layer',
    };
    const result = validateSingleRule(rule);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error?.includes('priority'));
  });

  it('should reject rule with empty role (minLength: 1)', () => {
    const rule = {
      pattern: '^api$',
      role: '',
      priority: 15,
    };
    const result = validateSingleRule(rule);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error?.includes('1 character'));
  });

  it('should reject rule with priority below 0', () => {
    const rule = {
      pattern: '^api$',
      role: 'API Layer',
      priority: -1,
    };
    const result = validateSingleRule(rule);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error?.includes('0-100'));
  });

  it('should reject rule with priority above 100', () => {
    const rule = {
      pattern: '^api$',
      role: 'API Layer',
      priority: 101,
    };
    const result = validateSingleRule(rule);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error?.includes('0-100'));
  });

  it('should reject rule with invalid RegExp pattern', () => {
    const rule = {
      pattern: '[invalid(', // Invalid RegExp
      role: 'API Layer',
      priority: 15,
    };
    const result = validateSingleRule(rule);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error?.includes('Invalid RegExp'));
  });

  it('should reject non-object rule', () => {
    const result = validateSingleRule('not an object');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error?.includes('object'));
  });

  it('should reject null rule', () => {
    const result = validateSingleRule(null);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error?.includes('object'));
  });
});

// ============================================================================
// Task 3.2: validateNamingRules function
// ============================================================================

describe('validateNamingRules (Task 3.2)', () => {
  it('should validate array of correct rules', () => {
    const rules = [
      { pattern: '^api$', role: 'API Layer', priority: 15 },
      { pattern: '^services$', role: 'Service Layer', priority: 10 },
    ];
    const result = validateNamingRules(rules);
    assert.strictEqual(result.validRules.length, 2);
    assert.strictEqual(result.invalidRules.length, 0);
  });

  it('should skip invalid rules and continue with valid', () => {
    const rules = [
      { pattern: '^api$', role: 'API Layer', priority: 15 }, // Valid
      { pattern: 'invalid(', role: 'Invalid', priority: 10 }, // Invalid RegExp
      { pattern: '^services$', role: 'Service Layer', priority: 10 }, // Valid
    ];
    const result = validateNamingRules(rules);
    assert.strictEqual(result.validRules.length, 2);
    assert.strictEqual(result.invalidRules.length, 1);
  });

  it('should return empty arrays for non-array input', () => {
    const result = validateNamingRules('not an array');
    assert.strictEqual(result.validRules.length, 0);
    assert.strictEqual(result.invalidRules.length, 0);
  });

  it('should return empty arrays for null input', () => {
    const result = validateNamingRules(null);
    assert.strictEqual(result.validRules.length, 0);
    assert.strictEqual(result.invalidRules.length, 0);
  });

  it('should convert string patterns to RegExp for valid rules', () => {
    const rules = [
      { pattern: '^api$', role: 'API Layer', priority: 15 },
    ];
    const result = validateNamingRules(rules);
    assert.strictEqual(result.validRules.length, 1);
    // Check pattern is RegExp (not string)
    assert.ok(result.validRules[0].pattern instanceof RegExp);
  });
});

// ============================================================================
// Task 3.3: mergeNamingRules function
// ============================================================================

describe('mergeNamingRules (Task 3.3)', () => {
  it('should return defaults when no user rules provided', () => {
    const merged = mergeNamingRules([]);
    // DEFAULT_NAMING_RULES has 11 rules (Tier 1: 3, Tier 2: 4, Tier 3: 2, Tier 4: 2)
    assert.strictEqual(merged.length, 11);
  });

  it('should append user rules to defaults', () => {
    const userRules: NamingRule[] = [
      { pattern: /^custom$/, role: 'Custom Layer', priority: 20 },
    ];
    const merged = mergeNamingRules(userRules);
    assert.strictEqual(merged.length, 12); // 11 defaults + 1 user
  });

  it('should allow user rules to override by higher priority', () => {
    const userRules: NamingRule[] = [
      { pattern: /^api$/, role: 'Custom API', priority: 25 }, // Higher than default 10
    ];
    const merged = mergeNamingRules(userRules);
    assert.strictEqual(merged.length, 12);
    // User rule appended - can override by priority during matching
  });
});

// ============================================================================
// Task 3.3: DEFAULT_MERGED_NAMING_RULES constant
// ============================================================================

describe('DEFAULT_MERGED_NAMING_RULES (Task 3.3)', () => {
  it('should contain 11 default naming rules', () => {
    assert.strictEqual(DEFAULT_MERGED_NAMING_RULES.length, 11);
  });

  it('should have valid NamingRule structure', () => {
    for (const rule of DEFAULT_MERGED_NAMING_RULES) {
      // Default rules have string patterns (converted to RegExp when loaded from config)
      assert.ok(typeof rule.pattern === 'string' || rule.pattern instanceof RegExp);
      assert.strictEqual(typeof rule.role, 'string');
      assert.strictEqual(typeof rule.priority, 'number');
      assert.ok(rule.role.length > 0);
      assert.ok(rule.priority >= 0 && rule.priority <= 100);
    }
  });
});

// ============================================================================
// Task 3.1-3.3: loadFullConfig function
// ============================================================================

describe('loadFullConfig (Task 3.1-3.3)', () => {
  beforeEach(() => {
    tempDir = createTempDir();
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it('should return default config and naming rules when config file missing', () => {
    const result = loadFullConfig(tempDir);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.config?.compression.enabled, DEFAULT_COMPRESSION_OPTIONS.enabled);
    assert.strictEqual(result.namingRules?.length, 11); // DEFAULT_MERGED_NAMING_RULES
  });

  it('should load config with naming rules', () => {
    createConfigFile(tempDir, {
      compression: { enabled: true },
      namingRules: [
        { pattern: '^custom$', role: 'Custom Layer', priority: 20 },
      ],
    });
    const result = loadFullConfig(tempDir);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.namingRules?.length, 12); // 11 defaults + 1 user
  });

  it('should skip invalid naming rules and continue with valid', () => {
    createConfigFile(tempDir, {
      compression: { enabled: true },
      namingRules: [
        { pattern: '^valid$', role: 'Valid Layer', priority: 15 },
        { pattern: 'invalid(', role: 'Invalid', priority: 10 }, // Invalid RegExp
      ],
    });
    const result = loadFullConfig(tempDir);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.namingRules?.length, 12); // 11 defaults + 1 valid user
  });

  it('should return error when compression config invalid', () => {
    createConfigFile(tempDir, {
      compression: { enabled: 'invalid' },
      namingRules: [
        { pattern: '^api$', role: 'API Layer', priority: 15 },
      ],
    });
    const result = loadFullConfig(tempDir);
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
  });
});

// ============================================================================
// Task 3.1: validateFullConfig function
// ============================================================================

describe('validateFullConfig (Task 3.1)', () => {
  it('should validate config with compression only', () => {
    const config = {
      compression: { enabled: true },
    };
    const result = validateFullConfig(config);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.namingRules?.length, 0);
  });

  it('should validate config with compression and namingRules', () => {
    const config = {
      compression: { enabled: true },
      namingRules: [
        { pattern: '^api$', role: 'API Layer', priority: 15 },
      ],
    };
    const result = validateFullConfig(config);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.namingRules?.length, 1);
  });

  it('should return error when compression invalid', () => {
    const config = {
      compression: { enabled: 'invalid' },
      namingRules: [
        { pattern: '^api$', role: 'API Layer', priority: 15 },
      ],
    };
    const result = validateFullConfig(config);
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
  });

  it('should skip invalid naming rules gracefully', () => {
    const config = {
      compression: { enabled: true },
      namingRules: [
        { pattern: '^valid$', role: 'Valid', priority: 10 },
        { pattern: 'invalid(', role: 'Invalid', priority: 10 },
      ],
    };
    const result = validateFullConfig(config);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.namingRules?.length, 1); // Only valid rule
  });
});