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

### 1.2 未归档的Change

| Change ID | Change名称 | 实现状态 | 备注 |
|-----------|-----------|---------|------|
| C10 | cg-cli-query-commands | ✅ 代码已实现 | 无归档记录，需补充归档 |
| C11 | cg-mvp-test-coverage | ⚠️ 进行中 | 841测试通过，覆盖率报告缺失 |
| C12 | cg-mvp-documentation | ⚠️ 部分完成 | README.md(21KB)存在，docs目录存在 |

### 1.3 代码实现验证

```bash
# CLI命令文件已存在（C10实现验证）
ls packages/codegraph/src/cli/commands/
# 输出: analyze.ts, impact.ts, layers.ts, scope.ts, update.ts, migrate.ts

# 注意: brief.ts 不存在（C10规划但未实现）

# 测试状态（C11部分实现）
npm test -- --coverage
# 输出: 841 tests passing, coverage summary未显示百分比

# 文档状态（C12部分实现）
ls packages/codegraph/README.md
# 输出: 21KB comprehensive README

# 硬编码验证（P1任务未实现）
grep "LAYER_THRESHOLD" packages/codegraph/src/api/layers/inference/core.ts
# 输出: const LAYER_THRESHOLD = 2;  # DEPTH_PRESETS未实现

grep "isTypeOnly" packages/codegraph/src/
# 输出: 无匹配  # TypeScript import type未实现

grep "handleEmptyProject\|handleSingleFileProject\|excludeTestFiles" packages/codegraph/src/
# 输出: 无匹配  # P0任务未实现
```

---

## 2. P0任务清单

### 2.1 P0任务状态表

| 任务ID | 任务名称 | 设计文档声称 | 实际代码状态 | 真实状态 | 需新Change |
|--------|---------|-------------|-------------|----------|-----------|
| P0-stderr分离 | stderr输出分离 | "已实现" | 仅json-formatter.ts注释 | 仅文档设计 | ❌ 可合并到C11 |
| P0-空项目处理 | handleEmptyProject() | "已实现" | analyzer.ts有基本检查，无命名函数 | 部分实现 | ✅ cg-edge-case-handler |
| P0-单文件处理 | handleSingleFileProject() | "已实现" | 函数不存在 | 未实现 | ✅ cg-edge-case-handler |
| P0-测试文件排除 | excludeTestFiles()预过滤 | "已实现" | bfs-phases.ts有isTestFile()，非预过滤 | 部分实现 | ✅ cg-edge-case-handler |

### 2.2 P0任务详细分析

#### P0-stderr分离

**现状**: `json-formatter.ts` 仅注释 "caller handles stderr"，无实际分离逻辑。

**解决方案**: 在CLI命令层统一处理：
- stdout: 结构化JSON输出（`--json` flag）
- stderr: 错误信息、警告、进度日志

**建议**: 合并到 `cg-mvp-test-coverage` (C11) 的CLI测试验证中，无需独立change。

#### P0-空项目/单文件处理

**现状**: `analyzer.ts` 有基本空文件检查，但无命名函数；单文件处理完全缺失。

**解决方案**: 创建统一edge case处理模块：
```typescript
// 设计代码 - 待实现
function detectSpecialCases(projectRoot: string): SpecialCaseResult {
  const sourceFiles = findSourceFiles(projectRoot);
  if (sourceFiles.length === 0) return { type: 'empty' };
  if (sourceFiles.length === 1) return { type: 'single-file' };
  return { type: 'normal', sourceFiles };
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
| P1-Layer推断改进 Phase 1 | Source Root Discovery | 3h | 设计完成 | 未实现 | ✅ cg-layer-inference-pipeline |
| P1-Layer推断改进 Phase 2 | Dependency Score | 4h | 设计完成 | 未实现 | ✅ cg-layer-inference-pipeline |
| P1-Layer推断改进 Phase 3 | DEPTH_PRESETS配置表 | 2h | 设计完成 | LAYER_THRESHOLD=2硬编码 | ✅ cg-depth-presets |
| P1-Layer推断改进 Phase 4 | Layer Assignment | 4h | 设计完成 | 未实现 | ✅ cg-layer-inference-pipeline |
| P1-Layer推断改进 Phase 5 | Fallback & 预过滤 | 3h | 设计完成 | 未实现 | ✅ cg-layer-inference-pipeline |
| P1-TypeScript import type | ImportClause.isTypeOnly | 4h | 设计完成 | Parser未使用 | ✅ cg-ts-import-type |

### 3.2 P1任务详细分析

#### P1-Layer推断改进 (Phase 1-5)

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

| Change名称 | 类型 | 覆盖任务 | 预估工时 | 优先级 | 依赖 |
|-----------|------|---------|---------|--------|------|
| cg-edge-case-handler | [CORE] | P0-空项目/单文件/测试排除 | 4h | P0 | C1, C5 |
| cg-depth-presets | [CORE] | P1-Phase 3 | 2h | P1 | C8 |
| cg-layer-inference-pipeline | [CORE] | P1-Phase 1/2/4/5 | 14h | P1 | cg-depth-presets |
| cg-ts-import-type | [PARSER] | P1-import type | 4h | P1 | C3 |
| cg-cli-query-archive | [CLI] | C10归档 | 1h | P2 | 无 |
| cg-mvp-test-coverage | [TEST] | C11完善 | 4h | P2 | 所有P0/P1 |
| cg-mvp-documentation | [DOC] | C12完善 | 2h | P2 | 所有P0/P1 |

**总工时**: 约31h（不含C10归档）

### 4.2 各Change详细设计

#### Change 1: cg-edge-case-handler [CORE]

**名称**: `cg-edge-case-handler`

**目标**: 处理空项目、单文件项目、测试文件预过滤等边缘场景

**范围**:
- `detectSpecialCases()` 函数：检测空项目/单文件/正常项目
- `handleEmptyProject()` 函数：空项目友好提示
- `handleSingleFileProject()` 函数：单文件简化分析
- `excludeTestFiles()` 函数：预过滤测试文件
- CLI命令集成：analyze/update命令边缘场景处理

**依赖**: C1(图结构), C5(分析流程)

**预计工期**: 4h

**验证标准**:
- 空项目执行analyze输出友好提示
- 单文件项目正确分析
- 测试文件在分析入口预过滤（而非遍历时）
- 单元测试覆盖所有边缘场景

**交付文件**:
```
packages/codegraph/src/
├── analyzer/
│   ├── edge-case-detector.ts    # 特殊场景检测
│   ├── empty-project-handler.ts # 空项目处理
│   ├── single-file-handler.ts   # 单文件处理
│   └── test-file-excluder.ts    # 测试文件预过滤
│   └── index.ts
├── cli/commands/
│   └── analyze.ts               # 集成edge case处理
│   └── update.ts                # 集成edge case处理
```

---

#### Change 2: cg-depth-presets [CORE]

**名称**: `cg-depth-presets`

**目标**: 替换硬编码 `LAYER_THRESHOLD=2`，实现自适应深度配置表

**范围**:
- `DEPTH_PRESETS` 配置表定义
- 项目规模检测函数（文件数统计）
- 动态阈值选择逻辑
- 配置扩展机制（`.codegraph/config.json`）

**依赖**: C8(getArchitectureLayers)

**预计工期**: 2h

**验证标准**:
- 小型项目（<50文件）threshold=5
- 中型项目（51-200）threshold=3
- 大型项目（201-500）threshold=2
- 企业级项目（>500）threshold=1
- 单元测试验证阈值选择正确性

**配置表设计**:
```typescript
const DEPTH_PRESETS = {
  SMALL:     { maxFiles: 50,   suggestedDepth: 1, threshold: 5 },
  MEDIUM:    { maxFiles: 200,  suggestedDepth: 2, threshold: 3 },
  LARGE:     { maxFiles: 500,  suggestedDepth: 3, threshold: 2 },
  ENTERPRISE: { maxFiles: 2000, suggestedDepth: 4, threshold: 1 },
};
```

**交付文件**:
```
packages/codegraph/src/api/layers/inference/
├── core.ts                  # 替换LAYER_THRESHOLD为动态选择
├── depth-presets.ts         # DEPTH_PRESETS配置表
└── project-scale-detector.ts # 项目规模检测
```

---

#### Change 3: cg-layer-inference-pipeline [CORE]

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

#### Change 4: cg-ts-import-type [PARSER]

**名称**: `cg-ts-import-type`

**目标**: 利用TypeScript Compiler API检测 `import type` 语句

**范围**:
- `ImportClause.isTypeOnly` 检测
- IMPORTS边metadata扩展（`importKind: 'type-only'`）
- 类型导入与值导入分离统计
- CLI输出展示类型导入信息

**依赖**: C3(ts-parser-imports)

**预计工期**: 4h

**验证标准**:
- `import type { Foo } from './bar'` 正确标记
- 类型导入不计入依赖score（仅值导入计入）
- `scope`命令展示类型导入信息
- 单元测试覆盖所有import type场景

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

### 5.1 拓扑顺序（按依赖关系）

```
Phase A: P0边缘处理（独立）
┌─────────────────────────────────────────────────────────────┐
│  1. cg-edge-case-handler [CORE]                              │
│     ├─ handleEmptyProject()                                  │
│     ├─ handleSingleFileProject()                             │
│     └─ excludeTestFiles()                                    │
│     预估: 4h                                                  │
└─────────────────────────────────────────────────────────────┘

Phase B: P1基础层（可并行）
┌─────────────────────────────────────────────────────────────┐
│  2a. cg-depth-presets [CORE]        2b. cg-ts-import-type   │
│      ├─ 替换硬编码                   ├─ Parser扩展           │
│      ├─ 配置表                       ├─ isTypeOnly检测       │
│      预估: 2h                        预估: 4h                │
│      依赖: C8                        依赖: C3                │
│                                                             │
│  注: 2a和2b无依赖关系，可并行开发                             │
└─────────────────────────────────────────────────────────────┘

Phase C: P1核心层（依赖Phase B）
┌─────────────────────────────────────────────────────────────┐
│  3. cg-layer-inference-pipeline [CORE]                       │
│     ├─ Phase 1: Source Root Discovery                        │
│     ├─ Phase 2: Dependency Score                             │
│     ├─ Phase 4: Layer Assignment                             │
│     ├─ Phase 5: Fallback                                     │
│     预估: 14h                                                 │
│     依赖: cg-depth-presets                                    │
└─────────────────────────────────────────────────────────────┘

Phase D: C10归档（独立）
┌─────────────────────────────────────────────────────────────┐
│  4. cg-cli-query-archive [CLI]                               │
│     ├─ 验证C10实现                                           │
│     ├─ 补充归档文档                                           │
│     预估: 1h                                                  │
│     依赖: 无                                                  │
│                                                             │
│  注: 可与Phase A/B/C并行执行                                  │
└─────────────────────────────────────────────────────────────┘

Phase E: 测试与文档（依赖所有前序）
┌─────────────────────────────────────────────────────────────┐
│  5. cg-mvp-test-coverage [TEST]                              │
│     预估: 4h                                                  │
│     依赖: Phase A, B, C                                       │
│                                                             │
│  6. cg-mvp-documentation [DOC]                               │
│     预估: 2h                                                  │
│     依赖: Phase A, B, C                                       │
│                                                             │
│  注: 5和6可并行执行                                           │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 执行建议表

| 执行阶段 | Change | 工时 | 并行度 | 备注 |
|---------|--------|------|--------|------|
| Week 1 Day 1 | cg-edge-case-handler | 4h | 串行 | P0优先级高 |
| Week 1 Day 2-3 | cg-depth-presets + cg-ts-import-type | 6h | 并行(≤3) | P1基础层 |
| Week 1 Day 4-5 | cg-layer-inference-pipeline | 14h | 串行 | P1核心层，工作量最大 |
| Week 2 Day 1 | cg-cli-query-archive | 1h | 并行 | 可提前执行 |
| Week 2 Day 2 | cg-mvp-test-coverage + cg-mvp-documentation | 6h | 并行(≤3) | 测试与文档 |

**总工期**: 约31h，预计2周完成（含E2E验证）

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

### 6.2 C12 (cg-mvp-documentation) 整合策略

**原C12范围**（develop_changes_plan.md）:
- README.md编写
- API使用示例
- CLI使用指南
- 架构简图

**新C12范围扩展**:
- P0/P1功能文档补充
- Layer推断配置说明
- Edge case处理说明
- import type检测说明

**建议**: C12在所有P0/P1 changes完成后执行，更新文档覆盖M1完整功能。

### 6.3 M1剩余工作总结

```
┌─────────────────────────────────────────────────────────────┐
│                    M1剩余工作全景                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  已完成C1-C10: 图结构、扫描、解析、API、CLI                   │
│                                                             │
│  待完成:                                                     │
│  ├─ P0: edge case handler (4h)                              │
│  ├─ P1: depth presets (2h) + import type (4h)               │
│  ├─ P1: layer inference pipeline (14h)                      │
│  ├─ C10归档: cli-query-archive (1h)                         │
│  ├─ C11: test coverage完善 (4h)                             │
│  └─ C12: documentation完善 (2h)                             │
│                                                             │
│  总计: 31h                                                   │
│                                                             │
│  验收标准:                                                   │
│  ├─ 测试覆盖率 ≥ 80%                                        │
│  ├─ E2E测试全通过                                           │
│  ├─ 文档覆盖所有M1功能                                       │
│  └─ Layer推断质量提升（tests/不再误判）                      │
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

## 附录 B: 关键代码证据

### B.1 硬编码证据

```typescript
// packages/codegraph/src/api/layers/inference/core.ts
const LAYER_THRESHOLD = 2;  # DEPTH_PRESETS未实现
```

### B.2 import type未实现证据

```bash
grep -r "isTypeOnly" packages/codegraph/src/
# 输出: 无匹配
```

### B.3 edge case函数未实现证据

```bash
grep -r "handleEmptyProject\|handleSingleFileProject\|excludeTestFiles" packages/codegraph/src/
# 输出: 无匹配
```

### B.4 CLI命令实现证据

```bash
ls packages/codegraph/src/cli/commands/
# 输出: analyze.ts, impact.ts, layers.ts, scope.ts, update.ts, migrate.ts
# 注意: brief.ts 不存在
```

---

**文档版本**: v1.0
**创建日期**: 2026-05-05
**关联文档**:
- [hybrid-layer-inference-design.md](../../packages/codegraph/docs/design-codegraph/hybrid-layer-inference-design.md)
- [develop_changes_plan.md](./develop_changes_plan.md)
**用途**: 创建M1剩余工作OpenSpec change的依据