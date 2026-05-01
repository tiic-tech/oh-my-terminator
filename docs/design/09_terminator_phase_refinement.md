# TerminatorPhase状态机精细化分析报告

**分析日期**: 2026-04-30
**分析目标**: 系统性评估两项架构改进建议，输出采纳/拒绝决策与更新后的架构设计

---

## 1. 采纳/拒绝决策矩阵

### 1.1 建议一：TerminatorPhase状态机精细化

| 设计点 | 采纳决策 | 决策理由 |
|--------|---------|---------|
| **PITCH → CLARIFY重命名** | ✅ 采纳 | CLARIFY语义更准确，QA澄清阶段而非推销阶段；与OpenSpec Explore stance的"澄清问题"语义一致 |
| **新增 TSPEC_ARTIFACTS 状态** | ⚠️ 改造采纳 | 概念有价值（监测artifacts完成度），但不应作为独立Phase状态，应作为TSPEC Phase内的子状态或Guard条件 |
| **新增 MSPEC_ARTIFACTS 状态** | ⚠️ 改造采纳 | 同上，不应作为独立Phase状态，应作为MSPEC Phase内的子状态 |
| **新增 REVIEW 状态** | ✅ 采纳 | Sprint执行后审查是必要环节，当前架构隐含在SPRINT_LOOP内，显式化为独立状态更清晰 |
| **新增 STEP 状态** | ❌ 拒绝 | STEP与SPRINT_LOOP联动过于复杂，STEP语义模糊（"步进"），建议用SprintIndex替代 |
| **新增 ALIGN 状态** | ✅ 采纳 | 四层artifacts对齐检查是OMT核心能力，应显式化为独立状态 |
| ***_ARTIFACTS "DONE"触发MSPEC更新** | ⚠️ 改造采纳 | 逻辑正确，但实现方式应改为Guard条件而非Phase状态 |

### 1.2 建议二：omt:pitch精细化调整机制

| 设计点 | 采纳决策 | 决策理由 |
|--------|---------|---------|
| **omt:pitch可在任何阶段发生** | ⚠️ 改造采纳 | 概念有价值（精细化调整），但pitch命名不当，应改为`omt:tune`或`omt:refine` |
| **用法：@tspec_<id>/proposal.md 指定文档调整** | ✅ 采纳 | 精细化指定文档调整是合理的设计，避免全量重新生成 |
| **新增 omt:tspec-new 单artifact创建** | ✅ 采纳 | 分步创建模式更符合渐进式开发理念，降低一次性生成风险 |
| **新增 omt:mspec-new 单artifact创建** | ✅ 采纳 | 同上 |
| **新增 omt:sprint-new 单artifact创建** | ✅ 采纳 | 同上 |
| **omt:align-part @mspec_<id> 针对性审查** | ✅ 采纳 | 部分对齐审查比全量对齐更高效 |

---

## 2. 决策理由深度分析

### 2.1 拒绝 STEP 状态的理由

**问题分析**:
```
用户设计的STEP联动逻辑：
- SPRINT_LOOP DONE + REVIEW DONE → STEP = NEXT_SPRINT
- 其他状态(PENDING等) → STEP = CURRENT_SPRINT
- MSPEC = DONE → STEP = NEXT_MSPEC

问题1: STEP语义模糊
- STEP是什么？"步进"、"下一步"？与SprintIndex语义重叠

问题2: 状态联动过于复杂
- STEP依赖SPRINT_LOOP状态 + REVIEW状态 + MSPEC状态
- 三维状态依赖增加维护难度

问题3: 与OMT定位不一致
- OMT是"长周期持续性系统"，STEP的"步进"概念暗示离散步骤
- Sprint循环本身就是持续性的体现，不需要额外STEP抽象
```

**替代方案**:
```typescript
// 用SprintIndex替代STEP
interface TerminatorStatus {
  currentSprintIndex: number;  // 当前Sprint序号
  currentMspecIndex: number;   // 当前MSpec序号
  // 无需STEP状态
}

// Sprint循环自动推进
while (wbs.remaining > 0) {
  executeSprint(currentSprintIndex);
  currentSprintIndex++;
}
```

### 2.2 改造 *_ARTIFACTS 状态的理由

**问题分析**:
```
用户设计：TSPEC_ARTIFACTS, MSPEC_ARTIFACTS作为独立Phase状态

问题1: Phase状态粒度不一致
- BRAINSTORM, CLARIFY, TSPEC是宏观阶段
- *_ARTIFACTS是微观"监测状态"
- 粒度混合导致状态机膨胀

问题2: 状态转换复杂化
- TSPEC → TSPEC_ARTIFACTS → MSPEC (新增中间状态)
- MSPEC → MSPEC_ARTIFACTS → SPRINT_LOOP (新增中间状态)
- 增加了转换链长度

问题3: 与Terminator全自动模式冲突
- Terminator模式下自动监测artifacts完成度
- 不需要显式Phase状态切换
```

**替代方案**:
```typescript
// *_ARTIFACTS作为Phase内的Guard条件
interface PhaseGuard {
  checkArtifactsCompletion(phase: TerminatorPhase): boolean;
}

// TSPEC Phase转换条件
transitionTo(TSPEC → MSPEC) {
  guard: TSPEC.artifacts.allCompleted()  // 内部检测
  action: generateMSpec()
}

// 无需显式*_ARTIFACTS Phase
```

### 2.3 改造 omt:pitch命名的理由

**问题分析**:
```
用户设计：omt:pitch可在任何阶段发生，进行精细化调整

问题1: pitch语义与PITCH Phase冲突
- PITCH Phase是"QA澄清阶段"
- omt:pitch COMMAND是"精细化调整"
- 语义重叠导致混淆

问题2: pitch命名不当
- pitch英文语义是"推销、投掷"
- 精细化调整应命名为adjust/refine/tune
```

**替代方案**:
```typescript
// 精细化调整COMMAND命名为omt:tune
omt:tune @tspec_<id>/proposal.md "第三点设计不合理..."

// 或命名为omt:refine（更柔和的语义）
omt:refine @mspec_<id>/design.md "调整依赖关系..."
```

---

## 3. 更新后的TerminatorPhase状态机设计

### 3.1 完整状态列表

```typescript
/**
 * Terminator托管阶段枚举（更新后）
 * 
 * 原设计：BRAINSTORM, PITCH, TSPEC, MSPEC, SPRINT_LOOP, GAP_ANALYSIS, ARCHIVE
 * 更新设计：新增CLARIFY, REVIEW, ALIGN；改造*_ARTIFACTS为Guard条件
 */
enum TerminatorPhase {
  BRAINSTORM,      // 发散探索阶段
  CLARIFY,         // QA澄清阶段（原PITCH）
  TSPEC,           // 技术规格生成阶段
  MSPEC,           // 里程碑规格生成阶段
  SPRINT_LOOP,     // Sprint循环阶段
  REVIEW,          // Sprint审查阶段（新增）
  ALIGN,           // 四层artifacts对齐阶段（新增）
  GAP_ANALYSIS,    // 验收决策阶段
  ARCHIVE          // 归档阶段
}

/**
 * Phase内部子状态（非显式Phase）
 * 用于Guard条件和内部监测
 */
interface PhaseInternalState {
  phase: TerminatorPhase;
  
  // Artifacts完成度监测（替代*_ARTIFACTS）
  artifactsStatus: {
    completed: string[];
    pending: string[];
    total: number;
    completionRate: number;  // 0-100%
  };
  
  // Phase执行状态
  executionState: 'READY' | 'EXECUTING' | 'WAITING_ARTIFACTS' | 'COMPLETED';
}
```

### 3.2 状态转换规则

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TerminatorPhase状态转换规则                                 │
│                    （含Guard条件和Action）                                     │
└─────────────────────────────────────────────────────────────────────────────┘

状态转换表：
┌──────────────┬─────────────────┬─────────────────────────┬───────────────────┐
│ From         │ To              │ Guard条件               │ Action            │
├──────────────┼─────────────────┼─────────────────────────┼───────────────────┤
│ BRAINSTORM   │ CLARIFY         │ brainstorm.json存在     │ 启动QAAgent       │
│              │                 │ exploration完成         │ 迭代问答          │
├──────────────┼─────────────────┼─────────────────────────┼───────────────────┤
│ CLARIFY      │ TSPEC           │ pitch.json存在          │ 启动SpecAgent     │
│              │                 │ QA收敛判定通过          │ 生成TSpec         │
├──────────────┼─────────────────┼─────────────────────────┼───────────────────┤
│ TSPEC        │ MSPEC           │ tspec/*.md全部存在      │ 启动MSpecGenerator│
│              │                 │ Guard: artifacts完成    │ WBS自动分解       │
├──────────────┼─────────────────┼─────────────────────────┼───────────────────┤
│ MSPEC        │ SPRINT_LOOP     │ mspecs/*.md全部存在     │ Sprint Selection  │
│              │                 │ wbs.yaml存在            │ 执行Sprint        │
├──────────────┼─────────────────┼─────────────────────────┼───────────────────┤
│ SPRINT_LOOP  │ REVIEW          │ Sprint执行完成          │ ReviewerAgent审查 │
│              │                 │ PMB记录执行结果         │ 输出review.json   │
├──────────────┼─────────────────┼─────────────────────────┼───────────────────┤
│ REVIEW       │ ALIGN           │ review.json存在         │ ArtifactsAligner │
│              │                 │ 无CRITICAL问题          │ 对齐检查          │
├──────────────┼─────────────────┼─────────────────────────┼───────────────────┤
│ ALIGN        │ GAP_ANALYSIS    │ 对齐检查完成            │ GapAnalyzer决策  │
│              │                 │ alignment记录存在       │ ACCEPTED/NEW_MSPEC│
├──────────────┼─────────────────┼─────────────────────────┼───────────────────┤
│ GAP_ANALYSIS │ ARCHIVE         │ 决策=ACCEPTED           │ 归档artifacts     │
│              │                 │ WBS.completed==total    │ 更新brain.json    │
├──────────────┼─────────────────┼─────────────────────────┼───────────────────┤
│ GAP_ANALYSIS │ MSPEC           │ 决策=NEW_MSPEC          │ MSpec调整         │
│              │                 │ 功能缺口识别            │ WBS重新分解       │
├──────────────┼─────────────────┼─────────────────────────┼───────────────────┤
│ GAP_ANALYSIS │ SPRINT_LOOP     │ 决策=FAILED             │ 失败恢复          │
│              │                 │ 恢复策略确定            │ 重新执行Sprint    │
└──────────────┴─────────────────┴─────────────────────────┴───────────────────┘
```

### 3.3 ASCII状态机图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TerminatorPhase状态机（更新后）                             │
└─────────────────────────────────────────────────────────────────────────────┘

                            ┌─────────────────┐
                            │   BRAINSTORM    │
                            │   (发散探索)     │
                            └─────────────────┘
                                    │
                                    │ Guard: brainstorm.json存在
                                    │ Action: 启动QAAgent
                                    ▼
                            ┌─────────────────┐
                            │     CLARIFY     │
                            │   (QA澄清)       │
                            │   [原PITCH]     │
                            └─────────────────┘
                                    │
                                    │ Guard: pitch.json存在 + QA收敛
                                    │ Action: 启动SpecAgent
                                    ▼
                            ┌─────────────────┐
                            │      TSPEC      │
                            │   (技术规格)     │
                            │                 │
                            │  内部监测:       │
                            │  artifacts完成度 │
                            │  (替代TSPEC_    │
                            │   ARTIFACTS)    │
                            └─────────────────┘
                                    │
                                    │ Guard: tspec/*.md全部存在
                                    │ Action: MSpecGenerator + WBS分解
                                    ▼
                            ┌─────────────────┐
                            │      MSPEC      │
                            │   (里程碑规格)   │
                            │                 │
                            │  内部监测:       │
                            │  artifacts完成度 │
                            │  (替代MSPEC_    │
                            │   ARTIFACTS)    │
                            └─────────────────┘
                                    │
                                    │ Guard: mspecs/*.md + wbs.yaml存在
                                    │ Action: Sprint Selection
                                    ▼
                            ┌─────────────────┐
                            │   SPRINT_LOOP   │
                            │   (Sprint循环)   │
                            │                 │
                            │  while(remaining>0)
                            │    Sprint执行    │
                            │    → REVIEW     │
                            │    → ALIGN      │
                            │    → GAP        │
                            │    → 循环/结束   │
                            └─────────────────┘
                                    │
                                    │ Sprint执行完成
                                    │ Action: ReviewerAgent
                                    ▼
                            ┌─────────────────┐
                            │      REVIEW     │
                            │   (Sprint审查)   │
                            │   [新增状态]     │
                            │                 │
                            │  输出: review.json
                            │  PMB更新         │
                            └─────────────────┘
                                    │
                                    │ Guard: review.json存在
                                    │ Action: ArtifactsAligner
                                    ▼
                            ┌─────────────────┐
                            │      ALIGN      │
                            │   (对齐检查)     │
                            │   [新增状态]     │
                            │                 │
                            │  四层artifacts  │
                            │  一致性验证      │
                            │  输出到.alignment/
                            └─────────────────┘
                                    │
                                    │ Guard: alignment完成
                                    │ Action: GapAnalyzer决策
                                    ▼
                            ┌─────────────────┐
                            │  GAP_ANALYSIS   │
                            │   (验收决策)     │
                            │                 │
                            │   ┌───────────┐ │
                            │   │ ACCEPTED  │─┼──▶ ARCHIVE (结束)
                            │   └───────────┘ │
                            │   ┌───────────┐ │
                            │   │ NEW_MSPEC │─┼──▶ MSPEC (调整)
                            │   └───────────┘ │
                            │   ┌───────────┐ │
                            │   │  FAILED   │─┼──▶ SPRINT_LOOP (恢复)
                            │   └───────────┘ │
                            └─────────────────┘
                                    │
                                    │ 决策=ACCEPTED
                                    │ Action: 归档
                                    ▼
                            ┌─────────────────┐
                            │    ARCHIVE      │
                            │   (归档结束)     │
                            └─────────────────┘

循环路径：
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  SPRINT_LOOP ──▶ REVIEW ──▶ ALIGN ──▶ GAP_ANALYSIS                         │
│       │                                      │                              │
│       │                                      │ [NEW_MSPEC/FAILED]           │
│       │                                      ▼                              │
│       │                              MSPEC或SPRINT_LOOP                      │
│       │                                      │                              │
│       │                                      │                              │
│       └──────────────────────────────────────┘                              │
│                   (循环直到ACCEPTED)                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 TypeScript接口定义

```typescript
/**
 * Terminator托管控制器（更新后）
 */
interface TerminatorController {
  mode: TerminatorMode;
  phase: TerminatorPhase;
  
  // Phase内部状态（替代*_ARTIFACTS显式状态）
  phaseInternalState: PhaseInternalState;
  
  // Sprint循环控制
  sprintLoopController: SprintLoopController;
  
  // 核心操作
  start(idea: string): TerminatorSession;
  pause(reason: PauseReason): void;
  resume(): void;
  stop(): void;
  
  // 状态转换（含Guard检查）
  transitionTo(targetPhase: TerminatorPhase): TransitionResult;
  
  // Guard条件检查
  checkPhaseGuard(phase: TerminatorPhase): GuardResult;
  
  // 状态查询
  status(): TerminatorStatus;
  progress(): ProgressInfo;
  
  // 事件订阅
  on(event: TerminatorEvent, handler: EventHandler): void;
}

/**
 * 状态转换结果
 */
interface TransitionResult {
  success: boolean;
  fromPhase: TerminatorPhase;
  toPhase: TerminatorPhase;
  guardChecked: boolean;
  actionExecuted: boolean;
  errors: TransitionError[];
}

/**
 * Guard检查结果
 */
interface GuardResult {
  passed: boolean;
  conditions: GuardConditionResult[];
  blockingReasons: string[];
}

interface GuardConditionResult {
  condition: string;
  passed: boolean;
  details: string;
}

/**
 * Phase内部状态（替代*_ARTIFACTS）
 */
interface PhaseInternalState {
  phase: TerminatorPhase;
  executionState: 'READY' | 'EXECUTING' | 'WAITING_ARTIFACTS' | 'COMPLETED';
  
  // Artifacts完成度监测
  artifactsStatus: {
    required: string[];       // 必需artifacts列表
    completed: string[];      // 已完成artifacts
    pending: string[];        // 待完成artifacts
    completionRate: number;   // 完成率 0-100%
    allCompleted: boolean;    // 全部完成判定
  };
  
  // Phase执行时间戳
  timestamps: {
    started: Date;
    lastUpdate: Date;
    estimatedCompletion: Date | null;
  };
}

/**
 * Terminator状态（更新后）
 */
interface TerminatorStatus {
  sessionId: string;
  mode: TerminatorMode;
  phase: TerminatorPhase;
  state: 'running' | 'paused' | 'stopped' | 'completed';
  
  // Phase内部状态
  phaseInternalState: PhaseInternalState;
  
  // Sprint循环统计
  currentSprintIndex: number;       // 当前Sprint序号（替代STEP）
  currentMspecIndex: number;        // 当前MSpec序号
  completedSprints: string[];
  failedTasks: string[];
  
  // 时间信息
  startTime: Date;
  lastUpdate: Date;
  estimatedCompletion: Date | null;
}

/**
 * 暂停原因（更新后）
 */
enum PauseReason {
  CRITICAL_FAILURE,      // 关键任务失败
  USER_INTERVENTION,     // 用户主动暂停
  RESOURCE_LIMIT,        // 资源限制
  QUALITY_GATE_FAILED,   // 质量门控失败
  DEPENDENCY_BLOCKED,    // 依赖阻塞
  ALIGN_MISMATCH         // 对齐检查发现不一致（新增）
}
```

---

## 4. 新增COMMAND设计

### 4.1 omt:tune设计（替代omt:pitch精细化调整）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    omt:tune COMMAND设计                                       │
│                    （替代用户提出的omt:pitch精细化调整）                         │
└─────────────────────────────────────────────────────────────────────────────┘

COMMAND名称: omt:tune
触发条件: 用户在任何阶段发起精细化调整请求
输入参数:
  - target: @<artifact_path>  目标artifact路径
  - feedback: string          调整反馈内容
  - mode: 'single' | 'cascade'  单文件调整或级联调整

执行流程:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  用户输入: omt:tune @tspec_001/proposal.md "第三点设计不合理..."             │
│                                                                             │
│  Step 1: 解析目标artifact                                                   │
│      │  - 读取artifact路径                                                  │
│      │  - 确定artifact类型（TSpec/MSpec/Sprint/AtomTask）                   │
│      │  - 加载当前内容                                                      │
│      │                                                                      │
│      ▼                                                                      │
│  Step 2: 分析调整反馈                                                       │
│      │  - 解析用户反馈内容                                                  │
│      │  - 识别调整范围（单点/多点/全局）                                     │
│      │  - 评估调整影响（是否级联）                                          │
│      │                                                                      │
│      ▼                                                                      │
│  Step 3: 执行调整                                                           │
│      │  - mode=single: 只调整目标artifact                                   │
│      │  - mode=cascade: 级联调整相关artifacts                               │
│      │  - 生成调整记录到 .omt/tune/                                         │
│      │                                                                      │
│      ▼                                                                      │
│  Step 4: 触发对齐检查                                                       │
│      │  - 自动触发omt:align-part                                            │
│      │  - 检查调整后的一致性                                                │
│      │                                                                      │
│      ▼                                                                      │
│  Step 5: 输出结果                                                           │
│      │  - 显示调整后的artifact                                              │
│      │  - 显示对齐检查结果                                                  │
│      │  - 提示用户是否接受调整                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

输出:
  - 调整后的artifact文件
  - .omt/tune/tune_<id>.json 调整记录
  - 对齐检查结果

示例用法:
  omt:tune @tspec_001/proposal.md "第三点设计不合理，建议改为..."
  omt:tune @mspec_002/design.md --mode=cascade "调整依赖关系"
  omt:tune @sprint_005/sprint.yaml "增加并行度到5"
```

### 4.2 omt:*-new系列设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    omt:*-new 系列COMMAND设计                                   │
│                    （分步创建模式，替代一次性生成）                              │
└─────────────────────────────────────────────────────────────────────────────┘

COMMAND列表:
┌──────────────────┬───────────────────────────────────────┬─────────────────┐
│ COMMAND          │ 功能                                  │ 输出            │
├──────────────────┼───────────────────────────────────────┼─────────────────┤
│ omt:tspec-new    │ 创建单个TSpec artifact                │ tspec/*.md      │
│ omt:mspec-new    │ 创建单个MSpec artifact                │ mspecs/*.md     │
│ omt:sprint-new   │ 创建单个Sprint artifact               │ sprint.yaml     │
├──────────────────┼───────────────────────────────────────┼─────────────────┤
│ omt:tspec        │ 半自动：一次性完成所有TSpec artifacts  │ 全套tspec       │
│ omt:mspec        │ 半自动：一次性完成所有MSpec artifacts  │ 全套mspecs+wbs  │
│ omt:sprint       │ 半自动：一次性完成Sprint Selection     │ sprint.yaml     │
└──────────────────┴───────────────────────────────────────┴─────────────────┘

omt:tspec-new 执行流程:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  用户输入: omt:tspec-new proposal                                           │
│                                                                             │
│  Step 1: 检查当前Phase                                                      │
│      │  - 验证Phase >= CLARIFY                                              │
│      │  - 验证pitch.json存在                                                │
│      │                                                                      │
│      ▼                                                                      │
│  Step 2: 创建单个artifact                                                   │
│      │  - artifact类型: proposal                                            │
│      │  - 生成: tspec_<id>/proposal.md                                      │
│      │  - 状态: draft                                                       │
│      │                                                                      │
│      ▼                                                                      │
│  Step 3: 等待用户检查                                                       │
│      │  - 提示用户review                                                    │
│      │  - 支持omt:tune调整                                                  │
│      │                                                                      │
│      ▼                                                                      │
│  Step 4: 继续下一个artifact                                                 │
│      │  - 用户确认后继续                                                    │
│      │  - omt:tspec-new design                                              │
│      │  - 直到所有TSpec artifacts完成                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

omt:mspec-new 执行流程:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  用户输入: omt:mspec-new mspec_001 proposal                                 │
│                                                                             │
│  Step 1: 检查当前Phase                                                      │
│      │  - 验证Phase >= TSPEC                                                │
│      │  - 验证tspec artifacts全部完成                                       │
│      │                                                                      │
│      ▼                                                                      │
│  Step 2: 创建单个MSpec artifact                                             │
│      │  - mspecId: mspec_001                                                │
│      │  - artifact类型: proposal                                            │
│      │  - 生成: mspecs/mspec_001/proposal.md                                │
│      │                                                                      │
│      ▼                                                                      │
│  Step 3: 等待用户检查                                                       │
│      │  - 支持omt:tune调整                                                  │
│      │                                                                      │
│      ▼                                                                      │
│  Step 4: 继续下一个artifact                                                 │
│      │  - omt:mspec-new mspec_001 design                                    │
│      │  - omt:mspec-new mspec_001 wbs                                       │
│      │  - 直到MSpec完成                                                     │
│      │                                                                      │
│      ▼                                                                      │
│  Step 5: 继续下一个MSpec                                                    │
│      │  - omt:mspec-new mspec_002 proposal                                  │
│      │  - 直到所有MSpec完成                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

ASCII流程图:
┌─────────────────────────────────────────────────────────────────────────────┐
│                    omt:*-new 分步创建流程                                     │
└─────────────────────────────────────────────────────────────────────────────┘

                    CLARIFY完成
                         │
                         ▼
            ┌────────────────────────┐
            │  omt:tspec-new proposal │
            │  创建proposal.md        │
            └────────────────────────┘
                         │
                         │ 用户检查
                         │ 可选: omt:tune
                         ▼
            ┌────────────────────────┐
            │  omt:tspec-new design   │
            │  创建design.md          │
            └────────────────────────┘
                         │
                         │ 用户检查
                         ▼
            ┌────────────────────────┐
            │  omt:tspec-new milestones│
            │  创建milestones.yaml    │
            └────────────────────────┘
                         │
                         │ 全部完成
                         ▼
                    TSPEC Phase完成
                         │
                         ▼
            ┌────────────────────────┐
            │  omt:mspec-new mspec_001│
            │  proposal               │
            └────────────────────────┘
                         │
                         │ 用户检查
                         ▼
            ┌────────────────────────┐
            │  omt:mspec-new mspec_001│
            │  design                 │
            └────────────────────────┘
                         │
                         │ 用户检查
                         ▼
            ┌────────────────────────┐
            │  omt:mspec-new mspec_001│
            │  wbs                    │
            └────────────────────────┘
                         │
                         │ MSpec完成
                         ▼
            ┌────────────────────────┐
            │  omt:mspec-new mspec_002│
            │  proposal               │
            └────────────────────────┘
                         │
                         │ ... 循环
                         ▼
                    MSPEC Phase完成
```

### 4.3 omt:align和omt:align-part设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    omt:align / omt:align-part COMMAND设计                     │
└─────────────────────────────────────────────────────────────────────────────┘

COMMAND对比:
┌──────────────────┬───────────────────────────────────────┬─────────────────┐
│ COMMAND          │ 范围                                  │ 输出            │
├──────────────────┼───────────────────────────────────────┼─────────────────┤
│ omt:align        │ 全量对齐：所有四层artifacts            │ .omt/alignment/ │
│                  │ 检查所有TSpec→MSpec→Sprint→AtomTask    │ alignment_<id>  │
├──────────────────┼───────────────────────────────────────┼─────────────────┤
│ omt:align-part   │ 部分对齐：指定文件夹内artifacts        │ .omt/alignment/ │
│                  │ 如: @mspec_001 只检查该MSpec相关       │ part_<id>       │
└──────────────────┴───────────────────────────────────────┴─────────────────┘

omt:align执行流程:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  用户输入: omt:align                                                        │
│                                                                             │
│  Step 1: 收集所有artifacts                                                  │
│      │  - TSpec: tspec/*.md                                                 │
│      │  - MSpec: mspecs/*.md + wbs.yaml                                     │
│      │  - Sprint: sprints/*.yaml                                            │
│      │  - AtomTask: tasks/*.json                                            │
│      │                                                                      │
│      ▼                                                                      │
│  Step 2: 执行四层对齐检查                                                    │
│      │  - TSpec→MSpec: Milestone数量、技术约束一致性                         │
│      │  - MSpec→Sprint: WBS任务数量、依赖关系一致性                          │
│      │  - Sprint→AtomTask: DAG依赖、assigneeRole匹配                        │
│      │                                                                      │
│      ▼                                                                      │
│  Step 3: 输出对齐发现                                                        │
│      │  - 状态标签: ADDED / MODIFIED / DELETED                              │
│      │  - 写入: .omt/alignment/alignment_<id>.json                          │
│      │                                                                      │
│      ▼                                                                      │
│  Step 4: 同步关键问题到PMB                                                   │
│      │  - CRITICAL issues → PMB记录                                         │
│      │  - 提示用户处理                                                      │
│      │                                                                      │
│      ▼                                                                      │
│  Step 5: 链式更新建议                                                        │
│      │  - Sprint→MSPEC→TSPEC更新建议                                        │
│      │  - 输出修改方案                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

omt:align-part执行流程:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  用户输入: omt:align-part @mspec_001                                        │
│                                                                             │
│  Step 1: 收集指定范围artifacts                                              │
│      │  - MSpec: mspecs/mspec_001/*.md                                      │
│      │  - 相关Sprint: sprints/sprint_001*.yaml                              │
│      │  - 相关AtomTask: tasks/task_001*.json                                │
│      │                                                                      │
│      ▼                                                                      │
│  Step 2: 执行部分对齐检查                                                    │
│      │  - MSpec→Sprint对齐                                                  │
│      │  - Sprint→AtomTask对齐                                               │
│      │  - 不检查TSpec→MSpec（范围外）                                        │
│      │                                                                      │
│      ▼                                                                      │
│  Step 3: 输出部分对齐发现                                                    │
│      │  - 写入: .omt/alignment/part_<id>.json                               │
│      │                                                                      │
│      ▼                                                                      │
│  Step 4: 输出修改建议                                                        │
│      │  - 针对mspec_001的调整建议                                           │
│      │  - 支持omt:tune执行                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

ASCII流程图:
┌─────────────────────────────────────────────────────────────────────────────┐
│                    omt:align 全量对齐流程                                     │
└─────────────────────────────────────────────────────────────────────────────┘

                    Sprint执行完成
                         │
                         ▼
            ┌────────────────────────┐
            │     omt:align          │
            │   (全量对齐检查)        │
            └────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
   ┌───────────┐   ┌───────────┐   ┌───────────┐
   │TSpec→MSpec│   │MSpec→Sprint│   │Sprint→Task│
   │对齐检查    │   │对齐检查    │   │对齐检查    │
   └───────────┘   └───────────┘   └───────────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │ 输出alignment_<id>.json │
            │                        │
            │ ADDED: 新增不一致       │
            │ MODIFIED: 修改不一致    │
            │ DELETED: 删除不一致     │
            └────────────────────────┘
                         │
                         │ CRITICAL问题
                         ▼
            ┌────────────────────────┐
            │    同步到PMB           │
            │   pmb.yaml记录         │
            └────────────────────────┘
                         │
                         │ 链式更新建议
                         ▼
            ┌────────────────────────┐
            │ Sprint→MSPEC→TSPEC     │
            │ 更新建议输出            │
            └────────────────────────┘
```

### 4.4 omt:chain-update COMMAND设计

**COMMAND名称**: omt:chain-update
**触发条件**: 用户在非Terminator模式下手动触发链式更新
**用途**: 执行alignment发现后的链式更新（Sprint→MSPEC→TSPEC）

**执行流程**:
1. 读取指定的alignment文件
2. 分析alignment中的发现和更新建议
3. 按依赖顺序执行更新链
4. 输出更新结果

**输入参数**:
- target: @alignment_<id>  目标alignment文件路径
- mode: 'auto' | 'stepwise'  自动执行或分步确认

**用法示例**:
```
omt:chain-update @alignment_20260501_001
omt:chain-update @alignment_<id> --mode=stepwise
```

**与Terminator模式的关系**:
- 非Terminator模式: 用户手动触发omt:chain-update
- Terminator模式: 系统自动执行链式更新（无需用户干预）

---

## 5. 状态联动机制设计

### 5.1 MSPEC状态与Phase转换联动

```typescript
/**
 * MSPEC状态与Phase转换联动
 * 
 * 设计原则：
 * - MSPEC状态不是TerminatorPhase，是MSpec Phase内的子状态
 * - Phase转换依赖MSPEC状态作为Guard条件
 */

interface MSpecPhaseState {
  mspecId: string;
  
  // MSpec状态（子状态）
  mspecState: 'PENDING' | 'GENERATING' | 'ARTIFACTS_PENDING' | 'WBS_GENERATING' | 'COMPLETED';
  
  // Artifacts完成度（替代MSPEC_ARTIFACTS显式状态）
  artifactsCompletion: {
    proposal: boolean;
    design: boolean;
    wbs: boolean;
    allCompleted: boolean;
  };
}

/**
 * Phase转换Guard条件（MSpec → Sprint_LOOP）
 */
function checkMSpecPhaseGuard(mspecStates: MSpecPhaseState[]): GuardResult {
  const allMSpecCompleted = mspecStates.every(m => m.mspecState === 'COMPLETED');
  const allArtifactsCompleted = mspecStates.every(m => m.artifactsCompletion.allCompleted);
  
  return {
    passed: allMSpecCompleted && allArtifactsCompleted,
    conditions: [
      { condition: '所有MSpec状态=COMPLETED', passed: allMSpecCompleted },
      { condition: '所有MSpec artifacts完成', passed: allArtifactsCompleted }
    ],
    blockingReasons: allMSpecCompleted ? [] : ['存在未完成的MSpec']
  };
}

/**
 * MSpec状态转换触发Phase转换
 */
function transitionOnMSpecCompletion(
  terminator: TerminatorController,
  mspecStates: MSpecPhaseState[]
): TransitionResult {
  const guardResult = checkMSpecPhaseGuard(mspecStates);
  
  if (guardResult.passed) {
    return terminator.transitionTo(TerminatorPhase.SPRINT_LOOP);
  } else {
    return {
      success: false,
      fromPhase: TerminatorPhase.MSPEC,
      toPhase: TerminatorPhase.MSPEC,
      guardChecked: false,
      actionExecuted: false,
      errors: guardResult.blockingReasons.map(r => ({ message: r }))
    };
  }
}
```

### 5.2 Sprint循环与Review/Align联动

```typescript
/**
 * Sprint循环与Review/Align联动
 * 
 * 设计原则：
 * - Sprint执行完成自动触发Review
 * - Review完成自动触发Align
 * - Align完成自动触发Gap Analysis
 * - Gap Analysis决策决定后续Phase
 */

interface SprintLoopTransitionConfig {
  // Sprint执行完成 → Review
  sprintToReview: {
    trigger: 'SPRINT_COMPLETED';
    action: 'START_REVIEW_AGENT';
  };
  
  // Review完成 → Align
  reviewToAlign: {
    trigger: 'REVIEW_JSON_EXISTS';
    guard: 'NO_CRITICAL_ISSUES';
    action: 'START_ALIGN_CHECK';
  };
  
  // Align完成 → Gap Analysis
  alignToGapAnalysis: {
    trigger: 'ALIGNMENT_COMPLETED';
    action: 'START_GAP_ANALYSIS';
  };
  
  // Gap Analysis决策 → 后续Phase
  gapAnalysisDecision: {
    ACCEPTED: TerminatorPhase.ARCHIVE;
    NEW_MSPEC: TerminatorPhase.MSPEC;
    FAILED: TerminatorPhase.SPRINT_LOOP;
  };
}

/**
 * Sprint循环自动推进逻辑
 */
function executeSprintLoopPhase(terminator: TerminatorController): void {
  while (terminator.phase !== TerminatorPhase.ARCHIVE) {
    switch (terminator.phase) {
      case TerminatorPhase.SPRINT_LOOP:
        // 执行Sprint
        executeSprint(terminator.currentSprintIndex);
        terminator.currentSprintIndex++;
        
        // 自动转换到Review
        terminator.transitionTo(TerminatorPhase.REVIEW);
        break;
        
      case TerminatorPhase.REVIEW:
        // 执行Review
        const reviewResult = executeReviewAgent(terminator.currentSprint);
        
        // Guard检查
        if (reviewResult.criticalIssues.length === 0) {
          terminator.transitionTo(TerminatorPhase.ALIGN);
        } else {
          terminator.pause(PauseReason.QUALITY_GATE_FAILED);
          return;
        }
        break;
        
      case TerminatorPhase.ALIGN:
        // 执行对齐检查
        const alignResult = executeAlignCheck(terminator);
        
        // 同步到PMB
        if (alignResult.criticalIssues.length > 0) {
          syncToPMB(alignResult.criticalIssues);
        }
        
        terminator.transitionTo(TerminatorPhase.GAP_ANALYSIS);
        break;
        
      case TerminatorPhase.GAP_ANALYSIS:
        // 执行Gap Analysis
        const gapDecision = executeGapAnalysis(terminator);
        
        // 决策转换
        terminator.transitionTo(gapDecisionToPhase(gapDecision));
        break;
        
      case TerminatorPhase.MSPEC:
        // MSpec调整（NEW_MSPEC路径）
        adjustMSpec(gapDecision);
        terminator.transitionTo(TerminatorPhase.SPRINT_LOOP);
        break;
        
      case TerminatorPhase.ARCHIVE:
        // 结束
        archiveArtifacts(terminator);
        return;
    }
  }
}

/**
 * Gap决策到Phase映射
 */
function gapDecisionToPhase(decision: GapDecision): TerminatorPhase {
  switch (decision) {
    case GapDecision.ACCEPTED:
      return TerminatorPhase.ARCHIVE;
    case GapDecision.NEW_MSPEC:
      return TerminatorPhase.MSPEC;
    case GapDecision.FAILED:
      return TerminatorPhase.SPRINT_LOOP;
  }
}
```

### 5.3 Artifacts完成度监测机制

```typescript
/**
 * Artifacts完成度监测机制
 * 
 * 替代用户提出的*_ARTIFACTS显式Phase状态
 * 设计为Phase内的子状态监测
 */

interface ArtifactsMonitor {
  /**
   * 监测指定Phase的artifacts完成度
   */
  monitorPhaseArtifacts(phase: TerminatorPhase): ArtifactsCompletionStatus;
  
  /**
   * 检查单个artifact是否存在
   */
  checkArtifactExists(path: string): boolean;
  
  /**
   * 检查所有必需artifacts
   */
  checkRequiredArtifacts(phase: TerminatorPhase): RequiredArtifactsResult;
  
  /**
   * 计算完成率
   */
  calculateCompletionRate(phase: TerminatorPhase): number;
}

/**
 * Artifacts完成度状态
 */
interface ArtifactsCompletionStatus {
  phase: TerminatorPhase;
  
  required: {
    total: number;
    completed: number;
    pending: number;
    list: ArtifactRequirement[];
  };
  
  completionRate: number;  // 0-100%
  
  allCompleted: boolean;
  
  blockingArtifacts: string[];  // 阻塞转换的artifacts
}

/**
 * Phase必需artifacts配置
 */
interface PhaseArtifactsConfig {
  TSPEC: {
    required: ['proposal.md', 'design.md', 'milestones.yaml'];
    optional: ['constraints.md', 'risks.md'];
  };
  
  MSPEC: {
    required: ['proposal.md', 'design.md', 'wbs.yaml'];
    optional: ['reviews.md'];
  };
  
  SPRINT_LOOP: {
    required: ['sprint.yaml'];
    optional: [];
  };
  
  REVIEW: {
    required: ['review.json'];
    optional: ['comments.md'];
  };
  
  ALIGN: {
    required: ['alignment_<id>.json'];
    optional: [];
  };
}

/**
 * Artifacts监测实现
 */
class ArtifactsMonitorImpl implements ArtifactsMonitor {
  
  monitorPhaseArtifacts(phase: TerminatorPhase): ArtifactsCompletionStatus {
    const config = PHASE_ARTIFACTS_CONFIG[phase];
    const basePath = getPhaseBasePath(phase);
    
    const requiredResults = this.checkRequiredArtifacts(phase);
    
    return {
      phase,
      required: requiredResults,
      completionRate: this.calculateCompletionRate(phase),
      allCompleted: requiredResults.completed === requiredResults.total,
      blockingArtifacts: requiredResults.pending
    };
  }
  
  checkRequiredArtifacts(phase: TerminatorPhase): RequiredArtifactsResult {
    const config = PHASE_ARTIFACTS_CONFIG[phase];
    const basePath = getPhaseBasePath(phase);
    
    const results: ArtifactRequirement[] = config.required.map(name => ({
      name,
      path: `${basePath}/${name}`,
      exists: this.checkArtifactExists(`${basePath}/${name}`),
      required: true
    }));
    
    return {
      total: results.length,
      completed: results.filter(r => r.exists).length,
      pending: results.filter(r => !r.exists).map(r => r.name),
      list: results
    };
  }
  
  calculateCompletionRate(phase: TerminatorPhase): number {
    const status = this.monitorPhaseArtifacts(phase);
    return (status.required.completed / status.required.total) * 100;
  }
}

/**
 * Phase转换时自动检查artifacts完成度
 */
function transitionWithArtifactsGuard(
  terminator: TerminatorController,
  targetPhase: TerminatorPhase,
  monitor: ArtifactsMonitor
): TransitionResult {
  const currentPhase = terminator.phase;
  const artifactsStatus = monitor.monitorPhaseArtifacts(currentPhase);
  
  if (!artifactsStatus.allCompleted) {
    return {
      success: false,
      fromPhase: currentPhase,
      toPhase: currentPhase,
      guardChecked: true,
      actionExecuted: false,
      errors: [{
        message: `Artifacts未完成: ${artifactsStatus.blockingArtifacts.join(', ')}`,
        code: 'E_ARTIFACTS_PENDING'
      }]
    };
  }
  
  return terminator.transitionTo(targetPhase);
}
```

---

## 6. alignment输出格式设计

### 6.1 `.omt/alignment/alignment_<id>` 文件结构

```yaml
# .omt/alignment/alignment_<id>.yaml 结构

id: alignment_<timestamp>
timestamp: 2026-04-30T10:30:00Z
trigger_phase: SPRINT_LOOP  # 触发对齐的Phase

# 对齐检查范围
scope: FULL  # FULL / PARTIAL

# 对齐检查结果
alignment_results:
  
  # Layer 1: TSpec→MSpec对齐
  tspec_to_mspec:
    valid: true
    checked_at: 2026-04-30T10:30:01Z
    
    findings:
      - id: F001
        type: MODIFIED  # ADDED / MODIFIED / DELETED
        layer: TSpec→MSpec
        artifact: mspec_002/design.md
        description: "MSpec设计修改了TSpec中的技术约束"
        severity: WARNING
        
        # 对齐详情
        details:
          tspec_original: "使用REST API架构"
          mspec_current: "采用GraphQL API架构"
          
        # 修复建议
        suggestion: "需要更新TSpec设计文档以反映架构变更"
        
        # 链式更新路径
        chain_update:
          root: tspec_001/design.md
          affected:
            - mspec_002/design.md
            - sprint_003/sprint.yaml
            - task_001.json
  
  # Layer 2: MSpec→Sprint对齐
  mspec_to_sprint:
    valid: false
    checked_at: 2026-04-30T10:30:02Z
    
    findings:
      - id: F002
        type: ADDED
        layer: MSpec→Sprint
        artifact: sprint_005/sprint.yaml
        description: "Sprint包含了不在WBS中的任务"
        severity: ERROR
        
        details:
          wbs_tasks: ["task_001", "task_002", "task_003"]
          sprint_tasks: ["task_001", "task_002", "task_004"]  # task_004不在WBS中
          
        suggestion: "移除task_004或更新WBS添加该任务"
        
      - id: F003
        type: DELETED
        layer: MSpec→Sprint
        artifact: sprint_004/sprint.yaml
        description: "WBS中的task_003未包含在任何Sprint中"
        severity: WARNING
  
  # Layer 3: Sprint→AtomTask对齐
  sprint_to_atomtask:
    valid: true
    checked_at: 2026-04-30T10:30:03Z
    
    findings: []

# 对齐评分
alignment_score:
  overall: 75  # 0-100
  breakdown:
    tspec_to_mspec: 90
    mspec_to_sprint: 60
    sprint_to_atomtask: 100

# CRITICAL问题（需要同步到PMB）
critical_issues:
  - finding_id: F002
    pmb_sync: true
    pmb_record_id: pmb_issue_001

# 链式更新建议
chain_update_proposals:
  - proposal_id: P001
    type: UPWARD  # 从底层向上层更新
    
    trigger_finding: F001
    
    update_chain:
      - step: 1
        artifact: sprint_003/sprint.yaml
        action: UPDATE
        description: "调整Sprint任务以匹配新架构"
        
      - step: 2
        artifact: mspec_002/design.md
        action: CONFIRM
        description: "确认MSpec设计变更"
        
      - step: 3
        artifact: tspec_001/design.md
        action: UPDATE
        description: "更新TSpec设计以反映GraphQL架构"

# 用户决策
user_decision:
  required: true
  options:
    - ACCEPT_ALL  # 接受所有修复建议
    - REJECT_ALL  # 拒绝所有修复建议
    - SELECTIVE   # 选择性接受
    - MANUAL_FIX  # 手动修复

# 状态
status: PENDING_USER_DECISION
```

### 6.2 状态标签格式（ADDED/MODIFIED/DELETED）

```typescript
/**
 * 对齐发现状态标签
 * 
 * 参考OpenSpec opsx:archive设计
 */

enum AlignmentFindingType {
  ADDED = 'ADDED',      // 新增不一致：下层添加了上层未定义的内容
  MODIFIED = 'MODIFIED',// 修改不一致：下层修改了上层定义的内容
  DELETED = 'DELETED'   // 删除不一致：下层删除了上层定义的内容
}

/**
 * 对齐发现详细结构
 */
interface AlignmentFinding {
  id: string;                   // 发现ID，如F001
  type: AlignmentFindingType;   // 状态标签
  
  layer: string;                // 对齐层级
  artifact: string;             // 涉及artifact路径
  
  description: string;          // 发现描述
  severity: 'ERROR' | 'WARNING' | 'INFO';
  
  // 对齐详情
  details: {
    upper_layer_value: any;     // 上层原始值
    lower_layer_value: any;     // 下层当前值
    diff_type: string;          // 差异类型
  };
  
  // 修复建议
  suggestion: string;
  
  // 链式更新路径
  chain_update: {
    root: string;               // 根artifact（上层）
    affected: string[];         // 受影响artifacts（下层）
  };
  
  // 是否同步到PMB
  pmb_sync: boolean;
}

/**
 * ADDED示例：下层添加了上层未定义的内容
 * 
 * 场景：Sprint包含了不在WBS中的任务
 * 
 * {
 *   id: 'F002',
 *   type: 'ADDED',
 *   layer: 'MSpec→Sprint',
 *   artifact: 'sprint_005/sprint.yaml',
 *   description: 'Sprint包含了不在WBS中的任务task_004',
 *   severity: 'ERROR',
 *   details: {
 *     upper_layer_value: ['task_001', 'task_002', 'task_003'],  // WBS任务
 *     lower_layer_value: ['task_001', 'task_002', 'task_004'],  // Sprint任务
 *     diff_type: 'EXTRA_ELEMENT'
 *   },
 *   suggestion: '移除task_004或更新WBS添加该任务',
 *   chain_update: {
 *     root: 'mspec_001/wbs.yaml',
 *     affected: ['sprint_005/sprint.yaml', 'task_004.json']
 *   },
 *   pmb_sync: true
 * }
 */

/**
 * MODIFIED示例：下层修改了上层定义的内容
 * 
 * 场景：MSpec设计修改了TSpec中的技术约束
 * 
 * {
 *   id: 'F001',
 *   type: 'MODIFIED',
 *   layer: 'TSpec→MSpec',
 *   artifact: 'mspec_002/design.md',
 *   description: 'MSpec设计修改了TSpec中的API架构约束',
 *   severity: 'WARNING',
 *   details: {
 *     upper_layer_value: 'REST API架构',  // TSpec定义
 *     lower_layer_value: 'GraphQL API架构',  // MSpec设计
 *     diff_type: 'VALUE_CHANGED'
 *   },
 *   suggestion: '需要更新TSpec设计文档以反映架构变更',
 *   chain_update: {
 *     root: 'tspec_001/design.md',
 *     affected: ['mspec_002/design.md', 'sprint_003/sprint.yaml']
 *   },
 *   pmb_sync: false
 * }
 */

/**
 * DELETED示例：下层删除了上层定义的内容
 * 
 * 场景：WBS中的任务未包含在任何Sprint中
 * 
 * {
 *   id: 'F003',
 *   type: 'DELETED',
 *   layer: 'MSpec→Sprint',
 *   artifact: 'sprint_004/sprint.yaml',
 *   description: 'WBS中的task_003未包含在任何Sprint中',
 *   severity: 'WARNING',
 *   details: {
 *     upper_layer_value: ['task_001', 'task_002', 'task_003'],  // WBS任务
 *     lower_layer_value: ['task_001', 'task_002'],  // Sprint任务（缺少task_003）
 *     diff_type: 'MISSING_ELEMENT'
 *   },
 *   suggestion: '添加包含task_003的新Sprint或调整WBS',
 *   chain_update: {
 *     root: 'mspec_001/wbs.yaml',
 *     affected: ['sprint_004/sprint.yaml']
 *   },
 *   pmb_sync: false
 * }
 */
```

### 6.3 与PMB同步机制

```typescript
/**
 * Alignment与PMB同步机制
 * 
 * 设计原则：
 * - CRITICAL severity的对齐发现必须同步到PMB
 * - ERROR severity的对齐发现可选同步
 * - WARNING/INFO severity不同步
 */

interface PMBSyncConfig {
  // 同步触发条件
  sync_triggers: {
    severity: ['ERROR', 'CRITICAL'];
    types: ['ADDED', 'DELETED'];  // MODIFIED通常不阻塞执行
  };
  
  // PMB记录格式
  pmb_record_format: {
    id: string;
    source: 'ALIGNMENT';
    finding_id: string;
    timestamp: Date;
    phase: TerminatorPhase;
    severity: string;
    description: string;
    blocking: boolean;  // 是否阻塞后续执行
    resolution: 'PENDING' | 'RESOLVED' | 'IGNORED';
  };
}

/**
 * 同步到PMB实现
 */
function syncAlignmentToPMB(
  alignment: AlignmentResult,
  pmb: PMBManager
): PMBSyncResult {
  const criticalFindings = alignment.findings.filter(f => 
    f.severity === 'ERROR' || f.severity === 'CRITICAL'
  );
  
  const records: PMBRecord[] = criticalFindings.map(f => ({
    id: `pmb_issue_${Date.now()}`,
    source: 'ALIGNMENT',
    finding_id: f.id,
    timestamp: new Date(),
    phase: alignment.trigger_phase,
    severity: f.severity,
    description: f.description,
    blocking: f.severity === 'CRITICAL',
    resolution: 'PENDING'
  }));
  
  // 写入PMB
  for (const record of records) {
    pmb.addIssue(record);
  }
  
  return {
    synced_count: records.length,
    blocking_count: records.filter(r => r.blocking).length,
    records
  };
}

/**
 * PMB阻塞检查
 * 
 * Phase转换前检查PMB是否有未解决的阻塞issue
 */
function checkPMBBlocking(pmb: PMBManager): boolean {
  const blockingIssues = pmb.getIssues({
    source: 'ALIGNMENT',
    blocking: true,
    resolution: 'PENDING'
  });
  
  return blockingIssues.length > 0;
}

/**
 * 阻塞时暂停Terminator
 */
function handlePMBBlocking(terminator: TerminatorController, pmb: PMBManager): void {
  if (checkPMBBlocking(pmb)) {
    terminator.pause(PauseReason.ALIGN_MISMATCH);
    
    // 提示用户解决阻塞issue
    const blockingIssues = pmb.getIssues({
      blocking: true,
      resolution: 'PENDING'
    });
    
    console.log(`Terminator暂停：存在${blockingIssues.length}个阻塞的对齐问题`);
    console.log('请使用 omt:tune 解决问题后执行 omt:resume');
  }
}
```

### 6.4 链式更新机制（Sprint→MSPEC→TSPEC）

```typescript
/**
 * 链式更新机制
 * 
 * 设计原则：
 * - 更新方向：UPWARD（底层向上层）或 DOWNWARD（上层向下层）
 * - 更新传播：一个artifact变更触发相关artifacts更新
 * - 更新记录：记录完整更新链到.alignment/
 */

enum ChainUpdateDirection {
  UPWARD = 'UPWARD',    // 从Sprint向上更新MSpec，再向上更新TSpec
  DOWNWARD = 'DOWNWARD' // 从TSpec向下更新MSpec，再向下更新Sprint
}

/**
 * 链式更新提案
 */
interface ChainUpdateProposal {
  proposal_id: string;
  
  // 更新方向
  direction: ChainUpdateDirection;
  
  // 触发来源
  trigger_finding: string;  // 对齐发现ID
  
  // 更新链
  update_chain: ChainUpdateStep[];
  
  // 估算影响
  estimated_impact: {
    artifacts_count: number;
    estimated_time: number;  // 分钟
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  
  // 用户决策
  user_decision: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

/**
 * 更新链步骤
 */
interface ChainUpdateStep {
  step: number;
  artifact: string;
  action: 'UPDATE' | 'CONFIRM' | 'CREATE' | 'DELETE';
  description: string;
  
  // 更新内容预览
  update_preview?: {
    before: any;
    after: any;
  };
  
  // 依赖步骤
  depends_on_steps: number[];
}

/**
 * UPWARD更新示例（Sprint→MSpec→TSpec）
 * 
 * 场景：MSpec设计修改了TSpec的技术约束
 * 
 * {
 *   proposal_id: 'P001',
 *   direction: 'UPWARD',
 *   trigger_finding: 'F001',
 *   
 *   update_chain: [
 *     {
 *       step: 1,
 *       artifact: 'sprint_003/sprint.yaml',
 *       action: 'UPDATE',
 *       description: '调整Sprint任务以匹配GraphQL架构',
 *       depends_on_steps: []
 *     },
 *     {
 *       step: 2,
 *       artifact: 'mspec_002/design.md',
 *       action: 'CONFIRM',
 *       description: '确认MSpec设计变更',
 *       depends_on_steps: [1]
 *     },
 *     {
 *       step: 3,
 *       artifact: 'tspec_001/design.md',
 *       action: 'UPDATE',
 *       description: '更新TSpec设计以反映GraphQL架构',
 *       depends_on_steps: [2]
 *     }
 *   ],
 *   
 *   estimated_impact: {
 *     artifacts_count: 3,
 *     estimated_time: 30,
 *     risk_level: 'MEDIUM'
 *   },
 *   
 *   user_decision: 'PENDING'
 * }
 */

/**
 * DOWNWARD更新示例（TSpec→MSpec→Sprint）
 * 
 * 场景：TSpec修改了技术栈约束，需要向下传播
 * 
 * {
 *   proposal_id: 'P002',
 *   direction: 'DOWNWARD',
 *   trigger_finding: 'F010',  // 用户手动修改TSpec
 *   
 *   update_chain: [
 *     {
 *       step: 1,
 *       artifact: 'tspec_001/design.md',
 *       action: 'CONFIRM',
 *       description: '确认TSpec技术栈变更',
 *       depends_on_steps: []
 *     },
 *     {
 *       step: 2,
 *       artifact: 'mspec_001/design.md',
 *       action: 'UPDATE',
 *       description: '更新MSpec设计以匹配新技术栈',
 *       depends_on_steps: [1]
 *     },
 *     {
 *       step: 3,
 *       artifact: 'mspec_002/design.md',
 *       action: 'UPDATE',
 *       description: '更新MSpec设计以匹配新技术栈',
 *       depends_on_steps: [1]
 *     },
 *     {
 *       step: 4,
 *       artifact: 'sprint_003/sprint.yaml',
 *       action: 'UPDATE',
 *       description: '调整Sprint任务以匹配新技术栈',
 *       depends_on_steps: [2, 3]
 *     }
 *   ],
 *   
 *   estimated_impact: {
 *     artifacts_count: 4,
 *     estimated_time: 60,
 *     risk_level: 'HIGH'
 *   },
 *   
 *   user_decision: 'PENDING'
 * }
 */

/**
 * 链式更新执行
 */
function executeChainUpdate(
  proposal: ChainUpdateProposal,
  terminator: TerminatorController
): ChainUpdateResult {
  // 检查用户决策
  if (proposal.user_decision !== 'ACCEPTED') {
    return {
      success: false,
      reason: '用户未接受更新提案'
    };
  }
  
  // 按步骤顺序执行（考虑依赖）
  const orderedSteps = orderByDependencies(proposal.update_chain);
  
  const results: StepResult[] = [];
  
  for (const step of orderedSteps) {
    // 检查依赖步骤是否完成
    const depsCompleted = step.depends_on_steps.every(depStep => 
      results.find(r => r.step === depStep)?.success
    );
    
    if (!depsCompleted) {
      results.push({
        step: step.step,
        success: false,
        reason: `依赖步骤${step.depends_on_steps.join(',')}未完成`
      });
      break;
    }
    
    // 执行更新
    const result = executeUpdateStep(step);
    results.push(result);
    
    if (!result.success) {
      break;
    }
  }
  
  // 记录更新链到.alignment/
  recordChainUpdate(proposal, results);
  
  return {
    success: results.every(r => r.success),
    steps_completed: results.filter(r => r.success).length,
    steps_total: proposal.update_chain.length,
    results
  };
}

/**
 * 记录更新链
 */
function recordChainUpdate(
  proposal: ChainUpdateProposal,
  results: StepResult[]
): void {
  const recordPath = `.omt/alignment/chain_update_${proposal.proposal_id}.yaml`;
  
  const record = {
    proposal_id: proposal.proposal_id,
    direction: proposal.direction,
    trigger_finding: proposal.trigger_finding,
    executed_at: new Date(),
    results,
    final_status: results.every(r => r.success) ? 'SUCCESS' : 'PARTIAL_FAILURE'
  };
  
  writeFileSync(recordPath, yaml.dump(record));
}
```

---

## 7. 完整架构更新汇总

### 7.1 TerminatorPhase状态机更新

| 更新项 | 原设计 | 新设计 | 变更说明 |
|--------|--------|--------|---------|
| **状态数量** | 7个 | 9个 | +CLARIFY, +REVIEW, +ALIGN |
| **PITCH** | PITCH | CLARIFY | 重命名，语义更准确 |
| ***_ARTIFACTS** | 无 | 不作为显式Phase | 改造为Phase内子状态 |
| **REVIEW** | 隐含在SPRINT_LOOP | 显式Phase | Sprint后审查独立状态 |
| **ALIGN** | 无 | 新增Phase | 四层artifacts对齐检查 |
| **STEP** | 无 | 拒绝 | 用SprintIndex替代 |

### 7.2 COMMAND更新

| COMMAND | 原设计 | 新设计 | 说明 |
|---------|--------|--------|------|
| **omt:pitch** | QA澄清阶段 | 重命名为omt:clarify | PITCH→CLARIFY语义更准确 |
| **omt:pitch精细化调整** | 无 | 重命名为omt:tune | 精细化调整在任何阶段 |
| **omt:*-new系列** | 无 | 新增 | 分步创建artifacts |
| **omt:align** | 无 | 新增 | 全量对齐检查 |
| **omt:align-part** | 无 | 新增 | 部分对齐检查 |

### 7.3 对齐机制更新

| 机制 | 原设计 | 新设计 | 说明 |
|------|--------|--------|------|
| **alignment文件** | 无 | `.omt/alignment/alignment_<id>` | 对齐检查输出 |
| **状态标签** | 无 | ADDED/MODIFIED/DELETED | 参考OpenSpec opsx:archive |
| **PMB同步** | 无 | CRITICAL severity同步 | 阻塞问题记录到PMB |
| **链式更新** | 无 | Sprint→MSpec→TSpec | 更新传播机制 |

---

## 8. Git失败恢复策略

### 8.1 Git颗粒度设计

#### 分支层级

```
main (stable)
  │
  │ MSpec开始
  ├──────────> feat/mspec_<id>
  │              │
  │              │ Sprint开始
  │              │   ┌─ 判断复杂度
  │              │   ├─ 复杂 → sprint/<num> sub-branch
  │              │   └─ 简单 → 直接在feat上开发
  │              │
  │              │ Sprint完成 → commit (或merge sub-branch)
  │              │
  │              │ MSpec完成 → PR到main
  │              │
  │              │ 中间Tag（可选）
  │              └──────────> tag milestone/mspec_<id>
  │
  │ TSpec完成
  └─────────────────→ tag stable/tspec_<id> (必须)
```

#### 提交粒度

| 完成节点 | Git操作 | 说明 |
|---------|--------|------|
| AtomTask完成 | 不单独commit | 太细粒度，不作为commit单位 |
| Sprint完成 | commit | 一个Sprint的所有AtomTask作为一个atomic change |
| MSpec完成 | PR merge到main | 完整功能单元合并 |
| TSpec完成 | tag标记 | 里程碑标记，必须执行 |

#### Sprint复杂度判断机制

```typescript
/**
 * Sprint复杂度判断机制
 * 
 * Sprint执行前判断任务复杂程度：
 * - 复杂Sprint → 创建sub-branch sprint/<num>
 * - 简单Sprint → 直接开发，git commit控制回滚
 */

interface SprintComplexityAssessment {
  // 评估维度
  factors: {
    atomTaskCount: number;        // AtomTask数量
    estimatedTime: number;        // 预估时间（分钟）
    dependencyDepth: number;      // 依赖深度
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    crossModuleImpact: boolean;   // 是否跨模块影响
  };
  
  // 评分结果
  score: number;  // 1-10
  
  // 决策
  decision: 'SIMPLE' | 'COMPLEX';
  
  // 建议操作
  suggestedBranch: 'DIRECT' | 'SUB_BRANCH';
}

// 评分阈值配置
const COMPLEXITY_THRESHOLD = 7;  // score >= 7 视为复杂Sprint

function assessSprintComplexity(sprint: Sprint): SprintComplexityAssessment {
  const factors = {
    atomTaskCount: sprint.atomTasks.length,
    estimatedTime: sprint.estimatedDuration,
    dependencyDepth: calculateDependencyDepth(sprint),
    riskLevel: sprint.riskAssessment,
    crossModuleImpact: sprint.crossModule
  };
  
  // 计算评分（加权）
  const score = calculateScore(factors);
  
  const decision = score >= COMPLEXITY_THRESHOLD ? 'COMPLEX' : 'SIMPLE';
  const suggestedBranch = decision === 'COMPLEX' ? 'SUB_BRANCH' : 'DIRECT';
  
  return { factors, score, decision, suggestedBranch };
}

function calculateScore(factors: SprintFactors): number {
  // AtomTask数量评分 (权重: 30%)
  const taskScore = Math.min(factors.atomTaskCount / 10, 3) * 0.3;
  
  // 时间评分 (权重: 20%)
  const timeScore = Math.min(factors.estimatedTime / 120, 2) * 0.2;
  
  // 依赖深度评分 (权重: 20%)
  const depScore = Math.min(factors.dependencyDepth / 3, 2) * 0.2;
  
  // 风险评分 (权重: 15%)
  const riskScore = factors.riskLevel === 'HIGH' ? 1.5 : 
                    factors.riskLevel === 'MEDIUM' ? 1 : 0.5;
  
  // 跨模块评分 (权重: 15%)
  const crossScore = factors.crossModuleImpact ? 1.5 : 0;
  
  return taskScore + timeScore + depScore + riskScore + crossScore;
}
```

#### Scope约束机制

```yaml
# Scope约束配置
scope_constraints:
  # 拆解阈值
  decomposition:
    large_project_estimate: 1000 atom_tasks
    min_mspec_count: 20
    max_atom_tasks_per_mspec: 50
    max_sprints_per_mspec: 5
  
  # 验收点配置
  acceptance_gates:
    tspec_completion:
      required: tag stable/tspec_<id>
      optional: null
    
    mspec_completion:
      required: PR merge到main
      optional: tag milestone/mspec_<id>
    
    sprint_completion:
      required: git commit
      optional: null
```

### 8.2 失败恢复Git操作

#### 按失败级别设计恢复策略

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    失败恢复Git策略 - 按失败级别分层                              │
└─────────────────────────────────────────────────────────────────────────────┘

失败级别分层结构：
┌─────────────┐
│   AtomTask  │  ← 最细粒度，不触发Git操作
└─────────────┘
      │
      ▼
┌─────────────┐
│    Sprint   │  ← commit粒度，触发Git回滚
└─────────────┘
      │
      ▼
┌─────────────┐
│    MSpec    │  ← branch粒度，触发分支回退/删除
└─────────────┘
      │
      ▼
┌─────────────┐
│    TSpec    │  ← 最粗粒度，触发全量回退（极端情况）
└─────────────┘
```

#### AtomTask失败恢复

```typescript
/**
 * AtomTask失败恢复策略
 * 
 * Git操作：无（AtomTask失败不影响commit）
 */

interface AtomTaskRecoveryConfig {
  maxRetry: 3;  // 最大重试次数
  
  // 重试间隔递增策略
  retryInterval: {
    first: 5000;   // 5秒
    second: 15000; // 15秒
    third: 30000;  // 30秒
  };
  
  // Git操作策略
  gitOperation: 'NONE';  // AtomTask失败不触发Git操作
}

interface AtomTaskFailureScenario {
  // 场景1：单次失败
  singleFailure: {
    action: 'RETRY';
    gitOp: 'NONE';
    logToPMB: false;
  };
  
  // 场景2：达到maxRetry后仍失败
  maxRetryFailure: {
    action: 'LOG_TO_PMB';
    pmbRecord: {
      type: 'ATOM_TASK_FAILURE';
      taskId: string;
      retryCount: number;
      errorDetails: string;
    };
    continueSprint: true;  // Sprint继续执行其他任务
    gitOp: 'NONE';
  };
}

// AtomTask失败恢复实现
function handleAtomTaskFailure(
  task: AtomTask,
  retryCount: number,
  config: AtomTaskRecoveryConfig
): RecoveryAction {
  if (retryCount < config.maxRetry) {
    // 未达maxRetry → 重试
    const interval = config.retryInterval[`step_${retryCount + 1}`];
    return {
      action: 'RETRY',
      delay: interval,
      gitOperation: null
    };
  } else {
    // 达到maxRetry → 记录PMB，继续Sprint
    return {
      action: 'LOG_AND_CONTINUE',
      pmbRecord: {
        type: 'ATOM_TASK_FAILURE',
        taskId: task.id,
        retryCount: retryCount,
        errorDetails: task.lastError
      },
      gitOperation: null
    };
  }
}
```

#### Sprint失败恢复

```typescript
/**
 * Sprint失败恢复策略
 * 
 * 区分简单Sprint和复杂Sprint的恢复方式
 */

interface SprintRecoveryConfig {
  // 简单Sprint恢复策略
  simpleSprint: {
    uncommitted: 'NO_OP';              // 未commit → 无操作
    committed: 'SOFT_RESET';           // 已commit → soft reset
    severeFailure: 'HARD_RESET';       // 严重失败 → hard reset
  };
  
  // 复杂Sprint恢复策略
  complexSprint: {
    unmerged: 'RESET_OR_CONTINUE';     // sub-branch未merge → reset或继续
    merged: 'REVERT_OR_RESET_FEAT';    // sub-branch已merge → revert或reset feat
    totalFailure: 'DELETE_BRANCH';     // 彻底失败 → 删除sub-branch
  };
}

// Sprint失败恢复实现
function handleSprintFailure(
  sprint: Sprint,
  failureSeverity: 'MINOR' | 'MAJOR' | 'CRITICAL',
  branchType: 'SIMPLE' | 'COMPLEX',
  commitStatus: 'UNCOMMITTED' | 'COMMITTED' | 'MERGED'
): GitRecoveryAction {
  
  // 场景A：简单Sprint（无sub-branch）
  if (branchType === 'SIMPLE') {
    switch (commitStatus) {
      case 'UNCOMMITTED':
        // 情况1：未commit → 无操作（修改仍在工作区）
        return { gitOp: 'NO_OP', reason: '未commit，无回滚必要' };
      
      case 'COMMITTED':
        if (failureSeverity === 'MINOR') {
          // 情况2：已commit，轻微失败 → soft reset保留修改
          return { gitOp: 'SOFT_RESET', args: ['HEAD~1'], reason: '撤销commit，保留修改' };
        } else {
          // 情况3：严重失败 → hard reset丢弃修改
          return { gitOp: 'HARD_RESET', args: ['HEAD~1'], reason: '撤销commit，丢弃修改' };
        }
    }
  }
  
  // 场景B：复杂Sprint（有sub-branch sprint/<num>）
  if (branchType === 'COMPLEX') {
    switch (commitStatus) {
      case 'UNCOMMITTED':
        // 情况1：sub-branch未merge → reset或继续开发
        if (failureSeverity === 'MINOR') {
          return { gitOp: 'CONTINUE_DEV', reason: '轻微失败，继续sub-branch开发' };
        } else {
          return { gitOp: 'RESET_SUB_BRANCH', args: ['origin/feat/mspec_<id>'], reason: '回退sub-branch' };
        }
      
      case 'MERGED':
        // 情况2：sub-branch已merge → revert或reset feat分支
        if (failureSeverity === 'MINOR') {
          return { gitOp: 'REVERT', args: ['HEAD'], reason: 'revert merge commit' };
        } else {
          return { gitOp: 'RESET_FEAT', args: ['HEAD~1'], reason: 'reset feat分支到merge前' };
        }
      
      case 'TOTAL_FAILURE':
        // 情况3：彻底失败 → 删除分支
        return { gitOp: 'DELETE_BRANCH', args: [`sprint/${sprint.num}`], reason: '删除失败sub-branch' };
    }
  }
  
  return { gitOp: 'NO_OP', reason: '默认无操作' };
}
```

#### MSpec失败恢复

```typescript
/**
 * MSpec失败恢复策略
 * 
 * branch粒度，触发分支回退或删除
 */

interface MSpecRecoveryConfig {
  // 恢复策略类型
  strategies: {
    CONTINUE: 'feat分支继续开发';         // MSpec未完成，继续
    HARD_RESET: '回退到MSpec开始点';      // 严重失败需回退
    BRANCH_DELETE: '删除feat分支重新创建'; // 需要重新规划
  };
  
  // 严重失败判定条件
  severeFailureConditions: [
    'Sprint连续失败超过阈值',
    '对齐检查发现CRITICAL问题',
    'WBS与实现严重不匹配',
    '技术约束冲突无法解决'
  ];
}

interface MSpecFailureScenario {
  // 情况1：MSpec未完成 → feat分支继续开发
  incomplete: {
    action: 'CONTINUE';
    gitOp: 'NONE';
    logToPMB: true;
    pmbRecord: {
      type: 'MSPEC_PROGRESS_ISSUE';
      mspecId: string;
      currentSprint: number;
      totalSprints: number;
    };
  };
  
  // 情况2：严重失败需回退 → reset到MSpec开始点
  severeFailure: {
    action: 'HARD_RESET';
    gitOp: 'git reset --hard <base-commit>';
    baseCommit: 'feat/mspec_<id>创建时的commit';
    logToPMB: true;
  };
  
  // 情况3：需要重新规划 → 删除feat分支重新创建
  needReplanning: {
    action: 'BRANCH_DELETE_RECREATE';
    gitOps: [
      'git checkout main',
      'git branch -D feat/mspec_<id>',
      '重新创建feat/mspec_<id>'
    ];
    preserveArtifacts: true;  // 保留artifacts文件（.omt目录）
  };
}

// MSpec失败恢复实现
function handleMSpecFailure(
  mspec: MSpec,
  failureType: 'INCOMPLETE' | 'SEVERE' | 'REPLANNING',
  baseCommit: string
): GitRecoveryAction {
  switch (failureType) {
    case 'INCOMPLETE':
      // MSpec未完成 → 记录PMB，继续开发
      return {
        gitOp: 'NO_OP',
        pmbRecord: {
          type: 'MSPEC_PROGRESS_ISSUE',
          mspecId: mspec.id
        },
        reason: 'MSpec未完成，继续feat分支开发'
      };
    
    case 'SEVERE':
      // 严重失败 → hard reset回退
      return {
        gitOp: 'HARD_RESET',
        args: [baseCommit],
        reason: `回退到MSpec开始点: ${baseCommit}`
      };
    
    case 'REPLANNING':
      // 需重新规划 → 删除分支重新创建
      return {
        gitOp: 'BRANCH_DELETE_RECREATE',
        args: [`feat/${mspec.id}`],
        preserveArtifacts: true,
        reason: '删除feat分支，重新规划MSpec'
      };
  }
}
```

#### TSpec失败恢复（极端情况）

```typescript
/**
 * TSpec失败恢复策略（极端情况）
 * 
 * 最粗粒度，触发全量回退
 */

interface TSpecRecoveryConfig {
  // 恢复策略
  strategies: {
    PARTIAL: '保留通过的MSpec，调整失败的';  // 部分MSpec通过
    CLEAN_ALL: '清理所有feat分支';           // 全部失败
    FULL_RESTART: '删除.omt目录重新开始';    // 需要完全重新开始
  };
}

interface TSpecFailureScenario {
  // 情况1：部分MSpec通过 → 保留通过的，调整失败的
  partialFailure: {
    action: 'PARTIAL_KEEP';
    gitOps: [
      '保留: 已merge到main的MSpec',
      '调整: 失败MSpec的feat分支'
    ];
    preservePassedMSpecs: true;
  };
  
  // 情况2：全部失败 → 清理所有feat分支
  totalFailure: {
    action: 'CLEAN_ALL_FEAT';
    gitOps: [
      'git checkout main',
      'git branch -D feat/* (清理所有feat分支)'
    ];
    preserveArtifacts: true;  // 保留.omt目录artifacts
  };
  
  // 情况3：需要完全重新开始 → 删除.omt目录
  fullRestart: {
    action: 'DELETE_OMT_RESTART';
    gitOps: [
      'git checkout main',
      'git branch -D feat/*',
      'rm -rf .omt',
      '重新执行omt:init'
    ];
    preserveArtifacts: false;
  };
}

// TSpec失败恢复实现（需用户确认）
function handleTSpecFailure(
  tspec: TSpec,
  failureType: 'PARTIAL' | 'TOTAL' | 'FULL_RESTART',
  passedMSpecs: string[]
): GitRecoveryAction {
  // TSpec失败需要用户确认，不能自动执行
  
  const userConfirmation = requestUserConfirmation({
    type: 'TSPEC_FAILURE',
    severity: 'CRITICAL',
    options: [
      { key: 'PARTIAL', description: '保留通过的MSpec，调整失败的' },
      { key: 'TOTAL', description: '清理所有feat分支，保留.omt目录' },
      { key: 'FULL_RESTART', description: '删除.omt目录，完全重新开始' }
    ]
  });
  
  switch (failureType) {
    case 'PARTIAL':
      return {
        gitOp: 'PARTIAL_KEEP',
        preserveMSpecs: passedMSpecs,
        reason: `保留通过的MSpec: ${passedMSpecs.join(', ')}`
      };
    
    case 'TOTAL':
      return {
        gitOp: 'CLEAN_ALL_FEAT',
        preserveArtifacts: true,
        reason: '清理所有feat分支，保留.omt目录'
      };
    
    case 'FULL_RESTART':
      return {
        gitOp: 'DELETE_OMT_RESTART',
        preserveArtifacts: false,
        reason: '删除.omt目录，执行omt:init重新开始'
      };
  }
}
```

### 8.3 Git命令汇总表

| 失败级别 | 恢复场景 | Git操作 | 命令示例 |
|---------|---------|--------|---------|
| AtomTask | 达到maxRetry | 无操作，继续Sprint | `无` |
| AtomTask | 单次失败 | Retry（不涉及Git） | `无` |
| Sprint | 简单Sprint未commit | 无操作 | `无` |
| Sprint | 简单Sprint已commit（轻微） | `git reset --soft HEAD~1` | `git reset --soft HEAD~1` |
| Sprint | 简单Sprint已commit（严重） | `git reset --hard HEAD~1` | `git reset --hard HEAD~1` |
| Sprint | 复杂Sprint未merge（轻微） | 继续开发 | `无` |
| Sprint | 复杂Sprint未merge（严重） | `git reset` | `git reset origin/feat/mspec_<id>` |
| Sprint | 复杂Sprint已merge（轻微） | `git revert` | `git revert HEAD` |
| Sprint | 复杂Sprint已merge（严重） | `git reset feat` | `git reset --hard HEAD~1` |
| Sprint | Sprint彻底失败 | `git branch -D sprint/<num>` | `git branch -D sprint/003` |
| MSpec | MSpec未完成 | 无操作，继续开发 | `无` |
| MSpec | MSpec严重失败 | `git reset --hard <base-commit>` | `git reset --hard abc123` |
| MSpec | MSpec重新规划 | `git branch -D feat/mspec_<id>` | `git branch -D feat/mspec_002` |
| TSpec | TSpec部分失败 | 保留passedMSpecs | `git branch -D feat/mspec_failed` |
| TSpec | TSpec全部失败 | `git checkout main + git branch -D feat/*` | `git branch -D feat/mspec_*` |
| TSpec | TSpec完全重置 | 删除.omt + 重新omt:init | `rm -rf .omt && omt:init` |

### 8.4 TypeScript接口定义

```typescript
/**
 * Git恢复策略完整配置
 */
interface GitRecoveryConfig {
  // Sprint复杂度判断阈值
  sprintComplexityThreshold: number;  // 评分>=7视为复杂
  
  // Scope约束阈值
  maxAtomTasksPerMSpec: number;       // 50
  maxSprintsPerMSpec: number;         // 5
  
  // AtomTask失败恢复
  atomTaskRecovery: {
    maxRetry: number;
    retryInterval: number[];
    gitOperation: 'NONE';
    logToPMB: boolean;
  };
  
  // Sprint失败恢复
  sprintRecovery: {
    // 简单Sprint策略
    simpleSprint: {
      uncommitted: 'NO_OP';
      committed: 'SOFT_RESET' | 'HARD_RESET';
    };
    
    // 复杂Sprint策略
    complexSprint: {
      unmerged: 'RESET_OR_CONTINUE';
      merged: 'REVERT' | 'RESET_FEAT';
      totalFailure: 'DELETE_BRANCH';
    };
  };
  
  // MSpec失败恢复
  mspecRecovery: {
    incomplete: 'CONTINUE';
    severeFailure: 'HARD_RESET';
    needReplanning: 'BRANCH_DELETE';
  };
  
  // TSpec失败恢复
  tspecRecovery: {
    partialFailure: 'PARTIAL_KEEP';
    totalFailure: 'CLEAN_ALL_FEAT';
    fullRestart: 'DELETE_OMT_RESTART';
  };
}

/**
 * Git分支策略配置
 */
interface GitBranchStrategy {
  // 分支命名规范
  branchNaming: {
    mspecBranch: string;    // feat/mspec_<id>
    sprintBranch: string;   // sprint/<num>
  };
  
  // Tag命名规范
  tagNaming: {
    mspecTag: string;       // milestone/mspec_<id> (可选)
    tspecTag: string;       // stable/tspec_<id> (必须)
  };
  
  // 合并策略
  mergeStrategy: {
    sprintToFeat: 'MERGE' | 'REBASE';
    featToMain: 'PR_MERGE' | 'DIRECT_MERGE';
  };
}

/**
 * Git恢复操作结果
 */
interface GitRecoveryAction {
  gitOp: GitOperationType;
  args?: string[];
  preserveArtifacts?: boolean;
  preserveMSpecs?: string[];
  pmbRecord?: PMBRecord;
  reason: string;
  requiresUserConfirmation?: boolean;
}

type GitOperationType = 
  | 'NO_OP'
  | 'SOFT_RESET'
  | 'HARD_RESET'
  | 'REVERT'
  | 'RESET_FEAT'
  | 'DELETE_BRANCH'
  | 'BRANCH_DELETE_RECREATE'
  | 'PARTIAL_KEEP'
  | 'CLEAN_ALL_FEAT'
  | 'DELETE_OMT_RESTART';

/**
 * Git恢复执行器
 */
interface GitRecoveryExecutor {
  // 执行Git恢复操作
  execute(action: GitRecoveryAction): Promise<GitRecoveryResult>;
  
  // 验证操作安全性
  validate(action: GitRecoveryAction): ValidationResult;
  
  // 生成Git命令
  generateCommand(action: GitRecoveryAction): string;
  
  // 记录恢复历史
  recordHistory(action: GitRecoveryAction, result: GitRecoveryResult): void;
}

interface GitRecoveryResult {
  success: boolean;
  commandExecuted: string;
  output: string;
  timestamp: Date;
  artifactsPreserved: boolean;
  branchesAffected: string[];
}

// 默认配置
const DEFAULT_GIT_RECOVERY_CONFIG: GitRecoveryConfig = {
  sprintComplexityThreshold: 7,
  maxAtomTasksPerMSpec: 50,
  maxSprintsPerMSpec: 5,
  
  atomTaskRecovery: {
    maxRetry: 3,
    retryInterval: [5000, 15000, 30000],
    gitOperation: 'NONE',
    logToPMB: true
  },
  
  sprintRecovery: {
    simpleSprint: {
      uncommitted: 'NO_OP',
      committed: 'SOFT_RESET'
    },
    complexSprint: {
      unmerged: 'RESET_OR_CONTINUE',
      merged: 'REVERT',
      totalFailure: 'DELETE_BRANCH'
    }
  },
  
  mspecRecovery: {
    incomplete: 'CONTINUE',
    severeFailure: 'HARD_RESET',
    needReplanning: 'BRANCH_DELETE'
  },
  
  tspecRecovery: {
    partialFailure: 'PARTIAL_KEEP',
    totalFailure: 'CLEAN_ALL_FEAT',
    fullRestart: 'DELETE_OMT_RESTART'
  }
};

// 默认分支策略
const DEFAULT_GIT_BRANCH_STRATEGY: GitBranchStrategy = {
  branchNaming: {
    mspecBranch: 'feat/mspec_<id>',
    sprintBranch: 'sprint/<num>'
  },
  
  tagNaming: {
    mspecTag: 'milestone/mspec_<id>',
    tspecTag: 'stable/tspec_<id>'
  },
  
  mergeStrategy: {
    sprintToFeat: 'MERGE',
    featToMain: 'PR_MERGE'
  }
};
```

### 8.5 ASCII流程图

#### 分支层级结构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Git分支层级结构                                              │
└─────────────────────────────────────────────────────────────────────────────┘

                              main (stable)
                                   │
                                   │
                                   │  omt:init完成
                                   │  Tag: stable/tspec_<id> (必须)
                                   │
                                   │  MSpec开始
                                   ├───────────────────────────┐
                                   │                           │
                                   ▼                           │
                          feat/mspec_001                       │
                                   │                           │
                                   │ Sprint开始                 │
                                   │                           │
                                   │  ┌─ 判断复杂度             │
                                   │  │                         │
                                   │  │  score >= 7             │
                                   │  ├─────────────────┐       │
                                   │  │                 │       │
                                   │  │                 ▼       │
                                   │  │          sprint/001     │
                                   │  │          (sub-branch)   │
                                   │  │                 │       │
                                   │  │                 │ 完成   │
                                   │  │                 │       │
                                   │  │                 │ merge  │
                                   │  │                 │       │
                                   │  │                 ▼       │
                                   │  │          ────────────────
                                   │  │                         │
                                   │  │  score < 7              │
                                   │  ├─────────────────────────│
                                   │  │                         │
                                   │  │  直接在feat上开发        │
                                   │  │                         │
                                   │  │  Sprint完成 → commit     │
                                   │  │                         │
                                   │  └─────────────────────────│
                                   │                           │
                                   │ MSpec完成                  │
                                   │                            │
                                   │ PR到main                   │
                                   │                            │
                                   │ Tag: milestone/mspec_001   │
                                   │ (可选)                      │
                                   │                            │
                                   ▼                            │
                              ───────────────────────────────    │
                                   │                            │
                                   │                            │
                                   │                            │
                                   ▼                            │
                          feat/mspec_002                       │
                                   │                            │
                                   │ ... 循环                    │
                                   │                            │
                                   ▼                            │
                              ───────────────────────────────    │
                                   │                            │
                                   │ TSpec完成                   │
                                   │                            │
                                   │ Tag: stable/tspec_<id>     │
                                   │ (必须)                      │
                                   │                            │
                                   ▼                            │
                              main (updated)                    │
```

#### Sprint复杂度判断流程图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Sprint复杂度判断流程                                          │
└─────────────────────────────────────────────────────────────────────────────┘

                              Sprint开始
                                   │
                                   │
                                   ▼
                        ┌──────────────────┐
                        │ 评估Sprint复杂度  │
                        │                  │
                        │ 评估维度:        │
                        │ - AtomTask数量   │
                        │ - 预估时间       │
                        │ - 依赖深度       │
                        │ - 风险等级       │
                        │ - 跨模块影响     │
                        └──────────────────┘
                                   │
                                   │
                                   ▼
                        ┌──────────────────┐
                        │   计算评分        │
                        │                  │
                        │ score = 加权计算  │
                        │ (1-10分制)       │
                        └──────────────────┘
                                   │
                                   │
                                   ▼
                              score >= 7 ?
                                   │
                                   │
                      ┌────────────┴────────────┐
                      │                         │
                      │ YES                     │ NO
                      │                         │
                      ▼                         ▼
            ┌─────────────────┐       ┌─────────────────┐
            │   COMPLEX       │       │   SIMPLE        │
            │                 │       │                 │
            │ 创建sub-branch  │       │ 直接在feat开发  │
            │ sprint/<num>    │       │                 │
            └─────────────────┘       └─────────────────┘
                      │                         │
                      │                         │
                      │                         │ Sprint完成
                      │                         │
                      │                         │ git commit
                      │                         │
                      │                         │
                      │                         ▼
                      │                   ────────────────
                      │                         │
                      │ Sprint完成              │
                      │                         │
                      │ merge到feat             │
                      │                         │
                      │                         │
                      ▼                         │
            ──────────────────                 │
                      │                         │
                      │                         │
                      │                         │
                      └─────────────────────────│
                                   │
                                   │
                                   ▼
                              继续下一个Sprint
```

#### 失败恢复决策流程图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    失败恢复决策流程                                              │
└─────────────────────────────────────────────────────────────────────────────┘

                              任务失败发生
                                   │
                                   │
                                   ▼
                        ┌──────────────────┐
                        │  判断失败级别     │
                        └──────────────────┘
                                   │
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          │                        │                        │
          ▼                        ▼                        ▼
   ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
   │  AtomTask   │          │   Sprint    │          │   MSpec     │
   │   失败      │          │    失败     │          │    失败     │
   └─────────────┘          └─────────────┘          └─────────────┘
          │                        │                        │
          │                        │                        │
          ▼                        ▼                        ▼
   ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
   │ 达到maxRetry?│         │ 判断分支类型 │          │ 判断失败类型 │
   └─────────────┘          └─────────────┘          └─────────────┘
          │                        │                        │
          │                        │                        │
   ┌──────┴──────┐          ┌──────┴──────┐          ┌──────┴──────┐
   │             │          │             │          │             │
   │ NO          │ YES      │ SIMPLE      │ COMPLEX  │ INCOMPLETE  │ SEVERE
   │             │          │             │          │             │
   ▼             ▼          ▼             ▼          ▼             ▼
┌───────┐   ┌───────┐    ┌───────┐   ┌───────┐  ┌───────┐   ┌───────┐
│ Retry │   │记录PMB│    │判断    │   │判断    │  │继续   │   │Reset  │
│       │   │继续   │    │commit │   │merge   │  │开发   │   │到开始 │
│       │   │Sprint │    │状态   │   │状态    │  │       │   │点     │
└───────┘   └───────┘    └───────┘   └───────┘  └───────┘   └───────┘
   │             │            │           │          │           │
   │             │            │           │          │           │
   │             │      ┌─────┴─────┐ ┌───┴────┐     │           │
   │             │      │           │ │        │     │           │
   │             │      │已commit?  │ │已merge?│     │           │
   │             │      └───┴───┴───┘ └──┴──┴───┘     │           │
   │             │          │           │            │           │
   │             │    ┌─────┴─────┐ ┌───┴────┐       │           │
   │             │    │NO  │YES   │ │NO│YES  │       │           │
   │             │    │    │      │ │  │     │       │           │
   │             │    ▼    ▼      │ ▼  ▼     │       │           │
   │             │  无操 soft/   │ 继 revert │       │           │
   │             │  作   hard   │ 续 或     │       │           │
   │             │  reset       │ 开 reset  │       │           │
   │             │              │ 发 feat   │       │           │
   │             │              │           │       │           │
   │             │              └───────────┘       │           │
   │             │                                  │           │
   │             │                                  │           │
   │             │                                  │           │
   └─────────────┴──────────────────────────────────┴───────────┘
                                   │
                                   │
                                   │ Git操作执行
                                   │
                                   │ PMB记录更新
                                   │
                                   │ 用户通知（如需）
                                   │
                                   ▼
                              恢复完成/继续执行


              ┌─────────────────────────────────────────────────┐
              │               TSpec失败（极端情况）               │
              └─────────────────────────────────────────────────┘
                                   │
                                   │
                                   ▼
                        ┌──────────────────┐
                        │  判断失败类型     │
                        └──────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
   ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
   │   PARTIAL   │          │   TOTAL     │          │ FULL_RESTART│
   │   失败      │          │    失败     │          │    重置     │
   └─────────────┘          └─────────────┘          └─────────────┘
          │                        │                        │
          │                        │                        │
          ▼                        ▼                        ▼
   ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
   │ 用户确认    │          │ 用户确认    │          │ 用户确认    │
   │             │          │             │          │             │
   │ 选项:       │          │ 选项:       │          │ 选项:       │
   │ - 保留passed│          │ - 清理feat* │          │ - 删除.omt  │
   │ - 调整failed│          │ - 保留.omt  │          │ - omt:init  │
   └─────────────┘          └─────────────┘          └─────────────┘
          │                        │                        │
          │                        │                        │
          ▼                        ▼                        ▼
   ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
   │ git branch  │          │ git checkout│          │ rm -rf .omt │
   │ -D failed   │          │ main        │          │             │
   │             │          │ git branch  │          │ omt:init    │
   │             │          │ -D feat/*   │          │             │
   └─────────────┘          └─────────────┘          └─────────────┘
          │                        │                        │
          │                        │                        │
          └────────────────────────┴────────────────────────┘
                                   │
                                   │
                                   ▼
                              恢复完成
```

---

## 9. 实现建议

### 9.1 优先级排序

| 优先级 | 实现项 | 依赖 | 建议文档 |
|--------|--------|------|---------|
| **P0** | CLARIFY Phase重命名 | 无 | 本文档 |
| **P0** | REVIEW Phase新增 | Sprint执行 | 本文档 |
| **P0** | ALIGN Phase新增 | Artifacts对齐机制 | 本文档 + 08_batch2_partC |
| **P1** | omt:tune COMMAND | 无 | 本文档 |
| **P1** | omt:*-new系列 | 无 | 本文档 |
| **P1** | omt:align/align-part | ArtifactsAligner | 本文档 + 08_batch2_partC |
| **P2** | 链式更新机制 | ALIGN Phase | 本文档 |
| **P2** | Artifacts完成度监测 | PhaseGuard | 本文档 |

### 9.2 建议后续文档编号

| 文档编号 | 内容 | 说明 |
|---------|------|------|
| **09_terminator_phase_refinement.md** | 本文档 | 状态机精细化分析 |
| **10_alignment_output_format.md** | alignment输出格式详细设计 | 扩展本文档Section 6 |
| **11_chain_update_mechanism.md** | 链式更新机制详细设计 | 扩展本文档Section 6.4 |
| **12_tune_command_design.md** | omt:tune详细设计 | 扩展本文档Section 4 |

---

**分析完成日期**: 2026-04-30
**下一步**: 根据优先级开始实现Phase更新和COMMAND新增