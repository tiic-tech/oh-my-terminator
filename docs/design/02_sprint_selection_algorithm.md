# Sprint Selection Algorithm Design Document

## OMT 架构上下文回顾

OMT (Oh-My-Terminator) 采用"静态锚点 + 动态执行"架构:

```
┌─────────────────────────────────────────────────────────────────┐
│                    TSpec (静态锚点)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Proposal   │  │   Design    │  │  Milestones │──▶ Reviews   │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Fin-Start Serial
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MSpec (半静态)                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │  Proposal   │  │   Design    │  │  Sprints[] ──▶ Reviews│     │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Sprint Loop
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     WBS (一次性分解)                             │
│  atomTasks: [task_1, task_2, ..., task_N] (N ≈ 30-50)          │
│  blockedBy: {taskId: [depTaskIds]}                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Sprint Selection Algorithm
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Sprint (动态构建)                             │
│  selectedTasks: Top 10 atomTasks                               │
│  parallelism: >= 3                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. 输入数据结构定义

### 1.1 AtomTask Schema

```yaml
AtomTask:
  id: string                    # 唯一标识，如 "auth-001"
  description: string           # 任务描述
  complexity: number            # 1-10，估算复杂度
  assigneeRole: string          # 建议执行角色
  blockedBy: [string]           # 依赖任务ID列表
  riskLevel: string             # LOW | MEDIUM | HIGH | CRITICAL
  estimatedHours: number        # 估算工时
  milestoneId: string           # 所属 Milestone
  sprintHistory:                # Sprint 执行历史
    - sprintId: string
      status: COMPLETED | FAILED | DEFERRED
      deferredReason: string    # (if DEFERRED)
```

### 1.2 PMB (Previous Sprint Board) Schema

```yaml
PMB:
  sprintId: string
  completedTasks: [string]      # 已完成任务ID列表
  failedTasks:                  # 失败任务详情
    - taskId: string
      failureReason: string
      retryCount: number
  deferredTasks:                # 延期任务详情
    - taskId: string
      deferredReason: string
      priorityBoost: number     # 延期优先级提升因子
```

### 1.3 GraspDetectChanges Output Schema

```yaml
GraspDetectChanges:
  changedFiles: [string]        # 变更文件列表
  affectedModules:              # 受影响模块
    - moduleId: string
      impactLevel: number       # 0-10
      relatedTasks: [string]    # 相关任务ID
  hotspots:                     # Git热点分析
    - filePath: string
      changeFrequency: number
      bugAssociationRate: number
```

---

## 2. 选择标准权重设计

### 2.1 权重因子定义

| 因子名称 | 权重 | 说明 |
|---------|------|------|
| W_CRITICAL_PATH | 100 | 关键路径任务最高优先级 |
| W_DEPENDENCY_READY | 80 | 无依赖或依赖已完成 |
| W_DEFERRED_BOOST | 70 | 上个Sprint延期任务优先 |
| W_HIGH_RISK | 60 | 高风险任务尽早处理 |
| W_HIGH_COMPLEXITY | 50 | 高复杂度任务优先 |
| W_HOTSPOT_RELATED | 40 | 与热点文件相关任务 |
| W_BALANCE_LOAD | 30 | 平衡角色负载 |

### 2.2 综合权重计算公式

```
Score(task) = 
  CP(task) * W_CRITICAL_PATH +
  DR(task) * W_DEPENDENCY_READY +
  DF(task) * W_DEFERRED_BOOST +
  HR(task) * W_HIGH_RISK +
  HC(task) * W_HIGH_COMPLEXITY +
  HS(task) * W_HOTSPOT_RELATED +
  BL(task) * W_BALANCE_LOAD
```

其中各因子取值范围:

```
CP(task) ∈ {0, 1}        # 是否在关键路径上
DR(task) ∈ {0, 1}        # 依赖是否就绪
DF(task) ∈ {0, 1, 2}     # 0=新任务, 1=延期, 2=多次延期
HR(task) ∈ {0, 0.5, 1}   # LOW=0, MEDIUM=0.5, HIGH=1, CRITICAL=1
HC(task) = complexity / 10  # 归一化复杂度
HS(task) ∈ {0, 1}        # 是否涉及热点文件
BL(task) ∈ {0, 1}        # 角色负载平衡因子
```

---

## 3. 算法伪代码

### 3.1 主算法流程

```typescript
interface SprintTasks {
  tasks: AtomTask[];
  parallelismScore: number;
  estimatedHours: number;
  status?: string;
  blockingTasks?: FailedTask[];
  externalBlockers?: ExternalBlocker[];
  recommendation?: string;
  reason?: string;
}

interface WBS {
  remainingTasks: AtomTask[];
  remainingTaskIds: Set<string>;
}

interface DAG {
  getSuccessors(taskId: string): string[];
  getDependents(taskId: string): string[];
  getTask(taskId: string): AtomTask;
  getStartTasks(): string[];
  getAllTaskIds(): string[];
}

interface PMB {
  sprintId: string;
  completedTasks: string[];
  failedTasks: FailedTask[];
  deferredTasks: DeferredTask[];
}

interface GraspOutput {
  changedFiles: string[];
  affectedModules: AffectedModule[];
  hotspots: Hotspot[];
}

function selectSprintTasks(
  wbs: WBS, 
  dag: DAG, 
  pmb: PMB, 
  graspOutput: GraspOutput
): SprintTasks {
  /**
   * Sprint Selection Algorithm
   * 从 WBS 的 atom_tasks 中选择 Top 10 组成下一个 Sprint
   */
  
  // Step 1: 计算关键路径 (Critical Path Analysis)
  const criticalPath = computeCriticalPath(dag);
  
  // Step 2: 过滤可执行任务 (Dependency Filtering)
  const executableTasks = filterExecutableTasks(
    wbs.remainingTasks, 
    dag, 
    new Set(pmb.completedTasks)
  );
  
  if (executableTasks.length === 0) {
    return handleEmptyExecutablePool(wbs, dag, pmb);
  }
  
  // Step 3: 计算每个任务的综合权重
  const scoredTasks: Array<[AtomTask, number]> = [];
  for (const task of executableTasks) {
    const score = computeTaskScore(
      task, 
      criticalPath,
      pmb,
      graspOutput
    );
    scoredTasks.push([task, score]);
  }
  
  // Step 4: 按权重降序排序
  scoredTasks.sort((a, b) => b[1] - a[1]);
  
  // Step 5: 选择 Top 10，确保并行度约束
  const selected = selectWithParallelismConstraint(
    scoredTasks,
    dag,
    10, // maxTasks
    3   // minParallelism
  );
  
  // Step 6: 验证并返回
  if (!validateSprint(selected, dag, 3)) {
    const repaired = repairParallelism(selected, scoredTasks, dag);
    return {
      tasks: repaired,
      parallelismScore: computeParallelism(repaired, dag),
      estimatedHours: repaired.reduce((sum, t) => sum + t.estimatedHours, 0)
    };
  }
  
  return {
    tasks: selected,
    parallelismScore: computeParallelism(selected, dag),
    estimatedHours: selected.reduce((sum, t) => sum + t.estimatedHours, 0)
  };
}
```

### 3.2 关键路径计算

```typescript
function computeCriticalPath(dag: DAG): Set<string> {
  /**
   * 使用 DAG 的最长路径算法计算关键路径
   * 关键路径上的任务延迟会直接影响项目完成时间
   */
  
  // 构建逆拓扑排序
  const reverseTopo = reverseTopologicalSort(dag);
  
  // 计算每个任务到终点的最长路径
  const longestPathToEnd: Map<string, number> = new Map();
  
  for (const taskId of reverseTopo) {
    const successors = dag.getSuccessors(taskId);
    if (successors.length === 0) {
      // 终点任务
      longestPathToEnd.set(taskId, dag.getTask(taskId).estimatedHours);
    } else {
      const maxSuccessorPath = Math.max(
        ...successors.map(s => longestPathToEnd.get(s) || 0)
      );
      longestPathToEnd.set(
        taskId, 
        dag.getTask(taskId).estimatedHours + maxSuccessorPath
      );
    }
  }
  
  // 找到最长路径起点
  const startTasks = dag.getStartTasks();
  const maxPathLength = Math.max(
    ...startTasks.map(t => longestPathToEnd.get(t) || 0)
  );
  
  // 回溯关键路径上的所有任务
  const criticalPath: Set<string> = new Set();
  for (const startTask of startTasks) {
    if (longestPathToEnd.get(startTask) === maxPathLength) {
      traceCriticalPath(startTask, dag, longestPathToEnd, criticalPath);
    }
  }
  
  return criticalPath;
}

function traceCriticalPath(
  current: string, 
  dag: DAG, 
  pathLengths: Map<string, number>,
  criticalPath: Set<string>
): void {
  /** 回溯关键路径 */
  criticalPath.add(current);
  const successors = dag.getSuccessors(current);
  
  if (successors.length === 0) {
    return;
  }
  
  // 选择最长路径的后继
  const currentLength = pathLengths.get(current)! - dag.getTask(current).estimatedHours;
  for (const succ of successors) {
    if (pathLengths.get(succ) === currentLength) {
      traceCriticalPath(succ, dag, pathLengths, criticalPath);
      break; // 只追踪一条路径
    }
  }
}
```

### 3.3 依赖就绪过滤

```typescript
function filterExecutableTasks(
  remainingTasks: AtomTask[],
  dag: DAG,
  completedTasks: Set<string>
): AtomTask[] {
  /**
   * 过滤出所有依赖已完成的可执行任务
   */
  const executable: AtomTask[] = [];
  
  for (const task of remainingTasks) {
    if (completedTasks.has(task.id)) {
      continue; // 已完成，跳过
    }
    
    // 检查所有依赖是否已完成
    const depsSatisfied = task.blockedBy.every(
      depId => completedTasks.has(depId)
    );
    
    if (depsSatisfied) {
      executable.push(task);
    }
  }
  
  return executable;
}
```

### 3.4 综合权重计算

```typescript
// 权重常量定义
const W_CRITICAL_PATH = 100;
const W_DEPENDENCY_READY = 80;
const W_DEFERRED_BOOST = 70;
const W_HIGH_RISK = 60;
const W_HIGH_COMPLEXITY = 50;
const W_HOTSPOT_RELATED = 40;
const W_BALANCE_LOAD = 30;

const RISK_MAP: Record<string, number> = {
  'LOW': 0.0,
  'MEDIUM': 0.5,
  'HIGH': 1.0,
  'CRITICAL': 1.0
};

function computeTaskScore(
  task: AtomTask,
  criticalPath: Set<string>,
  pmb: PMB,
  graspOutput: GraspOutput
): number {
  /**
   * 计算任务的综合选择权重
   */
  
  // 因子1: 关键路径 (最高优先级)
  const CP = criticalPath.has(task.id) ? 1.0 : 0.0;
  
  // 因子2: 依赖就绪 (已在 filter 步骤保证为 1)
  const DR = 1.0;
  
  // 因子3: 延期优先级提升
  const deferredCount = countDeferrals(task.id, pmb);
  const DF = Math.min(deferredCount + 1, 2); // 最多计为 2
  
  // 因子4: 风险等级
  const HR = RISK_MAP[task.riskLevel] || 0.0;
  
  // 因子5: 复杂度归一化
  const HC = task.complexity / 10.0;
  
  // 因子6: 热点文件关联
  const HS = isHotspotRelated(task, graspOutput) ? 1.0 : 0.0;
  
  // 因子7: 角色负载平衡 (动态计算)
  const BL = computeBalanceFactor(task.assigneeRole);
  
  // 综合权重
  const score = 
    CP * W_CRITICAL_PATH +
    DR * W_DEPENDENCY_READY +
    DF * W_DEFERRED_BOOST +
    HR * W_HIGH_RISK +
    HC * W_HIGH_COMPLEXITY +
    HS * W_HOTSPOT_RELATED +
    BL * W_BALANCE_LOAD;
  
  return score;
}

function countDeferrals(taskId: string, pmb: PMB): number {
  /** 计算任务的历史延期次数 */
  let count = 0;
  for (const deferred of pmb.deferredTasks) {
    if (deferred.taskId === taskId) {
      count += 1;
    }
  }
  return count;
}

function isHotspotRelated(task: AtomTask, graspOutput: GraspOutput): boolean {
  /** 检查任务是否涉及热点文件 */
  for (const hotspot of graspOutput.hotspots) {
    if (hotspot.relatedTasks.includes(task.id)) {
      return true;
    }
  }
  return false;
}
```

### 3.5 并行度约束选择

```typescript
function selectWithParallelismConstraint(
  scoredTasks: Array<[AtomTask, number]>,
  dag: DAG,
  maxTasks: number,
  minParallelism: number
): AtomTask[] {
  /**
   * 选择 Top N 任务，同时确保满足并行度约束
   * 并行度 = 可同时执行的任务数 (无相互依赖)
   */
  
  const selected: AtomTask[] = [];
  const remainingScored = [...scoredTasks];
  
  while (selected.length < maxTasks && remainingScored.length > 0) {
    // 尝试添加下一个高分任务
    const [nextTask, score] = remainingScored[0];
    
    // 检查添加后是否仍满足并行度
    const candidateSelected = [...selected, nextTask];
    const parallelism = computeParallelism(candidateSelected, dag);
    
    // 如果并行度 >= min_parallelism，接受该任务
    if (parallelism >= minParallelism || candidateSelected.length < minParallelism) {
      selected.push(nextTask);
      remainingScored.shift();
    } else {
      // 尝试找一个不降低并行度的替代任务
      const alternative = findParallelismPreservingTask(
        remainingScored, selected, dag, minParallelism
      );
      if (alternative) {
        selected.push(alternative);
        const idx = remainingScored.findIndex(t => t[0] === alternative);
        if (idx >= 0) remainingScored.splice(idx, 1);
      } else {
        // 无法满足约束，提前终止
        break;
      }
    }
  }
  
  return selected;
}

function computeParallelism(tasks: AtomTask[], dag: DAG): number {
  /**
   * 计算给定任务集的并行度
   * 并行度 = 最大同时可执行任务数
   */
  if (tasks.length === 0) {
    return 0;
  }
  
  // 构建任务内部的依赖子图
  const taskIds = new Set(tasks.map(t => t.id));
  
  // 找到所有"无内部依赖"的任务 (可以被立即执行)
  const immediateExecutable: AtomTask[] = [];
  for (const task of tasks) {
    const internalDeps = task.blockedBy.filter(d => taskIds.has(d));
    if (internalDeps.length === 0) {
      immediateExecutable.push(task);
    }
  }
  
  // 并行度至少等于立即可执行任务数
  const baseParallelism = immediateExecutable.length;
  
  // 更精确的并行度计算 (考虑任务完成后的解锁)
  // 使用模拟执行计算峰值并行度
  const peakParallelism = simulatePeakParallelism(tasks, dag);
  
  return Math.max(baseParallelism, peakParallelism);
}

function simulatePeakParallelism(tasks: AtomTask[], dag: DAG): number {
  /**
   * 模拟执行过程，计算峰值并行度
   */
  const taskIds = new Set(tasks.map(t => t.id));
  const completed: Set<string> = new Set();
  const pending: Set<string> = new Set(taskIds);
  let peak = 0;
  
  while (pending.size > 0) {
    // 找到当前可激活的任务
    const newlyActive: string[] = [];
    for (const tid of pending) {
      const task = dag.getTask(tid);
      const depsSatisfied = task.blockedBy.every(
        d => completed.has(d) || !taskIds.has(d)
      );
      if (depsSatisfied) {
        newlyActive.push(tid);
      }
    }
    
    const active = newlyActive.length;
    peak = Math.max(peak, active);
    
    // 模拟完成这些任务 (假设同时完成)
    for (const tid of newlyActive) {
      pending.delete(tid);
      completed.add(tid);
    }
  }
  
  return peak;
}
```

### 3.6 并行度修复策略

```typescript
function repairParallelism(
  selected: AtomTask[],
  scoredTasks: Array<[AtomTask, number]>,
  dag: DAG
): AtomTask[] {
  /**
   * 当并行度不足时，尝试修复选择结果
   */
  
  // 策略1: 移除造成依赖链的任务
  // 找到被其他选中任务依赖的任务 (它是瓶颈)
  const bottleneckTasks = findBottleneckTasks(selected, dag);
  
  for (const bottleneck of bottleneckTasks) {
    // 尝试替换为无依赖的任务
    const alternative = findIndependentTask(scoredTasks, selected, dag);
    if (alternative && !selected.includes(alternative)) {
      // 移除瓶颈任务，添加替代任务
      const repaired = selected.filter(t => t !== bottleneck);
      repaired.push(alternative);
      if (computeParallelism(repaired, dag) >= 3) {
        return repaired;
      }
    }
  }
  
  // 策略2: 添加更多独立任务
  const independentTasks = scoredTasks
    .filter(([t, s]) => !selected.includes(t) && t.blockedBy.length === 0)
    .map(([t, s]) => t);
  
  for (const independent of independentTasks) {
    if (selected.length >= 10) {
      break;
    }
    const candidate = [...selected, independent];
    if (computeParallelism(candidate, dag) >= 3) {
      selected.push(independent);
    }
  }
  
  return selected;
}

function findBottleneckTasks(tasks: AtomTask[], dag: DAG): AtomTask[] {
  /**
   * 找到被多个其他任务依赖的瓶颈任务
   */
  const taskIds = new Set(tasks.map(t => t.id));
  const bottleneckScores: Map<string, number> = new Map();
  
  for (const task of tasks) {
    // 计算有多少其他选中任务依赖此任务
    const dependents = dag.getDependents(task.id);
    const internalDependents = dependents.filter(d => taskIds.has(d));
    bottleneckScores.set(task.id, internalDependents.length);
  }
  
  // 返回依赖最多的任务
  const sortedByBottleneck = [...tasks].sort(
    (a, b) => (bottleneckScores.get(b.id) || 0) - (bottleneckScores.get(a.id) || 0)
  );
  
  return sortedByBottleneck.slice(0, 2); // 返回前2个瓶颈
}
```

---

## 4. DAG 拓扑排序策略

### 4.1 分层拓扑排序

```typescript
class DAGCycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DAGCycleError';
  }
}

function layeredTopologicalSort(dag: DAG): string[][] {
  /**
   * 分层拓扑排序，将任务分成可并行的层级
   * 同一层级的任务无相互依赖，可并行执行
   */
  
  const levels: string[][] = [];
  const remaining = new Set(dag.getAllTaskIds());
  const completed = new Set<string>();
  
  while (remaining.size > 0) {
    // 找到当前层级 (所有依赖已完成的任务)
    const currentLevel: string[] = [];
    for (const tid of remaining) {
      const task = dag.getTask(tid);
      if (task.blockedBy.every(dep => completed.has(dep))) {
        currentLevel.push(tid);
      }
    }
    
    if (currentLevel.length === 0) {
      // 存在循环依赖，报错处理
      throw new DAGCycleError("Cycle detected in task dependencies");
    }
    
    levels.push(currentLevel);
    
    // 标记当前层级为已完成
    for (const tid of currentLevel) {
      remaining.delete(tid);
      completed.add(tid);
    }
  }
  
  return levels;
}
```

### 4.2 关键路径拓扑排序

```typescript
function criticalPathTopologicalSort(dag: DAG): string[] {
  /**
   * 关键路径优先的拓扑排序
   * 关键路径上的任务优先排列
   */
  
  // 计算关键路径
  const criticalPath = computeCriticalPath(dag);
  
  // 分层排序
  const levels = layeredTopologicalSort(dag);
  
  // 对每一层，关键路径任务排在前面
  const sortedTasks: string[] = [];
  for (const level of levels) {
    // 分组: 关键路径任务 vs 非关键路径任务
    const criticalInLevel = level.filter(t => criticalPath.has(t));
    const nonCriticalInLevel = level.filter(t => !criticalPath.has(t));
    
    // 添加到结果
    sortedTasks.push(...criticalInLevel);
    sortedTasks.push(...nonCriticalInLevel);
  }
  
  return sortedTasks;
}
```

---

## 5. 边界情况处理

### 5.1 WBS 剩余任务 < 10

```typescript
function handleSmallWbs(
  remainingTasks: AtomTask[],
  maxTasks: number
): AtomTask[] {
  /**
   * 当 WBS 剩余任务少于 max_tasks 时的处理
   */
  
  if (remainingTasks.length <= maxTasks) {
    // 全部选中
    return remainingTasks;
  }
  
  return remainingTasks; // 正常处理
}
```

### 5.2 无可执行任务 (全部阻塞)

```typescript
interface ExternalBlocker {
  taskId: string;
  blockerType: string;
  description: string;
}

function handleEmptyExecutablePool(
  wbs: WBS, 
  dag: DAG, 
  pmb: PMB
): SprintTasks {
  /**
   * 当所有剩余任务都被阻塞时的处理
   */
  
  // 检查是否有失败任务阻塞了后续任务
  const blockingFailures: FailedTask[] = [];
  for (const failed of pmb.failedTasks) {
    const dependents = dag.getDependents(failed.taskId);
    if (dependents.some(d => wbs.remainingTaskIds.has(d))) {
      blockingFailures.push(failed);
    }
  }
  
  if (blockingFailures.length > 0) {
    // 策略: 重试失败任务 或 创建替代任务
    return {
      tasks: [], // 空 Sprint
      status: "BLOCKED_BY_FAILURES",
      blockingTasks: blockingFailures,
      recommendation: "Resolve failed tasks before proceeding"
    };
  }
  
  // 检查是否有外部依赖未满足
  const externalBlockers = findExternalBlockers(wbs, dag, pmb);
  
  return {
    tasks: [],
    status: "BLOCKED_EXTERNAL",
    externalBlockers: externalBlockers,
    recommendation: "Wait for external dependencies or escalate"
  };
}
```

### 5.3 并行度不足 3

```typescript
function handleLowParallelism(
  selected: AtomTask[],
  dag: DAG
): SprintTasks {
  /**
   * 当无法满足 min_parallelism=3 约束时的处理
   */
  
  const parallelism = computeParallelism(selected, dag);
  
  if (parallelism < 3) {
    // 记录原因
    const reason = analyzeLowParallelismReason(selected, dag);
    
    return {
      tasks: selected, // 仍然返回选中的任务
      parallelismScore: parallelism,
      status: "LOW_PARALLELISM",
      reason: reason,
      recommendation: "Consider splitting tasks or accepting lower parallelism"
    };
  }
  
  return {
    tasks: selected,
    parallelismScore: parallelism
  };
}
```

### 5.4 延期任务累积过多

```typescript
function handleAccumulatedDeferrals(
  pmb: PMB,
  executableTasks: AtomTask[]
): AtomTask[] {
  /**
   * 当延期任务过多时的特殊处理
   */
  
  const deferredIds = new Set(pmb.deferredTasks.map(d => d.taskId));
  
  // 如果延期任务占可执行任务的比例 > 50%
  const deferredInExecutable = executableTasks.filter(t => deferredIds.has(t.id));
  
  if (deferredInExecutable.length > executableTasks.length * 0.5) {
    // 优先处理所有延期任务
    return sortByDeferralPriority(deferredInExecutable, pmb);
  }
  
  return executableTasks; // 正常处理
}
```

---

## 6. 完整示例

### 6.1 输入数据示例

```yaml
# WBS 剩余任务 (假设 35 个)
remainingTasks:
  - id: auth-001
    description: "Implement JWT token generation"
    complexity: 6
    assigneeRole: backend-dev
    blockedBy: []
    riskLevel: HIGH
    estimatedHours: 4
    
  - id: auth-002
    description: "Create refresh token logic"
    complexity: 4
    assigneeRole: backend-dev
    blockedBy: [auth-001]
    riskLevel: MEDIUM
    estimatedHours: 3
    
  - id: auth-003
    description: "Add token validation middleware"
    complexity: 5
    assigneeRole: backend-dev
    blockedBy: [auth-001]
    riskLevel: HIGH
    estimatedHours: 3
    
  - id: auth-004
    description: "Write auth unit tests"
    complexity: 3
    assigneeRole: test-writer
    blockedBy: [auth-001, auth-002]
    riskLevel: LOW
    estimatedHours: 2
    
  - id: ui-001
    description: "Design login page mockup"
    complexity: 4
    assigneeRole: frontend-dev
    blockedBy: []
    riskLevel: LOW
    estimatedHours: 3
    
  - id: ui-002
    description: "Implement login form component"
    complexity: 5
    assigneeRole: frontend-dev
    blockedBy: [ui-001]
    riskLevel: MEDIUM
    estimatedHours: 4
    
  # ... 更多任务

# DAG 依赖关系
dag:
  auth-001: []
  auth-002: [auth-001]
  auth-003: [auth-001]
  auth-004: [auth-001, auth-002]
  ui-001: []
  ui-002: [ui-001]
  # ...

# PMB (上一个 Sprint 状态)
pmb:
  sprintId: sprint-001
  completedTasks: [infra-001, infra-002]
  failedTasks:
    - taskId: infra-003
      failureReason: "Database connection timeout"
      retryCount: 2
  deferredTasks:
    - taskId: config-001
      deferredReason: "Waiting for external API spec"
      priorityBoost: 1

# graspDetectChanges 输出
graspDetectChanges:
  changedFiles: ["src/auth/", "src/config/"]
  affectedModules:
    - moduleId: auth-module
      impactLevel: 8
      relatedTasks: [auth-001, auth-002, auth-003]
  hotspots:
    - filePath: src/auth/token.ts
      changeFrequency: 15
      bugAssociationRate: 0.3
```

### 6.2 执行过程示例

```
Step 1: 计算关键路径
  - auth-001 → auth-002 → auth-004 (路径长度: 4+3+2=9)
  - auth-001 → auth-003 (路径长度: 4+3=7)
  - ui-001 → ui-002 (路径长度: 3+4=7)
  关键路径: {auth-001, auth-002, auth-004}

Step 2: 过滤可执行任务
  - auth-001 (无依赖) ✓
  - auth-002 (依赖 auth-001 未完成) ✗
  - auth-003 (依赖 auth-001 未完成) ✗
  - auth-004 (依赖未完成) ✗
  - ui-001 (无依赖) ✓
  - config-001 (延期任务，无依赖) ✓
  可执行池: [auth-001, ui-001, config-001, ...]

Step 3: 计算权重
  auth-001:
    CP=1 (关键路径) → 100
    DR=1 → 80
    DF=0 (新任务) → 0
    HR=1 (HIGH风险) → 60
    HC=0.6 (复杂度6/10) → 30
    HS=1 (热点相关) → 40
    Score = 100+80+0+60+30+40 = 310

  ui-001:
    CP=0 → 0
    DR=1 → 80
    DF=0 → 0
    HR=0 (LOW风险) → 0
    HC=0.4 → 20
    HS=0 → 0
    Score = 80+20 = 100

  config-001:
    CP=0 → 0
    DR=1 → 80
    DF=1 (延期) → 70
    HR=0 → 0
    HC=0.5 → 25
    HS=1 (热点相关) → 40
    Score = 80+70+0+25+40 = 215

Step 4: 按权重排序
  [auth-001:310, config-001:215, ui-001:100, ...]

Step 5: 选择 Top 10，确保并行度
  选中: [auth-001, config-001, ui-001, ...]
  并行度检查: 3个任务都无内部依赖，并行度=3 ✓

Step 6: 最终 Sprint
  tasks: [auth-001, config-001, ui-001, ...10个任务]
  parallelismScore: 5
  estimatedHours: 28
```

---

## 7. 架构集成建议

### 7.1 Sprint Selection 在 OMT 流程中的位置

```
┌─────────────────────────────────────────────────────────────────┐
│                     MSpec Review Gate                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Input: TSpec.milestone[N] + Module1 Repo State          │   │
│  │ Output: MSpec (proposal, design, sprints)               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     WBS Generation                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Input: MSpec.design + Module1 Affected Modules          │   │
│  │ Output: atom_tasks[] + DAG                              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Sprint Selection Algorithm                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Input: WBS + DAG + PMB + grasp_detect_changes           │   │
│  │ Output: Sprint (Top 10 tasks)                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Sprint Execution                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Agent Pool executes tasks (TDD workflow)                │   │
│  │ Task-level immediate review                             │   │
│  │ Output: PMB (completed/failed/deferred)                 │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Loop until WBS empty
                              ▼
                        [Sprint Selection]
```

### 7.2 推荐实现位置

建议将 Sprint Selection Algorithm 作为独立的 skill 实现:

```
.claude/skills/sprint-selection/SKILL.md
.claude/skills/sprint-selection/lib/
  - criticalPath.ts
  - dependencyFilter.ts
  - weightCalculator.ts
  - parallelismChecker.ts
  - boundaryHandler.ts
```

OMT 文件结构参考:
```
.omt/tspecs/tspec_<timestamp>/mspecs/mspec_<timestamp>/sprints/sprint_<number>
```"},"id":"toolu_tool-559ee494ee184ef58e90e551a72d7b5b","type":"tool_use"}],"usage":{"input_tokens":416,"cache_creation_input_tokens":0,"cache_read_input_tokens":146688,"output_tokens":17222,"server_tool_use":{"web_search_requests":0,"web_fetch_requests":0},"service_tier":"standard","cache_creation":{"ephemeral_1h_input_tokens":0,"ephemeral_5m_input_tokens":0},"inference_geo":"","iterations":[],"speed":"standard"},"stop_reason":"tool_use"},"type":"assistant","uuid":"54a534ef-35b2-44da-bbf3-ae094c1c6ff7","timestamp":"2026-04-30T03:04:05.371Z","userType":"external","entrypoint":"cli","cwd":"/Users/archy/Projects/StartUp/oh-my-terminator","sessionId":"ead6ae5a-bdcf-48b4-83b0-a1601e012bbc","version":"2.1.123","gitBranch":"master","forkedFrom":{"sessionId":"eb77d97e-98e3-4637-8e29-30cbb0db9f7c","messageUuid":"54a534ef-35b2-44da-bbf3-ae094c1c6ff7"}}

