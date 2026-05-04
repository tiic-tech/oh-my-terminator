#!/usr/bin/env node
import { cac } from 'cac';
import { analyzeCommand, updateCommand, migrateCommand } from '../src/cli/commands/index.js';
import { formatAnalyzeJson, formatUpdateJson, formatMigrateJson, formatErrorJson } from '../src/cli/output/json-formatter.js';
import { formatAnalyzeText, formatUpdateText, formatMigrateText, formatErrorText } from '../src/cli/output/text-formatter.js';
import type { AnalyzeResult, UpdateResult, MigrateResult, CliError } from '../src/types.js';
import { CliErrorCode } from '../src/types.js';

const cli = cac('codegraph');

// Global option
cli.option('--json', 'Output in JSON format');

// analyze command (6.1-6.3: compression flags)
cli.command('analyze [cwd]', 'Run full analysis and save baseline')
  .option('--compress', 'Enable compression (default: true)')
  .option('--no-compression', 'Disable compression (save as 1.0 format)')
  .action(async (cwd?: string, options?: { json?: boolean; compress?: boolean }) => {
    const workDir = cwd || process.cwd();
    // Handle --no-compression flag (cac converts to noCompression: true)
    const compress = 'noCompression' in (options || {}) ? false : options?.compress ?? true;
    try {
      const result = await analyzeCommand(workDir, { ...options, compress });
      output(result, options?.json);
    } catch (error) {
      outputError(error, options?.json);
    }
  });

// update command (6.11-6.12: compression flags)
cli.command('update [cwd]', 'Run incremental update based on git changes')
  .option('--compress', 'Enable compression (default: true)')
  .option('--no-compression', 'Disable compression (save as 1.0 format)')
  .action(async (cwd?: string, options?: { json?: boolean; compress?: boolean }) => {
    const workDir = cwd || process.cwd();
    const compress = 'noCompression' in (options || {}) ? false : options?.compress ?? true;
    try {
      const result = await updateCommand(workDir, { ...options, compress });
      output(result, options?.json);
    } catch (error) {
      outputError(error, options?.json);
    }
  });

// migrate command (6.4-6.7)
cli.command('migrate', 'Migrate baseline from 1.0 to 1.1 format')
  .option('--input <path>', 'Input baseline file path')
  .option('--output <path>', 'Output baseline file path')
  .action(async (options?: { json?: boolean; input?: string; output?: string }) => {
    if (!options?.input || !options?.output) {
      outputError(new Error('Both --input and --output paths are required'), options?.json);
      return;
    }
    try {
      const result = await migrateCommand({
        input: options.input,
        output: options.output,
        json: options?.json,
      });
      outputMigrate(result, options?.json);
    } catch (error) {
      outputError(error, options?.json);
    }
  });

// Help
cli.help();

// Parse
cli.parse();

function output(result: AnalyzeResult | UpdateResult, json?: boolean): void {
  if (json) {
    if ('baseline' in result) {
      // AnalyzeResult
      console.log(formatAnalyzeJson(result as AnalyzeResult));
    } else {
      // UpdateResult
      console.log(formatUpdateJson(result as UpdateResult));
    }
  } else {
    if ('baseline' in result) {
      // AnalyzeResult
      console.log(formatAnalyzeText(result as AnalyzeResult));
    } else {
      // UpdateResult
      console.log(formatUpdateText(result as UpdateResult));
    }
  }
}

function outputMigrate(result: MigrateResult, json?: boolean): void {
  if (json) {
    console.log(formatMigrateJson(result));
  } else {
    console.log(formatMigrateText(result));
  }
}

function outputError(error: unknown, json?: boolean): void {
  const cliError: CliError = {
    success: false,
    error: { code: CliErrorCode.E_PARSE_FAILED, message: String(error) },
    durationMs: 0
  };

  if (json) {
    console.log(formatErrorJson(cliError));
  } else {
    console.error(formatErrorText(cliError));
  }
}