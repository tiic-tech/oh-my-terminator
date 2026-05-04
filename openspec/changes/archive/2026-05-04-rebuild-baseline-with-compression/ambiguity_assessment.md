# rebuild-baseline-with-compression Development Readiness Assessment

## Executive Summary

- **Goal**: Implement baseline compression (ID deduplication, JSDoc truncate, path table, edge batching)
- **Artifacts analyzed**: proposal.md, design.md, 4 spec files, tasks.md, existing types.ts
- **Overall assessment**: 🟡 **可开发但有风险** - 存在架构一致性问题需先解决
- **Critical issues**: 2 blocking + 5 risk + 3 suggestions
- **Recommended actions**: 修复架构一致性问题后再开始实现

## Artifact Coverage Map

| Document | Path | 关联度 | 状态 |
|----------|------|--------|------|
| proposal.md | openspec/changes/rebuild-baseline-with-compression/proposal.md | 直接 | ✓ 完整 |
| design.md | openspec/changes/rebuild-baseline-with-compression/design.md | 直接 | ⚠ 有Open Questions |
| specs/baseline-compression/spec.md | specs/baseline-compression/spec.md | 直接 | ✓ 完整 |
| specs/compression-config/spec.md | specs/compression-config/spec.md | 直接 | ✓ 完整 |
| specs/baseline-persistence/spec.md | specs/baseline-persistence/spec.md | 直接 | ✓ 完整 |
| specs/baseline-migration/spec.md | specs/baseline-migration/spec.md | 直接 | ✓ 完整 |
| tasks.md | tasks.md | 直接 | ⚠ 缺错误处理 |
| types.ts | src/types.ts | 间接 | 🔴 现有schema冲突 |

## Issue Analysis

### 🔴 Blocking Issues (阻止开发)

| # | Issue | Location | Original Content | Impact | Resolution |
|---|-------|----------|------------------|--------|------------|
| B1 | **SchemaVersion类型冲突** | types.ts:19-26 vs design.md:106-107 | types.ts定义SchemaVersion为 `{major, minor, patch}` 对象；design.md定义 `schemaVersion: "1.1"` 字符串 | 开发者无法直接使用现有类型 | **Resolution A**: 修改schema为字符串 `"1.1"` 格式（简单）<br>**Resolution B**: 保持对象格式，改为 `{major: 1, minor: 1, patch: 0}`（兼容现有）<br>**Recommended**: Resolution B，保持SemVer兼容 |
| B2 | **GraphEdge字段名不一致** | types.ts:143-144 vs design.md:116-117, specs:17 | types.ts使用 `from`/`to`；design/specs使用 `source`/`target`/`sourceIndex`/`targetIndex` | 压缩模块无法正确映射字段 | **Resolution**: 统一字段名。推荐保持 `from`/`to`，压缩格式改为 `fromIndex`/`toIndex` |

### 🟡 Risk Issues (可能引发bug)

| # | Issue | Location | Original Content | Impact | Resolution |
|---|-------|----------|------------------|--------|------------|
| R1 | **Open Questions未解决** | design.md:181-185 | 3个未解决问题：compression default? config location? Phase 2 timeline? | 开发时可能做出错误决策 | **已隐式解决**: tasks.md默认启用压缩，config在.codegraph/config.json。需更新design.md移除Open Questions |
| R2 | **JSDoc长度默认值冲突** | types.ts:79 vs specs/compression-config:6, design.md:64 | types.ts注释说"First 200 characters"；specs/design说默认100 chars | 实现时混淆限制值 | **Resolution**: 压缩配置默认100，types.ts注释保持200（原始解析限制），两者不同阶段 |
| R3 | **update命令压缩支持缺失** | specs/compression-config:20-35 vs tasks.md | specs只定义analyze命令压缩行为；tasks.md无update命令压缩任务 | update命令行为未定义 | **Resolution**: 添加tasks: `6.11 Add --compress/--no-compression flags to update command` |
| R4 | **Path table排序策略模糊** | specs/baseline-compression:43 | "sorted by frequency (most common paths first)" 无具体计算方式 | 实现排序逻辑分歧 | **Resolution Options**: A) 按节点引用次数排序；B) 按边缘引用次数排序；C) 按总引用次数排序<br>**Recommended**: Resolution C（节点+边缘引用总和） |
| R5 | **EXPORTS/CONTAINS边缘批处理范围** | design.md:125-145 vs specs/baseline-compression:55-66 | design只讨论IMPORTS batching；specs只要求IMPORTS_BATCH | 其他高频边缘是否批处理未定义 | **Resolution**: Phase 1仅批处理IMPORTS，Phase 2评估EXPORTS批处理需求 |
| R6 | **现有SerializedCodeGraph结构** | types.ts:157-168 vs design.md:104-119 | SerializedCodeGraph使用 `[id, node]` tuple格式，不是对象数组 | 压缩格式无法直接替换 | **Resolution**: 新增 `CompressedBaseline` 类型，与 `SerializedCodeGraph` 并存 |

### 🟢 Suggestion Issues (改进建议)

| # | Issue | Location | Original Content | Impact | Resolution |
|---|-------|----------|------------------|--------|------------|
| S1 | **tasks.md缺错误处理任务** | tasks.md | 无任务定义压缩相关错误（index越界、损坏baseline等） | 错误处理遗漏 | **Resolution**: 添加tasks: `2.23 Implement compression error handling (E_INDEX_OUT_OF_BOUNDS, E_CORRUPTED_BASELINE)` |
| S2 | **缺少性能基准测试** | tasks.md | 无compression性能bench任务 | 无法验证50ms解压目标 | **Resolution**: 添加tasks: `7.9 Benchmark decompression performance (target: <50ms for 1MB)` |
| S3 | **backward compat策略不完整** | design.md:176-179 vs specs | design提到rollback策略；specs未覆盖用户不想升级场景 | 用户可能被迫使用压缩 | **Resolution**: 文档说明 `--no-compression` 永久禁用压缩选项 |

## Ambiguity Decisions Required

| Ambiguity | Options | Default Assumption | Decision Owner | Status |
|-----------|---------|-------------------|----------------|--------|
| SchemaVersion格式 | 字符串 `"1.1"` vs 对象 `{major:1,minor:1}` | 对象格式（兼容现有） | Tech Lead | 🔴 需决策 |
| GraphEdge字段名 | from/to vs source/target | from/to（保持现有） | Tech Lead | 🔴 需决策 |
| Path table排序策略 | 节点引用/边缘引用/总和 | 总和引用 | Implementer | 🟡 可实现时决策 |
| update命令压缩行为 | 继承analyze设置/独立参数 | 继承analyze设置 | Implementer | 🟢 可延迟 |

## Document Update Plan

### Updates to Existing Documents

| Document | Action | Content to Preserve | Content to Fix |
|----------|--------|---------------------|----------------|
| design.md | 修改 | Decisions D1-D5 | 移除Open Questions；添加SchemaVersion/Edge字段决策；明确排序策略 |
| specs/baseline-compression/spec.md | 修改 | Requirements结构 | 统一字段名fromIndex/toIndex；明确path排序计算方式 |
| specs/baseline-migration/spec.md | 添加 | - | 添加backward compat场景（用户禁用压缩） |
| tasks.md | 添加 | - | 添加错误处理、性能bench、update压缩任务 |

### New Documents to Create

| Document Type | Purpose | Key Content |
|---------------|---------|-------------|
| - | 无需创建新文档 | 现有artifacts覆盖完整 |

## Developer Checklist

Pre-development verification items (必须完成才能开始实现):

- [ ] **B1解决**: SchemaVersion格式决策（字符串 vs 对象）
- [ ] **B2解决**: GraphEdge字段名统一（from/to vs source/target）
- [ ] **R1修复**: 更新design.md移除Open Questions，添加决策结论
- [ ] **R3添加**: update命令压缩支持任务
- [ ] **R6确认**: CompressedBaseline类型定义策略
- [ ] 验证types.ts现有结构兼容压缩设计
- [ ] 确认测试fixture准备策略（1.0 vs 1.1格式）

## Architecture Consistency Matrix

| 现有代码 | 压缩设计 | 一致性 | 需要修改 |
|---------|---------|--------|---------|
| `SchemaVersion` 对象 | `"1.1"` 字符串 | ❌ | design/spec改为对象或types改为字符串 |
| `GraphEdge.from/to` | `source/target/sourceIndex` | ❌ | design/spec改为fromIndex/toIndex |
| `ModuleMetadata.jsDoc` 200 chars | 压缩默认100 chars | ✅ | 不同阶段，无冲突 |
| `SerializedCodeGraph.nodes` tuple | 压缩nodes对象数组 | ⚠️ | 新增CompressedBaseline类型 |
| `CliErrorCode` enum | E_INVALID_CONFIG | ✅ | types.ts已预留扩展空间 |

## Appendix: Original Artifact Contents (Key Sections)

### types.ts SchemaVersion (line 19-26)
```typescript
export interface SchemaVersion {
  /** Major version - breaking changes require migration or rebuild */
  major: number;
  /** Minor version - backward compatible new features */
  minor: number;
  /** Patch version - backward compatible fixes */
  patch: number;
}
```

### types.ts GraphEdge (line 141-150)
```typescript
export interface GraphEdge {
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Edge type */
  type: EdgeType;
  /** Optional metadata */
  metadata?: EdgeMetadata;
}
```

### types.ts SerializedCodeGraph (line 157-168)
```typescript
export interface SerializedCodeGraph {
  /** Nodes as array of [id, node] tuples (Map-compatible format) */
  nodes: [string, GraphNode][];
  /** All edges */
  edges: GraphEdge[];
  /** Git commit hash this graph represents */
  commitHash: string;
  /** Timestamp when graph was generated */
  timestamp: number;
  /** Optional schema version for compatibility tracking (C6) */
  schemaVersion?: SchemaVersion;
}
```

### design.md Schema Example (line 104-119)
```json
{
  "schemaVersion": "1.1",
  "pathTable": [
    "src/analyzer.ts",
    "src/types.ts",
    "node_modules/react/index.js"
  ],
  "nodes": [
    {"type": "FILE", "pathIndex": 0}
  ],
  "edges": [
    {"type": "IMPORTS", "sourceIndex": 0, "targetIndex": 2}
  ]
}
```

---

**Generated**: 2026-05-04
**Analyzer**: ambiguity-clarify SKILL
**Status**: 需用户决策后可开始实现