# Agency-Orchestrator架构调研报告

> 调研日期: 2026-04-30
> 目标项目: ~/Projects/GitClone/agency-orchestrator

---

## 1. 目录结构概览

Agency-Orchestrator采用清晰的分层架构：

```
agency-orchestrator/
├── src/                      # TypeScript源码
│   ├── core/                 # 核心执行引擎
│   │   ├── executor.ts       # DAG执行器（17KB，核心）
│   │   ├── dag.ts            # DAG构建与拓扑排序
│   │   ├── parser.ts         # Workflow YAML解析
│   │   ├── condition.ts      # 条件表达式评估
│   │   └── template.ts       # {{变量}}模板渲染
│   │
│   ├── agents/               # Agent加载
│   │   └── loader.ts         # Agent动态加载器
│   │
│   ├── connectors/           # LLM连接器（多种Provider）
│   │   ├── factory.ts        # Connector工厂
│   │   ├── claude.ts         # Claude API连接器
│   │   ├── openai.ts         # OpenAI连接器
│   │   ├── ollama.ts         # Ollama本地连接器
│   │   ├── deepseek.ts       # DeepSeek连接器
│   │   └── *-cli.ts          # CLI连接器（claude-code等）
│   │
│   ├── cli/                  # CLI命令
│   ├── utils/                # 工具函数
│   └── types.ts              # 类型定义
│
├── agency-agents/            # Agent定义库（Markdown文件）
│   ├── engineering/          # 工程类Agent
│   │   ├── engineering-code-reviewer.md
│   │   ├── engineering-sre.md
│   │   ├── engineering-architect.md
│   │   └── ...
│   │
│   ├── design/               # 设计类Agent
│   ├── academic/             # 学术类Agent
│   ├── finance/              # 金融类Agent
│   ├── testing/              # 测试类Agent
│   └── integrations/         # 集成类Agent
│
├── workflows/                # Workflow定义（YAML文件）
│   ├── dev/                  # 开发类Workflow
│   │   ├── pr-review.yaml    # PR审查（三维度并行）
│   │   ├── tech-design-review.yaml
│   │   └── ...
│   │
│   ├── design/               # 设计类Workflow
│   ├── marketing/            # 营销类Workflow
│   ├── strategy/             # 战略类Workflow
│   └── *.yaml                # 其他Workflow
│
├── integrations/             # 集成模块
├── examples/                 # 示例项目
└── test/                     # 测试文件
```

---

## 2. Agent定义与注册机制

### 2.1 Agent定义格式

Agent定义在Markdown文件中，采用Frontmatter + Body结构：

```markdown
---
name: Code Reviewer
description: Expert code reviewer...
color: purple
emoji: 👁️
vibe: Reviews code like a mentor...
---

# Code Reviewer Agent

You are **Code Reviewer**, an expert who provides thorough code reviews...

## 🧠 Your Identity & Memory
- **Role**: Code review specialist
- **Personality**: Constructive, thorough
- **Memory**: Common anti-patterns, security pitfalls

## 🎯 Your Core Mission
1. **Correctness** — Does it do what it's supposed to?
2. **Security** — Are there vulnerabilities?
...

## 🔧 Critical Rules
1. **Be specific** — Not vague comments
2. **Explain why** — Not just what to change
...
```

### 2.2 AgentDefinition类型

```typescript
// src/types.ts

interface AgentDefinition {
  name: string;           // Agent名称
  description: string;    // 描述
  emoji?: string;         // 显示emoji
  tools?: string;         // 工具声明
  rolePath?: string;      // 路径：如 "engineering/engineering-code-reviewer"
  systemPrompt: string;   // Frontmatter后的完整Markdown（作为System Prompt）
}
```

### 2.3 Agent动态加载

```typescript
// src/agents/loader.ts

export function loadAgent(agentsDir: string, rolePath: string): AgentDefinition {
  // 安全验证：防止路径穿越攻击
  if (/\.\.[/\\]/.test(rolePath) || /[^a-zA-Z0-9_\-/]/.test(rolePath)) {
    throw new Error(`非法角色路径: ${rolePath}`);
  }

  const fullPath = resolve(agentsDir, `${rolePath}.md`);
  
  // 文件存在检查
  if (!existsSync(fullPath)) {
    throw new Error(`角色文件不存在: ${fullPath}`);
  }

  const content = readFileSync(fullPath, 'utf-8');
  return parseAgentFile(content, rolePath);
}

function parseAgentFile(content: string, rolePath: string): AgentDefinition {
  // Frontmatter解析
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  
  if (!frontmatterMatch) {
    // 无Frontmatter → 整个文件作为System Prompt
    return { name: rolePath, systemPrompt: content.trim() };
  }

  const meta = parseFrontmatter(frontmatterMatch[1]);
  const body = frontmatterMatch[2];

  return {
    name: meta.name || rolePath,
    systemPrompt: body.trim(),
    emoji: meta.emoji,
    ...
  };
}
```

### 2.4 Agent列出机制

```typescript
export function listAgents(agentsDir: string): AgentDefinition[] {
  const agents: AgentDefinition[] = [];

  // 遍历子目录
  for (const dept of readdirSync(dir)) {
    if (!dept.isDirectory()) continue;
    // 跳过特殊目录
    if (dept.name.startsWith('.') || dept.name === 'integrations') continue;

    for (const file of readdirSync(deptDir)) {
      if (!file.endsWith('.md')) continue;
      const rolePath = `${dept.name}/${file.replace('.md', '')}`;
      agents.push(loadAgent(agentsDir, rolePath));
    }
  }

  return agents;
}
```

---

## 3. Agent Delegation机制

### 3.1 Delegation核心设计

**关键概念**: Agent Delegation = Step.role → Agent.systemPrompt

```yaml
# Workflow YAML中指定Agent
steps:
  - id: code_quality
    role: "engineering/engineering-code-reviewer"  # ← Agent路径
    task: "请审查代码..."
```

### 3.2 Delegation执行流程

```
Step执行时
    ↓
loadAgent(agentsDir, rolePath)
    ↓
获取 AgentDefinition
    ↓
提取 systemPrompt
    ↓
组合消息：
    - systemPrompt = Agent定义的Body部分
    - userMessage = Step.task（渲染后的{{变量}}）
    ↓
调用LLMConnector.chat(systemPrompt, userMessage, config)
    ↓
返回LLM结果 → Step.output变量
```

### 3.3 Delegation代码实现

```typescript
// src/core/executor.ts（简化）

async function executeStep(node: DAGNode, options: ExecutorOptions) {
  const { connector, agentsDir, llmConfig, context } = options;
  
  // Step 1: 加载Agent
  const agent = loadAgent(agentsDir, node.step.role);
  
  // Step 2: 渲染任务模板（替换{{变量}}）
  const userMessage = renderTemplate(node.step.task, context);
  
  // Step 3: 调用LLM
  const result = await connector.chat(
    agent.systemPrompt,  // Agent的System Prompt
    userMessage,         // 渲染后的用户任务
    config
  );
  
  // Step 4: 保存输出
  if (node.step.output) {
    context.set(node.step.output, result.content);
  }
  
  return result.content;
}
```

### 3.4 Agent匹配规则

**当前设计**: 静态匹配（Workflow中硬编码role路径）

```yaml
# Step中明确指定Agent
role: "engineering/engineering-code-reviewer"

# 无动态匹配机制
# 需要用户在Workflow设计时就确定Agent
```

**潜在改进方向**（当前未实现）:
- 任务描述 → Agent能力自动匹配
- Agent能力标签注册
- 动态Agent选择算法

---

## 4. 动态加载Agent/Skill

### 4.1 加载时机

| 加载时机 | 触发条件 | 说明 |
|---------|---------|------|
| **Step执行前** | executeStep调用 | 按需加载，不预加载 |
| **名称预显示** | onBatchStart前 | 为了UI显示，提前加载名称 |
| **列表显示** | CLI命令触发 | 用户查询可用Agent |

### 4.2 按需加载代码

```typescript
// executor.ts中的加载时机

// 预加载名称（UI显示）
for (const node of batch) {
  if (!node.agentName && node.step.role) {
    try {
      const agentInfo = loadAgent(agentsDir, node.step.role);
      node.agentName = node.step.name || agentInfo.name;
      node.agentEmoji = node.step.emoji || agentInfo.emoji;
    } catch { /* executeStep里会再加载并报错 */ }
  }
}

// 正式执行时加载
const agent = loadAgent(agentsDir, node.step.role);
```

### 4.3 不预加载的好处

1. **节省内存**: 只加载当前执行需要的Agent
2. **灵活性**: Agent文件可以随时修改，下次执行生效
3. **扩展性**: 用户可随时添加新Agent到agents目录

---

## 5. Agent状态管理

### 5.1 DAGNode状态机

```typescript
// src/types.ts

interface DAGNode {
  step: StepDefinition;
  dependencies: string[];
  dependents: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: string;
  error?: string;
  startTime?: number;
  endTime?: number;
  tokenUsage?: { input: number; output: number };
  agentName?: string;
  agentEmoji?: string;
}
```

### 5.2 状态转换图

```
            ┌──────────────────────────────────────┐
            │                                      │
            ▼                                      │
        [pending] ──executeStep──▶ [running]      │
            │                         │           │
            │  condition=false        │ success   │ failure
            │                         │           │
            │                         ▼           ▼
            │                    [completed]  [failed]
            │                         │           │
            │                         │           │ retry?
            │                         │           │
            ▼                         │           │
        [skipped]                     │           │
                                        │           │
                                        ▼───────────┘
                                    输出到context
```

### 5.3 状态管理代码

```typescript
// executor.ts

// 条件跳过
if (node.step.condition && !evaluateCondition(node.step.condition, context)) {
  node.status = 'skipped';
  // 级联跳过下游
  markDownstreamSkipped(dag, node.step.id);
}

// 执行成功
if (result.status === 'fulfilled') {
  node.status = 'completed';
  node.result = result.value;
}

// 执行失败
if (result.status === 'rejected') {
  node.status = 'failed';
  node.error = result.reason.message;
}

// Retry机制
for (let attempt = 1; attempt <= maxRetry; attempt++) {
  try {
    const result = await executeWithTimeout(...);
    break; // 成功则跳出
  } catch (err) {
    if (attempt === maxRetry) throw err;
    // 继续retry
  }
}
```

---

## 6. Agent间通信协议

### 6.1 通信设计

**核心机制**: 通过共享的`context` Map传递信息

```typescript
// executor.ts

// 变量上下文：inputs + 每步的 output
const context = new Map(inputs);

// Step输出写入context
if (node.step.output) {
  context.set(node.step.output, result.content);
}

// 后续Step读取context
const userMessage = renderTemplate(node.step.task, context);
// {{previous_output}} → context.get('previous_output')
```

### 6.2 通信示例

```yaml
steps:
  - id: research
    role: "engineering/engineering-researcher"
    task: "研究{{topic}}"
    output: research_result     # ← 写入context

  - id: design
    role: "engineering/engineering-architect"
    task: "根据研究结果设计方案：{{research_result}}"  # ← 读取context
    depends_on: [research]
    output: design_doc

  - id: implement
    role: "engineering/engineering-developer"
    task: "实现设计：{{design_doc}}"
    depends_on: [design]
```

### 6.3 通信协议特点

| 特点 | 说明 |
|------|------|
| **异步传递** | 不直接Agent间通信，通过context间接传递 |
| **变量命名** | output变量名作为通信协议 |
| **类型隐含** | 所有传递内容为string，无强类型 |
| **依赖约束** | depends_on确保信息传递顺序 |

---

## 7. 任务分解与分配

### 7.1 Workflow作为任务分解载体

**设计**: 任务分解在Workflow YAML中人工定义，非自动分解

```yaml
# 任务分解示例：PR Review
steps:
  - id: code_quality      # 子任务1
  - id: security_check    # 子任务2
  - id: perf_check        # 子任务3
  - id: summary           # 汇总任务
    depends_on: [code_quality, security_check, perf_check]
```

### 7.2 分解粒度判断

**当前无自动分解**，依赖Workflow设计者人工拆分：

| 拆分依据 | 示例 |
|---------|------|
| **功能维度** | code_quality, security_check, perf_check |
| **并行需求** | concurrency: 3 |
| **依赖关系** | summary depends_on 前3步骤 |
| **专业分工** | 不同role对应不同Agent |

### 7.3 任务分配机制

```yaml
# 分配 = Step.role → Agent
steps:
  - role: "engineering/engineering-code-reviewer"  # → Code Reviewer Agent
  - role: "engineering/engineering-security-engineer"  # → Security Engineer Agent
  - role: "testing/testing-performance-benchmarker"  # → Performance Benchmarker Agent
```

---

## 8. Orchestrator架构

### 8.1 Orchestrator核心

**Executor即Orchestrator**，负责：
- DAG构建与调度
- Agent加载与调用
- 状态管理
- 并行执行控制
- 失败处理

### 8.2 Orchestrator职责边界

| 职责 | 实现 | 不负责 |
|------|------|--------|
| **DAG构建** | dag.ts | 任务自动分解 |
| **拓扑排序** | Kahn算法 | 动态任务添加 |
| **并行控制** | concurrency配置 | 负载均衡 |
| **Agent调度** | loadAgent | Agent能力匹配 |
| **状态追踪** | DAGNode.status | Agent状态持久化 |
| **失败处理** | retry + fallback | 任务降级 |

### 8.3 Orchestrator代码架构

```typescript
// executor.ts核心流程

export async function executeDAG(dag: DAG, options: ExecutorOptions): Promise<WorkflowResult> {
  const context = new Map(inputs);
  const stepResults: StepResult[] = [];

  // 按层级遍历DAG
  while (levelIndex < dag.levels.length) {
    const tasks = dag.levels[levelIndex];

    // 按并发限制分批执行
    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, concurrency);

      // 并行执行
      const results = await Promise.allSettled(
        batch.map(node => executeStep(node, options))
      );

      // 处理结果
      for (const result of results) {
        if (result.status === 'fulfilled') {
          node.status = 'completed';
          context.set(node.step.output, result.value);
        } else {
          node.status = 'failed';
          node.error = result.reason;
        }
      }
    }

    levelIndex++;
  }

  return { name, success, steps: stepResults, ... };
}
```

---

## 9. 并行执行策略

### 9.1 并行设计核心

```typescript
// DAG层级 → 同层可并行
const tasks = dag.levels[levelIndex];

// concurrency限制 → 分批并行
for (let i = 0; i < tasks.length; i += concurrency) {
  const batch = tasks.slice(i, concurrency);
  await Promise.allSettled(batch.map(executeStep));
}
```

### 9.2 并行执行示例

```yaml
# pr-review.yaml
concurrency: 3  # 最多并行3个步骤

steps:
  - id: code_quality    # 并行组1
  - id: security_check  # 并行组1
  - id: perf_check      # 并行组1
    # ← 以上3个同时执行

  - id: summary         # 下一层级
    depends_on: [code_quality, security_check, perf_check]
    # ← 等待并行组1全部完成
```

### 9.3 并行依赖管理

```typescript
// dag.ts - DAG构建

export class DAG {
  nodes: Map<string, DAGNode>;
  levels: string[][];  // 拓扑排序后的层级

  // Kahn算法拓扑排序
  buildLevels() {
    const inDegree = new Map();
    const dependents = new Map();

    // 计算入度
    for (const node of this.nodes.values()) {
      inDegree.set(node.id, node.dependencies.length);
      for (const dep of node.dependencies) {
        dependents.get(dep).push(node.id);
      }
    }

    // BFS构建层级
    const queue = [...inDegree.entries()]
      .filter(([id, deg]) => deg === 0)
      .map(([id]) => id);

    while (queue.length > 0) {
      const level = queue.sort();  // 当前层级
      this.levels.push(level);

      for (const id of level) {
        for (const dependent of dependents.get(id)) {
          inDegree.set(dependent, inDegree.get(dependent) - 1);
          if (inDegree.get(dependent) === 0) {
            queue.push(dependent);
          }
        }
      }
    }
  }
}
```

---

## 10. 失败处理机制

### 10.1 Retry机制

```typescript
// executor.ts

const maxRetry = llmConfig.retry ?? 5;

for (let attempt = 1; attempt <= maxRetry; attempt++) {
  try {
    const result = await executeWithTimeout(
      connector.chat(systemPrompt, userMessage, config),
      timeout
    );
    return result;  // 成功返回
  } catch (err) {
    if (attempt === maxRetry) {
      node.status = 'failed';
      node.error = err.message;
      throw err;
    }
    // Retry继续
  }
}
```

### 10.2 Timeout机制

```typescript
const timeout = llmConfig.timeout || 
  (isCLI ? 600_000 : isLocal ? 600_000 : 120_000);

async function executeWithTimeout(promise, timeout) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), timeout)
    )
  ]);
}

// Timeout后自动x1.5（上限60分钟）
// 因超时触发重试时，下一次 timeout 自动 x1.5
```

### 10.3 失败传播

```typescript
// Step失败 → 下游跳过
function markDownstreamSkipped(dag: DAG, failedNodeId: string) {
  for (const dependent of dag.nodes.get(failedNodeId).dependents) {
    const node = dag.nodes.get(dependent);
    node.status = 'skipped';
    // 级联跳过
    markDownstreamSkipped(dag, dependent);
  }
}
```

### 10.4 降级机制（未实现）

当前设计无降级机制，失败即终止。

---

## 11. Agent vs Skill区分

### 11.1 核心区别

| 维度 | Agent | Skill（OpenSpec） |
|------|-------|------------------|
| **定义方式** | Markdown文件 | Markdown文件（SKILL.md） |
| **内容结构** | Frontmatter + System Prompt | Frontmatter + Instructions |
| **使用方式** | 被Workflow引用（role字段） | 被/COMMAND调用 |
| **动态加载** | 按需加载（Step执行前） | Skill系统预加载 |
| **能力封装** | 角色身份 + 行为规则 | 指令模板 + 执行步骤 |
| **可替换性** | 同一role路径可替换 | Skill名固定 |

### 11.2 Agency-Orchestrator的Agent设计

```markdown
# engineering-code-reviewer.md

## 🧠 Your Identity & Memory
- **Role**: Code review specialist
- **Personality**: Constructive, thorough

## 🎯 Your Core Mission
...

## 🔧 Critical Rules
...
```

**Agent = 角色定义 + 行为规范 + 输出格式**

### 11.3 OpenSpec的Skill设计

```markdown
# SKILL.md

**Steps**
1. If no change name provided, prompt for selection
2. Check current status: openspec status --json
3. Act based on status...
```

**Skill = 指令模板 + 执行步骤**

### 11.4 设计哲学差异

| Agency-Orchestrator | OpenSpec |
|--------------------|----------|
| Agent是"人" | Skill是"流程" |
| 强调角色身份 | 强调执行步骤 |
| 动态组合 | 固定流程 |
| Workflow编排Agent | Command触发Skill |

---

## 12. 工作流引擎

### 12.1 Workflow YAML格式

```yaml
name: "PR 代码审查"
description: "三维度并行审查"

agents_dir: "agency-agents-zh"  # Agent定义目录

llm:
  provider: deepseek
  model: deepseek-chat

concurrency: 3  # 并行数

inputs:
  - name: pr_diff
    required: true

steps:
  - id: code_quality
    role: "engineering/engineering-code-reviewer"
    task: "请审查代码：{{pr_diff}}"
    output: quality_report
    condition: "{{review_type}} == 'full'"
    depends_on: []

  - id: summary
    role: "engineering/engineering-code-reviewer"
    task: "汇总结果：{{quality_report}}"
    depends_on: [code_quality]
    llm:           # 步骤级LLM覆盖
      model: deepseek-reasoner
```

### 12.2 Workflow解析

```typescript
// parser.ts

export function parseWorkflow(yamlPath: string): WorkflowDefinition {
  const content = readFileSync(yamlPath, 'utf-8');
  const yaml = parseYAML(content);

  // 验证必填字段
  if (!yaml.steps || yaml.steps.length === 0) {
    throw new Error('Workflow必须包含steps');
  }

  // 构建WorkflowDefinition
  return {
    name: yaml.name,
    agents_dir: yaml.agents_dir,
    llm: yaml.llm,
    concurrency: yaml.concurrency || 2,
    steps: yaml.steps.map(parseStep)
  };
}
```

### 12.3 DAG构建

```typescript
// dag.ts

export class DAG {
  nodes: Map<string, DAGNode>;
  levels: string[][];

  static fromWorkflow(workflow: WorkflowDefinition): DAG {
    const dag = new DAG();

    // 创建节点
    for (const step of workflow.steps) {
      dag.nodes.set(step.id, {
        step,
        dependencies: step.depends_on || [],
        dependents: [],
        status: 'pending'
      });
    }

    // 构建反向邻接图
    for (const node of dag.nodes.values()) {
      for (const dep of node.dependencies) {
        dag.nodes.get(dep).dependents.push(node.step.id);
      }
    }

    // 拓扑排序
    dag.buildLevels();

    return dag;
  }
}
```

### 12.4 条件执行

```typescript
// condition.ts

export function evaluateCondition(condition: string, context: Map<string, string>): boolean {
  // 模板渲染
  const rendered = renderTemplate(condition, context);

  // 简单表达式解析
  // "{{category}} contains bug" → context.get('category').includes('bug')
  // "{{score}} > 5" → parseInt(context.get('score')) > 5

  if (rendered.includes('contains')) {
    const [varName, value] = rendered.split(' contains ');
    return context.get(varName)?.includes(value);
  }

  if (rendered.includes('>')) {
    const [varName, value] = rendered.split(' > ');
    return parseInt(context.get(varName)) > parseInt(value);
  }

  // ... 其他操作符
}
```

### 12.5 循环支持

```yaml
steps:
  - id: iterate
    role: "engineering/engineering-developer"
    task: "迭代优化..."
    loop:
      back_to: iterate       # 跳回自己
      max_iterations: 5      # 最大循环次数
      exit_condition: "{{quality}} >= 8"  # 退出条件
```

---

## 13. OMT可借鉴的设计模式

### 13.1 Agent定义格式

**借鉴**: Markdown + Frontmatter定义Agent

```markdown
---
name: Backend Developer
emoji: 🔧
capabilities: [typescript, api, database]
---

# Backend Developer Agent

You are a backend development specialist...

## 🎯 Your Capabilities
- REST API design
- Database schema
- Authentication
```

### 13.2 Workflow YAML定义

**借鉴**: 步骤依赖 + 并行控制 + Agent引用

```yaml
# omt-workflow.yaml
name: "Sprint Execution"
agents_dir: ".omt/agents"

steps:
  - id: task_001
    role: "backend/backend-developer"
    task: "实现JWT认证"
    output: task_001_result
    depends_on: []

  - id: review_001
    role: "reviewer/code-reviewer"
    task: "审查{{task_001_result}}"
    depends_on: [task_001]
```

### 13.3 DAG并行执行

**借鉴**: 拓扑排序 + 并行批次控制

```typescript
// 按DAG层级执行
while (levelIndex < dag.levels.length) {
  const batch = dag.levels[levelIndex].slice(0, concurrency);
  await Promise.allSettled(batch.map(executeStep));
}
```

### 13.4 Context变量传递

**借鉴**: Map存储变量，{{变量}}模板渲染

```typescript
const context = new Map(inputs);
context.set(step.output, result);
const nextTask = renderTemplate(nextStep.task, context);
```

### 13.5 Retry + Timeout

**借鉴**: Retry机制 + Timeout递增

```typescript
for (let attempt = 1; attempt <= maxRetry; attempt++) {
  try {
    return await executeWithTimeout(promise, timeout);
  } catch {
    timeout *= 1.5;  // Timeout递增
  }
}
```

### 13.6 CLI信息交换

**借鉴**: JSON输出供Skill解析（与OpenSpec一致）

```bash
omt status --json
omt execute --json
```

### 13.7 按需加载Agent

**借鉴**: Step执行前加载，不预加载

```typescript
const agent = loadAgent(agentsDir, step.role);
```

---

## 14. 关键代码片段摘录

### 14.1 Executor核心

```typescript
export async function executeDAG(dag: DAG, options: ExecutorOptions): Promise<WorkflowResult> {
  const context = new Map(inputs);
  
  while (levelIndex < dag.levels.length) {
    const tasks = dag.levels[levelIndex];
    
    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, concurrency);
      
      const results = await Promise.allSettled(
        batch.map(node => executeStep(node, options))
      );
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          context.set(node.step.output, result.value);
        }
      }
    }
  }
}
```

### 14.2 Agent加载

```typescript
export function loadAgent(agentsDir: string, rolePath: string): AgentDefinition {
  const fullPath = resolve(agentsDir, `${rolePath}.md`);
  const content = readFileSync(fullPath, 'utf-8');
  return parseAgentFile(content, rolePath);
}
```

### 14.3 DAG拓扑排序

```typescript
buildLevels() {
  const inDegree = new Map();
  const queue = [...inDegree.entries()]
    .filter(([id, deg]) => deg === 0);

  while (queue.length > 0) {
    const level = queue.sort();
    this.levels.push(level);
    // 更新入度...
  }
}
```

---

## 15. 与OpenSpec对比

| 维度 | Agency-Orchestrator | OpenSpec | OMT建议 |
|------|---------------------|----------|---------|
| **Agent定义** | Markdown + Frontmatter | 无显式Agent | 采用Agency模式 |
| **Workflow定义** | YAML（步骤依赖） | YAML（Artifact依赖） | 采用Agency模式 |
| **执行引擎** | DAG Executor | Skill系统 | DAG Executor |
| **并行控制** | concurrency配置 | 无 | 采用Agency模式 |
| **Agent/Skill区分** | Agent=角色 | Skill=流程 | **两者结合** |
| **动态加载** | Step执行前加载 | Skill预加载 | 采用Agency模式 |
| **Context传递** | Map + {{模板}} | XML-like结构 | **两者结合** |
| **CLI信息交换** | JSON输出 | JSON输出 | 保持一致 |

### 核心差异

**Agency-Orchestrator**: Workflow编排Agent
**OpenSpec**: Command触发Skill

**OMT建议**: Agent（角色能力）+ Workflow（任务流程）+ Skill（指令模板）

---

## 16. OMT设计建议

### 16.1 Agent定义设计

```markdown
# .omt/agents/backend/backend-developer.md

---
name: Backend Developer
emoji: 🔧
capabilities:
  - typescript
  - rest-api
  - database
  - authentication
workflow: tdd-workflow
---

## 🧠 Identity
You are a backend development specialist...

## 🎯 Capabilities
- Design and implement REST APIs
- Create database schemas
- Implement authentication flows

## 🔧 Rules
- Follow TDD workflow
- Write tests first
- Validate input at boundaries
```

### 16.2 Workflow定义设计

```yaml
# .omt/workflows/sprint-execution.yaml

name: "Sprint Execution"
agents_dir: ".omt/agents"

llm:
  provider: claude-code

concurrency: 3

inputs:
  - name: sprint_tasks
    required: true

steps:
  - id: execute_task_001
    role: "backend/backend-developer"
    task: |
      实现任务：{{task_001_description}}
      
      上下文：
      - MSpec Design: {{mspec_design}}
      - Dependencies: {{dependencies}}
    output: task_001_result
    depends_on: []

  - id: review_task_001
    role: "reviewer/code-reviewer"
    task: "审查实现：{{task_001_result}}"
    depends_on: [execute_task_001]
    output: review_001
```

### 16.3 Agent Registry设计

```typescript
// omt-agent-registry.ts

interface AgentCapability {
  name: string;
  capabilities: string[];
  workflow: string;  // 默认workflow
}

class AgentRegistry {
  private agents: Map<string, AgentCapability>;

  static loadAgents(agentsDir: string) {
    // 遍历目录加载所有Agent定义
    for (const file of walkDir(agentsDir)) {
      if (file.endsWith('.md')) {
        const agent = parseAgentFile(file);
        this.agents.set(agent.rolePath, agent);
      }
    }
  }

  static matchAgent(taskDescription: string): string {
    // 任务描述 → Agent匹配（未来扩展）
    // 当前：静态匹配（Workflow中指定）
  }
}
```

### 16.4 Sprint DAG构建

```typescript
// 将sprint_tasks.yaml转换为DAG

function buildSprintDAG(tasks: AtomTask[]): DAG {
  const dag = new DAG();

  for (const task of tasks) {
    dag.addNode({
      id: task.id,
      role: task.assigneeRole,
      task: task.description,
      output: `task_${task.id}_result`,
      depends_on: task.blockedBy
    });
  }

  return dag.topologicalSort();
}
```

### 16.5 Context共享设计

```typescript
// .omt/context.ts

interface SprintContext {
  inputs: Map<string, string>;    // Sprint输入
  outputs: Map<string, string>;    // Task输出
  mspecDesign: string;            // MSpec Design内容
  dependencies: string[];          // 依赖文件列表
  brainJson: BrainJson;           // Repo状态
  pmb: PMB;                       // Sprint历史
}

// 模板渲染
function renderTask(taskTemplate: string, context: SprintContext): string {
  return taskTemplate
    .replace(/\{\{mspec_design\}\}/g, context.mspecDesign)
    .replace(/\{\{dependencies\}\}/g, context.dependencies.join('\n'));
}
```

### 16.6 失败处理设计

```typescript
// omt-failure-handler.ts

interface FailureStrategy {
  maxRetry: number;
  timeout: number;
  timeoutMultiplier: number;
  fallbackAgent?: string;  // 降级Agent
}

async function executeWithFailureHandling(
  task: AtomTask,
  strategy: FailureStrategy
) {
  let timeout = strategy.timeout;
  
  for (let attempt = 1; attempt <= strategy.maxRetry; attempt++) {
    try {
      return await executeTask(task, timeout);
    } catch (err) {
      if (attempt === strategy.maxRetry) {
        if (strategy.fallbackAgent) {
          // 降级执行
          return await executeWithFallback(task, strategy.fallbackAgent);
        }
        throw err;
      }
      timeout *= strategy.timeoutMultiplier;
    }
  }
}
```

---

## 17. 总结

### 17.1 Agency-Orchestrator核心设计

| 设计点 | 实现 |
|--------|------|
| **Agent定义** | Markdown + Frontmatter |
| **Workflow编排** | YAML（步骤依赖 + Agent引用） |
| **执行引擎** | DAG Executor（拓扑排序 + 并行控制） |
| **动态加载** | 按需加载（Step执行前） |
| **Agent间通信** | Context Map + {{变量}}模板 |
| **状态管理** | DAGNode状态机（5状态） |
| **失败处理** | Retry + Timeout递增 |

### 17.2 OMT借鉴优先级

| 借鉴项 | 优先级 | 说明 |
|--------|--------|------|
| **Agent定义格式** | P0 | .omt/agents/*.md |
| **Workflow YAML** | P0 | 步骤依赖 + 并行控制 |
| **DAG Executor** | P0 | 拓扑排序 + 并行执行 |
| **Context传递** | P1 | Map + {{模板}} |
| **按需加载** | P1 | 不预加载 |
| **Retry机制** | P1 | 失败处理 |
| **Agent匹配** | P2 | 未来扩展 |

### 17.3 与OpenSpec结合建议

**OMT架构 = Agency的Agent编排 + OpenSpec的Prompt结构**

```
┌────────────────────────────────────────────────────────────┐
│                    OMT三层架构                              │
├────────────────────────────────────────────────────────────┤
│  Layer 1: Agent定义（Agency模式）                           │
│  .omt/agents/backend/backend-developer.md                  │
│  Frontmatter + System Prompt                               │
│                                                            │
│  Layer 2: Workflow定义（Agency模式）                        │
│  .omt/workflows/sprint-execution.yaml                      │
│  steps + role引用 + depends_on                             │
│                                                            │
│  Layer 3: Prompt结构（OpenSpec模式）                        │
│  <artifact>, <task>, <context>, <template>                 │
│  结构化指令输出                                             │
└────────────────────────────────────────────────────────────┘
```

---

**调研完成日期**: 2026-04-30
**下一步**: 结合OpenSpec和Agency-Orchestrator设计OMT的Agent/Workflow架构