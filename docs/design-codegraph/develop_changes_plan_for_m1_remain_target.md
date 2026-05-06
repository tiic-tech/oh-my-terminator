# M1剩余工作OpenSpec Change规划

> **文档定位**: 基于 `hybrid-layer-inference-design.md` P0/P1任务清单，规划M1剩余工作所需的OpenSpec change拆分。

---

## 目录

1. [现状分析](#1-现状分析)
2. [P0任务清单](#2-p0任务清单)
3. [P1任务清单](#3-p1任务清单)
4. [新OpenSpec Change建议](#4-新openspec-change建议)
5. [Change创建顺序建议](#5-change创建顺序建议)
6. [与C11/C12的关系](#6-与c11c12的关系)

---

## 1. 现状分析

### 1.1 已完成OpenSpec Changes（归档）

| Change ID | Change名称 | 归档位置 | 状态 |
|-----------|-----------|---------|------|
| C1 | cg-core-graph-structure | archive/2026-05-03-cg-core-graph-structure | ✅ 已完成 |
| C2 | cg-file-system-scanner | archive/2026-05-03-cg-file-system-scanner | ✅ 已完成 |
| C3 | cg-ts-parser-imports | archive/2026-05-03-cg-ts-parser-imports | ✅ 已完成 |
| C4 | cg-ts-parser-modules | archive/2026-05-03-cg-ts-parser-modules | ✅ 已完成 |
| C5 | cg-full-analysis-flow | archive/2026-05-03-cg-full-analysis-flow | ✅ 已完成 |
| C6 | cg-baseline-persistence | archive/2026-05-03-cg-baseline-persistence | ✅ 已完成 |
| C7 | cg-api-scope | archive/2026-05-03-cg-api-scope | ✅ 已完成 |
| C8 | cg-api-impact-layers | archive/2026-05-05-cg-api-impact-layers | ✅ 已完成 |
| C9 | cg-cli-analyze-update | archive/2026-05-05-cg-cli-analyze-update | ✅ 已完成 |
| - | rebuild-baseline-with-compression | archive/2026-05-04-rebuild-baseline-with-compression | ✅ 已完成 |
| - | fix-e2e-report-all-issues | archive/2026-05-05-fix-e2e-report-all-issues | ✅ 已完成 |
| P0 | cg-edge-case-handler | archive/2026-05-06-cg-edge-case-handler | ✅ 已完成 (2026-05-06归档) |
| P1 | cg-depth-presets | archive/2026-05-06-cg-depth-presets | ✅ 已完成 (2026-05-06归档) |
| P1 | cg-ts-import-type | archive/2026-05-06-cg-ts-import-type | ✅ 已完成 (2026-05-06归档) |
| C10 | cg-cli-query-archive | archive/2026-05-07-cg-cli-query-archive | ✅ 已完成 (2026-05-07归档) |

### 1.2 未归档的Change

| Change ID | Change名称 | 实现状态 | 备注 |
|-----------|-----------|---------|------|
| - | - | - | **所有Change已归档** |
| C11 | cg-mvp-test-coverage | ⚠️ 进行中 | **1006测试通过**，覆盖率报告缺失 |
| C12 | cg-mvp-documentation | ⚠️ 部分完成 | README.md(21KB)存在，docs目录存在 |

> **更新说明 (2026-05-07)**: C10 (cg-cli-query-commands) 已通过 cg-cli-query-archive change 完成验证并归档。

### 1.3 代码实现验证

```bash
# CLI命令文件已存在（C10实现验证）
ls packages/codegraph/src/cli/commands/
# 输出: analyze.ts, impact.ts, layers.ts, scope.ts, update.ts, migrate.ts, compression-stats.ts

# 注意: brief.ts 不存在（C10规划但未实现）

# 测试状态（C11部分实现）
cd packages/codegraph && npm test
# 输出: 1006 tests passing, coverage summary未显示百分比

# 文档状态（C12部分实现）
ls packages/codegraph/README.md
# 输出: 21KB comprehensive README

# P0任务已实现验证 (2026-05-06归档)
grep -r "handleEmptyProject\|handleSingleFileProject\|excludeTestFiles" packages/codegraph/src/
# 输出: 有匹配 (cg-edge-case-handler已实现)

# P1-DEPTH_PRESETS已实现验证 (2026-05-06归档)
grep "DEPTH_PRESETS" packages/codegraph/src/api/layers/inference/
# 输出: 有匹配 (cg-depth-presets已实现，动态阈值替换硬编码)

# P1-import type已实现验证 (2026-05-06归档)
grep "isTypeOnly" packages/codegraph/src/parser/ts-parser/
# 输出: 有匹配 (cg-ts-import-type已实现)
```

---

## 2. P0任务清单

### 2.1 P0任务状态表

| 任务ID | 任务名称 | 设计文档声称 | 实际代码状态 | 真实状态 | 需新Change |
|--------|---------|-------------|-------------|----------|-----------|
| P0-stderr分离 | stderr输出分离 | "已实现" | 仅json-formatter.ts注释 | 仅文档设计 | ❌ 可合并到C11 |
| P0-空项目处理 | handleEmptyProject() | "已实现" | **已实现** | ✅ 已完成 | ✅ cg-edge-case-handler (归档) |
| P0-单文件处理 | handleSingleFileProject() | "已实现" | **已实现** | ✅ 已完成 | ✅ cg-edge-case-handler (归档) |
| P0-测试文件排除 | excludeTestFiles()预过滤 | "已实现" | **已实现** | ✅ 已完成 | ✅ cg-edge-case-handler (归档) |

> **更新说明 (2026-05-06)**: P0-空项目/单文件/测试文件排除任务已通过 `cg-edge-case-handler` change 完成并归档。

### 2.2 P0任务详细分析

#### P0-stderr分离

**现状**: `json-formatter.ts` 仅注释 "caller handles stderr"，无实际分离逻辑。

**解决方案**: 在CLI命令层统一处理：
- stdout: 结构化JSON输出（`--json` flag）
- stderr: 错误信息、警告、进度日志

**建议**: 合并到 `cg-mvp-test-coverage` (C11) 的CLI测试验证中，无需独立change。

#### P0-空项目/单文件处理 ✅ 已完成

> **2026-05-06更新**: 通过 `cg-edge-case-handler` change 已实现完整edge case处理模块。

**归档位置**: `openspec/changes/archive/2026-05-06-cg-edge-case-handler/`

**交付文件**:
```
packages/codegraph/src/analyzer/
├── edge-case-detector.ts    # 特殊场景检测
├── empty-project-handler.ts # 空项目处理
├── single-file-handler.ts   # 单文件处理
└── test-file-excluder.ts    # 测试文件预过滤
```

#### ~~P0-空项目/单文件处理~~ (已删除，原为待实现内容)
}
```

**建议**: 创建独立change `cg-edge-case-handler`。

#### P0-测试文件排除

**现状**: `bfs-phases.ts` 的 `isTestFile()` 在遍历时过滤，非预过滤。

**解决方案**: 在分析入口预过滤：
```typescript
// 设计代码 - 待实现
function excludeTestFiles(files: string[]): string[] {
  return files.filter(f => !isTestFile(f));
}
```

**建议**: 合并到 `cg-edge-case-handler`。

---

## 3. P1任务清单

### 3.1 P1任务状态表

| 任务ID | 任务名称 | 预估工时 | 设计状态 | 代码状态 | 需新Change |
|--------|---------|---------|---------|---------|-----------|
| P1-Layer推断改进 Phase 1 | Source Root Discovery | 3h | 设计完成 | **未实现** | ⚠️ cg-layer-inference-pipeline |
| P1-Layer推断改进 Phase 2 | Dependency Score | 4h | 设计完成 | **未实现** | ⚠️ cg-layer-inference-pipeline |
| P1-Layer推断改进 Phase 3 | DEPTH_PRESETS配置表 | 2h | 设计完成 | **已实现** | ✅ cg-depth-presets (归档) |
| P1-Layer推断改进 Phase 4 | Layer Assignment | 4h | 设计完成 | **未实现** | ⚠️ cg-layer-inference-pipeline |
| P1-Layer推断改进 Phase 5 | Fallback & 预过滤 | 3h | 设计完成 | **未实现** | ⚠️ cg-layer-inference-pipeline |
| P1-TypeScript import type | ImportClause.isTypeOnly | 4h | 设计完成 | **已实现** | ✅ cg-ts-import-type (归档) |

> **更新说明 (2026-05-06)**: 
> - P1-Phase 3 (DEPTH_PRESETS) 已通过 `cg-depth-presets` change 完成并归档。
> - P1-TypeScript import type 已通过 `cg-ts-import-type` change 完成并归档。
> - P1-Phase 1/2/4/5 (Layer Inference Pipeline) 仍待实现。

### 3.2 P1任务详细分析

#### P1-Layer推断改进 Phase 3 ✅ 已完成

> **2026-05-06更新**: 通过 `cg-depth-presets` change 已实现动态阈值配置表。

**归档位置**: `openspec/changes/archive/2026-05-06-cg-depth-presets/`

**交付文件**:
```
packages/codegraph/src/api/layers/inference/
├── depth-presets.ts         # DEPTH_PRESETS配置表
├── project-scale-detector.ts # 项目规模检测
└── core.ts                  # 动态阈值选择逻辑
```

#### P1-TypeScript import type ✅ 已完成

> **2026-05-06更新**: 通过 `cg-ts-import-type` change 已实现import type检测。

**归档位置**: `openspec/changes/archive/2026-05-06-cg-ts-import-type/`

**交付文件**:
```
packages/codegraph/src/parser/ts-parser/
├── types.ts              # ImportKind类型定义
├── import-extractor.ts   # isTypeOnly检测扩展
```

#### P1-Layer推断改进 (Phase 1/2/4/5) ⚠️ 待实现

**核心问题**: `LAYER_THRESHOLD = 2` 硬编码无依据，Layer推断质量影响C8 API核心功能。

**设计路径**（来自 `hybrid-layer-inference-design.md`）:

```
packages/codegraph/src/api/layers/inference/
├── core.ts               # [M1 P1] DEPTH_PRESETS配置
├── source-root.ts        # [M1 P1] Phase 1 信号检测
├── dependency-score.ts   # [M1 P1] Phase 2 循环检测
├── layer-assignment.ts   # [M1 P1] Phase 4 动态阈值
└── fallback.ts           # [M1 P1] Phase 5 预过滤器
```

**建议拆分策略**:

| Change名称 | 覆盖Phase | 工时 | 原因 |
|-----------|----------|------|------|
| cg-depth-presets | Phase 3 | 2h | 最快见效，替换硬编码，独立验证 |
| cg-layer-inference-pipeline | Phase 1/2/4/5 | 14h | 逻辑紧密耦合，独立验证困难 |

#### P1-TypeScript import type

**核心问题**: Parser未利用 `ImportClause.isTypeOnly` 检测 `import type` 语句。

**设计代码**（来自设计文档）:

```typescript
// 设计代码 - 待实现
// packages/codegraph/src/parser/ts-parser/import-extractor.ts
if (importClause.isTypeOnly) {
  edgeMetadata.importKind = 'type-only';
}
```

**建议**: 创建独立change `cg-ts-import-type`，因修改parser层，与其他P1任务隔离。

---

## 4. 新OpenSpec Change建议

### 4.1 Change拆分总表

| Change名称 | 类型 | 覆盖任务 | 预估工时 | 优先级 | 状态 | 归档位置 |
|-----------|------|---------|---------|--------|------|---------|
| cg-edge-case-handler | [CORE] | P0-空项目/单文件/测试排除 | 4h | P0 | ✅ 已完成 | archive/2026-05-06-cg-edge-case-handler |
| cg-depth-presets | [CORE] | P1-Phase 3 | 2h | P1 | ✅ 已完成 | archive/2026-05-06-cg-depth-presets |
| cg-layer-inference-pipeline | [CORE] | P1-Phase 1/2/4/5 | 14h | P1 | ⚠️ 待实现 | - |
| cg-ts-import-type | [PARSER] | P1-import type | 4h | P1 | ✅ 已完成 | archive/2026-05-06-cg-ts-import-type |
| cg-cli-query-archive | [CLI] | C10归档 | 1h | P2 | ⚠️ 待实现 | - |
| cg-mvp-test-coverage | [TEST] | C11完善 | 4h | P2 | ⚠️ 待完善 | - |
| cg-mvp-documentation | [DOC] | C12完善 | 2h | P2 | ⚠️ 待完善 | - |

> **更新说明 (2026-05-06)**:
> - 已完成3个changes (P0/P1)，剩余4个changes待实现/完善
> - **剩余总工时**: 约21h (14+1+4+2)

### 4.2 各Change详细设计

#### Change 1: cg-edge-case-handler [CORE] ✅ 已完成

> **2026-05-06归档**: 已通过验证并归档到 `archive/2026-05-06-cg-edge-case-handler/`

**名称**: `cg-edge-case-handler`

**目标**: 处理空项目、单文件项目、测试文件预过滤等边缘场景

**范围**: (已实现)
- `detectSpecialCases()` 函数：检测空项目/单文件/正常项目
- `handleEmptyProject()` 函数：空项目友好提示
- `handleSingleFileProject()` 函数：单文件简化分析
- `excludeTestFiles()` 函数：预过滤测试文件
- CLI命令集成：analyze/update命令边缘场景处理

**交付文件**: (已交付)
```
packages/codegraph/src/analyzer/
├── edge-case-detector.ts    # 特殊场景检测
├── empty-project-handler.ts # 空项目处理
├── single-file-handler.ts   # 单文件处理
└── test-file-excluder.ts    # 测试文件预过滤
└── index.ts
├── cli/commands/
│   └── analyze.ts               # 集成edge case处理
│   └── update.ts                # 集成edge case处理
```

---

#### Change 2: cg-depth-presets [CORE] ✅ 已完成

> **2026-05-06归档**: 已通过验证并归档到 `archive/2026-05-06-cg-depth-presets/`

**名称**: `cg-depth-presets`

**目标**: 替换硬编码 `LAYER_THRESHOLD=2`，实现自适应深度配置表

**范围**: (已实现)
- `DEPTH_PRESETS` 配置表定义
- 项目规模检测函数（文件数统计）
- 动态阈值选择逻辑
- 配置扩展机制（`.codegraph/config.json`）

**交付文件**: (已交付)
```
packages/codegraph/src/api/layers/inference/
├── core.ts                  # 动态阈值选择逻辑
├── depth-presets.ts         # DEPTH_PRESETS配置表
└── project-scale-detector.ts # 项目规模检测
```

---

#### Change 3: cg-layer-inference-pipeline [CORE] ⚠️ 待实现

**名称**: `cg-layer-inference-pipeline`

**目标**: 完整实现Hybrid Inference Pipeline (Phase 1/2/4/5)

**范围**:
- Phase 1: Source Root Discovery
  - 信号检测系统（PACKAGE_JSON=+10, TS_CONFIG=+8, TYPICAL_DIR=+15）
  - 排除列表（node_modules, dist, test, tests等）
- Phase 2: Dependency Score Calculation
  - 循环检测与惩罚机制
  - 外部依赖排除
  - 动态导入惩罚
- Phase 4: Layer Assignment
  - 动态阈值（基于DEPTH_PRESETS）
  - 模糊匹配算法
  - 置信度追踪
- Phase 5: Fallback & Suggestions
  - Agent Prompt生成
  - 预过滤器集成
  - 默认降级逻辑

**依赖**: cg-depth-presets

**预计工期**: 14h

**验证标准**:
- tests/目录不再误判为源码根
- 循环依赖正确检测并惩罚
- Layer推断置信度输出
- Agent可理解的建议文本
- E2E测试验证推断质量提升

**交付文件**:
```
packages/codegraph/src/api/layers/inference/
├── source-root.ts           # Phase 1
├── dependency-score.ts      # Phase 2
├── layer-assignment.ts      # Phase 4
├── fallback.ts              # Phase 5
├── core.ts                  # 整合Pipeline
└── index.ts                 # 导出
```

---

#### Change 4: cg-ts-import-type [PARSER] ✅ 已完成

> **2026-05-06归档**: 已通过验证并归档到 `archive/2026-05-06-cg-ts-import-type/`

**名称**: `cg-ts-import-type`

**目标**: 利用TypeScript Compiler API检测 `import type` 语句

**范围**: (已实现)
- `ImportClause.isTypeOnly` 检测
- IMPORTS边metadata扩展（`importKind: 'type-only'`）
- 类型导入与值导入分离统计
- CLI输出展示类型导入信息

**交付文件**: (已交付)
```
packages/codegraph/src/parser/ts-parser/
├── types.ts              # ImportKind类型定义
├── import-extractor.ts   # 扩展isTypeOnly检测
```

**测试覆盖**: 5 E2E tests, 29 total tests added

---

#### Change 5: cg-cli-query-archive [CLI] ⚠️ 待实现

**交付文件**:
```
packages/codegraph/src/parser/ts-parser/
├── import-extractor.ts      # 扩展isTypeOnly检测
└── import-type-detector.ts  # 类型导入处理
```

---

#### Change 5: cg-cli-query-archive [CLI]

**名称**: `cg-cli-query-archive`

**目标**: 补充C10归档，确认CLI query commands实现状态

**范围**:
- 验证C10实现完整性（scope/impact/layers命令）
- 补充brief命令（如未实现）
- 创建归档文档
- E2E验证CLI query commands

**依赖**: 无

**预计工期**: 1h

**验证标准**:
- 所有query命令通过E2E测试
- 归档文档完整
- brief命令实现或确认不实现

**备注**: brief命令在develop_changes_plan.md中规划，但当前代码未发现实现。需确认是否需要补充。

---

#### Change 6: cg-mvp-test-coverage [TEST]

**名称**: `cg-mvp-test-coverage`

**目标**: 完善测试覆盖，达到80%覆盖率，补充P0/P1任务测试

**范围**:
- 现有测试覆盖率报告配置
- P0/P1新增功能的单元测试
- 集成测试补充
- stderr分离验证（合并P0-stderr分离）

**依赖**: 所有P0/P1 changes完成后

**预计工期**: 4h

**验证标准**:
- 测试覆盖率 ≥ 80%
- 所有P0/P1功能有对应测试
- stderr/stdout分离正确验证

---

#### Change 7: cg-mvp-documentation [DOC]

**名称**: `cg-mvp-documentation`

**目标**: 完善M1文档，补充P0/P1功能文档

**范围**:
- README.md更新（P0/P1功能说明）
- API使用示例更新
- CLI使用指南更新
- 架构简图更新

**依赖**: 所有P0/P1 changes完成后

**预计工期**: 2h

**验证标准**:
- 文档覆盖所有M1功能
- 示例可执行
- 新用户可快速上手

---

## 5. Change创建顺序建议

> **2026-05-06更新**: Phase A和Phase B已完成，当前应执行Phase C

### 5.1 拓扑顺序（按依赖关系）

```
✅ Phase A: P0边缘处理（已完成 2026-05-06）
┌─────────────────────────────────────────────────────────────┐
│  1. cg-edge-case-handler [CORE] ✅                            │
│     ├─ handleEmptyProject()                                  │
│     ├─ handleSingleFileProject()                             │
│     └─ excludeTestFiles()                                    │
│     归档: archive/2026-05-06-cg-edge-case-handler            │
└─────────────────────────────────────────────────────────────┘

✅ Phase B: P1基础层（已完成 2026-05-06）
┌─────────────────────────────────────────────────────────────┐
│  2a. cg-depth-presets [CORE] ✅      2b. cg-ts-import-type ✅│
│      ├─ 替换硬编码                   ├─ Parser扩展           │
│      ├─ 配置表                       ├─ isTypeOnly检测       │
│      归档: 2026-05-06-cg-depth-presets  归档: 2026-05-06-cg-ts-import-type │
└─────────────────────────────────────────────────────────────┘

⚠️ Phase C: P1核心层（待实现）
┌─────────────────────────────────────────────────────────────┐
│  3. cg-layer-inference-pipeline [CORE] ⚠️                    │
│     ├─ Phase 1: Source Root Discovery                        │
│     ├─ Phase 2: Dependency Score                             │
│     ├─ Phase 4: Layer Assignment                             │
│     ├─ Phase 5: Fallback                                     │
│     预估: 14h                                                 │
│     依赖: cg-depth-presets ✅                                 │
│                                                             │
│  ⮕ 建议下一步执行此change                                     │
└─────────────────────────────────────────────────────────────┘

⚠️ Phase D: C10归档（待实现）
┌─────────────────────────────────────────────────────────────┐
│  4. cg-cli-query-archive [CLI] ⚠️                            │
│     ├─ 验证C10实现                                           │
│     ├─ 补充归档文档                                           │
│     预估: 1h                                                  │
│     依赖: 无                                                  │
│                                                             │
│  注: 可与Phase C并行执行                                      │
└─────────────────────────────────────────────────────────────┘

⚠️ Phase E: 测试与文档（依赖所有前序）
┌─────────────────────────────────────────────────────────────┐
│  5. cg-mvp-test-coverage [TEST] ⚠️                           │
│     预估: 4h                                                  │
│     依赖: Phase C                                             │
│                                                             │
│  6. cg-mvp-documentation [DOC] ⚠️                            │
│     预估: 2h                                                  │
│     依赖: Phase A, B, C                                       │
│                                                             │
│  注: 5和6可并行执行                                           │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 执行建议表

> **2026-05-06更新**: Phase A/B已完成，剩余工时21h

| 执行阶段 | Change | 工时 | 并行度 | 状态 | 备注 |
|---------|--------|------|--------|------|------|
| ✅ Week 1 Day 1 | cg-edge-case-handler | 4h | 串行 | ✅ 已完成 | 归档 2026-05-06 |
| ✅ Week 1 Day 2-3 | cg-depth-presets + cg-ts-import-type | 6h | 并行 | ✅ 已完成 | 归档 2026-05-06 |
| ⚠️ Week 1 Day 4-5 | cg-layer-inference-pipeline | 14h | 串行 | ⚠️ 待执行 | **建议下一步** |
| ⚠️ Week 2 Day 1 | cg-cli-query-archive | 1h | 并行 | ⚠️ 待执行 | 可与Phase C并行 |
| ⚠️ Week 2 Day 2 | cg-mvp-test-coverage + cg-mvp-documentation | 6h | 并行 | ⚠️ 待执行 | 测试与文档 |

**已完成工时**: 10h (4+6)
**剩余总工时**: 约21h (14+1+4+2)

---

## 6. 与C11/C12的关系

### 6.1 C11 (cg-mvp-test-coverage) 整合策略

**原C11范围**（develop_changes_plan.md）:
- 图结构单元测试补充
- 解析器测试
- API测试
- 集成测试
- 测试覆盖率报告

**新C11范围扩展**:
- P0/P1新增功能的单元测试
- Layer推断质量E2E测试
- stderr/stdout分离验证（合并P0-stderr分离）
- 80%覆盖率目标验证

**建议**: C11在所有P0/P1 changes完成后执行，统一验证M1完整功能。

> **2026-05-06状态**: P0/P1部分已完成(edge-case-handler/depth-presets/ts-import-type)，待完成layer-inference-pipeline

### 6.2 C12 (cg-mvp-documentation) 整合策略

**原C12范围**（develop_changes_plan.md）:
- README.md编写
- API使用示例
- CLI使用指南
- 架构简图

**新C12范围扩展**:
- P0/P1功能文档补充 (edge-case/depth-presets/import-type已实现，需文档)
- Layer推断配置说明 (待layer-inference-pipeline完成)
- Edge case处理说明 ✅ 已实现
- import type检测说明 ✅ 已实现

**建议**: C12在所有P0/P1 changes完成后执行，更新文档覆盖M1完整功能。

### 6.3 M1剩余工作总结 (2026-05-07更新)

```
┌─────────────────────────────────────────────────────────────┐
│                    M1剩余工作全景                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ 已完成C1-C10: 图结构、扫描、解析、API、CLI                   │
│  ✅ 已完成P0: edge case handler (4h) - 归档 2026-05-06       │
│  ✅ 已完成P1: depth presets (2h) - 归档 2026-05-06           │
│  ✅ 已完成P1: import type (4h) - 归档 2026-05-06             │
│  ✅ 已完成P1: layer inference pipeline (14h) - 归档 2026-05-07│
│  ✅ 已完成C10归档: cli-query-archive (1h) - 归档 2026-05-07  │
│                                                             │
│  ⚠️ 待完成:                                                   │
│  ├─ C11: test coverage完善 (4h) ← 下一步                      │
│  └─ C12: documentation完善 (2h)                             │
│                                                             │
│  已完成: 25h                                                 │
│  剩余总计: 6h                                                │
│                                                             │
│  测试状态: 1006 tests passing ✅                              │
│                                                             │
│  验收标准:                                                   │
│  ├─ 测试覆盖率 ≥ 80% ⚠️ (覆盖率报告待配置)                    │
│  ├─ E2E测试全通过 ✅                                         │
│  ├─ 文档覆盖所有M1功能 ⚠️                                    │
│  └─ Layer推断质量提升 ✅ (layer-inference-pipeline已完成)     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 附录 A: OpenSpec Change命名规范

遵循 `develop_changes_plan.md` 命名规范：

```
cg-<功能名>

类型标记:
- [CORE]   核心基础设施
- [PARSER] 解析器相关
- [API]    情报API相关
- [CLI]    命令行接口
- [TEST]   测试覆盖
- [DOC]    文档补充
- [INFRA]  工程/构建相关
```

---

## 附录 B: 关键代码证据 (2026-05-06更新)

### B.1 硬编码证据 ✅ 已修复

> **2026-05-06更新**: `cg-depth-presets` change已替换硬编码为动态阈值

```typescript
// packages/codegraph/src/api/layers/inference/core.ts
// 旧代码: const LAYER_THRESHOLD = 2;  # 已删除
// 新代码: const threshold = selectThresholdByScale(projectScale);
```

### B.2 import type已实现 ✅

> **2026-05-06更新**: `cg-ts-import-type` change已实现

```bash
grep -r "isTypeOnly" packages/codegraph/src/parser/ts-parser/
# 输出: 有匹配 (import-extractor.ts中实现)
```

### B.3 edge case函数已实现 ✅

> **2026-05-06更新**: `cg-edge-case-handler` change已实现

```bash
grep -r "handleEmptyProject\|handleSingleFileProject\|excludeTestFiles" packages/codegraph/src/analyzer/
# 输出: 有匹配 (edge-case-detector.ts等文件)
```

### B.4 CLI命令实现证据

```bash
ls packages/codegraph/src/cli/commands/
# 输出: analyze.ts, impact.ts, layers.ts, scope.ts, update.ts, migrate.ts
# 注意: brief.ts 不存在
```

---

**文档版本**: v1.1 (2026-05-06更新)
**创建日期**: 2026-05-05
**最后更新**: 2026-05-06 (反映已完成changes)
**关联文档**:
- [hybrid-layer-inference-design.md](../../packages/codegraph/docs/design-codegraph/hybrid-layer-inference-design.md)
- [develop_changes_plan.md](./develop_changes_plan.md)
**用途**: 创建M1剩余工作OpenSpec change的依据