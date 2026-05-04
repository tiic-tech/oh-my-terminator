/**
 * @fileoverview CLI commands barrel file
 *
 * WHY: Provides clean public API for all CLI commands.
 * Consumers import from './commands/index.js' instead of individual files.
 */

export { analyzeCommand, type AnalyzeOptions } from './analyze.js';
export { updateCommand, type UpdateOptions } from './update.js';