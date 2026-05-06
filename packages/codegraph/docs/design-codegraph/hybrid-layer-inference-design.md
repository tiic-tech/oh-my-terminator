# Hybrid Layer Inference Design

> 简化版本 - 仅保留关键问题和确认可行的架构设计

---

## 1. 与开发计划对齐

### 1.1 M1定义（参考 develop_changes_plan.md）

**M1 MVP完整范围** = C1-C12（共15天）

| Change | 名称 | 类型 | 工期 | 状态 |
|--------|------|------|------|------|
| C1 | cg-core-graph-structure | [CORE] | 2天 | ✅ 已完成 |
| C2 | cg-file-system-scanner | [CORE] | 1天 | ✅ 已完成 |
| C3 | cg-ts-parser-imports | [PARSER] | 2天 | ✅ 已完成 |
| C4 | cg-ts-parser-modules | [PARSER] | 2天 | ✅ 已完成 |
| C5 | cg-full-analysis-flow | [CORE] | 1天 | ✅ 已完成 |
| C6 | cg-baseline-persistence | [CORE] | 1天 | ✅ 已完成 |
| C7 | cg-api-scope | [API] | 1天 | ✅ 已完成 |
| C8 | cg-api-impact-layers | [API] | 1天 | ✅ 已完成 |
| C9 | cg-cli-analyze-update | [CLI] | 1天 | ✅ 已完成 |
| C10 | cg-cli-query-commands | [CLI] | 1天 | ✅ 已完成 |
| C11 | cg-mvp-test-coverage | [TEST] | 2天 | ⚠️ 进行中 |
| C12 | cg-mvp-documentation | [DOC] | 1天 | ⚠️ 进行中 |

**当前状态**: C1-C10已完成，C11-C12进行中

### 1.2 M1剩余工作补充

基于E2E测试发现的问题，以下两项提前到M1：

| 问题 | 原优先级 | 新优先级 | 解决方案 | 预估工时 |
|------|---------|---------|----------|----------|
| DEPTH_PRESETS | P2(M2) | **P1(M1)** | 自适应深度配置表替代硬编码 | 4h |
| TypeScript import type | P2(M2) | **P1(M1)** | ImportClause.isTypeOnly检测 | 4h |

**调整原因**: 这两项直接影响Layer推断质量和类型文件误判问题，是E2E测试发现的关键缺陷。

**M1剩余工作总计**: C11(测试) + C12(文档) + P1-DEPTH_PRESETS + P1-import-type = 约22h

---

## 2. 核心架构设计（M1 P1实现）

### 2.1 五阶段推断管道

```
┌─────────────────────────────────────────────────────────────┐
│                    Hybrid Inference Pipeline                │
├─────────────────────────────────────────────────────────────┤
│  Phase 1: Source Root Discovery                            │
│    └─ 信号检测系统 (权重评分 + 排除列表)                      │
│                                                             │
│  Phase 2: Dependency Score Calculation                      │
│    └─ 循环检测 + 外部排除 + 动态导入惩罚                      │
│                                                             │
│  Phase 3: Adaptive Depth Selection                          │
│    └─ DEPTH_PRESETS配置表 (基于项目规模)                     │
│                                                             │
│  Phase 4: Layer Assignment                                  │
│    └─ 动态阈值 + 模糊匹配 + 置信度追踪                        │
│                                                             │
│  Phase 5: Fallback & Suggestions                            │
│    └─ Agent Prompt + 预过滤器 + 默认降级                     │
└─────────────────────────────────────────────────────────────┘
```

**注意**: 上述架构为设计预研，**当前代码使用硬编码 LAYER_THRESHOLD = 2**

### 2.2 Plugin架构（语言无关扩展）

```
┌─────────────────────────────────────────────────────────────┐
│              Plugin-Based Architecture                        │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Plugin Registry                                   │
│  ├── TypeScript Plugin                                      │
│  │   └── Compiler API ImportClause.isTypeOnly              │
│  │                                                          │
│  ├── Python Plugin                                          │
│  │   └── .pyi stub检测                                      │
│  │                                                          │
│  └── Go/Rust/Java Plugin                                    │
│      └── interface/trait detection                          │
│                                                              │
│  Layer 2: 配置覆盖系统                                       │
│  └── .codegraph/config.json                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 实现状态校验

### 3.1 P0/P2 Items真实状态

**重要澄清**: 以下项目的实现状态经过代码审计确认

| 问题 | 设计文档声称 | 实际代码状态 | 真实状态 | 新优先级 |
|------|------------|-------------|----------|----------|
| P0-stderr分离 | "已实现" | 仅json-formatter.ts注释"caller handles" | **仅文档设计** - 无实际stderr分离代码 | P0 |
| P0-CLI输出修复 | "已实现" | fix-e2e-report-all-issues已归档，CLI命令已修复 | ✅ **已实现** | - |
| P0-空项目处理 | "已实现handleEmptyProject()" | analyzer.ts有基本空文件检查，但**无此命名函数** | ⚠️ **部分实现** - 基本检查存在，命名函数不存在 | P0 |
| P0-单文件处理 | "已实现handleSingleFileProject()" | grep无匹配，**函数不存在** | ❌ **未实现** | P0 |
| P0-测试文件排除 | "已实现excludeTestFiles()预过滤" | bfs-phases.ts有isTestFile()，但非预过滤 | ⚠️ **部分实现** - isTestFile()存在，excludeTestFiles()不存在 | P0 |
| **P1-DEPTH_PRESETS** | "设计完成" | 代码用LAYER_THRESHOLD=2硬编码 | **仅文档设计** - 配置表未实现 | **M1剩余工作** |
| **P1-import type** | "M2规划" | Parser未使用isTypeOnly | **仅文档设计** - TS Compiler API能力未利用 | **M1剩余工作** |

### 3.2 关键代码证据

```typescript
// 实际代码位置：packages/codegraph/src/api/layers/inference/core.ts
// 当前实现：硬编码阈值
const LAYER_THRESHOLD = 2;  // 未使用DEPTH_PRESETS

// 实际代码位置：packages/codegraph/src/api/impact/traverse/bfs-phases.ts
// 测试文件检测：存在于BFS遍历中
function isTestFile(filePath: string): boolean {
  return TEST_FILE_PATTERNS.some(p => p.test(filePath));
}
// 注意：这是遍历过滤，不是预过滤
```

---

## 4. Milestone Scope Management

### 4.1 M1剩余工作（更新）

**M1交付目标**: C1-C12 + P1补充项

| 任务 | 类型 | 预估工时 | 开发状态 |
|------|------|----------|----------|
| C11: 测试覆盖率 | [TEST] | 2天 | ⚠️ 进行中 |
| C12: 文档 | [DOC] | 1天 | ⚠️ 进行中 |
| **P1: DEPTH_PRESETS** | [CORE] | 4h | 仅设计文档 |
| **P1: TypeScript import type** | [PARSER] | 4h | 仅设计文档 |

**M1剩余工时**: 约22h（含E2E测试验证）

### 4.2 M2+ Scope（后续里程碑）

| 问题 | 优先级 | 解决方案 | Milestone | 开发状态 |
|------|--------|----------|-----------|----------|
| P1-Layer推断改进 | **M2** | Phase 1-5完整实现 | M2 (Week 1-2) | 仅设计文档 |
| P1-Plugin系统 | **M2** | LanguagePluginRegistry | M2 (Week 3-4) | 仅设计文档 |
| P2-Violation处理策略 | **M3** | ViolationLevel + Remediation | M3 (Week 6-7) | 仅设计文档 |
| P3-其他语言Plugin | **M4** | Python/Go/Rust/Java | M4 (Week 8-10) | 仅设计文档 |
| P4-跨语言FFI | **M5** | FFI boundary detection | M5 (Week 11+) | 仅设计文档 |

**注意**: P1-DEPTH_PRESETS和P1-import type已提前到M1，不再属于M2范围。

---

## 5. 设计预研详情

### 5.1 Source Root Discovery（设计）

**问题**: tests/目录误判为源码根，node_modules污染

**设计方案**:

```typescript
// 设计代码 - 未实现
const SIGNAL_WEIGHTS = {
  PACKAGE_JSON:    +10,
  TS_CONFIG:       +8,
  TYPICAL_DIR:     +15,
  NO_NODE_MODULES: -20,
};

const EXCLUDED_DIRECTORIES = [
  'node_modules', 'dist', 'build', 'test', 'tests', '__tests__',
  '.git', '.github', 'docs', 'coverage'
];
```

### 5.2 循环依赖处理（设计）

**问题**: 循环依赖score无法区分层级

**设计方案**:

```typescript
// 设计代码 - 未实现
const penaltyPerMember = Math.ceil(cycle.length / 2);
score.cyclePenalty += penaltyPerMember;
score.netScore -= penaltyPerMember * 2;
```

### 5.3 自适应深度（设计）

**问题**: threshold=2硬编码无依据

**设计方案**:

| 项目规模 | 文件数范围 | suggestedDepth | threshold |
|---------|-----------|---------------|----------|
| Small | 0-50 | 1 | 5 |
| Medium | 51-200 | 2 | 3 |
| Large | 201-500 | 3 | 2 |
| Enterprise | 501-2000 | 4 | 1 |

**当前实现**: 硬编码 `LAYER_THRESHOLD = 2`

### 5.4 空项目/单文件处理（设计）

**设计方案**（函数名仅作设计参考，非已实现）:

```typescript
// 设计代码 - 函数名仅作参考
// 实际代码: analyzer.ts 有基本空文件检查，无命名函数
function detectSpecialCases(projectRoot: string): SpecialCaseResult {
  const sourceFiles = findSourceFiles(projectRoot);
  if (sourceFiles.length === 0) return { type: 'empty' };
  if (sourceFiles.length === 1) return { type: 'single-file' };
  return { type: 'normal', sourceFiles };
}
```

---

## 6. M1 P1实现路径

### 6.1 关键文件路径树（M1剩余工作）

```
packages/codegraph/src/
├── parser/
│   └── ts-parser/
│       └── import-extractor.ts       # [M1 P1扩展] isTypeOnly字段
│
├── api/
│   └── layers/
│       └── inference/
│           └── core.ts               # [M1 P1扩展] DEPTH_PRESETS配置
│
└── config/                           # [M2新建]
    └── type-config-loader.ts         # Plugin配置加载（暂不实现）
```

### 6.2 M1 P1工时估算

| Phase | Milestone | 预估工时 | 开发状态 |
|-------|-----------|----------|----------|
| **P1-DEPTH_PRESETS配置** | **M1** | **4h** | **待开发** |
| **P1-TS import type检测** | **M1** | **4h** | **待开发** |
| Plugin Registry | M2 | 8h | 仅设计 |
| Layer assignment集成 | M2 | 8h | 仅设计 |
| 其他语言Plugin | M4 | 12h | 仅设计 |

**M1 P1开发顺序**: 
1. DEPTH_PRESETS → 替换硬编码LAYER_THRESHOLD
2. import type → 扩展ParsedImportInfo接口

---

## 7. 工具范围界定

### 7.1 允许的工具

| 工具类别 | 具体工具 | 用途 |
|---------|---------|------|
| 编译器工具 | TypeScript Compiler API | AST解析，import type检测 |
| AST解析 | Python AST / tree-sitter | 源码结构分析 |
| 语言Parser | Go parser, Rust syn | 各语言原生解析 |

### 7.2 禁止的工具

| 工具类别 | 具体工具 | 禁用原因 |
|---------|---------|----------|
| AI模型 | LLM, Claude, GPT | 用户约束 |
| 机器学习 | ML模型 | 用户约束 |

---

**文档版本**: v6.0 (P1优先级调整)
**更新日期**: 2026-05-06
**状态**: P1-DEPTH_PRESETS和P1-import type已提前到M1剩余工作
**对齐**: develop_changes_plan.md M1定义(C1-C12) + P1补充项