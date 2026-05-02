# CodeGraph 开发拆分规划

> **文档定位**: 基于 [01_origin_blueprint.md](./01_origin_blueprint.md) 和 [02_scene_adaptation_engine.md](./02_scene_adaptation_engine.md) 的设计，按照 OpenSpec change 逻辑拆分开发工作，作为创建 change 并推进开发的依据。

---

## 目录

1. [整体开发路线概览](#1-整体开发路线概览)
2. [OpenSpec Change 拆分原则](#2-openspec-change-拆分原则)
3. [Milestone 1 MVP 详细拆分](#3-milestone-1-mvp-详细拆分)
4. [后续 Milestone 拆分规划](#4-后续-milestone-拆分规划)
5. [Change 依赖关系图](#5-change-依赖关系图)
6. [开发执行建议](#6-开发执行建议)

---

## 1. 整体开发路线概览

### 1.1 Blueprint 原始 Milestone 规划

| Milestone | 目标 | 预计工期 | 核心交付 |
|-----------|------|---------|---------|
| M1: MVP | 核心引擎 + TS/JS支持 | 10天 | 图结构、解析器、基础API、CLI |
| M2: 调用图增强 | 函数级调用关系 | 7天 | CALLS边、级联更新、增量完善 |
| M3: 智能分析 | 架构守护 + 任务辅助 | 8天 | 循环检测、分层推断、约束引擎 |
| M4: 编排集成 | 上下文构建 | 6天 | buildContextFor、任务辅助API |
| M5: 会话监控 | 版本追踪 + 可视化 | 6天 | session管理、explore CLI、HTML报告 |
| M6: 多语言 | 插件架构 + Python | 8天 | ParserAdapter、Python解析器 |
| M7: MCP集成 | 最终打磨 | 5天 | MCP Server、性能优化、v1.0.0发布 |

**总工期**: 约 50 天（7 周）

### 1.2 设计文档演进状态

```
┌─────────────────────────────────────────────────────────────┐
│                    设计文档状态                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  01_origin_blueprint.md ✅ 完成                              │
│  ├─ 核心数据模型定义                                         │
│  ├─ 解析器设计                                               │
│  ├─ 增量更新基础流程                                         │
│  ├─ 17章API定义                                             │
│  └─ Milestone规划                                           │
│                                                             │
│  02_scene_adaptation_engine.md ✅ 完成                       │
│  ├─ 分层Cascade策略                                         │
│  ├─ 场景适配规则体系                                         │
│  ├─ 情报契约设计                                             │
│  └─ 职责边界划分                                             │
│                                                             │
│  状态：设计阶段完成，可进入开发                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. OpenSpec Change 拆分原则

### 2.1 Change 单元的定义

一个 OpenSpec change 代表一个**可独立开发、独立验证、独立交付**的工作单元：

```
┌─────────────────────────────────────────────────────────────┐
│                    Change 结构                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  openspec/changes/<change-name>/                            │
│  ├─ proposal.md     # 变更提案：做什么、为什么                │
│  ├─ design.md       # 技术设计：如何实现                      │
│  ├─ tasks.md        # 任务拆解：具体步骤                      │
│  ├─ (可选) 其他artifacts                                    │
│  └─ archive.md      # 完成后归档                             │
│                                                             │
│  Change 完成标准：                                           │
│  1. tasks.md 中所有任务完成                                  │
│  2. 相关测试通过                                             │
│  3. 代码已合并到主分支                                       │
│  4. archive.md 记录完成状态                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 拆分原则

| 原则 | 说明 |
|------|------|
| **独立性** | 一个 change 不依赖其他未完成的 change（或明确标注依赖） |
| **完整性** | 一个 change 交付后可独立验证其功能 |
| **粒度适中** | 一个 change 的工作量约 1-3 天 |
| **边界清晰** | change 之间的接口和依赖明确定义 |
| **可回滚** | 单个 change 失败不影响其他 change |

### 2.3 Change 类型标记

```
类型标记规则：
- [CORE]     核心基础设施，其他change依赖它
- [PARSER]   解析器相关
- [API]      情报API相关
- [CLI]      命令行接口
- [TEST]     测试覆盖
- [DOC]      文档补充
- [INFRA]    工程/构建相关
```

---

## 3. Milestone 1 MVP 详细拆分

### 3.1 MVP 交付物清单（来自 Blueprint）

```
M1 原始交付物：
├─ 图数据结构与双向索引（第3章）
├─ 文件系统扫描与CONTAINS关系（4.1）
├─ 内置TS/JS解析器（4.2），包含：
│   ├─ IMPORTS提取
│   └─ MODULE节点生成（不含调用图）
├─ 全量分析流程（5.2前半）
├─ 基线持久化（5.1）
├─ 基础情报API（7.1-7.4）：
│   ├─ getScope
│   ├─ getQuickBrief
│   ├─ getImpact
│   └─ getArchitectureLayers
├─ CLI命令：
│   ├─ analyze
│   ├─ update
│   ├─ scope
│   ├─ impact
│   └─ layers
├─ 单元测试与少量集成测试
└─ 文档：API使用示例
```

### 3.2 Change 拆分方案

#### Change 1: 核心图数据结构 [CORE]

**名称**: `cg-core-graph-structure`

**目标**: 实现图数据结构、节点/边定义、双向索引

**范围**:
- `NodeType`, `EdgeType` 枚举定义
- `GraphNode`, `GraphEdge` 接口实现
- `CodeGraph` 类：节点/边的增删、索引维护
- 序列化/反序列化（`toJSON`, `fromJSON`）

**依赖**: 无（最底层）

**预计工期**: 2天

**验证标准**:
- 单元测试：节点增删、边增删、索引一致性
- 序列化后反序列化数据一致

**交付文件**:
```
packages/codegraph/src/
├─ types.ts           # NodeType, EdgeType, GraphNode, GraphEdge
├─ graph.ts           # CodeGraph 类实现
└─ index.ts           # 导出
```

---

#### Change 2: 文件系统扫描 [CORE]

**名称**: `cg-file-system-scanner`

**目标**: 扫描项目目录，生成 DIRECTORY/FILE 节点和 CONTAINS 边

**范围**:
- 递归扫描项目目录
- 忽略规则（`.git/`, `node_modules/`, `dist/` 等）
- 创建 DIRECTORY、FILE 节点
- 生成 CONTAINS 边（目录→文件/子目录）
- 收集待解析文件列表（按扩展名）

**依赖**: Change 1（图结构）

**预计工期**: 1天

**验证标准**:
- 扫描测试 fixture 仓库，节点数量正确
- CONTAINS 边覆盖所有文件
- 忽略规则生效

**交付文件**:
```
packages/codegraph/src/
├─ scanner.ts         # 文件系统扫描逻辑
└─ ignore-rules.ts    # 默认忽略规则
```

---

#### Change 3: TS/JS 解析器 - 导入提取 [PARSER]

**名称**: `cg-ts-parser-imports`

**目标**: 基于 TypeScript Compiler API 提取文件间导入关系

**范围**:
- 创建 TypeScript Program
- 解析 `importDeclarations`, `exportDeclarations`
- 生成 IMPORTS、RE_EXPORTS、DYNAMIC_IMPORTS 边
- 模块路径解析（相对路径、别名路径）
- 创建 EXTERNAL 节点（外部依赖）

**依赖**: Change 1, Change 2

**预计工期**: 2天

**验证标准**:
- 测试 fixture 仓库的导入关系正确提取
- 别名路径（`tsconfig.json paths`）正确解析
- 外部依赖正确标记

**交付文件**:
```
packages/codegraph/src/
├─ parser/
│   ├─ ts-parser.ts   # TypeScript解析器主逻辑
│   ├─ import-resolver.ts  # 模块路径解析
│   └─ index.ts       # 解析器导出
```

---

#### Change 4: TS/JS 解析器 - 模块节点生成 [PARSER]

**名称**: `cg-ts-parser-modules`

**目标**: 提取导出符号，生成 MODULE 节点

**范围**:
- 遍历顶级声明（Function, Class, Variable, Interface, Type）
- 创建 MODULE 节点（仅导出的符号）
- 提取 JSDoc（前200字符）
- 计算圈复杂度
- 计算有效代码行数（LOC）
- 确定 `kind`（function/class/component/type/variable）

**依赖**: Change 1, Change 3

**预计工期**: 2天

**验证标准**:
- 导出函数/类正确创建 MODULE 节点
- 未导出的符号不创建节点
- JSDoc 截断正确
- 复杂度计算合理

**交付文件**:
```
packages/codegraph/src/parser/
├─ module-extractor.ts  # MODULE节点提取
├─ complexity.ts        # 圈复杂度计算
└─ loc-counter.ts       # LOC计算
```

---

#### Change 5: 全量分析流程 [CORE]

**名称**: `cg-full-analysis-flow`

**目标**: 组合扫描器和解析器，实现完整的仓库分析流程

**范围**:
- `analyzeFull(cwd: string)` 函数实现
- 组合调用：扫描 → 解析 → 合并入图
- 处理多文件解析的并发/顺序策略
- 生成 `DeltaSummary`（全量时为完整摘要）
- 错误处理（解析失败的文件）

**依赖**: Change 1, 2, 3, 4

**预计工期**: 1天

**验证标准**:
- 对真实开源项目（小型）执行全量分析
- 分析结果完整且正确
- 错误文件不中断整体流程

**交付文件**:
```
packages/codegraph/src/
├─ analyzer.ts        # 全量分析入口
└─ delta-summary.ts   # DeltaSummary类型和生成逻辑
```

---

#### Change 6: 基线持久化 [CORE]

**名称**: `cg-baseline-persistence`

**目标**: 将分析结果持久化到 `.codegraph/` 目录

**范围**:
- 定义 `.codegraph/` 目录结构
- `baseline.json` 序列化
- `lastCommit.txt` 记录
- 加载已有基线（`loadBaseline`）
- 基线版本兼容性检查

**依赖**: Change 1, 5

**预计工期**: 1天

**验证标准**:
- 分析后基线正确写入
- 加载基线后图数据一致
- `.codegraph/` 目录结构符合规范

**交付文件**:
```
packages/codegraph/src/
├─ persistence/
│   ├─ baseline.ts    # 基线读写
│   ├─ paths.ts       # 路径定义
│   └─ index.ts
```

---

#### Change 7: 基础情报 API - Scope系列 [API]

**名称**: `cg-api-scope`

**目标**: 实现 `getScope`, `getQuickBrief` API

**范围**:
- `getScope(target: string)` 实现
  - 导出列表、导入列表、被导入列表
  - 调用者/被调用者（MVP阶段可能无CALLS边，标注为TODO）
  - 测试文件、复杂度、最近修改
- `getQuickBrief(filePath: string)` 实现
  - 精简版：导入数、被导入数、是否有测试、是否deprecated

**依赖**: Change 1, 6（需要加载图）

**预计工期**: 1天

**验证标准**:
- 对 fixture 文件调用返回正确信息
- 输出格式符合文档定义（压缩文本）
- Token估算合理

**交付文件**:
```
packages/codegraph/src/
├─ api/
│   ├─ scope.ts       # getScope, getQuickBrief
│   └─ index.ts
```

---

#### Change 8: 基础情报 API - Impact & Layers [API]

**名称**: `cg-api-impact-layers`

**目标**: 实现 `getImpact`, `getArchitectureLayers` API

**范围**:
- `getImpact(targets: string[])` 实现
  - BFS/DFS 查找依赖者
  - 返回影响范围文本
- `getArchitectureLayers()` 实现
  - 按一级子目录分组
  - 统计组间导入方向
  - 推断层级
  - 返回分层描述文本

**依赖**: Change 1, 7

**预计工期**: 1天

**验证标准**:
- 影响范围查询正确（fixture验证）
- 分层推断合理（简单项目）
- 输出格式符合文档

**交付文件**:
```
packages/codegraph/src/api/
├─ impact.ts         # getImpact
├─ layers.ts         # getArchitectureLayers
```

---

#### Change 9: CLI 命令 - 分析与更新 [CLI]

**名称**: `cg-cli-analyze-update`

**目标**: 实现 `analyze`, `update` CLI 命令

**范围**:
- 使用 `cac` 库构建 CLI 框架
- `codegraph analyze` 命令
  - 执行全量分析
  - 写入基线
  - 输出摘要
- `codegraph update` 命令（MVP简化版）
  - 读取 lastCommit
  - 获取变更文件（`isomorphic-git`）
  - 简化增量：删除旧节点+重新解析变更文件
  - 更新基线

**依赖**: Change 5, 6

**预计工期**: 1天

**验证标准**:
- CLI 可执行
- `analyze` 生成 `.codegraph/` 目录
- `update` 正确处理 git 变更（简化逻辑）

**交付文件**:
```
packages/codegraph/
├─ bin/
│   └─ codegraph.ts   # CLI入口
├─ src/cli/
│   ├─ commands/
│   │   ├─ analyze.ts
│   │   └─ update.ts
│   └─ index.ts
```

---

#### Change 10: CLI 命令 - 查询命令 [CLI]

**名称**: `cg-cli-query-commands`

**目标**: 实现 `scope`, `impact`, `layers` CLI 命令

**范围**:
- `codegraph scope <target>` 命令
- `codegraph impact <files...>` 命令
- `codegraph layers` 命令
- 加载基线后调用对应 API
- 格式化输出到终端

**依赖**: Change 7, 8, 9

**预计工期**: 1天

**验证标准**:
- 各命令正确执行
- 输出可读性强
- 错误处理（无基线、节点不存在）

**交付文件**:
```
packages/codegraph/src/cli/commands/
├─ scope.ts
├─ impact.ts
├─ layers.ts
```

---

#### Change 11: 测试覆盖 [TEST]

**名称**: `cg-mvp-test-coverage`

**目标**: 补充单元测试和集成测试，达到 80% 覆盖率

**范围**:
- 图结构单元测试补充
- 解析器测试（多种导入场景）
- API 测试（使用 fixture 图）
- 集成测试：全量分析 fixture 仓库
- 测试覆盖率报告

**依赖**: Change 1-10

**预计工期**: 2天

**验证标准**:
- 测试覆盖率 ≥ 80%
- 所有测试通过
- 集成测试覆盖核心流程

**交付文件**:
```
packages/codegraph/
├─ tests/
│   ├─ unit/
│   │   ├─ graph.test.ts
│   │   ├─ scanner.test.ts
│   │   ├─ parser.test.ts
│   │   ├─ api.test.ts
│   ├─ integration/
│   │   ├─ full-analysis.test.ts
│   ├─ fixtures/
│   │   ├─ sample-project/   # 测试用fixture仓库
```

---

#### Change 12: API 文档与示例 [DOC]

**名称**: `cg-mvp-documentation`

**目标**: 补充 API 使用文档和示例

**范围**:
- README.md 编写
- API 使用示例（代码片段）
- CLI 使用指南
- 架构简图（可选）

**依赖**: Change 1-10

**预计工期**: 1天

**验证标准**:
- 文档完整覆盖 MVP 功能
- 示例可执行
- 新用户可通过文档快速上手

**交付文件**:
```
packages/codegraph/
├─ README.md
├─ docs/
│   ├─ api-examples.md
│   ├─ cli-guide.md
```

---

### 3.3 MVP Change 汇总表

| Change | 名称 | 类型 | 工期 | 依赖 | 验证关键 |
|--------|------|------|------|------|---------|
| C1 | `cg-core-graph-structure` | [CORE] | 2天 | 无 | 图操作正确、索引一致 |
| C2 | `cg-file-system-scanner` | [CORE] | 1天 | C1 | 扫描完整、忽略生效 |
| C3 | `cg-ts-parser-imports` | [PARSER] | 2天 | C1,C2 | 导入关系正确、路径解析正确 |
| C4 | `cg-ts-parser-modules` | [PARSER] | 2天 | C1,C3 | MODULE节点正确、复杂度合理 |
| C5 | `cg-full-analysis-flow` | [CORE] | 1天 | C1-4 | 全量分析完整 |
| C6 | `cg-baseline-persistence` | [CORE] | 1天 | C1,C5 | 持久化正确、加载一致 |
| C7 | `cg-api-scope` | [API] | 1天 | C1,C6 | Scope输出正确 |
| C8 | `cg-api-impact-layers` | [API] | 1天 | C1,C7 | 影响范围正确、分层合理 |
| C9 | `cg-cli-analyze-update` | [CLI] | 1天 | C5,C6 | CLI可执行 |
| C10 | `cg-cli-query-commands` | [CLI] | 1天 | C7,C8,C9 | 查询命令正确 |
| C11 | `cg-mvp-test-coverage` | [TEST] | 2天 | C1-10 | 覆盖率≥80% |
| C12 | `cg-mvp-documentation` | [DOC] | 1天 | C1-10 | 文档完整 |

**MVP 总工期**: 15天（含测试和文档），略超原 blueprint 的 10天估算，因增加了文档和更完整的测试覆盖。

---

## 4. 后续 Milestone 拆分规划

### 4.1 Milestone 2: 调用图与增量增强

| Change | 名称 | 类型 | 工期 | 依赖 |
|--------|------|------|------|------|
| C13 | `cg-parser-calls-extends` | [PARSER] | 2天 | C4 |
| C14 | `cg-cascade-update-engine` | [CORE] | 2天 | C6,C9 |
| C15 | `cg-api-changes-since` | [API] | 1天 | C6 |
| C16 | `cg-history-ldjson` | [CORE] | 1天 | C6 |
| C17 | `cg-m2-integration-test` | [TEST] | 1天 | C13-16 |

**M2 工期**: 7天

### 4.2 Milestone 3: 智能分析与约束引擎

| Change | 名称 | 类型 | 工期 | 依赖 |
|--------|------|------|------|------|
| C18 | `cg-cycle-detection` | [CORE] | 1天 | C1 |
| C19 | `cg-layer-inference` | [CORE] | 2天 | C8 |
| C20 | `cg-constraint-extraction` | [CORE] | 1天 | C19 |
| C21 | `cg-api-arch-constraints` | [API] | 1天 | C18,C20 |
| C22 | `cg-maturity-scoring` | [CORE] | 2天 | C18,C21 |
| C23 | `cg-api-maturity-score` | [API] | 1天 | C22 |
| C24 | `cg-test-file-association` | [CORE] | 1天 | C2 |
| C25 | `cg-cli-health-constraints` | [CLI] | 1天 | C21,C23 |
| C26 | `cg-html-report-v1` | [CLI] | 1天 | C21,C23 |

**M3 工期**: 10天

### 4.3 Milestone 4-7 概览

| Milestone | Change数量 | 预计工期 | 关键交付 |
|-----------|-----------|---------|---------|
| M4: 编排集成 | 6个 | 6天 | buildContextFor、任务辅助API |
| M5: 会话监控 | 5个 | 6天 | session管理、explore CLI |
| M6: 多语言 | 5个 | 8天 | ParserAdapter、Python解析器 |
| M7: MCP集成 | 4个 | 5天 | MCP Server、v1.0.0发布 |

**后续详细拆分**: 在 MVP 完成后，根据实际进度和反馈，细化 M2-M7 的 change 定义。

---

## 5. Change 依赖关系图

```
┌─────────────────────────────────────────────────────────────┐
│                    MVP Change 依赖图                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    C1 [CORE]                                │
│                    图数据结构                                │
│                        │                                    │
│           ┌────────────┼────────────┐                      │
│           │            │            │                      │
│           ▼            ▼            ▼                      │
│        C2 [CORE]    C3 [PARSER]   C7 [API]                 │
│        文件扫描      导入提取      Scope API                │
│           │            │            │                      │
│           │            ▼            │                      │
│           │        C4 [PARSER]      │                      │
│           │        MODULE节点        │                      │
│           │            │            │                      │
│           ▼            ▼            ▼                      │
│        C5 [CORE]────────────────────────                   │
│        全量分析流程                                          │
│           │                                                │
│           ▼                                                │
│        C6 [CORE]                                           │
│        基线持久化                                           │
│           │                                                │
│     ┌─────┴─────┐                                          │
│     │           │                                          │
│     ▼           ▼                                          │
│  C8 [API]    C9 [CLI]                                      │
│  Impact/Layers  analyze/update                             │
│     │           │                                          │
│     └─────┬─────┘                                          │
│           │                                                │
│           ▼                                                │
│        C10 [CLI]                                           │
│        查询命令                                             │
│           │                                                │
│     ┌─────┴─────┐                                          │
│     │           │                                          │
│     ▼           ▼                                          │
│  C11 [TEST]  C12 [DOC]                                     │
│  测试覆盖     文档                                          │
│                                                             │
│  执行顺序建议：                                              │
│  C1 → C2 → C3 → C4 → C5 → C6 → C7 → C8 → C9 → C10 → C11/C12│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. 开发执行建议

### 6.1 执行流程

```
┌─────────────────────────────────────────────────────────────┐
│                    Change 执行流程                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 创建 Change                                             │
│     └─ `/opsx:new cg-<change-name>`                         │
│     └─ 自动生成 proposal/design/tasks                        │
│                                                             │
│  2. 实现开发                                                │
│     └─ 按 tasks.md 任务列表执行                              │
│     └─ `/opsx:apply` 开始实现                                │
│                                                             │
│  3. 验证完成                                                │
│     └─ `/opsx:verify` 验证实现                               │
│     └─ 检查测试通过、功能正确                                │
│                                                             │
│  4. 归档 Change                                             │
│     └─ `/opsx:archive` 归档                                 │
│     └─ 记录完成状态                                          │
│                                                             │
│  5. 推进下一个 Change                                       │
│     └─ 按依赖顺序推进                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 建议的执行顺序

**Phase A: 核心基础设施**（并行度低）
```
C1 (图结构) → C2 (文件扫描) → C3 (导入提取) → C4 (MODULE节点)
```
这些是核心依赖，必须串行完成。

**Phase B: 分析流程**（并行度低）
```
C5 (全量分析) → C6 (持久化)
```
组合前序能力，形成完整分析链路。

**Phase C: API层**（可适度并行）
```
C7 (Scope) 和 C8 (Impact/Layers) 可部分并行
依赖C6完成后可同时开发
```

**Phase D: CLI层**（可适度并行）
```
C9 (analyze/update) 和 C10 (查询命令) 
C9完成后C10可并行开发
```

**Phase E: 测试与文档**（可并行）
```
C11 (测试) 和 C12 (文档) 可并行完成
```

### 6.3 首次 Change 创建建议

建议从 **C1: cg-core-graph-structure** 开始：

```bash
/opsx:new cg-core-graph-structure
```

这是最底层的基础设施，无依赖，完成后即可验证图操作的正确性。

---

## 附录 A: 项目目录结构预览

```
packages/codegraph/
├─ package.json
├─ tsconfig.json
├─ README.md
├─ bin/
│   └─ codegraph.ts           # CLI 入口
├─ src/
│   ├─ types.ts               # 核心类型定义
│   ├─ graph.ts               # CodeGraph 类
│   ├─ scanner.ts             # 文件扫描
│   ├─ analyzer.ts            # 全量分析入口
│   ├─ delta-summary.ts       # DeltaSummary
│   ├─ parser/
│   │   ├─ ts-parser.ts       # TS解析器
│   │   ├─ import-resolver.ts
│   │   ├─ module-extractor.ts
│   │   ├─ complexity.ts
│   │   └─ loc-counter.ts
│   ├─ persistence/
│   │   ├─ baseline.ts        # 基线读写
│   │   └─ paths.ts           # 路径定义
│   ├─ api/
│   │   ├─ scope.ts           # getScope, getQuickBrief
│   │   ├─ impact.ts          # getImpact
│   │   ├─ layers.ts          # getArchitectureLayers
│   │   └─ index.ts
│   ├─ cli/
│   │   ├─ commands/
│   │   │   ├─ analyze.ts
│   │   │   ├─ update.ts
│   │   │   ├─ scope.ts
│   │   │   ├─ impact.ts
│   │   │   ├─ layers.ts
│   │   └─ index.ts
│   └─ index.ts               # 包主入口
├─ tests/
│   ├─ unit/
│   ├─ integration/
│   └ fixtures/
└─ docs/
    ├─ api-examples.md
    └─ cli-guide.md
```

---

**文档版本**: v1.0
**创建日期**: 2026-05-03
**关联文档**: 
- [01_origin_blueprint.md](./01_origin_blueprint.md)
- [02_scene_adaptation_engine.md](./02_scene_adaptation_engine.md)
**用途**: 创建 OpenSpec change 的依据