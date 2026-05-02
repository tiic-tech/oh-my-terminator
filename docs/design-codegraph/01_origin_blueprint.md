# 🧬 Oh-my-terminator CodeGraph v3.0 —— 面向 AI Agent 的实时仓库智能建模工具：完整开发规格说明书

**目标读者**: AI 开发 Agent（用于直接指导编码）  
**技术栈**: TypeScript 5.x, Node.js 18+, pnpm workspace  
**核心约束**: 零外部运行时服务（无数据库、无 Python），零独立 LLM 调用，所有能力均基于图算法与静态分析

---

## 目录

1. [项目概述与目标](#1-项目概述与目标)
2. [架构全景](#2-架构全景)
3. [核心数据模型](#3-核心数据模型)
4. [解析器设计](#4-解析器设计)
5. [增量更新引擎](#5-增量更新引擎)
6. [图算法与智能分析引擎](#6-图算法与智能分析引擎)
7. [面向 Agent 的上下文情报 API](#7-面向-agent-的上下文情报-api)
8. [架构约束与规则引擎](#8-架构约束与规则引擎)
9. [任务辅助与编排集成](#9-任务辅助与编排集成)
10. [协作历史与技能需求分析](#10-协作历史与技能需求分析)
11. [会话监控与实时告警](#11-会话监控与实时告警)
12. [可视化与开发者体验](#12-可视化与开发者体验)
13. [多语言扩展架构](#13-多语言扩展架构)
14. [与 Harness-Engine 的深度集成](#14-与-harness-engine-的深度集成)
15. [CLI 与程序化接口](#15-cli-与程序化接口)
16. [测试与验收标准](#16-测试与验收标准)
17. [整体开发路线图与 Milestone 计划](#17-整体开发路线图与-milestone-计划)

---

## 1. 项目概述与目标

Harness CodeGraph 是一个纯 TypeScript 实现的仓库关系建模工具，专为 AI 驱动开发场景设计。它通过静态代码分析构建多粒度的代码关系图谱，并以极度压缩的文本形式向 Agent 提供精准的上下文情报，使 AI 编程助手能在长时间、多步骤的开发任务中始终保持对项目状态的清晰认知，而无需消耗大量 token 去阅读原始代码。

**核心能力**：
- 多粒度仓库建模：文件夹结构、文件间导入依赖、函数/类/组件/变量级别的调用关系、继承与实现关系
- 增量更新：每次 Git 提交后仅解析变更文件，局部刷新图谱，保持实时性
- 零外部 LLM 情报生成：所有上下文提示、健康度评分、架构约束等由纯图算法产生，不依赖任何 LLM API
- 按需上下文组装：根据任务描述自动检索相关代码模块，生成符合 token 预算的上下文注入包
- 架构守护：自动提取分层规则，检测循环依赖，验证代码变更是否违反架构约束
- 编排辅助：为多 Agent 系统提供任务拆解建议、任务 DAG 依赖校验、测试范围推荐、共同修改模式挖掘等高级功能
- 会话监控：实时检测 Agent 产生的代码 diff 是否引入架构问题
- 多语言支持框架：通过插件化的 tree-sitter 解析器适配器，可扩展至 Python、Go、Rust、C/C++、Java 等语言，且该扩展不会破坏纯 TypeScript 技术栈
- 开发者体验：交互式 CLI 探索工具、静态 HTML 报告生成、MCP 协议暴露

**技术约束**：
- 语言与运行时：TypeScript 5.x，Node.js 18+，不使用原生二进制依赖（除 WASM 外）
- 包管理：pnpm workspace
- 核心库只依赖 `typescript`（自带的编译器 API）、`isomorphic-git`（纯 JS Git 操作）、图操作自实现
- 所有分析结果持久化为本地 JSON 文件，存放于 `.codegraph/` 目录
- 不引入任何独立的数据库服务、消息队列、Python 环境

---

## 2. 架构全景

系统分为五层，自上而下分别为：**情报 API 层**、**智能分析引擎层**、**核心图谱存储与更新层**、**解析器层**、**平台适配层**。各层职责明确，仅通过接口通信。

```
┌───────────────────────────────────────────────────────────────────┐
│                    面向 Agent 的情报 API 层                         │
│  getScope · getImpact · getQuickBrief · getArchConstraints       │
│  buildContextFor · getChangesSince · predictImpact              │
│  suggestTaskBreakdown · validateTaskDAG                         │
│  getSkillDemand · getCoChangeSuggestions                        │
│  getTestScope · getMaturityScore                                │
│  startSession · getContextDiff · monitorSession                 │
│  generateHtmlReport · launchInteractiveCli                      │
└────────────────────────────────┬─────────────────────────────────-─┘
                                 │
┌────────────────────────────────▼────────────────────────────────-─┐
│                     智能分析引擎层（纯算法）                        │
│  - 循环依赖检测 (Tarjan)                                         │
│  - 影响范围分析 (BFS/DFS 下游)                                   │
│  - 架构分层推断 & 约束抽取                                        │
│  - 热点模块识别 & 成熟度评分                                      │
│  - 任务关键词匹配 & 文件检索                                      │
│  - 上下文裁剪 & Token 预算估计                                    │
│  - 共同修改模式挖掘 & 技能缺口计算                                 │
│  - 测试文件关联 & DAG 一致性检查                                  │
└────────────────────────────────┬────────────────────────────────-─┘
                                 │
┌────────────────────────────────▼────────────────────────────────-─┐
│                  核心图谱存储与增量更新层                           │
│  - 图数据结构 (节点/边/双向索引)                                  │
│  - 基线持久化 (.codegraph/baseline.json)                         │
│  - 增量更新引擎 (文件变更→局部重解析→级联处理)                    │
│  - 变更历史记录 (history.ldjson)                                 │
│  - 会话管理 (会话版本追踪)                                        │
└────────────────────────────────┬────────────────────────────────-─┘
                                 │
┌────────────────────────────────▼────────────────────────────────-─┐
│                        解析器层（可插拔）                           │
│  - ParserAdapter 接口                                            │
│  - 内置 TS/JS 解析器 (TypeScript Compiler API)                    │
│  - 外部语言解析器 (通过 tree-sitter WASM 实现，按需安装)           │
│  - 文件系统扫描 (CONTAINS 关系)                                   │
└────────────────────────────────┬────────────────────────────────-─┘
                                 │
┌────────────────────────────────▼────────────────────────────────-─┐
│                        平台适配层                                  │
│  - isomorphic-git (Git 操作)                                     │
│  - web-tree-sitter (WASM 解析器运行时)                            │
│  - fs/path (Node.js 标准库)                                       │
└──────────────────────────────────────────────────────────────────┘
```

所有层均以 TypeScript 类或纯函数实现，不依赖外部服务。

---

## 3. 核心数据模型

### 3.1 节点类型与定义

```typescript
enum NodeType {
  DIRECTORY = 'DIRECTORY',   // 文件夹
  FILE = 'FILE',             // 文件
  MODULE = 'MODULE',         // 可导出的函数、类、组件、变量、类型等
  EXTERNAL = 'EXTERNAL'      // node_modules 或内置模块
}

interface GraphNode {
  id: string;
  // 唯一标识，格式严格按照：
  //   DIRECTORY:相对路径       例如 "DIRECTORY:src"
  //   FILE:相对路径            例如 "FILE:src/utils.ts"
  //   MODULE:文件路径#导出名   例如 "MODULE:src/utils.ts#formatDate"
  //   EXTERNAL:包名            例如 "EXTERNAL:jsonwebtoken"

  type: NodeType;
  path: string;    // 对于 DIRECTORY/FILE/MODULE 为相对项目根的路径；对于 EXTERNAL 为模块名
  name: string;    // 对 DIRECTORY 为目录名，对 FILE 为文件名，对 MODULE 为导出名，对 EXTERNAL 为包名

  metadata?: {
    // 仅 MODULE 节点可能包含以下字段
    kind?: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'component' | 'unknown';
    jsDoc?: string;                // 前 200 字符的 JSDoc 注释
    complexity?: number;           // 圈复杂度
    loc?: number;                  // 有效代码行数（不含空行、注释）
    isExported?: boolean;          // 是否被导出
    deprecated?: boolean;          // 是否标记 @deprecated

    // 以下字段在增量更新和算法分析中动态维护
    testFile?: string;             // 对应的测试文件路径（如果有）
    lastModifiedCommit?: string;   // 最近修改该节点的 commit hash
    changeFrequency?: number;      // 最近 30 天内的修改次数
  };
}
```

### 3.2 边类型与定义

```typescript
enum EdgeType {
  CONTAINS = 'CONTAINS',           // 目录 → 文件/子目录
  IMPORTS = 'IMPORTS',             // 文件 → 文件（静态导入）
  CALLS = 'CALLS',                 // 函数/组件/类/方法 → 被调用的函数/组件/类/方法
  EXTENDS = 'EXTENDS',             // 类 → 基类
  IMPLEMENTS = 'IMPLEMENTS',       // 类 → 接口
  RE_EXPORTS = 'RE_EXPORTS',       // export { x } from ...
  DYNAMIC_IMPORTS = 'DYNAMIC_IMPORTS'  // import() 调用
}

interface GraphEdge {
  from: string;   // 源节点 ID
  to: string;     // 目标节点 ID
  type: EdgeType;
  metadata?: {
    line?: number;              // 该关系发生的代码行号
    isDynamic?: boolean;        // 是否为动态导入
    importSpecifier?: string;   // 导入的具体符号描述，如 "default", "named:formatDate"
    coChangeCount?: number;     // 与目标文件在历史中共同修改的次数（用于共同修改推荐）
  };
}
```

### 3.3 图容器接口

```typescript
interface CodeGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];                  // 所有边的列表
  inEdges: Map<string, GraphEdge[]>;   // 反向索引：目标节点 ID → 指向它的所有边
  outEdges: Map<string, GraphEdge[]>;  // 前向索引：源节点 ID → 发出的所有边
  commitHash: string;                  // 当前图谱对应的 Git commit
  timestamp: number;                   // 图谱生成时间戳
}

// 序列化格式（存入 baseline.json）
interface SerializedCodeGraph {
  nodes: [string, GraphNode][];
  edges: GraphEdge[];
  commitHash: string;
  timestamp: number;
}
```

必须实现的方法：
- `addNode(node: GraphNode): void`
- `addEdge(edge: GraphEdge): void`
- `removeNode(id: string): void` （同时删除相关边并更新索引）
- `removeEdgesForFile(filePath: string): void` （移除所有与该文件相关的边）
- `toJSON(): SerializedCodeGraph`
- `static fromJSON(data: SerializedCodeGraph): CodeGraph`

所有修改操作必须实时维护 `inEdges` 和 `outEdges` 索引。

### 3.4 基线文件结构

```typescript
interface Baseline {
  graph: SerializedCodeGraph;
  commitHash: string;
  timestamp: number;
  // v2.0+ 自动生成的统计信息
  architectureConstraints: string[];  // 自动提取的架构约束规则列表
  healthScore: number;                // 代码库成熟度评分 (0-100)
  skillDemand: SkillDemand;           // 技能需求分析结果
}

interface SkillDemand {
  testWriter: number;          // 0-1 表示需求程度
  refactorSpecialist: number;
  architect: number;
  securityReviewer: number;
}
```

基线文件存储于项目根目录下的 `.codegraph/baseline.json`。同时维护 `.codegraph/lastCommit.txt` 记录基线对应的 commit hash。

---

## 4. 解析器设计

### 4.1 文件系统扫描

1. 从项目根目录开始递归遍历所有非忽略目录。
2. 忽略规则（硬编码 + 可选 `.gitignore` 读取）：`.git/`, `node_modules/`, `dist/`, `build/`, `.next/`, `.cache/`, `.codegraph/`, `coverage/`。
3. 为每个目录创建 `DIRECTORY` 节点，为每个文件创建 `FILE` 节点，并生成 `CONTAINS` 边（目录→文件或子目录）。
4. 将所有扩展名为 `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs` 的文件路径收集到待解析列表。对于多语言插件，会根据注册的解析器支持扩展名收集对应文件。

### 4.2 内置 TypeScript/JavaScript 解析器

内置解析器基于 TypeScript Compiler API，作为默认注册的解析器，处理上述扩展名文件。

#### 4.2.1 创建 TypeScript Program

```typescript
import ts from 'typescript';

function createProgram(filePaths: string[], projectRoot: string): ts.Program {
  // 尝试读取 tsconfig.json，若不存在则使用默认配置
  const configPath = ts.findConfigFile(projectRoot, ts.sys.fileExists, 'tsconfig.json');
  const config = configPath
    ? ts.readConfigFile(configPath, ts.sys.readFile).config
    : {};

  return ts.createProgram(filePaths, {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    allowJs: true,
    checkJs: false,          // 不进行类型检查，提高速度
    noEmit: true,
    resolveJsonModule: true,
    baseUrl: projectRoot,
    paths: config.compilerOptions?.paths || {},
    ...config.compilerOptions,
  });
}
```

#### 4.2.2 提取导入关系（IMPORTS 边）

遍历每个 `SourceFile` 的 `importDeclarations`, `exportDeclarations`, `importEqualsDeclaration`, 动态 `import()` 调用等：

- 解析模块说明符（相对路径或别名路径），通过 TypeScript 的模块解析逻辑（`ts.resolveModuleName`）得到真实的文件路径。若未找到对应文件（如外部包），则创建 `EXTERNAL` 节点。
- 对项目内的文件导入，生成 `IMPORTS` 边：`FILE:source → FILE:resolved`。
- 对 `export { x } from '...'` 生成 `RE_EXPORTS` 边。
- 对 `import()` 生成 `DYNAMIC_IMPORTS` 边。

#### 4.2.3 提取 MODULE 节点（可导出符号）

在同一个 `SourceFile` 中，遍历所有顶级声明：

- `FunctionDeclaration`, `ClassDeclaration`, `VariableStatement` (export const/let), `InterfaceDeclaration`, `TypeAliasDeclaration`, `EnumDeclaration`。
- 仅当声明被导出（通过 `export` 修饰符或显式 `export { name }` 导出）时，才创建 `MODULE` 节点。节点的 `kind` 依据语法推断：
  - `FunctionDeclaration` → `function`
  - `ClassDeclaration` → `class`
  - `VariableStatement` 中若初始化器为箭头函数/函数表达式 → `function`，若为组件（JSX 元素）→ `component`
  - `InterfaceDeclaration` → `interface`
  - `TypeAliasDeclaration` → `type`
  - 其他 → `variable`
- 提取 JSDoc 注释，取前 200 字符存入 `jsDoc`。
- 计算圈复杂度：基于 AST 中条件分支、循环、逻辑运算符的数量（可参考 eslint 的复杂度计算），存入 `complexity`。
- 计算有效代码行数（不含注释和空行）存入 `loc`。

#### 4.2.4 构建调用图（CALLS/EXTENDS/IMPLEMENTS）

需要 TypeScript 的 `TypeChecker`：

- 对每个 `FunctionDeclaration` 或 `VariableStatement`（函数表达式）内的 `CallExpression`，获取调用签名的符号，通过 `getSymbolAtLocation` 找到其定义位置。
- 若定义位置在项目内，则创建 `CALLS` 边：`MODULE:当前文件#当前函数 → MODULE:定义文件#被调函数`。
- 对 `NewExpression` 同样处理，视为 `CALLS` 或创建 `INSTANTIATES` 边（但统一用 `CALLS` 以简化）。
- 对 JSX 元素（组件使用）也解析为 `CALLS`，目标组件名需解析到对应的函数/类组件。
- 对类继承（`extends`）生成 `EXTENDS` 边，接口实现（`implements`）生成 `IMPLEMENTS` 边。

注意：跨文件解析依赖 `TypeChecker` 会自动加载声明文件，性能可接受。

#### 4.2.5 解析器接口实现

内置解析器需实现 `ParserAdapter` 接口（详细定义见第 13 章），并默认注册到核心解析器注册表。

### 4.3 合并解析结果

解析器返回新增的节点和边列表，核心层负责将其合并到全局 `CodeGraph` 中，去重（依据节点 `id` 和边的 `from, to, type` 组合）并更新索引。

---

## 5. 增量更新引擎

### 5.1 基线存储

- 基线文件：`.codegraph/baseline.json`，内容为 `SerializedCodeGraph` 及附加的统计信息（见 3.4）。
- 提交哈希文件：`.codegraph/lastCommit.txt`，纯文本存放上次分析时的 HEAD commit hash。
- 变更历史文件：`.codegraph/history.ldjson`，每行一条 JSON，记录每次增量更新的 `DeltaSummary`。

### 5.2 触发与执行

提供两个核心入口函数：

```typescript
async function analyzeFull(cwd: string): Promise<CodeGraph>;
async function updateIncrementally(cwd: string): Promise<{ graph: CodeGraph; delta: DeltaSummary }>;
```

**全量分析过程**：
1. 扫描文件系统，创建 `CONTAINS` 关系。
2. 初始化空 `CodeGraph`。
3. 调用所有注册的解析器（根据扩展名分发文件），获取节点和边，合并入图。
4. 写入基线文件和 `lastCommit.txt`（当前 HEAD 哈希）。
5. 运行智能分析引擎，计算架构约束、健康评分等，存入基线结构后序列化。

**增量更新过程**：
1. 读取 `lastCommit.txt`，得到 `lastCommit`。
2. 通过 `isomorphic-git` 获取 `lastCommit` 到 `HEAD` 之间的所有提交中变更的文件列表（`git log --name-only` 类似效果）。汇总所有新增、修改、删除的文件。
3. 过滤出支持的文件扩展名。
4. 处理删除文件：调用 `removeNode` 删除对应 `FILE` 节点及其 `MODULE` 子节点，并利用索引清除所有关联边。
5. 处理新增/修改文件：将这些文件的路径交给解析器重新解析，得到新的节点和边集。**在合并前，必须先移除这些文件在图中的所有旧节点和边**（因为修改可能删除导出、改变依赖），然后插入新解析结果。
6. **级联影响处理**：若某文件的导出符号列表发生变化（即 MODULE 节点增删），需找出所有导入该文件的其他文件（通过反向索引 `inEdges` 中 `IMPORTS` 边），强制对这些文件重新运行解析，以更新它们的 `IMPORTS` 边和可能受影响的 `CALLS` 边。这一过程可以重复直到不再有新的受影响文件（通常一轮即可）。
7. 更新 `lastCommit.txt`，重新序列化基线。
8. 重新运行智能分析引擎（仅对受影响的部分重算，如循环检测可局部增量），更新基线中的统计信息。
9. 生成 `DeltaSummary`，追加到 `history.ldjson`。

### 5.3 DeltaSummary 格式

```typescript
interface DeltaSummary {
  commitFrom: string;
  commitTo: string;
  changedFiles: string[];
  newModules: string[];
  removedModules: string[];
  affectedFiles: string[];   // 由于导出变化而被级联重解析的文件
  newCycles?: string[][] | null;  // 新增的循环依赖列表
}
```

---

## 6. 图算法与智能分析引擎

此层为纯算法模块，无副作用，仅读取 `CodeGraph` 并返回结果。

### 6.1 循环依赖检测

在 `IMPORTS` 边构成的子图上运行 Tarjan 强连通分量算法，返回所有大小 > 1 的分量，每个分量是一个文件 ID 列表。

### 6.2 影响范围分析 (getImpact)

输入一组文件或模块 ID，通过反向索引 `inEdges` 递归查找所有直接或间接依赖这些目标的文件/模块，返回影响清单。

### 6.3 架构分层推断

根据文件的导入方向和目录结构，自动推断逻辑分层。算法：

1. 将所有 `FILE` 节点按其所在的一级子目录分组（如 `src/pages/*` 为一组，`src/components/*` 为一组）。
2. 统计组间的 `IMPORTS` 边数量和方向。
3. 根据依赖方向计算层级：被依赖最多的为基础层（如 utils），依赖别人最多的为上层（如 pages）。
4. 输出分层列表及违反分层规则的导入（如 `pages → components` 是正常，若出现 `components → pages` 则为违规）。
5. 若无明显目录分层，则回退到按依赖深度聚类。

### 6.4 热点模块识别与成熟度评分

- **热点计算**：综合文件修改频率（来自 `changeFrequency` 元数据）和圈复杂度 `complexity`，乘积越大越热。
- **成熟度评分**：基于以下指标加权计算（0-100）：
  - 循环依赖数：超过 2 个严重扣分
  - 未测试的热点文件比例：无对应测试文件的热点文件占比
  - 架构层违规数：每 5 个违规扣若干分
  - 平均圈复杂度：过高扣分
  - 死代码可能性（未被任何其他文件导入且无测试引用的文件）

### 6.5 任务关键词匹配与文件检索

给定一个任务描述字符串，执行：
1. 分词：按空格、驼峰、破折号、下划线分割，转换为小写。过滤掉常见的停用词（the, a, to, of 等）。
2. 在每个 `FILE` 和 `MODULE` 的名称、路径、jsDoc 中查找匹配项（简单字符串包含）。
3. 根据匹配度（命中关键词数量）和节点在图中的度中心性排序，返回 Top N 文件。

此功能是实现 `suggestTaskBreakdown` 和 `buildContextFor` 的底层基础。

### 6.6 共同修改模式挖掘

在增量更新过程中，记录每次 commit 中共同修改的文件对，并累加到 `IMPORTS` 边的 `coChangeCount` 上。`getCoChangeSuggestions` 查询时，对指定文件找出 `coChangeCount` 最高的边，作为推荐。

### 6.7 测试文件关联

通过命名约定（如 `src/foo.ts` → `src/__tests__/foo.test.ts`）和图关系（测试文件会导入被测文件）建立映射。在 `FILE` 节点的 `testFile` 元数据中记录对应测试文件路径。

### 6.8 技能缺口计算

根据成熟度评分的子指标计算出对各类型技能的需求度，归一化到 0-1。例如：
- 测试覆盖率低 → `testWriter` 需求高
- 高复杂度函数多 → `refactorSpecialist` 需求高
- 架构违规多 → `architect` 需求高

### 6.9 上下文裁剪与 Token 估计

- 使用粗略的 token 估计：字符数 / 4（或引入可选依赖 `tiktoken`，非必须）。
- 在构建上下文时，如果总估计 token 超过上限，按相关度优先级裁剪，并在末尾添加省略提示。

---

## 7. 面向 Agent 的上下文情报 API

所有 API 均作为 `CodeGraph` 类的方法实现，返回高度压缩的字符串或结构化对象，目标 token 占用不超过 600。

### 7.1 getScope(target: string): string

输入：节点 ID（如 `FILE:src/auth.ts` 或 `MODULE:src/auth.ts#login`）。
输出模板：
```
## Scope: <path>
- Exports: <export list>
- Imports: <imported files/modules>
- Imported by: <list of files that import this file>
- Upstream calls: <which functions this module calls>
- Downstream calls: <which modules call this>
- Test file: <path or none>
- Complexity: <level> (<number>)
- Last modified: <relative time or commit count ago>
```

### 7.2 getQuickBrief(filePath: string): string

极简版本，仅包含：
- Imports / Imported by 数量
- 是否有测试文件
- 是否标记 deprecated

### 7.3 getImpact(targets: string[]): string

输入：文件或模块 ID 列表。
输出：受影响文件的列表文本，并高亮直接调用者数量。

### 7.4 getArchitectureLayers(): string

输出：分层描述，每行列出一层及包含的文件数量，附上违规导入对。

### 7.5 getArchConstraints(): string

输出：当前有效的架构约束规则列表及违反次数。格式：
```
- 规则1: 禁止从 src/backend 导入 src/frontend (违反 3 次)
- 规则2: 禁止循环依赖 (当前 1 个)
```

### 7.6 buildContextFor(taskDescription: string, options?: { maxTokens?: number; includeTests?: boolean }): ContextPackage

返回类型：
```typescript
interface ContextPackage {
  content: string;        // 可直接注入 Agent 的上下文文本
  estimatedTokens: number;
}
```

内部流程：
1. 使用 6.5 的关键词匹配检索相关文件集。
2. 为每个文件调用 `getScope` 的简版，组装成一个 Markdown 段落。
3. 附加上当前有效的架构约束提醒、最近增量变更摘要（如果可用）。
4. 如果 `includeTests` 为 true，追加每个文件对应的测试文件建议。
5. 执行 token 预算控制：如果估计 token 超限，按相关度裁剪次要文件，尾部添加 `... (x more files omitted)`。

### 7.7 getChangesSince(contextVersion: string): string

输入：基线 commit hash。输出自该 commit 到当前 HEAD 的变更摘要文本，包含新增/删除/修改的文件、新增/删除的模块列表。

### 7.8 predictImpact(filePaths: string[]): string

`getImpact` 的别名，语义一致。

### 7.9 getMaturityScore(): { score: number; details: string }

返回评分及详细说明（热点、循环、违规等）。

### 7.10 getTestScope(targetFile: string): string

返回建议运行的测试文件列表（直接测试文件 + 间接影响文件）。

---

## 8. 架构约束与规则引擎

### 8.1 自动约束提取

基于架构分层结果，自动生成约束规则。例如，若检测到多数导入是 `pages → components`，则生成规则：“禁止从 `src/components` 导入 `src/pages` 下的模块”。规则以字符串数组形式存储于基线中。

### 8.2 自定义规则文件

可选项：开发者可在 `.codegraph/rules.json` 中自定义额外的约束规则，格式：
```json
{
  "forbidden": [
    { "from": "src/backend/**", "to": "src/frontend/**" }
  ]
}
```
引擎会合并自动规则和自定义规则进行验证。

### 8.3 约束验证 API

`validateConstraint(rule: string, graph: CodeGraph): Violation[]`  
接受一条规则和当前图，返回违反该规则的导入边列表。

`checkDiffAgainstConstraints(diff: string, graph: CodeGraph): Violation[]`  
接受一个 git diff，模拟应用后检查是否新增违规。

---

## 9. 任务辅助与编排集成

### 9.1 suggestTaskBreakdown(description: string): TaskSuggestion[]

返回建议的任务骨架列表：
```typescript
interface TaskSuggestion {
  title: string;
  reason: string;
  relatedFiles: string[];
  risk: 'high' | 'medium' | 'low';
}
```
算法：基于关键词匹配到的文件集群，利用图的连通性进行聚类，为每个聚集生成一个建议任务。

**注意**：此功能为启发式建议，不可替代 Orchestrator 的决策，仅供辅助。

### 9.2 validateTaskDAG(dag: TaskDAG): DAGValidationResult

输入任务 DAG 定义：
```typescript
interface TaskDAG {
  tasks: { id: string; description: string; expectedChangedFiles?: string[] }[];
  dependencies: { from: string; to: string }[];  // from 依赖 to
}
```
验证逻辑：
- 扫描每个任务的 `expectedChangedFiles`，如果任务 A 依赖于任务 B 的输出文件，但 DAG 中没有相应顺序，则发出警告。
- 检查是否有循环依赖。
- 返回警告列表及严重性。

---

## 10. 协作历史与技能需求分析

### 10.1 getCoChangeSuggestions(filePath: string): CoChange[]

返回在 Git 历史中经常与该文件一起修改的文件列表，附上概率（基于 `coChangeCount` 归一化）。

### 10.2 getSkillDemand(): SkillDemand

从基线中读取已计算的技能需求，若无则当场计算（基于当前图）。返回各技能的需求度。

---

## 11. 会话监控与实时告警

### 11.1 会话管理

- `startSession(sessionId: string, initialContextVersion?: string): void`  
  注册会话，并绑定上下文版本（默认为当前基线 commit hash）。
- `getContextDiff(sessionId: string): string`  
  返回自绑定版本到当前的变更摘要，供 Agent 续接上下文。

### 11.2 实时监控

`monitorSession(sessionId: string, diff: string): MonitorAlert[]`

不对实际基线做任何修改。将 diff 应用到虚拟图（从当前基线拷贝），检查：
- 是否引入新的循环依赖？
- 是否违反架构约束？
- 是否删除了仍在被其他模块使用的导出？

返回警报列表，包含严重性、描述、涉及的文件。Orchestrator 可据此暂停 Agent 或触发修正。

---

## 12. 可视化与开发者体验

### 12.1 交互式 CLI 探索

命令：`codegraph explore`  
提供一个 REPL 界面，支持以下快捷命令：
- `scope <target>`：显示作用域
- `impact <file>`：显示影响范围
- `health`：显示健康评分
- `layers`：显示分层
- `context <desc>`：生成上下文
- `dot <file>`：输出该文件上下游的 Graphviz DOT 图（可直接渲染）

使用 Node.js `readline` 模块实现，无需额外依赖。

### 12.2 静态 HTML 报告

命令：`codegraph report --output report.html`  
生成一个单文件 HTML，包含：
- 整体健康仪表盘（评分、热点、循环）
- 架构分层图（通过 Mermaid 实现，内置简单的 Mermaid 字符串生成）
- 热点文件 Top 10 列表
- 循环依赖可视化（Mermaid 图）

HTML 完全自包含，离线可用。

### 12.3 MCP Server 暴露

在独立的包 `@harness/codegraph-mcp` 中，基于 FastMCP 将上述所有 API 映射为 MCP 工具，方便集成到 Claude Code 等支持 MCP 的环境中。该包作为可选功能，不影响核心库体积。

---

## 13. 多语言扩展架构

为了支持 Python、Go、Rust、C/C++、Java 等语言，系统采用插件化解析器适配器模式。

### 13.1 ParserAdapter 接口

所有语言解析器必须实现：

```typescript
interface ParserAdapter {
  language: string;          // 如 "typescript", "python", "go"
  extensions: string[];      // ['*.py'] 等
  parseFiles(filePaths: string[], projectRoot: string): Promise<{
    nodes: GraphNode[];
    edges: GraphEdge[];
  }>;
}
```

### 13.2 内置解析器

TypeScript/JavaScript 解析器实现 `ParserAdapter` 并默认注册。它是唯一随核心库一起安装的解析器。

### 13.3 外部语言解析器（基于 tree-sitter）

- 每个语言插件作为一个独立的 npm 包，例如 `@harness/codegraph-parser-python`。
- 实现依赖 `web-tree-sitter`（纯 WASM 环境），并携带对应语言的 `tree-sitter-<lang>.wasm` 文件。
- 插件内部编写 tree-sitter 查询（`.scm` 文件）来提取导入、定义、调用等关系，并以统一数据格式返回节点和边。
- 解析流程：
  1. `init()` 加载 WASM，实例化 `Parser` 并设置语言。
  2. `parseFiles()` 中读取每个文件源码，调用 `parser.parse()` 获得 CST。
  3. 使用预先定义的 Query（如提取 `import_statement` 节点）遍历捕获结果，构建相应的 `GraphNode` 和 `GraphEdge`。
  4. 对函数定义、调用、类继承等同样通过 query 提取。
- 注意：tree-sitter 的查询需要适配每种语言的语法，但模式相似（导入声明、函数定义、调用表达式等）。

### 13.4 解析器注册与分发

核心库维护一个解析器注册表：
```typescript
const parserRegistry: Map<string, ParserAdapter> = new Map();

export function registerParser(parser: ParserAdapter) {
  parserRegistry.set(parser.language, parser);
  // 同时可建立扩展名 → 语言的映射
}
```

在分析时，根据文件扩展名找到对应的 `ParserAdapter`，若未找到则跳过该文件（全量分析时记录警告）。

### 13.5 对 pnpm Workspace 的影响

- 核心库 `@harness/codegraph` 不依赖任何外部语言插件，保持轻量。
- 语言插件作为独立的 workspace 包，与核心库并列，通过 `peerDependencies` 引用核心库。
- 用户按需安装，如 `pnpm add @harness/codegraph-parser-python` 即可让核心库自动检测并注册（利用 `require.resolve` 动态加载）。
- 所有插件依然是纯 TypeScript 编写，唯一的外部依赖是 `web-tree-sitter` 和对应语言的 WASM 文件，不破坏纯 JS/TS 技术栈。

---

## 14. 与 Harness-Engine 的深度集成

### 14.1 作为库直接调用

在 Orchestrator 代码中：
```typescript
import { CodeGraph } from '@harness/codegraph';

const graph = await CodeGraph.loadOrAnalyze(projectRoot);

// 在 pre-mspec hook 中
const layers = graph.getArchitectureLayers();
const health = graph.getMaturityScore();
// 将信息嵌入 MSpec 的 context 字段
```

### 14.2 在 OpenSpec 模板中使用

OpenSpec 的 proposal 模板支持占位符，Orchestrator 在渲染时用 CodeGraph API 替换：
```
## 影响范围
{{CODEGRAPH_IMPACT $CHANGED_FILES}}
## 架构约束
{{CODEGRAPH_ARCH_CONSTRAINTS}}
```

### 14.3 任务上下文注入

Orchestrator 在分发 atom_task 时：
```typescript
const ctx = graph.buildContextFor(task.description, { maxTokens: 800 });
agent.run({ systemPrompt: ctx.content });
```

### 14.4 持续监控与反馈

在 Agent 产生 diff 后，Orchestrator 调用 `graph.monitorSession(sessionId, diff)` 进行合规检查，若出现严重警报，可暂停任务并触发人工审查或替换 Agent。

---

## 15. CLI 与程序化接口

核心 CLI 命令由 `@harness/codegraph` 包提供（通过 `bin` 字段）：

| 命令 | 功能 |
|------|------|
| `codegraph analyze` | 执行全量分析并写入基线 |
| `codegraph update` | 执行增量更新 |
| `codegraph health` | 输出成熟度评分和详情 |
| `codegraph scope <target>` | 输出指定节点的作用域 |
| `codegraph impact <files...>` | 输出影响范围 |
| `codegraph constraints` | 列出所有架构约束及违反数 |
| `codegraph context <description>` | 根据描述生成上下文并打印 |
| `codegraph task-suggest <description>` | 输出任务拆解建议 |
| `codegraph test-scope <file>` | 输出建议的测试范围 |
| `codegraph cochange <file>` | 输出共同修改推荐 |
| `codegraph explore` | 启动交互式探索 REPL |
| `codegraph report --output <path>` | 生成 HTML 报告 |
| `codegraph serve` | 启动 MCP Server（需要 `@harness/codegraph-mcp`） |

所有命令使用 `cac` 库实现，兼容 POSIX 风格参数。

---

## 16. 测试与验收标准

### 16.1 单元测试

- 图数据结构：节点的增删、边的增删、索引一致性。
- 解析器：各种导入/导出场景（默认导入、命名导入、动态导入、重导出、别名路径解析），函数调用提取，复杂度计算，JSDoc 截断。
- 情报 API：给定已知的图 fixture，验证 `getScope`, `getImpact`, `buildContextFor` 等输出文本的准确性。

### 16.2 集成测试

- 建立一个多文件的 fixture 仓库（含循环依赖、跨文件调用、React 组件、测试文件），验证全量分析的一致性。
- 模拟多次 commit 后，验证增量更新的正确性，以及级联更新是否覆盖所有受影响文件。
- 使用 `validateTaskDAG` 对故意错误排序的 DAG 检查是否能检测出依赖错误。
- 使用 `monitorSession` 模拟一个引入循环依赖的 diff，检查是否能产生警报。

### 16.3 性能基准

- 在 1000 个 `.ts` 文件的真实开源项目（如部分 VS Code 源码）上，全量分析 ≤ 8 秒，增量更新 ≤ 1.5 秒。
- 内存使用 ≤ 256 MB（Node.js 默认堆）。

### 16.4 Agent 消费验收

选择 5 个真实开发任务，使用 `buildContextFor` 生成上下文，由人类评估信息密度、精准度和 token 效率。目标：平均 token 消耗 ≤ 500，且包含足够的决策信息。

---

## 17. 整体开发路线图与 Milestone 计划

### Milestone 1: MVP — 核心引擎与 TS/JS 支持 (预计 10 天)

**目标**：实现一个可用的仓库建模工具，支持 TypeScript/JavaScript，提供文件级和函数级依赖图，并能增量更新。

**交付物**：
- `packages/codegraph` 核心包，包含：
  - 图数据结构与双向索引（第 3 章）
  - 文件系统扫描与 CONTAINS 关系（4.1）
  - 内置 TS/JS 解析器（4.2），包含 IMPORTS 提取、MODULE 节点生成（不含调用图）
  - 全量分析流程（5.2 前半）
  - 基线持久化（5.1）
  - 基础情报 API：`getScope`, `getQuickBrief`, `getImpact`, `getArchitectureLayers`（7.1-7.4）
  - CLI 命令：`analyze`, `update`, `scope`, `impact`, `layers`
- 单元测试与少量集成测试
- 文档：API 使用示例

**不在 MVP 范围**：调用图（CALLS）、架构约束、任务辅助、可视化、多语言、会话监控。

### Milestone 2: 完整调用图与增量引擎增强 (预计 7 天)

**目标**：补全函数/组件级别的调用关系，完善增量更新逻辑。

**交付物**：
- 新增 TypeChecker 解析，生成 CALLS/EXTENDS/IMPLEMENTS 边（4.2.4）
- 级联影响处理（5.2 第 6 步）
- `getChangesSince` API
- `history.ldjson` 记录
- 增量更新正确性测试

### Milestone 3: 智能分析与约束引擎 (预计 8 天)

**目标**：添加架构守护和任务辅助功能。

**交付物**：
- 循环依赖检测与展示
- 架构分层推断与自动约束提取（第 8 章）
- `getArchConstraints`, `getMaturityScore` API
- 技能需求分析（第 10 章）
- 测试文件关联（6.7）
- CLI 命令：`health`, `constraints`
- HTML 报告生成初版（仅健康仪表盘和循环图）

### Milestone 4: 上下文构建与编排集成 (预计 6 天)

**目标**：实现按需上下文组装，支持 Orchestrator 深度集成。

**交付物**：
- 关键词匹配与文件检索算法（6.5）
- `buildContextFor` API 及 token 预算控制
- `suggestTaskBreakdown`, `validateTaskDAG` 实现
- `getTestScope`, `getCoChangeSuggestions`
- CLI 命令：`context`, `task-suggest`, `test-scope`, `cochange`
- OpenSpec 模板钩子文档

### Milestone 5: 会话监控与可视化 (预计 6 天)

**目标**：实现会话版本追踪和实时 diff 监控，完善开发者体验。

**交付物**：
- 会话管理：`startSession`, `getContextDiff`
- `monitorSession` 及虚拟约束检查
- 交互式 CLI `explore` 完整功能（含 DOT 输出）
- 完善 HTML 报告（分层图、热点列表）
- CLI 命令 `explore`, `report` 完善

### Milestone 6: 多语言支持框架及首个外部解析器 (预计 8 天)

**目标**：建立插件化架构，并实现一个示例外部语言解析器（推荐 Python），验证多语言扩展能力。

**交付物**：
- `ParserAdapter` 接口定义及核心库注册机制（第 13 章）
- 将内置 TS 解析器改造为符合接口的自注册插件
- `@harness/codegraph-parser-python` 包，基于 `web-tree-sitter` 和预编译 WASM
- 解析 Python 的导入、函数定义、调用关系
- 多语言分析流程联调测试
- 文档：如何开发新语言插件

### Milestone 7: MCP 集成与最终打磨 (预计 5 天)

**目标**：提供可选的 MCP Server，优化性能与内存，输出最终文档。

**交付物**：
- `@harness/codegraph-mcp` 包，暴露所有核心 API 为 MCP 工具
- 性能优化（大项目 lazy 加载策略、并行解析 worker_threads 可选）
- 完整的测试覆盖与验收文档
- 最终发布 `v1.0.0`

---