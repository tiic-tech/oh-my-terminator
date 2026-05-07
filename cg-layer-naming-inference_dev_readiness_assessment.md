# cg-layer-naming-inference Development Readiness Assessment

## Executive Summary
- Goal: Implement semantic naming inference for Layer 5/6/7 based on directory patterns
- Artifacts analyzed: 6 documents
  - proposal.md, design.md, tasks.md
  - specs/layer-naming/spec.md, specs/architecture-layers/spec.md
  - openspec/specs/architecture-layers/spec.md (related)
- Overall assessment: **可开发但有风险** (Ready with Risks)
- Critical issues: 3 Blocking, 5 Risk, 2 Suggestion
- Recommended actions: Fix blocking issues before implementation, document aggregation logic and complete DEFAULT_NAMING_RULES

## Artifact Coverage Map

| Document | Relation | Content Coverage |
|----------|----------|------------------|
| proposal.md | Direct | Problem definition, capabilities, impact scope |
| design.md | Direct | 4 key decisions, flow, risks/trade-offs |
| tasks.md | Direct | 7 task sections, 33 subtasks |
| specs/layer-naming/spec.md | Direct | ADDED requirements, 5 requirement sections, 18 scenarios |
| specs/architecture-layers/spec.md | Direct | MODIFIED requirements for LayerAssignment |
| openspec/specs/architecture-layers/spec.md | Indirect | Original spec for context, layer inference base |

## Issue Analysis

### Blocking Issues (阻止开发)

| # | Issue | Location | Original Content | Impact | Resolution |
|---|-------|----------|------------------|--------|------------|
| B1 | Aggregation logic undefined | tasks.md:2.6, spec.md:N/A | "Add function to infer role name from multiple groups (aggregate group names in layer)" | Cannot implement - how to aggregate multiple group names into single role? | Define aggregation algorithm: Option A) Priority-based (highest priority group determines role); Option B) Comma-separated list ("API, Service Layer"); Option C) Layer number suffix with primary role ("API Layer (5)"); **Recommended: Option A** - simpler, matches design intent |
| B2 | DEFAULT_NAMING_RULES incomplete | tasks.md:1.3, design.md:55-62 | "Define DEFAULT_NAMING_RULES with 12 common patterns" but only 6 shown in design | Missing 6 patterns - cannot implement complete table | Define all 12 patterns: Add infrastructure, config, types, models, hooks, middleware patterns; **Recommended: Complete table in design.md before coding** |
| B3 | Config schema missing | tasks.md:3.1, design.md:89-95 | "Update config schema to support namingRules field" | No schema definition - what fields required? validation rules? | Define JSON schema: `{ namingRules?: Array<{ pattern: string, role: string, priority: number }> }`; **Recommended: Add schema section to design.md Decision 4** |

### Risk Issues (可能引发bug)

| # | Issue | Location | Original Content | Impact | Resolution |
|---|-------|----------|------------------|--------|------------|
| R1 | Exact match preference unclear | tasks.md:2.4, spec.md:65-67 | "Implement exact match preference over substring match" | Algorithm undefined - priority adjustment? regex anchoring? | Define exact match detection: Option A) Check if pattern starts with `^` and ends with `$`; Option B) Add `exactMatch: boolean` field; Option C) Auto-boost exact patterns by +5 priority; **Recommended: Option A** - detect anchoring, implicit exact |
| R2 | Confidence tracking missing in spec | design.md:99, spec.md:N/A | "Confidence tracking + fallback to generic name" in design, but no spec requirement | May skip important feature | Add spec requirement: "Naming confidence SHALL be tracked based on pattern match strength"; **Recommended: Add to layer-naming spec.md** |
| R3 | Priority vs exact match conflict | spec.md:60-67, design.md:37 | "higher priority wins" AND "exact match preferred" | Which wins: exact(priority=5) or fuzzy(priority=10)? | Clarify resolution order: 1) Exact match check, 2) Priority comparison, 3) First match fallback; **Recommended: Exact check first, then priority** |
| R4 | Integration data flow unclear | design.md:69-73, tasks.md:4.3 | "Pass layer groups to inference function for role aggregation" | What data structure passed? Single group name or array? | Define interface: `inferLayerRoleNames(groups: string[], layerNum: number, rules?)`; **Recommended: Pass group array, aggregate in function** |
| R5 | 80% accuracy metric undefined | design.md:22, tasks.md:7.3 | "Maintain 80%+ naming accuracy" | No test cases, no measurement method | Define accuracy metric: Correct naming / total layers 5+; Add test dataset; **Recommended: Create test fixtures with known expected names** |

### Suggestion Issues (改进建议)

| # | Issue | Location | Original Content | Impact | Resolution |
|---|-------|----------|------------------|--------|------------|
| S1 | "common" pattern ambiguous | design.md:61 | `pattern: '^(utils|helpers|common)$'` | "common" could match unintended directories | Refine pattern: `^(utils|helpers|lib-common)$` or add disclaimer; **Recommended: Keep current, document ambiguity in design.md** |
| S2 | CLI output format unspecified | tasks.md:5.1-5.2 | "Update CLI output to display semantic names" | Exact format? Table? Tree? | Reference existing CLI format; Add example output in tasks.md; **Recommended: Add output example snippet** |

## Ambiguity Decisions Required

| Ambiguity | Options | Default Assumption | Decision Owner |
|-----------|---------|-------------------|----------------|
| Aggregation algorithm | Priority-based, Comma-separated, Layer suffix | Priority-based | Developer |
| Exact match detection | Regex anchoring check, explicit flag, priority boost | Regex anchoring | Developer |
| Confidence threshold | Not defined | Skip if < 50 | Developer |
| Integration interface | Single group or array | Array | Developer |

## Document Update Plan

### Updates to Existing Documents

| Document | Action | Content to Preserve | Content to Fix |
|----------|--------|---------------------|----------------|
| design.md | Add sections | All decisions, risks, flow | Add: Aggregation algorithm (Decision 5), Complete DEFAULT_NAMING_RULES table, Config JSON schema |
| specs/layer-naming/spec.md | Add requirements | All existing scenarios | Add: Aggregation requirement, Confidence tracking requirement |
| tasks.md | Refine | All task structure | Refine: Task 2.6 aggregation detail, Add config schema task detail |

### New Documents to Create

| Document Type | Purpose | Key Content |
|---------------|---------|-------------|
| None required | All content fits existing structure | N/A |

## Developer Checklist

Pre-development verification:
- [ ] Read design.md Decision 1-4, understand pattern-based approach
- [ ] Clarify aggregation algorithm (Decision Owner must decide)
- [ ] Complete DEFAULT_NAMING_RULES to 12 patterns
- [ ] Define config JSON schema
- [ ] Define exact match detection method
- [ ] Create test fixtures for accuracy measurement
- [ ] Verify backward compatibility with LayerAssignment.role type

## Recommendations Priority

1. **HIGH**: Fix B1 (Aggregation logic) - blocking implementation
2. **HIGH**: Fix B2 (Complete DEFAULT_NAMING_RULES) - incomplete spec
3. **HIGH**: Fix B3 (Config schema) - required for implementation
4. **MEDIUM**: Fix R1-R5 - reduce bug risk
5. **LOW**: Address S1-S2 - quality improvements

## Appendix: Artifact Summary (NOT Full Contents)

### proposal.md Key Points
- Problem: Layer 5/6/7 show generic names
- Solution: Directory-based naming inference
- Capabilities: layer-naming (new), architecture-layers (modified)
- Dependencies: C8/P1 layer inference, DEPTH_PRESETS

### design.md Key Points
- Decision 1: Pattern-based rules table with priority
- Decision 2: Rule structure `{ pattern, role, priority }`
- Decision 3: Integration after layer assignment
- Decision 4: Config extension in .codegraph/config.json
- 6 example patterns shown, 12 claimed
- Risks: collision, false positive, uncommon names

### tasks.md Key Points
- 7 sections: Naming Rules, Layer Inference, Config, Core Integration, CLI, Tests, E2E
- 33 subtasks total
- Key ambiguity: Task 2.6 "aggregate group names"

### specs/layer-naming/spec.md Key Points
- 5 requirement sections, 18 scenarios
- Covers: inference, rules structure, matching, config, validation
- Missing: aggregation for multiple groups, confidence

### specs/architecture-layers/spec.md Key Points
- MODIFIED: LayerAssignment.role field
- Semantic names for layers 5+
- Fallback to "Layer N"

---

**Assessment Version**: v1.0
**Generated**: 2026-05-07
**Status**: Ready with Risks - Fix blocking issues before implementation