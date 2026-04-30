# OMT架构E2E验证报告

**验证日期**: 2026-04-30
**验证场景**: pitch结束后，运行omt:terminator，完全托管直到完成mspecs.yaml所有内容，自主验收成果并标记tspec完成
**验证视角**: 真实用户视角

---

## 1. 场景定义

### 1.1 用户工作流设想

用户期望的完整自动化流程：

```
┌─────────────────────────────────────────────────────────────────────┐
│                    omt:terminator 自动化流程                          │
└─────────────────────────────────────────────────────────────────────┘

pitch结束
    │
    ▼
omt:tspec ──────────────────────────────────────────────────────────►
    │  [输入: brainstorm记录 + pitch问答集]
    │  [输出: TSpec (proposal, design, milestones, reviews)]
    ▼
omt:mspec ──────────────────────────────────────────────────────────►
    │  [输入: TSpec.milestones + grasp_brain_index]
    │  [输出: 所有 MSpecs (一次性创建)]
    │  [关键问题: 如何一次性创建多个MSpec？WBS如何分解？]
    ▼
omt:sprint ─────────────────────────────────────────────────────────►
    │  [输入: 当前MSpec.WBS + PMB + grasp_detect_changes]
    │  [输出: Sprint (Top 10 tasks)]
    │  [关键问题: 选择算法是否足够自动化？]
    ▼
omt:execute ────────────────────────────────────────────────────────►
    │  [输入: Sprint atom_tasks]
    │  [输出: 执行结果 (completed/failed/deferred)]
    │  [关键问题: Agent执行层是否定义？]
    ▼
omt:review ─────────────────────────────────────────────────────────►
    │  [输入: Sprint执行结果 + MSpec.review标准]
    │  [输出: Sprint Review + PMB更新]
    │  [关键问题: 审查机制是否完整？]
    ▼
[循环 sprint 直到 MSpec.WBS 完成]
    │
    ▼
Gap Analysis ───────────────────────────────────────────────────────►
    │  [输入: TSpec + 所有MSpec reviews + brain.json + grasp]
    │  [输出: Gap Report + 验收决策]
    │  [关键问题: 验收机制是否足够？]
    ▼
MSpec Adjustment ───────────────────────────────────────────────────►
    │  [输入: M_current Review + M_next MSpec]
    │  [输出: M_next MSpec v1.1 (如有)]
    │  [关键问题: 动态调整是否支持？]
    ▼
[循环 milestone 直到所有MSpec 完成]
    │
    ▼
项目验收 ───────────────────────────────────────────────────────────►
    │  [输出: 验收通过/创建补充MSpec]
    │  [标记: TSpec Complete]
```

### 1.2 输入数据盘点

pitch结束后的系统输入：

| 输入项 | 来源 | 内容 | 设计文档覆盖 |
|--------|------|------|-------------|
| brainstorm记录 | omt:brainstorm | 原始idea、探索过程、初步构思 | ❌ 未定义 |
| pitch问答集 | omt:pitch | 项目定义、目标、约束、验收标准 | ❌ 未定义 |
| repo当前状态 | grasp_brain_index | 全repo关系模型、健康度 | ✅ Module 1 设计 |
| PMB初始状态 | .omt/memory/pmb.json | Sprint执行历史 (空) | ✅ Sprint Commit Hook |

---

## 2. 验证结果

### 2.1 各环节状态汇总

| 环节 | 状态 | 支持度 | GAP描述 |
|------|------|--------|---------|
| omt:tspec | PARTIAL | 40% | Agent能力未定义，输入输出格式模糊 |
| omt:mspec | PARTIAL | 35% | 一次性创建多个MSpec未设计，WBS分解算法缺失 |
| omt:sprint | GOOD | 85% | 选择算法完整，但自动化触发未定义 |
| omt:execute | MISSING | 15% | Agent执行层几乎未定义 |
| omt:review | PARTIAL | 50% | Sprint级审查存在，但任务级即时审查缺失 |
| Gap Analysis | GOOD | 90% | 计算公式完整，决策逻辑清晰 |
| MSpec Adjustment | GOOD | 85% | 触发条件清晰，调整操作完整 |

### 2.2 详细分析

#### 2.2.1 omt:tspec 分析

**当前设计覆盖**:
- TSpec 结构定义 (proposal, design, milestones, reviews) ✅
- TSpec 与 MSpec 的层级关系 ✅
- pre-mspec hook 与 grasp_brain_index 集成 ✅

**关键缺失**:
- ❌ **omt:tspec Agent 能力定义**: 需要什么类型的Agent来执行TSpec生成？
- ❌ **输入数据格式**: brainstorm记录和pitch问答集的具体格式未定义
- ❌ **TSpec生成算法**: 从pitch问答集到TSpec的转换逻辑未定义
- ❌ **Milestone识别**: 如何从pitch中识别出多个Milestone？
- ❌ **Milestone优先级**: 多个Milestone的Fin-Start顺序如何确定？

**自动化障碍**: 
- 无法自动判断pitch内容是否足够生成TSpec
- 无法自动确定Milestone数量和依赖关系
- 需要"规划Agent"参与，但Agent能力未定义

---

#### 2.2.2 omt:mspec 分析

**当前设计覆盖**:
- MSpec 结构定义 (proposal, design, sprints, reviews) ✅
- WBS 结构定义 (atom_tasks, blockedBy, DAG) ✅
- pre-mspec hook 触发逻辑 ✅
- MSpec 微调机制 (05文档) ✅

**关键缺失**:
- ❌ **一次性创建多个MSpec**: 设计仅覆盖单MSpec场景，未说明如何批量创建
- ❌ **WBS分解算法**: 从MSpec Design到atom_tasks的分解逻辑未定义
- ❌ **任务复杂度估算**: complexity字段如何计算？
- ❌ **任务风险评估**: riskLevel如何确定？
- ❌ **DAG构建**: blockedBy依赖关系如何自动生成？
- ❌ **MSpec.yaml文件格式**: mspecs.yaml的YAML schema未定义

**自动化障碍**:
- 无法自动将Design转换为atom_tasks
- 无法自动估算任务复杂度
- 需要"技术架构Agent"参与进行WBS分解

---

#### 2.2.3 omt:sprint 分析

**当前设计覆盖**:
- Sprint Selection Algorithm 完整 ✅ (02文档)
- 权重因子设计合理 ✅
- 并行度约束处理 ✅
- 边界情况处理 ✅
- DAG拓扑排序 ✅
- 关键路径计算 ✅

**部分缺失**:
- ⚠️ **自动化触发**: Sprint Selection何时触发？是自动循环还是需要命令？
- ⚠️ **Agent Pool调度**: Agent能力注册表未定义
- ⚠️ **assigneeRole映射**: 如何将任务分配给合适的Agent？

**自动化支持度**: 85% - 算法层面完整，但调度层面需补充

---

#### 2.2.4 omt:execute 分析

**当前设计覆盖**:
- Task runner 概念提及 ✅ (01文档概述)
- TDD workflow 概念提及 ✅

**严重缺失**:
- ❌ **Agent执行层架构**: 完全未定义具体实现
- ❌ **Task Runner实现**: 如何执行单个atom_task？
- ❌ **Agent Pool管理**: 如何创建、调度、监控Agent？
- ❌ **Workflow引擎**: TDD workflow的具体步骤未定义
- ❌ **Agent状态机**: pending/working/done/fail的转换逻辑未定义
- ❌ **失败处理**: retry策略、降级机制未定义
- ❌ **进度跟踪**: 如何知道任务执行进度？
- ❌ **文件产出**: 任务产出如何保存到指定位置？

**自动化障碍**:
- 这是最严重的缺失环节
- 无法实际执行任何atom_task
- 需要"06_agent_executor_system.md"补充设计

---

#### 2.2.5 omt:review 分析

**当前设计覆盖**:
- Sprint Review Gate 概念 ✅
- Sprint Commit Hook实现 ✅ (04文档)
- brain.json 更新逻辑 ✅
- PMB 更新逻辑 ✅

**部分缺失**:
- ⚠️ **任务级即时审查**: 设计建议增加但未定义实现
- ⚠️ **审查标准定义**: MSpec.review标准的具体内容未定义
- ⚠️ **审查Agent**: 需要什么类型的Agent执行审查？

**自动化障碍**:
- Sprint级审查可以自动化（通过Commit Hook）
- 任务级审查需要额外设计

---

#### 2.2.6 Gap Analysis 分析

**当前设计覆盖**:
- Feature Gap计算公式完整 ✅ (03文档)
- Quality Gap计算公式完整 ✅
- Test Gap计算公式完整 ✅
- Security Gap计算公式完整 ✅
- 综合 Gap计算完整 ✅
- 验收决策阈值清晰 ✅
- 新MSpec创建触发条件 ✅

**轻微缺失**:
- ⚠️ **数据获取**: TSpec交付物清单如何自动提取？
- ⚠️ **grasp查询集成**: grasp_brain_index查询的具体MCP调用未定义

**自动化支持度**: 90% - 计算层面完整，数据获取需补充

---

#### 2.2.7 MSpec Adjustment 分析

**当前设计覆盖**:
- 强触发条件定义完整 ✅ (05文档)
- 弱触发条件定义完整 ✅
- 无触发条件定义完整 ✅
- 微调决策算法清晰 ✅
- Scope/Target/WBS微调类型 ✅
- MSpec v1.1输出格式 ✅

**部分缺失**:
- ⚠️ **自动化执行**: 微调判断是自动执行还是需要用户确认？
- ⚠️ **弱触发用户决策**: terminator模式下如何处理弱触发？

**自动化支持度**: 85% - 逻辑完整，自动化决策需明确

---

## 3. 关键缺失分析

### 3.1 最严重缺失：Agent执行层

**问题**: omt:execute环节几乎完全未定义

**影响**: 
- 无法执行任何atom_task
- 整个工作流在Sprint层面就会停止
- terminator模式无法实现

**需要补充的设计**:

```yaml
06_agent_executor_system:
  core_components:
    - TaskRunner: 单任务执行器
    - AgentPool: Agent池管理
    - WorkflowEngine: Workflow引擎 (TDD等)
    - ProgressTracker: 进度跟踪
    - FailureHandler: 失败处理
  
  agent_state_machine:
    states: [PENDING, WORKING, DONE, FAIL]
    transitions:
      PENDING → WORKING: 任务开始
      WORKING → DONE: 任务完成
      WORKING → FAIL: 执行失败
      FAIL → PENDING: retry
      FAIL → DEFERRED: 超过retry上限
  
  workflow_types:
    - tdd-workflow: RED→GREEN→IMPROVE
    - code-gen-workflow: 设计→实现→测试
    - review-workflow: 检查→修复→验证
```

---

### 3.2 严重缺失：WBS分解算法

**问题**: 从MSpec Design到atom_tasks的转换未定义

**影响**:
- 无法自动生成可执行的任务列表
- mspecs.yaml中的atom_tasks需要人工填写
- terminator模式无法实现

**需要补充的设计**:

```yaml
07_wbs_decomposition:
  input: MSpec.design (modules, interfaces, constraints)
  output: atom_tasks[] + DAG
  
  algorithm:
    step_1_module_breakdown:
      - 将每个module拆解为atomic functions
      - 识别function间的依赖关系
    
    step_2_task_generation:
      - function → atom_task (id, description)
      - 估算complexity (基于function复杂度)
      - 评估riskLevel (基于技术难度)
    
    step_3_dag_construction:
      - 建立blockedBy依赖图
      - 检测循环依赖
      - 计算关键路径
    
    step_4_validation:
      - 验证任务覆盖率
      - 验证依赖合理性
```

---

### 3.3 中等缺失：Agent能力注册

**问题**: assigneeRole如何映射到实际Agent？

**影响**:
- 无法将任务分配给合适的Agent
- Agent Pool调度无法工作

**需要补充的设计**:

```yaml
08_agent_registry:
  agent_types:
    orchestrator:
      capabilities: [planning, decomposition, review]
      max_concurrent: 1
    
    backend-dev:
      capabilities: [typescript, api-design, database]
      workflow: tdd-workflow
    
    frontend-dev:
      capabilities: [react, css, ux]
      workflow: code-gen-workflow
    
    test-writer:
      capabilities: [unit-test, integration-test, e2e]
      workflow: tdd-workflow
    
    security-reviewer:
      capabilities: [security-scan, vulnerability-fix]
      workflow: review-workflow
  
  task_matching:
    - atom_task.assigneeRole → agent_type
    - 检查agent可用性
    - 分配任务
```

---

### 3.4 输入数据格式缺失

**问题**: brainstorm记录和pitch问答集的具体格式未定义

**影响**:
- omt:tspec无法自动解析输入
- terminator模式启动条件不明确

**需要补充的设计**:

```yaml
09_input_formats:
  brainstorm_record:
    format: markdown
    sections:
      - idea_origin: 原始idea描述
      - exploration_log: 探索过程记录
      - initial_thoughts: 初步构思
  
  pitch_qa_set:
    format: structured_yaml
    sections:
      - project_definition: 项目定义
      - goals: 目标列表
      - constraints: 约束条件
      - acceptance_criteria: 验收标准
      - estimated_milestones: Milestone估算
```

---

### 3.5 自动化循环控制缺失

**问题**: Sprint → Sprint → MSpec → MSpec 的循环控制未定义

**影响**:
- terminator模式无法自动循环
- 需要人工触发每个环节

**需要补充的设计**:

```yaml
10_automation_loop:
  terminator_mode:
    enabled: true
    
    loop_control:
      sprint_loop:
        trigger: WBS.remaining_tasks > 0
        exit: WBS.remaining_tasks = 0 OR blocked
        
      milestone_loop:
        trigger: MSpecs.remaining > 0
        exit: MSpecs.all_complete OR Gap > 30%
        
      project_loop:
        trigger: Gap < 10%
        exit: project_accepted
    
    pause_conditions:
      - critical_failure: 等待用户介入
      - external_blocker: 等待外部依赖
      - user_intervention: 用户主动暂停
```

---

## 4. 补充设计建议

### 4.1 必需新增设计文档

| 文档编号 | 文档名称 | 优先级 | 覆盖内容 |
|----------|----------|--------|---------|
| 06 | agent_executor_system.md | P0 | Agent执行层架构 |
| 07 | wbs_decomposition.md | P0 | WBS分解算法 |
| 08 | agent_registry.md | P1 | Agent能力注册 |
| 09 | input_formats.md | P1 | 输入数据格式定义 |
| 10 | automation_loop.md | P1 | 自动化循环控制 |

### 4.2 现有文档补充建议

| 文档 | 补充内容 |
|------|---------|
| 01_origin_blueprint.md | 补充pitch输入格式、Agent角色定义概览 |
| 02_sprint_selection_algorithm.md | 补充Sprint循环触发逻辑、Agent调度映射 |
| 03_gap_analysis_standard.md | 补充TSpec交付物自动提取逻辑 |
| 04_sprint_commit_hook.md | 补充任务级审查触发 |
| 05_mspec_adjustment_mechanism.md | 补充terminator模式下弱触发自动决策 |

---

## 5. 工作流命令设计

### 5.1 omt:terminator 命令定义

```markdown
# /omt:terminator

## 触发条件
- pitch已完成 (pitch问答集存在)
- 用户确认启动terminator模式

## 执行流程

### Phase 1: TSpec Generation
1. 读取 `.omt/pitch/pitch_record.yaml`
2. 调用 Orchestrator Agent 生成 TSpec
3. 输出 `.omt/tspecs/tspec_<timestamp>/tspec.yaml`

### Phase 2: MSpecs Generation (一次性)
1. 解析 TSpec.milestones
2. For each Milestone (顺序):
   - 调用 pre-mspec hook (grasp_brain_index)
   - 调用 MSpec Generator Agent
   - 输出 `.omt/tspecs/tspec_<ts>/mspecs/mspec_<ts>/mspec.yaml`
3. 生成 `mspecs.yaml` (所有MSpec索引)

### Phase 3: Sprint Loop (自动化)
1. 选择当前MSpec
2. While WBS.remaining_tasks > 0:
   - 执行 Sprint Selection Algorithm
   - 输出 Sprint atom_tasks
   - 执行 omt:execute
   - 执行 omt:review
   - 更新 PMB
   - 检查暂停条件
3. 执行 MSpec Gap Check
4. 执行 MSpec Adjustment (如有触发)

### Phase 4: Milestone Loop
1. 选择下一个MSpec
2. 执行 Phase 3
3. 直到所有MSpec完成

### Phase 5: Project Acceptance
1. 执行 Gap Analysis
2. 决策: ACCEPTED / NEW_MSPEC / FAILED
3. 输出验收报告

## 暂停机制
- CRITICAL_FAILURE → 等待用户
- EXTERNAL_BLOCKER → 等待外部
- USER_PAUSE → 用户主动暂停

## 恢复机制
- /omt:terminator:resume → 从暂停点继续
- /omt:terminator:abort → 终止并输出报告
```

### 5.2 子命令定义

```markdown
# /omt:tspec
- 输入: pitch_record.yaml
- 输出: tspec.yaml
- Agent: Orchestrator (planning capability)

# /omt:mspec
- 输入: tspec.milestones[N] + grasp_brain_index
- 输出: mspec.yaml (含WBS)
- Agent: MSpec Generator (architecture capability)

# /omt:sprint
- 输入: WBS + PMB + grasp_detect_changes
- 输出: sprint.yaml (Top 10 tasks)
- Algorithm: Sprint Selection (已定义)

# /omt:execute
- 输入: sprint.yaml
- 输出: execution_result
- Agent: Agent Pool (执行层)

# /omt:review
- 输入: execution_result + mspec.review标准
- 输出: review.json + PMB更新
- Hook: Sprint Commit Hook (已定义)
```

---

## 6. 结论

### 6.1 当前设计覆盖度评估

| 层级 | 设计覆盖度 | 自动化可行度 |
|------|------------|--------------|
| 数据层 | 75% | 中等 |
| 算法层 | 80% | 较高 |
| Agent层 | 20% | 极低 |
| 控制层 | 40% | 较低 |

**综合评估**: 当前设计约 **54%** 支持terminator模式自动化

### 6.2 实现terminator模式的路径

**Phase 1 (基础补全) - 2周**:
- 补充 06_agent_executor_system.md
- 补充 07_wbs_decomposition.md
- 定义 Agent 能力注册

**Phase 2 (输入标准化) - 1周**:
- 补充 09_input_formats.md
- 实现 pitch → TSpec 转换逻辑

**Phase 3 (自动化循环) - 1周**:
- 补充 10_automation_loop.md
- 实现 terminator 模式控制逻辑

**Phase 4 (集成测试) - 1周**:
- E2E 测试完整流程
- 修复边界问题

### 6.3 最终结论

**omt:terminator模式当前无法实现**

主要原因：
1. Agent执行层严重缺失（最关键）
2. WBS分解算法未定义
3. 输入数据格式未标准化
4. 自动化循环控制未设计

**建议优先级**：
- P0: 实现 Agent执行层（否则整个系统无法工作）
- P0: 定义 WBS分解算法（否则无法生成可执行任务）
- P1: 标准化输入格式
- P1: 实现自动化循环控制

---

## 附录: 设计文档覆盖矩阵

| 功能需求 | 01 | 02 | 03 | 04 | 05 | 覆盖状态 |
|---------|----|----|----|----|----|----|
| Repo关系建模 | ✅ | - | - | ✅ | - | COVERED |
| TSpec结构 | ✅ | - | ✅ | - | - | PARTIAL |
| MSpec结构 | ✅ | ✅ | - | - | ✅ | PARTIAL |
| WBS分解 | - | ⚠️ | - | - | - | MISSING |
| Sprint选择 | - | ✅ | - | - | - | COVERED |
| Agent执行 | ⚠️ | - | - | - | - | MISSING |
| Sprint审查 | - | ⚠️ | - | ✅ | - | PARTIAL |
| Gap分析 | - | - | ✅ | - | - | COVERED |
| MSpec微调 | - | - | - | - | ✅ | COVERED |
| 自动化循环 | - | - | - | - | - | MISSING |