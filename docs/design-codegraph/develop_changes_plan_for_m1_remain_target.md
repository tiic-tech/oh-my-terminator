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
| P1 | cg-layer-inference-pipeline | archive/2026-05-07-cg-layer-inference-pipeline | ✅ 已完成 (2026-05-07归档) |
| C10 | cg-cli-query-archive | archive/2026-05-07-cg-cli-query-archive | ✅ 已完成 (2026-05-07归档) |
| C11 | cg-mvp-test-coverage | - | ✅ 已完成 (2026-05-07验证，92.74%覆盖率) |

### 1.2 待完成的Change

| Change ID | Change名称 | 实现状态 | 优先级 | 备注 |
|-----------|-----------|---------|--------|------|
| C13 | cg-complexity-calculation | ✅ 已完成 | P1 | 归档 2026-05-07 |
| C14 | cg-layer-naming-inference | ✅ 已完成 | P2 | 归档 2026-05-07 |

> **更新说明 (2026-05-07 Session End)**: 
> - C10 (cg-cli-query-archive) 已归档
> - C11 (cg-mvp-test-coverage) 已完成验证，覆盖率 92.74% > 80%
> - C13 (cg-complexity-calculation) 已归档 2026-05-07
> - C14 (cg-layer-naming-inference) 已归档 2026-05-07
> - stderr分离（cg-stderr-model）已归档
> - **E2E Round3**: 发现新问题（CLI UX + source-root检测）

### 1.3 代码实现验证

```bash
# CLI命令文件已存在（C10实现验证）
ls packages/codegraph/src/cli/commands/
# 输出: analyze.ts, impact.ts, layers.ts, scope.ts, update.ts, migrate.ts, compression-stats.ts

# 注意: brief.ts 不存在（C10规划但未实现）

# 测试状态（C11已完成）
cd packages/codegraph && npm test
# 输出: 997 tests passing, 覆盖率 92.74% > 80%

# 文档状态（C12待完善）
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

#### ~~P0-测试文件排除~~ ✅ 已完成

> **2026-05-06更新**: 通过 `cg-edge-case-handler` change 已实现测试文件预过滤。

**归档位置**: `openspec/changes/archive/2026-05-06-cg-edge-case-handler/`

**交付文件**:
```
packages/codegraph/src/analyzer/
└── test-file-excluder.ts    # 测试文件预过滤
```

---

## 3. P1任务清单

### 3.1 P1任务状态表

| 任务ID | 任务名称 | 预估工时 | 设计状态 | 代码状态 | 需新Change |
|--------|---------|---------|---------|---------|-----------|
| P1-Layer推断改进 Phase 1 | Source Root Discovery | 3h | 设计完成 | **已实现** | ✅ cg-layer-inference-pipeline (归档) |
| P1-Layer推断改进 Phase 2 | Dependency Score | 4h | 设计完成 | **已实现** | ✅ cg-layer-inference-pipeline (归档) |
| P1-Layer推断改进 Phase 3 | DEPTH_PRESETS配置表 | 2h | 设计完成 | **已实现** | ✅ cg-depth-presets (归档) |
| P1-Layer推断改进 Phase 4 | Layer Assignment | 4h | 设计完成 | **已实现** | ✅ cg-layer-inference-pipeline (归档) |
| P1-Layer推断改进 Phase 5 | Fallback & 预过滤 | 3h | 设计完成 | **已实现** | ✅ cg-layer-inference-pipeline (归档) |
| P1-TypeScript import type | ImportClause.isTypeOnly | 4h | 设计完成 | **已实现** | ✅ cg-ts-import-type (归档) |
| **P1-复杂度计算** | Cyclomatic Complexity | 4h | 📋 待设计 | 未实现 | 📋 cg-complexity-calculation (C13) |
| **P2-Layer命名推断** | Layer 5/6/7语义命名 | 3h | 📋 待设计 | 未实现 | 📋 cg-layer-naming-inference (C14) |

> **更新说明 (2026-05-07 E2E Round2)**: 
> - P1-Phase 1/2/3/4/5 全部已通过 `cg-layer-inference-pipeline` change 完成并归档。
> - P1-TypeScript import type 已通过 `cg-ts-import-type` change 完成并归档。
> - **新增**: P1-复杂度计算、P2-Layer命名推断 基于E2E第二轮测试反馈

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

#### P1-Layer推断改进 (Phase 1/2/4/5) ✅ 已完成

> **2026-05-07归档**: 已通过 `cg-layer-inference-pipeline` change 完成并归档。

**归档位置**: `openspec/changes/archive/2026-05-07-cg-layer-inference-pipeline/`

**交付文件**:
```
packages/codegraph/src/api/layers/inference/
├── source-root.ts        # Phase 1 信号检测
├── dependency-score.ts   # Phase 2 循环检测
├── layer-assignment.ts   # Phase 4 动态阈值
├── fallback.ts           # Phase 5 预过滤器
├── core.ts               # 整合Pipeline
└── index.ts              # 导出
```

---

## 4. 新OpenSpec Change建议

### 4.1 Change拆分总表

| Change名称 | 类型 | 覆盖任务 | 预估工时 | 优先级 | 状态 | 归档位置 |
|-----------|------|---------|---------|--------|------|---------|
| cg-edge-case-handler | [CORE] | P0-空项目/单文件/测试排除 | 4h | P0 | ✅ 已完成 | archive/2026-05-06-cg-edge-case-handler |
| cg-depth-presets | [CORE] | P1-Phase 3 | 2h | P1 | ✅ 已完成 | archive/2026-05-06-cg-depth-presets |
| cg-layer-inference-pipeline | [CORE] | P1-Phase 1/2/4/5 | 14h | P1 | ✅ 已完成 | archive/2026-05-07-cg-layer-inference-pipeline |
| cg-ts-import-type | [PARSER] | P1-import type | 4h | P1 | ✅ 已完成 | archive/2026-05-06-cg-ts-import-type |
| cg-stderr-model | [CLI] | P0-stderr分离 | 3h | P0 | ✅ 已完成 | archive/2026-05-07-cg-stderr-model |
| cg-cli-query-archive | [CLI] | C10归档 | 1h | P2 | ✅ 已完成 | archive/2026-05-07-cg-cli-query-archive |
| cg-mvp-test-coverage | [TEST] | C11完善 | 4h | P2 | ✅ 已完成 | - |
| cg-mvp-documentation | [DOC] | C12完善 | 2h | P2 | ⚠️ 待完善 | - |
| **cg-complexity-calculation** | [ANALYZER] | P1-复杂度计算 | 4h | **P1** | 📋 待规划 | - |
| **cg-layer-naming-inference** | [CORE] | P2-Layer命名推断 | 3h | **P2** | 📋 待规划 | - |

> **更新说明 (2026-05-07 E2E Round2)**:
> - 已完成所有 P0/P1 changes 和 C10/C11
> - stderr分离通过 `cg-stderr-model` 完成
> - C11 测试覆盖率达标 (92.74% > 80%)
> - E2E评分: 8.65/10 → 9.5/10 (+0.85)
> - **新增**: C13/C14 基于E2E第二轮测试反馈
> - **剩余总工时**: 约9h (C12+C13+C14)

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

#### Change 3: cg-layer-inference-pipeline [CORE] ✅ 已完成

> **2026-05-07归档**: 已通过验证并归档到 `archive/2026-05-07-cg-layer-inference-pipeline/`

**名称**: `cg-layer-inference-pipeline`

**目标**: 完整实现Hybrid Inference Pipeline (Phase 1/2/4/5)

**范围**: (已实现)
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

**交付文件**: (已交付)
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
---

#### Change 5: cg-cli-query-archive [CLI] ✅ 已完成

> **2026-05-07归档**: 已通过验证并归档到 `archive/2026-05-07-cg-cli-query-archive/`

**名称**: `cg-cli-query-archive`

**目标**: 补充C10归档，确认CLI query commands实现状态

**范围**: (已实现)
- 验证C10实现完整性（scope/impact/layers/migrate命令）
- 创建归档文档
- E2E验证CLI query commands

**备注**: brief命令在develop_changes_plan.md中规划，当前确认scope/impact/layers/migrate命令已实现。

---

#### Change 6: cg-mvp-test-coverage [TEST] ✅ 已完成

> **2026-05-07验证**: 测试覆盖率达标 (92.74% > 80%)

**名称**: `cg-mvp-test-coverage`

**目标**: 完善测试覆盖，达到80%覆盖率

**验证结果**:
- Statements: 92.74% ✅
- Branches: 87.03% ✅
- Functions: 94.06% ✅
- Lines: 92.74% ✅
- 测试数量: 997 tests passing (301 suites)

---

#### Change 7: cg-mvp-documentation [DOC] ⚠️ 待完善

**名称**: `cg-mvp-documentation`

**目标**: 完善M1文档，补充P0/P1功能文档

**范围**: (待完成)
- README.md更新（P0/P1功能说明）
- API使用示例更新
- CLI使用指南更新
- 架构简图更新

**预计工期**: 2h

**验证标准**:
- 文档覆盖所有M1功能
- 示例可执行
- 新用户可快速上手

> **状态**: M1文档任务

---

#### Change 8: cg-complexity-calculation [ANALYZER] 📋 待规划

**名称**: `cg-complexity-calculation`

**目标**: 实现代码复杂度计算，为scope命令的metadata提供有意义的复杂度值

**背景**: E2E第二轮测试发现，scope命令返回的metadata中complexity字段始终显示 `"level": "unknown", "value": 0`，缺少代码质量指标。

**范围**: (待设计)
- Cyclomatic Complexity计算算法
- 函数级复杂度统计
- 文件级复杂度聚合
- 复杂度等级分类（low/medium/high/critical）
- scope命令集成

**交付文件**: (规划)
```
packages/codegraph/src/analyzer/
├── complexity-calculator.ts   # 复杂度计算核心
├── complexity-levels.ts       # 等级分类配置
└── index.ts                   # 导出

packages/codegraph/src/api/scope/
└── metadata-builder.ts        # 复杂度字段集成
```

**验证标准**:
- scope命令返回有意义的复杂度值（非"unknown"）
- 复杂度等级合理分类
- 高复杂度文件可识别

**预计工期**: 4h

**优先级**: P1 (E2E报告反馈)

---

#### Change 9: cg-layer-naming-inference [CORE] 📋 待规划

**名称**: `cg-layer-naming-inference`

**目标**: 为Layer 5/6/7推断有意义名称，替代通用编号命名

**背景**: E2E第二轮测试发现，layers命令返回的高层级Layer使用通用名称（"Layer 5/6/7"），降低了架构理解价值。需要基于目录结构推断语义化名称。

**范围**: (待设计)
- 常见目录名称映射表（api→API层，persistence→数据层，cli→CLI层等）
- 基于职责推断Layer名称算法
- 配置扩展机制（自定义命名规则）
- layers命令集成

**交付文件**: (规划)
```
packages/codegraph/src/api/layers/inference/
├── layer-naming.ts            # Layer命名推断
├── naming-rules.ts            # 常见命名规则表
└── index.ts                   # 导出
```

**验证标准**:
- Layer 5/6/7显示有意义名称（如"API层"、"数据层"、"CLI层"）
- 名称推断准确率 > 80%
- 支持自定义命名规则

**预计工期**: 3h

**优先级**: P2 (E2E报告反馈)

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
✅ Phase C: P1核心层（已完成 2026-05-07）
┌─────────────────────────────────────────────────────────────┐
│  3. cg-layer-inference-pipeline [CORE] ✅                    │
│     ├─ Phase 1: Source Root Discovery                        │
│     ├─ Phase 2: Dependency Score                             │
│     ├─ Phase 4: Layer Assignment                             │
│     ├─ Phase 5: Fallback                                     │
│     归档: archive/2026-05-07-cg-layer-inference-pipeline     │
└─────────────────────────────────────────────────────────────┘

✅ Phase D: C10归档（已完成 2026-05-07）
┌─────────────────────────────────────────────────────────────┐
│  4. cg-cli-query-archive [CLI] ✅                            │
│     ├─ 验证C10实现                                           │
│     ├─ 补充归档文档                                           │
│     归档: archive/2026-05-07-cg-cli-query-archive            │
└─────────────────────────────────────────────────────────────┘

⚠️ Phase E: 测试与文档（C11已完成，C12待执行）
┌─────────────────────────────────────────────────────────────┐
│  5. cg-mvp-test-coverage [TEST] ✅                           │
│     覆盖率: 92.74% > 80%                                      │
│                                                             │
│  6. cg-mvp-documentation [DOC] ⚠️ ← 下一步                    │
│     预估: 2h                                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 执行建议表

> **2026-05-07 E2E Round2更新**: Phase A/B/C/D已完成，新增C13/C14任务规划

| 执行阶段 | Change | 工时 | 并行度 | 状态 | 备注 |
|---------|--------|------|--------|------|------|
| ✅ Week 1 Day 1 | cg-edge-case-handler | 4h | 串行 | ✅ 已完成 | 归档 2026-05-06 |
| ✅ Week 1 Day 2-3 | cg-depth-presets + cg-ts-import-type | 6h | 并行 | ✅ 已完成 | 归档 2026-05-06 |
| ✅ Week 1 Day 4-5 | cg-layer-inference-pipeline | 14h | 串行 | ✅ 已完成 | 归档 2026-05-07 |
| ✅ Week 2 Day 1 | cg-stderr-model | 3h | 串行 | ✅ 已完成 | 归档 2026-05-07 |
| ✅ Week 2 Day 1 | cg-cli-query-archive | 1h | 并行 | ✅ 已完成 | 归档 2026-05-07 |
| ✅ Week 2 Day 2 | cg-mvp-test-coverage | 4h | 串行 | ✅ 已完成 | 92.74%覆盖率 |
| ⚠️ Week 2 Day 3 | cg-mvp-documentation | 2h | 串行 | ⚠️ 待执行 | 文档完善 |
| 📋 Week 2 Day 4 | cg-complexity-calculation | 4h | 串行 | 📋 待规划 | **P1新任务** |
| 📋 Week 2 Day 5 | cg-layer-naming-inference | 3h | 串行 | 📋 待规划 | **P2新任务** |

**已完成工时**: 34h (4+6+14+3+1+4)
**剩余总工时**: 约9h (C12+C13+C14)

---

## 6. 与C11/C12的关系

### 6.1 C11 (cg-mvp-test-coverage) ✅ 已完成

> **2026-05-07验证**: 测试覆盖率达标 (92.74% > 80%)

**验证结果**:
| 指标 | 覆盖率 | 目标 | 状态 |
|------|--------|------|------|
| Statements | 92.74% | 80% | ✅ |
| Branches | 87.03% | 80% | ✅ |
| Functions | 94.06% | 80% | ✅ |
| Lines | 92.74% | 80% | ✅ |

**测试数量**: 997 tests passing (301 suites)

### 6.2 C12 (cg-mvp-documentation) ⚠️ 待完善

**范围**: (待完成)
- README.md更新（P0/P1功能说明）
- API使用示例更新
- CLI使用指南更新
- 架构简图更新

**建议**: C12是M1唯一剩余任务，完成后M1可交付。

### 6.3 M1剩余工作总结 (2026-05-07 E2E Round2更新)

```
┌─────────────────────────────────────────────────────────────┐
│                    M1工作全景 (2026-05-07 E2E Round2)          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ 已完成C1-C10: 图结构、扫描、解析、API、CLI                   │
│  ✅ 已完成P0: edge case handler (4h) - 归档 2026-05-06       │
│  ✅ 已完成P0: stderr分离 (3h) - 归档 2026-05-07              │
│  ✅ 已完成P1: depth presets (2h) - 归档 2026-05-06           │
│  ✅ 已完成P1: import type (4h) - 归档 2026-05-06             │
│  ✅ 已完成P1: layer inference pipeline (14h) - 归档 2026-05-07│
│  ✅ 已完成C10归档: cli-query-archive (1h) - 归档 2026-05-07  │
│  ✅ 已完成C11: test coverage (92.74%) - 2026-05-07          │
│                                                             │
│  ⚠️ 待完成:                                                   │
│  ├─ C12: documentation完善 (2h)                              │
│  ├─ C13: complexity calculation (4h) ← **P1新任务**          │
│  └─ C14: layer naming inference (3h) ← **P2新任务**          │
│                                                             │
│  已完成: 34h                                                 │
│  剩余总计: 9h                                                │
│                                                             │
│  测试状态: 1020 tests passing ✅                              │
│  覆盖率: 92.74% > 80% ✅                                     │
│  E2E评分: 9.5/10 ✅                                          │
│                                                             │
│  验收标准:                                                   │
│  ├─ 测试覆盖率 ≥ 80% ✅                                      │
│  ├─ E2E测试全通过 ✅                                         │
│  ├─ stderr分离验证 ✅                                        │
│  ├─ JSON纯度验证 ✅                                          │
│  ├─ 文档覆盖所有M1功能 ⚠️                                    │
│  ├─ 复杂度计算实现 📋                                        │
│  └─ Layer命名推断 📋                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 E2E第二轮测试反馈总结 (2026-05-07)

**评分提升**: 8.65/10 → **9.5/10** (+0.85)

**已解决问题**:
| 问题 | 状态 |
|-----|------|
| stdout警告噪音 | ✅ 已修复 (cg-stderr-model) |
| jq管道失败 | ✅ 已修复 |
| silent模式workaround | ✅ 不再需要 |

**新发现问题**:
| 问题 | 优先级 | 规划Change |
|-----|--------|-----------|
| 复杂度计算未实现 | P1 | C13: cg-complexity-calculation |
| Layer 5/6/7通用命名 | P2 | C14: cg-layer-naming-inference |
| layers命令需--source-root | P3 | 建议文档说明 |

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

## 附录 B: 关键代码证据 (2026-05-07更新)

### B.1 硬编码证据 ✅ 已修复

> **2026-05-06更新**: `cg-depth-presets` change已替换硬编码为动态阈值

### B.2 import type已实现 ✅

> **2026-05-06更新**: `cg-ts-import-type` change已实现

### B.3 edge case函数已实现 ✅

> **2026-05-06更新**: `cg-edge-case-handler` change已实现

### B.4 layer inference pipeline已实现 ✅

> **2026-05-07更新**: `cg-layer-inference-pipeline` change已实现

### B.5 CLI命令实现证据

> **2026-05-07更新**: `cg-cli-query-archive` 已验证CLI命令完整性

### B.6 测试覆盖率达标 ✅

> **2026-05-07验证**: 997 tests passing, 92.74% > 80%目标

---

**文档版本**: v1.5 (2026-05-07 E2E Round3更新)
**创建日期**: 2026-05-05
**最后更新**: 2026-05-07 (E2E Round3发现，新增C15/C16任务规划)
**关联文档**:
- [hybrid-layer-inference-design.md](../../packages/codegraph/docs/design-codegraph/hybrid-layer-inference-design.md)
- [develop_changes_plan.md](./develop_changes_plan.md)
- [codegraph-e2e-experience-report-round2.md](../e2e-report/codegraph-e2e-experience-report-round2.md)
- [codegraph-e2e-experience-report-round3.md](../e2e-report/codegraph-e2e-experience-report-round3.md)
**用途**: 创建M1剩余工作OpenSpec change的依据

---

## 附录 C: E2E Round3测试反馈 (2026-05-07)

### C.1 测试评分变化

| Round | 评分 | 主要发现 | 状态 |
|-------|------|----------|------|
| Round1 | 8.65/10 | stdout噪音、jq失败 | ✅ 已解决 |
| Round2 | 9.5/10 | JSON纯度达标、stderr分离 | ✅ 已验证 |
| **Round3** | **7.5/10** | CLI UX问题、source-root检测失败 | 🔴 新问题 |

### C.2 Round3发现的问题

#### 🔴 P1问题（阻塞发布）

| 问题 | 现象 | 根因分析 | 影响 |
|------|------|----------|------|
| **source-root默认值** | `layers`命令失败，需手动指定`--source-root packages/codegraph/src` | CLI默认值`'src'`阻止auto-detect触发 | Monorepo用户无法使用 |
| **无效命令无提示** | `codegraph invalid-command` → 空输出 | CLI未捕获CACError | UX差，用户困惑 |
| **错误显示堆栈** | `codegraph analyze --invalid-flag` → 原始Node.js堆栈 | CACError未包装 | 非专业用户无法理解 |

#### 🟡 P2问题（影响体验）

| 问题 | 现象 | 根因分析 | 影响 |
|------|------|----------|------|
| **路径格式不直观** | scope/impact需要完整路径`packages/codegraph/src/...` | 无路径提示帮助 | 用户不知道正确格式 |
| **缺少参数堆栈** | 缺少必需参数 → 原始堆栈 | 同P1错误处理问题 | 同上 |

### C.3 Round3通过项

| 测试项 | 状态 | 备注 |
|--------|------|------|
| JSON/stderr分离 | ✅ PASS | stdout纯JSON，stderr含警告，jq兼容 |
| C14语义命名 | ✅ PASS | Layer 5/6/7显示"API Layer"、"CLI Layer" |
| Verbose输出 | ✅ PASS | Pattern匹配信息正确显示 |
| analyze命令 | ✅ PASS | 1.5s执行，50%压缩 |
| update命令 | ✅ PASS | 178ms增量更新 |
| Performance | ✅ PASS | 所有命令<2s |

---

## 附录 D: Source-Root检测深度分析

### D.1 用户讨论愿景回顾

> **原始讨论**: 无论repo结构如何（规范repo `src/`、monorepo `packages/*/src`、不规范命名），codegraph都应该能检测或提供fallback情报给agent。

### D.2 当前代码三层Bug分析

```
┌─────────────────────────────────────────────────────────────┐
│                    Source-Root检测流程                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CLI层 (layers.ts line 72)                                  │
│  ├─ 默认值: sourceRoot: options?.sourceRoot ?? 'src'        │
│  │  ❌ Bug: 硬编码'src'传入API                               │
│  └─ 结果: auto-detect条件永远false                          │
│                                                             │
│  API层 (layers/index.ts line 156)                           │
│  ├─ 条件: if (!options?.sourceRoot && options?.projectRoot) │
│  │  ❌ Bug: 'src'已传入，条件不触发                          │
│  └─ 结果: 直接使用默认值'src'                                │
│                                                             │
│  Candidate层 (getCandidateDirectories line 108)             │
│  ├─ 逻辑: 从FILE nodes提取first-level subdirectories        │
│  │  ❌ Bug: monorepo只得到['packages']                      │
│  │  ❌ Bug: 无法检测packages/*/src深层结构                   │
│  └─ 结果: 候选列表不包含真实source-root                      │
│                                                             │
│  detectSourceRoot (source-root.ts)                          │
│  ├─ 设计: 加权信号评分 (src+15, package.json+10, tsconfig+8)│
│  ├─ ✅ 评分算法正确                                          │
│  └─ ❌ 问题: 输入candidates不正确，评分无用                  │
│                                                             │
│  情报输出                                                    │
│  ├─ ❌ Bug: candidates/confidence不返回CLI                  │
│  └─ ❌ Bug: agent无法获得决策情报                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### D.3 与愿景差距对比

| 愿景场景 | 当前实现 | Gap分析 |
|----------|----------|---------|
| **规范repo** `src/` | ✅ 理论可检测 | CLI Bug阻止触发，需修复默认值传递 |
| **monorepo** `packages/*/src` | ❌ 完全失败 | Candidate生成不支持深层检测 |
| **不规范repo** | ❌ 无情报 | confidence未暴露给用户/agent |
| **给agent情报** | ❌ 情报链断裂 | 检测结果未返回上层 |

### D.4 正确检测策略设计

```typescript
// 1. CLI层：不传默认值，让API决定
// layers.ts
sourceRoot: options?.sourceRoot  // 不设默认！

// 2. API层：正确逻辑
// layers/index.ts
let sourceRoot = options?.sourceRoot;  // 用户显式传入
if (!sourceRoot) {
  // Auto-detect: 递归搜索候选
  const candidates = discoverSourceRootCandidates(graph, projectRoot, {
    maxDepth: 3,  // 支持 packages/*/src
    signals: SIGNAL_WEIGHTS
  });
  const result = detectSourceRoot(candidates);
  sourceRoot = result.sourceRoot || 'src';  // 最终fallback
  
  // 返回情报给上层（重要！）
  layersOptions.sourceRootMeta = {
    detected: result.sourceRoot !== 'src',
    confidence: result.confidence,
    candidates: result.candidates.slice(0, 5),  // Top 5候选
  };
}

// 3. 深度搜索candidates
// 新函数
function discoverSourceRootCandidates(graph, root, options) {
  // 从FILE nodes遍历，提取深层候选
  // packages/codegraph/src/analyzer/index.ts
  // → candidates: ['packages/codegraph/src', 'packages/codegraph']
  
  // 同时检测monorepo结构
  // if (fs.existsSync('packages')) → 遍历packages/*/src
}
```

### D.5 情报输出设计

```typescript
// LayersResult扩展
interface LayersResult {
  // 现有字段...
  sourceRootMeta?: {
    detected: boolean;      // 是否自动检测
    confidence: number;     // 0-1置信度
    candidates: CandidateInfo[];  // Top 5候选
    fallbackUsed: boolean;  // 是否使用fallback
  };
}

// CLI输出示例
$ codegraph layers --verbose
Architecture Layers

Source Root: packages/codegraph/src (auto-detected, confidence: 0.9)
  Candidates: packages/codegraph/src (33), packages/codegraph (18), ...

Layer 1: Foundation...
```

---

## 附录 E: 新Change规划 (C15/C16)

### E.1 Change拆分总表（更新）

| Change ID | Change名称 | 类型 | 覆盖问题 | 预估工时 | 优先级 | 状态 |
|-----------|-----------|------|----------|---------|--------|------|
| C12 | cg-mvp-documentation | [DOC] | M1文档完善 | 2h | P2 | ⚠️ 待执行 |
| **C15** | **cg-cli-ux-improvement** | [CLI] | P1 CLI错误处理 + P2路径帮助 | 2-3h | **P1** | 📋 待规划 |
| **C16** | **cg-source-root-auto-detect** | [CORE] | P1 source-root检测 + 情报输出 | 2-3h | **P1** | 📋 待规划 |

**剩余总工时**: 约7-8h (C12+C15+C16)

### E.2 C15: cg-cli-ux-improvement 详细规划

**名称**: `cg-cli-ux-improvement`

**目标**: 修复CLI错误处理，提供友好用户体验

**覆盖问题**:
- P1-2: 无效命令无提示
- P1-3: 错误显示原始堆栈
- P2-1: 路径格式不直观
- P2-2: 缺少参数堆栈

**实现方案**:

```typescript
// 1. CLI入口错误包装
// bin/codegraph.ts
cli.on('error', (error) => {
  if (error instanceof CACError) {
    // 转换为友好消息
    const friendlyError = transformCACError(error);
    outputError(friendlyError, options?.json);
    return;
  }
  // 其他错误
  outputError(error, options?.json);
});

// 2. CACError转换函数
function transformCACError(error: CACError): CliError {
  if (error.message.includes('Unknown option')) {
    return {
      code: 'E_CLI_INVALID_FLAG',
      message: `Invalid flag '${extractFlag(error)}'. Available flags: --json, --source-root, --verbose`,
    };
  }
  if (error.message.includes('Unknown command')) {
    return {
      code: 'E_CLI_INVALID_COMMAND',
      message: `Unknown command '${extractCommand(error)}'. Available commands: analyze, update, layers, scope, impact`,
    };
  }
  // ...
}

// 3. 路径格式帮助
// commands/scope.ts / impact.ts
if (!targetExists) {
  return {
    code: 'E_TARGET_NOT_FOUND',
    message: `Target not found: ${target}. Try full path format: packages/<pkg>/src/<file>.ts`,
    suggestion: 'Use --list-targets to see available targets',
  };
}
```

**交付文件**:
```
packages/codegraph/bin/
├── codegraph.ts          # 错误包装入口
├── error-transformer.ts  # CACError转换函数
└── output-handlers.ts    # 错误输出处理

packages/codegraph/src/cli/commands/
├── scope.ts              # 路径格式帮助
└── impact.ts             # 路径格式帮助
```

**验证标准**:
- 无效命令显示可用命令列表
- 无效flag显示可用flag列表
- 路径错误提示正确格式
- 无原始堆栈显示

**预计工期**: 2-3h

---

### E.3 C16: cg-source-root-auto-detect 详细规划

**名称**: `cg-source-root-auto-detect`

**目标**: 重构source-root检测逻辑，支持多种repo结构 + 情报输出

**覆盖问题**:
- P1-1: source-root默认值阻止检测
- 深层候选生成（monorepo支持）
- 情报输出链（agent决策支持）

**实现方案**:

```typescript
// 1. CLI层修复
// commands/layers.ts
const layersOptions: LayersOptions = {
  sourceRoot: options?.sourceRoot,  // 不设默认！
  // ...
};

// 2. API层重构
// layers/index.ts
export function getArchitectureLayers(graph, options) {
  let sourceRoot = options?.sourceRoot;
  let sourceRootMeta: SourceRootMeta | undefined;
  
  if (!sourceRoot) {
    // 新增：深度候选发现
    const candidates = discoverSourceRootCandidates(graph, projectRoot, {
      maxDepth: 3,
      monorepoPatterns: ['packages/*/src', 'apps/*/src'],
    });
    
    const result = detectSourceRoot(candidates);
    sourceRoot = result.sourceRoot || 'src';
    
    // 情报输出（关键！）
    sourceRootMeta = {
      detected: result.sourceRoot !== 'src',
      confidence: result.confidence,
      topCandidates: result.candidates.slice(0, 5),
      fallbackUsed: result.confidence < 0.3,
    };
  }
  
  // 返回情报
  return {
    ...layersResult,
    sourceRootMeta,
  };
}

// 3. 深度候选发现函数
// layers/inference/source-root-discovery.ts (NEW)
export function discoverSourceRootCandidates(
  graph: CodeGraph,
  projectRoot: string,
  options: DiscoveryOptions
): string[] {
  const candidates: Set<string> = new Set();
  
  // 3.1 从FILE nodes提取候选
  for (const [, node] of graph.nodes) {
    if (node.type === NodeType.FILE && node.path) {
      // 深度提取: packages/codegraph/src/analyzer/...
      // → ['packages/codegraph/src', 'packages/codegraph', 'src']
      extractCandidatesFromPath(node.path, projectRoot, options.maxDepth)
        .forEach(c => candidates.add(c));
    }
  }
  
  // 3.2 Monorepo结构检测
  if (fs.existsSync(path.join(projectRoot, 'packages'))) {
    const packages = fs.readdirSync(path.join(projectRoot, 'packages'));
    packages.forEach(pkg => {
      const pkgSrc = path.join(projectRoot, 'packages', pkg, 'src');
      if (fs.existsSync(pkgSrc)) {
        candidates.add(pkgSrc);
      }
    });
  }
  
  // 3.3 标准结构检测
  ['src', 'lib', 'app'].forEach(name => {
    const dir = path.join(projectRoot, name);
    if (fs.existsSync(dir)) {
      candidates.add(dir);
    }
  });
  
  return Array.from(candidates);
}

// 4. 情报输出类型
// types/layers-types.ts
export interface SourceRootMeta {
  /** 是否自动检测成功 */
  detected: boolean;
  /** 置信度 0-1 */
  confidence: number;
  /** Top 5候选及其得分 */
  topCandidates: Array<{ path: string; score: number }>;
  /** 是否使用fallback */
  fallbackUsed: boolean;
}
```

**交付文件**:
```
packages/codegraph/src/api/layers/
├── index.ts                    # API层重构
├── inference/
│   ├── source-root.ts          # 现有评分逻辑（保持）
│   ├── source-root-discovery.ts # NEW: 深度候选发现
│   └── index.ts                # 导出

packages/codegraph/src/api/types/
├── layers-types.ts             # SourceRootMeta类型

packages/codegraph/src/cli/commands/
├── layers.ts                   # CLI层修复（不设默认值）

packages/codegraph/src/cli/output/
├── layers-formatter.ts         # 情报输出展示
```

**验证场景**:

| 场景 | 输入 | 预期输出 |
|------|------|----------|
| 规范repo `src/` | 无sourceRoot参数 | `src/` (confidence: 0.9) |
| Monorepo `packages/codegraph/src` | 无sourceRoot参数 | `packages/codegraph/src` (confidence: 0.85) |
| 不规范repo `lib/` | 无sourceRoot参数 | `lib/` (confidence: 0.7) |
| 深层monorepo `packages/*/src` | 无sourceRoot参数 | 自动选择第一个package |
| 无匹配 | 无sourceRoot参数 | `src/` fallback (confidence: 0, fallbackUsed: true) |

**JSON情报输出示例**:
```json
{
  "success": true,
  "sourceRootMeta": {
    "detected": true,
    "confidence": 0.85,
    "topCandidates": [
      { "path": "packages/codegraph/src", "score": 33 },
      { "path": "packages/codegraph", "score": 18 }
    ],
    "fallbackUsed": false
  },
  "layers": [...]
}
```

**预计工期**: 2-3h

---

### E.4 Change创建顺序建议（更新）

```
⚠️ Phase F: E2E Round3问题修复（新规划）
┌─────────────────────────────────────────────────────────────┐
│  7. cg-cli-ux-improvement [CLI] 📋 ← P1                      │
│     ├─ CLI错误包装                                            │
│     ├─ CACError友好转换                                       │
│     ├─ 路径格式帮助                                           │
│     预估: 2-3h                                                │
│                                                             │
│  8. cg-source-root-auto-detect [CORE] 📋 ← P1                │
│     ├─ CLI默认值修复                                          │
│     ├─ 深度候选发现                                           │
│     ├─ 情报输出                                               │
│     预估: 2-3h                                                │
│                                                             │
│  9. cg-mvp-documentation [DOC] ⚠️ ← P2                       │
│     预估: 2h                                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### E.5 执行建议表（更新）

| 执行阶段 | Change | 工时 | 并行度 | 状态 | 备注 |
|---------|--------|------|--------|------|------|
| ✅ 已完成 | C1-C14 | 34h | - | ✅ | 全部归档 |
| ⚠️ Phase F-1 | **cg-cli-ux-improvement** | 2-3h | 串行 | 📋 **推荐先执行** | P1阻塞问题 |
| ⚠️ Phase F-2 | **cg-source-root-auto-detect** | 2-3h | 串行 | 📋 **推荐次执行** | P1阻塞问题 |
| ⚠️ Phase F-3 | cg-mvp-documentation | 2h | 串行 | ⚠️ 最后执行 | M1文档 |

**剩余总工时**: 约6-8h

---

### E.6 M1完整验收标准（更新）

```
┌─────────────────────────────────────────────────────────────┐
│                    M1验收标准 (完整版)                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ 已达成:                                                   │
│  ├─ 测试覆盖率 ≥ 80% (92.74%)                                │
│  ├─ E2E测试全通过 (1140 tests)                               │
│  ├─ stderr分离验证 (stdout纯JSON)                            │
│  ├─ JSON纯度验证 (jq兼容)                                     │
│  ├─ 复杂度计算实现 (C13归档)                                  │
│  └─ Layer命名推断实现 (C14归档)                               │
│                                                             │
│  ⚠️ 待达成:                                                   │
│  ├─ CLI错误友好提示 (C15)                                     │
│  ├─ Source-root自动检测 (C16)                                 │
│  ├─ 情报输出给agent (C16)                                     │
│  └─ 文档覆盖所有M1功能 (C12)                                  │
│                                                             │
│  📊 E2E评分追踪:                                              │
│  ├─ Round1: 8.65/10                                          │
│  ├─ Round2: 9.5/10 ✅                                        │
│  ├─ Round3: 7.5/10 🔴 (新问题发现)                           │
│  └─ 目标: Round4 ≥ 9.0/10 (修复C15/C16后)                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```