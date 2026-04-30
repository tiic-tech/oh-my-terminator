# OMT自主创新设计蓝图 - Batch 2 Part B：核心机制设计

**设计日期**: 2026-04-30
**设计目标**: 详细设计OMT三大自主创新机制：Agent生命周期监控、Skill动态注入、Context动态组装

---

## Chapter 4: Agent生命周期监控系统

### 4.1 设计原理

#### 4.1.1 参考项目的局限

Agency-Orchestrator的Agent生命周期极其简单：

```
Agency Agent Lifecycle:
spawn → execute → destroy（执行结束即销毁，无中间监控）

问题：
1. 无状态追踪：Agent执行过程中无法知道当前状态
2. 无监控指标：执行时长、输出质量等无法量化
3. 无失败恢复：Agent失败后无法追踪失败原因
4. 无资源管理：大量Agent并发时无Pool管理
```

OpenSpec更没有Agent概念，只有隐含的Artifact协作。

#### 4.1.2 OMT的设计需求

OMT作为长周期持续性系统，需要完整的Agent生命周期管理：

| 需求维度 | OMT需求 | Agency现状 | 差距 |
|----------|---------|-----------|------|
| **状态追踪** | 实时追踪Agent执行状态 | 无状态概念 | 必须自主创新 |
| **监控指标** | 执行时长、输出质量、错误率 | 无监控指标 | 必须自主创新 |
| **失败恢复** | Agent失败可追踪、可恢复 | 无失败追踪 | 必须自主创新 |
| **资源管理** | Agent Pool管理、并发控制 | 无Pool管理 | 必须自主创新 |
| **审查闭环** | Agent输出需Review审查 | 无审查概念 | 必须自主创新 |

---

### 4.2 Agent状态机设计

#### 4.2.1 六状态模型

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Agent六状态生命周期                                         │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────┐
                    │    IDLE      │
                    │  (待分配)     │
                    └──────────────┘
                           │
                           │ Sprint Selection分配任务
                           │ assignTask(sprintTask)
                           ▼
                    ┌──────────────┐
                    │   ASSIGNED   │
                    │  (已分配)     │
                    └──────────────┘
                           │
                           │ TaskRunner启动执行
                           │ startExecution()
                           ▼
                    ┌──────────────┐
                    │  EXECUTING   │
                    │  (执行中)     │
                    └──────────────┘
                           │
                           │ 执行完成
                           │ completeExecution()
                           ▼
                    ┌──────────────┐
                    │  MONITORING  │
                    │  (待审查)     │
                    └──────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
            Review通过         Review失败
            approve()          reject()
                    │             │
                    ▼             ▼
              ┌──────────┐  ┌──────────┐
              │COMPLETED │  │  FAILED  │
              │ (已完成) │  │  (失败)  │
              └──────────┘  └──────────┘
                    │             │
                    │             │ 重试逻辑
                    │             │ retry()
                    │             │
                    │             └──→ 返回ASSIGNED状态
                    │
                    │ Agent资源释放
                    │ destroy()
                    ▼
              ┌──────────┐
              │DESTROYED │
              │ (已销毁) │
              └──────────┘
```

#### 4.2.2 状态转换规则

```typescript
interface AgentStateTransition {
  from: AgentState;
  to: AgentState;
  trigger: TransitionTrigger;
  guard?: TransitionGuard;  // 可选的前置条件
  action?: TransitionAction;  // 可选的伴随动作
}

type AgentState = 
  | 'IDLE'       // 待分配：Agent在Pool中等待
  | 'ASSIGNED'   // 已分配：任务已分配，准备执行
  | 'EXECUTING'  // 执行中：Agent正在执行任务
  | 'MONITORING' // 待审查：执行完成，等待Review
  | 'COMPLETED'  // 已完成：Review通过，准备销毁
  | 'FAILED'     // 失败：Review失败，触发重试
  | 'DESTROYED'; // 已销毁：资源已释放

// 状态转换定义
const STATE_TRANSITIONS: AgentStateTransition[] = [
  // IDLE → ASSIGNED
  {
    from: 'IDLE',
    to: 'ASSIGNED',
    trigger: 'assignTask',
    guard: (agent) => agent.capabilities.includes(task.requiredCapability),
    action: (agent) => agent.currentTask = task
  },
  
  // ASSIGNED → EXECUTING
  {
    from: 'ASSIGNED',
    to: 'EXECUTING',
    trigger: 'startExecution',
    action: (agent) => agent.startTime = Date.now()
  },
  
  // EXECUTING → MONITORING
  {
    from: 'EXECUTING',
    to: 'MONITORING',
    trigger: 'completeExecution',
    action: (agent) => agent.endTime = Date.now()
  },
  
  // MONITORING → COMPLETED (Review通过)
  {
    from: 'MONITORING',
    to: 'COMPLETED',
    trigger: 'approve',
    guard: (agent) => agent.reviewResult.score >= 0.8
  },
  
  // MONITORING → FAILED (Review失败)
  {
    from: 'MONITORING',
    to: 'FAILED',
    trigger: 'reject',
    guard: (agent) => agent.reviewResult.score < 0.8
  },
  
  // FAILED → ASSIGNED (重试)
  {
    from: 'FAILED',
    to: 'ASSIGNED',
    trigger: 'retry',
    guard: (agent) => agent.retryCount < agent.maxRetry,
    action: (agent) => agent.retryCount++
  },
  
  // COMPLETED → DESTROYED
  {
    from: 'COMPLETED',
    to: 'DESTROYED',
    trigger: 'destroy',
    action: (agent) => releaseAgentResources(agent)
  }
];
```

---

### 4.3 Agent Registry设计

#### 4.3.1 Registry核心接口

```typescript
interface AgentRegistry {
  // Agent定义存储
  definitions: Map<string, AgentDefinition>;
  
  // Agent实例Pool
  pool: Map<string, AgentInstance>;
  
  // 注册Agent定义
  register(def: AgentDefinition): void;
  
  // 生成Agent实例（从Pool获取或创建新实例）
  spawn(role: string, context: SpawnContext): AgentInstance;
  
  // 监控Agent状态
  monitor(instanceId: string): AgentStatus;
  
  // 销毁Agent实例
  destroy(instanceId: string): void;
  
  // 批量查询状态
  queryByState(state: AgentState): AgentInstance[];
  
  // 获取Pool统计
  getPoolStats(): PoolStatistics;
}

interface AgentDefinition {
  // 基本信息
  name: string;
  role: string;
  emoji: string;
  
  // 能力定义
  capabilities: string[];
  workflow: string;
  
  // 执行配置
  maxRetry: number;
  timeout: number;  // ms
  
  // Skill注入规则
  skillInjection: SkillInjectionRule[];
  
  // Prompt模板
  promptTemplate: string;
}

interface AgentInstance {
  // 实例标识
  instanceId: string;
  definitionId: string;
  
  // 当前状态
  state: AgentState;
  currentTask: SprintTask | null;
  
  // 执行追踪
  startTime: number | null;
  endTime: number | null;
  retryCount: number;
  
  // 输出结果
  output: AgentOutput | null;
  reviewResult: ReviewResult | null;
  
  // 监控指标
  metrics: AgentMetrics;
}

interface AgentMetrics {
  executionDuration: number;  // ms
  outputQuality: number;      // 0-1
  errorRate: number;          // 失败次数/总执行次数
  resourceUsage: ResourceUsage;
}
```

#### 4.3.2 Registry实现架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Agent Registry架构                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          AgentRegistry                                        │
│                                                                             │
│  ┌─────────────────────┐        ┌─────────────────────┐                    │
│  │   definitions       │        │        pool         │                    │
│  │   Map<role, Def>    │        │   Map<id, Instance> │                    │
│  └─────────────────────┘        └─────────────────────┘                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         Core Methods                                     ││
│  │                                                                         ││
│  │  register(def) ────→ 存储Agent定义                                       ││
│  │  spawn(role) ──────→ 从Pool获取IDLE实例 或 创建新实例                      ││
│  │  monitor(id) ──────→ 返回AgentStatus（状态+指标）                          ││
│  │  destroy(id) ──────→ 释放资源，移除Pool                                    ││
│  │  queryByState(state) → 查询指定状态的Agent列表                             ││
│  │  getPoolStats() ───→ 返回Pool统计（总数、各状态数量）                       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                     State Transition Engine                              ││
│  │                                                                         ││
│  │  transition(instance, trigger)                                          ││
│  │    ├── validateGuard() → 检查前置条件                                     ││
│  │    ├── executeAction() → 执行伴随动作                                     ││
│  │    └── updateState() → 更新Agent状态                                     ││
│  │    └── notifyObservers() → 通知状态变化                                   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘

                        │
                        │ 状态变化通知
                        ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                       State Observer System                                   │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │  PMB Updater    │  │  Brain Updater  │  │  Logger         │            │
│  │  (更新PMB)      │  │  (更新brain.json)│  │  (记录日志)     │            │
│  └─────────────────┘  └─────────────────┘  ┌─────────────────┐            │
│                                             │  Alert System   │            │
│                                             │  (失败告警)     │            │
│                                             └─────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.4 监控指标设计

#### 4.4.1 指标分类

```typescript
interface AgentMetrics {
  // 执行指标
  execution: ExecutionMetrics;
  
  // 质量指标
  quality: QualityMetrics;
  
  // 资源指标
  resource: ResourceMetrics;
  
  // 错误指标
  error: ErrorMetrics;
}

interface ExecutionMetrics {
  // 单次执行
  startTime: number;
  endTime: number;
  duration: number;  // endTime - startTime
  
  // 历史统计
  totalExecutions: number;
  averageDuration: number;
  maxDuration: number;
  minDuration: number;
}

interface QualityMetrics {
  // Review评分
  reviewScore: number;  // 0-1
  reviewPassed: boolean;
  
  // 输出验证
  outputValid: boolean;
  schemaCompliant: boolean;
  
  // 历史统计
  averageScore: number;
  passRate: number;  // 通过次数/总执行次数
}

interface ResourceMetrics {
  // Token使用
  tokenUsage: number;
  contextSize: number;
  
  // 时间资源
  timeBudget: number;  // 预算时间
  timeUsed: number;    // 实际使用
  
  // 并发控制
  concurrentTasks: number;
  waitingTime: number;  // 在Pool中等待时间
}

interface ErrorMetrics {
  // 错误统计
  errorCount: number;
  errorRate: number;  // errorCount/totalExecutions
  lastError: ErrorDetail | null;
  
  // 重试统计
  retryCount: number;
  maxRetryHit: boolean;
}
```

#### 4.4.2 监控仪表盘

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Agent监控仪表盘（PMB + brain.json）                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  brain.json - Agent Pool状态                                                 │
│                                                                             │
│  {                                                                          │
│    "repo_health": {                                                         │
│      "status": "healthy"                                                    │
│    },                                                                       │
│    "agent_pool": {                                                          │
│      "total": 5,                                                            │
│      "by_state": {                                                          │
│        "IDLE": 2,                                                           │
│        "EXECUTING": 2,                                                      │
│        "MONITORING": 1                                                      │
│      },                                                                     │
│      "metrics_summary": {                                                   │
│        "avg_execution_time": "45s",                                         │
│        "avg_quality_score": 0.85,                                           │
│        "error_rate": 0.05                                                   │
│      }                                                                      │
│    }                                                                        │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  pmb.yaml - Agent执行历史                                                    │
│                                                                             │
│  - sprint_id: sprint_001                                                    │
│    agent_instances:                                                         │
│      - instance_id: agent_001                                               │
│        role: backend-developer                                              │
│        state: COMPLETED                                                     │
│        task_id: task_001                                                    │
│        execution_time: 42s                                                  │
│        review_score: 0.92                                                   │
│        output_path: artifacts/task_001/output.json                          │
│                                                                             │
│      - instance_id: agent_002                                               │
│        role: code-reviewer                                                  │
│        state: MONITORING                                                    │
│        task_id: review_001                                                  │
│        execution_time: 15s                                                  │
│        waiting_for: user_approval                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.5 失败恢复机制

#### 4.5.1 失败处理流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Agent失败恢复流程                                          │
└─────────────────────────────────────────────────────────────────────────────┘

Agent执行失败
    │
    ▼
状态转换: EXECUTING → FAILED
    │
    ▼
记录失败详情到PMB
    │
    ├─── error_type: TIMEOUT / REVIEW_FAILED / EXECUTION_ERROR
    ├─── error_message: 详细错误信息
    ├─── retry_count: 当前重试次数
    └─── recoverable: true/false
    │
    ▼
判断是否可恢复
    │
    ┌──────┴──────┐
    │             │
    recoverable=true   recoverable=false
    │             │
    ▼             ▼
重试逻辑           终止逻辑
    │             │
    ├─── retryCount++     ├─── 状态: FAILED_FINAL
    ├─── 状态: ASSIGNED   ├─── PMB记录终止原因
    ├─── 重新执行         ├─── 告警通知用户
    │                 ├─── Gap Analysis决策
    │             │
    │             └──→ NEW_MSPEC or FAILED
    │
    └──→ 继续执行循环
```

#### 4.5.2 重试策略

```typescript
interface RetryStrategy {
  maxRetry: number;           // 最大重试次数
  timeoutMultiplier: number;  // 每次重试超时时间倍数
  backoffStrategy: 'linear' | 'exponential';
}

const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
  maxRetry: 3,
  timeoutMultiplier: 1.5,  // 每次+50%
  backoffStrategy: 'exponential'
};

// 重试超时计算
function calculateRetryTimeout(
  baseTimeout: number,
  retryCount: number,
  strategy: RetryStrategy
): number {
  if (strategy.backoffStrategy === 'exponential') {
    return baseTimeout * Math.pow(strategy.timeoutMultiplier, retryCount);
  } else {
    return baseTimeout + (baseTimeout * strategy.timeoutMultiplier * retryCount);
  }
}

// Example:
// baseTimeout = 60s, retryCount = 2
// exponential: 60 * 1.5^2 = 135s
// linear: 60 + 60 * 1.5 * 2 = 240s
```

---

## Chapter 5: Skill动态注入系统

### 5.1 设计原理

#### 5.1.1 OpenSpec Skill的局限

OpenSpec的Skill是静态指令模板：

```
OpenSpec Skill特点：
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. 静态定义：Skill在openspec.yaml中静态定义                                 │
│  2. 固定触发：通过文件状态触发（if: "not_exists(file)")                       │
│  3. 无动态组装：每次执行相同指令                                              │
│  4. 无角色适配：所有Agent使用相同Skill                                       │
└─────────────────────────────────────────────────────────────────────────────┘

Example OpenSpec Skill:
skills:
  - name: write-spec
    if: "not_exists('specs/{{change_id}}/{{artifact}}.md')"
    then: "Create the {{artifact}} artifact..."

问题：
- 所有执行者收到相同指令，无角色适配
- 无法根据上下文动态调整指令
- 无法注入额外的执行策略
```

#### 5.1.2 OMT的设计需求

OMT需要根据Agent角色和上下文动态注入Skill：

| 需求维度 | OMT需求 | OpenSpec现状 | 差距 |
|----------|---------|-------------|------|
| **角色适配** | 不同角色注入不同Skill | 所有执行者相同指令 | 必须自主创新 |
| **上下文适配** | 根据任务类型注入不同Skill | 固定指令模板 | 必须自主创新 |
| **动态组装** | 实时组装Skill内容 | 预定义静态Skill | 必须自主创新 |
| **Skill库管理** | Skill Registry集中管理 | YAML列表定义 | 必须自主创新 |
| **Skill继承** | Skill可继承、组合 | 无继承机制 | 必须自主创新 |

---

### 5.2 Skill Registry设计

#### 5.2.1 Registry核心接口

```typescript
interface SkillRegistry {
  // Skill定义存储
  skills: Map<string, SkillDefinition>;
  
  // Skill分类
  categories: Map<string, SkillCategory>;
  
  // 注册Skill定义
  register(skill: SkillDefinition): void;
  
  // 获取Skill定义
  getSkill(name: string): SkillDefinition;
  
  // 动态注入Skill
  inject(role: string, context: SprintContext): SkillInjection;
  
  // Skill组合
  compose(skillNames: string[]): ComposedSkill;
  
  // Skill继承
  extend(baseSkill: string, extensions: SkillExtension): SkillDefinition;
}

interface SkillDefinition {
  // 基本信息
  name: string;
  category: string;  // workflow / testing / review / domain
  description: string;
  
  // 适用角色
  applicableRoles: string[];  // ['backend-developer', 'frontend-developer']
  
  // 适用任务类型
  applicableTaskTypes: string[];  // ['implementation', 'test', 'review']
  
  // Skill内容模板
  contentTemplate: string;
  
  // 变量定义
  variables: SkillVariable[];
  
  // 继承关系
  extends?: string;  // 基Skill名称
  overrides?: SkillOverride[];
}

interface SkillVariable {
  name: string;
  source: 'context' | 'brain' | 'pmb' | 'task';
  path: string;  // 取值路径
  required: boolean;
  defaultValue?: string;
}

interface SkillInjection {
  // 注入内容
  injectedContent: string;
  
  // 使用的Skill列表
  usedSkills: string[];
  
  // 变量绑定
  variableBindings: Map<string, string>;
  
  // 注入位置
  injectionPoint: 'instruction' | 'rules' | 'template';
}
```

#### 5.2.2 Skill分类架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Skill分类架构                                              │
└─────────────────────────────────────────────────────────────────────────────┘

Skill Registry
│
├── Workflow Skills（工作流类）
│   ├── tdd-workflow（TDD工作流）
│   │   applicableRoles: [backend-developer, frontend-developer]
│   │   content: "1. Write test first\n2. Implement\n3. Refactor"
│   │
│   ├── code-review-workflow（代码审查工作流）
│   │   applicableRoles: [code-reviewer]
│   │   content: "Review checklist..."
│   │
│   └── deployment-workflow（部署工作流）
│       applicableRoles: [devops-agent]
│
├── Testing Skills（测试类）
│   ├── unit-test-skill（单元测试）
│   │   applicableTaskTypes: [test-task]
│   │
│   ├── integration-test-skill（集成测试）
│   └── e2e-test-skill（端到端测试）
│
├── Domain Skills（领域类）
│   ├── api-design-skill（API设计）
│   │   applicableRoles: [api-designer]
│   │
│   ├── database-skill（数据库）
│   ├── security-skill（安全）
│
├── Review Skills（审查类）
│   ├── quality-review-skill
│   ├── security-review-skill
│   └── performance-review-skill
│
└── Context Skills（上下文类）
    ├── repo-state-skill（Repo状态）
    │   source: brain.json
    │
    ├── sprint-history-skill（Sprint历史）
    │   source: pmb.yaml
    │
    └── dependency-skill（依赖关系）
        source: SprintContext.dependencies
```

---

### 5.3 动态注入机制

#### 5.3.1 注入流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Skill动态注入流程                                          │
└─────────────────────────────────────────────────────────────────────────────┘

Sprint Selection完成
    │
    │ assigneeRole = "backend-developer"
    │ taskId = "task_001"
    │ taskType = "implementation"
    │
    ▼
loadAgent(assigneeRole)
    │
    │ 获取AgentDefinition
    │ ├─── capabilities: [typescript, api, database]
    │ ├─── workflow: tdd-workflow
    │ ├─── skillInjection: [{skill: "tdd-workflow", point: "instruction"}]
    │
    ▼
SkillRegistry.inject(assigneeRole, context)
    │
    │ 步骤1: 筛选适用Skill
    │ ├─── applicableRoles.includes("backend-developer") → tdd-workflow
    │ ├─── applicableTaskTypes.includes("implementation") → api-design-skill
    │ ├─── Agent.workflow === skill.name → 精确匹配
    │
    │ 步骤2: 加载Skill定义
    │ ├─── getSkill("tdd-workflow") → SkillDefinition
    │ ├─── getSkill("api-design-skill") → SkillDefinition
    │
    │ 步骤3: 解析变量
    │ ├─── {{mspec_design}} → context.mspecDesign
    │ ├─── {{repo_state}} → brain.json摘要
    │ ├─── {{sprint_history}} → pmb.yaml摘要
    │
    │ 步骤4: 组装注入内容
    │ ├─── 组合Skill内容
    │ ├─── 填充变量值
    │ ├─── 确定注入位置
    │
    ▼
返回SkillInjection
    │
    │ {
    │   injectedContent: "## TDD Workflow\n1. Write test first...",
    │   usedSkills: ["tdd-workflow", "repo-state-skill"],
    │   injectionPoint: "instruction"
    │ }
    │
    ▼
注入到Agent Prompt
    │
    │ Prompt格式：
    │ <instruction>
    │   {{skill_injection.injectedContent}}
    │ </instruction>
    │
    ▼
Agent执行
```

#### 5.3.2 注入策略

```typescript
interface InjectionStrategy {
  // 角色匹配策略
  roleStrategy: 'exact' | 'inclusive' | 'capability';
  
  // 任务类型匹配策略
  taskStrategy: 'exact' | 'inclusive';
  
  // 上下文注入策略
  contextStrategy: 'required' | 'optional' | 'auto';
  
  // 组合策略
  compositionStrategy: 'merge' | 'priority' | 'sequence';
}

const DEFAULT_INJECTION_STRATEGY: InjectionStrategy = {
  roleStrategy: 'inclusive',  // 只要角色在applicableRoles中就注入
  taskStrategy: 'exact',      // 任务类型必须精确匹配
  contextStrategy: 'auto',    // 自动注入相关上下文Skill
  compositionStrategy: 'merge' // 合并多个Skill内容
};

// 注入决策逻辑
function selectSkillsForInjection(
  role: string,
  taskType: string,
  context: SprintContext,
  registry: SkillRegistry,
  strategy: InjectionStrategy
): SkillDefinition[] {
  const selectedSkills: SkillDefinition[] = [];
  
  // 1. 角色匹配
  for (const skill of registry.skills.values()) {
    const roleMatch = strategy.roleStrategy === 'exact'
      ? skill.applicableRoles.includes(role) && skill.applicableRoles.length === 1
      : skill.applicableRoles.includes(role);
    
    const taskMatch = strategy.taskStrategy === 'exact'
      ? skill.applicableTaskTypes.includes(taskType) && skill.applicableTaskTypes.length === 1
      : skill.applicableTaskTypes.includes(taskType);
    
    if (roleMatch && taskMatch) {
      selectedSkills.push(skill);
    }
  }
  
  // 2. 上下文自动注入
  if (strategy.contextStrategy === 'auto') {
    // 自动注入repo-state-skill
    const repoSkill = registry.getSkill('repo-state-skill');
    if (repoSkill) selectedSkills.push(repoSkill);
    
    // 自动注入dependency-skill（如果有依赖）
    if (context.dependencies.length > 0) {
      const depSkill = registry.getSkill('dependency-skill');
      if (depSkill) selectedSkills.push(depSkill);
    }
  }
  
  return selectedSkills;
}
```

---

### 5.4 Skill组装示例

#### 5.4.1 TDD Workflow Skill组装

```yaml
# skill: tdd-workflow.yaml
name: tdd-workflow
category: workflow
description: Test-driven development workflow for implementation tasks
applicableRoles:
  - backend-developer
  - frontend-developer
applicableTaskTypes:
  - implementation
contentTemplate: |
  ## TDD Workflow
  
  Follow this strict sequence:
  
  1. **Write Test First (RED)**
     - Create test file: `{{output_path}}/tests/{{test_name}}.test.ts`
     - Write failing test that describes expected behavior
     - Run test: verify it FAILS
  
  2. **Minimal Implementation (GREEN)**
     - Write minimal code to pass test
     - Focus on correctness, not optimization
     - Run test: verify it PASSES
  
  3. **Refactor (IMPROVE)**
     - Clean up code while keeping tests passing
     - Extract utilities, improve naming
     - Verify all tests still pass
  
  4. **Coverage Check**
     - Run coverage: must achieve 80%+
     - Add edge case tests if needed
  
  Variables:
    - name: output_path
      source: context
      path: SprintContext.outputPath
      required: true
    
    - name: test_name
      source: task
      path: SprintTask.testName
      required: false
      defaultValue: "{{task_id}}"
```

#### 5.4.2 Repo State Skill组装

```yaml
# skill: repo-state-skill.yaml
name: repo-state-skill
category: context
description: Current repository state context
applicableRoles: []  # 所有角色都适用
applicableTaskTypes: []  # 所有任务类型都适用
contentTemplate: |
  ## Repository State
  
  Current repo health: {{repo_status}}
  
  Agent Pool Status:
  - Total agents: {{pool_total}}
  - Active agents: {{pool_active}}
  - Average execution time: {{avg_execution_time}}
  
  Recent Sprint History:
  {{sprint_history_summary}}
  
  Variables:
    - name: repo_status
      source: brain
      path: brain.json.repo_health.status
      required: true
    
    - name: pool_total
      source: brain
      path: brain.json.agent_pool.total
      required: true
    
    - name: sprint_history_summary
      source: pmb
      path: pmb.yaml.last_3_sprints
      required: false
      defaultValue: "No recent sprints"
```

---

### 5.5 Skill继承与组合

#### 5.5.1 Skill继承机制

```typescript
interface SkillExtension {
  // 扩展的内容
  additionalContent: string;
  
  // 覆盖的变量
  variableOverrides: Map<string, SkillVariable>;
  
  // 扩展的适用范围
  additionalRoles?: string[];
  additionalTaskTypes?: string[];
}

// Skill继承示例
const apiDesignSkill: SkillDefinition = {
  name: 'api-design-skill',
  category: 'domain',
  extends: 'tdd-workflow',  // 继承TDD Workflow
  overrides: [
    {
      type: 'content_append',
      content: `
## API Design Specifics

After TDD cycle, ensure:
- RESTful conventions
- Proper error responses
- Rate limiting
- Authentication flow`
    }
  ],
  applicableRoles: ['api-designer', 'backend-developer']
};
```

#### 5.5.2 Skill组合机制

```typescript
// Skill组合示例
function composeSkills(
  skills: SkillDefinition[],
  strategy: CompositionStrategy
): string {
  if (strategy === 'merge') {
    // 合并所有Skill内容
    return skills.map(s => s.contentTemplate).join('\n\n---\n\n');
  }
  
  if (strategy === 'priority') {
    // 按优先级排序后合并
    const sorted = skills.sort((a, b) => 
      getSkillPriority(b) - getSkillPriority(a)
    );
    return sorted.map(s => s.contentTemplate).join('\n\n');
  }
  
  if (strategy === 'sequence') {
    // 按执行顺序组合
    return skills.map(s => s.contentTemplate).join('\n\n## Next Step\n\n');
  }
}
```

---

## Chapter 6: Context动态组装系统

### 6.1 设计原理

#### 6.1.1 参考项目的局限

Agency-Orchestrator的Context传递极其简单：

```
Agency Context传递：
┌─────────────────────────────────────────────────────────────────────────────┐
│  inputs: Map<string, any>  →  YAML inputs变量                               │
│  outputs: Map<string, any> →  Step outputs变量                              │
│                                                                             │
│  Example:                                                                   │
│  inputs:                                                                    │
│    task_description: "Create API endpoint"                                  │
│  outputs:                                                                   │
│    step_1_result: "{{step_1.output}}"                                       │
└─────────────────────────────────────────────────────────────────────────────┘

问题：
1. 无设计上下文：无法传递MSpec Design等设计文档
2. 无历史上下文：无法传递前序Sprint历史
3. 无Repo状态：无法传递brain.json状态
4. 无依赖传递：前序任务输出需手动传递
5. 无模板渲染：简单的{{变量}}替换
```

#### 6.1.2 OMT的设计需求

OMT需要复杂的Context动态组装：

| 需求维度 | OMT需求 | Agency现状 | 差距 |
|----------|---------|-----------|------|
| **设计上下文** | MSpec Design作为核心上下文 | 无设计文档传递 | 必须自主创新 |
| **历史上下文** | PMB Sprint历史传递 | 无历史传递 | 必须自主创新 |
| **Repo状态** | brain.json状态传递 | 无Repo状态 | 必须自主创新 |
| **依赖传递** | 按DAG自动传递前序任务输出 | 手动传递 | 必须自主创新 |
| **模板渲染** | 多源模板渲染 | 简单变量替换 | 必须自主创新 |

---

### 6.2 SprintContext结构设计

#### 6.2.1 Context核心接口

```typescript
interface SprintContext {
  // === 基本信息层 ===
  
  // Sprint标识
  sprintId: string;
  sprintNumber: number;
  
  // 任务信息
  taskId: string;
  taskType: TaskType;  // implementation / test / review
  taskDescription: string;
  
  // 输出路径
  outputPath: string;
  outputFormat: OutputFormat;
  
  // === 设计上下文层 ===
  
  // MSpec设计文档（核心）
  mspecDesign: string;  // MSpec完整内容
  mspecDesignPath: string;  // 文件路径
  
  // TSpec原始需求
  tspecSummary: string;  // TSpec摘要
  
  // === 动态组装层 ===
  
  // 前序任务输出（按DAG依赖）
  dependencies: ArtifactDependency[];
  
  // Repo全局状态
  brainState: BrainJson;
  
  // Sprint历史
  pmbHistory: PMBEntry[];
  
  // === Agent信息层 ===
  
  // Agent角色
  assigneeRole: string;
  
  // Agent定义
  agentDefinition: AgentDefinition;
  
  // Skill注入结果
  skillInjection: SkillInjection;
  
  // === 执行配置层 ===
  
  // 执行限制
  timeout: number;
  maxRetry: number;
  
  // 验证规则
  validationRules: ValidationRule[];
}

interface ArtifactDependency {
  // 依赖Artifact信息
  artifactId: string;
  artifactType: string;
  artifactPath: string;
  
  // 依赖状态
  status: 'completed' | 'failed' | 'in_progress';
  
  // 依赖内容
  content: string;  // Artifact完整内容
  summary: string;  // Artifact摘要（用于Prompt）
  
  // 依赖关系
  dependencyType: 'input' | 'reference' | 'validation';
}

interface BrainJson {
  repo_health: RepoHealth;
  agent_pool: AgentPoolStatus;
  artifacts_status: ArtifactsStatus;
  last_updated: number;
}

interface PMBEntry {
  sprint_id: string;
  sprint_number: number;
  status: 'completed' | 'failed' | 'in_progress';
  
  // 任务执行历史
  tasks: TaskExecution[];
  
  // 验收决策
  gap_analysis?: GapAnalysisResult;
}
```

#### 6.2.2 Context层级架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SprintContext五层架构                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 1: 基本信息层（Base Info）                                              │
│                                                                             │
│  sprintId: "sprint_001"                                                     │
│  taskId: "task_001"                                                         │
│  taskType: "implementation"                                                 │
│  taskDescription: "Create API endpoint for user authentication"             │
│  outputPath: "artifacts/sprint_001/task_001/"                               │
│                                                                             │
│  用途：任务识别、输出定位                                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 2: 设计上下文层（Design Context）                                       │
│                                                                             │
│  mspecDesign: "## MSpec: Authentication Module..."                          │
│  mspecDesignPath: "artifacts/mspec_001/authentication.md"                   │
│  tspecSummary: "## TSpec: User Authentication..."                           │
│                                                                             │
│  用途：核心设计文档，Agent理解任务的设计背景                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 3: 动态组装层（Dynamic Assembly）                                       │
│                                                                             │
│  dependencies: [                                                            │
│    {artifactId: "mspec_001", content: "...", summary: "..."},               │
│    {artifactId: "task_000", content: "...", summary: "..."}                 │
│  ]                                                                          │
│                                                                             │
│  brainState: {repo_health: "healthy", agent_pool: {...}}                    │
│  pmbHistory: [{sprint_id: "sprint_000", status: "completed"}]               │
│                                                                             │
│  用途：动态获取前序输出、Repo状态、Sprint历史                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 4: Agent信息层（Agent Info）                                            │
│                                                                             │
│  assigneeRole: "backend-developer"                                          │
│  agentDefinition: {name: "Backend Developer", capabilities: [...]}          │
│  skillInjection: {injectedContent: "...", usedSkills: [...]}                │
│                                                                             │
│  用途：Agent角色适配、Skill动态注入                                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 5: 执行配置层（Execution Config）                                       │
│                                                                             │
│  timeout: 60000  // ms                                                      │
│  maxRetry: 3                                                                │
│  validationRules: [                                                         │
│    {type: "schema", schema: "output.schema.json"},                          │
│    {type: "test", coverageThreshold: 0.8}                                   │
│  ]                                                                          │
│                                                                             │
│  用途：执行限制、验证规则                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 6.3 Context组装流程

#### 6.3.1 组装Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Context组装Pipeline                                        │
└─────────────────────────────────────────────────────────────────────────────┘

Sprint Selection完成
    │
    │ 输入：sprintId, taskId, assigneeRole
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 1: 加载基本信息                                                         │
│                                                                             │
│  readSprintConfig(sprintId)                                                 │
│    ├─── sprint.yaml → sprintId, sprintNumber, taskList                      │
│    └─── task.yaml → taskId, taskType, description, outputPath               │
│                                                                             │
│  输出：BaseContext                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 2: 加载设计上下文                                                       │
│                                                                             │
│  readMSpecDesign(taskId.mspecId)                                            │
│    ├─── artifacts/mspec_001/authentication.md → mspecDesign                 │
│    └─── artifacts/tspec_001.md → tspecSummary                               │
│                                                                             │
│  输出：DesignContext                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 3: 动态组装依赖                                                         │
│                                                                             │
│  resolveDependencies(taskId)                                                │
│    ├─── WBS DAG → 前序任务列表                                               │
│    ├─── readArtifacts(predecessorTasks) → dependencies                      │
│    ├─── 每个依赖：content + summary                                          │
│                                                                             │
│  输出：Dependencies                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 4: 加载Repo状态                                                         │
│                                                                             │
│  readBrainJson()                                                            │
│    ├─── .omt/brain.json → repo_health, agent_pool                           │
│    ├─── 生成摘要：repo_status_summary                                        │
│                                                                             │
│  输出：BrainState                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 5: 加载Sprint历史                                                       │
│                                                                             │
│  readPMB()                                                                  │
│    ├─── .omt/pmb.yaml → last_3_sprints                                      │
│    ├─── 生成摘要：sprint_history_summary                                     │
│                                                                             │
│  输出：PMBHistory                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 6: Agent信息组装                                                        │
│                                                                             │
│  loadAgent(assigneeRole)                                                    │
│    ├─── .omt/agents/backend-developer.md → agentDefinition                  │
│    ├─── SkillRegistry.inject(role, context) → skillInjection                │
│                                                                             │
│  输出：AgentInfo + SkillInjection                                            │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 7: 组装完整Context                                                      │
│                                                                             │
│  assembleContext(                                                           │
│    BaseContext,                                                              │
│    DesignContext,                                                            │
│    Dependencies,                                                             │
│    BrainState,                                                               │
│    PMBHistory,                                                               │
│    AgentInfo,                                                                │
│    SkillInjection                                                            │
│  )                                                                          │
│                                                                             │
│  输出：SprintContext（完整）                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
Agent执行
```

#### 6.3.2 依赖解析机制

```typescript
// DAG依赖解析
function resolveDependencies(
  taskId: string,
  wbs: WBSGraph
): ArtifactDependency[] {
  const dependencies: ArtifactDependency[] = [];
  
  // 1. 从WBS DAG获取前序任务
  const predecessors = wbs.getPredecessors(taskId);
  
  // 2. 加载每个前序任务的输出
  for (const predId of predecessors) {
    const artifact = readArtifact(predId);
    
    dependencies.push({
      artifactId: predId,
      artifactType: artifact.type,
      artifactPath: artifact.path,
      status: artifact.status,
      content: artifact.content,
      summary: generateSummary(artifact.content),
      dependencyType: determineDependencyType(taskId, predId)
    });
  }
  
  return dependencies;
}

// 依赖类型判断
function determineDependencyType(
  taskId: string,
  predecessorId: string
): 'input' | 'reference' | 'validation' {
  const task = getTask(taskId);
  const predTask = getTask(predecessorId);
  
  // 如果任务输出是输入依赖
  if (task.inputs.includes(predTask.output)) {
    return 'input';
  }
  
  // 如果任务需要参考前序任务
  if (task.references.includes(predTask.output)) {
    return 'reference';
  }
  
  // 如果任务需要验证前序任务
  if (taskType === 'review' && predTask.taskType === 'implementation') {
    return 'validation';
  }
  
  return 'reference';  // 默认
}
```

---

### 6.4 模板渲染机制

#### 6.4.1 模板变量定义

```typescript
interface TemplateVariable {
  // 变量名称
  name: string;
  
  // 变量来源
  source: VariableSource;
  
  // 取值路径
  path: string;
  
  // 渲染选项
  options?: RenderOptions;
}

type VariableSource = 
  | 'context'      // SprintContext字段
  | 'brain'        // brain.json字段
  | 'pmb'          // pmb.yaml字段
  | 'dependencies' // dependencies数组
  | 'task'         // SprintTask字段
  | 'agent'        // AgentDefinition字段
  | 'skill'        // SkillInjection字段
  | 'artifact';    // Artifact文件内容

interface RenderOptions {
  // 格式化选项
  format?: 'full' | 'summary' | 'path' | 'json';
  
  // 截断选项
  maxLength?: number;
  
  // 过滤选项
  filter?: string;
}
```

#### 6.4.2 模板渲染引擎

```typescript
class ContextTemplateEngine {
  // 渲染模板
  render(template: string, context: SprintContext): string {
    // 1. 解析模板中的变量占位符
    const placeholders = this.parsePlaceholders(template);
    
    // 2. 为每个占位符取值
    const bindings = new Map<string, string>();
    
    for (const placeholder of placeholders) {
      const value = this.resolveVariable(placeholder, context);
      bindings.set(placeholder.name, value);
    }
    
    // 3. 替换占位符
    let result = template;
    for (const [name, value] of bindings) {
      result = result.replace(`{{${name}}}`, value);
    }
    
    return result;
  }
  
  // 解析变量占位符
  parsePlaceholders(template: string): TemplateVariable[] {
    const regex = /\{\{(\w+)\}\}/g;
    const placeholders: TemplateVariable[] = [];
    
    let match;
    while ((match = regex.exec(template)) !== null) {
      placeholders.push({
        name: match[1],
        source: this.inferSource(match[1]),
        path: this.inferPath(match[1])
      });
    }
    
    return placeholders;
  }
  
  // 取值
  resolveVariable(variable: TemplateVariable, context: SprintContext): string {
    switch (variable.source) {
      case 'context':
        return this.getContextValue(variable.path, context);
      case 'brain':
        return this.getBrainValue(variable.path, context.brainState);
      case 'pmb':
        return this.getPMBValue(variable.path, context.pmbHistory);
      case 'dependencies':
        return this.getDependenciesValue(variable.path, context.dependencies);
      case 'skill':
        return context.skillInjection.injectedContent;
      default:
        return '';
    }
  }
}
```

#### 6.4.3 完整Prompt渲染示例

```markdown
# 渲染前模板（Agent Prompt Template）

<task>
  {{task_description}}
</task>

<project_context>
  <!-- Background information. Do NOT include in output. -->
  
  ## MSpec Design
  {{mspec_design}}
  
  ## Repository State
  {{repo_state}}
  
  ## Sprint History
  {{sprint_history}}
</project_context>

<dependencies>
  {{#each dependencies}}
  <dependency id="{{artifactId}}" type="{{dependencyType}}">
    <summary>{{summary}}</summary>
    <path>{{artifactPath}}</path>
  </dependency>
  {{/each}}
</dependencies>

<rules>
  - Follow {{agent_workflow}} workflow
  - Output to: {{output_path}}
  - Timeout: {{timeout}}ms
</rules>

<instruction>
  {{skill_injection}}
</instruction>

<output>
  Write to: {{output_path}}/output.json
  Format: {{output_format}}
</output>

---

# 渲染后结果

<task>
  Create API endpoint for user authentication with JWT tokens
</task>

<project_context>
  <!-- Background information. Do NOT include in output. -->
  
  ## MSpec Design
  ## MSpec: Authentication Module
  
  ### API Endpoints
  - POST /auth/login - User login
  - POST /auth/register - User registration
  - POST /auth/refresh - Token refresh
  
  ### Technical Requirements
  - JWT token with 1h expiry
  - Refresh token with 7d expiry
  - Rate limiting: 5 requests/min
  
  ## Repository State
  Repo Status: healthy
  Agent Pool: 3 active agents
  Last Sprint: completed in 45s
  
  ## Sprint History
  Last 3 sprints:
  - sprint_000: completed, 2 tasks
  - sprint_001: in_progress, 3 tasks
</project_context>

<dependencies>
  <dependency id="mspec_001" type="reference">
    <summary>Authentication module design spec</summary>
    <path>artifacts/mspec_001/authentication.md</path>
  </dependency>
  <dependency id="task_000" type="input">
    <summary>Database schema for users table</summary>
    <path>artifacts/sprint_000/task_000/output.json</path>
  </dependency>
</dependencies>

<rules>
  - Follow tdd-workflow workflow
  - Output to: artifacts/sprint_001/task_001/
  - Timeout: 60000ms
</rules>

<instruction>
  ## TDD Workflow
  
  Follow this strict sequence:
  
  1. **Write Test First (RED)**
     - Create test file: `artifacts/sprint_001/task_001/tests/auth.test.ts`
     - Write failing test that describes expected behavior
     - Run test: verify it FAILS
  
  2. **Minimal Implementation (GREEN)**
     - Write minimal code to pass test
     - Focus on correctness, not optimization
     - Run test: verify it PASSES
  
  3. **Refactor (IMPROVE)**
     - Clean up code while keeping tests passing
     - Extract utilities, improve naming
     - Verify all tests still pass
  
  4. **Coverage Check**
     - Run coverage: must achieve 80%+
     - Add edge case tests if needed
</instruction>

<output>
  Write to: artifacts/sprint_001/task_001/output.json
  Format: json
</output>
```

---

## 附录：自主创新项索引

| 创新编号 | 创新内容 | 本章覆盖 |
|----------|---------|---------|
| **I3** | Agent生命周期监控 | Chapter 4 |
| **I4** | Skill动态注入系统 | Chapter 5 |
| **I5** | Context动态组装 | Chapter 6 |

---

**设计完成日期**: 2026-04-30
**下一步**: Batch 3 Part A - 执行引擎设计（DAG Executor + TaskRunner）