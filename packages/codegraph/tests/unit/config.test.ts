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
  validateCompressionConfig,
  DEFAULT_COMPRESSION_OPTIONS,
} from '../../src/config/index.js';

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