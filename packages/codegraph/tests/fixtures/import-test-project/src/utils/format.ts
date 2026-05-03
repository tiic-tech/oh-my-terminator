/**
 * Utility functions for formatting.
 * Provides date, number, and string formatting helpers.
 */

// Named exports - will be imported by other files
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatNumber(num: number): string {
  return num.toLocaleString();
}

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// Default export
const Formatter = {
  formatDate,
  formatNumber,
  formatCurrency,
};

export default Formatter;

// Constants (named exports)
export const DATE_FORMAT = 'YYYY-MM-DD';
export const CURRENCY_SYMBOL = '$';