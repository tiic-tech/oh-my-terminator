# OMT自主创新设计蓝图 - Batch 2 Part D

**设计日期**: 2026-04-30
**涵盖章节**: Chapter 10-11
**设计目标**: Gap验收闭环 + 失败恢复 + Terminator托管 + 实现路线图

---

## Chapter 10: Gap验收闭环 + 失败恢复机制

### 10.1 Gap Analysis验收设计概览

OMT验收闭环是参考项目无法提供的核心能力。OpenSpec和Agency-Orchestrator都是一次性执行系统，执行结束即结束，无验收决策机制。OMT需要Gap Analysis验收决策来判断Sprint是否达到预期目标。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Gap验收闭环架构                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Sprint执行完成
    │
    ▼
omt:review (ReviewerAgent审查)
    │  输出: review.json
    │
    ▼
GapAnalyzer.analyze()
    │  输入: SprintResult + PMB + brain.json
    │  决策: ACCEPTED / NEW_MSPEC / FAILED
    │
    ├─────── ACCEPTED ──────────────┐
    │                              │
    │                              ▼
    │                         归档处理
    │                         - artifacts归档
    │                         - PMB记录完成
    │                         - brain.json更新
    │
    ├─────── NEW_MSPEC ────────────┐
    │                              │
    │                              ▼
    │                         MSpec调整
    │                         - 分析Gap原因
    │                         - 创建新MSpec或调整现有MSpec
    │                         - 重新触发Sprint循环
    │
    └─────── FAILED ──────────────┐
                                 │
                                 ▼
                            失败恢复
                            - PMB记录失败点
                            - 选择恢复策略
                            - Sprint.resume()
```

### 10.2 验收决策接口定义

```typescript
/**
 * Gap分析器 - Sprint验收决策引擎
 */
interface GapAnalyzer {
  analyze(sprintResult: SprintResult, pmb: PMB, brain: BrainJSON): GapDecision;
  
  // 三种验收条件检查
  checkAcceptance(sprintResult: SprintResult): boolean;
  checkMSpecAdjustment(sprintResult: SprintResult): boolean;
  checkFailure(sprintResult: SprintResult): boolean;
  
  // 验收依据分析
  evaluateReviewResult(review: ReviewJSON): ReviewScore;
  evaluateRepoHealth(brain: BrainJSON): HealthScore;
  evaluatePMBHistory(pmb: PMB): TrendScore;
}

/**
 * 验收决策枚举
 */
enum GapDecision {
  ACCEPTED,      // 验收通过，归档处理
  NEW_MSPEC,     // 需要MSpec调整，重新规划Sprint
  FAILED         // 执行失败，需要恢复重试
}

/**
 * Sprint执行结果
 */
interface SprintResult {
  sprintId: string;
  mspecId: string;
  tasks: TaskResult[];
  review: ReviewJSON;
  artifacts: ArtifactMap;
  duration: Duration;
  status: SprintStatus;
}

/**
 * 验收评分组合
 */
interface AcceptanceScore {
  reviewScore: number;      // 0-100
  healthScore: number;      // Repo健康度 0-100
  trendScore: number;       // PMB趋势评分 0-100
  composite: number;        // 加权综合评分
  
  thresholds: {
    accepted: 80;           // >=80 通过
    newMspec: 50;           // 50-80 需调整
    failed: 0;              // <50 失败
  };
}
```

### 10.3 验收决策逻辑

```typescript
/**
 * GapAnalyzer实现
 */
class GapAnalyzerImpl implements GapAnalyzer {
  
  analyze(sprintResult: SprintResult, pmb: PMB, brain: BrainJSON): GapDecision {
    const score = this.calculateCompositeScore(sprintResult, pmb, brain);
    
    // 决策逻辑
    if (score.composite >= score.thresholds.accepted) {
      return GapDecision.ACCEPTED;
    }
    
    if (score.composite >= score.thresholds.newMspec) {
      return GapDecision.NEW_MSPEC;
    }
    
    return GapDecision.FAILED;
  }
  
  calculateCompositeScore(sprintResult: SprintResult, pmb: PMB, brain: BrainJSON): AcceptanceScore {
    const reviewScore = this.evaluateReviewResult(sprintResult.review);
    const healthScore = this.evaluateRepoHealth(brain);
    const trendScore = this.evaluatePMBHistory(pmb);
    
    // 加权计算：Review占50%，Repo健康度30%，PMB趋势20%
    const composite = reviewScore * 0.5 + healthScore * 0.3 + trendScore * 0.2;
    
    return { reviewScore, healthScore, trendScore, composite, thresholds };
  }
  
  checkAcceptance(sprintResult: SprintResult): boolean {
    // 条件1: 所有任务执行成功
    const allTasksSuccess = sprintResult.tasks.every(t => t.status === 'completed');
    
    // 条件2: Review通过（无CRITICAL问题）
    const reviewPassed = sprintResult.review.criticalIssues.length === 0;
    
    // 条件3: artifacts生成正确
    const artifactsValid = this.validateArtifacts(sprintResult.artifacts);
    
    return allTasksSuccess && reviewPassed && artifactsValid;
  }
  
  checkMSpecAdjustment(sprintResult: SprintResult): boolean {
    // 条件1: 部分任务失败但可恢复
    const partialFailure = sprintResult.tasks.some(t => t.status === 'failed');
    
    // 条件2: Review发现设计问题（非执行问题）
    const designIssues = sprintResult.review.issues.some(i => i.type === 'design');
    
    // 条件3: MSpec目标与实际Gap较大
    const goalGap = this.calculateGoalGap(sprintResult);
    
    return partialFailure || designIssues || goalGap > 0.3;
  }
  
  checkFailure(sprintResult: SprintResult): boolean {
    // 条件1: 关键任务失败
    const criticalFailure = sprintResult.tasks.some(t => t.priority === 'critical' && t.status === 'failed');
    
    // 条件2: Review发现CRITICAL问题
    const reviewCritical = sprintResult.review.criticalIssues.length > 0;
    
    // 条件3: 执行超时或资源耗尽
    const resourceExhausted = sprintResult.status === 'timeout' || sprintResult.status === 'resource_exhausted';
    
    return criticalFailure || reviewCritical || resourceExhausted;
  }
}
```

### 10.4 失败恢复机制

OMT的失败恢复机制是参考项目无法提供的核心能力。OpenSpec失败后只能重新执行Change，Agency-Orchestrator只有内存级Retry。OMT需要PMB记录失败点并支持Sprint恢复。

```typescript
/**
 * PMB失败记录结构
 */
interface PMBFailureRecord {
  taskId: string;
  sprintId: string;
  errorType: ErrorType;
  errorMessage: string;
  errorContext: ErrorContext;
  retryCount: number;
  timestamp: Date;
}

enum ErrorType {
  TIMEOUT,          // 执行超时
  VALIDATION,       // 输入验证失败
  DEPENDENCY,       // 依赖未满足
  RESOURCE,         // 资源不足
  EXECUTION         // 执行错误
}

/**
 * 恢复策略配置
 */
interface RecoveryConfig {
  maxRetry: 3;
  timeoutMultiplier: 1.5;  // 每次重试timeout * 1.5
  backoffStrategy: 'exponential' | 'linear';
  dependenciesWaitTimeout: 300000;  // 等待依赖完成最大时间
}
```

### 10.5 恢复流程设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    失败恢复流程                                                │
└─────────────────────────────────────────────────────────────────────────────┘

Step 1: 定位失败点
    │  pmb.getFailedTasks(sprintId)
    │  输出: FailedTask列表
    │
    ▼
Step 2: 分析失败原因
    │  根据error.type分类:
    │  - TIMEOUT → 执行超时，需要增加timeout
    │  - VALIDATION → 输入验证失败，需要修复输入
    │  - DEPENDENCY → 依赖未完成，需要等待或重新排序
    │  - RESOURCE → 资源不足，需要等待释放
    │  - EXECUTION → 执行错误，需要检查代码/配置
    │
    ▼
Step 3: 选择恢复策略
    │  
    │  TIMEOUT策略:
    │  - timeout = originalTimeout * config.timeoutMultiplier
    │  - retryCount < maxRetry → 重试
    │  - retryCount >= maxRetry → 上报失败
    │  
    │  VALIDATION策略:
    │  - 分析输入错误
    │  - 修复输入数据
    │  - 重试执行
    │  
    │  DEPENDENCY策略:
    │  - 检查依赖任务状态
    │  - 依赖未完成 → 等待（最长waitTimeout）
    │  - 依赖失败 → 优先恢复依赖任务
    │  
    │  RESOURCE策略:
    │  - 等待资源释放
    │  - 或降低并发度
    │
    ▼
Step 4: 执行恢复
    │  SprintLoop.resume(failedTasks, recoveryStrategy)
    │  
    │  恢复执行:
    │  - 重新加载失败任务的Context
    │  - 应用恢复策略（timeout调整、输入修复等）
    │  - 执行任务
    │  - PMB实时更新状态
    │
    ▼
Step 5: 验证恢复结果
    │  检查恢复后的任务状态
    │  成功 → 继续Sprint
    │  失败 → 记录到PMB，尝试下一个恢复策略
```

### 10.6 恢复策略实现

```typescript
/**
 * FailureHandler - 失败恢复处理器
 */
class FailureHandler {
  
  recover(sprintId: string, pmb: PMB): RecoveryResult {
    const failedTasks = pmb.getFailedTasks(sprintId);
    const recoveryPlan = this.planRecovery(failedTasks);
    
    return this.executeRecovery(recoveryPlan);
  }
  
  planRecovery(failedTasks: PMBFailureRecord[]): RecoveryPlan {
    const strategies: RecoveryStrategy[] = [];
    
    for (const task of failedTasks) {
      switch (task.errorType) {
        case ErrorType.TIMEOUT:
          strategies.push(this.timeoutStrategy(task));
          break;
          
        case ErrorType.VALIDATION:
          strategies.push(this.validationStrategy(task));
          break;
          
        case ErrorType.DEPENDENCY:
          strategies.push(this.dependencyStrategy(task));
          break;
          
        case ErrorType.EXECUTION:
          strategies.push(this.executionStrategy(task));
          break;
          
        default:
          strategies.push(this.defaultStrategy(task));
      }
    }
    
    return { tasks: failedTasks, strategies, config };
  }
  
  timeoutStrategy(task: PMBFailureRecord): RecoveryStrategy {
    const newTimeout = task.originalTimeout * config.timeoutMultiplier;
    
    return {
      taskId: task.taskId,
      action: 'retry',
      params: { timeout: newTimeout },
      maxRetry: config.maxRetry - task.retryCount
    };
  }
  
  dependencyStrategy(task: PMBFailureRecord): RecoveryStrategy {
    // 优先恢复依赖任务
    const dependencies = task.errorContext.dependencies;
    
    return {
      taskId: task.taskId,
      action: 'wait_or_prioritize',
      params: {
        dependencies,
        waitTimeout: config.dependenciesWaitTimeout,
        prioritizeDependencies: true
      }
    };
  }
  
  executeRecovery(plan: RecoveryPlan): RecoveryResult {
    // 按依赖顺序排序恢复任务
    const orderedTasks = this.orderByDependencies(plan.tasks);
    
    for (const task of orderedTasks) {
      const strategy = plan.strategies.find(s => s.taskId === task.taskId);
      const result = this.applyStrategy(task, strategy);
      
      if (result.success) {
        pmb.markRecovered(task.taskId);
      } else {
        pmb.recordRetry(task.taskId, result.error);
      }
    }
    
    return this.summarizeRecovery(orderedTasks);
  }
}
```

---

## Chapter 11: Terminator托管模式 + 实现路线图

### 11.1 Terminator全自动设计概览

Terminator是OMT的核心托管模式，实现从brainstorm到验收的全自动化。参考项目无法提供此能力：OpenSpec需要手动触发每个Artifact，Agency-Orchestrator执行完Workflow即结束。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Terminator托管流程                                          │
└─────────────────────────────────────────────────────────────────────────────┘

用户输入: idea
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Terminator.start(idea)                                          │
│                                                                 │
│ Phase 1: 探索定义                                                │
│ ───────────────────────                                         │
│ omt:brainstorm ──→ omt:pitch ──→ omt:tspec ──→ omt:mspec       │
│     │                │            │            │                │
│     BSAgent         QAAgent     SpecAgent   MSpecGenerator     │
│                                                                 │
│ Phase 2: Sprint循环                                              │
│ ───────────────────────                                         │
│ while (WBS.remaining > 0):                                      │
│     omt:sprint ──→ omt:execute ──→ omt:review                  │
│         │            │              │                           │
│     SprintSelection  TaskRunner    ReviewerAgent               │
│                                                                 │
│ Phase 3: 验收决策                                                │
│ ───────────────────────                                         │
│ GapAnalyzer.analyze()                                           │
│     │                                                           │
│     ├─ ACCEPTED ──→ 归档，结束                                   │
│     ├─ NEW_MSPEC ──→ 调整，新Sprint循环                           │
│     └─ FAILED ──→ 恢复，重试                                     │
│                                                                 │
│ 暂停点监控                                                       │
│ ───────────────────────                                         │
│ if (CRITICAL_FAILURE): Terminator.pause(reason)                 │
│ if (USER_INTERVENTION): Terminator.pause(reason)                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2 Terminator接口设计

```typescript
/**
 * Terminator托管控制器
 */
interface Terminator {
  mode: TerminatorMode;
  
  // 核心操作
  start(idea: string): TerminatorSession;
  pause(reason: PauseReason): void;
  resume(): void;
  stop(): void;
  
  // 状态查询
  status(): TerminatorStatus;
  progress(): ProgressInfo;
  
  // 事件订阅
  on(event: TerminatorEvent, handler: EventHandler): void;
}

/**
 * 托管模式枚举
 */
enum TerminatorMode {
  AUTO,         // 全自动：无需用户干预，直到暂停点或完成
  SEMI_AUTO,    // 半自动：关键决策点需用户确认
  MANUAL        // 手动：每步执行需用户触发
}

/**
 * 暂停原因枚举
 */
enum PauseReason {
  CRITICAL_FAILURE,      // 关键任务失败，超过恢复阈值
  USER_INTERVENTION,     // 用户主动暂停
  RESOURCE_LIMIT,        // 资源达到限制（token、API调用等）
  QUALITY_GATE_FAILED,   // 质量门控失败
  DEPENDENCY_BLOCKED     // 依赖阻塞无法解决
}

/**
 * Terminator状态
 */
interface TerminatorStatus {
  sessionId: string;
  mode: TerminatorMode;
  phase: TerminatorPhase;
  state: 'running' | 'paused' | 'stopped' | 'completed';
  
  currentSprint: string | null;
  completedSprints: string[];
  failedTasks: string[];
  
  startTime: Date;
  lastUpdate: Date;
  estimatedCompletion: Date | null;
}

enum TerminatorPhase {
  BRAINSTORM,
  PITCH,
  TSPEC,
  MSPEC,
  SPRINT_LOOP,
  GAP_ANALYSIS,
  ARCHIVE
}
```

### 11.3 实现优先级路线图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OMT实现路线图                                                │
└─────────────────────────────────────────────────────────────────────────────┘

Phase 1 (P0 - 核心能力) ──────────────────────────────────────────────────────
│
│ I1: grasp repo建模 + brain.json
│     ── Repo状态抽象 + 健康度追踪
│     ── 关键文件: .omt/brain.json
│     ── 实现: GraspRepoAnalyzer
│
│ I2: PMB持久化
│     ── Sprint历史记录 + 失败追踪
│     ── 关键文件: .omt/pmb.yaml
│     ── 实现: PMBManager
│
│ I3: Agent生命周期
│     ── spawn → monitor → 销毁
│     ── 关键文件: .omt/agents/*.md
│     ── 实现: AgentRegistry + AgentLifecycleManager
│
│ I6: 四层artifacts对齐
│     ── TSpec→MSpec→Sprint→AtomTask一致性
│     ── 关键文件: .omt/artifacts/
│     ── 实现: ArtifactsAlignmentValidator
│
│ I7: 自动WBS分解
│     ── MSpec → AtomTask DAG
│     ── 关键文件: .omt/wbs/
│     ── 实现: WBSDecomposer
│
│ I8: Sprint循环
│     ── Sprint Selection + Execution + Review循环
│     ── 关键文件: .omt/sprints/
│     ── 实现: SprintLoop
│
│ I9: Gap验收闭环
│     ── ACCEPTED/NEW_MSPEC/FAILED决策
│     ── 关键文件: .omt/gap/
│     ── 实现: GapAnalyzer
│
Phase 2 (P1 - 增强能力) ──────────────────────────────────────────────────────
│
│ I5: Context动态组装
│     ── MSpec Design + Dependencies + Brain + PMB
│     ── 关键文件: .omt/context/
│     ── 实现: ContextAssembler
│
│ I10: 失败恢复
│     ── PMB失败记录 + Sprint恢复
│     ── 关键文件: .omt/recovery/
│     ── 实现: FailureHandler
│
Phase 3 (P2 - 托管模式) ──────────────────────────────────────────────────────
│
│ I11: Terminator全自动
│     ── 全自动托管 + 暂停/恢复
│     ── 关键文件: .omt/terminator.yaml
│     ── 实现: TerminatorController
```

### 11.4 架构分层图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Terminator四层架构                                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 4: 验收托管层 (I10-I11)                                                  │
│ ─────────────────────────────────────────────                                │
│                                                                             │
│   ┌─────────────────┐     ┌─────────────────┐                              │
│   │ FailureHandler  │────→│ TerminatorCtrl  │                              │
│   │ (失败恢复)       │     │ (托管模式)       │                              │
│   └─────────────────┘     └─────────────────┘                              │
│                                                                             │
│   职责: 失败恢复、暂停/恢复、全自动托管                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 3: 执行引擎层 (I6-I9)                                                   │
│ ─────────────────────────────────────────────                                │
│                                                                             │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│   │Artifacts    │ │    WBS      │ │  SprintLoop │ │ GapAnalyzer │          │
│   │Aligner      │ │ Decomposer  │ │             │ │             │          │
│   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘          │
│                                                                             │
│   职责: artifacts对齐、任务分解、Sprint循环、验收决策                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 2: 生命周期层 (I3-I5)                                                   │
│ ─────────────────────────────────────────────                                │
│                                                                             │
│   ┌─────────────────┐     ┌─────────────────┐                              │
│   │ AgentLifecycle  │────→│ ContextAssembler│                              │
│   │ Manager         │     │                 │                              │
│   └─────────────────┘     └─────────────────┘                              │
│                                                                             │
│   职责: Agent生命周期管理、Context动态组装                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 1: 基础建模层 (I1-I2)                                                   │
│ ─────────────────────────────────────────────                                │
│                                                                             │
│   ┌─────────────────┐     ┌─────────────────┐                              │
│   │ GraspRepo       │────→│ PMBManager      │                              │
│   │ Analyzer        │     │                 │                              │
│   └─────────────────┘     └─────────────────┘                              │
│                                                                             │
│   输出: brain.json (Repo状态) + pmb.yaml (Sprint历史)                          │
│   职责: Repo建模、状态持久化                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.5 托管流程ASCII图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Terminator全自动托管流程                                    │
└─────────────────────────────────────────────────────────────────────────────┘

用户输入: idea = "实现用户认证系统"
    │
    ▼
Terminator.start(idea) [mode=AUTO]
    │
    │  ┌─────────────────────────────────────────────────────────────────────┐
    │  │ Phase 1: 探索定义                                                     │
    │  │ ───────────────────────────────────────────────────────────────────│
    │  │                                                                     │
    │  │ omt:brainstorm ──→ BSAgent发散探索                                  │
    │  │     │                 输出: brainstorm.json                         │
    │  │     │                                                               │
    │  │     ▼                                                               │
    │  │ omt:pitch ──→ QAAgent迭代问答                                       │
    │  │     │              输出: pitch.json                                 │
    │  │     │                                                               │
    │  │     ▼                                                               │
    │  │ omt:tspec ──→ SpecAgent生成                                         │
    │  │     │             输出: tspec/                                      │
    │  │     │                                                               │
    │  │     ▼                                                               │
    │  │ omt:mspec ──→ MSpecGenerator批量创建                                │
    │  │     │            + WBSDecomposer自动分解                            │
    │  │     │              输出: mspecs/ + wbs.yaml                         │
    │  │     │                                                               │
    │  └─────────────────────────────────────────────────────────────────────┘
    │
    │  ┌─────────────────────────────────────────────────────────────────────┐
    │  │ Phase 2: Sprint循环                                                   │
    │  │ ───────────────────────────────────────────────────────────────────│
    │  │                                                                     │
    │  │ while (WBS.remaining > 0):                                          │
    │  │     │                                                               │
    │  │     SprintSelection ──→ 选择下一个Sprint任务集                       │
    │  │         │                 输出: sprint.yaml                         │
    │  │         │                                                           │
    │  │         ▼                                                           │
    │  │     TaskRunner ──→ DAG Executor并行执行                             │
    │  │         │            + PMB实时更新                                  │
    │  │         │              输出: task_results/                          │
    │  │         │                                                           │
    │  │         ▼                                                           │
    │  │     ReviewerAgent ──→ 审查Sprint产出                                │
    │  │         │               输出: review.json                           │
    │  │         │                                                           │
    │  │         ▼                                                           │
    │  │     PMB更新 ──→ 记录Sprint完成                                       │
    │  │                                                                     │
    │  │ [循环继续直到WBS完成]                                                │
    │  │                                                                     │
    │  └─────────────────────────────────────────────────────────────────────┘
    │
    │  ┌─────────────────────────────────────────────────────────────────────┐
    │  │ Phase 3: 验收决策                                                     │
    │  │ ───────────────────────────────────────────────────────────────────│
    │  │                                                                     │
    │  │ GapAnalyzer.analyze()                                               │
    │  │     │                                                               │
    │  │     ├─ ACCEPTED ──→ 归档artifacts                                   │
    │  │     │                 brain.json更新                               │
    │  │     │                 PMB记录完成                                   │
    │  │     │                 Terminator状态: completed                    │
    │  │     │                                                               │
    │  │     ├─ NEW_MSPEC ──→ MSpec调整                                      │
    │  │     │                  新Sprint循环                                │
    │  │     │                                                               │
    │  │     └─ FAILED ──→ FailureHandler恢复                                │
    │  │                    Sprint.resume()                                 │
    │  │                    继续循环                                         │
    │  │                                                                     │
    │  └─────────────────────────────────────────────────────────────────────┘
    │
    │  ┌─────────────────────────────────────────────────────────────────────┐
    │  │ 暂停点监控                                                            │
    │  │ ───────────────────────────────────────────────────────────────────│
    │  │                                                                     │
    │  │ if (CRITICAL_FAILURE && retry > maxRetry):                         │
    │  │     Terminator.pause(CRITICAL_FAILURE)                             │
    │  │     等待用户决策                                                     │
    │  │                                                                     │
    │  │ if (USER_INTERVENTION):                                             │
    │  │     Terminator.pause(USER_INTERVENTION)                            │
    │  │     等待用户resume()                                                │
    │  │                                                                     │
    │  │ if (RESOURCE_LIMIT):                                                │
    │  │     Terminator.pause(RESOURCE_LIMIT)                               │
    │  │     等待资源释放后自动resume                                         │
    │  │                                                                     │
    │  └─────────────────────────────────────────────────────────────────────┘
    │
    ▼
Terminator状态: completed
    │
    输出: 完整的用户认证系统
          - artifacts归档
          - brain.json更新Repo状态
          - PMB记录完整Sprint历史
```

---

**设计完成日期**: 2026-04-30
**Part D字数统计**: ~250行
**下一步**: 根据路线图开始Phase 1实现