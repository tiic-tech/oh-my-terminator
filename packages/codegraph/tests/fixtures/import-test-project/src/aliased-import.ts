/**
 * Aliased import examples.
 * Tests A2: Multiple alias paths resolution.
 */

// Import using @utils alias - will resolve to src/utils/format.ts
import { formatDate } from '@utils/format';

// Import using @utils alias that resolves to shared/utils
// This tests the second path in the @utils/* array
import { sharedHelper } from '@utils/shared-helper';

// Import using @shared alias
import {} from '@shared/utils/shared-helper';

// Import using @components alias
import { Button } from '@components/Button';

// Named import with alias
import { formatDate as fmtDate } from '@utils/format';

// Default import via alias
import Formatter from '@utils/format';

// Mixed imports via alias
import formatConfig, { DEFAULT_TIMEOUT } from '../config';

export function useAliasedUtils(): void {
  formatDate(new Date());
  sharedHelper();
}