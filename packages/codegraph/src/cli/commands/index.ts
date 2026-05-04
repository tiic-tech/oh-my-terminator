/**
 * @fileoverview CLI commands barrel file
 *
 * WHY: Provides clean public API for all CLI commands.
 * Consumers import from './commands/index.js' instead of individual files.
 */

export { analyzeCommand, type AnalyzeOptions } from './analyze.js';
export { updateCommand, type UpdateOptions } from './update.js';
export { migrateCommand } from './migrate.js';
// MigrateOptions is exported from types.ts, not defined locally
export type { MigrateOptions } from '../../types.js';