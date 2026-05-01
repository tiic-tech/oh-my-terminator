# OMT链式更新机制设计

**设计日期**: 2026-05-01
**设计目标**: 定义Sprint→MSpec→TSpec链式更新传播机制，实现跨层级变更协调
**扩展来源**: 
- `09_terminator_phase_refinement.md` Section 6.4 (链式更新基础设计)
- `10_git_scope_strategy.md` Git策略参考

---

## 1. 链式更新概述

### 1.1 核心原理

链式更新机制解决OMT四层架构（TSpec→MSpec→Sprint→AtomTask）的跨层级变更传播问题：

```
┌─────────────────────────────────────────────────────────────┐
│                    链式更新传播原理                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  UPWARD方向 (底层向上层):                                    │
│  Sprint变更 → 触发MSpec更新 → 触发TSpec更新                  │
│  [场景: 实现中发现设计问题，需要向上反馈修正]                 │
│                                                             │
│  DOWNWARD方向 (上层向下层):                                  │
│  TSpec变更 → 触发MSpec更新 → 触发Sprint更新                  │
│  [场景: 技术约束变更，需要向下传播到执行层]                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 更新方向定义

| 方向 | 英文 | 触发场景 | 传播路径 | 典型用例 |
|-----|------|---------|---------|---------|
| **向上更新** | UPWARD | Sprint执行发现差异 | Sprint→MSpec→TSpec | 实现发现架构约束不合理 |
| **向下更新** | DOWNWARD | TSpec手动修改 | TSpec→MSpec→Sprint | 技术栈变更决策 |

### 1.3 设计约束

```typescript
/**
 * 链式更新约束原则
 */
const ChainUpdateConstraints = {
  // 单向传播约束
  propagationRule: '单向传播，不允许双向同时更新',
  
  // 依赖顺序约束
  dependencyRule: '上层artifacts更新必须等待下层依赖完成',
  
  // 回滚一致性约束
  rollbackRule: '链式更新失败必须回滚整个链，不允许部分成功',
  
  // 用户确认约束
  confirmationRule: '链式更新必须获得用户确认后方可执行',
  
  // 记录完整性约束
  recordRule: '每个链式更新必须记录到.alignment/目录'
};
```

---

## 2. ChainUpdateProposal详细结构

### 2.1 核心接口定义

```typescript
/**
 * 链式更新提案
 * 
 * 描述一次完整的跨层级更新请求
 */
interface ChainUpdateProposal {
  // 提案唯一标识
  proposal_id: string;
  
  // 更新方向
  direction: ChainUpdateDirection;
  
  // 触发来源（对齐发现ID或用户手动触发）
  trigger_source: {
    type: 'ALIGNMENT_FINDING' | 'USER_MANUAL' | 'SYSTEM_TRIGGER';
    finding_id?: string;  // 对齐发现ID（ALIGNMENT_FINDING类型）
    user_reason?: string; // 用户触发原因（USER_MANUAL类型）
    system_event?: string; // 系统事件（SYSTEM_TRIGGER类型）
  };
  
  // 更新链步骤列表
  update_chain: ChainUpdateStep[];
  
  // 估算影响
  estimated_impact: ImpactEstimation;
  
  // 用户决策状态
  user_decision: DecisionState;
  
  // 执行时间戳
  timestamps: {
    created_at: Date;
    confirmed_at?: Date;
    executed_at?: Date;
    completed_at?: Date;
  };
}

/**
 * 更新方向枚举
 */
enum ChainUpdateDirection {
  UPWARD = 'UPWARD',    // Sprint→MSpec→TSpec
  DOWNWARD = 'DOWNWARD' // TSpec→MSpec→Sprint
}

/**
 * 用户决策状态
 */
enum DecisionState {
  PENDING = 'PENDING',    // 等待用户确认
  ACCEPTED = 'ACCEPTED',  // 用户已接受
  REJECTED = 'REJECTED',  // 用户已拒绝
  AUTO_ACCEPTED = 'AUTO_ACCEPTED' // 自动模式自动接受
}
```

### 2.2 更新链步骤定义

```typescript
/**
 * 更新链步骤
 */
interface ChainUpdateStep {
  // 步骤序号
  step: number;
  
  // 目标artifact路径
  artifact: {
    type: 'TSpec' | 'MSpec' | 'Sprint';
    path: string;  // 相对路径，如 'tspec_001/design.md'
    id: string;    // artifact ID，如 'tspec_001'
  };
  
  // 操作类型
  action: ChainUpdateAction;
  
  // 步骤描述
  description: string;
  
  // 更新内容预览（可选）
  update_preview?: UpdatePreview;
  
  // 依赖步骤（必须先完成的步骤）
  depends_on_steps: number[];
  
  // 步骤状态
  status: StepStatus;
  
  // 执行结果（执行后填充）
  execution_result?: StepExecutionResult;
}

/**
 * 操作类型枚举
 */
enum ChainUpdateAction {
  UPDATE = 'UPDATE',    // 更新现有内容
  CONFIRM = 'CONFIRM',  // 确认变更（仅标记确认）
  CREATE = 'CREATE',    // 创建新artifact
  DELETE = 'DELETE'     // 删除artifact
}

/**
 * 步骤状态枚举
 */
enum StepStatus {
  PENDING = 'PENDING',      // 等待执行
  WAITING_DEPS = 'WAITING_DEPS', // 等待依赖步骤完成
  IN_PROGRESS = 'IN_PROGRESS',   // 正在执行
  COMPLETED = 'COMPLETED',       // 已完成
  FAILED = 'FAILED',             // 执行失败
  SKIPPED = 'SKIPPED'            // 已跳过
}

/**
 * 更新内容预览
 */
interface UpdatePreview {
  // 更新前内容摘要
  before: {
    summary: string;
    key_changes: string[];  // 关键字段列表
  };
  
  // 更新后内容摘要
  after: {
    summary: string;
    key_changes: string[];  // 关键字段列表
  };
  
  // diff预览（可选）
  diff_preview?: string;
}

/**
 * 步骤执行结果
 */
interface StepExecutionResult {
  success: boolean;
  error_message?: string;
  git_commit_sha?: string;  // Git提交SHA（如果有Git操作）
  modified_files?: string[]; // 修改的文件列表
  execution_time_ms: number; // 执行耗时
}
```

### 2.3 影响估算定义

```typescript
/**
 * 影响估算
 */
interface ImpactEstimation {
  // 涉及artifact数量
  artifacts_count: number;
  
  // 预估执行时间（分钟）
  estimated_time_minutes: number;
  
  // 风险等级
  risk_level: RiskLevel;
  
  // 风险因素列表
  risk_factors: RiskFactor[];
  
  // 相关Agent影响
  agent_impact: {
    affected_agents: string[];  // 受影响的Agent列表
    blocking_agents: string[];  // 阻塞的Agent列表
  };
}

/**
 * 风险等级枚举
 */
enum RiskLevel {
  LOW = 'LOW',      // 低风险：单文件更新，无依赖
  MEDIUM = 'MEDIUM', // 中风险：多文件更新，简单依赖
  HIGH = 'HIGH'     // 高风险：跨MSpec更新，复杂依赖
}

/**
 * 风险因素
 */
interface RiskFactor {
  factor_id: string;
  description: string;
  severity: 'MINOR' | 'MODERATE' | 'MAJOR';
  mitigation?: string;  // 缓解措施
}
```

---

## 3. 更新链执行流程

### 3.1 UPWARD模式执行流程

```
┌─────────────────────────────────────────────────────────────┐
│              UPWARD更新执行流程 (Sprint→MSpec→TSpec)         │
└─────────────────────────────────────────────────────────────┘

  触发点: Sprint执行中发现对齐问题
          │
          ▼
  ┌──────────────────┐
  │ 生成ChainProposal │
  │ direction: UPWARD │
  └────────────┬─────┘
               │
               ▼
  ┌──────────────────┐
  │ 用户确认阶段      │
  │ - 展示更新预览    │
  │ - 估算风险        │
  │ - 等待决策        │
  └────────────┬─────┘
               │
       ┌───────┴───────┐
       │               │
  ┌────▼────┐    ┌─────▼─────┐
  │ ACCEPTED │    │ REJECTED  │
  └────┬────┘    └─────┬─────┘
       │               │
       ▼               ▼
  ┌──────────────┐  ┌──────────────┐
  │ 执行Step 1   │  │ 记录拒绝状态 │
  │ Sprint更新   │  │ 结束         │
  └───────┬──────┘  └──────────────┘
          │
          ▼
  ┌──────────────┐
  │ 执行Step 2   │
  │ MSpec更新    │
  │ (依赖Step 1) │
  └───────┬──────┘
          │
          ▼
  ┌──────────────┐
  │ 执行Step 3   │
  │ TSpec更新    │
  │ (依赖Step 2) │
  └───────┬──────┘
          │
          ▼
  ┌──────────────────┐
  │ Git提交链        │
  │ - Sprint commit  │
  │ - MSpec commit   │
  │ - TSpec commit   │
  └───────┬──────────┘
          │
          ▼
  ┌──────────────────┐
  │ 记录到.alignment/│
  │ chain_update_*.yaml│
  └──────────────────┘
```

### 3.2 DOWNWARD模式执行流程

```
┌─────────────────────────────────────────────────────────────┐
│             DOWNWARD更新执行流程 (TSpec→MSpec→Sprint)        │
└─────────────────────────────────────────────────────────────┘

  触发点: 用户手动修改TSpec技术约束
          │
          ▼
  ┌──────────────────┐
  │ 检测TSpec变更     │
  │ 触发DOWNWARD链    │
  └────────────┬─────┘
               │
               ▼
  ┌──────────────────┐
  │ 分析影响范围      │
  │ - 受影响MSpec    │
  │ - 受影响Sprint   │
  └────────────┬─────┘
               │
               ▼
  ┌──────────────────┐
  │ 生成ChainProposal │
  │ direction:DOWNWARD│
  └────────────┬─────┘
               │
               ▼
  ┌──────────────────┐
  │ 用户确认          │
  │ (展示影响范围)    │
  └───────┬──────────┘
          │
          ▼
  ┌──────────────┐
  │ 执行Step 1   │
  │ TSpec确认    │
  │ (CONFIRM)    │
  └───────┬──────┘
          │
          ▼
  ┌──────────────┐
  │ 执行Step 2   │
  │ MSpec_001更新│
  │ (依赖Step 1) │
  └───────┬──────┘
          │
          ▼
  ┌──────────────┐
  │ 执行Step 3   │
  │ MSpec_002更新│
  │ (依赖Step 1) │
  │ (与Step 2并行)│
  └───────┬──────┘
          │
          ▼
  ┌──────────────┐
  │ 执行Step 4   │
  │ Sprint更新   │
  │ (依赖Step 2,3)│
  └───────┬──────┘
          │
          ▼
  ┌──────────────────┐
  │ Git提交链        │
  └──────────────────┘
```

---

## 4. 依赖解析算法

### 4.1 拓扑排序实现

```typescript
/**
 * 依赖解析器
 * 
 * 将更新链步骤按依赖关系排序为可执行顺序
 */
class DependencyResolver {
  
  /**
   * 拓扑排序
   * 
   * 输入: ChainUpdateStep列表
   * 输出: 按依赖关系排序的可执行步骤序列
   */
  resolveExecutionOrder(steps: ChainUpdateStep[]): ExecutionPlan {
    // 1. 构建依赖图
    const dependencyGraph = this.buildDependencyGraph(steps);
    
    // 2. 检测循环依赖
    if (this.hasCircularDependency(dependencyGraph)) {
      throw new ChainUpdateError('Circular dependency detected in update chain');
    }
    
    // 3. 计算拓扑排序
    const sortedSteps = this.topologicalSort(dependencyGraph);
    
    // 4. 分组可并行步骤
    const executionGroups = this.groupParallelSteps(sortedSteps);
    
    return {
      execution_order: sortedSteps,
      parallel_groups: executionGroups,
      total_steps: steps.length
    };
  }
  
  /**
   * 构建依赖图
   */
  private buildDependencyGraph(steps: ChainUpdateStep[]): DependencyGraph {
    const graph: DependencyGraph = {
      nodes: new Map(),
      edges: []
    };
    
    for (const step of steps) {
      graph.nodes.set(step.step, step);
      
      for (const depStep of step.depends_on_steps) {
        graph.edges.push({
          from: depStep,
          to: step.step
        });
      }
    }
    
    return graph;
  }
  
  /**
   * 检测循环依赖
   */
  private hasCircularDependency(graph: DependencyGraph): boolean {
    const visited = new Set<number>();
    const recursionStack = new Set<number>();
    
    for (const [nodeId] of graph.nodes) {
      if (this.detectCycleDFS(nodeId, graph, visited, recursionStack)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * DFS检测循环
   */
  private detectCycleDFS(
    nodeId: number,
    graph: DependencyGraph,
    visited: Set<number>,
    recursionStack: Set<number>
  ): boolean {
    if (recursionStack.has(nodeId)) {
      return true;  // 发现循环
    }
    
    if (visited.has(nodeId)) {
      return false; // 已访问过，无循环
    }
    
    visited.add(nodeId);
    recursionStack.add(nodeId);
    
    // 查找所有依赖当前节点的边
    const outgoingEdges = graph.edges.filter(e => e.from === nodeId);
    
    for (const edge of outgoingEdges) {
      if (this.detectCycleDFS(edge.to, graph, visited, recursionStack)) {
        return true;
      }
    }
    
    recursionStack.delete(nodeId);
    return false;
  }
  
  /**
   * Kahn算法拓扑排序
   */
  private topologicalSort(graph: DependencyGraph): ChainUpdateStep[] {
    const inDegree = new Map<number, number>();
    const queue: number[] = [];
    const result: ChainUpdateStep[] = [];
    
    // 计算入度
    for (const [nodeId] of graph.nodes) {
      inDegree.set(nodeId, 0);
    }
    
    for (const edge of graph.edges) {
      const current = inDegree.get(edge.to) || 0;
      inDegree.set(edge.to, current + 1);
    }
    
    // 入度为0的节点入队
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }
    
    // Kahn算法处理
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(graph.nodes.get(nodeId)!);
      
      // 减少依赖节点的入度
      const outgoingEdges = graph.edges.filter(e => e.from === nodeId);
      for (const edge of outgoingEdges) {
        const newDegree = inDegree.get(edge.to)! - 1;
        inDegree.set(edge.to, newDegree);
        
        if (newDegree === 0) {
          queue.push(edge.to);
        }
      }
    }
    
    return result;
  }
  
  /**
   * 分组可并行步骤
   */
  private groupParallelSteps(sortedSteps: ChainUpdateStep[]): ExecutionGroup[] {
    const groups: ExecutionGroup[] = [];
    const completedSteps = new Set<number>();
    
    let currentGroup: ExecutionGroup = {
      group_id: 0,
      steps: [],
      can_execute_parallel: true
    };
    
    for (const step of sortedSteps) {
      // 检查依赖是否全部完成
      const depsCompleted = step.depends_on_steps.every(dep => completedSteps.has(dep));
      
      if (depsCompleted) {
        // 可以与当前组并行执行
        currentGroup.steps.push(step);
      } else {
        // 需要等待，当前组结束，开始新组
        if (currentGroup.steps.length > 0) {
          groups.push(currentGroup);
          // 标记当前组步骤为完成
          for (const s of currentGroup.steps) {
            completedSteps.add(s.step);
          }
        }
        
        currentGroup = {
          group_id: groups.length,
          steps: [step],
          can_execute_parallel: false
        };
      }
    }
    
    if (currentGroup.steps.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  }
}

/**
 * 依赖图结构
 */
interface DependencyGraph {
  nodes: Map<number, ChainUpdateStep>;
  edges: DependencyEdge[];
}

interface DependencyEdge {
  from: number;  // 依赖的步骤
  to: number;    // 被依赖的步骤
}

/**
 * 执行计划
 */
interface ExecutionPlan {
  execution_order: ChainUpdateStep[];
  parallel_groups: ExecutionGroup[];
  total_steps: number;
}

interface ExecutionGroup {
  group_id: number;
  steps: ChainUpdateStep[];
  can_execute_parallel: boolean;
}
```

### 4.2 并行执行策略

```typescript
/**
 * 并行执行器
 */
class ParallelExecutor {
  
  /**
   * 执行并行组
   */
  async executeParallelGroup(
    group: ExecutionGroup,
    proposal: ChainUpdateProposal
  ): Promise<ParallelGroupResult> {
    if (group.can_execute_parallel && group.steps.length > 1) {
      // 并行执行
      const promises = group.steps.map(step => 
        this.executeStep(step, proposal)
      );
      
      const results = await Promise.all(promises);
      
      return {
        group_id: group.group_id,
        parallel: true,
        results: results,
        all_success: results.every(r => r.success)
      };
    } else {
      // 串行执行
      const results: StepExecutionResult[] = [];
      
      for (const step of group.steps) {
        const result = await this.executeStep(step, proposal);
        results.push(result);
        
        if (!result.success) {
          // 失败时停止后续步骤
          break;
        }
      }
      
      return {
        group_id: group.group_id,
        parallel: false,
        results: results,
        all_success: results.every(r => r.success)
      };
    }
  }
  
  /**
   * 执行单个步骤
   */
  private async executeStep(
    step: ChainUpdateStep,
    proposal: ChainUpdateProposal
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();
    
    try {
      step.status = StepStatus.IN_PROGRESS;
      
      // 根据action类型执行
      let result: boolean;
      
      switch (step.action) {
        case ChainUpdateAction.UPDATE:
          result = await this.executeUpdate(step);
          break;
        case ChainUpdateAction.CONFIRM:
          result = await this.executeConfirm(step);
          break;
        case ChainUpdateAction.CREATE:
          result = await this.executeCreate(step);
          break;
        case ChainUpdateAction.DELETE:
          result = await this.executeDelete(step);
          break;
        default:
          throw new Error(`Unknown action: ${step.action}`);
      }
      
      step.status = result ? StepStatus.COMPLETED : StepStatus.FAILED;
      
      return {
        success: result,
        execution_time_ms: Date.now() - startTime
      };
    } catch (error) {
      step.status = StepStatus.FAILED;
      
      return {
        success: false,
        error_message: error.message,
        execution_time_ms: Date.now() - startTime
      };
    }
  }
}

interface ParallelGroupResult {
  group_id: number;
  parallel: boolean;
  results: StepExecutionResult[];
  all_success: boolean;
}
```

---

## 5. 用户决策模式

### 5.1 决策模式定义

```typescript
/**
 * 用户决策模式
 */
enum UserDecisionMode {
  /**
   * 自动模式
   * - 低风险更新自动执行
   * - 高风险更新仍需确认
   */
  AUTO = 'AUTO',
  
  /**
   * 步进模式
   * - 每个步骤都需要用户确认
   * - 适合高风险更新
   */
  STEPWISE = 'STEPWISE',
  
  /**
   * 交互模式
   * - 展示完整计划后一次性确认
   * - 默认模式
   */
  INTERACTIVE = 'INTERACTIVE'
}

/**
 * 决策模式配置
 */
interface DecisionModeConfig {
  // 当前模式
  mode: UserDecisionMode;
  
  // AUTO模式阈值配置
  autoModeThresholds: {
    maxRiskLevel: RiskLevel;        // 自动接受的最大风险等级
    maxArtifactsCount: number;      // 自动接受的最大artifact数量
    maxEstimatedTime: number;       // 自动接受的最大预估时间(分钟)
  };
  
  // STEPWISE模式配置
  stepwiseConfig: {
    pauseOnEachStep: boolean;       // 每步暂停等待确认
    showPreview: boolean;           // 展示更新预览
    allowSkip: boolean;             // 允许跳过步骤
  };
  
  // INTERACTIVE模式配置
  interactiveConfig: {
    showFullPlan: boolean;          // 展示完整计划
    showRiskAnalysis: boolean;      // 展示风险分析
    requireExplicitConfirm: boolean; // 需要显式确认
  };
}

const DEFAULT_DECISION_CONFIG: DecisionModeConfig = {
  mode: UserDecisionMode.INTERACTIVE,
  autoModeThresholds: {
    maxRiskLevel: RiskLevel.LOW,
    maxArtifactsCount: 2,
    maxEstimatedTime: 10
  },
  stepwiseConfig: {
    pauseOnEachStep: true,
    showPreview: true,
    allowSkip: false
  },
  interactiveConfig: {
    showFullPlan: true,
    showRiskAnalysis: true,
    requireExplicitConfirm: true
  }
};
```

### 5.2 决策流程实现

```typescript
/**
 * 决策处理器
 */
class DecisionHandler {
  
  /**
   * 处理用户决策
   */
  async handleDecision(
    proposal: ChainUpdateProposal,
    config: DecisionModeConfig
  ): Promise<DecisionResult> {
    
    // 检查是否满足自动模式条件
    if (this.canAutoAccept(proposal, config)) {
      proposal.user_decision = DecisionState.AUTO_ACCEPTED;
      return {
        decision: DecisionState.AUTO_ACCEPTED,
        reason: '满足自动模式阈值',
        requires_confirmation: false
      };
    }
    
    // 根据模式处理
    switch (config.mode) {
      case UserDecisionMode.AUTO:
        // AUTO模式下不满足阈值则转为INTERACTIVE
        return this.handleInteractive(proposal, config.interactiveConfig);
        
      case UserDecisionMode.STEPWISE:
        return this.handleStepwise(proposal, config.stepwiseConfig);
        
      case UserDecisionMode.INTERACTIVE:
        return this.handleInteractive(proposal, config.interactiveConfig);
        
      default:
        throw new Error(`Unknown decision mode: ${config.mode}`);
    }
  }
  
  /**
   * 检查是否满足自动接受条件
   */
  private canAutoAccept(
    proposal: ChainUpdateProposal,
    config: DecisionModeConfig
  ): boolean {
    const thresholds = config.autoModeThresholds;
    const impact = proposal.estimated_impact;
    
    // 检查风险等级
    if (impact.risk_level > thresholds.maxRiskLevel) {
      return false;
    }
    
    // 检查artifact数量
    if (impact.artifacts_count > thresholds.maxArtifactsCount) {
      return false;
    }
    
    // 检查预估时间
    if (impact.estimated_time_minutes > thresholds.maxEstimatedTime) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 处理交互模式
   */
  private async handleInteractive(
    proposal: ChainUpdateProposal,
    config: InteractiveConfig
  ): Promise<DecisionResult> {
    
    // 展示完整计划
    if (config.showFullPlan) {
      this.displayFullPlan(proposal);
    }
    
    // 展示风险分析
    if (config.showRiskAnalysis) {
      this.displayRiskAnalysis(proposal);
    }
    
    // 等待用户确认
    const userConfirm = await this.waitForUserConfirmation(
      proposal,
      config.requireExplicitConfirm
    );
    
    proposal.user_decision = userConfirm ? DecisionState.ACCEPTED : DecisionState.REJECTED;
    
    return {
      decision: proposal.user_decision,
      reason: userConfirm ? '用户确认接受' : '用户拒绝',
      requires_confirmation: false
    };
  }
  
  /**
   * 处理步进模式
   */
  private async handleStepwise(
    proposal: ChainUpdateProposal,
    config: StepwiseConfig
  ): Promise<DecisionResult> {
    
    // 步进模式下，整体决策为ACCEPTED，但执行时会每步暂停
    proposal.user_decision = DecisionState.ACCEPTED;
    
    return {
      decision: DecisionState.ACCEPTED,
      reason: '步进模式，已接受整体计划',
      requires_confirmation: false,
      stepwise_execution: true,
      stepwise_config: config
    };
  }
}

interface DecisionResult {
  decision: DecisionState;
  reason: string;
  requires_confirmation: boolean;
  stepwise_execution?: boolean;
  stepwise_config?: StepwiseConfig;
}

interface InteractiveConfig {
  showFullPlan: boolean;
  showRiskAnalysis: boolean;
  requireExplicitConfirm: boolean;
}

interface StepwiseConfig {
  pauseOnEachStep: boolean;
  showPreview: boolean;
  allowSkip: boolean;
}
```

---

## 6. Git操作集成

### 6.1 Commit策略

```typescript
/**
 * 链式更新Git提交策略
 */
interface ChainUpdateGitStrategy {
  // 提交粒度
  commitGranularity: 'PER_STEP' | 'PER_CHAIN' | 'PER_ARTIFACT_TYPE';
  
  // 提交消息格式
  commitMessageFormat: {
    pattern: string;
    requiredFields: string[];
  };
  
  // 回滚策略
  rollbackStrategy: {
    enabled: boolean;
    preservePartialResults: boolean;
  };
  
  // Tag策略
  tagStrategy: {
    createCheckpointTag: boolean;
    tagFormat: string;
  };
}

const DEFAULT_CHAIN_GIT_STRATEGY: ChainUpdateGitStrategy = {
  commitGranularity: 'PER_ARTIFACT_TYPE',
  commitMessageFormat: {
    pattern: 'chain-update: {direction} - {artifact_type} - {description}',
    requiredFields: ['direction', 'artifact_type', 'description']
  },
  rollbackStrategy: {
    enabled: true,
    preservePartialResults: false
  },
  tagStrategy: {
    createCheckpointTag: true,
    tagFormat: 'chain-checkpoint/{proposal_id}'
  }
};

/**
 * Git提交执行器
 */
class ChainUpdateGitExecutor {
  
  /**
   * 执行Git提交
   */
  async executeGitCommit(
    step: ChainUpdateStep,
    proposal: ChainUpdateProposal,
    strategy: ChainUpdateGitStrategy
  ): Promise<string> {
    
    const commitMessage = this.generateCommitMessage(step, proposal, strategy);
    
    // 执行Git操作
    const gitResult = await this.runGitCommands([
      'git add .',
      `git commit -m "${commitMessage}"`,
      'git push origin HEAD'
    ]);
    
    return gitResult.commitSha;
  }
  
  /**
   * 生成提交消息
   */
  private generateCommitMessage(
    step: ChainUpdateStep,
    proposal: ChainUpdateProposal,
    strategy: ChainUpdateGitStrategy
  ): string {
    const direction = proposal.direction;
    const artifactType = step.artifact.type;
    const description = step.description;
    
    return `chain-update: ${direction} - ${artifactType} - ${description}

Proposal: ${proposal.proposal_id}
Trigger: ${proposal.trigger_source.type}
Step: ${step.step}/${proposal.update_chain.length}

Co-Authored-By: chain-update-agent`;
  }
  
  /**
   * 创建Checkpoint Tag
   */
  async createCheckpointTag(
    proposal: ChainUpdateProposal,
    strategy: ChainUpdateGitStrategy
  ): Promise<string> {
    if (!strategy.tagStrategy.createCheckpointTag) {
      return '';
    }
    
    const tagName = strategy.tagStrategy.tagFormat
      .replace('{proposal_id}', proposal.proposal_id);
    
    await this.runGitCommands([
      `git tag ${tagName}`,
      `git push origin ${tagName}`
    ]);
    
    return tagName;
  }
}
```

### 6.2 回滚机制

```typescript
/**
 * 回滚处理器
 */
class ChainUpdateRollbackHandler {
  
  /**
   * 执行回滚
   * 
   * 当链式更新部分失败时，回滚整个链
   */
  async executeRollback(
    proposal: ChainUpdateProposal,
    executionResults: ChainUpdateResult,
    strategy: ChainUpdateGitStrategy
  ): Promise<RollbackResult> {
    
    if (!strategy.rollbackStrategy.enabled) {
      return {
        success: false,
        reason: '回滚策略未启用'
      };
    }
    
    // 获取所有成功步骤的commit SHA
    const successfulCommits = executionResults.results
      .filter(r => r.success && r.git_commit_sha)
      .map(r => r.git_commit_sha!);
    
    if (successfulCommits.length === 0) {
      return {
        success: true,
        reason: '无需要回滚的提交'
      };
    }
    
    // 按逆序回滚
    const rollbackOrder = successfulCommits.reverse();
    
    for (const commitSha of rollbackOrder) {
      try {
        await this.runGitCommands([
          `git revert ${commitSha} --no-edit`
        ]);
      } catch (error) {
        // 回滚失败，尝试强制回滚
        await this.runGitCommands([
          `git reset --hard ${commitSha}~1`
        ]);
      }
    }
    
    // 创建回滚标记
    const rollbackTag = `rollback/${proposal.proposal_id}`;
    await this.runGitCommands([
      `git tag ${rollbackTag}`,
      `git push origin ${rollbackTag}`
    ]);
    
    // 更新步骤状态
    for (const step of proposal.update_chain) {
      if (step.status === StepStatus.COMPLETED) {
        step.status = StepStatus.FAILED;
        step.execution_result = {
          ...step.execution_result!,
          success: false,
          error_message: 'Chain rollback executed'
        };
      }
    }
    
    return {
      success: true,
      reverted_commits: rollbackOrder,
      rollback_tag: rollbackTag
    };
  }
}

interface RollbackResult {
  success: boolean;
  reason?: string;
  reverted_commits?: string[];
  rollback_tag?: string;
}

interface ChainUpdateResult {
  success: boolean;
  steps_completed: number;
  steps_total: number;
  results: StepExecutionResult[];
  final_status: 'SUCCESS' | 'PARTIAL_FAILURE' | 'COMPLETE_FAILURE';
}
```

---

## 7. omt:chain-update COMMAND详细设计

### 7.1 COMMAND定义

```typescript
/**
 * omt:chain-update COMMAND
 * 
 * 用法:
 *   omt:chain-update --direction <UPWARD|DOWNWARD> --finding <finding_id>
 *   omt:chain-update --direction <UPWARD|DOWNWARD> --manual
 *   omt:chain-update --mode <AUTO|STEPWISE|INTERACTIVE>
 *   omt:chain-update --status <proposal_id>
 *   omt:chain-update --rollback <proposal_id>
 */
interface ChainUpdateCommand {
  // 命令名称
  name: 'omt:chain-update';
  
  // 子命令
  subcommands: {
    // 创建新提案
    create: {
      direction: ChainUpdateDirection;
      finding_id?: string;  // 对齐发现ID触发
      manual?: boolean;     // 用户手动触发
    };
    
    // 查看提案状态
    status: {
      proposal_id: string;
    };
    
    // 执行提案
    execute: {
      proposal_id: string;
      mode?: UserDecisionMode;
    };
    
    // 回滚提案
    rollback: {
      proposal_id: string;
    };
    
    // 列出提案
    list: {
      status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED' | 'FAILED';
      direction?: ChainUpdateDirection;
    };
  };
  
  // 输出格式
  outputFormat: {
    summary: 'markdown';
    details: 'yaml';
    preview: 'diff';
  };
}
```

### 7.2 执行流程

```
┌─────────────────────────────────────────────────────────────┐
│             omt:chain-update 完整执行流程                    │
└─────────────────────────────────────────────────────────────┘

  用户输入: omt:chain-update --direction UPWARD --finding F001
          │
          ▼
  ┌──────────────────┐
  │ 解析命令参数      │
  │ - direction      │
  │ - finding_id     │
  │ - mode (可选)    │
  └───────┬──────────┘
          │
          ▼
  ┌──────────────────┐
  │ 获取对齐发现详情  │
  │ F001的内容       │
  └───────┬──────────┘
          │
          ▼
  ┌──────────────────┐
  │ 分析更新影响范围  │
  │ - 识别受影响     │
  │   artifacts      │
  │ - 估算风险       │
  └───────┬──────────┘
          │
          ▼
  ┌──────────────────┐
  │ 生成ChainProposal│
  │ - 创建步骤列表   │
  │ - 设置依赖关系   │
  │ - 估算影响       │
  └───────┬──────────┘
          │
          ▼
  ┌──────────────────┐
  │ 保存提案到       │
  │ .omt/alignment/  │
  │ proposals/       │
  └───────┬──────────┘
          │
          ▼
  ┌──────────────────┐
  │ 展示提案给用户    │
  │ - 更新预览       │
  │ - 风险分析       │
  │ - 影响范围       │
  └───────┬──────────┘
          │
          ▼
  ┌──────────────────┐
  │ 等待用户决策      │
  │ - ACCEPT/REJECT  │
  │ - 选择执行模式   │
  └───────┬──────────┘
          │
    ┌─────┴─────┐
    │           │
┌───▼───┐   ┌───▼────┐
│REJECT │   │ ACCEPT │
└───┬───┘   └───┬────┘
    │           │
    ▼           ▼
┌─────────┐ ┌───────────────┐
│记录拒绝 │ │ 解析依赖关系  │
│结束     │ │ 拓扑排序      │
└─────────┘ └───────┬───────┘
                    │
                    ▼
            ┌──────────────────┐
            │ 分组并行步骤      │
            └───────┬──────────┘
                    │
                    ▼
            ┌──────────────────┐
            │ 执行更新链        │
            │ (按分组顺序)      │
            └───────┬──────────┘
                    │
            ┌───────┴───────┐
            │               │
        ┌───▼───┐       ┌───▼────┐
        │ 成功  │       │ 失败   │
        └───┬───┘       └───┬────┘
            │               │
            ▼               ▼
    ┌───────────────┐ ┌───────────────┐
    │ Git提交链      │ │ 执行回滚      │
    │ 创建Tag       │ │ 创建rollback  │
    │               │ │ tag          │
    └───┬───────────┘ └───┬───────────┘
        │               │
        ▼               ▼
    ┌───────────────┐ ┌───────────────┐
    │ 记录到         │ │ 记录失败状态  │
    │ .alignment/   │ │ 到.alignment/│
    └───┬───────────┘ └───┬───────────┘
        │               │
        ▼               ▼
    ┌───────────────┐ ┌───────────────┐
    │ 展示成功报告   │ │ 展示失败报告  │
    └───────────────┘ └───────────────┘
```

---

## 8. 完整示例

### 8.1 示例一：UPWARD更新

```yaml
# ChainUpdateProposal示例 - UPWARD方向
# 触发场景: Sprint执行中发现GraphQL架构约束需要调整

proposal_id: 'P001_UPWARD_20260501'
direction: 'UPWARD'

trigger_source:
  type: 'ALIGNMENT_FINDING'
  finding_id: 'F001'
  # F001内容: Sprint_003发现当前GraphQL schema不支持批量查询

update_chain:
  - step: 1
    artifact:
      type: 'Sprint'
      path: 'sprint_003/sprint.yaml'
      id: 'sprint_003'
    action: 'UPDATE'
    description: '调整Sprint任务以支持批量查询API'
    update_preview:
      before:
        summary: '单个用户查询API'
        key_changes: ['query_type', 'endpoint']
      after:
        summary: '批量用户查询API'
        key_changes: ['query_type', 'batch_endpoint', 'pagination']
    depends_on_steps: []
    status: 'PENDING'

  - step: 2
    artifact:
      type: 'MSpec'
      path: 'mspec_002/design.md'
      id: 'mspec_002'
    action: 'UPDATE'
    description: '更新MSpec设计以支持批量查询模式'
    update_preview:
      before:
        summary: '单条记录CRUD设计'
        key_changes: ['api_design', 'data_flow']
      after:
        summary: '批量操作设计模式'
        key_changes: ['batch_api_design', 'pagination_strategy', 'error_handling']
    depends_on_steps: [1]
    status: 'PENDING'

  - step: 3
    artifact:
      type: 'TSpec'
      path: 'tspec_001/design.md'
      id: 'tspec_001'
    action: 'UPDATE'
    description: '更新TSpec技术规范以反映GraphQL批量查询约束'
    update_preview:
      before:
        summary: 'GraphQL基础查询约束'
        key_changes: ['query_constraints', 'pagination']
      after:
        summary: 'GraphQL批量查询约束'
        key_changes: ['batch_query_constraints', 'cursor_pagination', 'rate_limiting']
    depends_on_steps: [2]
    status: 'PENDING'

estimated_impact:
  artifacts_count: 3
  estimated_time_minutes: 45
  risk_level: 'MEDIUM'
  risk_factors:
    - factor_id: 'RF001'
      description: '批量查询可能影响现有API兼容性'
      severity: 'MODERATE'
      mitigation: '添加兼容层保持旧API可用'
    - factor_id: 'RF002'
      description: 'TSpec更新影响其他MSpec设计'
      severity: 'MINOR'
  agent_impact:
    affected_agents: ['executor_agent', 'designer_agent']
    blocking_agents: ['reviewer_agent']

user_decision: 'PENDING'

timestamps:
  created_at: '2026-05-01T10:00:00Z'
```

### 8.2 示例二：DOWNWARD更新

```yaml
# ChainUpdateProposal示例 - DOWNWARD方向
# 触发场景: 用户手动修改TSpec技术栈约束

proposal_id: 'P002_DOWNWARD_20260501'
direction: 'DOWNWARD'

trigger_source:
  type: 'USER_MANUAL'
  user_reason: '技术栈决策变更: REST API改为GraphQL'

update_chain:
  - step: 1
    artifact:
      type: 'TSpec'
      path: 'tspec_001/design.md'
      id: 'tspec_001'
    action: 'CONFIRM'
    description: '确认TSpec技术栈变更: REST→GraphQL'
    depends_on_steps: []
    status: 'PENDING'

  - step: 2
    artifact:
      type: 'MSpec'
      path: 'mspec_001/design.md'
      id: 'mspec_001'
    action: 'UPDATE'
    description: '更新MSpec_001设计以使用GraphQL API'
    update_preview:
      before:
        summary: 'REST API设计'
        key_changes: ['endpoint_design', 'request_format']
      after:
        summary: 'GraphQL API设计'
        key_changes: ['query_design', 'mutation_design', 'schema_definition']
    depends_on_steps: [1]
    status: 'PENDING'

  - step: 3
    artifact:
      type: 'MSpec'
      path: 'mspec_002/design.md'
      id: 'mspec_002'
    action: 'UPDATE'
    description: '更新MSpec_002设计以使用GraphQL API'
    update_preview:
      before:
        summary: 'REST API设计'
        key_changes: ['endpoint_design', 'request_format']
      after:
        summary: 'GraphQL API设计'
        key_changes: ['query_design', 'mutation_design', 'schema_definition']
    depends_on_steps: [1]
    status: 'PENDING'

  - step: 4
    artifact:
      type: 'Sprint'
      path: 'sprint_003/sprint.yaml'
      id: 'sprint_003'
    action: 'UPDATE'
    description: '调整Sprint_003任务以匹配GraphQL架构'
    update_preview:
      before:
        summary: 'REST API实现任务'
        key_changes: ['atom_tasks', 'api_implementations']
      after:
        summary: 'GraphQL实现任务'
        key_changes: ['atom_tasks', 'schema_implementations', 'resolver_tasks']
    depends_on_steps: [2, 3]
    status: 'PENDING'

  - step: 5
    artifact:
      type: 'Sprint'
      path: 'sprint_004/sprint.yaml'
      id: 'sprint_004'
    action: 'UPDATE'
    description: '调整Sprint_004任务以匹配GraphQL架构'
    update_preview:
      before:
        summary: 'REST API实现任务'
        key_changes: ['atom_tasks', 'api_implementations']
      after:
        summary: 'GraphQL实现任务'
        key_changes: ['atom_tasks', 'schema_implementations', 'resolver_tasks']
    depends_on_steps: [2, 3]
    status: 'PENDING'

estimated_impact:
  artifacts_count: 5
  estimated_time_minutes: 120
  risk_level: 'HIGH'
  risk_factors:
    - factor_id: 'RF001'
      description: '技术栈变更影响所有API实现'
      severity: 'MAJOR'
      mitigation: '分阶段迁移，保持兼容性'
    - factor_id: 'RF002'
      description: '多MSpec并行更新可能导致冲突'
      severity: 'MODERATE'
      mitigation: '使用并行执行，冲突检测'
    - factor_id: 'RF003'
      description: 'Sprint任务需要重新规划'
      severity: 'MODERATE'
  agent_impact:
    affected_agents: ['executor_agent', 'designer_agent', 'reviewer_agent', 'qa_agent']
    blocking_agents: ['executor_agent', 'qa_agent']

user_decision: 'PENDING'

timestamps:
  created_at: '2026-05-01T14:00:00Z'
```

---

## 9. TypeScript接口汇总

```typescript
// ============================================
// 链式更新核心接口汇总
// ============================================

// 1. 枚举定义
enum ChainUpdateDirection { UPWARD, DOWNWARD }
enum ChainUpdateAction { UPDATE, CONFIRM, CREATE, DELETE }
enum StepStatus { PENDING, WAITING_DEPS, IN_PROGRESS, COMPLETED, FAILED, SKIPPED }
enum DecisionState { PENDING, ACCEPTED, REJECTED, AUTO_ACCEPTED }
enum RiskLevel { LOW, MEDIUM, HIGH }
enum UserDecisionMode { AUTO, STEPWISE, INTERACTIVE }

// 2. 核心数据结构
interface ChainUpdateProposal {
  proposal_id: string;
  direction: ChainUpdateDirection;
  trigger_source: TriggerSource;
  update_chain: ChainUpdateStep[];
  estimated_impact: ImpactEstimation;
  user_decision: DecisionState;
  timestamps: ProposalTimestamps;
}

interface ChainUpdateStep {
  step: number;
  artifact: ArtifactReference;
  action: ChainUpdateAction;
  description: string;
  update_preview?: UpdatePreview;
  depends_on_steps: number[];
  status: StepStatus;
  execution_result?: StepExecutionResult;
}

interface ImpactEstimation {
  artifacts_count: number;
  estimated_time_minutes: number;
  risk_level: RiskLevel;
  risk_factors: RiskFactor[];
  agent_impact: AgentImpact;
}

// 3. 执行结果
interface ChainUpdateResult {
  success: boolean;
  steps_completed: number;
  steps_total: number;
  results: StepExecutionResult[];
  final_status: 'SUCCESS' | 'PARTIAL_FAILURE' | 'COMPLETE_FAILURE';
}

interface StepExecutionResult {
  success: boolean;
  error_message?: string;
  git_commit_sha?: string;
  modified_files?: string[];
  execution_time_ms: number;
}

// 4. 执行计划
interface ExecutionPlan {
  execution_order: ChainUpdateStep[];
  parallel_groups: ExecutionGroup[];
  total_steps: number;
}

interface ExecutionGroup {
  group_id: number;
  steps: ChainUpdateStep[];
  can_execute_parallel: boolean;
}

// 5. Git策略
interface ChainUpdateGitStrategy {
  commitGranularity: 'PER_STEP' | 'PER_CHAIN' | 'PER_ARTIFACT_TYPE';
  commitMessageFormat: CommitMessageFormat;
  rollbackStrategy: RollbackStrategy;
  tagStrategy: TagStrategy;
}

// 6. 决策配置
interface DecisionModeConfig {
  mode: UserDecisionMode;
  autoModeThresholds: AutoModeThresholds;
  stepwiseConfig: StepwiseConfig;
  interactiveConfig: InteractiveConfig;
}

// 7. COMMAND定义
interface ChainUpdateCommand {
  name: 'omt:chain-update';
  subcommands: ChainUpdateSubcommands;
  outputFormat: OutputFormat;
}
```

---

## 10. ASCII架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    链式更新机制架构全景图                                  │
└─────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │   用户触发层      │
                              │  omt:chain-update│
                              └───────┬──────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          COMMAND解析层                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ 参数解析    │  │ 触发源识别  │  │ 模式选择    │  │ 验证检查    │      │
│  │ --direction │  │ FINDING/    │  │ AUTO/       │  │ 参数有效性  │      │
│  │ --finding   │  │ MANUAL      │  │ STEPWISE    │  │ 权限检查    │      │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          提案生成层                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │ 影响分析器      │  │ 步骤生成器      │  │ 风险估算器      │          │
│  │ analyzeImpact() │  │ generateSteps() │  │ estimateRisk()  │          │
│  │                 │  │                 │  │                 │          │
│  │ - artifact识别  │  │ - UPDATE/CONFIRM│  │ - 风险因素识别  │          │
│  │ - 依赖关系分析  │  │ - 依赖链构建    │  │ - 时间估算      │          │
│  │ - Agent影响     │  │ - preview生成   │  │ - 影响范围      │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
│                                                                          │
│                     ┌─────────────────────────────────┐                  │
│                     │   ChainUpdateProposal生成       │                  │
│                     └─────────────────────────────────┘                  │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          用户决策层                                       │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │                     DecisionHandler                            │      │
│  │                                                                │      │
│  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │      │
│  │   │ AUTO模式    │    │ STEPWISE    │    │ INTERACTIVE │       │      │
│  │   │             │    │ 模式        │    │ 模式        │       │      │
│  │   │ 阈值检查    │    │             │    │             │       │      │
│  │   │ 自动接受    │    │ 步进确认    │    │ 全量确认    │       │      │
│  │   └─────────────┘    └─────────────┘    └─────────────┘       │      │
│  │                                                                │      │
│  │   输出: DecisionState (ACCEPTED/REJECTED/AUTO_ACCEPTED)       │      │
│  └───────────────────────────────────────────────────────────────┘      │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          依赖解析层                                       │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │                    DependencyResolver                          │      │
│  │                                                                │      │
│  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │      │
│  │   │ 构建依赖图  │ => │ 拓扑排序    │ => │ 并行分组    │       │      │
│  │   │             │    │ (Kahn算法)  │    │             │       │      │
│  │   │ nodes/edges │    │             │    │ Group[]     │       │      │
│  │   └─────────────┘    └─────────────┘    └─────────────┘       │      │
│  │                                                                │      │
│  │   ┌─────────────┐                                             │      │
│  │   │ 循环依赖    │                                             │      │
│  │   │ 检测        │                                             │      │
│  │   │ (DFS)       │                                             │      │
│  │   └─────────────┘                                             │      │
│  │                                                                │      │
│  │   输出: ExecutionPlan { execution_order, parallel_groups }    │      │
│  └───────────────────────────────────────────────────────────────┘      │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          执行引擎层                                       │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │                     ParallelExecutor                           │      │
│  │                                                                │      │
│  │   for (group of parallel_groups) {                            │      │
│  │     if (group.can_execute_parallel) {                         │      │
│  │       Promise.all(group.steps.map(executeStep))               │      │
│  │     } else {                                                  │      │
│  │       sequential execution                                    │      │
│  │     }                                                         │      │
│  │   }                                                           │      │
│  │                                                                │      │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────┐ │      │
│  │   │ UPDATE      │  │ CONFIRM     │  │ CREATE      │  │DELETE│ │      │
│  │   │ 文件修改    │  │ 状态标记    │  │ 新建文件    │  │删除  │ │      │
│  │   └─────────────┘  └─────────────┘  └─────────────┘  └─────┘ │      │
│  └───────────────────────────────────────────────────────────────┘      │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          Git操作层                                        │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │                   ChainUpdateGitExecutor                       │      │
│  │                                                                │      │
│  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │      │
│  │   │ Commit执行  │    │ Tag创建     │    │ Rollback    │       │      │
│  │   │             │    │             │    │ 处理        │       │      │
│  │   │ git add     │    │ checkpoint  │    │             │       │      │
│  │   │ git commit  │    │ tag         │    │ git revert  │       │      │
│  │   │ git push    │    │             │    │ git reset   │       │      │
│  │   └─────────────┘    └─────────────┘    └─────────────┘       │      │
│  │                                                                │      │
│  │   Commit粒度: PER_ARTIFACT_TYPE                                │      │
│  │   Message: chain-update: {direction} - {type} - {description} │      │
│  └───────────────────────────────────────────────────────────────┘      │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          记录存储层                                       │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │                     .omt/alignment/                            │      │
│  │                                                                │      │
│  │   ┌─────────────────────────────────────────────────────────┐ │      │
│  │   │  proposals/                                             │ │      │
│  │   │    - chain_update_P001.yaml  (提案定义)                 │ │      │
│  │   │    - chain_update_P002.yaml                             │ │      │
│  │   └─────────────────────────────────────────────────────────┘ │      │
│  │                                                                │      │
│  │   ┌─────────────────────────────────────────────────────────┐ │      │
│  │   │  results/                                               │ │      │
│  │   │    - chain_result_P001.yaml  (执行结果)                 │ │      │
│  │   │    - chain_result_P002.yaml                             │ │      │
│  │   └─────────────────────────────────────────────────────────┘ │      │
│  │                                                                │      │
│  │   ┌─────────────────────────────────────────────────────────┐ │      │
│  │   │  rollback/                                              │ │      │
│  │   │    - rollback_P001.yaml  (回滚记录)                     │ │      │
│  │   └─────────────────────────────────────────────────────────┘ │      │
│  └───────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 11. 总结

### 11.1 设计要点回顾

| 设计要点 | 说明 |
|---------|------|
| **更新方向** | UPWARD (底层向上) / DOWNWARD (上层向下) 双向传播 |
| **依赖解析** | Kahn算法拓扑排序 + DFS循环检测 + 并行分组 |
| **用户决策** | AUTO/STEPWISE/INTERACTIVE 三种模式 |
| **Git集成** | PER_ARTIFACT_TYPE提交粒度 + Checkpoint Tag + 回滚机制 |
| **记录存储** | .omt/alignment/ 目录下完整记录链 |

### 11.2 与其他组件关系

```
┌─────────────────────────────────────────────────────────────┐
│                 链式更新与OMT组件关系                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  omt:align ─────────────────────────────────────────────────│
│     │                                                      │
│     │ 发现对齐问题                                          │
│     │                                                      │
│     ▼                                                      │
│  ChainUpdateProposal ───────────────────────────────────────│
│     │                                                      │
│     │ 触发链式更新                                          │
│     │                                                      │
│     ▼                                                      │
│  omt:chain-update ──────────────────────────────────────────│
│     │                                                      │
│     │ 执行更新                                              │
│     │                                                      │
│     ▼                                                      │
│  omt:tune ──────────────────────────────────────────────────│
│     │                                                      │
│     │ 精细化调整                                            │
│     │                                                      │
│     ▼                                                      │
│  PMB记录 ───────────────────────────────────────────────────│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

**文档版本**: v1.0
**最后更新**: 2026-05-01