## Context

The `getArchitectureLayers()` API currently uses a simple scoring system with hardcoded `LAYER_THRESHOLD=2`. This causes two critical issues:

1. **Source Root Misidentification**: `tests/` directory incorrectly detected as source root because no exclusion logic exists
2. **Poor Layer Assignment**: Cycle dependencies and dynamic imports are not penalized, leading to inaccurate layer scores

The `cg-depth-presets` change (already completed) provides DEPTH_PRESETS configuration for dynamic threshold selection. This change builds on that foundation to implement the full Hybrid Inference Pipeline (Phases 1/2/4/5).

> **Note**: Phase 3 (DEPTH_PRESETS) was implemented separately in `cg-depth-presets` change. This change implements remaining phases: 1, 2, 4, 5.

## Goals / Non-Goals

**Goals:**
- Implement Phase 1: Source Root Discovery with weighted signal detection and exclusion list
- Implement Phase 2: Dependency Score Calculation with cycle penalty and dynamic import handling
- Implement Phase 4: Layer Assignment with confidence tracking and fuzzy matching
- Implement Phase 5: Fallback & Suggestions with Agent-friendly prompts
- Ensure `tests/` directory is correctly excluded from source root candidates
- Add confidence field to LayersResult for inference quality tracking

**Non-Goals:**
- Plugin architecture for multi-language support (M2 scope)
- Violation handling strategies beyond detection (M3 scope)
- Python/Go/Rust/Java layer inference (M4 scope)

## Decisions

### D1: Signal Detection System (Phase 1)

**Decision**: Use weighted signal scoring with positive and negative signals

**Alternatives Considered**:
- A) Simple directory name matching (rejected - too brittle)
- B) Configuration-based approach (rejected - requires manual setup)

**Rationale**: Weighted scoring balances flexibility with automation. Positive signals (PACKAGE_JSON=+10, TS_CONFIG=+8) reward typical project roots, while negative signals (NO_NODE_MODULES=-20, IN_EXCLUDED_LIST=-∞) penalize non-source directories.

**Implementation**:
```typescript
// packages/codegraph/src/api/layers/inference/source-root.ts
const SIGNAL_WEIGHTS = {
  PACKAGE_JSON:    +10,
  TS_CONFIG:       +8,
  TYPICAL_DIR:     +15,  // src, lib, app
  NO_NODE_MODULES: -20,
};

const EXCLUDED_DIRECTORIES = [
  'node_modules', 'dist', 'build', 'test', 'tests', '__tests__',
  '.git', '.github', 'docs', 'coverage', 'scripts'
];
```

### D2: Cycle Penalty Mechanism (Phase 2)

**Decision**: Apply penalty based on cycle size, not cycle count

**Alternatives Considered**:
- A) Fixed penalty per cycle (rejected - doesn't differentiate complexity)
- B) Remove cycle members from scoring (rejected - loses valuable dependency info)

**Rationale**: Size-based penalty (`penalty = ceil(cycle.length / 2)`) reflects that larger cycles are more architecturally problematic than small cycles. Each group in cycle receives equal penalty to maintain fairness.

**Implementation**:
```typescript
// packages/codegraph/src/api/layers/inference/dependency-score.ts
function calculateCyclePenalty(cycle: string[]): number {
  return Math.ceil(cycle.length / 2);
}
```

### D3: Confidence Tracking (Phase 4)

**Decision**: Add confidence field (0-100) based on signal strength and group consistency

**Alternatives Considered**:
- A) Binary confidence (high/low) (rejected - lacks granularity)
- B) No confidence field (rejected - users need inference quality indicator)

**Rationale**: Numeric confidence allows users to assess inference reliability. High confidence (>80) suggests stable layering, low confidence (<50) suggests manual review needed.

**Implementation**:
```typescript
interface LayerAssignment {
  layer: number;
  role: string;
  groups: string[];
  confidence: number;  // NEW: 0-100
}
```

### D4: Fallback Strategy (Phase 5)

**Decision**: Generate Agent-friendly prompt when confidence < 50

**Alternatives Considered**:
- A) Throw error (rejected - blocks user workflow)
- B) Use default alphabetical ordering (rejected - loses inference value)

**Rationale**: Agent prompt allows human/AI to provide context that improves inference. Default fallback (alphabetical by group name) ensures graceful degradation.

## Risks / Trade-offs

### R1: Signal weights may not generalize to all project structures
- **Risk**: Projects with unconventional layouts may score incorrectly
- **Mitigation**: Provide `.codegraph/config.json` override mechanism for custom signal weights

### R2: Cycle detection performance on large projects
- **Risk**: O(n²) cycle detection may slow on projects with 500+ groups
- **Mitigation**: Use visited set optimization, limit detection to groups with dependencies

### R3: Confidence threshold may be too conservative
- **Risk**: Too many projects trigger fallback
- **Mitigation**: Calibrate threshold with real-world testing, start with 50 and adjust

## Migration Plan

1. **Phase 1**: Add `source-root.ts` module, integrate into `core.ts` source root detection
2. **Phase 2**: Add `dependency-score.ts`, replace current simple scoring
3. **Phase 4**: Modify `layer-assignment.ts`, add confidence calculation
4. **Phase 5**: Add `fallback.ts`, integrate prompt generation into result output
5. **Rollback**: All modules are additive, rollback = delete new files + restore original core.ts

## Open Questions (Resolved with Defaults)

- Q1: Should we cache source root detection results across multiple API calls?
  - **Default**: No caching in M1 - cache added in M2 if performance analysis shows benefit
  
- Q2: What prompt format maximizes Agent usefulness?
  - **Default**: JSON format with `{type, prompt, context}` structure - matches existing suggestion patterns
  
- Q3: Should confidence be per-group or per-layer?
  - **Default**: Per-layer confidence - reflects overall inference quality for layer assignment