/**
 * Dynamic import examples.
 * Tests DYNAMIC_IMPORTS edge generation.
 */

// Simple dynamic import
export async function loadUtils(): Promise<void> {
  const utils = await import('./utils/format');
  console.log(utils.formatDate(new Date()));
}

// Dynamic import with named extraction
export async function loadMath(): Promise<void> {
  const { add, subtract } = await import('./utils/math');
  console.log(add(1, 2));
}

// Dynamic import of external package
export async function loadLodash(): Promise<void> {
  const lodash = await import('lodash');
  console.log(lodash.debounce);
}

// Conditional dynamic import
export async function conditionalLoad(condition: boolean): Promise<void> {
  if (condition) {
    const config = await import('./config');
    console.log(config.default);
  }
}