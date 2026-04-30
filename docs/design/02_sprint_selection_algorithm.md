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
│  atom_tasks: [task_1, task_2, ..., task_N] (N ≈ 30-50)         │
│  blocked_by: {task_id: [dep_task_ids]}                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Sprint Selection Algorithm
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Sprint (动态构建)                             │
│  selected_tasks: Top 10 atom_tasks                             │
│  parallelism: >= 3                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. 输入数据结构定义

### 1.1 atom_task Schema

```yaml
atom_task:
  id: string                    # 唯一标识，如 "auth-001"
  description: string           # 任务描述
  complexity: number            # 1-10，估算复杂度
  assignee_role: string         # 建议执行角色
  blocked_by: [string]          # 依赖任务ID列表
  risk_level: string            # LOW | MEDIUM | HIGH | CRITICAL
  estimated_hours: number       # 估算工时
  milestone_id: string          # 所属 Milestone
  sprint_history:               # Sprint 执行历史
    - sprint_id: string
      status: COMPLETED | FAILED | DEFERRED
      deferred_reason: string   # (if DEFERRED)
```

### 1.2 PMB (Previous Sprint Board) Schema

```yaml
PMB:
  sprint_id: string
  completed_tasks: [string]     # 已完成任务ID列表
  failed_tasks:                 # 失败任务详情
    - task_id: string
      failure_reason: string
      retry_count: number
  deferred_tasks:               # 延期任务详情
    - task_id: string
      deferred_reason: string
      priority_boost: number    # 延期优先级提升因子
```

### 1.3 grasp_detect_changes Output Schema

```yaml
grasp_detect_changes:
  changed_files: [string]       # 变更文件列表
  affected_modules:             # 受影响模块
    - module_id: string
      impact_level: number      # 0-10
      related_tasks: [string]   # 相关任务ID
  hotspots:                     # Git热点分析
    - file_path: string
      change_frequency: number
      bug_association_rate: number
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

```python
def select_sprint_tasks(wbs: WBS, dag: DAG, pmb: PMB, 
                        grasp_output: GraspOutput) -> SprintTasks:
    """
    Sprint Selection Algorithm
    从 WBS 的 atom_tasks 中选择 Top 10 组成下一个 Sprint
    """
    
    # Step 1: 计算关键路径 (Critical Path Analysis)
    critical_path = compute_critical_path(dag)
    
    # Step 2: 过滤可执行任务 (Dependency Filtering)
    executable_tasks = filter_executable_tasks(
        wbs.remaining_tasks, 
        dag, 
        pmb.completed_tasks
    )
    
    if len(executable_tasks) == 0:
        return handle_empty_executable_pool(wbs, dag, pmb)
    
    # Step 3: 计算每个任务的综合权重
    scored_tasks = []
    for task in executable_tasks:
        score = compute_task_score(
            task, 
            critical_path,
            pmb,
            grasp_output
        )
        scored_tasks.append((task, score))
    
    # Step 4: 按权重降序排序
    scored_tasks.sort(key=lambda x: x[1], reverse=True)
    
    # Step 5: 选择 Top 10，确保并行度约束
    selected = select_with_parallelism_constraint(
        scored_tasks,
        dag,
        max_tasks=10,
        min_parallelism=3
    )
    
    # Step 6: 验证并返回
    if not validate_sprint(selected, dag, min_parallelism=3):
        selected = repair_parallelism(selected, scored_tasks, dag)
    
    return SprintTasks(
        tasks=selected,
        parallelism_score=compute_parallelism(selected, dag),
        estimated_hours=sum(t.estimated_hours for t in selected)
    )
```

### 3.2 关键路径计算

```python
def compute_critical_path(dag: DAG) -> Set[str]:
    """
    使用 DAG 的最长路径算法计算关键路径
    关键路径上的任务延迟会直接影响项目完成时间
    """
    
    # 构建逆拓扑排序
    reverse_topo = reverse_topological_sort(dag)
    
    # 计算每个任务到终点的最长路径
    longest_path_to_end = {}
    for task_id in reverse_topo:
        successors = dag.get_successors(task_id)
        if len(successors) == 0:
            # 终点任务
            longest_path_to_end[task_id] = dag.get_task(task_id).estimated_hours
        else:
            longest_path_to_end[task_id] = dag.get_task(task_id).estimated_hours + \\
                max(longest_path_to_end[s] for s in successors)
    
    # 找到最长路径起点
    start_tasks = dag.get_start_tasks()
    max_path_length = max(longest_path_to_end[t] for t in start_tasks)
    
    # 回溯关键路径上的所有任务
    critical_path = set()
    for start_task in start_tasks:
        if longest_path_to_end[start_task] == max_path_length:
            trace_critical_path(start_task, dag, longest_path_to_end, critical_path)
    
    return critical_path

def trace_critical_path(current: str, dag: DAG, 
                         path_lengths: Dict[str, float],
                         critical_path: Set[str]):
    """回溯关键路径"""
    critical_path.add(current)
    successors = dag.get_successors(current)
    
    if len(successors) == 0:
        return
    
    # 选择最长路径的后继
    current_length = path_lengths[current] - dag.get_task(current).estimated_hours
    for succ in successors:
        if path_lengths[succ] == current_length:
            trace_critical_path(succ, dag, path_lengths, critical_path)
            break  # 只追踪一条路径
```

### 3.3 依赖就绪过滤

```python
def filter_executable_tasks(remaining_tasks: List[AtomTask],
                            dag: DAG,
                            completed_tasks: Set[str]) -> List[AtomTask]:
    """
    过滤出所有依赖已完成的可执行任务
    """
    executable = []
    
    for task in remaining_tasks:
        if task.id in completed_tasks:
            continue  # 已完成，跳过
        
        # 检查所有依赖是否已完成
        deps_satisfied = all(
            dep_id in completed_tasks 
            for dep_id in task.blocked_by
        )
        
        if deps_satisfied:
            executable.append(task)
    
    return executable
```

### 3.4 综合权重计算

```python
def compute_task_score(task: AtomTask,
                       critical_path: Set[str],
                       pmb: PMB,
                       grasp_output: GraspOutput) -> float:
    """
    计算任务的综合选择权重
    """
    
    # 因子1: 关键路径 (最高优先级)
    CP = 1.0 if task.id in critical_path else 0.0
    
    # 因子2: 依赖就绪 (已在 filter 步骤保证为 1)
    DR = 1.0
    
    # 因子3: 延期优先级提升
    deferred_count = count_deferrals(task.id, pmb)
    DF = min(deferred_count + 1, 2)  # 最多计为 2
    
    # 因子4: 风险等级
    risk_map = {
        'LOW': 0.0,
        'MEDIUM': 0.5,
        'HIGH': 1.0,
        'CRITICAL': 1.0
    }
    HR = risk_map.get(task.risk_level, 0.0)
    
    # 因子5: 复杂度归一化
    HC = task.complexity / 10.0
    
    # 因子6: 热点文件关联
    HS = 1.0 if is_hotspot_related(task, grasp_output) else 0.0
    
    # 因子7: 角色负载平衡 (动态计算)
    BL = compute_balance_factor(task.assignee_role)
    
    # 综合权重
    score = (
        CP * W_CRITICAL_PATH +
        DR * W_DEPENDENCY_READY +
        DF * W_DEFERRED_BOOST +
        HR * W_HIGH_RISK +
        HC * W_HIGH_COMPLEXITY +
        HS * W_HOTSPOT_RELATED +
        BL * W_BALANCE_LOAD
    )
    
    return score

def count_deferrals(task_id: str, pmb: PMB) -> int:
    """计算任务的历史延期次数"""
    count = 0
    for deferred in pmb.deferred_tasks:
        if deferred.task_id == task_id:
            count += 1
    return count

def is_hotspot_related(task: AtomTask, grasp_output: GraspOutput) -> bool:
    """检查任务是否涉及热点文件"""
    for hotspot in grasp_output.hotspots:
        if task.id in hotspot.related_tasks:
            return True
    return False
```

### 3.5 并行度约束选择

```python
def select_with_parallelism_constraint(scored_tasks: List[Tuple[AtomTask, float]],
                                       dag: DAG,
                                       max_tasks: int,
                                       min_parallelism: int) -> List[AtomTask]:
    """
    选择 Top N 任务，同时确保满足并行度约束
    并行度 = 可同时执行的任务数 (无相互依赖)
    """
    
    selected = []
    remaining_scored = scored_tasks.copy()
    
    while len(selected) < max_tasks and remaining_scored:
        # 尝试添加下一个高分任务
        next_task, score = remaining_scored[0]
        
        # 检查添加后是否仍满足并行度
        candidate_selected = selected + [next_task]
        parallelism = compute_parallelism(candidate_selected, dag)
        
        # 如果并行度 >= min_parallelism，接受该任务
        if parallelism >= min_parallelism or len(candidate_selected) < min_parallelism:
            selected.append(next_task)
            remaining_scored.pop(0)
        else:
            # 尝试找一个不降低并行度的替代任务
            alternative = find_parallelism_preserving_task(
                remaining_scored, selected, dag, min_parallelism
            )
            if alternative:
                selected.append(alternative)
                remaining_scored.remove((alternative, compute_task_score(alternative, ...)))
            else:
                # 无法满足约束，提前终止
                break
    
    return selected

def compute_parallelism(tasks: List[AtomTask], dag: DAG) -> int:
    """
    计算给定任务集的并行度
    并行度 = 最大同时可执行任务数
    """
    if len(tasks) == 0:
        return 0
    
    # 构建任务内部的依赖子图
    task_ids = {t.id for t in tasks}
    
    # 找到所有"无内部依赖"的任务 (可以被立即执行)
    immediate_executable = []
    for task in tasks:
        internal_deps = [d for d in task.blocked_by if d in task_ids]
        if len(internal_deps) == 0:
            immediate_executable.append(task)
    
    # 并行度至少等于立即可执行任务数
    base_parallelism = len(immediate_executable)
    
    # 更精确的并行度计算 (考虑任务完成后的解锁)
    # 使用模拟执行计算峰值并行度
    peak_parallelism = simulate_peak_parallelism(tasks, dag)
    
    return max(base_parallelism, peak_parallelism)

def simulate_peak_parallelism(tasks: List[AtomTask], dag: DAG) -> int:
    """
    模拟执行过程，计算峰值并行度
    """
    task_ids = {t.id for t in tasks}
    completed = set()
    pending = set(task_ids)
    active = 0
    peak = 0
    
    while pending:
        # 找到当前可激活的任务
        newly_active = []
        for tid in pending:
            task = dag.get_task(tid)
            deps_satisfied = all(
                d in completed or d not in task_ids 
                for d in task.blocked_by
            )
            if deps_satisfied:
                newly_active.append(tid)
        
        active = len(newly_active)
        peak = max(peak, active)
        
        # 模拟完成这些任务 (假设同时完成)
        for tid in newly_active:
            pending.remove(tid)
            completed.add(tid)
    
    return peak
```

### 3.6 并行度修复策略

```python
def repair_parallelism(selected: List[AtomTask],
                       scored_tasks: List[Tuple[AtomTask, float]],
                       dag: DAG) -> List[AtomTask]:
    """
    当并行度不足时，尝试修复选择结果
    """
    
    # 策略1: 移除造成依赖链的任务
    # 找到被其他选中任务依赖的任务 (它是瓶颈)
    bottleneck_tasks = find_bottleneck_tasks(selected, dag)
    
    for bottleneck in bottleneck_tasks:
        # 尝试替换为无依赖的任务
        alternative = find_independent_task(scored_tasks, selected, dag)
        if alternative and alternative not in selected:
            # 移除瓶颈任务，添加替代任务
            repaired = [t for t in selected if t != bottleneck]
            repaired.append(alternative)
            if compute_parallelism(repaired, dag) >= 3:
                return repaired
    
    # 策略2: 添加更多独立任务
    independent_tasks = [t for t, s in scored_tasks 
                        if t not in selected and len(t.blocked_by) == 0]
    
    for independent in independent_tasks:
        if len(selected) >= 10:
            break
        candidate = selected + [independent]
        if compute_parallelism(candidate, dag) >= 3:
            selected = candidate
    
    return selected

def find_bottleneck_tasks(tasks: List[AtomTask], dag: DAG) -> List[AtomTask]:
    """
    找到被多个其他任务依赖的瓶颈任务
    """
    task_ids = {t.id for t in tasks}
    bottleneck_scores = {}
    
    for task in tasks:
        # 计算有多少其他选中任务依赖此任务
        dependents = dag.get_dependents(task.id)
        internal_dependents = [d for d in dependents if d in task_ids]
        bottleneck_scores[task.id] = len(internal_dependents)
    
    # 返回依赖最多的任务
    sorted_by_bottleneck = sorted(
        tasks, 
        key=lambda t: bottleneck_scores[t.id],
        reverse=True
    )
    
    return sorted_by_bottleneck[:2]  # 返回前2个瓶颈
```

---

## 4. DAG 拓扑排序策略

### 4.1 分层拓扑排序

```python
def layered_topological_sort(dag: DAG) -> List[List[str]]:
    """
    分层拓扑排序，将任务分成可并行的层级
    同一层级的任务无相互依赖，可并行执行
    """
    
    levels = []
    remaining = set(dag.get_all_task_ids())
    completed = set()
    
    while remaining:
        # 找到当前层级 (所有依赖已完成的任务)
        current_level = []
        for tid in remaining:
            task = dag.get_task(tid)
            if all(dep in completed for dep in task.blocked_by):
                current_level.append(tid)
        
        if not current_level:
            # 存在循环依赖，报错处理
            raise DAGCycleError("Cycle detected in task dependencies")
        
        levels.append(current_level)
        
        # 标记当前层级为已完成
        for tid in current_level:
            remaining.remove(tid)
            completed.add(tid)
    
    return levels
```

### 4.2 关键路径拓扑排序

```python
def critical_path_topological_sort(dag: DAG) -> List[str]:
    """
    关键路径优先的拓扑排序
    关键路径上的任务优先排列
    """
    
    # 计算关键路径
    critical_path = compute_critical_path(dag)
    
    # 分层排序
    levels = layered_topological_sort(dag)
    
    # 对每一层，关键路径任务排在前面
    sorted_tasks = []
    for level in levels:
        # 分组: 关键路径任务 vs 非关键路径任务
        critical_in_level = [t for t in level if t in critical_path]
        non_critical_in_level = [t for t in level if t not in critical_path]
        
        # 添加到结果
        sorted_tasks.extend(critical_in_level)
        sorted_tasks.extend(non_critical_in_level)
    
    return sorted_tasks
```

---

## 5. 边界情况处理

### 5.1 WBS 剩余任务 < 10

```python
def handle_small_wbs(remaining_tasks: List[AtomTask],
                     max_tasks: int) -> List[AtomTask]:
    """
    当 WBS 剩余任务少于 max_tasks 时的处理
    """
    
    if len(remaining_tasks) <= max_tasks:
        # 全部选中
        return remaining_tasks
    
    return remaining_tasks  # 正常处理
```

### 5.2 无可执行任务 (全部阻塞)

```python
def handle_empty_executable_pool(wbs: WBS, dag: DAG, pmb: PMB) -> SprintTasks:
    """
    当所有剩余任务都被阻塞时的处理
    """
    
    # 检查是否有失败任务阻塞了后续任务
    blocking_failures = []
    for failed in pmb.failed_tasks:
        dependents = dag.get_dependents(failed.task_id)
        if any(d in wbs.remaining_task_ids for d in dependents):
            blocking_failures.append(failed)
    
    if blocking_failures:
        # 策略: 重试失败任务 或 创建替代任务
        return SprintTasks(
            tasks=[],  # 空 Sprint
            status="BLOCKED_BY_FAILURES",
            blocking_tasks=blocking_failures,
            recommendation="Resolve failed tasks before proceeding"
        )
    
    # 检查是否有外部依赖未满足
    external blockers = find_external_blockers(wbs, dag, pmb)
    
    return SprintTasks(
        tasks=[],
        status="BLOCKED_EXTERNAL",
        external_blockers=external_blockers,
        recommendation="Wait for external dependencies or escalate"
    )
```

### 5.3 并行度不足 3

```python
def handle_low_parallelism(selected: List[AtomTask],
                            dag: DAG) -> SprintTasks:
    """
    当无法满足 min_parallelism=3 约束时的处理
    """
    
    parallelism = compute_parallelism(selected, dag)
    
    if parallelism < 3:
        # 记录原因
        reason = analyze_low_parallelism_reason(selected, dag)
        
        return SprintTasks(
            tasks=selected,  # 仍然返回选中的任务
            parallelism_score=parallelism,
            status="LOW_PARALLELISM",
            reason=reason,
            recommendation="Consider splitting tasks or accepting lower parallelism"
        )
    
    return SprintTasks(tasks=selected, parallelism_score=parallelism)
```

### 5.4 延期任务累积过多

```python
def handle_accumulated_deferrals(pmb: PMB,
                                 executable_tasks: List[AtomTask]) -> List[AtomTask]:
    """
    当延期任务过多时的特殊处理
    """
    
    deferred_ids = {d.task_id for d in pmb.deferred_tasks}
    
    # 如果延期任务占可执行任务的比例 > 50%
    deferred_in_executable = [t for t in executable_tasks if t.id in deferred_ids]
    
    if len(deferred_in_executable) > len(executable_tasks) * 0.5:
        # 优先处理所有延期任务
        return sort_by_deferral_priority(deferred_in_executable, pmb)
    
    return executable_tasks  # 正常处理
```

---

## 6. 完整示例

### 6.1 输入数据示例

```yaml
# WBS 剩余任务 (假设 35 个)
remaining_tasks:
  - id: auth-001
    description: "Implement JWT token generation"
    complexity: 6
    assignee_role: backend-dev
    blocked_by: []
    risk_level: HIGH
    estimated_hours: 4
    
  - id: auth-002
    description: "Create refresh token logic"
    complexity: 4
    assignee_role: backend-dev
    blocked_by: [auth-001]
    risk_level: MEDIUM
    estimated_hours: 3
    
  - id: auth-003
    description: "Add token validation middleware"
    complexity: 5
    assignee_role: backend-dev
    blocked_by: [auth-001]
    risk_level: HIGH
    estimated_hours: 3
    
  - id: auth-004
    description: "Write auth unit tests"
    complexity: 3
    assignee_role: test-writer
    blocked_by: [auth-001, auth-002]
    risk_level: LOW
    estimated_hours: 2
    
  - id: ui-001
    description: "Design login page mockup"
    complexity: 4
    assignee_role: frontend-dev
    blocked_by: []
    risk_level: LOW
    estimated_hours: 3
    
  - id: ui-002
    description: "Implement login form component"
    complexity: 5
    assignee_role: frontend-dev
    blocked_by: [ui-001]
    risk_level: MEDIUM
    estimated_hours: 4
    
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
  sprint_id: sprint-001
  completed_tasks: [infra-001, infra-002]
  failed_tasks:
    - task_id: infra-003
      failure_reason: "Database connection timeout"
      retry_count: 2
  deferred_tasks:
    - task_id: config-001
      deferred_reason: "Waiting for external API spec"
      priority_boost: 1

# grasp_detect_changes 输出
grasp_detect_changes:
  changed_files: ["src/auth/", "src/config/"]
  affected_modules:
    - module_id: auth-module
      impact_level: 8
      related_tasks: [auth-001, auth-002, auth-003]
  hotspots:
    - file_path: src/auth/token.py
      change_frequency: 15
      bug_association_rate: 0.3
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
  parallelism_score: 5
  estimated_hours: 28
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
  - critical_path.py
  - dependency_filter.py
  - weight_calculator.py
  - parallelism_checker.py
  - boundary_handler.py
```"},"id":"toolu_tool-559ee494ee184ef58e90e551a72d7b5b","type":"tool_use"}],"usage":{"input_tokens":416,"cache_creation_input_tokens":0,"cache_read_input_tokens":146688,"output_tokens":17222,"server_tool_use":{"web_search_requests":0,"web_fetch_requests":0},"service_tier":"standard","cache_creation":{"ephemeral_1h_input_tokens":0,"ephemeral_5m_input_tokens":0},"inference_geo":"","iterations":[],"speed":"standard"},"stop_reason":"tool_use"},"type":"assistant","uuid":"54a534ef-35b2-44da-bbf3-ae094c1c6ff7","timestamp":"2026-04-30T03:04:05.371Z","userType":"external","entrypoint":"cli","cwd":"/Users/archy/Projects/StartUp/oh-my-terminator","sessionId":"ead6ae5a-bdcf-48b4-83b0-a1601e012bbc","version":"2.1.123","gitBranch":"master","forkedFrom":{"sessionId":"eb77d97e-98e3-4637-8e29-30cbb0db9f7c","messageUuid":"54a534ef-35b2-44da-bbf3-ae094c1c6ff7"}}

