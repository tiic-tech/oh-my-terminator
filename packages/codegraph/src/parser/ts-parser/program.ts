/**
 * TypeScript Program Creation
 *
 * Creates TypeScript Program instances for parsing source files.
 */

import ts from 'typescript';
import { ParserOptions } from './types.js';

/**
 * Result of creating a TypeScript Program
 *
 * Contains the Program instance and any warnings encountered during setup.
 * Warnings allow callers to decide how to handle non-critical issues.
 */
export interface ParserProgramResult {
  /** TypeScript Program instance */
  program: ts.Program;
  /** Non-critical warnings (e.g., tsconfig.json parsing errors) */
  warnings: string[];
}

/**
 * Create a TypeScript Program for parsing
 *
 * Finds and reads tsconfig.json if available, applies custom options.
 * Returns warnings array instead of logging directly - caller decides handling.
 *
 * @param filePaths - Absolute paths to files to parse
 * @param projectRoot - Absolute path to project root
 * @param options - Optional parser configuration
 * @returns ParserProgramResult with program and warnings
 */
export function createParserProgram(
  filePaths: string[],
  projectRoot: string,
  options?: ParserOptions
): ParserProgramResult {
  // Find tsconfig.json
  const configPath = ts.findConfigFile(projectRoot, ts.sys.fileExists, 'tsconfig.json');

  const warnings: string[] = [];

  let compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    allowJs: true,
    checkJs: false,
    noEmit: true,
    resolveJsonModule: true,
  };

  // Read tsconfig.json if found
  if (configPath) {
    const configResult = ts.readConfigFile(configPath, ts.sys.readFile);
    if (!configResult.error) {
      const parsedConfig = ts.parseJsonConfigFileContent(
        configResult.config,
        ts.sys,
        projectRoot
      );

      // Collect parsing errors as warnings - caller decides how to handle
      if (parsedConfig.errors && parsedConfig.errors.length > 0) {
        warnings.push(
          `tsconfig.json parsing errors: ${parsedConfig.errors.map(e => e.messageText).join(', ')}`
        );
      }

      compilerOptions = { ...compilerOptions, ...parsedConfig.options };
    }
  }

  // Apply custom options
  if (options?.compilerOptions) {
    compilerOptions = { ...compilerOptions, ...options.compilerOptions };
  }

  return {
    program: ts.createProgram(filePaths, compilerOptions),
    warnings,
  };
}

/**
 * Resolve module specifier to file path
 *
 * Uses TypeScript's module resolution. Returns null for external modules.
 *
 * @param specifier - Import specifier (e.g., './utils', 'lodash')
 * @param sourceFile - Source file path (absolute)
 * @param program - TypeScript Program instance
 * @returns Resolved file path (absolute) or null for external
 */
export function resolveModulePath(
  specifier: string,
  sourceFile: string,
  program: ts.Program
): string | null {
  const compilerOptions = program.getCompilerOptions();

  const resolved = ts.resolveModuleName(specifier, sourceFile, compilerOptions, ts.sys);

  if (resolved.resolvedModule) {
    return resolved.resolvedModule.resolvedFileName;
  }

  return null;
}