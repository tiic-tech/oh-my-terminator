/**
 * @fileoverview Core baseline structure types
 *
 * WHY: Baseline data structure types are foundational to the persistence system.
 * Separated from other type groups to keep this file focused on the data model.
 *
 * Contains:
 * - SkillDemand: Agent skill demand estimates
 * - MigrationRecord: History of migration operations
 * - Baseline: Complete baseline structure for persistence
 */

import type { SerializedCodeGraph, SchemaVersion } from '../../types.js';

/**
 * Demand level for different agent skill types (0-1 scale)
 *
 * WHY: Architecture analysis produces skill demand estimates that help
 * allocate appropriate agents for refactoring tasks.
 *
 * @see 01_origin_blueprint.md Section 3.4
 */
export interface SkillDemand {
  /** Test writing agent demand */
  testWriter: number;
  /** Refactoring specialist demand */
  refactorSpecialist: number;
  /** Architecture planning demand */
  architect: number;
  /** Security review demand */
  securityReviewer: number;
}

/**
 * Record of a single migration operation
 *
 * WHY: Migration history enables debugging version transitions and provides
 * audit trail for schema changes. checksumBefore/checksumAfter allow integrity
 * verification after migration.
 */
export interface MigrationRecord {
  /** Source version (or 'legacy' for unversioned baselines) */
  fromVersion: string;
  /** Target version after migration */
  toVersion: string;
  /** Timestamp of migration execution */
  migratedAt: number;
  /** Strategy used: 'migrate' (transform) or 'rebuild' (full re-analysis) */
  strategy: 'migrate' | 'rebuild';
  /** Optional checksum of baseline before migration */
  checksumBefore?: string;
  /** Optional checksum of baseline after migration */
  checksumAfter?: string;
}

/**
 * Complete baseline structure for persistence
 *
 * WHY: Baseline stores not just the graph but metadata needed for:
 * - Version management (schemaVersion, generatorVersion)
 * - Incremental update decisions (commitHash, timestamp)
 * - Architecture analysis (architectureConstraints, healthScore, skillDemand)
 * - Migration tracking (migrationHistory)
 */
export interface Baseline {
  /** Serialized graph data */
  graph: SerializedCodeGraph;
  /** Git commit hash this baseline represents */
  commitHash: string;
  /** Timestamp when baseline was generated */
  timestamp: number;
  /** Schema version for compatibility checking */
  schemaVersion: SchemaVersion;
  /** Tool version that generated this baseline */
  generatorVersion: string;
  /** Detected architecture constraints (e.g., "layer:service->domain") */
  architectureConstraints: string[];
  /** Overall health score (0-100) */
  healthScore: number;
  /** Skill demand estimates for different agent types */
  skillDemand: SkillDemand;

  /**
   * History of migrations applied to this baseline
   *
   * OPTIONAL SEMANTICS:
   * - PRESENT: Baseline has been migrated from older schema versions
   * - ABSENT: Baseline was created at current schema version (no migrations needed)
   *
   * WHY optional: New baselines don't need migration history.
   * Only added when upgrade-path requires recording transformation steps.
   */
  migrationHistory?: MigrationRecord[];

  /**
   * Mark as deprecated to trigger automatic rebuild
   *
   * OPTIONAL SEMANTICS:
   * - PRESENT (true): Baseline is outdated, force rebuild on next load
   * - ABSENT: Baseline is valid and can be used normally
   *
   * WHY optional: Most baselines are valid. Only set when:
   * - Manual deprecation by user/admin
   * - Automatic deprecation after migration failure
   * - Schema version too old to migrate
   */
  deprecated?: boolean;
}