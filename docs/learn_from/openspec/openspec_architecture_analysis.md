# OpenSpec架构学习报告

> 探索日期: 2026-04-30
> 目标项目: ~/Projects/GitClone/OpenSpec

---

## 1. 目录结构概览

OpenSpec采用清晰的分层目录结构：

```
OpenSpec/
├── src/                          # TypeScript源码
│   ├── commands/                 # CLI命令定义
│   │   ├── change.ts            # change管理命令
│   │   ├── config.ts            # 配置命令
│   │   ├── schema.ts            # schema命令
│   │   ├── validate.ts          # 验证命令
│   │   ├── spec.ts              # spec命令
│   │   └── workflow/            # workflow相关命令
│   │       ├── instructions.ts  # 指令生成（核心）
│   │       ├── new-change.ts    # 创建change
│   │       ├── status.ts        # 状态查询
│   │       ├── templates.ts     # 模板命令
│   │       └── shared.ts        # 共享逻辑
│   │
│   ├── core/                    # 核心逻辑
│   │   ├── artifact-graph/      # Artifact依赖图（核心）
│   │   │   ├── graph.ts         # 拓扑排序依赖图
│   │   │   ├── resolver.ts      # Schema解析器
│   │   │   ├── instruction-loader.ts  # 指令加载器（核心）
│   │   │   ├── state.ts         # 状态检测
│   │   │   ├── schema.ts        # Schema解析验证
│   │   │   └── types.ts         # 类型定义
│   │   │
│   │   ├── command-generation/  # 命令生成系统
│   │   │   ├── registry.ts      # 适配器Registry
│   │   │   ├── generator.ts     # 命令生成器
│   │   │   ├── types.ts         # 类型定义
│   │   │   └── adapters/        # 23种工具适配器
│   │   │       ├── claude.ts    # Claude Code适配器
│   │   │       ├── cursor.ts    # Cursor适配器
│   │   │       ├── windsurf.ts  # Windsurf适配器
│   │   │       └── ...          # 其他20种适配器
│   │   │
│   │   ├── templates/           # Skill/Command模板
│   │   │   ├── types.ts         # 模板类型
│   │   │   ├── skill-templates.ts  # Skill模板 facade
│   │   │   └── workflows/       # Workflow模板模块
│   │   │       ├── explore.ts   # Explore workflow
│   │   │       ├── new-change.ts
│   │   │       ├── continue-change.ts
│   │   │       ├── apply-change.ts
│   │   │       ├── verify-change.ts
│   │   │       ├── archive-change.ts
│   │   │       └── ...
│   │   │
│   │   ├── parsers/             # 解析器
│   │   ├── schemas/             # Schema验证
│   │   ├── config.ts            # 配置管理
│   │   ├── init.ts              # 初始化
│   │   └── archive.ts           # 档
│   │
│   ├── utils/                   # 工具函数
│   │   ├── change-utils.ts      # change工具
│   │   ├── change-metadata.ts   # metadata解析
│   │   ├── file-system.ts       # 文件系统
│   │   └── interactive.ts       # 交互工具
│   │
│   ├── cli/                     # CLI入口
│   ├── prompts/                 # UI提示组件
│   ├── ui/                      # ASCII UI
│   └── telemetry/               # 遥测
│
├── schemas/                     # Schema定义目录
│   └── spec-driven/             # 默认workflow schema
│       ├── schema.yaml          # Schema定义（核心）
│       └── templates/           # Artifact模板
│           ├── proposal.md
│           ├── spec.md
│           ├── design.md
│           └── tasks.md
│
├── openspec/                    # 项目级OpenSpec数据
│   ├── config.yaml              # 项目配置（context/rules）
│   ├── changes/                 # change目录
│   │   └── <change-name>/       # 每个change
│   │       ├── .openspec.yaml   # change元数据
│   │       ├── proposal.md      # artifact输出
│   │       ├── specs/           # specs输出
│   │       ├── design.md
│   │       └── tasks.md
│   └── specs/                   # 主specs目录
│       └── <capability>/
│           └── spec.md
│
├── .claude/                     # Claude Code配置
│   └── skills/
│       └── repomix-reference-open-spec/
│           └── SKILL.md         # Skill定义（Repomix生成）
│
└── docs/                        # 文档
```

---

## 2. Command/Skill触发机制

### 2.1 Skill/Command模板定义

OpenSpec使用两种模板类型：

```typescript
// src/core/templates/types.ts

export interface SkillTemplate {
  name: string;            // skill名称
  description: string;     // 描述
  instructions: string;    // 指令内容（Markdown格式）
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
}

export interface CommandTemplate {
  name: string;            // command名称
  description: string;     // 描述
  category: string;        // 分类（如 'Workflow'）
  tags: string[];          // 标签数组
  content: string;         // 命令内容（Markdown格式）
}
```

### 2.2 模板工厂函数

每个workflow通过工厂函数生成模板：

```typescript
// src/core/templates/workflows/continue-change.ts

export function getContinueChangeSkillTemplate(): SkillTemplate {
  return {
    name: 'openspec-continue-change',
    description: 'Continue working on an OpenSpec change...',
    instructions: `Continue working on a change by creating the next artifact.
    
    **Steps**
    1. If no change name provided, prompt for selection
    2. Check current status: openspec status --change "<name>" --json
    3. Act based on status...
    `,
    license: 'MIT',
    compatibility: 'Requires openspec CLI.',
    metadata: { author: 'openspec', version: '1.0' },
  };
}

export function getOpsxContinueCommandTemplate(): CommandTemplate {
  return {
    name: 'OPSX: Continue',
    description: 'Continue working on a change...',
    category: 'Workflow',
    tags: ['workflow', 'artifacts', 'experimental'],
    content: `Continue working on a change by creating the next artifact...`
  };
}
```

### 2.3 多工具适配器模式

OpenSpec设计了工具无关的命令生成系统：

```typescript
// src/core/command-generation/types.ts

export interface CommandContent {
  id: string;        // 命令ID（如 'explore', 'apply'）
  name: string;      // 显示名称
  description: string;
  category: string;
  tags: string[];
  body: string;      // 命令指令内容
}

export interface ToolCommandAdapter {
  toolId: string;    // 工具ID（如 'claude', 'cursor'）
  getFilePath(commandId: string): string;   // 返回文件路径
  formatFile(content: CommandContent): string;  // 格式化文件内容
}
```

### 2.4 Claude Code适配器示例

```typescript
// src/core/command-generation/adapters/claude.ts

export const claudeAdapter: ToolCommandAdapter = {
  toolId: 'claude',

  getFilePath(commandId: string): string {
    return path.join('.claude', 'commands', 'opsx', `${commandId}.md`);
  },

  formatFile(content: CommandContent): string {
    return `---
name: ${escapeYamlValue(content.name)}
description: ${escapeYamlValue(content.description)}
category: ${escapeYamlValue(content.category)}
tags: ${formatTagsArray(content.tags)}
---

${content.body}
`;
  },
};
```

### 2.5 适配器Registry

```typescript
// src/core/command-generation/registry.ts

export class CommandAdapterRegistry {
  private static adapters: Map<string, ToolCommandAdapter> = new Map();

  static {
    // 注册23种内置适配器
    CommandAdapterRegistry.register(claudeAdapter);
    CommandAdapterRegistry.register(cursorAdapter);
    CommandAdapterRegistry.register(windsurfAdapter);
    CommandAdapterRegistry.register(codexAdapter);
    CommandAdapterRegistry.register(copilotAdapter);
    // ... 其他19种
  }

  static get(toolId: string): ToolCommandAdapter | undefined {
    return CommandAdapterRegistry.adapters.get(toolId);
  }
}
```

### 2.6 触发流程

```
用户调用 /opsx:continue <change-name>
    ↓
Skill系统加载 openspec-continue-change skill
    ↓
执行instructions中定义的步骤:
    1. openspec status --change "<name>" --json
    2. 解析JSON获取artifact状态
    3. openspec instructions <artifact-id> --json
    4. 解析JSON获取context/template/rules
    5. 创建artifact文件
```

---

## 3. Context注入设计

### 3.1 Context数据结构

```typescript
// src/core/artifact-graph/instruction-loader.ts

export interface ChangeContext {
  graph: ArtifactGraph;      // Artifact依赖图
  completed: CompletedSet;    // 已完成的artifact ID集合
  schemaName: string;         // Schema名称
  changeName: string;         // Change名称
  changeDir: string;          // Change目录路径
  projectRoot: string;        // 项目根目录
}
```

### 3.2 Context组装流程

```typescript
// src/core/artifact-graph/instruction-loader.ts

export function loadChangeContext(
  projectRoot: string,
  changeName: string,
  schemaName?: string
): ChangeContext {
  const changeDir = path.join(projectRoot, 'openspec', 'changes', changeName);

  // Schema解析顺序: explicit > metadata > default
  const resolvedSchemaName = resolveSchemaForChange(changeDir, schemaName);

  const schema = resolveSchema(resolvedSchemaName, projectRoot);
  const graph = ArtifactGraph.fromSchema(schema);
  const completed = detectCompleted(graph, changeDir);

  return {
    graph,
    completed,
    schemaName: resolvedSchemaName,
    changeName,
    changeDir,
    projectRoot,
  };
}
```

### 3.3 Schema解析顺序

```
1. 显式参数 schemaName（如果提供）
    ↓
2. .openspec.yaml 元数据中的 schema 字段
    ↓
3. 默认 schema: 'spec-driven'
```

### 3.4 状态检测机制

```typescript
// src/core/artifact-graph/state.ts

// 通过文件存在性检测artifact完成状态
export function detectCompleted(graph: ArtifactGraph, changeDir: string): CompletedSet {
  const completed = new Set<string>();
  
  for (const artifact of graph.getAllArtifacts()) {
    const outputPath = path.join(changeDir, artifact.generates);
    if (fs.existsSync(outputPath)) {
      completed.add(artifact.id);
    }
  }
  
  return completed;
}
```

### 3.5 项目配置注入

```yaml
# openspec/config.yaml

schema: spec-driven

context: |
  Tech stack: TypeScript, Node.js (≥20.19.0), ESM modules
  Package manager: pnpm
  CLI framework: Commander.js
  
  Cross-platform requirements:
  - This tool runs on macOS, Linux, AND Windows
  - Always use path.join() for file paths

rules:
  specs:
    - Include scenarios for Windows path handling
    - Be explicit about mechanisms, not just outcomes
  tasks:
    - Add Windows CI verification as a task
  design:
    - Document any platform-specific behavior
    - Prefer Node.js path module over string manipulation
```

### 3.6 Context注入到指令

```typescript
// src/core/artifact-graph/instruction-loader.ts

export interface ArtifactInstructions {
  changeName: string;
  artifactId: string;
  schemaName: string;
  changeDir: string;
  outputPath: string;
  description: string;
  instruction: string | undefined;     // Schema定义的指令
  context: string | undefined;         // 项目配置的context
  rules: string[] | undefined;         // Artifact特定规则
  template: string;                    // 模板内容
  dependencies: DependencyInfo[];
  unlocks: string[];
}
```

---

## 4. Prompt结构设计

### 4.1 XML-like结构化格式

OpenSpec设计了清晰的结构化指令输出格式：

```typescript
// src/commands/workflow/instructions.ts

export function printInstructionsText(instructions: ArtifactInstructions): void {
  // Opening tag
  console.log(`<artifact id="${artifactId}" change="${changeName}" schema="${schemaName}>`);

  // Warning for blocked artifacts
  if (isBlocked) {
    console.log('<warning>');
    console.log('This artifact has unmet dependencies...');
    console.log('</warning>');
  }

  // Task directive
  console.log('<task>');
  console.log(`Create the ${artifactId} artifact for change "${changeName}".`);
  console.log(description);
  console.log('</task>');

  // Project context (AI constraint - do NOT include in output)
  console.log('<project_context>');
  console.log('<!-- Background information for you. Do NOT include in output. -->');
  console.log(context);
  console.log('</project_context>');

  // Rules (AI constraint - do NOT include in output)
  console.log('<rules>');
  console.log('<!-- Constraints for you to follow. Do NOT include in output. -->');
  for (const rule of rules) {
    console.log(`- ${rule}`);
  }
  console.log('</rules>');

  // Dependencies (files to read)
  console.log('<dependencies>');
  for (const dep of dependencies) {
    console.log(`<dependency id="${dep.id}" status="${status}">`);
    console.log(`  <path>${fullPath}</path>`);
    console.log(`  <description>${dep.description}</description>`);
    console.log('</dependency>');
  }
  console.log('</dependencies>');

  // Output location
  console.log('<output>');
  console.log(`Write to: ${outputPath}`);
  console.log('</output>');

  // Instruction (guidance)
  console.log('<instruction>');
  console.log(instruction);
  console.log('</instruction>');

  // Template (structure to follow)
  console.log('<template>');
  console.log('<!-- Use this as the structure for your output file. -->');
  console.log(template);
  console.log('</template>');

  // Success criteria
  console.log('<success_criteria>');
  console.log('</success_criteria>');

  // Unlocks
  console.log('<unlocks>');
  console.log(`Completing this artifact enables: ${unlocks.join(', ')}`);
  console.log('</unlocks>');

  // Closing tag
  console.log('</artifact>');
}
```

### 4.2 结构化设计优点

| 优点 | 说明 |
|------|------|
| **明确的责任分离** | context/rules是约束，template是输出格式 |
| **易于解析** | 标签结构便于程序化解析和验证 |
| **依赖追踪清晰** | dependencies标签明确列出前置条件 |
| **AI容易理解** | XML-like格式符合LLM的认知模式 |
| **可扩展** | 易于添加新的标签类型 |

### 4.3 约束 vs 内容

关键设计决策：

```markdown
<!-- context和rules是给AI的约束，不出现在输出中 -->
<project_context>
  <!-- This is background information for you. Do NOT include in output. -->
  Tech stack: TypeScript...
</project_context>

<rules>
  <!-- These are constraints for you. Do NOT include in output. -->
  - Include scenarios for Windows path handling
</rules>

<!-- template是输出结构，AI需要填充 -->
<template>
  <!-- Use this as the structure for your output file. -->
  ## Why
  <!-- Explain the motivation... -->
</template>
```

---

## 5. Agent协作机制

### 5.1 OpenSpec的Agent视角

OpenSpec本身没有显式的Agent定义，但其设计隐含了Agent协作模式：

```
Explore Agent (opsx:explore)
    ↓ 思考和探索
Continue Agent (opsx:continue)
    ↓ 创建artifact
Apply Agent (opsx:apply)
    ↓ 实现任务
Verify Agent (opsx:verify)
    ↓ 验证实现
Archive Agent (opsx:archive)
    ↓ 归档
```

### 5.2 共享信息机制

```
openspec/changes/<change-name>/
├── .openspec.yaml     # 元数据（schema, created）
├── proposal.md        # 所有Agent可读取
├── specs/             # 所有Agent可读取
├── design.md          # 所有Agent可读取
├── tasks.md           # Apply Agent追踪进度
└── README.md          # 人类可读的描述
```

### 5.3 CLI作为信息交换接口

```bash
# 状态查询（所有Agent使用）
openspec status --change "<name>" --json

# 指令生成（Continue Agent使用）
openspec instructions <artifact-id> --change "<name>" --json

# Apply指令（Apply Agent使用）
openspec apply --change "<name>" --json
```

---

## 6. Artifact依赖图设计

### 6.1 Schema定义

```yaml
# schemas/spec-driven/schema.yaml

name: spec-driven
version: 1
description: Default OpenSpec workflow - proposal → specs → design → tasks

artifacts:
  - id: proposal
    generates: proposal.md
    description: Initial proposal document
    template: proposal.md
    instruction: |
      Create the proposal document that establishes WHY this change is needed.
      Sections: Why, What Changes, Capabilities, Impact...
    requires: []           # 无依赖，是根节点

  - id: specs
    generates: "specs/**/*.md"
    description: Detailed specifications
    template: spec.md
    instruction: |
      Create specification files that define WHAT the system should do.
      Create one spec file per capability...
    requires:
      - proposal           # 依赖proposal

  - id: design
    generates: design.md
    description: Technical design document
    template: design.md
    instruction: |
      Create the design document that explains HOW to implement.
    requires:
      - proposal           # 依赖proposal

  - id: tasks
    generates: tasks.md
    description: Implementation checklist
    template: tasks.md
    instruction: |
      Create the task list that breaks down the implementation work.
      Each task MUST be a checkbox: `- [ ] X.Y Task description`
    requires:
      - specs              # 依赖specs
      - design             # 依赖design

apply:
  requires: [tasks]
  tracks: tasks.md
  instruction: |
    Read context files, work through pending tasks, mark complete as you go.
```

### 6.2 ArtifactGraph类

```typescript
// src/core/artifact-graph/graph.ts

export class ArtifactGraph {
  private artifacts: Map<string, Artifact>;
  private schema: SchemaYaml;

  // 拓扑排序计算构建顺序（Kahn算法）
  getBuildOrder(): string[] {
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();
    
    // 初始化所有artifact
    for (const artifact of this.artifacts.values()) {
      inDegree.set(artifact.id, artifact.requires.length);
      dependents.set(artifact.id, []);
    }
    
    // 构建反向邻接图
    for (const artifact of this.artifacts.values()) {
      for (const req of artifact.requires) {
        dependents.get(req)!.push(artifact.id);
      }
    }
    
    // Kahn算法
    const queue = [...this.artifacts.keys()]
      .filter(id => inDegree.get(id) === 0)
      .sort();
    
    const result: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      
      for (const dep of dependents.get(current)!) {
        const newDegree = inDegree.get(dep)! - 1;
        inDegree.set(dep, newDegree);
        if (newDegree === 0) {
          queue.push(dep);
        }
      }
    }
    
    return result;
  }

  // 获取可创建的artifact（所有依赖已完成）
  getNextArtifacts(completed: CompletedSet): string[] {
    const ready: string[] = [];
    for (const artifact of this.artifacts.values()) {
      if (completed.has(artifact.id)) continue;
      const allDepsCompleted = artifact.requires.every(req => completed.has(req));
      if (allDepsCompleted) {
        ready.push(artifact.id);
      }
    }
    return ready.sort();
  }

  // 获取被阻塞的artifact及其缺失依赖
  getBlocked(completed: CompletedSet): BlockedArtifacts {
    const blocked: BlockedArtifacts = {};
    for (const artifact of this.artifacts.values()) {
      if (completed.has(artifact.id)) continue;
      const unmetDeps = artifact.requires.filter(req => !completed.has(req));
      if (unmetDeps.length > 0) {
        blocked[artifact.id] = unmetDeps.sort();
      }
    }
    return blocked;
  }
}
```

### 6.3 依赖图可视化

```
proposal (root)
    │
    ├── specs ─────┐
    │              │
    └── design ────┤
                   │
                   ▼
                 tasks
                   │
                   ▼
                 apply phase
```

---

## 7. OMT可借鉴的设计模式

### 7.1 Schema驱动的工作流

**核心思想**: 工作流定义在Schema YAML中，而非硬编码

```yaml
# 可扩展新的schema
artifacts:
  - id: new-artifact
    generates: new-file.md
    template: new-template.md
    instruction: |
      Custom instruction for new artifact...
    requires: [existing-artifact]
```

**OMT借鉴**: 定义OMT自己的schema，如 `omt-workflow.yaml`

### 7.2 工具适配器模式

**核心思想**: 一套Skill/Command定义，适配多种AI工具

```typescript
// 定义一次，适配所有
const content: CommandContent = { id: 'explore', ... };
const claudeFile = claudeAdapter.formatFile(content);
const cursorFile = cursorAdapter.formatFile(content);
```

**OMT借鉴**: 支持Claude Code、Cursor、Copilot等多种工具

### 7.3 XML-like Prompt结构化

**核心思想**: 用标签结构组织指令，明确区分约束和内容

```xml
<project_context> <!-- AI约束，不输出 -->
<rules>           <!-- AI约束，不输出 -->
<template>        <!-- 输出结构，AI填充 -->
```

**OMT借鉴**: 设计OMT的Prompt模板格式

### 7.4 依赖图拓扑排序

**核心思想**: 通过依赖图和拓扑排序管理artifact创建顺序

**OMT借鉴**: OMT的任务依赖管理

### 7.5 Registry集中管理

**核心思想**: 使用Registry模式集中管理适配器

```typescript
CommandAdapterRegistry.get('claude');
CommandAdapterRegistry.get('cursor');
```

**OMT借鉴**: Agent Registry、Skill Registry

### 7.6 状态文件检测

**核心思想**: 通过文件存在性判断artifact完成状态，无需数据库

```typescript
const outputPath = path.join(changeDir, artifact.generates);
if (fs.existsSync(outputPath)) {
  completed.add(artifact.id);
}
```

**OMT借鉴**: OMT的状态管理

### 7.7 CLI作为信息交换接口

**核心思想**: CLI命令返回JSON，Skill解析JSON执行操作

```bash
openspec status --change "<name>" --json
openspec instructions <artifact-id> --json
```

**OMT借鉴**: OMT的CLI设计

---

## 8. 关键代码片段摘录

### 8.1 Skill模板示例（Explore）

```typescript
export function getExploreSkillTemplate(): SkillTemplate {
  return {
    name: 'openspec-explore',
    description: 'Enter explore mode...',
    instructions: `Enter explore mode. Think deeply. Visualize freely.
    
    **This is a stance, not a workflow.** There are no fixed steps.
    
    ## The Stance
    - Curious, not prescriptive
    - Open threads, not interrogations
    - Visual - Use ASCII diagrams liberally
    - Adaptive - Follow interesting threads
    
    ## What You Might Do
    - Explore the problem space
    - Investigate the codebase
    - Compare options
    - Visualize
    - Surface risks and unknowns
    
    ## Guardrails
    - Don't implement - Never write code
    - Don't fake understanding
    - Do visualize
    - Do explore the codebase`,
  };
}
```

### 8.2 Schema定义示例

```yaml
name: spec-driven
version: 1
artifacts:
  - id: proposal
    generates: proposal.md
    template: proposal.md
    instruction: |
      Create the proposal document...
    requires: []
    
apply:
  requires: [tasks]
  tracks: tasks.md
```

### 8.3 Context注入示例

```typescript
export function generateInstructions(
  context: ChangeContext,
  artifactId: string,
  projectRoot?: string
): ArtifactInstructions {
  // 加载模板
  const templateContent = loadTemplate(context.schemaName, artifact.template);
  
  // 读取项目配置
  const projectConfig = readProjectConfig(effectiveProjectRoot);
  
  // 分离context和rules
  const configContext = projectConfig?.context?.trim() || undefined;
  const configRules = projectConfig?.rules?.[artifactId];
  
  return {
    context: configContext,    // 项目背景
    rules: configRules,        // artifact规则
    template: templateContent,  // 模板结构
    ...
  };
}
```

### 8.4 适配器模式示例

```typescript
export const claudeAdapter: ToolCommandAdapter = {
  toolId: 'claude',
  
  getFilePath(commandId: string): string {
    return path.join('.claude', 'commands', 'opsx', `${commandId}.md`);
  },
  
  formatFile(content: CommandContent): string {
    return `---
name: ${content.name}
description: ${content.description}
category: ${content.category}
tags: [${content.tags.join(', ')}]
---
${content.body}`;
  },
};
```

---

## 9. 总结

OpenSpec的核心设计理念：

1. **Schema驱动**: 工作流定义在YAML Schema中，灵活可扩展
2. **工具无关**: 一套定义适配多种AI工具
3. **结构化Prompt**: XML-like格式清晰区分约束和内容
4. **依赖图管理**: 拓扑排序确保正确执行顺序
5. **文件状态检测**: 无需数据库，通过文件存在性判断进度
6. **CLI信息交换**: JSON输出便于Skill解析和执行

这些模式为OMT提供了清晰的设计参考。