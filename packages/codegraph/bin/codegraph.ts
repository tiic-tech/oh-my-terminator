#!/usr/bin/env node
import { cac } from 'cac';
import { analyzeCommand, updateCommand, migrateCommand, impactCommand, scopeCommand, layersCommand } from '../src/cli/commands/index.js';
import { formatAnalyzeJson, formatUpdateJson, formatMigrateJson, formatErrorJson } from '../src/cli/output/json-formatter.js';
import { formatAnalyzeText, formatUpdateText, formatMigrateText, formatErrorText } from '../src/cli/output/text-formatter.js';
import { formatImpactJson, formatImpactText, formatImpactErrorJson, formatImpactErrorText } from '../src/cli/output/impact-formatter.js';
import { formatScopeJson, formatScopeText, formatScopeErrorJson, formatScopeErrorText } from '../src/cli/output/scope-formatter.js';
import { formatLayersJson, formatLayersText, formatLayersErrorJson, formatLayersErrorText } from '../src/cli/output/layers-formatter.js';
import type { AnalyzeResult, UpdateResult, MigrateResult, CliError } from '../src/types.js';
import type { ImpactResult, ImpactError, ScopeResult, ScopeError, LayersResult, LayersError } from '../src/api/types/index.js';
import { CliErrorCode } from '../src/types.js';

const cli = cac('codegraph');

// Global option
cli.option('--json', 'Output in JSON format');

// analyze command (6.1-6.3: compression flags)
cli.command('analyze [cwd]', 'Run full analysis and save baseline')
  .option('--compress', 'Enable compression (on by default)')
  .option('--no-compression', 'Disable compression (save as 1.0 format)')
  .example('codegraph analyze')
  .example('codegraph analyze --no-compression')
  .example('codegraph analyze /path/to/project --json')
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
  .option('--compress', 'Enable compression (on by default)')
  .option('--no-compression', 'Disable compression (save as 1.0 format)')
  .example('codegraph update')
  .example('codegraph update --no-compression')
  .example('codegraph update /path/to/project')
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
  .example('codegraph migrate --input baseline-1.0.json --output baseline.json')
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

// impact command
cli.command('impact <target> [cwd]', 'Find files impacted by changes to target')
  .option('--json', 'Output in JSON format')
  .option('--max-files <n>', 'Max files to show (default: 20)', { default: 20 })
  .option('--max-depth <n>', 'Max traversal depth (0=direct only)')
  .option('--include-tests', 'Include test files in results')
  .example('codegraph impact src/core.ts')
  .example('codegraph impact src/core.ts --max-files 50')
  .example('codegraph impact src/core.ts --include-tests')
  .action(async (target: string, cwd?: string, options?: { json?: boolean; maxFiles?: number; maxDepth?: number; includeTests?: boolean }) => {
    const workDir = cwd || process.cwd();
    try {
      const result = await impactCommand(workDir, target, {
        json: options?.json,
        maxFiles: options?.maxFiles ?? 20,
        maxDepth: options?.maxDepth,
        includeTests: options?.includeTests,
      });
      outputImpact(result, options?.json);
    } catch (error) {
      outputError(error, options?.json);
    }
  });

// scope command (tasks 2.5-2.6)
cli.command('scope <target> [cwd]', 'Query scope for a file, module, or external package')
  .option('--json', 'Output in JSON format')
  .option('--all', 'Include all imports/exports without filtering')
  .example('codegraph scope src/utils.ts')
  .example('codegraph scope MODULE:src/utils.ts#helper')
  .example('codegraph scope EXTERNAL:react --json')
  .action(async (target: string, cwd?: string, options?: { json?: boolean; all?: boolean }) => {
    const workDir = cwd || process.cwd();
    try {
      const result = await scopeCommand(workDir, target, {
        json: options?.json,
        all: options?.all,
      });
      outputScope(result, options?.json);
    } catch (error) {
      outputError(error, options?.json);
    }
  });

// layers command (Section 4)
cli.command('layers [cwd]', 'Show architecture layer inference')
  .option('--json', 'Output in JSON format')
  .option('--source-root <path>', 'Source root directory (default: src)')
  .example('codegraph layers')
  .example('codegraph layers --source-root packages/app/src')
  .example('codegraph layers --json')
  .action(async (cwd?: string, options?: { json?: boolean; sourceRoot?: string }) => {
    const workDir = cwd || process.cwd();
    try {
      const result = await layersCommand(workDir, {
        json: options?.json,
        sourceRoot: options?.sourceRoot,
      });
      outputLayers(result, options?.json);
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

function outputImpact(result: ImpactResult | ImpactError, json?: boolean): void {
  if (result.success) {
    if (json) {
      console.log(formatImpactJson(result));
    } else {
      console.log(formatImpactText(result));
    }
  } else {
    if (json) {
      console.log(formatImpactErrorJson(result));
    } else {
      console.error(formatImpactErrorText(result));
    }
  }
}

function outputScope(result: ScopeResult | ScopeError | CliError, json?: boolean): void {
  if (result.success) {
    // ScopeResult
    if (json) {
      console.log(formatScopeJson(result as ScopeResult));
    } else {
      console.log(formatScopeText(result as ScopeResult));
    }
  } else {
    // ScopeError or CliError
    // CliError has error.code as CliErrorCode enum, ScopeError has error.code as string
    if (json) {
      // Check if it's a ScopeError (string code) or CliError (enum code)
      if ('suggestion' in result.error) {
        // ScopeError
        console.log(formatScopeErrorJson(result as ScopeError));
      } else {
        // CliError - use generic error formatter
        console.log(formatErrorJson(result as CliError));
      }
    } else {
      if ('suggestion' in result.error) {
        // ScopeError
        console.error(formatScopeErrorText(result as ScopeError));
      } else {
        // CliError - use generic error formatter
        console.error(formatErrorText(result as CliError));
      }
    }
  }
}

function outputLayers(result: LayersResult | LayersError | CliError, json?: boolean): void {
  if (result.success) {
    // LayersResult
    if (json) {
      console.log(formatLayersJson(result as LayersResult));
    } else {
      console.log(formatLayersText(result as LayersResult));
    }
  } else {
    // LayersError or CliError
    // CliError has error.code as CliErrorCode enum, LayersError has error.code as string
    if (json) {
      // Check if it's a LayersError (string code with suggestion) or CliError (enum code)
      if ('suggestion' in result.error) {
        // LayersError
        console.log(formatLayersErrorJson(result as LayersError));
      } else {
        // CliError - use generic error formatter
        console.log(formatErrorJson(result as CliError));
      }
    } else {
      if ('suggestion' in result.error) {
        // LayersError
        console.error(formatLayersErrorText(result as LayersError));
      } else {
        // CliError - use generic error formatter
        console.error(formatErrorText(result as CliError));
      }
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