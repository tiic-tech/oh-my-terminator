#!/usr/bin/env node
import { cac } from 'cac';
import { analyzeCommand, updateCommand } from '../src/cli/commands/index.js';
import { formatAnalyzeJson, formatUpdateJson, formatErrorJson } from '../src/cli/output/json-formatter.js';
import { formatAnalyzeText, formatUpdateText, formatErrorText } from '../src/cli/output/text-formatter.js';
import type { AnalyzeResult, UpdateResult, CliError } from '../src/types.js';
import { CliErrorCode } from '../src/types.js';

const cli = cac('codegraph');

// Global option
cli.option('--json', 'Output in JSON format');

// analyze command
cli.command('analyze [cwd]', 'Run full analysis and save baseline')
  .action(async (cwd?: string, options?: { json?: boolean }) => {
    const workDir = cwd || process.cwd();
    try {
      const result = await analyzeCommand(workDir, options || {});
      output(result, options?.json);
    } catch (error) {
      outputError(error, options?.json);
    }
  });

// update command
cli.command('update [cwd]', 'Run incremental update based on git changes')
  .action(async (cwd?: string, options?: { json?: boolean }) => {
    const workDir = cwd || process.cwd();
    try {
      const result = await updateCommand(workDir, options || {});
      output(result, options?.json);
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