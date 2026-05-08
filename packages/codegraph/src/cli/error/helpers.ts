/**
 * CLI Helper Functions for Command/Flag Extraction
 *
 * WHY: Extract available commands and flags from CAC CLI for suggestions.
 */

import type { CAC, Command } from 'cac';

/**
 * Extract available commands from CAC CLI instance
 *
 * WHY: Provide suggestions when user enters unknown command.
 * Uses CAC's internal commands array (not a map).
 */
export function getAvailableCommands(cli: CAC): string[] {
  // WHY: CAC stores commands in cli.commands array
  // Extract names, filter default/global commands, sort alphabetically
  return cli.commands
    .map((cmd) => cmd.name)
    .filter((name) => name && name !== '' && !name.startsWith('@@'))
    .sort();
}

/**
 * Extract available flags from a specific command
 *
 * WHY: Suggestions are command-specific - each command has different flags.
 * Uses CAC's command.options array.
 */
export function getAvailableFlags(command: Command): string[] {
  // WHY: Each command's options are in command.options array
  // Filter valid flags (non-negated boolean flags also count)
  return command.options
    .filter((opt) => opt.name && !opt.negated)
    .map((opt) => `--${opt.name}`)
    .sort();
}