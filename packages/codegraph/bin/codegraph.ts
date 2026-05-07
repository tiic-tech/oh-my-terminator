#!/usr/bin/env node
import { cac } from 'cac';
import { analyzeCommand, updateCommand, migrateCommand, impactCommand, scopeCommand, layersCommand } from '../src/cli/commands/index.js';
import { output, outputMigrate, outputImpact, outputScope, outputLayers, outputError } from './output-handlers.js';
import { setupCliErrorHandler, handleCliError } from './cli-error-handler.js';

// WHY: Track CLI start time for duration calculation in error output
const startTime = Date.now();

const cli = cac('codegraph');

// WHY: Setup CLI-level error handlers before command definitions
// Handles unknown commands (CAC emits 'command:*' event) and uncaught errors
setupCliErrorHandler(cli, startTime);

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
  .option('--verbose', 'Show matched patterns for inferred layer names')
  .example('codegraph layers')
  .example('codegraph layers --source-root packages/app/src')
  .example('codegraph layers --verbose')
  .example('codegraph layers --json')
  .action(async (cwd?: string, options?: { json?: boolean; sourceRoot?: string; verbose?: boolean }) => {
    const workDir = cwd || process.cwd();
    try {
      const result = await layersCommand(workDir, {
        json: options?.json,
        sourceRoot: options?.sourceRoot,
        verbose: options?.verbose,
      });
      outputLayers(result, options?.json, options?.verbose);
    } catch (error) {
      outputError(error, options?.json);
    }
  });

// Help
cli.help();

// Parse with global error handler
// WHY: CACError may escape command actions - catch at CLI level for transformation
try {
  cli.parse();
} catch (error: unknown) {
  // WHY: CACError and other uncaught errors need friendly transformation
  handleCliError(error, cli, startTime);
}