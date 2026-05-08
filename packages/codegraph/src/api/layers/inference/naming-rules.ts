/**
 * Naming Rules for Architecture Layer Role Inference
 *
 * WHY: Layers 5+ need semantic names instead of generic "Layer N".
 * HOW: Pattern matching against directory/group names with priority-based resolution.
 *
 * Design: Higher priority = more specific architectural role.
 * Anchored patterns (^...$) ensure exact match, preventing false positives.
 */

/**
 * NamingRule - Pattern-based layer role inference rule
 *
 * pattern: RegExp or string to match against group/directory names
 * role: Semantic role name assigned when pattern matches
 * priority: Higher number = more specific role (used for conflict resolution)
 */
export interface NamingRule {
  pattern: string | RegExp;
  role: string;
  priority: number;
}

/**
 * DEFAULT_NAMING_RULES - 12 common patterns in 4 priority tiers
 *
 * Tier organization rationale:
 * - Tier 1 (10): Core architectural boundaries - highest specificity
 * - Tier 2 (9): Supporting architectural patterns
 * - Tier 3 (8): Cross-cutting concerns
 * - Tier 4 (5): Utility/testing - lowest specificity, fallback category
 *
 * Anchored patterns (^...$) ensure exact directory match, not substring.
 */
export const DEFAULT_NAMING_RULES: NamingRule[] = [
  // Tier 1: Core architectural patterns (priority: 10)
  // WHY: These define primary system boundaries - highest architectural significance
  { pattern: '^(api|routes|endpoints)$', role: 'API Layer', priority: 10 },
  { pattern: '^(persistence|data|storage|db)$', role: 'Data Layer', priority: 10 },
  { pattern: '^(cli|commands|bin)$', role: 'CLI Layer', priority: 10 },

  // Tier 2: Supporting architectural patterns (priority: 9)
  // WHY: Domain/config infrastructure - secondary architectural boundaries
  { pattern: '^(infrastructure|infra|platform)$', role: 'Infrastructure Layer', priority: 9 },
  { pattern: '^(config|configuration|settings)$', role: 'Configuration Layer', priority: 9 },
  { pattern: '^(models|entities|domain)$', role: 'Domain Layer', priority: 9 },
  { pattern: '^(types|typings|interfaces)$', role: 'Type Layer', priority: 9 },

  // Tier 3: Cross-cutting patterns (priority: 8)
  // WHY: Business logic and middleware - operate across multiple layers
  { pattern: '^(services|workers|jobs)$', role: 'Service Layer', priority: 8 },
  { pattern: '^(hooks|middlewares|middleware)$', role: 'Middleware Layer', priority: 8 },

  // Tier 4: Utility patterns (priority: 5)
  // WHY: Helpers and tests - generic category, lowest architectural specificity
  { pattern: '^(utils|helpers|lib|common)$', role: 'Utility Layer', priority: 5 },
  { pattern: '^(test|tests|spec|specs|__tests__)$', role: 'Test Layer', priority: 5 },
];