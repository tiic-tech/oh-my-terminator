/**
 * Re-export aggregator file.
 * Tests various re-export patterns including A3: wildcard exports.
 */

// Named re-export (specific symbols)
export { formatDate, formatNumber } from './utils/format';

// Wildcard re-export (A3 scenario) - should generate single RE_EXPORTS edge
// with metadata.importSpecifier = "wildcard"
export * from './utils/math';

// Re-export with renaming
export { formatDate as dateToString } from './utils/format';

// Re-export from external module (will create EXTERNAL node)
export { debounce } from 'lodash';