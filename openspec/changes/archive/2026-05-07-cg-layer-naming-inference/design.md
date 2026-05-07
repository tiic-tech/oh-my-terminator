## Context

The current architecture layers inference assigns 4 predefined roles (Foundation, Core, Application, Presentation) to layers 1-4, but layers 5+ receive generic names like "Layer 5". This reduces the diagnostic value of architecture visualization.

**Current State**:
- `LAYER_ROLE_NAMES` constant in `layers-types.ts` maps 1-4 to role names
- `LayerAssignment.role` type is `LayerRole | string` - already supports dynamic names
- Core inference fallback: `LAYER_ROLE_NAMES[currentLayer] || `Layer ${currentLayer}``

**Constraints**:
- Must work with existing layer inference pipeline (C8/P1)
- Must support configuration extension for custom rules
- Must maintain backward compatibility

## Goals / Non-Goals

**Goals:**
- Infer semantic names for Layer 5+ based on directory patterns
- Support common naming conventions (api, persistence, cli, etc.)
- Enable custom naming rules via `.codegraph/config.json`
- Maintain 80%+ naming accuracy for typical project structures

**Non-Goals:**
- Changing Layer 1-4 role names (Foundation, Core, Application, Presentation are standard)
- Requiring manual configuration for naming to work
- AI/ML-based naming inference (use pattern matching only)

## Decisions

### Decision 1: Naming Rules Table

**Choice**: Pattern-based naming rules table with priority ordering

**Rationale**:
- Pattern matching is deterministic and testable
- Priority ordering handles overlapping patterns (e.g., "api-handler" could match "api" or "handler")
- No external dependencies or AI costs

**Alternatives Considered**:
- Heuristic scoring (rejected: adds complexity, hard to tune)
- AI-based inference (rejected: adds latency, cost, nondeterminism)
- User-only configuration (rejected: requires manual setup, poor UX)

### Decision 2: Naming Rules Structure

**Choice**: Array of `{ pattern: string | RegExp, role: string, priority: number }`

**Rationale**:
- RegExp enables flexible matching (e.g., `^(api|routes)$` for exact match)
- Priority handles conflicts deterministically
- Extensible via configuration merge

**Example Rules** (12 patterns):
```typescript
const DEFAULT_NAMING_RULES = [
  // Tier 1: Core architectural patterns (priority: 10)
  { pattern: '^(api|routes|endpoints)$', role: 'API Layer', priority: 10 },
  { pattern: '^(persistence|data|storage|db)$', role: 'Data Layer', priority: 10 },
  { pattern: '^(cli|commands|bin)$', role: 'CLI Layer', priority: 10 },
  
  // Tier 2: Supporting architectural patterns (priority: 9)
  { pattern: '^(infrastructure|infra|platform)$', role: 'Infrastructure Layer', priority: 9 },
  { pattern: '^(config|configuration|settings)$', role: 'Configuration Layer', priority: 9 },
  { pattern: '^(models|entities|domain)$', role: 'Domain Layer', priority: 9 },
  { pattern: '^(types|typings|interfaces)$', role: 'Type Layer', priority: 9 },
  
  // Tier 3: Cross-cutting patterns (priority: 8)
  { pattern: '^(services|workers|jobs)$', role: 'Service Layer', priority: 8 },
  { pattern: '^(hooks|middlewares|middleware)$', role: 'Middleware Layer', priority: 8 },
  
  // Tier 4: Utility patterns (priority: 5)
  { pattern: '^(utils|helpers|lib|common)$', role: 'Utility Layer', priority: 5 },
  { pattern: '^(test|tests|spec|specs|__tests__)$', role: 'Test Layer', priority: 5 },
];
```

### Decision 3: Integration Point

**Choice**: Add `inferLayerRoleNames()` function called after layer assignment in `core.ts`

**Rationale**:
- Minimal change to existing code
- Clear separation of concerns
- Easy to test independently

**Data Flow**:
```
inferArchitectureLayers()
  → assign layer numbers to all groups
  → for each layer:
      → collect groups in that layer (from LayerAssignment.nodes[].groupName)
      → inferLayerRoleNames(groups, layerNum, config.namingRules)
      → assign role to LayerAssignment.role
  → final LayerAssignment[] with semantic names
```

**Input Interface**:
- `groups`: Array of directory group names from LayerAssignment.nodes
- `layerNum`: Layer number for fallback naming
- `rules`: Optional NamingRule[] from config (merged with defaults)

**Output Interface**:
- Returns `{ role: string, confidence: number }`
- `role`: Semantic layer name or "Layer N" fallback
- `confidence`: 0-100 score based on match quality

**Flow**:
```
inferArchitectureLayers() → assign layer numbers → inferLayerRoleNames() → final role names
```

### Decision 4: Configuration Extension

**Choice**: Add `namingRules` field to `.codegraph/config.json`

**Rationale**:
- Follows existing pattern (DEPTH_PRESETS in config)
- User rules merged with defaults (user rules override)
- No schema change to existing config

**Config JSON Schema**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "namingRules": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["pattern", "role", "priority"],
        "properties": {
          "pattern": {
            "type": "string",
            "description": "RegExp pattern for matching directory group names"
          },
          "role": {
            "type": "string",
            "minLength": 1,
            "description": "Semantic role name to assign when pattern matches"
          },
          "priority": {
            "type": "number",
            "minimum": 0,
            "maximum": 100,
            "description": "Priority for conflict resolution (higher wins)"
          }
        }
      }
    }
  }
}
```

**Config Example**:
```json
{
  "namingRules": [
    { "pattern": "^(custom|special)$", "role": "Custom Layer", "priority": 15 }
  ]
}
```

### Decision 5: Aggregation Algorithm for Multiple Groups

**Choice**: Priority-based aggregation with comma-separated fallback for ties

**Rationale**:
- A layer may contain multiple directory groups (e.g., Layer 5 has "api" and "services")
- Need deterministic rule to select single role name
- Priority-based selection matches design intent for conflict resolution
- Comma-separated fallback handles ambiguous cases gracefully

**Algorithm**:
```
1. Match all group names in layer against naming rules
2. Collect all matching rules with their priorities
3. Apply exact match boost (+10) to base priority for anchored patterns
4. Select rule with highest final priority
5. If tie on priority:
   - If 2+ rules with same priority: comma-separated roles ("API, Service Layer")
   - Otherwise: first match wins (deterministic order)
6. If no matches: fallback to "Layer N"
```

**Example**:
- Layer 5 groups: ["api", "services"]
- Matches: api → priority 10, services → priority 8
- Result: "API Layer" (highest priority wins)

**Interface**:
```typescript
inferLayerRoleNames(
  groups: string[],           // Directory group names in layer
  layerNum: number,           // Layer number for fallback
  rules?: NamingRule[]        // Optional custom rules
): { role: string; confidence: number }
```

### Decision 6: Exact Match Detection Algorithm

**Choice**: Detect anchored patterns (starts with `^` and ends with `$`) and apply priority boost

**Rationale**:
- Anchored RegExp patterns (`^(api)$`) are explicit exact match intent
- Exact matches should be preferred over substring matches for precision
- Priority boost mechanism integrates cleanly with existing priority system
- No need for additional `exactMatch` boolean field

**Algorithm**:
```
1. For each rule pattern, check if it starts with '^' and ends with '$'
2. If anchored (exact match pattern): apply +10 priority boost
3. Final priority = base priority + exact match boost
4. Compare final priorities for conflict resolution
```

**Examples**:
- Pattern `^(api)$` with base priority 10 → final priority 20 (exact match)
- Pattern `api` with base priority 10 → final priority 10 (substring match)
- Group name "api" matches both: exact wins (20 > 10)

**Clarification: Priority vs Exact Match Order**:
The resolution order is:
1. Apply exact match boost (+10) to base priorities FIRST
2. Then compare FINAL priorities (higher wins)
3. If tie on final priority: comma-separated fallback

This ensures exact match preference is deterministic and integrates with priority system, not overriding it.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Pattern collision (multiple matches) | Priority ordering + exact match preference |
| False positive naming (wrong role inferred) | Confidence tracking + fallback to generic name |
| Uncommon directory names not covered | Configuration extension + fallback to "Layer N" |
| Breaking change to role field | `LayerRole | string` already supports strings |

**Trade-off**: Pattern-based inference may miss unconventional naming. Acceptable because:
- Fallback to generic name is safe
- Configuration enables override
- 80% accuracy target balances coverage vs. complexity