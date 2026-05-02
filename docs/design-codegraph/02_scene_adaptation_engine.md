# CodeGraph 场景适配引擎设计

> **文档定位**: 本文档是对 [01_origin_blueprint.md](./01_origin_blueprint.md) 的深化设计，聚焦于 **场景适配能力** 的精细化设计。原 blueprint 定义了 CodeGraph 作为"情报供应方"的基础架构，本文档则从"情报消费方"视角出发，重构供需契约，实现场景感知的精准情报交付。

---

## 目录

1. [文档概述与设计背景](#1-文档概述与设计背景)
2. [增量更新机制深化设计](#2-增量更新机制深化设计)
3. [情报消费者视角分析](#3-情报消费者视角分析)
4. [场景适配规则体系](#4-场景适配规则体系)
5. [情报契约设计](#5-情报契约设计)
6. [纯算法约束下的可行性分析](#6-纯算法约束下的可行性分析)
7. [与原始 Blueprint 的关系说明](#7-与原始-blueprint-的关系说明)

---

## 1. 文档概述与设计背景

### 1.1 核心问题陈述

原始 blueprint 设计的 `buildContextFor(taskDescription: string)` API 存在根本性缺陷：

```
┌─────────────────────────────────────────────────────────────────┐
│  原设计假设：CodeGraph 能理解任务语义                              │
│  实际能力：纯算法引擎，无法做语义理解                               │
│  核心矛盾：供给侧固定输出 vs 需求侧场景差异                         │
└─────────────────────────────────────────────────────────────────┘
```

**问题表现**：
- 不同阶段（MSpec规划、Sprint分解、atom_task执行）需要不同粒度的情报
- 不同任务类型（重构、新功能、Bug修复）需要不同侧重点的情报
- Token 预算差异巨大（规划阶段 400-600，执行阶段可能只有 200-400）
- 原设计的 `taskDescription: string` 参数无法传递足够的场景信息

### 1.2 设计目标

```
┌─────────────────────────────────────────────────────────────────┐
│  目标：建立场景感知的情报契约                                      │
│  方法：显式场景参数 + 规则驱动的适配策略                           │
│  结果：CodeGraph 成为"情报计算引擎"，Orchestrator 成为"决策智能层" │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 增量更新机制深化设计

原始 blueprint 第 5 章定义了基础增量更新流程，本节对其进行分层细化。

### 2.1 分层 Cascade 策略

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cascade 分层策略                              │
├─────────────────────────────────────────────────────────────────┤
│  Level 1: 符号级精准更新                                         │
│    条件: 函数内部实现变更，签名不变                                │
│    动作: 仅更新 metadata (complexity, loc, jsDoc)               │
│    影响: 0 级联                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Level 2: 文件级 Cascade                                         │
│    条件: export 列表变化                                         │
│    动作: cascade 到 import 者                                    │
│    限制: maxDepth = 3                                            │
├─────────────────────────────────────────────────────────────────┤
│  Level 3: 热点保护策略                                           │
│    条件: 被导入次数 > hotspotThreshold                           │
│    动作: 触发热点变更警报                                         │
│    阈值: hotspotThreshold = 20 (可配置)                          │
├─────────────────────────────────────────────────────────────────┤
│  Level 4: 循环依赖特殊处理                                       │
│    条件: 修改发生在循环依赖团块内                                  │
│    动作: 整个循环团块重解析                                       │
│    限制: 不 cascade 到团块外部                                    │
└─────────────────────────────────────────────────────────────────┘
```

**ASCII 流程图**：

```
文件变更检测
    │
    ▼
┌─────────────────────┐
│ 解析变更文件         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     是      ┌─────────────────────┐
│ export 列表变化？    │──────────▶ │ Level 2: Cascade    │
└──────────┬──────────┘            │ 到 import 者         │
           │ 否                    │ (maxDepth=3)         │
           ▼                       └──────────┬──────────┘
┌─────────────────────┐                       │
│ Level 1: 仅更新     │                       ▼
│ metadata            │           ┌─────────────────────┐
└──────────┬──────────┘           │ cascade 路径中有    │
           │                      │ 热点文件？           │
           │                      └──────────┬──────────┘
           │                                 │
           │                      是         │         否
           │                      ▼          │          ▼
           │            ┌────────────────┐   │   ┌────────────────┐
           │            │ Level 3: 触发  │   │   │ 正常完成       │
           │            │ 热点警报       │   │   │ cascade        │
           │            └────────────────┘   │   └────────────────┘
           │                                 │
           └─────────────────────────────────┘
```

### 2.2 Cascade 防护机制

```typescript
interface CascadePolicy {
  maxDepth: number;              // 默认 3，防止无限 cascade
  hotspotThreshold: number;      // 被导入数超过此值为热点，默认 20
  cycleBlockStrategy: 'reparse-cycle-only' | 'cascade-with-warning';
  overflowStrategy: 'mark-unsafe' | 'force-full-reparse';
}
```

**防护规则详解**：

| 规则 | 条件 | 动作 | 理由 |
|------|------|------|------|
| maxDepth 限制 | cascade 深度达到 3 | 停止 cascade，标记后续节点为 `potentially-affected` | 防止全仓库重解析 |
| 热点警报 | cascade 路径经过热点文件 | 发出 `HOTSPOT_IMPACT` 警报，不阻止 cascade | 热点修改影响面大，需人工关注 |
| 循环隔离 | 修改在循环团块内 | 仅重解析团块，不 cascade 到外部 | 循环内相互依赖，外部不依赖循环内部细节 |
| overflow 处理 | 重解析比例 > 70% 连续 N 次 | 建议 full-reparse | 增量模式效率低于全量 |

### 2.3 关键指标监控

```typescript
interface IncrementalMetrics {
  cascadeDepth: number;           // 本次 cascade 最大深度
  reparsedRatio: number;          // 重解析文件数 / 总文件数
  durationMs: number;             // 耗时
  hotspotAlerts: number;          // 热点警报次数
  cycleReparsed: number;          // 循环团块重解析次数
}

interface HealthThresholds {
  reparsedRatioWarning: number;   // 默认 0.7
  consecutiveWarnings: number;    // 默认 3
}
```

**监控逻辑**：

```
每次增量更新完成后:
    │
    ▼
记录 metrics 到 history.ldjson
    │
    ▼
检查最近 N 次 metrics
    │
    ▼
if (reparsedRatio > 70% 连续 3 次):
    │
    ▼
发出建议: "建议执行全量分析 (codegraph analyze)"
```

---

## 3. 情报消费者视角分析

### 3.1 Orchestrator 的三阶段情报需求

```
┌─────────────────────────────────────────────────────────────────┐
│           Orchestrator 情报消费金字塔                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────┐      │
│   │ P0 必需层: 没有就无法工作                              │      │
│   │ - 目标模块导出列表                                     │      │
│   │ - 直接依赖者                                          │      │
│   │ - 关联测试文件                                        │      │
│   │ - 现有架构约束                                        │      │
│   └─────────────────────────────────────────────────────┘      │
│                         │                                       │
│   ┌─────────────────────────────────────────────────────┐      │
│   │ P1 高价值层: 显著提升决策质量                          │      │
│   │ - 调用图 (谁调用了目标函数)                           │      │
│   │ - 热点标记                                            │      │
│   │ - 循环依赖                                            │      │
│   │ - 最近变更历史                                        │      │
│   └─────────────────────────────────────────────────────┘      │
│                         │                                       │
│   ┌─────────────────────────────────────────────────────┐      │
│   │ P2 补充层: 有助于深入分析                              │      │
│   │ - 共同修改模式                                        │      │
│   │ - 复杂度指标                                          │      │
│   │ - 技能需求分析                                        │      │
│   └─────────────────────────────────────────────────────┘      │
│                         │                                       │
│   ┌─────────────────────────────────────────────────────┐      │
│   │ P3 可选层: 辅助信息                                    │      │
│   │ - JSDoc 摘要                                          │      │
│   │ - 成熟度评分                                          │      │
│   └─────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 三层场景的具体需求差异

| 阶段 | 粒度需求 | 典型 Token 预算 | 关键情报 | 决策目标 |
|------|----------|-----------------|----------|----------|
| **MSpec 规划** | FILE + MODULE | 400-600 | 架构分层、模块边界、架构约束、热点 | 理解宏观架构，评估可行性 |
| **Sprint 分解** | FILE | 300-500 | 影响范围、测试范围、共同修改模式 | 精确任务依赖，预测工作量 |
| **atom_task 执行** | FUNCTION | 200-400 | 函数级调用图、测试范围、JSDoc | 精准实现，避免破坏 |

### 3.3 任务类型感知的情报模板

```typescript
enum TaskType {
  REFACTOR = 'REFACTOR',       // 重构任务
  NEW_FEATURE = 'NEW_FEATURE', // 新功能开发
  BUG_FIX = 'BUG_FIX',         // Bug 修复
  SECURITY = 'SECURITY',       // 安全相关
  TESTING = 'TESTING'          // 测试相关
}

interface ContextTemplate {
  required: InfoType[];        // 必需情报，缺失时报错
  recommended: InfoType[];     // 推荐情报，预算允许时包含
  optional: InfoType[];        // 可选情报，预算充足时包含
}

const contextTemplates: Record<TaskType, ContextTemplate> = {
  REFACTOR: {
    required: ['scope', 'impact', 'archConstraints', 'testScope'],
    recommended: ['callGraph', 'cycles', 'hotspots'],
    optional: ['coChange', 'maturityScore']
  },
  NEW_FEATURE: {
    required: ['scope', 'archConstraints'],
    recommended: ['relatedFiles', 'hotspots', 'testScope'],
    optional: ['coChange', 'complexity']
  },
  BUG_FIX: {
    required: ['scope', 'callGraph', 'testScope'],
    recommended: ['recentChanges', 'relatedFiles'],
    optional: ['jsDoc', 'complexity']
  },
  SECURITY: {
    required: ['scope', 'callGraph', 'dependencies'],
    recommended: ['externalDeps', 'testScope'],
    optional: ['jsDoc']
  },
  TESTING: {
    required: ['scope', 'testScope', 'callGraph'],
    recommended: ['coverage', 'relatedTests'],
    optional: ['complexity']
  }
};
```

---

## 4. 场景适配规则体系

### 4.1 场景定义

```typescript
enum QueryScenario {
  MSPEC_PLANNING = 'MSPEC_PLANNING',      // 规划阶段
  SPRINT_BREAKDOWN = 'SPRING_BREAKDOWN',  // 任务分解阶段
  ATOM_TASK_EXECUTION = 'ATOM_TASK_EXECUTION' // 执行阶段
}
```

### 4.2 三层场景适配规则矩阵

| Scenario | Node Granularity | Required Info | Token Budget | Output Format |
|----------|------------------|---------------|--------------|---------------|
| MSPEC_PLANNING | FILE + MODULE | ARCHITECTURE_LAYERS, MODULE_BOUNDARIES, ARCH_CONSTRAINTS, HOTSPOTS | 400-600 | HIERARCHICAL_SUMMARY |
| SPRINT_BREAKDOWN | FILE | IMPACT_RANGE, TEST_SCOPE, CO_CHANGE_PATTERNS | 300-500 | TASK_DAG |
| ATOM_TASK_EXECUTION | FUNCTION | FUNCTION_SCOPE, CALL_GRAPH, TEST_SCOPE | 200-400 | COMPACT_FUNCTION_VIEW |

### 4.3 规则定义结构

```typescript
enum InfoType {
  // 架构层信息
  ARCHITECTURE_LAYERS = 'ARCHITECTURE_LAYERS',
  MODULE_BOUNDARIES = 'MODULE_BOUNDARIES',
  ARCH_CONSTRAINTS = 'ARCH_CONSTRAINTS',

  // 影响分析
  IMPACT_RANGE = 'IMPACT_RANGE',
  CALL_GRAPH = 'CALL_GRAPH',
  HOTSPOTS = 'HOTSPOTS',
  CYCLES = 'CYCLES',

  // 测试相关
  TEST_SCOPE = 'TEST_SCOPE',
  COVERAGE = 'COVERAGE',

  // 变更历史
  RECENT_CHANGES = 'RECENT_CHANGES',
  CO_CHANGE_PATTERNS = 'CO_CHANGE_PATTERNS',

  // 代码质量
  COMPLEXITY = 'COMPLEXITY',
  MATURITY_SCORE = 'MATURITY_SCORE',
  JSDOC = 'JSDOC',

  // 基础
  SCOPE = 'SCOPE',
  DEPENDENCIES = 'DEPENDENCIES',
  EXTERNAL_DEPS = 'EXTERNAL_DEPS'
}

interface ScenarioAdaptationRule {
  scenario: QueryScenario;
  nodeGranularity: 'FILE' | 'MODULE' | 'FUNCTION' | 'MIXED';
  requiredInfo: InfoType[];
  recommendedInfo: InfoType[];
  excludedInfo: InfoType[];      // 明确排除的信息类型
  tokenBudgetRange: { min: number; max: number };
  outputFormat: 'HIERARCHICAL_SUMMARY' | 'TASK_DAG' | 'COMPACT_FUNCTION_VIEW';
  includeRiskAlerts: boolean;    // 是否包含风险警报
  includeAgentSuggestions: boolean; // 是否包含 Agent 建议
}
```

### 4.4 规则实例化

```typescript
const scenarioRules: Record<QueryScenario, ScenarioAdaptationRule> = {
  MSPEC_PLANNING: {
    scenario: 'MSPEC_PLANNING',
    nodeGranularity: 'MIXED',
    requiredInfo: ['ARCHITECTURE_LAYERS', 'MODULE_BOUNDARIES', 'ARCH_CONSTRAINTS'],
    recommendedInfo: ['HOTSPOTS', 'CYCLES', 'MATURITY_SCORE'],
    excludedInfo: ['JSDOC', 'COMPLEXITY', 'CO_CHANGE_PATTERNS'],
    tokenBudgetRange: { min: 400, max: 600 },
    outputFormat: 'HIERARCHICAL_SUMMARY',
    includeRiskAlerts: true,
    includeAgentSuggestions: true
  },
  SPRINT_BREAKDOWN: {
    scenario: 'SPRING_BREAKDOWN',
    nodeGranularity: 'FILE',
    requiredInfo: ['IMPACT_RANGE', 'TEST_SCOPE'],
    recommendedInfo: ['CO_CHANGE_PATTERNS', 'CYCLES', 'HOTSPOTS'],
    excludedInfo: ['JSDOC', 'ARCHITECTURE_LAYERS', 'MATURITY_SCORE'],
    tokenBudgetRange: { min: 300, max: 500 },
    outputFormat: 'TASK_DAG',
    includeRiskAlerts: true,
    includeAgentSuggestions: false
  },
  ATOM_TASK_EXECUTION: {
    scenario: 'ATOM_TASK_EXECUTION',
    nodeGranularity: 'FUNCTION',
    requiredInfo: ['SCOPE', 'CALL_GRAPH', 'TEST_SCOPE'],
    recommendedInfo: ['COMPLEXITY', 'RECENT_CHANGES'],
    excludedInfo: ['ARCHITECTURE_LAYERS', 'MODULE_BOUNDARIES', 'MATURITY_SCORE'],
    tokenBudgetRange: { min: 200, max: 400 },
    outputFormat: 'COMPACT_FUNCTION_VIEW',
    includeRiskAlerts: false,
    includeAgentSuggestions: false
  }
};
```

### 4.5 动态调整机制

当 Token 预算不足以包含所有 required 信息时，按以下优先级降级：

```
降级策略（预算不足时）：
    │
    ▼
尝试裁剪 optional 信息
    │
    ▼
尝试裁剪 recommended 信息
    │
    ▼
if (仍不足):
    │
    ▼
裁剪 required 中优先级最低的信息
(优先级: SCOPE > IMPACT > 其他)
    │
    ▼
if (仍不足):
    │
    ▼
返回错误: INSUFFICIENT_BUDGET_FOR_REQUIRED
```

---

## 5. 情报契约设计

### 5.1 契约必要性分析

**传统 API 设计的问题**：

```
┌─────────────────────────────────────────────────────────────────┐
│  传统设计: buildContextFor(taskDescription: string)              │
│                                                                 │
│  隐含假设:                                                       │
│  1. CodeGraph 能从自然语言推断任务类型                            │
│  2. CodeGraph 能理解任务意图                                     │
│  3. CodeGraph 能智能决定包含哪些信息                              │
│                                                                 │
│  实际能力:                                                       │
│  1. ❌ 无 NLP 能力，无法理解自然语言                              │
│  2. ❌ 无语义理解，无法推断意图                                   │
│  3. ❌ 无决策能力，无法判断信息价值                               │
└─────────────────────────────────────────────────────────────────┘
```

**修正后的契约设计**：

```
┌─────────────────────────────────────────────────────────────────┐
│  新设计: queryWithContext(request: QueryRequest)                 │
│                                                                 │
│  显式约定:                                                       │
│  1. Orchestrator 决定 scenario (显式传入)                       │
│  2. Orchestrator 提供精确 targets (节点 ID 列表)                 │
│  3. CodeGraph 执行规则匹配 (纯算法)                              │
│  4. CodeGraph 返回数值指标 (不做判断)                            │
│  5. Orchestrator 解读指标做决策                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 修正后的 API 设计

```typescript
interface QueryRequest {
  // 必填参数 - Orchestrator 必须提供
  scenario: QueryScenario;      // 显式场景标记
  targets: string[];            // 精确节点 ID 列表 (如 ["FILE:src/auth.ts"])

  // 可选参数 - Orchestrator 可覆盖默认规则
  keywords?: string[];          // 纯字符串匹配，用于文件检索
  budget?: number;              // Token 预算覆盖

  // 微调参数 - 仅允许枚举型/数值型，不允许语义型
  overrides?: {
    includeExtra?: InfoType[];  // 添加额外信息类型
    excludeExtra?: InfoType[];  // 排除特定信息类型
    budgetOverride?: number;    // 强制指定预算
  };
}

interface QueryResponse {
  // 压缩后的情报文本
  content: string;

  // Token 估算值
  estimatedTokens: number;

  // 数值指标 - 不做主观判断，由 Orchestrator 解读
  metrics: {
    complexity: number;         // 圈复杂度
    fanIn: number;              // 入度 (被导入次数)
    fanOut: number;             // 出度 (导入其他文件数)
    hotspotScore: number;       // 热点分数
    cycleRisk: number;          // 循环风险指数
    testCoverage: number;       // 测试覆盖率
    recentChangeFrequency: number; // 最近变更频率
  };

  // 基于阈值的客观警报
  alerts: Alert[];

  // 元信息
  meta: {
    scenario: QueryScenario;
    nodesQueried: number;
    rulesApplied: string[];
    budgetUsed: number;
    budgetRemaining: number;
  };
}

interface Alert {
  type: AlertType;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;              // 基于规则的固定消息模板
  context: string[];            // 相关节点 ID
}

enum AlertType {
  CYCLE_DETECTED = 'CYCLE_DETECTED',
  HOTSPOT_IMPACT = 'HOTSPOT_IMPACT',
  ARCH_VIOLATION = 'ARCH_VIOLATION',
  MISSING_TEST = 'MISSING_TEST',
  HIGH_COMPLEXITY = 'HIGH_COMPLEXITY',
  INSUFFICIENT_BUDGET = 'INSUFFICIENT_BUDGET'
}
```

### 5.3 职责边界划分

```
┌─────────────────────────────────────────────────────────────────┐
│                      职责边界矩阵                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Orchestrator (决策智能层)                                │   │
│  │                                                          │   │
│  │ 职责:                                                    │   │
│  │ + 理解任务语义                                           │   │
│  │ + 决定调用场景 (MSPEC_PLANNING / SPRINT_BREAKDOWN / ...) │   │
│  │ + 提取关键词                                             │   │
│  │ + 确定目标节点                                           │   │
│  │ + 解读数值指标                                           │   │
│  │ + 做最终决策                                             │   │
│  │                                                          │   │
│  │ 能力类型: 语义理解 + 主观判断                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│                    QueryRequest (契约)                          │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ CodeGraph (情报计算引擎)                                 │   │
│  │                                                          │   │
│  │ 职责:                                                    │   │
│  │ + 接收显式参数                                           │   │
│  │ + 执行规则匹配                                           │   │
│  │ + 执行图查询                                             │   │
│  │ + 执行 Token 估算                                        │   │
│  │ + 格式化输出                                             │   │
│  │ + 返回数值指标                                           │   │
│  │ + 触发阈值警报                                           │   │
│  │                                                          │   │
│  │ 能力类型: 纯算法 + 客观计算                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 纯算法约束下的可行性分析

### 6.1 CodeGraph 能力边界清单

```
┌─────────────────────────────────────────────────────────────────┐
│                    能力边界矩阵                                  │
├───────────────────────────┬─────────────────────────────────────┤
│ ✅ 可行 (纯算法)           │ ❌ 不可行 (需要语义理解)             │
├───────────────────────────┼─────────────────────────────────────┤
│ 图遍历 (BFS/DFS)          │ 从自然语言推断场景                   │
│ 节点过滤 (类型、属性)      │ 从任务描述提取意图                   │
│ 统计计算 (入度、出度)      │ 关键词语义扩展                       │
│ 规则匹配 (阈值触发)        │ 增值建议的智能判断                   │
│ Token 估算 (字符数/4)      │ 任务优先级排序                       │
│ 格式化输出 (模板填充)      │ 风险严重性主观评估                   │
│ 循环检测 (Tarjan SCC)      │ "相关"文件的语义关联                 │
│ 路径查找 (最短路径)        │ 任务分解的合理性判断                 │
│ 集合运算 (交集、差集)      │ 架构改进建议                         │
└───────────────────────────┴─────────────────────────────────────┘
```

### 6.2 需要 Orchestrator 配合的部分

| CodeGraph 输出 | Orchestrator 解读 |
|-----------------|-------------------|
| `metrics.complexity = 15` | "该函数复杂度较高，建议拆分" (主观建议) |
| `metrics.fanIn = 25` | "这是热点模块，修改需谨慎" (主观判断) |
| `metrics.cycleRisk = 0.8` | "循环风险很高，建议重构" (主观决策) |
| `alerts = [CYCLE_DETECTED]` | 决定是否暂停任务或继续 (主观决策) |
| `content = "..."` | 是否需要额外信息 (主观判断) |

### 6.3 设计启示

```
┌─────────────────────────────────────────────────────────────────┐
│                     核心设计原则                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CodeGraph = 情报计算引擎 (客观)                                │
│  - 输入: 显式参数 (枚举型、数值型、节点 ID)                      │
│  - 输出: 结构化数据 + 数值指标                                  │
│  - 不做: 主观判断、建议、决策                                   │
│                                                                 │
│  Orchestrator = 决策智能层 (主观)                               │
│  - 输入: 任务描述 (自然语言)                                    │
│  - 处理: 语义理解、意图提取                                     │
│  - 输出: 显式参数给 CodeGraph                                   │
│  - 决策: 解读指标、做最终判断                                   │
│                                                                 │
│  契约 = 显式参数接口                                            │
│  - 所有可能的值都预定义为枚举                                   │
│  - 不接受自然语言字符串作为参数                                 │
│  - 不返回主观建议作为输出                                       │
│                                                                 │
│  这种分离让 CodeGraph 可以被任何 Orchestrator 复用               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. 与原始 Blueprint 的关系说明

### 7.1 补充内容（深化设计）

| 原 Blueprint 章节 | 本文档补充 |
|-------------------|------------|
| §5 增量更新引擎 | §2 分层 Cascade 策略、防护机制、监控指标 |
| §7 情报 API | §3 情报优先级金字塔、任务类型模板 |
| §6.5 关键词匹配 | §4 场景适配规则矩阵、动态调整机制 |
| §14 编排集成 | §5 情报契约设计、职责边界划分 |

### 7.2 修正内容（推翻原设计）

| 原 Blueprint 设计 | 修正后设计 | 修正理由 |
|-------------------|------------|----------|
| `buildContextFor(taskDescription: string)` | `queryWithContext(request: QueryRequest)` | 原设计假设 CodeGraph 能理解语义，实际不可行 |
| 隐含的场景推断 | 显式的 `scenario` 参数 | CodeGraph 无法做语义推断 |
| 智能建议输出 | 仅返回数值指标和阈值警报 | 建议需要主观判断，超出算法能力 |
| 自由格式的任务描述 | 结构化的节点 ID 列表 | 自由文本无法被算法精确处理 |

### 7.3 新增内容（原设计未涉及）

| 新增内容 | 章节位置 |
|----------|----------|
| 分层 Cascade 策略 (Level 1-4) | §2.1 |
| Cascade 防护机制 (CascadePolicy) | §2.2 |
| 增量更新监控指标 (IncrementalMetrics) | §2.3 |
| 情报优先级金字塔 (P0-P3) | §3.1 |
| 任务类型感知模板 (TaskType) | §3.3 |
| 场景适配规则矩阵 | §4.2 |
| 动态调整机制（降级策略） | §4.5 |
| 情报契约 (QueryRequest/Response) | §5.2 |
| 职责边界划分 | §5.3 |
| 能力边界清单 | §6.1 |

### 7.4 设计演进路线图

```
┌─────────────────────────────────────────────────────────────────┐
│                    CodeGraph 设计演进                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  v1.0 (原 Blueprint)                                            │
│  ├─ 基础图结构                                                  │
│  ├─ 增量更新 (基础)                                             │
│  ├─ 情报 API (隐含场景推断)                                     │
│  └─ Orchestrator 集成 (假设语义理解)                            │
│                                                                 │
│  v2.0 (本文档)                                                  │
│  ├─ 分层 Cascade 策略                                          │
│  ├─ 场景适配规则体系                                            │
│  ├─ 显式情报契约                                                │
│  ├─ 职责边界清晰化                                              │
│  └─ 能力边界约束                                                │
│                                                                 │
│  v3.0 (未来可能)                                                │
│  ├─ 多 Orchestrator 复用验证                                    │
│  ├─ 规则热更新机制                                              │
│  ├─ 自适应 Token 预算                                          │
│  └─ 跨语言场景适配                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 附录 A: 类型定义汇总

```typescript
// ========== 场景与任务类型 ==========

enum QueryScenario {
  MSPEC_PLANNING = 'MSPEC_PLANNING',
  SPRINT_BREAKDOWN = 'SPRING_BREAKDOWN',
  ATOM_TASK_EXECUTION = 'ATOM_TASK_EXECUTION'
}

enum TaskType {
  REFACTOR = 'REFACTOR',
  NEW_FEATURE = 'NEW_FEATURE',
  BUG_FIX = 'BUG_FIX',
  SECURITY = 'SECURITY',
  TESTING = 'TESTING'
}

enum InfoType {
  ARCHITECTURE_LAYERS = 'ARCHITECTURE_LAYERS',
  MODULE_BOUNDARIES = 'MODULE_BOUNDARIES',
  ARCH_CONSTRAINTS = 'ARCH_CONSTRAINTS',
  IMPACT_RANGE = 'IMPACT_RANGE',
  CALL_GRAPH = 'CALL_GRAPH',
  HOTSPOTS = 'HOTSPOTS',
  CYCLES = 'CYCLES',
  TEST_SCOPE = 'TEST_SCOPE',
  COVERAGE = 'COVERAGE',
  RECENT_CHANGES = 'RECENT_CHANGES',
  CO_CHANGE_PATTERNS = 'CO_CHANGE_PATTERNS',
  COMPLEXITY = 'COMPLEXITY',
  MATURITY_SCORE = 'MATURITY_SCORE',
  JSDOC = 'JSDOC',
  SCOPE = 'SCOPE',
  DEPENDENCIES = 'DEPENDENCIES',
  EXTERNAL_DEPS = 'EXTERNAL_DEPS'
}

// ========== Cascade 策略 ==========

interface CascadePolicy {
  maxDepth: number;
  hotspotThreshold: number;
  cycleBlockStrategy: 'reparse-cycle-only' | 'cascade-with-warning';
  overflowStrategy: 'mark-unsafe' | 'force-full-reparse';
}

interface IncrementalMetrics {
  cascadeDepth: number;
  reparsedRatio: number;
  durationMs: number;
  hotspotAlerts: number;
  cycleReparsed: number;
}

// ========== 场景适配规则 ==========

interface ScenarioAdaptationRule {
  scenario: QueryScenario;
  nodeGranularity: 'FILE' | 'MODULE' | 'FUNCTION' | 'MIXED';
  requiredInfo: InfoType[];
  recommendedInfo: InfoType[];
  excludedInfo: InfoType[];
  tokenBudgetRange: { min: number; max: number };
  outputFormat: 'HIERARCHICAL_SUMMARY' | 'TASK_DAG' | 'COMPACT_FUNCTION_VIEW';
  includeRiskAlerts: boolean;
  includeAgentSuggestions: boolean;
}

interface ContextTemplate {
  required: InfoType[];
  recommended: InfoType[];
  optional: InfoType[];
}

// ========== 情报契约 ==========

interface QueryRequest {
  scenario: QueryScenario;
  targets: string[];
  keywords?: string[];
  budget?: number;
  overrides?: {
    includeExtra?: InfoType[];
    excludeExtra?: InfoType[];
    budgetOverride?: number;
  };
}

interface QueryResponse {
  content: string;
  estimatedTokens: number;
  metrics: {
    complexity: number;
    fanIn: number;
    fanOut: number;
    hotspotScore: number;
    cycleRisk: number;
    testCoverage: number;
    recentChangeFrequency: number;
  };
  alerts: Alert[];
  meta: {
    scenario: QueryScenario;
    nodesQueried: number;
    rulesApplied: string[];
    budgetUsed: number;
    budgetRemaining: number;
  };
}

interface Alert {
  type: AlertType;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  context: string[];
}

enum AlertType {
  CYCLE_DETECTED = 'CYCLE_DETECTED',
  HOTSPOT_IMPACT = 'HOTSPOT_IMPACT',
  ARCH_VIOLATION = 'ARCH_VIOLATION',
  MISSING_TEST = 'MISSING_TEST',
  HIGH_COMPLEXITY = 'HIGH_COMPLEXITY',
  INSUFFICIENT_BUDGET = 'INSUFFICIENT_BUDGET'
}
```

---

## 附录 B: 调用示例

### B.1 MSpec 规划阶段调用

```typescript
// Orchestrator 调用
const request: QueryRequest = {
  scenario: 'MSPEC_PLANNING',
  targets: [
    'FILE:src/auth/',
    'FILE:src/api/',
    'FILE:src/models/'
  ],
  budget: 500
};

const response = await codegraph.queryWithContext(request);

// Orchestrator 解读
if (response.metrics.cycleRisk > 0.5) {
  // 主观决策: 建议先处理循环依赖
  plannerNote.add('检测到循环风险，建议优先重构');
}
```

### B.2 Sprint 分解阶段调用

```typescript
// Orchestrator 调用
const request: QueryRequest = {
  scenario: 'SPRING_BREAKDOWN',
  targets: [
    'FILE:src/auth/login.ts',
    'FILE:src/auth/register.ts'
  ],
  overrides: {
    includeExtra: ['CO_CHANGE_PATTERNS']
  }
};

const response = await codegraph.queryWithContext(request);

// Orchestrator 解读
const impactFiles = response.content;  // 获取影响范围文本
if (response.metrics.fanIn > 20) {
  // 主观判断: 这是热点，需要单独任务
  sprint.addTask({ title: '热点文件修改审批', priority: 'HIGH' });
}
```

### B.3 atom_task 执行阶段调用

```typescript
// Orchestrator 调用
const request: QueryRequest = {
  scenario: 'ATOM_TASK_EXECUTION',
  targets: [
    'MODULE:src/auth/login.ts#authenticate'
  ],
  budget: 300
};

const response = await codegraph.queryWithContext(request);

// 直接注入 Agent
agent.run({
  systemPrompt: response.content
});
```

---

**文档版本**: v2.0
**创建日期**: 2026-05-02
**关联文档**: [01_origin_blueprint.md](./01_origin_blueprint.md)
**状态**: 设计草案，待评审