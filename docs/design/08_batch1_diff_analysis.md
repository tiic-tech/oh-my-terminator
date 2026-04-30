# OMT架构定位分析 - Batch 1：差异分析与借鉴决策

**分析日期**: 2026-04-30
**分析目标**: 明确OMT独特定位，批判性评估参考项目，输出借鉴决策矩阵

---

## 1. OMT独特定位定义

### 1.1 与OpenSpec的核心差异矩阵

| 维度 | OpenSpec | OMT | 差异本质 |
|------|----------|-----|---------|
| **生命周期范围** | 单次Change生命周期 | 多Sprint长周期开发 | OMT覆盖完整开发周期，OpenSpec只覆盖单个变更 |
| **任务持续性** | Change完成即结束 | Sprint循环直到验收通过 | OMT有持续迭代机制，OpenSpec无循环 |
| **上下文持久化** | 无持久化（Change内临时） | brain.json + pmb.yaml持久化 | OMT有Repo记忆和Sprint历史，OpenSpec无记忆 |
| **Agent状态管理** | 无Agent概念 | Agent全生命周期管理 | OMT有Agent状态机，OpenSpec只有隐含协作 |
| **任务分解** | Schema定义Artifact依赖图 | 四层artifacts（TSpec→MSpec→Sprint→AtomTask） | OMT有更复杂的任务层级，OpenSpec只有Artifact |
| **执行引擎** | Skill/Command触发（CLI信息交换） | DAG Executor + TaskRunner + Agent Pool | OMT有完整执行引擎，OpenSpec依赖外部Skill |
| **失败恢复** | 无恢复机制（重新执行Change） | Sprint失败恢复 + PMB记录 | OMT有失败追踪和恢复，OpenSpec无恢复设计 |
| **进度监控** | CLI status查询 | PMB实时更新 + brain.json监控 | OMT有实时监控，OpenSpec只有手动查询 |
| **自动化程度** | 手动触发每个Artifact | Terminator全自动托管 | OMT有全自动化模式，OpenSpec全手动 |
| **Repo建模** | 无repo概念 | grasp repo建模 + 状态追踪 | OMT有完整repo抽象，OpenSpec无repo概念 |

### 1.2 与Agency-Orchestrator的核心差异矩阵

| 维度 | Agency-Orchestrator | OMT | 差异本质 |
|------|---------------------|-----|---------|
| **执行粒度** | 单次Workflow执行（YAML一次性） | 多Sprint循环（持续执行） | OMT是持续性系统，Agency是一次性执行 |
| **状态持久化** | 无持久化（内存Context Map） | brain.json + pmb.yaml + artifacts持久化 | OMT有完整状态持久化，Agency无持久化 |
| **上下文重建** | 每次执行需重新加载 | Agent启动时有完整上下文 | OMT有共享记忆，Agency每次冷启动 |
| **中间过程** | 不存储中间步骤 | PMB记录每步执行结果 | OMT有完整执行记录，Agency只存最终结果 |
| **Agent监控** | 无监控（执行结束即销毁） | Agent生命周期监控（spawn→monitor→销毁） | OMT有Agent监控机制，Agency无监控 |
| **失败恢复** | Retry机制（内存级） | Sprint失败恢复 + 任务级重试 | OMT有持久化恢复，Agency只有内存级Retry |
| **任务分解** | 人工定义Workflow步骤 | 自动WBS分解 + Sprint Selection | OMT有自动任务分解，Agency需人工定义 |
| **动态调整** | 无调整机制（YAML静态） | Gap Analysis + MSpec动态调整 | OMT有动态调整机制，Agency静态执行 |
| **验收闭环** | 无验收概念（执行结束即结束） | Gap Analysis验收决策 | OMT有验收闭环，Agency无验收概念 |
| **Skill注入** | 无Skill概念 | Skill动态注入（按assigneeRole） | OMT有Skill系统，Agency只有Agent定义 |
| **Context组装** | YAML inputs + Step outputs | 动态Context组装（MSpec Design + Dependencies + Brain） | OMT有复杂Context组装，Agency简单变量传递 |

### 1.3 OMT的独特能力清单（参考项目无法提供）

| OMT独特能力 | OpenSpec | Agency | 说明 |
|-------------|----------|--------|------|
| **完整状态机管理** | ❌ 无 | ❌ 无 | AtomTask状态机 + Agent状态机 + Sprint状态机 |
| **上下文持久化** | ❌ 无 | ❌ 无 | brain.json（Repo健康度）+ pmb.yaml（Sprint历史） |
| **Agent全生命周期** | ❌ 无 | ⚠️ 部分 | spawn → monitor → 销毁 + 状态追踪 |
| **Skill动态注入** | ⚠️ 有Skill但静态 | ❌ 无 | 按assigneeRole动态注入Skill |
| **Context动态组装** | ⚠️ 部分静态 | ⚠️ 简单变量 | MSpec Design + Dependencies + Brain + PMB |
| **四层artifacts对齐** | ❌ 单层 | ❌ 无 | TSpec→MSpec→Sprint→AtomTask一致性对齐 |
| **动态任务DAG创建** | ❌ 无 | ⚠️ 人工定义 | 自动WBS分解 + Sprint Selection算法 |
| **任务全生命周期** | ❌ 无 | ❌ 无 | 创建→执行→监控→恢复→审查→归档 |
| **失败恢复机制** | ❌ 无 | ⚠️ 内存Retry | PMB记录失败 + Sprint恢复 |
| **验收决策闭环** | ❌ 无 | ❌ 无 | Gap Analysis → ACCEPTED/NEW_MSPEC/FAILED |
| **Terminator全自动** | ❌ 无 | ❌ 无 | 全自动托管 + 暂停/恢复机制 |
| **Repo建模（grasp）** | ❌ 无 | ❌ 无 | grasp repo抽象 + 状态追踪 |

---

## 2. 参考项目局限性深度分析

### 2.1 OpenSpec的7大局限性

| 局限性编号 | 局限性描述 | 对OMT的影响 | OMT必须自主创新 |
|------------|-----------|-------------|-----------------|
| **L1** | **无git集成** - OpenSpec没有git操作，无commit/push/PR集成 | OMT需要完整的git集成（commit per task, PR per Sprint） | ✅ 必须自主创新：git集成层 |
| **L2** | **无repo建模** - OpenSpec没有repo抽象，无法追踪repo状态 | OMT需要grasp repo建模 + brain.json状态追踪 | ✅ 必须自主创新：grasp repo抽象 |
| **L3** | **单次Change生命周期** - 无法处理多Sprint长周期开发 | OMT需要Sprint循环 + PMB历史记录 | ✅ 必须自主创新：Sprint循环机制 |
| **L4** | **无Agent概念** - 只有隐含的Artifact协作，无显式Agent定义 | OMT需要Agent Registry + Agent生命周期管理 | ✅ 必须自主创新：Agent系统 |
| **L5** | **无执行引擎** - 依赖外部Skill系统执行，无内置执行引擎 | OMT需要TaskRunner + DAG Executor | ⚠️ 可参考Agency-Orchestrator改造 |
| **L6** | **无失败恢复** - Change失败需重新执行，无恢复机制 | OMT需要PMB失败记录 + Sprint恢复 | ✅ 必须自主创新：失败恢复机制 |
| **L7** | **无验收闭环** - Change完成即结束，无验收决策 | OMT需要Gap Analysis验收决策 | ✅ 必须自主创新：验收闭环 |

### 2.2 Agency-Orchestrator的7大局限性

| 局限性编号 | 局限性描述 | 对OMT的影响 | OMT必须自主创新 |
|------------|-----------|-------------|-----------------|
| **L1** | **一次性执行** - Workflow执行完毕即结束，无持续迭代 | OMT需要Sprint循环 + Terminator模式 | ✅ 必须自主创新：持续执行机制 |
| **L2** | **无状态持久化** - 所有状态在内存，执行结束即丢失 | OMT需要brain.json + pmb.yaml持久化 | ✅ 必须自主创新：状态持久化 |
| **L3** | **无中间过程存储** - 只接收最终结果，不存储中间步骤 | OMT需要PMB记录每步执行结果 | ✅ 必须自主创新：中间过程存储 |
| **L4** | **无Agent监控** - Agent执行结束即销毁，无监控机制 | OMT需要Agent生命周期监控 | ✅ 必须自主创新：Agent监控 |
| **L5** | **无任务自动分解** - Workflow需人工定义，无自动分解 | OMT需要自动WBS分解 + Sprint Selection | ✅ 必须自主创新：任务自动分解 |
| **L6** | **无动态调整** - Workflow静态定义，无法动态调整 | OMT需要Gap Analysis + MSpec调整 | ✅ 必须自主创新：动态调整机制 |
| **L7** | **无验收闭环** - 执行结束即结束，无验收决策 | OMT需要验收决策闭环 | ✅ 必须自主创新：验收闭环 |

### 2.3 两者的共同缺失（OMT必须自主创新）

| 共同缺失编号 | 共同缺失描述 | OMT自主创新方案 |
|--------------|-------------|-----------------|
| **C1** | **无状态持久化** - 两者都无持久化机制 | brain.json（Repo状态）+ pmb.yaml（Sprint历史）+ artifacts持久化 |
| **C2** | **无持续执行机制** - 两者都是一次性执行 | Sprint循环 + Terminator全自动 + 暂停/恢复机制 |
| **C3** | **无验收闭环** - 两者都无验收决策 | Gap Analysis验收决策 → ACCEPTED/NEW_MSPEC/FAILED |
| **C4** | **无失败恢复** - 两者都只有Retry，无持久化恢复 | PMB失败记录 + Sprint恢复 + 任务级重试 |
| **C5** | **无Repo建模** - 两者都无repo抽象 | grasp repo建模 + brain.json状态追踪 |
| **C6** | **无Agent生命周期** - 两者都无Agent监控 | Agent Registry + spawn→monitor→销毁 + 状态机 |
| **C7** | **无任务自动分解** - OpenSpec无分解，Agency需人工定义 | 自动WBS分解 + Sprint Selection算法 |
| **C8** | **无动态调整** - 两者都是静态执行 | Gap Analysis + MSpec动态调整 + Sprint重新选择 |

---

## 3. 借鉴决策矩阵

### 3.1 OpenSpec借鉴决策

| 设计点 | 是否借鉴 | 决策理由 | OMT改造方案 | 优先级 |
|--------|---------|---------|------------|--------|
| **Schema驱动工作流** | ⚠️ 改造借鉴 | OMT有四层artifacts，比OpenSpec复杂，但Schema思路可借鉴 | 定义omt-workflow.yaml，包含TSpec→MSpec→Sprint→AtomTask四层 | P1 |
| **工具适配器模式** | ✅ 借鉴 | OMT需要支持多种AI工具（Claude Code、Cursor、Copilot） | 设计ToolAdapter Registry，支持Claude/Cursor/Copilot等 | P2 |
| **XML-like Prompt结构** | ✅ 借鉴 | 结构化指令格式清晰，易于Agent理解 | 设计OMT Prompt格式：<task>, <context>, <rules>, <template> | P0 |
| **Artifact依赖图** | ⚠️ 改造借鉴 | OMT有AtomTask依赖，比OpenSpecArtifact依赖更细粒度 | 设计AtomTask DAG，支持任务级依赖管理 | P0 |
| **Registry集中管理** | ✅ 借鉴 | Agent Registry、Skill Registry都需要集中管理 | 设计AgentRegistry + SkillRegistry + ToolAdapterRegistry | P1 |
| **状态文件检测** | ⚠️ 改造借鉴 | OpenSpec通过文件存在性判断，OMT需要更复杂状态管理 | brain.json + pmb.yaml + 文件存在性综合判断 | P1 |
| **CLI信息交换** | ✅ 借鉴 | JSON输出便于Skill解析和执行 | 设计omt CLI：status/execute/instructions --json | P0 |
| **Skill模板系统** | ⚠️ 改造借鉴 | OpenSpec Skill是静态指令模板，OMT需要动态注入 | 设计Skill动态注入系统，按assigneeRole注入 | P0 |
| **Explore stance设计** | ✅ 借鉴 | OMT的brainstorm阶段需要类似的发散探索设计 | 设计BSAgent：Curious, Open threads, Visual, Adaptive | P0 |

### 3.2 Agency-Orchestrator借鉴决策

| 设计点 | 是否借鉴 | 冨策理由 | OMT改造方案 | 优先级 |
|--------|---------|---------|------------|--------|
| **Agent定义格式** | ✅ 借鉴 | Markdown + Frontmatter定义Agent是成熟方案 | .omt/agents/*.md：name, emoji, capabilities, workflow | P0 |
| **Workflow YAML定义** | ⚠️ 改造借鉴 | Agency Workflow是一次性执行，OMT需要Sprint循环 | 定义sprint-execution.yaml：steps + role引用 + depends_on + Sprint循环 | P0 |
| **DAG Executor** | ✅ 借鉴 | 拓扑排序 + 并行执行是核心执行引擎 | 设计TaskRunner：DAG构建 + 并行控制 + 失败处理 | P0 |
| **Agent Delegation机制** | ✅ 借鉴 | Step.role → Agent.systemPrompt是成熟的Agent调用模式 | Sprint任务 → loadAgent(assigneeRole) → 执行 | P0 |
| **Context变量传递** | ⚠️ 改造借鉴 | Agency的Map传递过于简单，OMT需要复杂Context组装 | SprintContext：inputs + outputs + MSpec Design + Brain + PMB | P1 |
| **{{变量}}模板渲染** | ✅ 借鉴 | 模板渲染是成熟方案 | 支持{{task_description}}, {{mspec_design}}, {{dependencies}} | P1 |
| **Retry + Timeout机制** | ✅ 借鉴 | Retry + Timeout递增是成熟失败处理方案 | 设计FailureHandler：maxRetry + timeout * 1.5 | P1 |
| **按需加载Agent** | ✅ 借鉴 | 不预加载，执行前加载Agent，节省内存 | Sprint Selection → loadAgent(assigneeRole) → 执行 | P1 |
| **并行控制（concurrency）** | ✅ 借鉴 | 并行控制是重要执行优化 | Sprint执行支持concurrency配置 | P2 |
| **条件执行（condition）** | ⚠️ 改造借鉴 | Agency的条件执行简单，OMT需要更复杂判断 | 支持Gap Analysis触发条件 + MSpec调整触发条件 | P2 |

---

## 4. 不借鉴决策（明确拒绝）

### 4.1 OpenSpec不借鉴的设计点

| 设计点 | 拒绝理由 | OMT替代方案 |
|--------|---------|------------|
| **单次Change生命周期模型** | OMT是长周期开发系统，不是单次变更管理 | Sprint循环 + Terminator持续执行 |
| **无Agent概念设计** | OMT需要显式Agent定义和管理 | Agent Registry + Agent生命周期管理 |
| **隐含协作模式** | OMT需要显式Agent通信协议 | Agent间通信协议 + 共享记忆 |
| **静态Skill触发** | OMT需要动态Skill注入 | 按assigneeRole动态注入Skill |
| **CLI作为唯一信息交换** | OMT需要Agent间直接通信 + 文件共享 | CLI JSON输出 + Agent通信协议 + 文件共享 |
| **无执行引擎设计** | OMT需要内置执行引擎 | TaskRunner + DAG Executor + Agent Pool |

### 4.2 Agency不借鉴的设计点

| 设计点 | 拒绝理由 | OMT替代方案 |
|--------|---------|------------|
| **一次性执行模型** | OMT是持续性系统，不是一次性执行 | Sprint循环 + Terminator模式 |
| **内存Context传递** | OMT需要持久化状态和中间过程 | brain.json + pmb.yaml + SprintContext持久化 |
| **无中间过程存储** | OMT需要完整执行记录 | PMB记录每步执行结果 + Agent状态追踪 |
| **无Agent监控设计** | OMT需要Agent生命周期监控 | Agent spawn→monitor→销毁 + 状态追踪 |
| **人工定义Workflow步骤** | OMT需要自动任务分解 | 自动WBS分解 + Sprint Selection算法 |
| **静态YAML定义** | OMT需要动态调整能力 | Gap Analysis + MSpec动态调整 |

### 4.3 拒绝理由总结

| 拒绝类型 | 核心原因 |
|---------|---------|
| **定位不符** | OpenSpec/Agency都是一次性执行系统，OMT是长周期持续性系统 |
| **能力缺失** | OpenSpec/Agency缺少的状态持久化、Agent生命周期、验收闭环等都是OMT核心能力 |
| **粒度不匹配** | OpenSpec的Artifact粒度太粗，Agency的Workflow步骤需人工定义，OMT需要自动分解 |
| **架构差异** | OpenSpec依赖外部Skill执行，Agency无内置执行引擎，OMT需要完整执行系统 |

---

## 5. 借鉴原则总结

### 5.1 借鉴判断框架

```markdown
对于每个参考设计点，判断：
1. 定位匹配度：是否与OMT定位一致？
   - 完全匹配 → ✅ 借鉴
   - 部分匹配 → ⚠️ 改造借鉴
   - 不匹配 → ❌ 不借鉴

2. 能力缺口：OMT是否有此能力？
   - OM有此能力 → 比较优劣决定
   - OMT无此能力 → 检查是否需要
   - OMT不需要 → ❌ 不借鉴

3. 改造成本：改造借鉴的复杂度？
   - 低成本 → ⚠️ 改造借鉴
   - 高成本 → 评估是否自主创新
```

### 5.2 借鉴优先级分类

| 优先级 | 借鉴类型 | 说明 |
|--------|---------|------|
| **P0** | ✅ 借鉴或⚠️ 改造借鉴 | OMT核心能力缺失，必须补充 |
| **P1** | ✅ 借鉴或⚠️ 改造借鉴 | OMT重要能力，建议补充 |
| **P2** | ✅ 借鉴或⚠️ 改造借鉴 | OMT优化能力，可选补充 |

### 5.3 借鉴改造原则

1. **定位驱动**：以OMT长周期持续性定位为判断基准
2. **批判性评估**：每个设计点都要问"OMT真的需要这个吗？"
3. **自主创新优先**：当参考项目无法提供时，自主创新
4. **改造而非照搬**：即使借鉴也要根据OMT定位改造
5. **明确拒绝**：不适合OMT的设计点明确拒绝并说明理由

---

## 6. 下一步设计建议

### 6.1 P0优先级设计（必须补充）

| 设计编号 | 设计内容 | 建议文档编号 | 参考来源 |
|----------|---------|-------------|---------|
| **D1** | Agent定义格式设计 | 09_agent_executor_system.md | Agency-Orchestrator |
| **D2** | TaskRunner + DAG Executor设计 | 09_agent_executor_system.md | Agency-Orchestrator |
| **D3** | AtomTask DAG依赖管理 | 10_wbs_decomposition.md | OpenSpec + Agency改造 |
| **D4** | XML-like Prompt结构设计 | 13_input_output_formats.md | OpenSpec |
| **D5** | CLI信息交换设计（--json） | 13_input_output_formats.md | OpenSpec + Agency |
| **D6** | Skill动态注入系统 | 09_agent_executor_system.md | OpenSpec改造 |
| **D7** | BSAgent发散探索设计 | 08_brainstorm_pitch_workflow.md | OpenSpec Explore改造 |
| **D8** | Agent Delegation机制 | 09_agent_executor_system.md | Agency-Orchestrator |

### 6.2 P1优先级设计（建议补充）

| 设计编号 | 设计内容 | 建议文档编号 | 参考来源 |
|----------|---------|-------------|---------|
| **D9** | Agent Registry设计 | 11_agent_registry.md | OpenSpec Registry改造 |
| **D10** | Skill Registry设计 | 11_agent_registry.md | OpenSpec Registry改造 |
| **D11** | ToolAdapter Registry设计 | 11_agent_registry.md | OpenSpec改造 |
| **D12** | SprintContext持久化设计 | 13_input_output_formats.md | Agency改造 |
| **D13** | {{变量}}模板渲染系统 | 13_input_output_formats.md | Agency-Orchestrator |
| **D14** | Retry + Timeout机制 | 09_agent_executor_system.md | Agency-Orchestrator |
| **D15** | 按需加载Agent机制 | 09_agent_executor_system.md | Agency-Orchestrator |

### 6.3 OMT自主创新设计（参考项目无法提供）

| 设计编号 | 设计内容 | 建议文档编号 | 说明 |
|----------|---------|-------------|------|
| **I1** | grasp repo建模 + brain.json | 14_grasp_repo_model.md | OMT自主创新 |
| **I2** | PMB Sprint历史记录 | 15_pmb_persistence.md | OMT自主创新 |
| **I3** | Agent生命周期监控 | 16_agent_lifecycle.md | OMT自主创新 |
| **I4** | Sprint循环机制 | 12_terminator_loop.md | OMT自主创新 |
| **I5** | Terminator全自动模式 | 12_terminator_loop.md | OMT自主创新 |
| **I6** | 自动WBS分解算法 | 10_wbs_decomposition.md | OMT自主创新 |
| **I7** | Sprint Selection算法（已在02） | 02_sprint_selection.md | 已设计 |
| **I8** | Gap Analysis验收决策（已在03） | 03_gap_analysis.md | 已设计 |
| **I9** | MSpec动态调整（已在05） | 05_dynamic_adjustment.md | 已设计 |
| **I10** | 四层artifacts一致性对齐 | 17_artifacts_alignment.md | OMT自主创新 |
| **I11** | 失败恢复机制 | 18_failure_recovery.md | OMT自主创新 |

---

## 7. 架构蓝图

### 7.1 OMT三层架构（综合借鉴）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OMT三层架构（综合借鉴决策）                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 1: Agent定义层（借鉴Agency-Orchestrator）                               │
│                                                                             │
│ .omt/agents/                                                                │
│ ├── backend/backend-developer.md                                            │
│ │   ---                                                                     │
│ │   name: Backend Developer                                                 │
│ │   emoji: 🔧                                                               │
│ │   capabilities: [typescript, api, database]                               │
│ │   workflow: tdd-workflow                                                  │
│ │   ---                                                                     │
│ │   # Backend Developer Agent                                               │
│ │   ## Identity & Capabilities                                              │
│ │   ## Critical Rules                                                       │
│                                                                             │
│ ├── reviewer/code-reviewer.md                                               │
│ ├── qa/qa-agent.md                                                          │
│ └─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 2: Workflow执行层（借鉴Agency-Orchestrator改造）                         │
│                                                                             │
│ .omt/workflows/                                                             │
│ ├── sprint-execution.yaml                                                   │
│ │   name: "Sprint Execution"                                                │
│ │   agents_dir: ".omt/agents"                                               │
│ │   concurrency: 3                                                          │
│ │                                                                            │
│ │   steps:  # Sprint任务列表（动态生成）                                      │
│ │     - id: task_001                                                        │
│ │       role: "backend/backend-developer"                                   │
│ │       task: "{{task_description}}"                                        │
│ │       output: task_001_result                                             │
│ │       depends_on: []                                                      │
│ │                                                                            │
│ │   sprint_loop:  # OMT自主创新：Sprint循环                                   │
│ │     while: WBS.remaining > 0                                              │
│ │     trigger: omt:sprint                                                   │
│ │     pause: CRITICAL_FAILURE                                               │
│ │                                                                            │
│ └─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 3: Prompt结构层（借鉴OpenSpec）                                         │
│                                                                             │
│ OMT Prompt Format:                                                          │
│ <task>                                                                      │
│   Create the atom_task artifact...                                          │
│ </task>                                                                     │
│                                                                             │
│ <project_context>                                                           │
│   <!-- Background information. Do NOT include in output. -->                │
│   Tech stack: TypeScript...                                                 │
│   Repo state: {{brain_json_summary}}                                        │
│   Sprint history: {{pmb_summary}}                                           │
│ </project_context>                                                          │
│                                                                             │
│ <rules>                                                                     │
│   <!-- Constraints. Do NOT include in output. -->                           │
│   - Follow TDD workflow                                                     │
│   - Write tests first                                                       │
│ </rules>                                                                    │
│                                                                             │
│ <dependencies>                                                              │
│   <dependency id="mspec_design" status="completed">                         │
│     <path>{{mspec_design_path}}</path>                                      │
│   </dependency>                                                             │
│ </dependencies>                                                             │
│                                                                             │
│ <output>                                                                    │
│   Write to: {{output_path}}                                                 │
│ </output>                                                                   │
│                                                                             │
│ <instruction>                                                               │
│   {{skill_instructions}}  # 动态注入                                         │
│ </instruction>                                                              │
│                                                                             │
│ <template>                                                                  │
│   <!-- Use this as the structure. -->                                       │
│   ## Implementation                                                         │
│   ## Tests                                                                  │
│ </template>                                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 OMT核心执行流程（综合借鉴）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OMT核心执行流程                                             │
└─────────────────────────────────────────────────────────────────────────────┘

用户输入idea
    │
    ▼
omt:brainstorm（借鉴OpenSpec Explore stance）
    │  [BSAgent引导探索]
    │  [Curious, Open threads, Visual, Adaptive]
    │
    ▼
omt:pitch（自主创新）
    │  [QAAgent迭代问答]
    │  [终止条件: Agent判断足够清晰]
    │
    ▼
omt:tspec（自主创新）
    │  [SpecAgent生成]
    │  [输出: TSpec artifacts]
    │
    ▼
omt:mspec（自主创新）
    │  [MSpecGenerator批量创建]
    │  [自动WBS分解]
    │  [输出: 所有MSpecs + WBS]
    │
    ▼
omt:sprint（已设计）
    │  [Sprint Selection Algorithm]
    │  [输出: sprint.yaml]
    │
    ▼
omt:execute（借鉴Agency-Orchestrator改造）
    │  [TaskRunner + DAG Executor]
    │  [按需加载Agent]
    │  [并行执行]
    │  [Retry + Timeout]
    │  [PMB实时更新]
    │
    ▼
omt:review（已设计）
    │  [ReviewerAgent审查]
    │  [Hook: Sprint Commit Hook]
    │  [输出: review.json + PMB更新]
    │
    ▼
[循环 sprint 直到 MSpec.WBS 完成]
    │
    ▼
Gap Analysis验收决策（已设计）
    │  [决策: ACCEPTED / NEW_MSPEC / FAILED]
    │
    ▼
[ACCEPTED] → 归档
[NEW_MSPEC] → omt:mspec → 新Sprint循环
[FAILED] → 失败恢复 → 重试
```

---

## 8. 借鉴决策汇总

| 借鉴来源 | ✅ 借鉴数量 | ⚠️ 改造借鉴数量 | ❌ 不借鉴数量 | P0优先级 |
|----------|------------|----------------|-------------|---------|
| **OpenSpec** | 5 | 4 | 6 | 6 |
| **Agency-Orchestrator** | 8 | 2 | 6 | 4 |
| **自主创新** | - | - | - | 11 |

### 借鉴决策统计

- **直接借鉴**: 13个设计点
- **改造借鉴**: 6个设计点
- **不借鉴**: 12个设计点
- **自主创新**: 11个设计点

---

**分析完成日期**: 2026-04-30
**下一步**: 根据优先级开始补充设计文档