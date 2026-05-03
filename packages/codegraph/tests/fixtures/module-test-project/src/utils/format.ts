// Utility functions for other test files

/**
 * Formats a date to a readable string
 * @param date - The date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

/**
 * Parses a string to a Date object
 * @param str - The string to parse
 * @returns Date object or null if invalid
 */
export function parseDate(str: string): Date | null {
  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date;
}

// Default export for this file
export default {
  formatDate,
  parseDate,
};