# OMT自主创新设计蓝图 - Batch 2 Part C

**撰写日期**: 2026-04-30
**内容范围**: 章节7-9（四层Artifacts对齐、自动WBS分解、Sprint循环机制）
**总行数**: 约450行

---

## Chapter 7: 四层Artifacts一致性对齐

### 7.1 设计原理

#### 7.1.1 OpenSpec单层Artifact依赖模型

OpenSpec采用单层Artifact依赖模型，所有Artifact之间通过静态依赖图关联：

```
OpenSpec Artifact Dependency:
  brainstorm ──▶ pitch ──▶ tspec ──▶ implementation ──▶ review

特点：
- 单向线性依赖链
- 无层级验证机制
- Artifact完成即结束
- 无跨层级一致性要求
```

#### 7.1.2 OMT四层Artifacts必要性

OMT作为长周期持续性系统，需要四层artifacts结构以支持：

1. **纵向一致性验证**: 确保上层规格正确分解到下层任务
2. **横向依赖追踪**: AtomTask之间的依赖关系需追溯到MSpec设计
3. **验收回溯能力**: Sprint验收失败时可追溯到MSpec调整
4. **Sprint循环稳定性**: 每次新Sprint需验证与MSpec对齐

```
OMT vs OpenSpec 对比：

OpenSpec:       [Artifact A] ──▶ [Artifact B] ──▶ 完成
OMT:            [Layer 1] ──▶ [Layer 2] ──▶ [Layer 3] ──▶ [Layer 4]
                          │           │           │           │
                          └───────────┴───────────┴───────────┘
                                     一致性对齐验证链
```

---

### 7.2 四层Artifacts结构定义

#### 7.2.1 Layer 1: TSpec (技术规格)

```yaml
TSpec:
  id: string                      # 唯一标识
  name: string                    # 项目名称

  inputs:
    brainstorm: BrainstormOutput  # brainstorm阶段输出
    pitch: PitchOutput            # pitch阶段输出

  outputs:
    proposal: string              # 提案文档路径
    design: string                # 设计文档路径
    milestones: [MilestoneSpec]   # Milestone规格列表

  techConstraints:
    stack: [string]               # 技术栈约束
    architecture: string          # 架构模式约束
    codingStandards: string       # 编码规范引用

  state: DRAFT | APPROVED | ARCHIVED
```

#### 7.2.2 Layer 2: MSpec (里程碑规格)

```yaml
MSpec:
  id: string                      # 唯一标识
  tspecId: string                 # 父级TSpec ID
  milestoneIndex: number          # Milestone序号

  inputs:
    tspec: TSpec                  # TSpec引用
    wbsAlgorithm: WBSAlgorithm    # WBS分解算法配置

  outputs:
    proposal: string              # Milestone提案路径
    design: string                # Milestone设计路径
    wbs: WBS                      # WBS分解结果

  wbs:
    atomTasks: [AtomTaskSpec]     # AtomTask规格列表
    dependencies: DependencyGraph # 依赖关系图

  reviews: [ReviewRecord]         # 审查记录列表
  state: PENDING | IN_PROGRESS | COMPLETED | FAILED
```

#### 7.2.3 Layer 3: Sprint (执行批次)

```yaml
Sprint:
  id: string                      # Sprint唯一标识
  mspecId: string                 # 父级MSpec ID
  sprintIndex: number             # Sprint序号

  inputs:
    mspec: MSpec                  # MSpec引用
    pmb: PMB                      # 前序Sprint历史
    selectionAlgorithm: SelectionConfig

  outputs:
    sprint.yaml: string           # Sprint配置文件路径

  selectedTasks: [string]         # 选中的AtomTask ID列表
  parallelism: number             # 并行度目标
  estimatedDuration: number       # 估算时长（小时）

  execution:
    dag: ExecutionDAG             # 执行DAG
    taskRunner: TaskRunnerConfig  # TaskRunner配置

  state: SELECTED | EXECUTING | REVIEWING | GAP_ANALYSIS
```

#### 7.2.4 Layer 4: AtomTask (原子任务)

```yaml
AtomTask:
  id: string                      # 唯一标识
  sprintId: string                # 父级Sprint ID
  mspecTaskId: string             # MSpec WBS中对应的任务ID

  inputs:
    sprint: Sprint                # Sprint引用
    dependencies: [string]        # 依赖AtomTask ID列表

  outputs:
    implementation: string        # 实现输出路径
    tests: string                 # 测试输出路径
    review: string                # 审查输出路径

  assigneeRole: string            # 执行Agent角色
  complexity: number              # 复杂度评分(1-10)
  estimatedHours: number          # 估算工时

  state: PENDING | READY | EXECUTING | BLOCKED | COMPLETED | FAILED
```

---

### 7.3 一致性对齐机制

#### 7.3.1 TSpec→MSpec 对齐验证

```
Alignment Check: TSpec → MSpec

验证项：
┌─────────────────────────────────────────────────────────────────┐
│ 1. Milestone数量验证                                            │
│    - MSpec数量 == TSpec.milestones.length                       │
│    - 每个MSpec.milestoneIndex对应TSpec中的Milestone序号          │
│                                                                 │
│ 2. 技术约束一致性                                                │
│    - MSpec设计遵循TSpec.techConstraints.stack                   │
│    - MSpec设计遵循TSpec.techConstraints.architecture            │
│    - MSpec设计引用TSpec.techConstraints.codingStandards         │
│                                                                 │
│ 3. 输入输出对齐                                                  │
│    - 每个MSpec.tspecId正确引用TSpec.id                          │
│    - MSpec.wbs覆盖对应Milestone的所有功能点                      │
└─────────────────────────────────────────────────────────────────┘

失败处理：
- Milestone数量不匹配 → ERROR: MSpec生成失败，重新解析TSpec
- 技术约束违反 → WARNING: MSpec设计需调整，触发技术评审
- 输入输出不对齐 → ERROR: MSpec需重新生成
```

#### 7.3.2 MSpec→Sprint 对齐验证

```
Alignment Check: MSpec → Sprint

验证项：
┌─────────────────────────────────────────────────────────────────┐
│ 1. WBS任务数量验证                                              │
│    - Sprint.selectedTasks ⊆ MSpec.wbs.atomTasks                 │
│    - Sprint.selectedTasks数量 <= Sprint并行度限制               │
│                                                                 │
│ 2. 依赖关系一致性                                                │
│    - Sprint.execution.dag与MSpec.wbs.dependencies一致           │
│    - Sprint内AtomTask的blockedBy关系正确                        │
│                                                                 │
│ 3. Sprint Selection算法合规                                     │
│    - Sprint遵循SelectionAlgorithm配置                           │
│    - 并行度目标符合MSpec约束                                     │
│    - 复杂度分布符合Sprint容量限制                                │
└─────────────────────────────────────────────────────────────────┘

失败处理：
- 任务不在WBS中 → ERROR: Sprint Selection失败，任务ID无效
- 依赖关系错误 → ERROR: DAG构建失败，需修复blockedBy
- 并行度超限 → WARNING: 调整Sprint任务数量或增加并行度
```

#### 7.3.3 Sprint→AtomTask 对齐验证

```
Alignment Check: Sprint → AtomTask

验证项：
┌─────────────────────────────────────────────────────────────────┐
│ 1. DAG依赖验证                                                  │
│    - AtomTask.blockedBy ⊆ Sprint.selectedTasks                 │
│    - AtomTask.dependencies解析正确                              │
│    - 无循环依赖                                                  │
│                                                                 │
│ 2. assigneeRole匹配验证                                         │
│    - AtomTask.assigneeRole与MSpec设计一致                       │
│    - Agent Registry中存在对应角色定义                            │
│    - Agent capabilities覆盖任务需求                             │
│                                                                 │
│ 3. 任务状态一致性                                                │
│    - AtomTask.sprintId正确引用Sprint.id                         │
│    - AtomTask.mspecTaskId正确追溯MSpec                          │
│    - AtomTask.state与Sprint.state同步                           │
└─────────────────────────────────────────────────────────────────┘

失败处理：
- 依赖不在Sprint中 → ERROR: AtomTask被外部任务阻塞，需调整Sprint
- Agent不存在 → ERROR: Agent Registry缺失，需注册Agent
- 循环依赖 → ERROR: DAG无效，需修复blockedBy关系
```

---

### 7.4 对齐验证接口设计

```typescript
/**
 * 四层Artifacts一致性对齐验证器
 */
interface ArtifactAligner {
  /**
   * TSpec→MSpec一致性验证
   */
  validateTSpecToMSpec(
    tspec: TSpec,
    mspecs: MSpec[]
  ): AlignmentResult;

  /**
   * MSpec→Sprint一致性验证
   */
  validateMSpecToSprint(
    mspec: MSpec,
    sprint: Sprint
  ): AlignmentResult;

  /**
   * Sprint→AtomTasks一致性验证
   */
  validateSprintToAtomTasks(
    sprint: Sprint,
    tasks: AtomTask[]
  ): AlignmentResult;

  /**
   * 全链路一致性验证
   */
  validateFullChain(
    tspec: TSpec,
    mspecs: MSpec[],
    sprint: Sprint,
    tasks: AtomTask[]
  ): FullChainAlignmentResult;
}

/**
 * 对齐验证结果
 */
interface AlignmentResult {
  valid: boolean;
  errors: AlignmentError[];
  warnings: AlignmentWarning[];
  summary: string;
}

interface AlignmentError {
  code: string;              // 错误码，如 "E_MILESTONE_COUNT_MISMATCH"
  layer: string;             // 验证层级
  message: string;           // 错误描述
  details: Record<string, unknown>;
}

interface AlignmentWarning {
  code: string;
  layer: string;
  message: string;
  suggestion: string;        // 建议修复方案
}

/**
 * 全链路验证结果
 */
interface FullChainAlignmentResult {
  tspecToMspec: AlignmentResult;
  mspecToSprint: AlignmentResult;
  sprintToAtomTasks: AlignmentResult;
  overallValid: boolean;
  chainSummary: string;
}
```

---

### 7.5 ASCII四层架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OMT四层Artifacts架构                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 1: TSpec (技术规格)                                                    │
│ ┌───────────────┐  ┌───────────────┐  ┌───────────────────────────────┐      │
│ │   Proposal    │──▶│    Design     │──▶│       Milestones[]           │      │
│ │  (tspec/*.md) │  │  (tspec/*.md) │  │  (Milestone Definition)       │      │
│ └───────────────┘  └───────────────┘  └───────────────────────────────┘      │
│                                                                             │
│ 输入: brainstorm + pitch                                                    │
│ 状态: DRAFT → APPROVED → ARCHIVED                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ TSpec→MSpec Alignment
                              │ [Milestone数量验证]
                              │ [技术约束一致性]
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 2: MSpec (里程碑规格)                                                  │
│ ┌───────────────┐  ┌───────────────┐  ┌───────────────────────────────┐      │
│ │   Proposal    │──▶│    Design     │──▶│           WBS                │      │
│ │ (mspecs/*.md) │  │ (mspecs/*.md) │  │  atomTasks + dependencies     │      │
│ └───────────────┘  └───────────────┘  └───────────────────────────────┘      │
│                                                                             │
│ 输入: TSpec + WBS Algorithm                                                 │
│ 状态: PENDING → IN_PROGRESS → COMPLETED                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ MSpec→Sprint Alignment
                              │ [WBS任务数量验证]
                              │ [依赖关系一致性]
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 3: Sprint (执行批次)                                                   │
│ ┌───────────────────────────────────────────────────────────────────────┐  │
│ │                           sprint.yaml                                  │  │
│ │  selectedTasks: [task_001, task_002, ...]                              │  │
│ │  parallelism: 3                                                        │  │
│ │  execution.dag: {task_001: [], task_002: [task_001], ...}              │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ 输入: MSpec + PMB + Sprint Selection Algorithm                             │
│ 状态: SELECTED → EXECUTING → REVIEWING → GAP_ANALYSIS                       │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Sprint→AtomTask Alignment
                              │ [DAG依赖验证]
                              │ [assigneeRole匹配验证]
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 4: AtomTask (原子任务)                                                 │
│ ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐            │
│ │ atom_task_001.json│  │ atom_task_002.json│  │ atom_task_003.json│            │
│ │                  │  │                  │  │                  │            │
│ │ assigneeRole:    │  │ assigneeRole:    │  │ assigneeRole:    │            │
│ │ "backend-dev"    │  │ "backend-dev"    │  │ "qa-agent"       │            │
│ │ blockedBy: []    │  │ blockedBy:       │  │ blockedBy:       │            │
│ │                  │  │ [task_001]       │  │ [task_001,002]   │            │
│ └──────────────────┘  └──────────────────┘  └──────────────────┘            │
│                                                                             │
│ 输入: Sprint + DAG Executor                                                 │
│ 状态: PENDING → READY → EXECUTING → COMPLETED → FAILED                      │
└─────────────────────────────────────────────────────────────────────────────┘

                              ▲
                              │
                              │ 执行结果反馈
                              │ PMB更新
                              │
┌─────────────────────────────────────────────────────────────────────────────┐
│                         对齐验证反馈回路                                      │
│                                                                             │
│   AtomTask执行结果 ──▶ Sprint状态更新 ──▶ PMB记录                            │
│                                    │                                        │
│                                    ▼                                        │
│                           Gap Analysis决策                                  │
│                                    │                                        │
│                    ┌───────────────┼───────────────┐                       │
│                    ▼               ▼               ▼                       │
│              [ACCEPTED]      [NEW_MSPEC]      [FAILED]                     │
│                    │               │               │                       │
│                    ▼               ▼               ▼                       │
│              归档(结束)     MSpec调整→新Sprint   失败恢复→重试               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Chapter 8: 自动WBS分解算法

### 8.1 设计原理

#### 8.1.1 Agency Workflow人工定义模式

Agency-Orchestrator采用人工定义Workflow步骤的模式：

```yaml
# Agency Workflow定义（人工）
workflow:
  steps:
    - id: step_1
      role: "developer"
      task: "Create authentication module"
    - id: step_2
      role: "developer"
      task: "Create database schema"
      depends_on: [step_1]
    - id: step_3
      role: "qa"
      task: "Test authentication flow"
      depends_on: [step_1, step_2]

特点：
- 步骤需人工逐条定义
- 依赖关系需人工指定
- assigneeRole需人工分配
- 无法动态调整
```

#### 8.1.2 OMT自动WBS分解必要性

OMT作为长周期持续性系统，需要自动WBS分解以支持：

1. **大规模任务生成**: 单个Milestone可能包含30-50个AtomTask
2. **依赖自动推断**: 根据任务描述自动识别依赖关系
3. **复杂度自动估算**: 根据任务特征估算复杂度
4. **角色自动分配**: 根据任务类型自动匹配assigneeRole
5. **动态调整支持**: Gap Analysis触发MSpec调整后需重新分解

```
OMT vs Agency 对比：

Agency:         人工定义 ──▶ 静态Workflow ──▶ 一次性执行
OMT:            MSpec ──▶ WBS Decomposer ──▶ AtomTask DAG
                          │
                          ▼
                  自动：任务生成、依赖推断、复杂度估算、角色分配
```

---

### 8.2 WBS分解流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WBS分解流程                                                │
└─────────────────────────────────────────────────────────────────────────────┘

MSpec Design (输入)
    │
    │  MSpec.design 内容解析
    │  MSpec.proposal 功能点提取
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 1: 任务描述解析                                                         │
│                                                                             │
│  parseTasks(mspec) → TaskDescription[]                                      │
│                                                                             │
│  输入: MSpec.design (设计文档)                                               │
│  输出: TaskDescription[]                                                     │
│       - id: 任务标识                                                         │
│       - description: 任务描述                                                │
│       - type: IMPLEMENTATION | TEST | REVIEW | CONFIG                      │
│       - keywords: 关键词列表（用于依赖推断）                                  │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 2: 依赖关系识别                                                         │
│                                                                             │
│  identifyDependencies(tasks) → DependencyGraph                              │
│                                                                             │
│  算法:                                                                       │
│  1. 关键词匹配: 若任务A的输出关键词在任务B的输入关键词中 → A→B依赖            │
│  2. 类型规则: TEST类型任务依赖对应的IMPLEMENTATION任务                        │
│  3. REVIEW类型任务依赖所有实现任务                                            │
│  4. 防循环: 检测并消除循环依赖                                                │
│                                                                             │
│  输出: DependencyGraph                                                       │
│       - edges: [{from: taskId, to: taskId}]                                 │
│       - blockedBy: {taskId: [depTaskIds]}                                   │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 3: 复杂度估算                                                          │
│                                                                             │
│  estimateComplexity(tasks) → ComplexityScore[]                              │
│                                                                             │
│  估算因子:                                                                   │
│  1. 描述长度: 任务描述越长，复杂度越高                                        │
│  2. 关键词数量: 涉及技术关键词越多，复杂度越高                                │
│  3. 依赖数量: 被依赖越多（扇出），复杂度越高                                  │
│  4. 类型权重: IMPLEMENTATION(高) > TEST(中) > REVIEW(低)                    │
│                                                                             │
│  输出: ComplexityScore[]                                                     │
│       - taskId: 任务标识                                                     │
│       - score: 1-10                                                         │
│       - estimatedHours: 估算工时                                             │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 4: Agent角色分配                                                        │
│                                                                             │
│  assignRoles(tasks, complexity) → RoleAssignment[]                          │
│                                                                             │
│  分配规则:                                                                   │
│  1. 类型→角色映射:                                                           │
│     - IMPLEMENTATION + backend关键词 → backend-developer                    │
│     - IMPLEMENTATION + frontend关键词 → frontend-developer                  │
│     - TEST → qa-agent                                                       │
│     - REVIEW → code-reviewer                                                │
│     - CONFIG → config-manager                                               │
│                                                                             │
│  2. 复杂度调整:                                                               │
│     - 低复杂度(1-3): 单Agent任务                                             │
│     - 中复杂度(4-6): 可协作任务                                               │
│     - 高复杂度(7-10): 需拆分或资深Agent                                       │
│                                                                             │
│  输出: RoleAssignment[]                                                      │
│       - taskId: 任务标识                                                     │
│       - assigneeRole: 分配角色                                               │
│       - requiresCollaboration: 是否需要协作                                  │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 5: DAG构建                                                             │
│                                                                             │
│  buildDAG(tasks, dependencies) → AtomTask[]                                 │
│                                                                             │
│  DAG构建规则:                                                                │
│  1. 拓扑排序: 按依赖关系确定执行顺序                                          │
│  2. 入口节点: blockedBy=[] 的任务为入口                                      │
│  3. 并行度估算: 同一层级任务可并行                                            │
│  4. 状态初始化: 所有任务状态设为PENDING                                       │
│                                                                             │
│  输出: AtomTask[]                                                            │
│       - 完整的AtomTask对象数组                                               │
│       - 包含id, description, blockedBy, assigneeRole, complexity            │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
AtomTask DAG (输出)
```

---

### 8.3 分解算法接口设计

```typescript
/**
 * WBS自动分解器
 */
interface WBSDecomposer {
  /**
   * 执行完整WBS分解
   */
  decompose(mspec: MSpec): WBSDecompositionResult;

  /**
   * Step 1: 解析任务描述
   */
  parseTasks(mspec: MSpec): TaskDescription[];

  /**
   * Step 2: 识别依赖关系
   */
  identifyDependencies(tasks: TaskDescription[]): DependencyGraph;

  /**
   * Step 3: 估算任务复杂度
   */
  estimateComplexity(tasks: TaskDescription[]): ComplexityScore[];

  /**
   * Step 4: 分配Agent角色
   */
  assignRoles(
    tasks: TaskDescription[],
    complexity: ComplexityScore[]
  ): RoleAssignment[];

  /**
   * Step 5: 构建执行DAG
   */
  buildDAG(
    tasks: TaskDescription[],
    dependencies: DependencyGraph,
    roles: RoleAssignment[],
    complexity: ComplexityScore[]
  ): AtomTask[];

  /**
   * 检测并消除循环依赖
   */
  detectCycles(dependencies: DependencyGraph): CycleDetectionResult;

  /**
   * 估算Sprint容量
   */
  estimateSprintCapacity(atomTasks: AtomTask[]): SprintCapacityEstimate;
}

/**
 * 任务描述（解析中间产物）
 */
interface TaskDescription {
  id: string;
  description: string;
  type: 'IMPLEMENTATION' | 'TEST' | 'REVIEW' | 'CONFIG' | 'DOCUMENTATION';
  keywords: string[];
  inputKeywords: string[];      // 输入依赖关键词
  outputKeywords: string[];     // 输出产出关键词
  rawText: string;              // 原始设计文本
}

/**
 * 依赖关系图
 */
interface DependencyGraph {
  edges: DependencyEdge[];
  blockedBy: Record<string, string[]>;
  levels: Record<string, number>;   // DAG层级
}

interface DependencyEdge {
  from: string;
  to: string;
  reason: string;                  // 依赖原因
}

/**
 * 复杂度评分
 */
interface ComplexityScore {
  taskId: string;
  score: number;                   // 1-10
  estimatedHours: number;
  factors: ComplexityFactor[];
}

interface ComplexityFactor {
  name: string;
  weight: number;
  contribution: number;
}

/**
 * 角色分配
 */
interface RoleAssignment {
  taskId: string;
  assigneeRole: string;
  requiresCollaboration: boolean;
  collaborationRoles?: string[];   // 协作角色列表
}

/**
 * WBS分解结果
 */
interface WBSDecompositionResult {
  atomTasks: AtomTask[];
  dependencyGraph: DependencyGraph;
  sprintCapacityEstimate: SprintCapacityEstimate;
  decompositionMetrics: DecompositionMetrics;
  warnings: DecompositionWarning[];
}

interface DecompositionMetrics {
  totalTasks: number;
  averageComplexity: number;
  maxDependencyDepth: number;
  parallelismPotential: number;
  estimatedTotalHours: number;
}

interface SprintCapacityEstimate {
  recommendedTasksPerSprint: number;
  recommendedParallelism: number;
  estimatedSprintsCount: number;
}
```

---

### 8.4 复杂度估算策略

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    复杂度估算策略                                              │
└─────────────────────────────────────────────────────────────────────────────┘

复杂度评分范围: 1-10

复杂度因子权重表:
┌───────────────────┬────────────┬───────────────────────────────────────┐
│ 因子              │ 权重       │ 计算规则                              │
├───────────────────┼────────────┼───────────────────────────────────────┤
│ 描述长度          │ 0.15       │ len(description) / 100 * 10           │
│ 关键词数量        │ 0.20       │ count(keywords) * 1.5                 │
│ 扇出依赖数        │ 0.25       │ count(dependents) * 2                 │
│ 类型权重          │ 0.20       │ IMPLEMENTATION=7, TEST=4, REVIEW=2    │
│ 技术难度          │ 0.20       │ 根据关键词技术栈推断                   │
└───────────────────┴────────────┴───────────────────────────────────────┘

复杂度分级处理:
┌───────────────────┬────────────┬───────────────────────────────────────┐
│ 复杂度范围        │ 分级       │ 处理策略                              │
├───────────────────┼────────────┼───────────────────────────────────────┤
│ 1-3               │ 低         │ 单Agent任务，标准执行流程              │
│ 4-6               │ 中         │ 可协作任务，支持并行Agent              │
│ 7-10              │ 高         │ 需拆分为多个AtomTask                   │
└───────────────────┴────────────┴───────────────────────────────────────┘

高复杂度拆分规则:
当复杂度 >= 7 时:
1. 分析任务描述，识别可拆分的子任务
2. 每个子任务复杂度目标: 3-5
3. 原任务的blockedBy关系继承给第一个子任务
4. 子任务之间添加依赖关系链
5. 原任务的被依赖关系转移到最后一个子任务

示例:
原任务: "实现完整的用户认证系统" (复杂度=9)
拆分为:
  - task_auth_001: "设计认证架构" (复杂度=3)
  - task_auth_002: "实现JWT模块" (复杂度=4)
  - task_auth_003: "实现OAuth集成" (复杂度=4)
  - task_auth_004: "实现权限验证" (复杂度=4)
  - task_auth_005: "集成测试" (复杂度=3)

依赖关系:
  task_auth_001.blockedBy = []
  task_auth_002.blockedBy = [task_auth_001]
  task_auth_003.blockedBy = [task_auth_001]
  task_auth_004.blockedBy = [task_auth_002, task_auth_003]
  task_auth_005.blockedBy = [task_auth_002, task_auth_003, task_auth_004]
```

---

### 8.5 ASCII分解流程图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    自动WBS分解流程图                                          │
└─────────────────────────────────────────────────────────────────────────────┘

                        MSpec Design
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Step 1: parseTasks                                    │
│                                                                             │
│   MSpec.design ──▶ 文本解析 ──▶ TaskDescription[]                           │
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │ TaskDescription:                                                   │    │
│   │   id: "auth-001"                                                   │    │
│   │   description: "实现用户认证模块"                                   │    │
│   │   type: IMPLEMENTATION                                             │    │
│   │   keywords: ["auth", "jwt", "user"]                                │    │
│   │   inputKeywords: ["user-model"]                                    │    │
│   │   outputKeywords: ["auth-service"]                                 │    │
│   └───────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Step 2: identifyDependencies                              │
│                                                                             │
│   TaskDescription[] ──▶ 关键词匹配 ──▶ DependencyGraph                       │
│                                                                             │
│   关键词匹配规则:                                                            │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │ task_A.outputKeywords: ["auth-service"]                            │    │
│   │ task_B.inputKeywords: ["auth-service"]                             │    │
│   │ → 发现匹配 → 创建依赖: task_A → task_B                              │    │
│   └───────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│   类型规则:                                                                  │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │ TEST任务 → 依赖对应的IMPLEMENTATION任务                             │    │
│   │ REVIEW任务 → 依赖所有IMPLEMENTATION任务                             │    │
│   └───────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Step 3: estimateComplexity                                │
│                                                                             │
│   TaskDescription[] + DependencyGraph ──▶ ComplexityScore[]                 │
│                                                                             │
│   复杂度计算:                                                                │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │ score = 0.15 * (len/100*10)                                        │    │
│   │        + 0.20 * (keywords * 1.5)                                   │    │
│   │        + 0.25 * (dependents * 2)                                   │    │
│   │        + 0.20 * typeWeight                                         │    │
│   │        + 0.20 * techDifficulty                                     │    │
│   └───────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │ ComplexityScore:                                                   │    │
│   │   taskId: "auth-001"                                               │    │
│   │   score: 6                                                         │    │
│   │   estimatedHours: 4                                                │    │
│   └───────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Step 4: assignRoles                                   │
│                                                                             │
│   TaskDescription[] + ComplexityScore[] ──▶ RoleAssignment[]                │
│                                                                             │
│   类型→角色映射:                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │ IMPLEMENTATION + "api" → backend-developer                         │    │
│   │ IMPLEMENTATION + "ui" → frontend-developer                         │    │
│   │ TEST → qa-agent                                                    │    │
│   │ REVIEW → code-reviewer                                             │    │
│   └───────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│   复杂度调整:                                                                │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │ score 1-3 → 单Agent                                                │    │
│   │ score 4-6 → 可协作                                                 │    │
│   │ score 7-10 → 拆分任务                                              │    │
│   └───────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Step 5: buildDAG                                      │
│                                                                             │
│   All Components ──▶ DAG构建 ──▶ AtomTask[]                                  │
│                                                                             │
│   DAG构建:                                                                   │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │ 1. 拓扑排序确定层级                                                │    │
│   │ 2. 入口节点(blockedBy=[])标记为Level 0                             │    │
│   │ 3. 其他节点按依赖确定层级                                          │    │
│   │ 4. 同层级任务可并行执行                                            │    │
│   └───────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │ AtomTask:                                                          │    │
│   │   id: "auth-001"                                                   │    │
│   │   description: "实现用户认证模块"                                   │    │
│   │   blockedBy: []                                                    │    │
│   │   assigneeRole: "backend-developer"                                │    │
│   │   complexity: 6                                                    │    │
│   │   state: PENDING                                                   │    │
│   └───────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
                        AtomTask DAG
```

---

## Chapter 9: Sprint循环机制

### 9.1 设计原理

#### 9.1.1 OpenSpec/Agency一次性执行模式

OpenSpec和Agency-Orchestrator都采用一次性执行模式：

```
OpenSpec执行模式:
  Change定义 ──▶ Artifact生成 ──▶ Skill执行 ──▶ 完成

Agency执行模式:
  Workflow定义 ──▶ Step执行 ──▶ 结果输出 ──▶ 结束

共同特点:
- 执行结束即终止
- 无循环迭代机制
- 无验收决策闭环
- 失败需重新执行
```

#### 9.1.2 OMT Sprint循环必要性

OMT作为长周期持续性系统，需要Sprint循环以支持：

1. **任务持续执行**: WBS中剩余任务需通过新Sprint继续执行
2. **验收闭环**: Sprint结束后需Gap Analysis验收决策
3. **动态调整**: NEW_MSPEC决策触发MSpec调整后需新Sprint
4. **失败恢复**: 失败任务需在新Sprint中重新执行
5. **Terminator托管**: 全自动模式下需自动触发新Sprint

```
OMT vs OpenSpec/Agency 对比:

OpenSpec/Agency:    执行 ──▶ 结束
OMT:                Sprint ──▶ Review ──▶ Gap Analysis
                                │
                                ▼
                    [WBS剩余?] → 新Sprint → 循环
                    [ACCEPTED?] → 归档(结束)
                    [NEW_MSPEC?] → MSpec调整 → 新Sprint
                    [FAILED?] → 失败恢复 → 重试
```

---

### 9.2 Sprint循环状态机

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Sprint循环状态机                                           │
└─────────────────────────────────────────────────────────────────────────────┘

States:
┌─────────────────────────────────────────────────────────────────────────────┐
│ INIT              初始状态，等待Sprint触发                                    │
│ SPRINT_SELECTION  Sprint选择阶段，执行Selection Algorithm                    │
│ EXECUTION         Sprint执行阶段，TaskRunner运行AtomTask DAG                  │
│ REVIEW            Sprint审查阶段，ReviewerAgent执行审查                       │
│ GAP_ANALYSIS      Gap分析阶段，决策验收结果                                   │
│ PAUSED            暂停状态，等待恢复信号                                      │
│ ARCHIVED          归档状态，Sprint循环结束                                    │
└─────────────────────────────────────────────────────────────────────────────┘

State Transitions:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   INIT ──────────────▶ SPRINT_SELECTION                                     │
│     │                       │                                               │
│     │ trigger: omt:sprint   │                                               │
│     │                       ▼                                               │
│     │                  EXECUTION                                            │
│     │                       │                                               │
│     │                       ▼                                               │
│     │                  REVIEW                                               │
│     │                       │                                               │
│     │                       ▼                                               │
│     │                  GAP_ANALYSIS                                         │
│     │                       │                                               │
│     │                       │                                               │
│     │        ┌──────────────┼──────────────┐                               │
│     │        │              │              │                               │
│     │        ▼              ▼              ▼                               │
│     │   [ACCEPTED]     [NEW_MSPEC]     [FAILED]                            │
│     │        │              │              │                               │
│     │        ▼              ▼              ▼                               │
│     │   ARCHIVED      MSpec调整       失败恢复                              │
│     │   (结束)            │              │                               │
│     │                     │              │                               │
│     │                     ▼              ▼                               │
│     │               SPRINT_SELECTION   SPRINT_SELECTION                    │
│     │                     │              │                               │
│     │                     │              │                               │
│     └─────────────────────┴──────────────┴───────────────────────────────│
│                                                                             │
│   PAUSED (可选状态):                                                        │
│     - EXECUTION ──▶ PAUSED (暂停信号)                                       │
│     - PAUSED ──▶ EXECUTION (恢复信号)                                       │
│     - PAUSED ──▶ ARCHIVED (终止信号)                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Gap Analysis Decision Matrix:
┌─────────────────────────────────────────────────────────────────────────────┐
│ 决策          │ 条件                          │ 后续动作                    │
├───────────────┼────────────────────────────────┼────────────────────────────┤
│ ACCEPTED      │ WBS.completed == WBS.total     │ 归档，Sprint循环结束        │
│               │ Review.passed == true          │                            │
│               │ Gap.description == "完美契合"   │                            │
├───────────────┼────────────────────────────────┼────────────────────────────┤
│ NEW_MSPEC     │ Gap.description == "功能缺口"  │ MSpec调整                   │
│               │ 或 MSpec.design需更新          │ → WBS重新分解               │
│               │                                │ → 新Sprint                  │
├───────────────┼────────────────────────────────┼────────────────────────────┤
│ FAILED        │ Sprint.failedTasks > 0         │ 失败恢复                    │
│               │ 且无法自动重试                 │ → 分析失败原因               │
│               │                                │ → PMB记录                   │
│               │                                │ → 新Sprint重试               │
└───────────────────┴────────────────────────────────┴────────────────────────┘
```

---

### 9.3 循环控制逻辑

```typescript
/**
 * Sprint循环控制器
 */
interface SprintLoopController {
  /**
   * 当前状态
   */
  state: SprintLoopState;

  /**
   * PMB引用（Sprint历史记录）
   */
  pmb: PMB;

  /**
   * 当前Sprint引用
   */
  currentSprint: Sprint | null;

  /**
   * 循环条件判断
   */
  while(predicate: () => boolean): void;

  /**
   * 暂停循环
   */
  pause(reason: PauseReason): void;

  /**
   * 恢复循环
   */
  resume(): void;

  /**
   * 终止循环
   */
  terminate(reason: TerminateReason): void;

  /**
   * 状态转换方法
   */
  toSprintSelection(): void;
  toExecution(): void;
  toReview(): void;
  toGapAnalysis(): void;
  toArchived(): void;
  toPaused(): void;

  /**
   * Gap Analysis决策处理
   */
  handleGapAnalysisResult(result: GapAnalysisResult): void;

  /**
   * 获取循环统计
   */
  getLoopMetrics(): SprintLoopMetrics;
}

/**
 * Sprint循环状态枚举
 */
type SprintLoopState =
  | 'INIT'
  | 'SPRINT_SELECTION'
  | 'EXECUTION'
  | 'REVIEW'
  | 'GAP_ANALYSIS'
  | 'PAUSED'
  | 'ARCHIVED';

/**
 * 暂停原因
 */
type PauseReason =
  | 'USER_REQUEST'         // 用户请求暂停
  | 'CRITICAL_FAILURE'     // 关键失败
  | 'MANUAL_INTERVENTION'  // 需要人工干预
  | 'RESOURCE_LIMIT'       // 资源限制
  | 'EXTERNAL_BLOCKER';    // 外部阻塞

/**
 * 终止原因
 */
type TerminateReason =
  | 'COMPLETED'            // 正常完成
  | 'USER_CANCEL'          // 用户取消
  | 'MAX_SPRINTS_EXCEEDED' // 超过最大Sprint数
  | 'UNRECOVERABLE_FAILURE'; // 无法恢复的失败

/**
 * Sprint循环统计
 */
interface SprintLoopMetrics {
  totalSprints: number;
  completedTasks: number;
  failedTasks: number;
  totalExecutionTime: number;
  averageSprintDuration: number;
  gapAnalysisResults: GapAnalysisDecisionCount;
}

interface GapAnalysisDecisionCount {
  accepted: number;
  newMspec: number;
  failed: number;
}

/**
 * Sprint循环执行函数
 */
function executeSprintLoop(
  controller: SprintLoopController,
  mspec: MSpec,
  pmb: PMB
): SprintLoopResult {
  // 循环条件: WBS未完成且未超过最大Sprint数
  controller.while(() => {
    const wbsRemaining = mspec.wbs.atomTasks.length - pmb.completedTasks.length;
    const maxSprints = 20;  // 最大Sprint数限制
    return wbsRemaining > 0 && controller.getLoopMetrics().totalSprints < maxSprints;
  });

  // 主循环
  while (controller.state !== 'ARCHIVED' && controller.state !== 'PAUSED') {
    switch (controller.state) {
      case 'INIT':
        controller.toSprintSelection();
        break;

      case 'SPRINT_SELECTION':
        const sprint = executeSprintSelection(mspec, pmb);
        controller.currentSprint = sprint;
        controller.toExecution();
        break;

      case 'EXECUTION':
        executeSprint(controller.currentSprint);
        controller.toReview();
        break;

      case 'REVIEW':
        const reviewResult = executeReview(controller.currentSprint);
        updatePMB(controller.pmb, reviewResult);
        controller.toGapAnalysis();
        break;

      case 'GAP_ANALYSIS':
        const gapResult = executeGapAnalysis(mspec, controller.pmb);
        controller.handleGapAnalysisResult(gapResult);
        break;
    }
  }

  return {
    finalState: controller.state,
    metrics: controller.getLoopMetrics(),
    pmb: controller.pmb
  };
}
```

---

### 9.4 Sprint Selection触发条件

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Sprint Selection触发条件                                   │
└─────────────────────────────────────────────────────────────────────────────┘

触发类型:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│ 1. WBS剩余触发 (正常循环):                                                   │
│    ┌───────────────────────────────────────────────────────────────────┐    │
│    │ 条件: WBS.remaining > 0                                           │    │
│    │ 动作: 执行Sprint Selection Algorithm                               │    │
│    │ 输入: MSpec.wbs + PMB + GraspDetectChanges                        │    │
│    │ 输出: 新Sprint.yaml                                                │    │
│    └───────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│ 2. NEW_MSPEC触发 (动态调整):                                                 │
│    ┌───────────────────────────────────────────────────────────────────┐    │
│    │ 条件: Gap Analysis结果 = NEW_MSPEC                                 │    │
│    │ 动作:                                                              │    │
│    │   1. 执行MSpec调整机制                                             │    │
│    │   2. WBS重新分解                                                   │    │
│    │   3. 执行Sprint Selection Algorithm                                │    │
│    │ 输入: Gap.description + 原MSpec                                    │    │
│    │ 输出: 调整后的MSpec + 新WBS + 新Sprint.yaml                         │    │
│    └───────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│ 3. FAILED触发 (失败恢复):                                                    │
│    ┌───────────────────────────────────────────────────────────────────┐    │
│    │ 条件: Gap Analysis结果 = FAILED                                    │    │
│    │ 动作:                                                              │    │
│    │   1. 分析失败原因                                                  │    │
│    │   2. PMB记录失败详情                                               │    │
│    │   3. 调整任务优先级/复杂度                                         │    │
│    │   4. 执行Sprint Selection Algorithm                                │    │
│    │ 输入: PMB.failedTasks + 失败原因分析                               │    │
│    │ 输出: 失败恢复策略 + 新Sprint.yaml                                 │    │
│    └───────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│ 4. Terminator自动触发 (全自动模式):                                          │
│    ┌───────────────────────────────────────────────────────────────────┐    │
│    │ 条件: Terminator模式启用 + WBS.remaining > 0                       │    │
│    │ 动作: 自动触发Sprint Selection，无需人工确认                        │    │
│    │ 输入: 系统状态监控 + PMB                                           │    │
│    │ 输出: 自动生成Sprint.yaml                                          │    │
│    └───────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Sprint Selection Algorithm执行流程:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   输入收集:                                                                  │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐            │
│   │   MSpec     │  │    PMB      │  │  GraspDetectChanges     │            │
│   │  (WBS)      │  │  (历史)     │  │  (Repo变化检测)          │            │
│   └─────────────┘  └─────────────┘  └─────────────────────────┘            │
│         │               │                      │                           │
│         └───────────────┼──────────────────────┘                           │
│                         ▼                                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                    Sprint Selection Algorithm                       │  │
│   │                                                                     │  │
│   │  1. 状态检查: WBS.remaining, PMB.failedTasks                        │  │
│   │  2. 优先级计算: 复杂度、依赖、延期惩罚                               │  │
│   │  3. 任务选择: Top N任务，并行度目标                                  │  │
│   │  4. DAG构建: 执行顺序、依赖关系                                      │  │
│   │  5. Sprint生成: sprint.yaml                                         │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                         │                                                   │
│                         ▼                                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                         sprint.yaml                                 │  │
│   │                                                                     │  │
│   │  sprintId: "sprint_005"                                             │  │
│   │  selectedTasks: ["task_001", "task_002", "task_003"]                │  │
│   │  parallelism: 3                                                     │  │
│   │  estimatedDuration: 8                                               │  │
│   │  execution:                                                         │  │
│   │    dag: {task_001: [], task_002: [task_001], task_003: [task_001]} │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 9.5 ASCII循环流程图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Sprint循环流程图                                           │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────┐
                    │        INIT         │
                    │   (初始状态)         │
                    └─────────────────────┘
                             │
                             │ trigger: omt:sprint
                             │ 或 Terminator自动触发
                             ▼
                    ┌─────────────────────┐
                    │  SPRINT_SELECTION   │
                    │                     │
                    │  ┌───────────────┐  │
                    │  │ MSpec.wbs     │  │
                    │  │ PMB历史       │──▶ Sprint.yaml
                    │  │ Grasp变化     │  │
                    │  └───────────────┘  │
                    └─────────────────────┘
                             │
                             │ Sprint生成完成
                             ▼
                    ┌─────────────────────┐
                    │     EXECUTION       │
                    │                     │
                    │  ┌───────────────┐  │
                    │  │ TaskRunner    │  │
                    │  │ DAG Executor  │──▶ AtomTask执行
                    │  │ Agent Pool    │  │
                    │  └───────────────┘  │
                    │                     │
                    │  实时更新PMB         │
                    └─────────────────────┘
                             │
                             │ 执行完成
                             ▼
                    ┌─────────────────────┐
                    │       REVIEW        │
                    │                     │
                    │  ┌───────────────┐  │
                    │  │ ReviewerAgent │──▶ review.json
                    │  │ Sprint Commit │──▶ PMB更新
                    │  │ Hook          │  │
                    │  └───────────────┘  │
                    └─────────────────────┘
                             │
                             │ 审查完成
                             ▼
                    ┌─────────────────────┐
                    │   GAP_ANALYSIS      │
                    │                     │
                    │  ┌───────────────┐  │
                    │  │ QAAgent       │──▶ Gap决策
                    │  │ 验收标准      │  │
                    │  └───────────────┘  │
                    └─────────────────────┘
                             │
                             │ Gap Analysis结果
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
     ┌───────────┐    ┌───────────┐    ┌───────────┐
     │  ACCEPTED │    │ NEW_MSPEC │    │  FAILED   │
     │           │    │           │    │           │
     │ WBS完成   │    │ 功能缺口  │    │ 任务失败  │
     │ Review通过│    │ 设计调整  │    │ 需恢复    │
     └───────────┘    └───────────┘    └───────────┘
            │                │                │
            ▼                ▼                ▼
     ┌───────────┐    ┌───────────┐    ┌───────────┐
     │  ARCHIVED │    │ MSpec调整 │    │ 失败恢复  │
     │           │    │           │    │           │
     │ Sprint    │    │ WBS重分解 │    │ PMB记录   │
     │ 循环结束  │    │           │    │ 优先调整  │
     └───────────┘    └───────────┘    └───────────┘
            │                │                │
            ▼                │                │
     ┌───────────┐          │                │
     │   结束    │          │                │
     │           │          │                │
     └───────────┘          │                │
                            │                │
                            │                │
                            └────────────────┴──────────┐
                                                      │
                                                      │
                                                      │
                                                      ▼
                                             ┌─────────────────────┐
                                             │  SPRINT_SELECTION   │
                                             │   (新循环开始)       │
                                             └─────────────────────┘
                                                      │
                                                      │
                                                      │
                                              (回到循环起点)

┌─────────────────────────────────────────────────────────────────────────────┐
│                         暂停/恢复机制                                         │
│                                                                             │
│   EXECUTION ──────────────▶ PAUSED                                          │
│      │                         │                                            │
│      │ pause(reason)           │                                            │
│      │                         │                                            │
│      │                         ▼                                            │
│      │                    等待恢复信号                                       │
│      │                         │                                            │
│      │                         │ resume()                                   │
│      │                         ▼                                            │
│      │◀──────────────────── EXECUTION                                       │
│      │                         │                                            │
│      │                         │ terminate()                                │
│      │                         ▼                                            │
│      │                    ARCHIVED                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

**文档完成日期**: 2026-04-30
**下一步**: Batch 2 Part D（章节10-12）