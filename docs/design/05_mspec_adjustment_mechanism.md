# OMT MSpec 微调机制设计文档

## 1. 概述

### 1.1 MSpec 微调的定义

MSpec 微调是指：当 M_current 完成后，Orchestrator 分析 M_next 的原始 MSpec (v1.0)，结合 M_current 完成的实际状态，判断是否需要调整 M_next 的 Scope、Target 或 WBS。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MSpec 微调在 OMT 流程中的位置                              │
└─────────────────────────────────────────────────────────────────────────────┘

M_current 所有 Sprint 完成 (WBS v1.0 全部执行)
        │
        ├── 1. 全 repo 关系建模
        │       ├── grasp_brain_index (完整索引)
        │       ├── 更新 .omt/brain.json mirror
        │       └── 获取完整 health_grade
        │
        ├── 2. M_current Review Gate
        │       ├── 检验 M_current 是否达到 MSpec 目标
        │       ├── 分析 M_current 完成内容的质量
        │       └── 记录到 MSpec reviews
        │
        ├── 3. MSpec 微调判断 (本设计核心)
        │       │
        │       ├── 读取 M_next 原始 MSpec (v1.0)
        │       ├── 结合 M_current 完成的实际状态
        │       ├── 执行触发条件检测
        │       └── 判断是否需要微调
        │               │
        │               ├── 无触发 → 保持 M_next MSpec v1.0
        │               ├── 弱触发 → 建议微调 (用户决策)
        │               └── 强触发 → 强制微调 → 生成 M_next MSpec v1.1
        │
        └── 4. 进入 M_next Sprint 执行
                │
                │ 重复 M_current 的过程
                │
                ▼
        M_next 完成 → 分析 M_next+1 → ... → 所有 MSpec 完成
```

### 1.2 微调的核心原则

```typescript
/**
 * MSpec 微调核心原则定义
 */
interface MSpecAdjustmentPrinciples {
  principle_1: {
    name: "最小变更原则";
    description: "微调应尽量保持 MSpec 原有结构，只修改必要的部分";
  };
  principle_2: {
    name: "依赖驱动原则";
    description: "微调主要基于 M_current 对 M_next 的依赖影响，而非主观判断";
  };
  principle_3: {
    name: "证据导向原则";
    description: "所有微调决策必须有 grasp/PMB 数据支撑，不能凭空调整";
  };
  principle_4: {
    name: "用户决策优先";
    description: "弱触发条件下，用户有权选择是否微调";
  };
}

const mspecAdjustmentPrinciples: MSpecAdjustmentPrinciples = {
  principle_1: {
    name: "最小变更原则",
    description: "微调应尽量保持 MSpec 原有结构，只修改必要的部分",
  },
  principle_2: {
    name: "依赖驱动原则",
    description: "微调主要基于 M_current 对 M_next 的依赖影响，而非主观判断",
  },
  principle_3: {
    name: "证据导向原则",
    description: "所有微调决策必须有 grasp/PMB 数据支撑，不能凭空调整",
  },
  principle_4: {
    name: "用户决策优先",
    description: "弱触发条件下，用户有权选择是否微调",
  },
};
```

---

## 2. 输入数据定义

### 2.1 MSpec 微调所需的数据源

| 数据源 | 获取方式 | 用途 |
|--------|---------|------|
| M_next 原始 MSpec | `.omt/tspecs/tspec_<ts>/mspecs/mspec_<ts>/mspec_v1.0.json` | 作为微调基准 |
| M_current MSpec Reviews | `.omt/tspecs/tspec_<ts>/mspecs/mspec_<ts>/sprints/sprint_<num>/review.json` | 了解 M_current 完成情况 |
| brain.json | `.omt/brain.json` | 当前 repo 状态 |
| PMB | `.omt/memory/pmb.json` | Sprint 执行历史 |
| grasp_brain_index | MCP Server grasp | 全 repo 关系模型 |

### 2.2 数据提取结构

```typescript
/**
 * MSpec 微调所需的数据提取结构
 */
interface MSpecAdjustmentInput {
  // 来源: M_next 原始 MSpec
  m_next_original: {
    proposal: {
      scope: string;      // M_next 原始 Scope 定义
      target: string;     // M_next 原始 Target 定义
      dependencies: string; // M_next 对 M_current 的依赖假设
    };
    design: {
      modules: string[];   // M_next 要实现的模块列表
      interfaces: string[]; // M_next 预期的接口定义
    };
    wbs_v1: {
      atom_tasks: string[]; // 原始 WBS 任务列表
      total_tasks: number;
    };
  };

  // 来源: M_current Review
  m_current_review: {
    completion_status: "COMPLETE" | "PARTIAL" | "FAILED";
    health_grade: "A" | "B" | "C" | "D" | "F";
    deferred_tasks: string[];  // M_current 延期任务列表
    lessons: string[];         // M_current Sprint Lessons
  };

  // 来源: brain.json
  repo_state: {
    health_score: number;
    hotspots: string[];        // 当前热点文件
    modules_implemented: string[]; // 已实现模块
  };

  // 来源: PMB
  sprint_history: {
    m_current_sprints_completed: number;
    m_current_total_tasks: number;
    m_current_completion_rate: number; // 0.0 - 1.0
  };

  // 来源: grasp_brain_index
  grasp_analysis: {
    architecture: string;       // 当前架构状态
    module_interfaces: string;  // 当前接口定义
    dependency_graph: string;   // 当前依赖关系
    affected_by_m_current: string[];   // M_current 变更影响范围
  };
}
```

---

## 3. 触发条件分类

### 3.1 强触发条件 (必须微调)

当检测到以下条件时，**强制执行 MSpec 微调**：

```typescript
/**
 * 强触发条件定义 (必须微调)
 * 当检测到以下条件时，强制执行 MSpec 微调
 */
interface StrongTrigger {
  name: string;
  condition: string;
  detection: string[];
  action: string[];
  example: {
    scenario: string;
    impact: string;
    adjustment: string;
  };
}

interface StrongTriggers {
  trigger_1: StrongTrigger; // 接口不兼容
  trigger_2: StrongTrigger; // 安全问题遗留
  trigger_3: StrongTrigger; // 健康度严重偏离
  trigger_4: StrongTrigger; // 关键依赖缺失
}

const strongTriggers: StrongTriggers = {
  trigger_1: {
    name: "接口不兼容",
    condition: "M_current 实现与 M_next 预期接口不兼容",
    detection: [
      "grasp_detect_changes: 发现 M_next 依赖模块的接口变更",
      "grasp_api_surface: M_current 新增的 API 签名与 M_next 预期不一致",
      "M_current WBS: M_current 新增的模块破坏了 M_next WBS 的依赖假设",
    ],
    action: [
      "更新 M_next Design: 修改接口定义",
      "更新 M_next WBS: 添加接口适配任务",
      "生成 M_next MSpec v1.1",
    ],
    example: {
      scenario: "M_current 实现了 OAuth2，但接口是 JWT 格式",
      impact: "M_next 原本假设使用 JWT，现在需要适配 OAuth2",
      adjustment: "在 M_next WBS 添加 OAuth2 适配任务",
    },
  },
  trigger_2: {
    name: "安全问题遗留",
    condition: "M_current 遗留安全问题影响 M_next",
    detection: [
      "grasp_security: 发现 M_next 目标模块有 CRITICAL/HIGH 问题",
      "brain.json.security_issues: M_current 未修复且涉及 M_next 的安全问题",
    ],
    action: [
      "更新 M_next Proposal: 添加安全修复 Scope",
      "更新 M_next WBS: 插入安全修复任务（优先级最高）",
      "生成 M_next MSpec v1.1",
    ],
    example: {
      scenario: "M_current 遗留 SQL注入漏洞在 auth 模块",
      impact: "M_next 要扩展 auth 功能，必须先修复漏洞",
      adjustment: "M_next Sprint-1 添加安全修复 atom_task",
    },
  },
  trigger_3: {
    name: "健康度严重偏离",
    condition: "M_current 完成后 repo 健康度不达标",
    detection: [
      "brain.json.health_grade: Grade < 'C'",
      "grasp_metrics: 复杂度/覆盖率严重低于目标",
    ],
    action: [
      "更新 M_next Proposal: 添加质量提升 Scope",
      "更新 M_next WBS: 添加重构/测试补充任务",
      "生成 M_next MSpec v1.1",
    ],
    example: {
      scenario: "M_current 完成后 health_grade = D",
      impact: "M_next 基于 D 级代码开发，风险极高",
      adjustment: "M_next 前两个 Sprint 用于重构和测试补充",
    },
  },
  trigger_4: {
    name: "关键依赖缺失",
    condition: "M_current 未完成 M_next 关键依赖",
    detection: [
      "M_current deferred_tasks: 包含 M_next blocked_by 的任务",
      "grasp_dependents: M_next 依赖的模块未实现或部分实现",
    ],
    action: [
      "更新 M_next WBS: 将 M_current deferred 任务纳入 M_next",
      "或: 重新定义 M_next Scope 排除依赖",
      "生成 M_next MSpec v1.1",
    ],
    example: {
      scenario: "M_current deferred 了 database-migration 任务",
      impact: "M_next WBS 中的 backend-api 依赖 database-migration",
      adjustment: "将 database-migration 作为 M_next Sprint-1 首要任务",
    },
  },
};
```

### 3.2 弱触发条件 (建议微调)

当检测到以下条件时，**建议微调但需用户确认**：

```typescript
/**
 * 弱触发条件定义 (建议微调)
 * 当检测到以下条件时，建议微调但需用户确认
 */
interface WeakTrigger {
  name: string;
  condition: string;
  detection: string[];
  action: string[];
  example: {
    scenario: string;
    impact: string;
    recommendation: string;
  };
}

interface WeakTriggers {
  trigger_1: WeakTrigger; // 效率偏差
  trigger_2: WeakTrigger; // 延期任务影响
  trigger_3: WeakTrigger; // PMB Lessons 风险提示
  trigger_4: WeakTrigger; // 热点文件重叠
}

const weakTriggers: WeakTriggers = {
  trigger_1: {
    name: "效率偏差",
    condition: "M_current 完成效率与预期差异大",
    detection: [
      "PMB.sprint_tracking: M_current 实际耗时 vs M_current 预估耗时",
      "偏差率 > 50% (严重低估或高估)",
    ],
    action: [
      "建议: 调整 M_next WBS 任务复杂度估算",
      "建议: 增加 M_next 时间缓冲",
      "用户决策: 是否采纳建议",
    ],
    example: {
      scenario: "M_current 预估 40 hours，实际 80 hours",
      impact: "暗示 M_next 复杂度可能也被低估",
      recommendation: "M_next WBS 任务估算 × 1.5",
    },
  },
  trigger_2: {
    name: "延期任务影响",
    condition: "M_current deferred_tasks 可能影响 M_next",
    detection: [
      "PMB.deferred_tasks: deferred 任务与 M_next 模块相关",
      "grasp_affected_modules: deferred 任务的 blast radius",
    ],
    action: [
      "建议: 将相关 deferred 任务纳入 M_next Scope",
      "建议: 在 M_next 增加兼容性处理任务",
      "用户决策: 是否采纳建议",
    ],
    example: {
      scenario: "M_current deferred 了 logging-config 任务",
      impact: "M_next 的 error-handling 模块依赖 logging",
      recommendation: "M_next Sprint-1 添加 logging-config 完成",
    },
  },
  trigger_3: {
    name: "PMB Lessons 风险提示",
    condition: "M_current Lessons 提到 M_next 相关风险",
    detection: [
      "PMB.sprint_lessons: 包含 M_next 相关的技术难点",
      "lessons.impact = 'high' 且涉及 M_next Scope",
    ],
    action: [
      "建议: 在 M_next Proposal 添加风险缓解措施",
      "建议: 在 M_next WBS 添加 Spike 任务",
      "用户决策: 是否采纳建议",
    ],
    example: {
      scenario: "M_current Lessons: 'middleware integration underestimated'",
      impact: "M_next 有更多 middleware 任务",
      recommendation: "M_next Sprint-1 添加 middleware spike",
    },
  },
  trigger_4: {
    name: "热点文件重叠",
    condition: "M_current 热点文件与 M_next 目标模块重叠",
    detection: [
      "brain.json.hotspots: 热点文件属于 M_next 目标模块",
      "hotspot.score > 7 (高风险)",
    ],
    action: [
      "建议: 在 M_next 增加重构任务降低复杂度",
      "建议: 优先处理热点模块",
      "用户决策: 是否采纳建议",
    ],
    example: {
      scenario: "M_current hotspot: src/auth/index.ts (score=9)",
      impact: "M_next 要扩展 auth 模块",
      recommendation: "M_next Sprint-1 先重构 auth/index.ts",
    },
  },
};
```

### 3.3 无触发条件 (保持原 MSpec)

当**未检测到任何触发条件**时，保持 M_next 原始 MSpec：

```typescript
/**
 * 无触发条件定义 (保持原 MSpec)
 * 当未检测到任何触发条件时，保持 M_next 原始 MSpec
 */
interface NoTriggerCondition {
  name: string;
  criteria: string[];
}

interface NoTriggerConditions {
  condition_1: NoTriggerCondition; // M_current 按预期完成
  condition_2: NoTriggerCondition; // M_current 与 M_next 边界清晰
  condition_3: NoTriggerCondition; // 无安全/质量问题
}

const noTriggerConditions: NoTriggerConditions = {
  condition_1: {
    name: "M_current 按预期完成",
    criteria: [
      "M_current completion_rate >= 90%",
      "M_current health_grade >= 'B'",
      "M_current deferred_tasks = [] 或不影响 M_next",
    ],
  },
  condition_2: {
    name: "M_current 与 M_next 边界清晰",
    criteria: [
      "grasp_architecture: 模块边界未变化",
      "M_next 依赖模块未被 M_current 修改",
      "M_current 接口与 M_next 预期一致",
    ],
  },
  condition_3: {
    name: "无安全/质量问题",
    criteria: [
      "brain.json.security_issues: CRITICAL/HIGH = 0",
      "M_current 模块 health_grade >= 'B'",
    ],
  },
};

// 无触发时的动作
const noTriggerAction: string[] = [
  "保持 M_next MSpec v1.0",
  "直接进入 M_next Sprint 执行",
  "记录 '无微调' 到 M_next Review",
];
```

---

## 4. 微调决策算法

### 4.1 决策流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MSpec 微调决策流程                                         │
└─────────────────────────────────────────────────────────────────────────────┘

M_current Review Gate 完成
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: 数据收集                                                │
├─────────────────────────────────────────────────────────────────┤
│  • 读取 M_next 原始 MSpec                                        │
│  • 读取 M_current Review                                        │
│  • 读取 brain.json                                              │
│  • 读取 PMB                                                     │
│  • 执行 grasp_brain_index 查询                                  │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: 强触发检测                                              │
├─────────────────────────────────────────────────────────────────┤
│  执行检测:                                                       │
│  • detect_interface_compatibility(m_current_result, m_next_expected)       │
│  • detect_security_impact(m_current_security, m_next_modules)              │
│  • detect_health_deviation(m_current_health, target_grade)                 │
│  • detect_missing_dependencies(m_current_deferred, m_next_blocked_by)      │
│                                                                 │
│  if 任一条件满足:                                                │
│      → goto Step 4 (强制微调)                                   │
└─────────────────────────────────────────────────────────────────┘
        │
        │ 无强触发
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: 弱触发检测                                              │
├─────────────────────────────────────────────────────────────────┤
│  执行检测:                                                       │
│  • detect_efficiency_deviation(m_current_actual, m_current_estimated)      │
│  • detect_deferral_impact(m_current_deferred, m_next_scope)                │
│  • detect_lessons_risk(m_current_lessons, m_next_scope)                    │
│  • detect_hotspot_overlap(m_current_hotspots, m_next_modules)              │
│                                                                 │
│  if 任一条件满足:                                                │
│      → goto Step 5 (建议微调，用户决策)                          │
│  else:                                                          │
│      → goto Step 6 (保持原 MSpec)                               │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: 强制微调                                                │
├─────────────────────────────────────────────────────────────────┤
│  根据触发类型执行:                                               │
│  • trigger_1 (接口不兼容): 更新 Design + WBS                    │
│  • trigger_2 (安全问题): 插入安全修复任务                        │
│  • trigger_3 (健康度偏离): 插入重构/测试任务                     │
│  • trigger_4 (依赖缺失): 纳入 deferred 或重定义 Scope           │
│                                                                 │
│  输出: M_next MSpec v1.1                                        │
│  记录: 微调原因到 M_next Review                                  │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 5: 建议微调                                                │
├─────────────────────────────────────────────────────────────────┤
│  生成微调建议报告:                                               │
│  • 触发条件描述                                                  │
│  • 影响范围评估                                                  │
│  • 建议调整内容                                                  │
│  • 预期收益                                                      │
│                                                                 │
│  AskUserQuestion: 是否采纳建议?                                  │
│  • YES → 执行微调 → M_next MSpec v1.1                          │
│  • NO → 保持原 MSpec → M_next MSpec v1.0                       │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 6: 保持原 MSpec                                            │
├─────────────────────────────────────────────────────────────────┤
│  • 无需修改 M_next MSpec                                        │
│  • 记录: "无微调，基于 M_current 正常完成"                      │
│  • 直接进入 M_next Sprint 执行                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 检测函数实现

```typescript
import type { MSpecAdjustmentInput, HealthGrade } from "./types";

// Grade 评分映射
const gradeScores: Record<HealthGrade, number> = {
  A: 4,
  B: 3,
  C: 2,
  D: 1,
  F: 0,
};

/**
 * 检测 M_current 实现与 M_next 预期接口是否兼容
 * @returns true = 不兼容 (触发微调), false = 兼容 (无触发)
 */
function detectInterfaceCompatibility(
  m_current_result: { modules: string[] },
  m_next_expected: { interfaces: Array<{ name: string; signature: string }> }
): boolean {
  // 从 M_current 获取实际接口 (通过 grasp API)
  const m_current_interfaces = graspApiSurface(m_current_result.modules);

  // 从 M_next 获取预期接口
  const m_next_interfaces = m_next_expected.interfaces;

  // 比较接口签名
  for (const expected of m_next_interfaces) {
    const actual = findMatchingInterface(m_current_interfaces, expected.name);

    if (actual === undefined) {
      // M_next 预期接口不存在
      return true;
    }

    if (!isSignatureCompatible(actual.signature, expected.signature)) {
      // 签名不匹配
      return true;
    }
  }

  return false;
}

/**
 * 检测 M_current 安全问题是否影响 M_next
 * @returns true = 有影响 (触发微调), false = 无影响
 */
function detectSecurityImpact(
  m_current_security: { unresolved: Array<{ severity: string; file: string }> },
  m_next_modules: string[]
): boolean {
  // 获取 M_current 未修复的安全问题
  const unresolvedIssues = m_current_security.unresolved ?? [];

  // 检查问题是否涉及 M_next 目标模块
  for (const issue of unresolvedIssues) {
    if (issue.severity === "CRITICAL" || issue.severity === "HIGH") {
      // 检查 blast radius
      const affectedModules = graspDependents(issue.file);

      for (const m_next_module of m_next_modules) {
        if (affectedModules.includes(m_next_module)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * 检测 M_current 健康度是否严重偏离
 * @returns true = 偏离严重 (触发微调), false = 达标
 */
function detectHealthDeviation(
  m_current_health: { grade?: HealthGrade; test_coverage?: number; complexity_avg?: number },
  targetGrade: HealthGrade
): boolean {
  const m_current_grade = m_current_health.grade ?? "F";

  if (gradeScores[m_current_grade] < gradeScores[targetGrade] - 1) {
    // 相差超过一个等级
    return true;
  }

  // 检查具体指标
  if ((m_current_health.test_coverage ?? 0) < 60) {
    return true;
  }

  if ((m_current_health.complexity_avg ?? 0) > 20) {
    return true;
  }

  return false;
}

/**
 * 检测 M_current deferred 任务是否阻塞 M_next
 * @returns true = 有阻塞 (触发微调), false = 无阻塞
 */
function detectMissingDependencies(
  m_current_deferred: Array<{ task_id: string }>,
  m_next_blocked_by: Record<string, string[]>
): boolean {
  const deferredIds = m_current_deferred.map((t) => t.task_id);

  // 检查 M_next WBS 中是否有任务依赖 deferred 任务
  for (const [taskId, blockers] of Object.entries(m_next_blocked_by)) {
    for (const blocker of blockers) {
      if (deferredIds.includes(blocker)) {
        return true;
      }
    }
  }

  return false;
}

// 辅助函数声明 (实际实现由 grasp MCP Server 提供)
declare function graspApiSurface(modules: string[]): Array<{ name: string; signature: string }>;
declare function findMatchingInterface(
  interfaces: Array<{ name: string; signature: string }>,
  name: string
): { name: string; signature: string } | undefined;
declare function isSignatureCompatible(actual: string, expected: string): boolean;
declare function graspDependents(file: string): string[];
```

---

## 5. 微调操作类型

### 5.1 Scope 微调

```typescript
/**
 * Scope 微调类型定义
 */
interface ScopeAdjustmentType {
  name: string;
  trigger: string;
  operation: string[];
}

interface ScopeAdjustmentTypes {
  type_1: ScopeAdjustmentType; // 扩展 Scope
  type_2: ScopeAdjustmentType; // 收缩 Scope
  type_3: ScopeAdjustmentType; // 替换 Scope
}

const scopeAdjustmentTypes: ScopeAdjustmentTypes = {
  type_1: {
    name: "扩展 Scope",
    trigger: "接口不兼容",
    operation: [
      "新增模块到 M_next Scope",
      "例: M_current 实现了 OAuth2，M_next 需添加 OAuth2-Adapter 模块",
    ],
  },
  type_2: {
    name: "收缩 Scope",
    trigger: "依赖缺失",
    operation: [
      "移除依赖未满足的模块",
      "例: M_current deferred database，M_next 移除 backend-api",
    ],
  },
  type_3: {
    name: "替换 Scope",
    trigger: "M_current 实现了预期之外的模块",
    operation: [
      "替换 M_next 原定模块为新模块",
      "例: M_current 实现了 Redis-session，M_next 将 JWT-session 替换为 Redis-adapter",
    ],
  },
};
```

### 5.2 Target 微调

```typescript
/**
 * Target 微调类型定义
 */
interface TargetAdjustmentType {
  name: string;
  trigger: string;
  operation: string[];
}

interface TargetAdjustmentTypes {
  type_1: TargetAdjustmentType; // 降低 Target
  type_2: TargetAdjustmentType; // 调整验收标准
  type_3: TargetAdjustmentType; // 推迟交付时间
}

const targetAdjustmentTypes: TargetAdjustmentTypes = {
  type_1: {
    name: "降低 Target",
    trigger: "健康度偏离",
    operation: [
      "降低质量目标",
      "例: 原 Target Grade=A，调整为 Grade=B",
    ],
  },
  type_2: {
    name: "调整验收标准",
    trigger: "安全问题遗留",
    operation: [
      "添加安全验收条件",
      "例: 新增 '0 CRITICAL/HIGH security issues' 作为验收标准",
    ],
  },
  type_3: {
    name: "推迟交付时间",
    trigger: "效率偏差",
    operation: [
      "延长 M_next 预估时间",
      "例: 原 2 weeks，调整为 3 weeks",
    ],
  },
};
```

### 5.3 WBS 微调

```typescript
/**
 * WBS 微调类型定义
 */
interface WbsAdjustmentType {
  name: string;
  trigger: string;
  operation: string[];
}

interface WbsAdjustmentTypes {
  type_1: WbsAdjustmentType; // 插入任务
  type_2: WbsAdjustmentType; // 移除任务
  type_3: WbsAdjustmentType; // 调整任务顺序
  type_4: WbsAdjustmentType; // 更新任务复杂度
}

const wbsAdjustmentTypes: WbsAdjustmentTypes = {
  type_1: {
    name: "插入任务",
    trigger: "安全问题/健康度偏离",
    operation: [
      "在 WBS 前部插入新任务",
      "例: Sprint-1 添加 'fix-security-issue-001'",
    ],
  },
  type_2: {
    name: "移除任务",
    trigger: "Scope 收缩",
    operation: [
      "移除依赖不满足的任务",
      "例: 移除 'implement-backend-api' (依赖 database 未完成)",
    ],
  },
  type_3: {
    name: "调整任务顺序",
    trigger: "延期任务影响",
    operation: [
      "优先完成 deferred 任务",
      "例: 将 deferred 的 'config-setup' 提升为 Sprint-1 Task-001",
    ],
  },
  type_4: {
    name: "更新任务复杂度",
    trigger: "效率偏差",
    operation: [
      "重新估算任务复杂度",
      "例: 原 complexity=5，调整为 complexity=8",
    ],
  },
};
```

---

## 6. 微调输出格式

### 6.1 MSpec v1.1 结构

```typescript
/**
 * M_next MSpec v1.1 结构 (微调后)
 */
interface MSpecV1_1 {
  version: "1.1";
  adjusted_from: "1.0";
  adjustment_reason: string;  // 触发条件描述
  adjustment_date: string;    // ISO timestamp

  proposal: {
    scope: {
      original: string;   // v1.0 Scope
      adjusted: string;   // v1.1 Scope
      change_summary: string; // 变更摘要
    };
    target: {
      original: string;   // v1.0 Target
      adjusted: string;   // v1.1 Target
    };
    adjustment_log: Array<{
      trigger: string;
      evidence: string;
      action: string;
    }>;
  };

  design: {
    interfaces: {
      original: string[];
      adjusted: string[];
    };
    modules: {
      original: string[];
      adjusted: string[];
    };
  };

  wbs: {
    version: "1.1";
    total_tasks: number;  // 原 30 + 新增 5
    new_tasks: Array<{
      id: string;
      description: string;
      complexity: number;
      inserted_at: string;  // Sprint-1 Task-001
    }>;
    removed_tasks: string[];
    reordered_tasks: string[];  // ["config-001 → Sprint-1"]
  };

  reviews: {
    adjustment_review: {
      trigger_detected: boolean;
      user_confirmed: boolean | null;  // 强触发时为 null
      confidence: number;  // 0.0 - 1.0
    };
  };
}

// 示例数据
const mspecV1_1Example: MSpecV1_1 = {
  version: "1.1",
  adjusted_from: "1.0",
  adjustment_reason: "接口不兼容",
  adjustment_date: "2026-04-30T10:30:00Z",
  proposal: {
    scope: {
      original: "Extend auth system with JWT support",
      adjusted: "Add OAuth2 adapter + extend auth with session management",
      change_summary: "新增 OAuth2-Adapter 模块以适配 M_current 实现的 OAuth2",
    },
    target: {
      original: "JWT auth system",
      adjusted: "OAuth2 + Session hybrid auth system",
    },
    adjustment_log: [
      {
        trigger: "interface_incompatibility",
        evidence: "M_current OAuth2 vs M_next JWT expected",
        action: "Add OAuth2-Adapter module",
      },
    ],
  },
  design: {
    interfaces: {
      original: ["JWT.login(username, password) → JWTToken"],
      adjusted: ["OAuth2.login(provider) → Token", "Session.validate(bearer_token) → boolean"],
    },
    modules: {
      original: ["jwt-handler", "auth-middleware"],
      adjusted: ["oauth2-adapter", "session-handler", "auth-middleware"],
    },
  },
  wbs: {
    version: "1.1",
    total_tasks: 35,
    new_tasks: [
      {
        id: "adapter-001",
        description: "Implement OAuth2 adapter",
        complexity: 6,
        inserted_at: "Sprint-1 Task-001",
      },
    ],
    removed_tasks: [],
    reordered_tasks: ["auth-middleware → Sprint-2"],
  },
  reviews: {
    adjustment_review: {
      trigger_detected: true,
      user_confirmed: null,
      confidence: 0.95,
    },
  },
};
```

### 6.2 微调报告格式

```markdown
## MSpec 微调报告

**目标 Milestone**: M_next
**原始版本**: v1.0
**微调版本**: v1.1
**微调日期**: 2026-04-30

---

### 触发条件

**触发类型**: 强触发 - 接口不兼容
**触发证据**:
- M_current 实现了 OAuth2 认证 (接口: token-based)
- M_next 原定使用 JWT 认证 (接口: header-based)
- 签名不匹配: OAuth2 expects `Bearer` token, M_next expects `Authorization` header

---

### 微调操作

#### Scope 变更
| 操作类型 | 内容 |
|---------|------|
| 扩展 | 新增 OAuth2-Adapter 模块 |

#### WBS 变更
| 操作类型 | 任务 | 位置 |
|---------|------|------|
| 插入 | adapter-001: Implement OAuth2 adapter | Sprint-1 Task-001 |
| 插入 | adapter-002: Create token conversion utility | Sprint-1 Task-002 |
| 重排序 | auth-middleware → Sprint-2 | 原 Sprint-1 |

---

### 预期影响

**任务数变化**: 30 → 35 (+5)
**预估时间变化**: 2 weeks → 2.5 weeks (+3 days)
**风险降低**: 高 (避免接口冲突导致的返工)

---

### 验收决策

**决策**: 强制微调
**依据**: 接口不兼容触发条件 #1
**确认状态**: 自动执行 (强触发无需用户确认)
```

---

## 7. 完整示例

### 7.1 示例场景：接口不兼容触发微调

```typescript
/**
 * 示例场景：接口不兼容触发微调
 */
interface ExampleScenario {
  context: {
    m_current_status: {
      completed_modules: string[];
      interfaces_implemented: Array<{
        name: string;
        signature: string;
      }>;
      health_grade: HealthGrade;
    };
    m_next_original: {
      scope: string;
      expected_interfaces: Array<{
        name: string;
        signature: string;
      }>;
      wbs_tasks: number;
    };
  };
  detection: {
    step_1: string;
    result: {
      login_interface: {
        status: "INCOMPATIBLE";
        details: string[];
      };
      validate_interface: {
        status: "INCOMPATIBLE";
        details: string[];
      };
    };
    trigger: "STRONG_TRIGGER_1";
  };
  adjustment: {
    scope_change: {
      original: string;
      adjusted: string;
      reason: string;
    };
    wbs_change: {
      new_tasks: Array<{
        id: string;
        description: string;
        complexity: number;
        assignee_role: string;
        blocked_by: string[];
      }>;
      reordered: string[];
    };
    target_change: {
      original_target: string;
      adjusted_target: string;
    };
  };
  output: {
    mspec_version: string;
    total_tasks: number;
    estimated_time: string;
    review_recorded: {
      trigger: string;
      evidence: string;
      action: string;
    };
  };
}

const exampleScenario: ExampleScenario = {
  context: {
    m_current_status: {
      completed_modules: ["auth-oauth2"],
      interfaces_implemented: [
        {
          name: "login",
          signature: "OAuth2.login(provider: string) → Token",
        },
        {
          name: "validate",
          signature: "OAuth2.validate(bearer_token: string) → boolean",
        },
      ],
      health_grade: "B",
    },
    m_next_original: {
      scope: "Extend auth system with JWT support",
      expected_interfaces: [
        {
          name: "login",
          signature: "JWT.login(username: string, password: string) → JWTToken",
        },
        {
          name: "validate",
          signature: "JWT.validate(auth_header: string) → boolean",
        },
      ],
      wbs_tasks: 30,
    },
  },
  detection: {
    step_1: "detect_interface_compatibility",
    result: {
      login_interface: {
        status: "INCOMPATIBLE",
        details: [
          "m_current_actual: OAuth2.login(provider)",
          "m_next_expected: JWT.login(username, password)",
        ],
      },
      validate_interface: {
        status: "INCOMPATIBLE",
        details: [
          "m_current_actual: OAuth2.validate(bearer_token)",
          "m_next_expected: JWT.validate(auth_header)",
        ],
      },
    },
    trigger: "STRONG_TRIGGER_1",
  },
  adjustment: {
    scope_change: {
      original: "Extend auth with JWT",
      adjusted: "Add OAuth2 adapter + extend auth with session management",
      reason: "M_current implemented OAuth2, M_next must adapt rather than replace",
    },
    wbs_change: {
      new_tasks: [
        {
          id: "adapter-001",
          description: "Create OAuth2-to-session adapter",
          complexity: 6,
          assignee_role: "backend-dev",
          blocked_by: [],
        },
        {
          id: "adapter-002",
          description: "Implement session token converter",
          complexity: 4,
          assignee_role: "backend-dev",
          blocked_by: ["adapter-001"],
        },
      ],
      reordered: ["jwt-001 → Sprint-2"],
    },
    target_change: {
      original_target: "JWT auth system",
      adjusted_target: "OAuth2 + Session hybrid auth system",
    },
  },
  output: {
    mspec_version: "v1.1",
    total_tasks: 32,
    estimated_time: "+2 days",
    review_recorded: {
      trigger: "interface_incompatibility",
      evidence: "OAuth2 vs JWT signature mismatch",
      action: "Add adapter module",
    },
  },
};
```

### 7.2 示例场景：无触发保持原 MSpec

```typescript
/**
 * 示例场景：无触发保持原 MSpec
 */
interface ExampleScenarioNoTrigger {
  context: {
    m_current_status: {
      completed_modules: string[];
      interfaces_implemented: Array<{
        name: string;
        signature: string;
      }>;
      health_grade: HealthGrade;
      deferred_tasks: string[];
    };
    m_next_original: {
      scope: string;
      expected_interfaces: Array<{
        name: string;
        signature: string;
      }>;
      blocked_by: string[];
    };
  };
  detection: {
    step_1: {
      method: string;
      result: "COMPATIBLE";
    };
    step_2: {
      method: string;
      result: "NO_IMPACT";
    };
    step_3: {
      method: string;
      result: "NO_DEVIATION";
    };
    step_4: {
      method: string;
      result: "NO_BLOCKING";
    };
    step_5: {
      method: string;
      result: "NONE";
    };
  };
  decision: {
    action: "KEEP_ORIGINAL";
    mspec_version: "v1.0";
    review_recorded: {
      trigger: "none";
      reason: string;
    };
  };
  execution: {
    proceed_to: string;
    wbs: string;
    estimated_time: string;
  };
}

const exampleScenarioNoTrigger: ExampleScenarioNoTrigger = {
  context: {
    m_current_status: {
      completed_modules: ["core-engine", "grasp-integration"],
      interfaces_implemented: [
        {
          name: "analyze",
          signature: "Engine.analyze(repo_path) → AnalysisResult",
        },
      ],
      health_grade: "B",
      deferred_tasks: [],
    },
    m_next_original: {
      scope: "Implement orchestrator module",
      expected_interfaces: [
        {
          name: "plan",
          signature: "Orchestrator.plan(query) → TaskTree",
        },
      ],
      blocked_by: ["core-engine.analyze"],
    },
  },
  detection: {
    step_1: {
      method: "detect_interface_compatibility",
      result: "COMPATIBLE",
    },
    step_2: {
      method: "detect_security_impact",
      result: "NO_IMPACT",
    },
    step_3: {
      method: "detect_health_deviation",
      result: "NO_DEVIATION",
    },
    step_4: {
      method: "detect_missing_dependencies",
      result: "NO_BLOCKING",
    },
    step_5: {
      method: "weak_trigger_detection",
      result: "NONE",
    },
  },
  decision: {
    action: "KEEP_ORIGINAL",
    mspec_version: "v1.0",
    review_recorded: {
      trigger: "none",
      reason: "M_current completed normally, no impact on M_next",
    },
  },
  execution: {
    proceed_to: "M_next Sprint-1",
    wbs: "Original 30 tasks",
    estimated_time: "Original 2 weeks",
  },
};
```

---

## 8. 与其他模块的集成

### 8.1 与 Sprint Selection 的集成

```typescript
/**
 * 与 Sprint Selection 的集成
 */
interface IntegrationWithSprintSelection {
  flow: string[];
  data_flow: {
    input_to_sprint_selection: string[];
  };
  impact: string[];
}

const integrationWithSprintSelection: IntegrationWithSprintSelection = {
  flow: [
    "MSpec 微调完成 → 输出 WBS v1.1",
    "WBS v1.1 → Sprint Selection Algorithm",
    "Sprint Selection → 选择 Top 10 tasks 组成 Sprint-1",
  ],
  data_flow: {
    input_to_sprint_selection: [
      "WBS.remaining_tasks (可能因微调而变化)",
      "WBS.DAG (可能因任务插入而变化)",
      "PMB (包含 M_current Lessons)",
      "grasp_detect_changes (当前 repo 状态)",
    ],
  },
  impact: [
    "微调可能增加任务 → WBS 增大 → Sprint Selection 需重新计算权重",
    "微调可能重排序 → DAG 变化 → 关键路径可能变化",
    "微调可能添加 blocker → blocked_by 变化 → 可执行池可能缩小",
  ],
};
```

### 8.2 与 Gap Analysis 的集成

```typescript
/**
 * 与 Gap Analysis 的集成
 */
interface IntegrationWithGapAnalysis {
  flow: string[];
  relationship: string[];
}

const integrationWithGapAnalysis: IntegrationWithGapAnalysis = {
  flow: [
    "所有 MSpec 完成 → Gap Analysis",
    "Gap Analysis → 发现偏差 → 可能触发新 MSpec",
    "新 MSpec → MSpec 微调逻辑（从上一个 MSpec 分析）",
  ],
  relationship: [
    "MSpec 微调发生在 Milestone 之间",
    "Gap Analysis 发生在项目验收时",
    "两者共同确保项目一致性",
  ],
};
```

---

## 9. 实现建议

### 9.1 推荐实现位置

```typescript
/**
 * 推荐实现位置
 */
interface ImplementationLocation {
  skill: {
    path: string;
    purpose: string;
  };
  agent: {
    type: string;
    responsibility: string;
  };
  files: string[];
}

const implementationLocation: ImplementationLocation = {
  skill: {
    path: ".claude/skills/mspec-adjustment/SKILL.md",
    purpose: "定义微调触发条件和操作",
  },
  agent: {
    type: "Orchestrator",
    responsibility: "执行微调决策和 MSpec 更新",
  },
  files: [
    ".omt/hooks/mspec-adjuster.ts",
    ".omt/config/adjustment-rules.ts",
  ],
};
```

### 9.2 关键文件清单

| 文件 | 职责 |
|------|------|
| `.claude/skills/mspec-adjustment/SKILL.md` | 微调流程定义 |
| `.omt/hooks/mspec-adjuster.ts` | 微调执行逻辑 |
| `.omt/config/adjustment-rules.ts` | 触发条件配置 |
| `.omt/tspecs/tspec_<ts>/mspecs/mspec_<ts>/` | MSpec 版本存储 |

---

## 开发时 Repo 文件结构

### 开发结构 vs 安装后结构的区别

本文档 §9 描述的文件位置混合了开发时和安装后的场景。以下明确区分:

| 维度 | 开发时结构 (本 Repo) | 安装后结构 (目标项目 `.omt/`) |
|------|---------------------|------------------------------|
| **用途** | 开发 MSpec 微调算法 | 在目标项目中执行微调 |
| **创建方式** | 手动创建，Git 管理 | `omt init` 自动生成 |
| **生命周期** | 持久化，持续迭代 | 随 Milestone 动态变化 |
| **核心内容** | TypeScript 源码、Skill 定义 | 编译后的微调脚本、MSpec 版本 |

### MSpec Adjustment 模块在开发结构中的位置

MSpec Adjustment 算法源码位于 `src/algorithms/mspec-adjustment/`:

```
src/algorithms/mspec-adjustment/
├── index.ts                   # 主入口，导出 adjustMSpec API
├── trigger-detector.ts        # 触发条件检测 (对应 §3)
│   # - detectInterfaceCompatibility()
│   # - detectSecurityImpact()
│   # - detectHealthDeviation()
│   # - detectMissingDependencies()
│
├── scope-adjuster.ts          # Scope 微调逻辑 (对应 §5.1)
├── target-adjuster.ts         # Target 微调逻辑 (对应 §5.2)
├── wbs-adjuster.ts            # WBS 微调逻辑 (对应 §5.3)
├── report-generator.ts        # 微调报告生成 (对应 §6.2)
├── types.ts                   # 类型定义 (对应 §2, §6.1)
│   # - MSpecAdjustmentInput
│   # - StrongTrigger, WeakTrigger
│   # - MSpecV1_1
```

### MSpec Adjustment 的 Skill 定义位置

```
.claude/skills/mspec-adjustment/
├── SKILL.md                   # Skill 主定义
│   # - 定义微调触发流程
│   # - 定义 Orchestrator 调用方式
│   # - 定义用户确认交互
│
└── lib/
    ├── trigger-check.ts       # 触发条件检查库
    ├── adjustment-exec.ts     # 微调执行库
    └── report-format.ts       # 报告格式化库
```

### MSpec Adjustment 的测试结构

```
tests/unit/algorithms/
├── mspec-adjustment.test.ts   # MSpec Adjustment 主测试
├── trigger-detector.test.ts   # 触发检测单元测试
│   # - 测试强触发条件检测
│   # - 测试弱触发条件检测
│   # - 测试无触发条件
│
├── scope-adjuster.test.ts     # Scope 微调单元测试
├── wbs-adjuster.test.ts       # WBS 微调单元测试
│
tests/integration/
├── mspec-adjustment-flow.test.ts # 微调流程集成测试
│   # - 测试 M_current 完成后触发 M_next 微调
│   # - 测试用户确认流程
│
tests/fixtures/
├── sample-mspecs/             # 示例 MSpec
│   ├── mspec-v1.0.json        # 原始 MSpec
│   ├── mspec-v1.1.json        # 微调后 MSpec
│   ├── mspec-trigger-interface.json # 接口不兼容触发
│   ├── mspec-trigger-security.json  # 安全问题触发
│
├── sample-reviews/            # 示例 MSpec Reviews
│   ├── m1-review-complete.json
│   ├── m1-review-partial.json
│   ├── m1-review-failed.json
```

### MSpec Adjustment 与其他模块的文件关系

| 本模块文件 | 依赖模块 | 依赖文件 |
|-----------|---------|---------|
| `trigger-detector.ts` | `src/algorithms/gap-analysis/` | `types.ts` (Grade 映射) |
| `trigger-detector.ts` | `src/services/` | `grasp-service.ts` (grasp API) |
| `scope-adjuster.ts` | `src/types/` | `mspec.ts`, `tspec.ts` |
| `wbs-adjuster.ts` | `src/algorithms/sprint-selection/` | `types.ts` (AtomTask) |
| `report-generator.ts` | `src/utils/` | `logger.ts` |

### 安装后结构中 MSpec Adjustment 的运行时位置

MSpec Adjustment 在目标项目中的运行时数据存储在:

```
.omt/
├── hooks/
│   └── mspec-adjuster.js      # 编译后的微调脚本 (用于自动化)
│
├── config/
│   └── adjustment-rules.json  # 微调触发规则配置
│
├── tspecs/
│   └── tspec_<timestamp>/
│       └── mspecs/
│           ├── mspec_<timestamp>/
│           │   ├── mspec_v1.0.json   # 原始 MSpec
│           │   ├── mspec_v1.1.json   # 微调后 MSpec (如有)
│           │   └── adjustment-report.md # 微调报告
│           │
│           └── reviews/
│               └── m1-review.json    # M1 Review (微调输入)
```

### 文件命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 微调算法源码 | `*-adjuster.ts`, `*-detector.ts` | `scope-adjuster.ts`, `trigger-detector.ts` |
| 微调测试文件 | `mspec-*.test.ts` | `mspec-adjustment.test.ts` |
| MSpec fixtures | `mspec-v*.json` | `mspec-v1.0.json`, `mspec-v1.1.json` |
| 微调报告 | `adjustment-report.md` | `.omt/.../adjustment-report.md` |
| MSpec 版本 | `mspec_v{version}.json` | `mspec_v1.0.json`, `mspec_v1.1.json` |

### 开发结构与安装后结构的映射

| 开发时源码 | 安装后产物 | 构建命令 |
|-----------|-----------|---------|
| `src/algorithms/mspec-adjustment/*.ts` | `.omt/hooks/mspec-adjuster.js` | `pnpm build:adjuster` |
| `.claude/skills/mspec-adjustment/SKILL.md` | Skill 定义 (不复制) | Claude Code 直接读取 |
| `tests/fixtures/sample-mspecs/*.json` | MSpec 模板 | `omt init` 或 `omt sprint` |
| `src/types/mspec.ts` | 内嵌到 JS | `pnpm build:types` |

### 完整开发时目录结构概览

完整的 OMT 开发时 Repo 结构请参见 `02_sprint_selection_algorithm.md` 的 "开发时 Repo 文件结构" 章节，其中包含:
- `src/` 源代码目录完整结构
- `scripts/` CLI 与脚本目录完整结构
- `tests/` 测试目录完整结构
- `docs/` 文档目录完整结构
- `.claude/` Claude Code 配置完整结构
- 配置文件清单