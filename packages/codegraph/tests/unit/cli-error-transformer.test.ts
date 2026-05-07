/**
 * Unit tests for CLI error transformer
 *
 * Tests error transformation, suggestion generation, and path format detection.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cac } from 'cac';
import {
  transformCACError,
  createUnknownCommandError,
  createTargetNotFoundError,
  isCACError,
  getAvailableCommands,
  getAvailableFlags,
} from '../../src/cli/error-transformer.js';
import { CliErrorCode } from '../../src/types.js';

describe('Error Transformer', () => {
  describe('isCACError', () => {
    it('should return true for CACError', () => {
      const cacError = new Error('Unknown option `--invalid`');
      cacError.name = 'CACError';
      assert.strictEqual(isCACError(cacError), true);
    });

    it('should return false for regular Error', () => {
      const regularError = new Error('Some error');
      assert.strictEqual(isCACError(regularError), false);
    });

    it('should return false for non-Error', () => {
      assert.strictEqual(isCACError('string'), false);
      assert.strictEqual(isCACError(null), false);
      assert.strictEqual(isCACError(undefined), false);
    });
  });

  describe('getAvailableCommands', () => {
    it('should return available commands from CLI', () => {
      const cli = cac('test');
      cli.command('analyze', 'Run analysis');
      cli.command('scope', 'Query scope');
      cli.command('impact', 'Find impact');
      cli.help();

      const commands = getAvailableCommands(cli);
      assert.ok(commands.includes('analyze'));
      assert.ok(commands.includes('scope'));
      assert.ok(commands.includes('impact'));
    });

    it('should filter built-in commands', () => {
      const cli = cac('test');
      cli.command('analyze', 'Run analysis');
      cli.help();

      const commands = getAvailableCommands(cli);
      assert.ok(!commands.includes('help'));
      assert.ok(!commands.includes('version'));
    });

    it('should return commands sorted alphabetically', () => {
      const cli = cac('test');
      cli.command('zebra', 'Z command');
      cli.command('alpha', 'A command');
      cli.command('middle', 'M command');

      const commands = getAvailableCommands(cli);
      assert.deepStrictEqual(commands, ['alpha', 'middle', 'zebra']);
    });
  });

  describe('getAvailableFlags', () => {
    it('should return available flags from command', () => {
      const cli = cac('test');
      const cmd = cli.command('analyze', 'Run analysis')
        .option('--json', 'JSON output')
        .option('--verbose', 'Verbose mode');

      const flags = getAvailableFlags(cmd);
      assert.ok(flags.includes('--json'));
      assert.ok(flags.includes('--verbose'));
    });

    it('should return flags sorted alphabetically', () => {
      const cli = cac('test');
      const cmd = cli.command('test', 'Test')
        .option('--zebra', 'Z flag')
        .option('--alpha', 'A flag');

      const flags = getAvailableFlags(cmd);
      assert.deepStrictEqual(flags, ['--alpha', '--zebra']);
    });
  });

  describe('transformCACError', () => {
    it('should transform unknown option error', () => {
      const cli = cac('test');
      const cmd = cli.command('analyze', 'Run analysis')
        .option('--json', 'JSON output');

      const cacError = new Error('Unknown option `--invalid`');
      cacError.name = 'CACError';

      const result = transformCACError(cacError, cli, cmd, 0);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error.code, CliErrorCode.E_CLI_UNKNOWN_FLAG);
      assert.ok(result.error.message.includes('--invalid'));
    });

    it('should transform missing option value error', () => {
      const cli = cac('test');
      const cmd = cli.command('analyze', 'Run analysis')
        .option('--input <file>', 'Input file');

      const cacError = new Error('option `--input` value is missing');
      cacError.name = 'CACError';

      const result = transformCACError(cacError, cli, cmd, 0);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error.code, CliErrorCode.E_CLI_MISSING_ARG);
      assert.ok(result.error.message.includes('--input'));
    });

    it('should transform missing required args error', () => {
      const cli = cac('test');
      const cmd = cli.command('scope <target>', 'Query scope');

      const cacError = new Error('missing required args for command `scope`');
      cacError.name = 'CACError';

      const result = transformCACError(cacError, cli, cmd, 0);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error.code, CliErrorCode.E_CLI_MISSING_ARG);
      assert.ok(result.error.message.includes('scope'));
    });

    it('should fallback to internal error for unrecognized CACError', () => {
      const cli = cac('test');
      const cacError = new Error('Some unknown CAC error');
      cacError.name = 'CACError';

      const result = transformCACError(cacError, cli, undefined, 0);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error.code, CliErrorCode.E_CLI_INTERNAL);
      assert.strictEqual(result.error.debug, 'Some unknown CAC error');
    });

    it('should include durationMs from startTime', () => {
      const cli = cac('test');
      const cacError = new Error('Unknown option `--invalid`');
      cacError.name = 'CACError';

      const startTime = Date.now() - 100;
      const result = transformCACError(cacError, cli, undefined, startTime);

      assert.ok(result.durationMs >= 100);
    });
  });

  describe('createUnknownCommandError', () => {
    it('should create error with available commands suggestion', () => {
      const cli = cac('test');
      cli.command('analyze', 'Run analysis');
      cli.command('scope', 'Query scope');

      const result = createUnknownCommandError('xyz', cli, 0);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error.code, CliErrorCode.E_CLI_UNKNOWN_COMMAND);
      assert.ok(result.error.message.includes('xyz'));
      assert.ok(result.error.suggestion?.includes('analyze'));
    });

    it('should suggest similar command if found', () => {
      const cli = cac('test');
      cli.command('analyze', 'Run analysis');

      const result = createUnknownCommandError('ana', cli, 0);

      assert.strictEqual(result.success, false);
      assert.ok(result.error.suggestion?.includes('analyze'));
    });
  });

  describe('createTargetNotFoundError', () => {
    it('should create error with path hint for monorepo', () => {
      const result = createTargetNotFoundError('src/utils.ts', '/project', true, 0);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error.code, CliErrorCode.E_CLI_TARGET_NOT_FOUND);
      assert.ok(result.error.message.includes('src/utils.ts'));
      assert.ok(result.error.suggestion?.includes('packages'));
    });

    it('should not show hint if path matches monorepo format', () => {
      const result = createTargetNotFoundError('packages/codegraph/src/utils.ts', '/project', true, 0);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error.suggestion, undefined);
    });

    it('should not show hint for non-monorepo', () => {
      const result = createTargetNotFoundError('src/utils.ts', '/project', false, 0);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error.suggestion, undefined);
    });
  });
});