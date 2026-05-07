## 1. Naming Rules Foundation

- [ ] 1.1 Create `naming-rules.ts` in `src/api/layers/inference/` with NamingRule type and DEFAULT_NAMING_RULES array
- [ ] 1.2 Add NamingRule type: `{ pattern: string | RegExp; role: string; priority: number }`
- [ ] 1.3 Define DEFAULT_NAMING_RULES with 12 common patterns organized in 4 tiers:
  - Tier 1 (priority: 10): api, persistence, cli
  - Tier 2 (priority: 9): infrastructure, config, models, types
  - Tier 3 (priority: 8): services, hooks/middleware
  - Tier 4 (priority: 5): utils, test
- [ ] 1.4 Export NamingRule type and DEFAULT_NAMING_RULES from `index.ts`

## 2. Layer Name Inference Implementation

- [ ] 2.1 Create `layer-naming.ts` in `src/api/layers/inference/` with `inferLayerRoleName()` function
- [ ] 2.2 Implement pattern matching logic with RegExp support
- [ ] 2.3 Implement priority-based conflict resolution (higher priority wins)
- [ ] 2.4 Add exact match preference over substring match
- [ ] 2.5 Implement fallback to generic "Layer N" when no rule matches
- [ ] 2.6 Add function to infer role name from multiple groups using aggregation algorithm:
  - Match all groups against naming rules, collect matching rules
  - Apply exact match boost (+10) to anchored patterns
  - Select highest final priority rule
  - If tie: first match wins (deterministic order)
  - Return role name and confidence score (0-100)
- [ ] 2.7 Export `inferLayerRoleNames()` from `index.ts`

## 3. Configuration Extension

- [ ] 3.1 Update config schema to support `namingRules` field in `.codegraph/config.json`:
  - Schema: `{ namingRules?: Array<{ pattern: string, role: string, priority: number }> }`
  - Required fields: pattern (valid RegExp), role (minLength: 1), priority (0-100)
- [ ] 3.2 Implement rule validation (valid pattern, required fields)
- [ ] 3.3 Implement rule merging (user rules + default rules, user rules override)
- [ ] 3.4 Add warning log for invalid rules (skip invalid, continue with valid)

## 4. Core Integration

- [ ] 4.1 Update `inferArchitectureLayers()` in `core.ts` to call `inferLayerRoleName()` for layers 5+
- [ ] 4.2 Modify role assignment: use LAYER_ROLE_NAMES for layers 1-4, inferLayerRoleName() for layers 5+
- [ ] 4.3 Pass layer groups to inference function for role aggregation
- [ ] 4.4 Update LayerAssignment role field to use inferred names

## 5. CLI Output Update

- [ ] 5.1 Update `layers` command output to display semantic names for Layer 5/6/7
- [ ] 5.2 Add naming rules info to verbose output (show matched patterns)
- [ ] 5.3 Test CLI output with project having 5+ layers

## 6. Unit Tests

- [ ] 6.1 Write tests for `inferLayerRoleName()` single pattern match
- [ ] 6.2 Write tests for multiple pattern match with priority resolution
- [ ] 6.3 Write tests for exact vs substring match preference
- [ ] 6.4 Write tests for fallback to generic name
- [ ] 6.5 Write tests for configuration rule validation
- [ ] 6.6 Write tests for rule merging logic
- [ ] 6.7 Write integration tests for `inferArchitectureLayers()` with naming

## 7. E2E Validation

- [ ] 7.1 Run `npm test` to verify 80%+ coverage maintained
- [ ] 7.2 Run E2E layers command on test project with 5+ layers
- [ ] 7.3 Verify semantic names displayed instead of "Layer 5/6/7"
- [ ] 7.4 Verify backward compatibility (layers 1-4 unchanged)