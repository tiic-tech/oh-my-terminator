/**
 * Main entry point with comprehensive import examples.
 * Tests all import patterns in one file.
 */

// ============================================================
// RELATIVE IMPORTS - Basic scenarios
// ============================================================

// Named import (relative path)
import { formatDate, formatNumber } from './utils/format';

// Default import (relative path)
import Formatter from './utils/format';

// Namespace import (relative path)
import * as mathUtils from './utils/math';

// Mixed import (default + named)
import config, { DEFAULT_TIMEOUT } from './config';

// ============================================================
// RE-EXPORTS
// ============================================================

// Re-export from relative path
export { formatDate } from './utils/format';

// Wildcard re-export (A3 scenario)
export * from './utils/math';

// ============================================================
// ALIAS IMPORTS (A2 scenario)
// ============================================================

// Alias import - tests paths resolution
import { sharedHelper } from '@utils/shared-helper';

// ============================================================
// EXTERNAL IMPORTS
// ============================================================

// External package import
import { debounce } from 'lodash';

// ============================================================
// DYNAMIC IMPORTS
// ============================================================

// Dynamic import reference
export { loadUtils } from './dynamic-import';

// ============================================================
// TYPES
// ============================================================

export type FormatResult = {
  date: string;
  number: string;
};

export interface AppConfig {
  apiUrl: string;
  timeout: number;
}

// ============================================================
// MAIN FUNCTION
// ============================================================

export function main(): void {
  const date = formatDate(new Date());
  const num = formatNumber(1000);
  const sum = mathUtils.add(1, 2);

  console.log(`Date: ${date}, Number: ${num}, Sum: ${sum}`);
  console.log(`Config: ${config.apiUrl}`);
  console.log(`Formatter: ${Formatter.formatDate(new Date())}`);
}

// Empty/side-effect import demonstration
import './external-refs';