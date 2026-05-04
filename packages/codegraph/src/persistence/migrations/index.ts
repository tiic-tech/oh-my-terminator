/**
 * @fileoverview Public exports for CodeGraph migration module
 *
 * WHY: Re-exports from split files and registers built-in migration scripts.
 * Maintains backward compatibility with original migrations/index.ts exports.
 */

// Re-export from registry module
export {
  registerMigration,
  clearMigrationRegistry,
  getMigrationRegistryForTesting,
} from './registry.js';

// Re-export from path-finding module
export {
  versionMatchesPattern,
  findMigrationPath,
} from './path-finding.js';

// Re-export from execution module
export {
  migrateBaseline,
  safeMigrateBaseline,
} from './execution.js';

// ============================================================================
// Built-in Migration Scripts
// ============================================================================

// Import and register legacy migration script
import { legacyToV1_0_0 } from './legacy-to-1.0.0.js';
import { registerMigration } from './registry.js';

registerMigration(legacyToV1_0_0);