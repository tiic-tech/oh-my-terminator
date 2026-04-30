# OMT COMMAND架构顶层评估报告

**评估日期**: 2026-04-30
**评估视角**: 顶层架构师
**评估目标**: 判断COMMAND设计是否充分，I/O协议是否清晰，Agent协作是否可行

---

## 1. COMMAND完整性矩阵

### 1.1 开发生命周期覆盖度

| 开发阶段 | 对应COMMAND | 覆盖状态 | 设计文档 | 问题 |
|---------|------------|---------|---------|------|
| **Idea探索** | omt:brainstorm | ❌ MISSING | 无 | 完全未设计 |
| **需求澄清** | omt:pitch | ❌ MISSING | 无 | 完全未设计 |
| **顶层规范** | omt:tspec | ⚠️ PARTIAL | 01,03 | Agent能力未定义，输入格式模糊 |
| **模块规划** | omt:mspec | ⚠️ PARTIAL | 02,05 | 批量创建未设计，WBS分解缺失 |
| **任务选择** | omt:sprint | ✅ COVERED | 02 | 算法完整，自动化触发未定义 |
| **任务执行** | omt:execute | ❌ MISSING | 无 | Agent执行层完全未设计 |
| **成果审查** | omt:review | ⚠️ PARTIAL | 04 | Sprint级完整，任务级缺失 |
| **验收决策** | (Gap Analysis) | ✅ COVERED | 03 | 计算公式完整 |
| **动态调整** | omt:adjust | ✅ COVERED | 05 | 触发条件完整 |
| **全自动模式** | omt:terminator | ❌ MISSING | 06 | 循环控制未设计 |

### 1.2 与OpenSpec工作流对比

| OpenSpec阶段 | OMT对应COMMAND | 覆盖对比 |
|-------------|---------------|---------|
| **explore** | omt:brainstorm + omt:pitch | OpenSpec有完整explore skill，OMT完全缺失 |
| **propose** | omt:tspec | OpenSpec有proposal.md→design.md→spec.md→tasks.md完整输出，OMT仅概念提及 |
| **apply** | omt:mspec + omt:sprint + omt:execute | OpenSpec自动执行tasks，OMT缺失execute层 |
| **achieve** | omt:review + Gap Analysis | OpenSpec有achieve归档，OMT部分覆盖 |

### 1.3 关键缺失识别

**❌ 完全缺失的COMMAND（P0）**:

1. **omt:brainstorm**
   - 作用：发散讨论，引导用户充分思考
   - 需要：BSAgent角色定义、brainstorm记录格式
   - 影响：没有此阶段，用户idea无法被充分探索

2. **omt:pitch**
   - 作用：收敛澄清，迭代问答直到需求清晰
   - 需要：QAAgent角色定义、pitch问答集格式、终止条件判断
   - 影响：没有此阶段，需求模糊导致后续全部偏离

3. **omt:execute**
   - 作用：执行atom_task，生成代码
   - 需要：Agent执行层架构、TaskRunner、Workflow引擎
   - 影响：**这是最严重的缺失，整个系统无法工作**

4. **omt:terminator**
   - 作用：全自动托管模式
   - 需要：循环控制逻辑、暂停机制、状态机
   - 影响：无法实现"数小时无人干预开发"

---

## 2. I/O协议清晰度评估

### 2.1 COMMAND间数据流转

| COMMAND | 输入来源 | 输出目标 | 格式定义 | 协议清晰度 |
|---------|---------|---------|---------|-----------|
| **omt:brainstorm** | 用户对话 | brainstorm_record | ❌ 无 | 0% - 完全未定义 |
| **omt:pitch** | brainstorm_record | pitch_qa_set | ❌ 无 | 0% - 完全未定义 |
| **omt:tspec** | pitch_qa_set | TSpec artifacts | ⚠️ 部分 | 40% - TSpec结构有，输入格式无 |
| **omt:mspec** | TSpec + grasp | MSpec artifacts | ⚠️ 部分 | 35% - MSpec结构有，批量逻辑无 |
| **omt:sprint** | WBS + PMB + grasp | sprint.yaml | ✅ 有 | 85% - 算法完整 |
| **omt:execute** | sprint.yaml | execution_result | ❌ 无 | 15% - 几乎未定义 |
| **omt:review** | execution + review标准 | review.json | ⚠️ 部分 | 50% - Hook完整，任务级缺失 |

### 2.2 输入格式缺失分析

**brainstorm_record格式缺失**:
```yaml
# 需要定义的格式
brainstorm_record:
  format: markdown 或 yaml?
  sections:
    - idea_origin: 用户原始idea
    - exploration_log: 推导过程记录
    - key_questions: 关键问题列表
    - initial_thoughts: 初步构思
    - constraints_detected: 已识别的约束
    - open_possibilities: 未决可能性
  storage: .omt/brainstorm/record.md?
```

**pitch_qa_set格式缺失**:
```yaml
# 需要定义的格式
pitch_qa_set:
  format: yaml (结构化)
  sections:
    - project_definition: 项目定义
    - goals: 目标列表（SMART原则）
    - constraints: 约束条件（技术、时间、资源）
    - acceptance_criteria: 验收标准
    - milestones_estimate: Milestone数量估算
    - tech_stack: 技术栈选择
    - risks_identified: 已识别风险
  termination_condition: Agent判断"足够清晰"的标准
  storage: .omt/pitch/pitch_record.yaml?
```

### 2.3 状态文件协议分析

| 状态文件 | 设计覆盖 | 用途 | 问题 |
|---------|---------|------|------|
| **brain.json** | ✅ 完整 | Repo健康度、热点 | 格式完整，更新机制完整 |
| **pmb.yaml** | ✅ 完整 | Sprint执行历史 | 格式完整，更新机制完整 |
| **wbs.yaml** | ⚠️ 部分 | atom_tasks列表 | 格式有，生成算法缺失 |
| **sprint.yaml** | ⚠️ 部分 | Sprint任务 | 格式有，自动化触发缺失 |
| **review.json** | ⚠️ 部分 | Sprint审查 | Sprint级有，任务级缺失 |

---

## 3. Agent协作机制评估

### 3.1 Agent类型需求矩阵

| Agent类型 | 所需COMMAND | 当前定义 | 能力需求 | 问题 |
|----------|------------|---------|---------|------|
| **BSAgent** | brainstorm | ❌ 无 | 引导式对话、问题设计、发散思维 | 完全未设计 |
| **QAAgent** | pitch | ❌ 无 | 澄清提问、终止判断、收敛思维 | 完全未设计 |
| **Orchestrator** | tspec, terminator | ⚠️ 概念 | 规划、分解、协调 | 能力未具体化 |
| **SpecAgent** | tspec | ❌ 无 | 文档生成、结构化输出 | 完全未设计 |
| **MSpecGenerator** | mspec | ❌ 无 | 架构设计、WBS分解 | 完全未设计 |
| **WorkerAgent** | execute | ❌ 无 | 代码生成、测试编写、文件操作 | 完全未设计 |
| **ReviewerAgent** | review | ⚠️ 部分 | 代码审查、测试验证 | Sprint级Hook有，Agent未定义 |

### 3.2 Agent能力注册缺失

**assigneeRole → Agent映射缺失**:

```yaml
# 当前wbs.yaml中有assigneeRole字段
AtomTask:
  assigneeRole: "backend-dev"  # 这个角色是什么？

# 缺失的Agent注册表
agent_registry:
  backend-dev:
    capabilities: [typescript, api-design, database]
    workflow: tdd-workflow
    max_concurrent: 3
    
  frontend-dev:
    capabilities: [react, css, ux]
    workflow: code-gen-workflow
    
  test-writer:
    capabilities: [unit-test, integration-test]
    workflow: tdd-workflow
```

### 3.3 Agent信息共享机制

| 共享机制 | 设计覆盖 | 存储位置 | 问题 |
|---------|---------|---------|------|
| **文件共享** | ✅ 有 | .omt/*.yaml, .omt/*.json | 格式有，但Agent读取逻辑未定义 |
| **状态机** | ⚠️ 部分 | brain.json, pmb.json | Sprint状态完整，Agent状态缺失 |
| **共享记忆** | ❌ 无 | 无 | 完全未设计，Agent启动需重建上下文 |
| **通信协议** | ❌ 无 | 无 | Agent间通信方式未定义 |

### 3.4 Agent状态迭代问题

**当前状态机设计**:
```
AtomTask: pending → in_progress → completed | failed | deferred
```

**缺失的Agent状态机**:
```
Agent: IDLE → WORKING → DONE | ERROR | WAITING
       ↓                    ↓
       Task Assignment    Result Report
```

---

## 4. 关键缺失识别

### 4.1 COMMAND缺失（按优先级）

| 缺失项 | 优先级 | 影响范围 | 阻塞程度 |
|--------|--------|---------|---------|
| **omt:execute** | P0 | 整个系统 | 完全阻塞 - 无法执行任何任务 |
| **omt:brainstorm** | P0 | 需求阶段 | 完全阻塞 - idea无法被充分探索 |
| **omt:pitch** | P0 | 需求阶段 | 完全阻塞 - 需求无法被澄清 |
| **Agent执行层** | P0 | 执行阶段 | 完全阻塞 - TaskRunner不存在 |
| **WBS分解算法** | P0 | 规划阶段 | 完全阻塞 - 无法生成atom_tasks |
| **omt:terminator循环** | P1 | 自动化 | 高阻塞 - 无法实现全自动 |
| **Agent注册表** | P1 | 协作层 | 中阻塞 - 无法分配任务 |
| **输入格式定义** | P1 | 数据层 | 中阻塞 - 无法标准化 |
| **任务级审查** | P2 | 反馈环 | 低阻塞 - Sprint级可替代 |

### 4.2 I/O协议缺失

| 缺失项 | 问题 | 需要 |
|--------|------|------|
| **brainstorm→pitch转换** | 无格式定义，无法自动判断何时终止brainstorm | brainstorm_record格式 + Agent判断逻辑 |
| **pitch→tspec转换** | 无转换算法，无法自动生成TSpec | pitch_qa_set格式 + TSpec生成Agent |
| **tspec→mspec转换** | 批量创建逻辑缺失 | Milestone解析 + MSpec批量生成 |
| **mspec→sprint转换** | 触发机制缺失 | 自动化Sprint启动 |
| **sprint→execute转换** | Agent分配缺失 | TaskRunner + Agent调度 |

---

## 5. 补充设计建议

### 5.1 必需新增的COMMAND设计文档

| 文档编号 | 文档名称 | 优先级 | 内容 |
|----------|----------|--------|------|
| **08** | brainstorm_pitch_workflow.md | P0 | BSAgent/QAAgent设计、输入输出格式、终止条件 |
| **09** | agent_executor_system.md | P0 | TaskRunner、AgentPool、Workflow引擎、状态机 |
| **10** | wbs_decomposition.md | P0 | Design→atom_tasks转换、复杂度估算、DAG构建 |
| **11** | agent_registry.md | P1 | Agent能力注册、assigneeRole映射、调度算法 |
| **12** | terminator_loop.md | P1 | 循环控制、暂停机制、状态恢复 |
| **13** | input_output_formats.md | P1 | 所有COMMAND的I/O协议定义 |

### 5.2 现有文档补充建议

| 文档 | 补充内容 |
|------|---------|
| **01** | 补充完整COMMAND流程图、Agent角色概览 |
| **02** | 补充Sprint自动触发逻辑、Agent调度映射 |
| **03** | 补充验收触发时机（所有MSpec完成后） |
| **04** | 补充任务级即时审查Hook |
| **05** | 补充terminator模式下弱触发自动决策 |
| **06** | 补充brainstorm/pitch阶段的缺失分析 |

---

## 6. 修正后的完整COMMAND体系

### 6.1 用户工作流（手动模式）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OMT 用户工作流（手动模式）                                   │
└─────────────────────────────────────────────────────────────────────────────┘

用户输入idea
    │
    ▼
omt:brainstorm ─────────────────────────────────────────────────────────────►
    │  [BSAgent引导探索]
    │  [输出: .omt/brainstorm/record.yaml]
    │
    ▼
omt:pitch ───────────────────────────────────────────────────────────────────►
    │  [QAAgent迭代问答]
    │  [终止条件: Agent判断足够清晰]
    │  [输出: .omt/pitch/pitch_record.yaml]
    │
    ▼
omt:tspec ───────────────────────────────────────────────────────────────────►
    │  [SpecAgent生成]
    │  [输入: pitch_record.yaml + grasp_brain_index]
    │  [输出: .omt/tspecs/tspec_<ts>/proposal.md, design.md, milestones.md]
    │
    ▼
omt:mspec ───────────────────────────────────────────────────────────────────►
    │  [MSpecGenerator批量创建]
    │  [输入: tspec.milestones + grasp_brain_index]
    │  [输出: 所有MSpecs + WBS]
    │
    ▼
omt:sprint ───────────────────────────────────────────────────────────────────►
    │  [Sprint Selection Algorithm]
    │  [输入: WBS + PMB + grasp_detect_changes]
    │  [输出: .omt/.../sprints/sprint_<num>/tasks.yaml]
    │
    ▼
omt:execute ──────────────────────────────────────────────────────────────────►
    │  [Agent Pool执行]
    │  [输入: tasks.yaml]
    │  [输出: execution_result]
    │
    ▼
omt:review ───────────────────────────────────────────────────────────────────►
    │  [ReviewerAgent审查]
    │  [Hook: Sprint Commit Hook]
    │  [输出: review.json + PMB更新]
    │
    ▼
[循环 sprint 直到 MSpec.WBS 完成]
    │
    ▼
omt:status ───────────────────────────────────────────────────────────────────►
    │  [查看当前进度]
    │
    ▼
[继续 omt:sprint 或 执行 omt:terminator 进入全自动]
```

### 6.2 Terminator模式（全自动）

```
omt:terminator <start_point>
    │
    ├─ start_point = "pitch" → 执行 tspec → mspec → sprint_loop → review_loop → acceptance
    ├─ start_point = "tspec" → 执行 mspec → sprint_loop → review_loop → acceptance
    ├─ start_point = "mspec" → 执行 sprint_loop → review_loop → acceptance
    ├─ start_point = "sprint" → 继续当前Sprint → review_loop → acceptance
    │
    ▼
[自动化循环控制]
    │
    ├── Sprint Loop: while WBS.remaining > 0
    │     ├─ omt:sprint (Selection)
    │     ├─ omt:execute (TaskRunner)
    │     ├─ omt:review (Hook)
    │     └─ 检查暂停条件
    │
    ├── MSpec Loop: while MSpecs.remaining > 0
    │     ├─ MSpec Gap Check
    │     ├─ MSpec Adjustment (如有)
    │     └─ 选择下一个MSpec
    │
    └── Acceptance
          ├─ Gap Analysis
          ├─ 决策: ACCEPTED / NEW_MSPEC / FAILED
          └─ 输出验收报告
```

### 6.3 新增COMMAND定义

```markdown
# /omt:brainstorm
- 作用: 发散讨论，引导用户充分探索idea
- Agent: BSAgent (引导式对话、问题设计)
- 输入: 用户自由对话
- 输出: .omt/brainstorm/record.yaml
- 终止: 用户明确结束 或 Agent判断已充分探索

# /omt:pitch
- 作用: 收敛澄清，迭代问答直到需求足够清晰
- Agent: QAAgent (澄清提问、终止判断)
- 输入: brainstorm_record.yaml
- 输出: .omt/pitch/pitch_record.yaml
- 终止: Agent判断收集信息足以生成TSpec (阈值未定义需补充)

# /omt:status
- 作用: 查看当前项目状态
- 输入: 无
- 输出: 当前阶段、进度、健康度
- 状态来源: brain.json + pmb.yaml + 当前artifacts

# /omt:terminator
- 作用: 全自动托管模式
- 触发: pitch后任意节点
- 暂停: CRITICAL_FAILURE / EXTERNAL_BLOCKER / USER_PAUSE
- 恢复: /omt:terminator:resume

# /omt:abort
- 作用: 终止当前terminator模式
- 输出: 当前状态报告
```

---

## 7. COMMAND I/O协议定义（建议新增的设计文档）

### 7.1 brainstorm_record.yaml 格式

```yaml
# .omt/brainstorm/record.yaml
version: "1.0"
created_at: <timestamp>
updated_at: <timestamp>
status: active | completed

idea_origin:
  raw_input: "<用户原始输入>"
  detected_domain: "<自动检测的领域>"
  
exploration_log:
  - turn_id: 1
    user_message: "<用户消息>"
    agent_response: "<Agent引导>"
    questions_raised: ["<衍生问题>"]
    
  - turn_id: 2
    # ...
    
key_insights:
  - "<关键洞察>"
  
constraints_detected:
  - type: technical | time | resource
    description: "<约束描述>"
    
open_possibilities:
  - "<待探索的可能性>"
  
termination:
  reason: "user_explicit_end" | "sufficient_exploration"
  timestamp: <timestamp>
```

### 7.2 pitch_qa_set.yaml 格式

```yaml
# .omt/pitch/pitch_record.yaml
version: "1.0"
created_at: <timestamp>
qa_complete_at: <timestamp>
status: completed

project_definition:
  name: "<项目名称>"
  description: "<一句话描述>"
  domain: "<业务领域>"
  
goals:
  - id: G1
    description: "<目标描述>"
    measurable: "<可测量标准>"
    priority: HIGH | MEDIUM | LOW
    
constraints:
  - id: C1
    type: technical | time | resource | compliance
    description: "<约束描述>"
    impact: "<影响范围>"
    
acceptance_criteria:
  - id: AC1
    criterion: "<验收标准>"
    verification_method: "<验证方法>"
    
milestones_estimate:
  count: <数量>
  sequence: ["M1", "M2", ...]
  dependencies:
    - M2 blocked_by M1
    
tech_stack:
  language: "<语言>"
  framework: "<框架>"
  build_tool: "<构建工具>"
  
risks_identified:
  - id: R1
    description: "<风险描述>"
    level: HIGH | MEDIUM | LOW
    mitigation: "<缓解措施>"
    
qa_session:
  - question_id: Q1
    question: "<Agent提问>"
    answer: "<用户回答>"
    clarity_score: 0-10
    
  - question_id: Q2
    # ...
    
termination:
  reason: "clarity_threshold_reached"
  threshold: "<Agent判断阈值>"
  final_clarity_score: <score>
```

### 7.3 Agent→Agent通信协议

```yaml
# Agent通信消息格式
agent_message:
  from: "<source_agent_id>"
  to: "<target_agent_id>"
  type: task_assignment | task_result | status_update | query
  timestamp: <timestamp>
  
  payload:
    # 根据type不同
    
    task_assignment:
      task_id: "<atom_task_id>"
      context: "<任务上下文>"
      
    task_result:
      task_id: "<atom_task_id>"
      status: COMPLETED | FAILED | DEFERRED
      artifacts: ["<产出文件路径>"]
      error_message: "<失败原因>"  # if FAILED
      
    status_update:
      agent_state: IDLE | WORKING | WAITING | ERROR
      current_task: "<task_id>"  # if WORKING
      
    query:
      query_type: "<查询类型>"
      query_content: "<查询内容>"
```

---

## 8. 结论

### 8.1 COMMAND设计充分性评估

**当前状态：不充分（覆盖度约45%）**

| 评估维度 | 评分 | 问题 |
|---------|------|------|
| COMMAND完整性 | 45% | brainstorm/pitch/execute完全缺失 |
| I/O协议清晰度 | 35% | 输入格式未定义，转换逻辑缺失 |
| Agent协作机制 | 25% | Agent类型未定义，调度缺失 |
| 自动化可行性 | 54% | terminator循环控制缺失 |

### 8.2 核心结论

1. **工作流拆解不完整**
   - 缺失需求阶段（brainstorm/pitch）的设计
   - 缺失执行阶段（execute）的设计
   - 无法实现完整的"idea→交付"闭环

2. **I/O协议不清晰**
   - 输入格式（brainstorm_record, pitch_record）未定义
   - COMMAND间转换算法缺失
   - Agent无法标准化处理数据

3. **Agent协作机制缺失**
   - Agent类型和能力未定义
   - assigneeRole→Agent映射缺失
   - Agent间通信协议未定义
   - 共享记忆机制未设计

4. **状态迭代机制不完整**
   - AtomTask状态机有
   - Agent状态机缺失
   - terminator循环控制缺失

### 8.3 优先补充顺序

**Phase 1（基础补全 - 2周）**:
```
1. 设计 omt:brainstorm + omt:pitch workflow (08文档)
2. 设计 Agent执行层架构 (09文档)
3. 设计 WBS分解算法 (10文档)
```

**Phase 2（协作补全 - 1周）**:
```
4. 设计 Agent注册表 (11文档)
5. 定义 所有COMMAND I/O协议 (13文档)
```

**Phase 3（自动化补全 - 1周）**:
```
6. 设计 terminator循环控制 (12文档)
7. 设计 Agent通信协议
```

### 8.4 最终建议

**当前COMMAND体系不能支持Agent Team正确迭代**

需要补充的关键设计：
- P0: brainstorm/pitch需求阶段设计（否则无法捕获清晰需求）
- P0: Agent执行层设计（否则无法执行任何任务）
- P0: WBS分解算法（否则无法生成可执行任务）
- P1: Agent注册与调度（否则无法分配任务）
- P1: I/O协议标准化（否则无法标准化数据流转）

---

**评估完成日期**: 2026-04-30
**下一步**: 补充08_brainstorm_pitch_workflow.md设计文档