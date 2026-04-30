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
```

---

## 开发时 Repo 文件结构

### 开发结构 vs 安装后结构的区别

OMT 项目有两种截然不同的文件结构场景:

| 维度 | 开发时结构 (本 Repo) | 安装后结构 (目标项目 `.omt/`) |
|------|---------------------|------------------------------|
| **用途** | 开发 OMT harness-engine 内核 | 在目标项目中运行 OMT |
| **创建方式** | 手动创建，Git 管理 | `omt init` 或 `/omt:init` 自动生成 |
| **生命周期** | 持久化，持续迭代 | 随项目动态变化 |
| **核心内容** | 源码、测试、构建脚本 | 运行时数据、配置、缓存 |

### 完整开发时目录结构

```
oh-my-terminator/
│
├── src/                          # 源代码目录
│   ├── core/                     # 核心引擎模块
│   │   ├── engine.ts             # Harness Engine 主入口
│   │   ├── orchestrator/         # Orchestrator 模块 (Module 2)
│   │   │   ├── orchestrator.ts   # 主编排器
│   │   │   ├── tspec-generator.ts # TSpec 生成器
│   │   │   ├── mspec-generator.ts # MSpec 生成器
│   │   │   ├── task-tree-builder.ts # TaskTree DAG 构建
│   │   │   └── agent-delegator.ts # Agent 委派逻辑
│   │   │
│   │   ├── executor/             # Agent 执行层 (Module 3)
│   │   │   ├── task-runner.ts    # 任务执行器
│   │   │   ├── agent-pool.ts     # Agent Pool 管理
│   │   │   ├── workflow-engine.ts # Workflow 引擎 (TDD等)
│   │   │   └── review-gate.ts    # Review Gate 处理
│   │   │
│   │   └── repo-model/           # Repo 关系建模 (Module 1)
│   │   │   ├── scanner.ts        # 源码扫描器
│   │   │   ├── graph-builder.ts  # 关系图谱构建
│   │   │   ├── incremental-updater.ts # 增量更新器
│   │   │   └── grasp-client.ts   # Grasp MCP 客户端
│   │
│   ├── algorithms/               # 算法模块 (对应本文档)
│   │   ├── sprint-selection/     # Sprint Selection Algorithm
│   │   │   ├── index.ts          # 主入口
│   │   │   ├── critical-path.ts  # 关键路径计算
│   │   │   ├── dependency-filter.ts # 依赖过滤
│   │   │   ├── weight-calculator.ts # 权重计算
│   │   │   ├── parallelism-checker.ts # 并行度验证
│   │   │   ├── boundary-handler.ts # 边界情况处理
│   │   │   └── types.ts          # 类型定义
│   │   │
│   │   ├── gap-analysis/         # Gap Analysis Algorithm
│   │   │   ├── index.ts          # 主入口
│   │   │   ├── feature-gap.ts    # 功能 Gap 计算
│   │   │   ├── quality-gap.ts    # 质量 Gap 计算
│   │   │   ├── test-gap.ts       # 测试 Gap 计算
│   │   │   ├── security-gap.ts   # 安全 Gap 计算
│   │   │   ├── composite-gap.ts  # 综合 Gap 计算
│   │   │   ├── decision-maker.ts # 验收决策
│   │   │   └── types.ts          # 类型定义
│   │   │
│   │   └── mspec-adjustment/     # MSpec 微调算法
│   │   │   ├── index.ts          # 主入口
│   │   │   ├── trigger-detector.ts # 触发条件检测
│   │   │   ├── scope-adjuster.ts # Scope 微调
│   │   │   ├── target-adjuster.ts # Target 微调
│   │   │   ├── wbs-adjuster.ts   # WBS 微调
│   │   │   └── types.ts          # 类型定义
│   │
│   ├── hooks/                    # Git Hooks 实现
│   │   ├── post-commit/          # Post-commit Hook
│   │   │   ├── hook-handler.ts   # Hook 主入口
│   │   │   ├── commit-parser.ts  # Commit 消息解析
│   │   │   ├── brain-updater.ts  # brain.json 更新
│   │   │   ├── pmb-updater.ts    # PMB 更新
│   │   │   └── logger.ts         # 日志模块
│   │   │
│   │   ├── pre-mspec/            # Pre-MSpec Hook
│   │   │   ├── hook-handler.ts   # Hook 主入口
│   │   │   └ repo-query.ts       # Repo 关系查询
│   │   │   └── context-prep.ts   # Context 准备
│   │
│   ├── services/                 # 服务层
│   │   ├── mcp-service.ts        # MCP 协议服务
│   │   ├── grasp-service.ts      # Grasp MCP 集成
│   │   ├── git-service.ts        # Git 操作服务
│   │   ├── file-service.ts       # 文件操作服务
│   │   └── config-service.ts     # 配置管理服务
│   │
│   ├── types/                    # 全局类型定义
│   │   ├── tspec.ts              # TSpec 类型
│   │   ├── mspec.ts              # MSpec 类型
│   │   ├── sprint.ts             # Sprint 类型
│   │   ├── atom-task.ts          # AtomTask 类型
│   │   ├── pmb.ts                # PMB 类型
│   │   ├── brain.ts              # brain.json 类型
│   │   ├── grasp.ts              # Grasp 输出类型
│   │   └── index.ts              # 类型汇总导出
│   │
│   └ utils/                      # 工具函数
│   │   ├── dag.ts                # DAG 操作工具
│   │   ├── yaml-parser.ts        # YAML 解析工具
│   │   ├── json-utils.ts         # JSON 操作工具
│   │   ├── logger.ts             # 日志工具
│   │   └── constants.ts          # 常量定义
│   │
│   └── index.ts                  # 包主入口 (导出所有公开 API)
│
├── scripts/                      # CLI 与脚本目录
│   ├── cli/                      # CLI 命令实现
│   │   ├── omt.ts                # CLI 主入口
│   │   ├── init.ts               # `omt init` 命令
│   │   ├── sprint.ts             # `omt sprint` 命令
│   │   ├── status.ts             # `omt status` 命令
│   │   ├── review.ts             # `omt review` 命令
│   │   └ adjust.ts               # `omt adjust` 命令
│   │
│   ├── install/                  # 安装脚本
│   │   ├── install-hooks.ts      # Git Hooks 安装
│   │   ├── create-omt-dir.ts     # .omt/ 目录创建
│   │   ├── init-config.ts        # 初始配置生成
│   │   └ setup-grasp.ts          # Grasp MCP 配置
│   │
│   └ build/                      # 构建脚本
│   │   ├── build.ts              # 主构建脚本
│   │   ├── bundle.ts             # 打包脚本
│   │   └ generate-manifest.ts    # manifest.json 生成
│   │
│   └── templates/                # 模板生成脚本
│   │   ├── tspec-template.ts     # TSpec 模板生成
│   │   ├── mspec-template.ts     # MSpec 模板生成
│   │   ├── sprint-template.ts    # Sprint 模板生成
│   │   └ atom-task-template.ts   # AtomTask YAML 模板
│   │
│   └ bin/                        # 可执行入口
│   └ omt                         # CLI 入口 (shebang)
│
├── tests/                        # 测试目录
│   ├── unit/                     # 单元测试
│   │   ├── algorithms/           # 算法单元测试
│   │   │   ├── sprint-selection.test.ts
│   │   │   ├── gap-analysis.test.ts
│   │   │   ├── mspec-adjustment.test.ts
│   │   │   ├── critical-path.test.ts
│   │   │   ├── parallelism.test.ts
│   │   │
│   │   ├── core/                 # 核心模块单元测试
│   │   │   ├── orchestrator.test.ts
│   │   │   ├── executor.test.ts
│   │   │   ├── repo-model.test.ts
│   │   │
│   │   ├── hooks/                # Hooks 单元测试
│   │   │   ├── post-commit.test.ts
│   │   │   ├── commit-parser.test.ts
│   │   │   ├── brain-updater.test.ts
│   │   │
│   │   └ utils/                  # 工具函数单元测试
│   │   │   ├── dag.test.ts
│   │   │   ├── yaml-parser.test.ts
│   │
│   ├── integration/              # 集成测试
│   │   ├── mcp-integration.test.ts # MCP 集成测试
│   │   ├── grasp-integration.test.ts # Grasp 集成测试
│   │   ├── git-hooks.test.ts     # Git Hooks 集成测试
│   │   ├── sprint-cycle.test.ts  # 完整 Sprint 流程测试
│   │
│   ├── e2e/                      # 端到端测试
│   │   ├── full-project.test.ts  # 完整项目流程测试
│   │   ├── multi-milestone.test.ts # 多 Milestone 流程测试
│   │   ├── gap-acceptance.test.ts # Gap 分析验收测试
│   │
│   ├── fixtures/                 # 测试 fixtures
│   │   ├── sample-repos/         # 示例仓库
│   │   ├── sample-tspecs/        # 示例 TSpec
│   │   ├── sample-mspecs/        # 示例 MSpec
│   │   ├── sample-wbs/           # 示例 WBS
│   │   ├── sample-commits/       # 示例 commit messages
│   │   ├── mock-grasp/           # Mock Grasp 输出
│   │
│   └ helpers/                    # 测试辅助工具
│   │   ├── mock-git.ts           # Git Mock
│   │   ├── mock-grasp.ts         # Grasp Mock
│   │   ├── mock-filesystem.ts    # 文件系统 Mock
│   │   ├── fixture-loader.ts     # Fixture 加载器
│   │
│   └ coverage/                   # 覆盖率报告输出目录
│   │
│   └ setup.ts                    # 测试环境设置
│   └ tsconfig.json               # 测试 TypeScript 配置
│
├── docs/                         # 文档目录
│   ├── design/                   # 设计文档 (当前目录)
│   │   ├── 01_origin_blueprint.md
│   │   ├── 02_sprint_selection_algorithm.md
│   │   ├── 03_gap_analysis_standard.md
│   │   ├── 04_sprint_commit_hook.md
│   │   ├── 05_mspec_adjustment_mechanism.md
│   │
│   ├── api/                      # API 文档
│   │   ├── cli.md                # CLI 命令文档
│   │   ├── types.md              # 类型定义文档
│   │   ├── hooks.md              # Hooks 接口文档
│   │   ├── algorithms.md         # 算法接口文档
│   │
│   ├── guides/                   # 用户指南
│   │   ├── installation.md       # 安装指南
│   │   ├── getting-started.md    # 快速开始
│   │   ├── configuration.md      # 配置说明
│   │   ├── workflow.md           # 工作流说明
│   │
│   └ examples/                   # 使用示例
│   │   ├── basic-project.md      # 基础项目示例
│   │   ├── multi-module.md       # 多模块项目示例
│   │   ├── custom-workflow.md    # 自定义 Workflow 示例
│   │
│   └ CHANGELOG.md                # 变更日志
│   │
│   └ index.md                    # 文档索引
│
├── openspec/                     # OpenSpec 工作流目录
│   ├── changes/                  # 变更目录
│   ├── specs/                    # 规范目录
│   └── archive/                  # 归档目录
│
├── .claude/                      # Claude Code 配置
│   ├── CLAUDE.md                 # 项目级 Claude 指令
│   ├── commands/                 # 自定义命令
│   │   ├── omt-init.md           # /omt:init 命令
│   │   ├── omt-sprint.md         # /omt:sprint 命令
│   │   ├── omt-review.md         # /omt:review 命令
│   │
│   ├── skills/                   # Skills 定义
│   │   ├── sprint-selection/     # Sprint Selection Skill
│   │   │   ├── SKILL.md
│   │   │   └── lib/              # Skill 库文件
│   │   │
│   │   ├── gap-analysis/         # Gap Analysis Skill
│   │   │   ├── SKILL.md
│   │   │   └ adjust-mspec/       # MSpec 微调 Skill
│   │   │   ├── SKILL.md
│   │   │
│   │   ├── tdd-workflow/         # TDD Workflow Skill
│   │   │   ├── SKILL.md
│   │   │
│   │   └ review-gate/            # Review Gate Skill
│   │   │   ├── SKILL.md
│   │
│   ├── agents/                   # Agent 定义
│   │   ├── orchestrator.md       # Orchestrator Agent
│   │   ├── executor.md           # Executor Agent
│   │   ├── reviewer.md           # Reviewer Agent
│   │   ├── adjuster.md           # MSpec Adjuster Agent
│   │
│   └ rules/                      # 项目级规则
│   │   ├── coding-style.md
│   │   ├── testing.md
│   │   ├── git-workflow.md
│   │
│   └ hooks/                      # Claude Code Hooks
│   │   ├── post-tool-use.ts      # PostToolUse Hook
│   │   ├── pre-tool-use.ts       # PreToolUse Hook
│   │
│   └ settings.json               # 项目级设置
│   │
│   └ memory/                     # 项目记忆
│   │   ├── MEMORY.md             # 自动记忆索引
│   │   └ feedback/               # 反馈记录
│   │   └ reference/              # 参考资料
│   │
├── 配置文件
│   ├── package.json              # Node.js 包配置
│   ├── tsconfig.json             # TypeScript 配置
│   ├── tsconfig.build.json       # 构建专用 TS 配置
│   ├── vitest.config.ts          # Vitest 测试配置
│   ├── eslint.config.js          # ESLint 配置
│   ├── prettier.config.js        # Prettier 配置
│   ├── .gitignore                # Git 忽略规则
│   ├── LICENSE                   # 许可证
│   └ README.md                   # 项目说明
│   └ manifest.json               # OMT 内核 manifest
│   └ Makefile                    # Make 命令 (可选)
│
└── dist/                         # 构建输出目录 (Git 忽略)
    ├── index.js                  # 主入口编译产物
    ├── cli/                      # CLI 编译产物
    ├── algorithms/               # 算法编译产物
    └ ...
```

### 各目录作用说明

| 目录 | 作用 | 关键文件 |
|------|------|---------|
| `src/core/` | 核心引擎模块，包含 Orchestrator、Executor、Repo Model | `engine.ts`, `orchestrator.ts`, `task-runner.ts` |
| `src/algorithms/` | 算法实现，对应本系列设计文档 | `sprint-selection/`, `gap-analysis/`, `mspec-adjustment/` |
| `src/hooks/` | Git Hooks 实现，用于事件驱动 | `post-commit/`, `pre-mspec/` |
| `src/services/` | 外部服务集成层 | `mcp-service.ts`, `grasp-service.ts` |
| `src/types/` | 全局类型定义，确保类型安全 | `tspec.ts`, `mspec.ts`, `atom-task.ts` |
| `src/utils/` | 通用工具函数，避免重复代码 | `dag.ts`, `yaml-parser.ts` |
| `scripts/cli/` | CLI 命令实现，用户交互入口 | `omt.ts`, `init.ts`, `sprint.ts` |
| `scripts/install/` | 安装脚本，`omt init` 执行逻辑 | `install-hooks.ts`, `create-omt-dir.ts` |
| `scripts/templates/` | 模板生成脚本，产出 TSpec/MSpec/Sprint 文件 | `tspec-template.ts`, `atom-task-template.ts` |
| `tests/unit/` | 单元测试，覆盖所有算法和核心模块 | `sprint-selection.test.ts`, `critical-path.test.ts` |
| `tests/integration/` | 集成测试，验证模块间协作 | `mcp-integration.test.ts`, `sprint-cycle.test.ts` |
| `tests/e2e/` | 端到端测试，完整流程验证 | `full-project.test.ts` |
| `tests/fixtures/` | 测试 fixtures，提供稳定测试数据 | `sample-repos/`, `mock-grasp/` |
| `docs/design/` | 设计文档，架构决策记录 | `02_sprint_selection_algorithm.md` (本文档) |
| `docs/api/` | API 文档，对外接口说明 | `cli.md`, `types.md` |
| `.claude/skills/` | Claude Code Skills，定义执行流程 | `sprint-selection/SKILL.md` |
| `.claude/agents/` | Claude Code Agents，定义角色职责 | `orchestrator.md`, `executor.md` |

### 文件命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| TypeScript 源码 | `kebab-case.ts` | `critical-path.ts`, `weight-calculator.ts` |
| TypeScript 类型文件 | `kebab-case.ts` 或 `types.ts` | `atom-task.ts`, `types.ts` |
| 测试文件 | `源文件名.test.ts` | `critical-path.test.ts` |
| 设计文档 | `NN_topic_name.md` (序号前缀) | `02_sprint_selection_algorithm.md` |
| Skill 文件 | `SKILL.md` (固定名称) | `.claude/skills/sprint-selection/SKILL.md` |
| Agent 文件 | `agent-name.md` | `.claude/agents/orchestrator.md` |
| 配置文件 | `*.config.js` 或 `*.json` | `vitest.config.ts`, `tsconfig.json` |
| 模板文件 | `*-template.ts` | `tspec-template.ts`, `atom-task-template.ts` |

### 与安装后结构的关键差异

| 维度 | 开发时 | 安装后 |
|------|--------|--------|
| `src/algorithms/` | 算法源码实现 | 不存在 (算法已编译到内核) |
| `src/hooks/` | Hook 源码实现 | `.omt/hooks/` (编译后脚本) |
| `.claude/skills/` | Skill 定义 | 不存在 (Skills 在开发时定义) |
| `tests/` | 测试代码 | 不存在 (测试在开发 Repo 运行) |
| `docs/` | 设计/API 文档 | `.omt/docs/` (用户指南副本) |
| `scripts/templates/` | 模板生成源码 | `.omt/templates/` (模板文件) |
| `dist/` | 编译产物 | `.omt/bin/` (内核二进制) |"},"id":"toolu_tool-559ee494ee184ef58e90e551a72d7b5b","type":"tool_use"}],"usage":{"input_tokens":416,"cache_creation_input_tokens":0,"cache_read_input_tokens":146688,"output_tokens":17222,"server_tool_use":{"web_search_requests":0,"web_fetch_requests":0},"service_tier":"standard","cache_creation":{"ephemeral_1h_input_tokens":0,"ephemeral_5m_input_tokens":0},"inference_geo":"","iterations":[],"speed":"standard"},"stop_reason":"tool_use"},"type":"assistant","uuid":"54a534ef-35b2-44da-bbf3-ae094c1c6ff7","timestamp":"2026-04-30T03:04:05.371Z","userType":"external","entrypoint":"cli","cwd":"/Users/archy/Projects/StartUp/oh-my-terminator","sessionId":"ead6ae5a-bdcf-48b4-83b0-a1601e012bbc","version":"2.1.123","gitBranch":"master","forkedFrom":{"sessionId":"eb77d97e-98e3-4637-8e29-30cbb0db9f7c","messageUuid":"54a534ef-35b2-44da-bbf3-ae094c1c6ff7"}}

