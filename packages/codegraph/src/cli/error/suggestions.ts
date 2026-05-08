/**
 * CLI Suggestion Functions for Similar Command/Flag Matching
 *
 * WHY: Help users discover correct command/flag when they make typos.
 * Simple prefix/suffix matching provides good suggestions without complexity.
 */

import { getAvailableCommands, getAvailableFlags } from './helpers.js';

/**
 * Find similar command using Levenshtein-like matching
 *
 * WHY: Help users discover correct command when they make typos.
 * Simple prefix/suffix matching provides good suggestions without complexity.
 */
export function findSimilarCommand(userCommand: string, availableCommands: string[]): string | null {
  // WHY: Simple matching - if command starts or ends with similar substring
  const lowerUser = userCommand.toLowerCase();

  for (const cmd of availableCommands) {
    const lowerCmd = cmd.toLowerCase();
    // Prefix match: user typed "ana" → suggest "analyze"
    if (lowerCmd.startsWith(lowerUser) && lowerUser.length >= 2) {
      return cmd;
    }
    // Substring match: user typed "lyzer" → suggest "analyze"
    if (lowerCmd.includes(lowerUser) && lowerUser.length >= 3) {
      return cmd;
    }
  }

  return null;
}

/**
 * Find similar flag using simple matching
 *
 * WHY: Help users discover correct flag when they make typos.
 */
export function findSimilarFlag(userFlag: string, availableFlags: string[]): string | null {
  const lowerUser = userFlag.toLowerCase();

  for (const flag of availableFlags) {
    const lowerFlag = flag.toLowerCase();
    // Prefix match: user typed "--js" → suggest "--json"
    if (lowerFlag.startsWith(lowerUser) && lowerUser.length >= 3) {
      return flag;
    }
  }

  return null;
}

/**
 * Find similar command from CLI instance (convenience wrapper)
 */
export function findSimilarCommandFromCli(userCommand: string, cli: import('cac').CAC): string | null {
  const availableCommands = getAvailableCommands(cli);
  return findSimilarCommand(userCommand, availableCommands);
}

/**
 * Find similar flag from command (convenience wrapper)
 */
export function findSimilarFlagFromCommand(userFlag: string, command: import('cac').Command): string | null {
  const availableFlags = getAvailableFlags(command);
  return findSimilarFlag(userFlag, availableFlags);
}