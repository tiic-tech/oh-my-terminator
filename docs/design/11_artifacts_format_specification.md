# OMT Artifacts格式规范

**设计日期**: 2026-05-01
**设计目标**: 定义TSpec/MSpec/Sprint各层级artifacts的格式标准
**参考来源**: OpenSpec artifacts设计（参考ADDED/MODIFIED/DELETED/RENAMED状态标签）

---

## 1. 文档头部

所有OMT artifacts遵循统一的文档头部格式：

```markdown
---
id: <artifact-id>
createdAt: <ISO-8601日期>
updatedAt: <ISO-8601日期>
status: <状态>
delta: <delta标签列表>
---

# <artifact标题>

**设计日期**: <日期>
**所属层级**: <TSpec | MSpec | Sprint>
**依赖关系**: <列出上游依赖>
```

### 1.1 状态枚举

```typescript
enum ArtifactStatus {
  DRAFT = 'DRAFT',           // 草稿，未完成
  PENDING = 'PENDING',       // 待审核
  APPROVED = 'APPROVED',     // 已批准
  DEPRECATED = 'DEPRECATED', // 已废弃
  ARCHIVED = 'ARCHIVED',     // 已归档
}
```

### 1.2 Delta标签定义

```typescript
enum DeltaLabel {
  ADDED = 'ADDED',       // 新增artifact
  MODIFIED = 'MODIFIED', // 已修改内容
  DELETED = 'DELETED',   // 已删除（标记删除）
  RENAMED = 'RENAMED',   // 已重命名
}
```

---

## 2. 文件夹层级结构

```
.omt/
├── tspecs/
│   └── tspec_<id>/                    # TSpec目录
│       ├── .tspec-meta.yaml           # 元数据文件
│       ├── proposal.md                # Why文档
│       ├── design.md                  # How文档
│       ├── tspec.md                   # 整合规格文档
│       ├── mspecs.yaml                # MSpec清单（验收清单）
│       └── mspecs/                    # MSpec子目录
│           └── mspec_<id>/
│               ├── .mspec-meta.yaml   # MSpec元数据
│               ├── proposal.md        # Milestone目标
│               ├── design.md          # 技术设计
│               ├── mspec.md           # MSpec完整规格
│               ├── wbs.yaml           # WBS任务清单
│               └── sprints/           # Sprint子目录
│                   └── sprint_<num>/
│                       ├── .sprint-meta.yaml  # Sprint元数据
│                       ├── sspec.md           # Sprint设计说明
│                       └── tasks.yaml         # Sprint任务清单
│
├── archive/                           # 归档目录
│   └── tspec_<id>_<archived-date>/    # 带时间戳归档
│       └── ...                        # 完整副本
│
└── .omt-state.yaml                    # 全局状态文件
```

### 2.1 元数据文件格式

每个层级都有独立的元数据文件：

```yaml
# .tspec-meta.yaml
id: tspec_001
name: "User Authentication System"
createdAt: "2026-05-01T10:00:00Z"
updatedAt: "2026-05-02T15:30:00Z"
status: APPROVED
delta: [ADDED, MODIFIED]
owner: "architect"
version: 2
schemaVersion: "1.0"
```

---

## 3. TSpec层级Artifacts

### 3.1 proposal.md格式

**用途**: 定义Why - 问题和动机

```markdown
---
id: tspec_<id>_proposal
createdAt: "2026-05-01T10:00:00Z"
updatedAt: "2026-05-01T10:00:00Z"
status: DRAFT
delta: [ADDED]
---

# TSpec Proposal

**所属TSpec**: tspec_<id>
**作者**: <author>
**日期**: <date>

## Why

<!-- 问题陈述 - 为什么要做这个变更 -->

<描述当前问题或业务需求>

**问题背景**:
- 当前状态: <描述现状>
- 痛点分析: <列出具体痛点>
- 业务影响: <量化业务损失或机会>

## What Changes

<!-- 变化描述 - 具体要改变什么 -->

**变更范围**:
- 新增功能: <列出新增能力>
- 修改行为: <列出行为变更>
- 删除功能: <列出废弃功能>

**变更类型**: FEATURE | FIX | REFACTOR | CHORE

## Capabilities

<!-- 能力清单 - 契约定义 -->

### Capability 1: <capability-name>

**描述**: <能力描述>

**验收标准**:
- [ ] 标准1: <可测试的验收条件>
- [ ] 标准2: <可测试的验收条件>

**API契约** (if applicable):
```
<API签名或接口定义>
```

### Capability 2: <capability-name>

...

## Impact

<!-- 影响范围分析 -->

**技术影响**:
- 受影响模块: <列出模块>
- 数据库变更: <DDL概述>
- API变更: <版本策略>

**业务影响**:
- 用户影响: <用户群体>
- 流程变更: <业务流程>

**风险评估**:
| 风险项 | 风险等级 | 缓解策略 |
|--------|---------|---------|
| <风险1> | HIGH | <策略> |
| <风险2> | MEDIUM | <策略> |

## Related Documents

**依赖文档**: 无（根节点）

**下游文档**:
- design.md
- tspec.md
- mspecs.yaml
```

### 3.2 design.md格式

**用途**: 定义How - 技术设计方案

```markdown
---
id: tspec_<id>_design
createdAt: "2026-05-01T11:00:00Z"
updatedAt: "2026-05-01T11:00:00Z"
status: DRAFT
delta: [ADDED]
---

# TSpec Design

**所属TSpec**: tspec_<id>
**上游依赖**: proposal.md
**作者**: <author>

## Context

<!-- 背景和当前状态 -->

**系统现状**:
- 技术栈: <当前技术栈>
- 架构现状: <描述当前架构>
- 相关代码: <列出相关代码路径>

**约束条件**:
- 技术约束: <硬性约束>
- 时间约束: <时间限制>
- 资源约束: <资源限制>

## Goals

<!-- 设计目标 -->

**核心目标**:
1. <目标1>
2. <目标2>

**成功指标**:
- 指标1: <可量化指标>
- 指标2: <可量化指标>

## Non-Goals

<!-- 明确排除的范围 -->

**不做的事项**:
1. <排除项1> - 原因: <为什么排除>
2. <排除项2> - 原因: <为什么排除>

## Decisions

<!-- 关键设计决策 -->

### Decision 1: <decision-title>

**背景**: <决策背景>

**选项分析**:
| 选项 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| Option A | ... | ... | |
| Option B | ... | ... | ✓ |

**最终决策**: <选择方案>

**决策理由**: <为什么选择这个方案>

### Decision 2: <decision-title>

...

## Technical Design

<!-- 技术设计方案 -->

### Architecture Overview

```
<ASCII架构图或组件图>
```

### Component Design

**Component 1**: <component-name>
- 职责: <职责描述>
- 接口: <接口定义>
- 依赖: <依赖组件>

### Data Model

```
<数据模型定义或ER图>
```

### API Design

**Endpoint**: <endpoint-path>
- 方法: <HTTP方法>
- 请求: <请求格式>
- 响应: <响应格式>
- 错误: <错误码>

## Risks & Trade-offs

### Risks

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| <风险1> | High | High | <措施> |

### Trade-offs

| 权衡点 | 代价 | 收益 |
|--------|------|------|
| <权衡1> | <代价> | <收益> |

## Implementation Notes

<!-- 实现注意事项 -->

- 注意点1: <描述>
- 注意点2: <描述>

## Related Documents

**上游依赖**: proposal.md

**下游文档**:
- tspec.md
- mspecs.yaml (通过proposal)
```

### 3.3 tspec.md格式

**用途**: 整合proposal + design的完整规格文档

```markdown
---
id: tspec_<id>
createdAt: "2026-05-01T12:00:00Z"
updatedAt: "2026-05-01T12:00:00Z"
status: DRAFT
delta: [ADDED]
---

# TSpec: <TSpec名称>

**TSpec ID**: tspec_<id>
**创建日期**: <date>
**状态**: <status>

---

## Part A: Problem & Motivation (from proposal.md)

<!-- 自动聚合proposal.md内容 -->

### Why

<复制proposal.md的Why部分>

### What Changes

<复制proposal.md的What Changes部分>

### Capabilities

<复制proposal.md的Capabilities部分>

---

## Part B: Technical Design (from design.md)

<!-- 自动聚合design.md内容 -->

### Context

<复制design.md的Context部分>

### Goals & Non-Goals

<复制design.md的Goals和Non-Goals部分>

### Decisions

<复制design.md的Decisions部分>

### Technical Design

<复制design.md的Technical Design部分>

---

## Part C: Milestones Breakdown

<!-- MSpec分解预览 -->

**MSpec清单**: 见 mspecs.yaml

| MSpec ID | 名称 | 状态 | Sprint数 |
|----------|------|------|---------|
| mspec_001 | <名称> | PENDING | ~N |
| mspec_002 | <名称> | PENDING | ~M |

---

## Approval

**审核记录**:

| 审核人 | 角色 | 日期 | 结论 | 备注 |
|--------|------|------|------|------|
| <审核人> | Architect | <date> | APPROVED | <备注> |

---

## Change History

| 日期 | 变更类型 | 变更内容 | 作者 |
|------|---------|---------|------|
| <date> | MODIFIED | <变更描述> | <author> |
```

### 3.4 mspecs.yaml格式

**用途**: MSpec清单（验收清单）- TSpec的子Milestone定义

```yaml
# mspecs.yaml - TSpec的MSpec验收清单
# 格式版本: 1.0

tspecId: tspec_001

mspecs:
  - id: mspec_001
    name: "Core Authentication Module"
    description: "实现核心认证功能：登录、注册、密码管理"
    capabilities:
      - "capability_001_user_login"
      - "capability_002_user_registration"
    status: PENDING
    estimatedSprints: 3
    priority: HIGH
    dependencies: []            # 无依赖（第一个MSpec）
    
  - id: mspec_002
    name: "Session Management"
    description: "实现会话管理：Token生成、刷新、失效"
    capabilities:
      - "capability_003_session_token"
      - "capability_004_token_refresh"
    status: PENDING
    estimatedSprints: 2
    priority: HIGH
    dependencies:
      - mspec_001              # 依赖mspec_001
    
  - id: mspec_003
    name: "OAuth Integration"
    description: "集成第三方OAuth：Google、GitHub"
    capabilities:
      - "capability_005_oauth_google"
      - "capability_006_oauth_github"
    status: PENDING
    estimatedSprints: 2
    priority: MEDIUM
    dependencies:
      - mspec_001              # 依赖mspec_001

验收标准:
  - all_mspecs_completed: "所有MSpec状态为COMPLETED"
  - capabilities_verified: "所有capability验收测试通过"
  - e2e_flow_passed: "端到端用户流程测试通过"

delta:
  - ADDED                     # 整体为新增
```

---

## 4. MSpec层级Artifacts

### 4.1 proposal.md格式

**用途**: Milestone目标定义

```markdown
---
id: mspec_<id>_proposal
createdAt: "2026-05-01T14:00:00Z"
updatedAt: "2026-05-01T14:00:00Z"
status: DRAFT
delta: [ADDED]
---

# MSpec Proposal

**所属MSpec**: mspec_<id>
**上游依赖**: @tspec_<id>/proposal.md
**作者**: <author>

## Milestone Goal

<!-- Milestone的核心目标 -->

**目标陈述**: <一句话描述本Milestone要达成什么>

**成功定义**:
- 当<条件>达成时，本Milestone完成

## Scope Constraints

<!-- 范围约束 - 明确边界 -->

**包含范围**:
- <功能1>: <描述>
- <功能2>: <描述>

**排除范围**:
- <功能X>: 原因 - <为什么排除>

**边界定义**:
- 输入边界: <入口条件>
- 输出边界: <产出定义>

## Capability Mapping

<!-- 从TSpec继承的Capabilities -->

| Capability ID | 来源TSpec | 本MSpec职责 |
|---------------|-----------|-------------|
| capability_001 | tspec_001 | 完整实现 |
| capability_002 | tspec_001 | 基础实现 |

## Acceptance Criteria

<!-- MSpec验收标准 -->

- [ ] 所有相关Capability验收通过
- [ ] 单元测试覆盖率 >= 80%
- [ ] 集成测试通过
- [ ] 文档更新完成

## Related Documents

**上游依赖**: 
- @tspec_<id>/proposal.md
- @tspec_<id>/design.md

**下游文档**:
- design.md
- mspec.md
- wbs.yaml
```

### 4.2 design.md格式

**用途**: Milestone技术设计

```markdown
---
id: mspec_<id>_design
createdAt: "2026-05-01T15:00:00Z"
updatedAt: "2026-05-01T15:00:00Z"
status: DRAFT
delta: [ADDED]
---

# MSpec Design

**所属MSpec**: mspec_<id>
**上游依赖**: 
- @tspec_<id>/design.md
- proposal.md
**作者**: <author>

## Technical Design

<!-- 本Milestone的技术实现方案 -->

### Module Design

**模块划分**:
```
<模块结构图>
```

**模块职责表**:
| 模块 | 职责 | 接口 | 依赖 |
|------|------|------|------|
| module_1 | <职责> | <接口> | <依赖> |

### Implementation Strategy

<!-- 实现策略 -->

**实现顺序**:
1. <阶段1>: <描述>
2. <阶段2>: <描述>

**关键技术点**:
- 技术点1: <描述及处理方案>
- 技术点2: <描述及处理方案>

## WBS Decomposition Strategy

<!-- WBS分解策略 -->

**分解原则**:
- 原子性: 每个AtomTask <= 4小时
- 可测试性: 每个AtomTask有明确的验收条件
- 独立性: 尽量减少AtomTask间依赖

**预估规模**:
- AtomTask数量: ~N (30-50)
- 总估算工时: ~X小时

**复杂度评估**:
| 任务类型 | 复杂度分布 | 预估数量 |
|----------|-----------|---------|
| 简单(1-3) | 30% | ~10 |
| 中等(4-6) | 50% | ~25 |
| 复杂(7-10) | 20% | ~10 |

## Sprint Planning Preview

<!-- Sprint预览 -->

**Sprint数量预估**: ~N个Sprint

**Sprint任务分配策略**:
- 每个Sprint: 10个AtomTask
- 并行度: >= 3（确保至少3个任务可并行）

## Related Documents

**上游依赖**:
- @tspec_<id>/design.md
- proposal.md

**下游文档**:
- mspec.md
- wbs.yaml
```

### 4.3 mspec.md格式

**用途**: MSpec完整规格文档

```markdown
---
id: mspec_<id>
createdAt: "2026-05-01T16:00:00Z"
updatedAt: "2026-05-01T16:00:00Z"
status: DRAFT
delta: [ADDED]
---

# MSpec: <MSpec名称>

**MSpec ID**: mspec_<id>
**所属TSpec**: tspec_<id>
**创建日期**: <date>
**状态**: <status>

---

## Part A: Goal & Scope (from proposal.md)

<!-- 自动聚合proposal.md内容 -->

### Milestone Goal

<复制proposal.md的Milestone Goal部分>

### Scope Constraints

<复制proposal.md的Scope Constraints部分>

---

## Part B: Technical Design (from design.md)

<!-- 自动聚合design.md内容 -->

### Module Design

<复制design.md的Module Design部分>

### Implementation Strategy

<复制design.md的Implementation Strategy部分>

---

## Part C: WBS Summary

<!-- WBS概览 -->

**WBS文件**: wbs.yaml

**任务统计**:
- 总任务数: N
- 已完成: M
- 进行中: K
- 待开始: L

**关键路径**: <列出关键路径任务>

---

## Part D: Sprint Execution

<!-- Sprint执行状态 -->

**当前Sprint**: sprint_<num>

**Sprint历史**:
| Sprint | 状态 | 完成任务数 | 开始日期 | 结束日期 |
|--------|------|-----------|---------|---------|
| sprint_001 | COMPLETED | 10 | <date> | <date> |
| sprint_002 | IN_PROGRESS | 3 | <date> | - |

---

## Approval

**审核记录**:

| 审核人 | 角色 | 日期 | 结论 |
|--------|------|------|------|
| <审核人> | Tech Lead | <date> | APPROVED |

---

## Change History

| 日期 | 变更类型 | 变更内容 |
|------|---------|---------|
| <date> | MODIFIED | <变更描述> |
```

### 4.4 wbs.yaml格式

**用途**: AtomTask清单（验收清单）- MSpec的任务分解

```yaml
# wbs.yaml - MSpec的WBS任务清单
# 格式版本: 1.0

mspecId: mspec_001
createdAt: "2026-05-01T17:00:00Z"
updatedAt: "2026-05-02T10:00:00Z"
status: DRAFT
delta: [ADDED]

# === AtomTask清单 ===
atomTasks:
  # --- 认证核心模块 ---
  - id: auth-001
    description: "设计User实体数据模型"
    complexity: 3
    estimatedHours: 2
    assigneeRole: "backend-developer"
    blockedBy: []
    riskLevel: LOW
    status: COMPLETED
    sprintHistory:
      - sprintId: sprint_001
        status: COMPLETED
    capabilityMapping: "capability_001_user_login"
    
  - id: auth-002
    description: "实现User实体Repository"
    complexity: 4
    estimatedHours: 3
    assigneeRole: "backend-developer"
    blockedBy: ["auth-001"]
    riskLevel: LOW
    status: COMPLETED
    sprintHistory:
      - sprintId: sprint_001
        status: COMPLETED
    capabilityMapping: "capability_001_user_login"
    
  - id: auth-003
    description: "实现密码加密/解密服务"
    complexity: 5
    estimatedHours: 4
    assigneeRole: "backend-developer"
    blockedBy: []
    riskLevel: MEDIUM
    status: COMPLETED
    sprintHistory:
      - sprintId: sprint_001
        status: COMPLETED
    capabilityMapping: "capability_001_user_login"
    
  - id: auth-004
    description: "实现登录API端点"
    complexity: 4
    estimatedHours: 3
    assigneeRole: "backend-developer"
    blockedBy: ["auth-002", "auth-003"]
    riskLevel: LOW
    status: IN_PROGRESS
    sprintHistory:
      - sprintId: sprint_002
        status: IN_PROGRESS
    capabilityMapping: "capability_001_user_login"
    
  - id: auth-005
    description: "实现登录表单UI组件"
    complexity: 3
    estimatedHours: 2
    assigneeRole: "frontend-developer"
    blockedBy: []
    riskLevel: LOW
    status: COMPLETED
    sprintHistory:
      - sprintId: sprint_001
        status: COMPLETED
    capabilityMapping: "capability_001_user_login"
    
  - id: auth-006
    description: "集成登录表单与API"
    complexity: 4
    estimatedHours: 3
    assigneeRole: "frontend-developer"
    blockedBy: ["auth-004", "auth-005"]
    riskLevel: LOW
    status: PENDING
    capabilityMapping: "capability_001_user_login"
    
  # --- 注册模块 ---
  - id: auth-007
    description: "设计注册表单验证规则"
    complexity: 2
    estimatedHours: 1
    assigneeRole: "frontend-developer"
    blockedBy: []
    riskLevel: LOW
    status: COMPLETED
    sprintHistory:
      - sprintId: sprint_001
        status: COMPLETED
    capabilityMapping: "capability_002_user_registration"
    
  - id: auth-008
    description: "实现注册API端点"
    complexity: 5
    estimatedHours: 4
    assigneeRole: "backend-developer"
    blockedBy: ["auth-002", "auth-003"]
    riskLevel: MEDIUM
    status: PENDING
    capabilityMapping: "capability_002_user_registration"
    
  - id: auth-009
    description: "实现注册表单UI组件"
    complexity: 3
    estimatedHours: 2
    assigneeRole: "frontend-developer"
    blockedBy: ["auth-007"]
    riskLevel: LOW
    status: COMPLETED
    sprintHistory:
      - sprintId: sprint_001
        status: COMPLETED
    capabilityMapping: "capability_002_user_registration"
    
  - id: auth-010
    description: "集成注册表单与API"
    complexity: 4
    estimatedHours: 3
    assigneeRole: "frontend-developer"
    blockedBy: ["auth-008", "auth-009"]
    riskLevel: LOW
    status: PENDING
    capabilityMapping: "capability_002_user_registration"

# === 依赖关系图 ===
dependencyGraph:
  auth-001: []                    # 根节点
  auth-002: ["auth-001"]
  auth-003: []                    # 根节点（与auth-001并行）
  auth-004: ["auth-002", "auth-003"]
  auth-005: []                    # 根节点
  auth-006: ["auth-004", "auth-005"]
  auth-007: []                    # 根节点
  auth-008: ["auth-002", "auth-003"]
  auth-009: ["auth-007"]
  auth-010: ["auth-008", "auth-009"]

# === 关键路径分析 ===
criticalPaths:
  - path: ["auth-001", "auth-002", "auth-004", "auth-006"]
    totalHours: 10
    description: "登录功能主线"
  - path: ["auth-003", "auth-004", "auth-006"]
    totalHours: 9
    description: "密码服务依赖线"

# === 验收标准 ===
acceptanceCriteria:
  - all_tasks_completed: "所有atomTasks状态为COMPLETED"
  - capability_coverage: "每个capability至少有1个完成的AtomTask"
  - test_coverage: "相关代码测试覆盖率 >= 80%"
  - e2e_tests_passed: "端到端测试通过"

# === 统计信息 ===
statistics:
  totalTasks: 10
  completedTasks: 6
  inProgressTasks: 1
  pendingTasks: 3
  totalEstimatedHours: 27
  remainingHours: 9
  averageComplexity: 3.5
  parallelismScore: 3.2          # 平均可并行任务数
```

---

## 5. Sprint层级Artifacts

### 5.1 sspec.md格式

**用途**: Sprint设计说明 - 本Sprint的执行计划

```markdown
---
id: sprint_<num>_sspec
createdAt: "2026-05-02T09:00:00Z"
updatedAt: "2026-05-02T09:00:00Z"
status: DRAFT
delta: [ADDED]
---

# Sprint Spec: sprint_<num>

**所属MSpec**: mspec_<id>
**Sprint序号**: <num>
**开始日期**: <date>
**结束日期**: <date> (预估)

## Task Selection Strategy

<!-- 任务选择策略 -->

**选择原则**:
- 关键路径优先: 选择关键路径上的任务
- 依赖就绪优先: 选择依赖已完成的任务
- 并行度最大化: 确保足够的可并行任务

**本轮选择**:
| 任务ID | 选择理由 | 复杂度 | 角色 |
|--------|---------|--------|------|
| auth-004 | 关键路径+依赖就绪 | 4 | backend |
| auth-006 | 关键路径末端 | 4 | frontend |
| auth-008 | 高价值+依赖就绪 | 5 | backend |
| auth-010 | 注册功能末端 | 4 | frontend |

## Parallelism Configuration

<!-- 并行度配置 -->

**并行度目标**: >= 3

**并行分析**:
```
可并行任务分组:
- Group A (Backend): auth-004, auth-008 (无内部依赖)
- Group B (Frontend): auth-006, auth-010 (依赖Group A)
- Group C (并行): auth-005, auth-009 (已完成，但可验证)

最大并行度: 2 (Backend) + 0 (Frontend等待依赖) = 2
不足原因: Frontend任务依赖Backend任务
缓解策略: Backend先并行完成，再触发Frontend
```

**角色分配**:
| 角色 | 任务数 | 预估工时 |
|------|--------|---------|
| backend-developer | 2 | 7h |
| frontend-developer | 2 | 6h |

## Expected Outputs

<!-- 预期产出 -->

**代码产出**:
- 新增文件: <列出新增文件>
- 修改文件: <列出修改文件>

**文档产出**:
- 更新API文档
- 更新测试报告

**验收产出**:
- 单元测试: 新增N个测试
- 集成测试: 新增M个测试

## Risk Assessment

<!-- 风险评估 -->

| 风险 | 概率 | 缓解措施 |
|------|------|---------|
| 依赖阻塞 | MEDIUM | 预先检查依赖状态 |
| 技术难点 | LOW | 关键任务优先 |

## Execution Timeline

<!-- 执行时间线 -->

```
Day 1: auth-004 开始 (Backend)
       auth-008 开始 (Backend)
       
Day 2: auth-004 完成
       auth-006 开始 (Frontend) - 依赖auth-004
       
Day 3: auth-008 完成
       auth-010 开始 (Frontend) - 依赖auth-008
       
Day 4: auth-006 完成
       auth-010 完成
       Sprint验收
```

## Related Documents

**上游依赖**:
- @mspec_<id>/wbs.yaml

**下游文档**:
- tasks.yaml
```

### 5.2 tasks.yaml格式

**用途**: Sprint任务清单 - DAG执行顺序和状态追踪

```yaml
# tasks.yaml - Sprint任务清单
# 格式版本: 1.0

sprintId: sprint_002
mspecId: mspec_001
createdAt: "2026-05-02T09:00:00Z"
updatedAt: "2026-05-02T15:00:00Z"
status: IN_PROGRESS
delta: [ADDED]

# === Sprint任务清单 ===
sprintTasks:
  - taskId: auth-004
    selectedReason: "关键路径任务，依赖已就绪"
    expectedOutput: "POST /api/login 端点实现"
    status: IN_PROGRESS
    startedAt: "2026-05-02T09:00:00Z"
    completedAt: null
    blockingIssues: []
    
  - taskId: auth-006
    selectedReason: "登录功能前端集成"
    expectedOutput: "登录表单API集成"
    status: PENDING          # 等待auth-004完成
    startedAt: null
    completedAt: null
    blockedBy: ["auth-004"]
    
  - taskId: auth-008
    selectedReason: "注册API端点"
    expectedOutput: "POST /api/register 端点实现"
    status: IN_PROGRESS
    startedAt: "2026-05-02T09:00:00Z"
    completedAt: null
    blockingIssues: []
    
  - taskId: auth-010
    selectedReason: "注册功能前端集成"
    expectedOutput: "注册表单API集成"
    status: PENDING          # 等待auth-008完成
    startedAt: null
    completedAt: null
    blockedBy: ["auth-008"]

# === DAG执行顺序 ===
executionOrder:
  # Phase 1: Backend并行
  - phase: 1
    tasks: ["auth-004", "auth-008"]
    parallel: true
    roles: ["backend-developer"]
    status: IN_PROGRESS
    
  # Phase 2: Frontend (依赖Phase 1)
  - phase: 2
    tasks: ["auth-006"]
    parallel: false
    roles: ["frontend-developer"]
    dependsOn: ["auth-004"]
    status: BLOCKED
    
  - phase: 3
    tasks: ["auth-010"]
    parallel: false
    roles: ["frontend-developer"]
    dependsOn: ["auth-008"]
    status: BLOCKED
    
  # Phase 4: 验收
  - phase: 4
    tasks: ["sprint-validation"]
    parallel: false
    roles: ["qa"]
    dependsOn: ["auth-006", "auth-010"]
    status: PENDING

# === 状态追踪 ===
statusTracking:
  totalTasks: 4
  completedTasks: 0
  inProgressTasks: 2
  pendingTasks: 2
  blockedTasks: 2
  completionRate: 0
  
  estimatedRemainingHours: 13
  elapsedHours: 6

# === 每日更新记录 ===
dailyUpdates:
  - date: "2026-05-02"
    summary: "Sprint开始，Backend任务并行启动"
    completedTasks: []
    newBlockingIssues: []
    
# === 验收记录 ===
acceptanceLog:
  - taskId: auth-004
    testResult: null         # 待完成
    codeReview: null
```

---

## 6. Delta状态标签规范

### 6.1 ADDED标签

**使用场景**: 新增artifact或新增内容

```yaml
# 示例：新增TSpec
delta: [ADDED]

# 示例：新增AtomTask
atomTasks:
  - id: auth-011
    description: "新增功能"
    delta: [ADDED]
```

**文档头部示例**:
```markdown
---
delta: [ADDED]
---
```

### 6.2 MODIFIED标签

**使用场景**: 已存在的artifact被修改

```yaml
# 示例：修改已有TSpec
delta: [ADDED, MODIFIED]      # 先新增，后修改

# 示例：修改AtomTask描述
atomTasks:
  - id: auth-004
    description: "修改后的描述"
    delta: [MODIFIED]
```

**修改记录示例**:
```markdown
## Change History

| 日期 | 变更类型 | 变更内容 |
|------|---------|---------|
| 2026-05-01 | ADDED | 初始创建 |
| 2026-05-02 | MODIFIED | 更新设计方案 |
```

### 6.3 DELETED标签

**使用场景**: 删除artifact（标记删除而非物理删除）

```yaml
# 示例：删除AtomTask
atomTasks:
  - id: auth-012
    description: "已废弃任务"
    status: DELETED
    delta: [DELETED]
    deletedReason: "功能取消"
```

**删除标记示例**:
```markdown
---
status: DELETED
delta: [ADDED, MODIFIED, DELETED]
deletedReason: "功能取消，不再需要"
deletedAt: "2026-05-03T10:00:00Z"
---
```

### 6.4 RENAMED标签

**使用场景**: Artifact重命名

```yaml
# 示例：重命名TSpec
delta: [ADDED, RENAMED]
previousName: "User Auth TSpec"
currentName: "Authentication System TSpec"
```

**重命名记录示例**:
```markdown
---
delta: [ADDED, RENAMED]
renameHistory:
  - previousName: "User Auth TSpec"
    newName: "Authentication System TSpec"
    renamedAt: "2026-05-02T12:00:00Z"
    reason: "名称规范化"
---
```

### 6.5 Delta组合规则

```typescript
// Delta状态组合的合法序列
const validDeltaSequences = [
  ['ADDED'],                              // 仅新增
  ['ADDED', 'MODIFIED'],                  // 新增后修改
  ['ADDED', 'MODIFIED', 'MODIFIED'],      // 多次修改
  ['ADDED', 'RENAMED'],                   // 新增后重命名
  ['ADDED', 'MODIFIED', 'DELETED'],       // 新增、修改、废弃
  ['ADDED', 'RENAMED', 'MODIFIED'],       // 重命名后继续修改
];

// Delta状态顺序规则
// ADDED必须是第一个（如果是新增）
// DELETED必须是最后一个（如果已删除）
// MODIFIED可以出现多次
// RENAMED只能在ADDED之后，DELETED之前
```

---

## 7. Artifacts依赖关系图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TSpec Layer                                      │
│                                                                               │
│   proposal.md ─────┐                                                          │
│        │           │                                                          │
│        │           │                                                          │
│        ▼           │                                                          │
│   design.md ───────┼───────────────────▶ tspec.md                            │
│        │           │                          │                               │
│        │           │                          │                               │
│        │           ▼                          │                               │
│        │      mspecs.yaml ────────────────────┘                               │
│        │           │                                                          │
└────────┼───────────┼──────────────────────────────────────────────────────────┘
         │           │
         │           │ Fin-Start Serial
         │           │
         ▼           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MSpec Layer                                      │
│                                                                               │
│   proposal.md ─────┐                                                          │
│        │           │                                                          │
│        │           │                                                          │
│        ▼           │                                                          │
│   design.md ───────┼───────────────────▶ mspec.md                            │
│        │           │                          │                               │
│        │           │                          │                               │
│        │           ▼                          │                               │
│        │      wbs.yaml ───────────────────────┘                               │
│        │           │                                                          │
└────────┼───────────┼──────────────────────────────────────────────────────────┘
         │           │
         │           │ Sprint Loop
         │           │
         ▼           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Sprint Layer                                     │
│                                                                               │
│   sspec.md ──────────────────────────▶ tasks.yaml                            │
│        │                                   │                                  │
│        │                                   │                                  │
│        │                                   ▼                                  │
│        │                            Sprint Execution                          │
│        │                                   │                                  │
│        │                                   │                                  │
│        │                                   ▼                                  │
│        │                            AtomTask Updates                          │
│        │                           (反馈到wbs.yaml)                           │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.1 依赖规则说明

| Artifact | 直接依赖 | 间接依赖 | 输出影响 |
|----------|---------|---------|---------|
| proposal.md | 无 | 无 | design.md, tspec.md |
| design.md | proposal.md | 无 | tspec.md, mspecs.yaml |
| tspec.md | proposal.md, design.md | 无 | 整合文档 |
| mspecs.yaml | proposal.md | design.md | MSpec目录结构 |
| mspec/proposal.md | TSpec artifacts | 无 | mspec/design.md |
| mspec/design.md | mspec/proposal.md | TSpec design | wbs.yaml |
| wbs.yaml | mspec artifacts | TSpec design | Sprint选择 |
| sspec.md | wbs.yaml | 所有上游 | tasks.yaml |
| tasks.yaml | sspec.md, wbs.yaml | 所有上游 | Sprint执行 |

---

## 8. TypeScript接口定义

```typescript
/**
 * OMT Artifacts格式规范 - TypeScript类型定义
 */

// === Delta标签 ===
type DeltaLabel = 'ADDED' | 'MODIFIED' | 'DELETED' | 'RENAMED';

// === Artifact状态 ===
type ArtifactStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'DEPRECATED' | 'ARCHIVED';

// === 任务状态 ===
type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'DEFERRED' | 'DELETED';

// === 风险等级 ===
type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// === 文档头部元数据 ===
interface ArtifactHeader {
  id: string;
  createdAt: string;              // ISO-8601
  updatedAt: string;              // ISO-8601
  status: ArtifactStatus;
  delta: DeltaLabel[];
  deletedReason?: string;
  deletedAt?: string;
  renameHistory?: RenameRecord[];
}

interface RenameRecord {
  previousName: string;
  newName: string;
  renamedAt: string;
  reason: string;
}

// === TSpec层级 ===
interface TSpecMeta {
  id: string;                     // tspec_<num>
  name: string;
  createdAt: string;
  updatedAt: string;
  status: ArtifactStatus;
  delta: DeltaLabel[];
  owner: string;
  version: number;
  schemaVersion: string;
}

interface TSpecProposal extends ArtifactHeader {
  why: string;
  whatChanges: ChangeDescription;
  capabilities: Capability[];
  impact: ImpactAnalysis;
}

interface ChangeDescription {
  newFeatures: string[];
  modifiedBehaviors: string[];
  deletedFeatures: string[];
  changeType: 'FEATURE' | 'FIX' | 'REFACTOR' | 'CHORE';
}

interface Capability {
  id: string;
  name: string;
  description: string;
  acceptanceCriteria: string[];
  apiContract?: string;
}

interface ImpactAnalysis {
  technicalImpact: TechnicalImpact;
  businessImpact: BusinessImpact;
  risks: Risk[];
}

interface Risk {
  item: string;
  level: RiskLevel;
  mitigation: string;
}

interface TSpecDesign extends ArtifactHeader {
  context: DesignContext;
  goals: string[];
  nonGoals: NonGoal[];
  decisions: Decision[];
  technicalDesign: TechnicalDesign;
  risks: Risk[];
  tradeoffs: Tradeoff[];
}

interface DesignContext {
  currentStack: string;
  architectureStatus: string;
  relatedCode: string[];
  constraints: Constraints;
}

interface Constraints {
  technical: string[];
  time: string[];
  resource: string[];
}

interface NonGoal {
  item: string;
  reason: string;
}

interface Decision {
  title: string;
  background: string;
  options: DecisionOption[];
  finalDecision: string;
  reasoning: string;
}

interface DecisionOption {
  name: string;
  pros: string[];
  cons: string[];
  selected: boolean;
}

interface TechnicalDesign {
  architecture: string;           // ASCII图
  components: Component[];
  dataModel: string;
  apis: ApiEndpoint[];
}

interface Component {
  name: string;
  responsibility: string;
  interface: string;
  dependencies: string[];
}

interface ApiEndpoint {
  path: string;
  method: string;
  request: string;
  response: string;
  errors: string[];
}

interface Tradeoff {
  point: string;
  cost: string;
  benefit: string;
}

interface TSpecDocument extends ArtifactHeader {
  tspecId: string;
  proposalContent: TSpecProposal;
  designContent: TSpecDesign;
  mspecSummary: MSpecSummary[];
  approval: ApprovalRecord[];
  changeHistory: ChangeRecord[];
}

interface MSpecSummary {
  id: string;
  name: string;
  status: ArtifactStatus;
  estimatedSprints: number;
}

// === MSpec层级 ===
interface MSpecMeta {
  id: string;                     // mspec_<num>
  tspecId: string;
  createdAt: string;
  updatedAt: string;
  status: ArtifactStatus;
  delta: DeltaLabel[];
}

interface MSpecProposal extends ArtifactHeader {
  milestoneGoal: string;
  scopeConstraints: ScopeConstraints;
  capabilityMapping: CapabilityMapping[];
  acceptanceCriteria: string[];
}

interface ScopeConstraints {
  included: ScopeItem[];
  excluded: ScopeItem[];
  boundaries: Boundaries;
}

interface ScopeItem {
  item: string;
  description: string;
}

interface Boundaries {
  input: string;
  output: string;
}

interface CapabilityMapping {
  capabilityId: string;
  sourceTSpec: string;
  mspecResponsibility: string;
}

interface MSpecDesign extends ArtifactHeader {
  moduleDesign: ModuleDesign;
  implementationStrategy: ImplementationStrategy;
  wbsStrategy: WbsStrategy;
  sprintPreview: SprintPreview;
}

interface ModuleDesign {
  structure: string;              // ASCII图
  modules: Module[];
}

interface Module {
  name: string;
  responsibility: string;
  interface: string;
  dependencies: string[];
}

interface ImplementationStrategy {
  sequence: ImplementationPhase[];
  keyTechnicalPoints: TechnicalPoint[];
}

interface ImplementationPhase {
  phase: number;
  description: string;
}

interface TechnicalPoint {
  point: string;
  solution: string;
}

interface WbsStrategy {
  principles: string[];
  estimatedSize: EstimatedSize;
  complexityDistribution: ComplexityDistribution;
}

interface EstimatedSize {
  atomTaskCount: number;
  totalHours: number;
}

interface ComplexityDistribution {
  simple: Distribution;
  medium: Distribution;
  complex: Distribution;
}

interface Distribution {
  percentage: number;
  count: number;
}

interface SprintPreview {
  estimatedSprints: number;
  tasksPerSprint: number;
  parallelismTarget: number;
}

interface MSpecDocument extends ArtifactHeader {
  mspecId: string;
  tspecId: string;
  proposalContent: MSpecProposal;
  designContent: MSpecDesign;
  wbsSummary: WbsSummary;
  sprintExecution: SprintExecution[];
  approval: ApprovalRecord[];
  changeHistory: ChangeRecord[];
}

interface WbsSummary {
  wbsFile: string;
  statistics: TaskStatistics;
  criticalPaths: string[];
}

interface TaskStatistics {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

interface SprintExecution {
  sprintId: string;
  status: string;
  completedTasks: number;
  startDate: string;
  endDate?: string;
}

// === WBS格式 ===
interface WbsYaml {
  mspecId: string;
  createdAt: string;
  updatedAt: string;
  status: ArtifactStatus;
  delta: DeltaLabel[];
  atomTasks: AtomTask[];
  dependencyGraph: Record<string, string[]>;
  criticalPaths: CriticalPath[];
  acceptanceCriteria: string[];
  statistics: WbsStatistics;
}

interface AtomTask {
  id: string;
  description: string;
  complexity: number;             // 1-10
  estimatedHours: number;
  assigneeRole: string;
  blockedBy: string[];
  riskLevel: RiskLevel;
  status: TaskStatus;
  sprintHistory: SprintHistoryEntry[];
  capabilityMapping?: string;
  delta?: DeltaLabel[];
  deletedReason?: string;
}

interface SprintHistoryEntry {
  sprintId: string;
  status: TaskStatus;
  deferredReason?: string;
}

interface CriticalPath {
  path: string[];
  totalHours: number;
  description: string;
}

interface WbsStatistics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  totalEstimatedHours: number;
  remainingHours: number;
  averageComplexity: number;
  parallelismScore: number;
}

// === Sprint层级 ===
interface SprintMeta {
  id: string;                     // sprint_<num>
  mspecId: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  delta: DeltaLabel[];
}

interface SprintSpec extends ArtifactHeader {
  sprintId: string;
  mspecId: string;
  taskSelectionStrategy: TaskSelection[];
  parallelismConfig: ParallelismConfig;
  expectedOutputs: ExpectedOutputs;
  riskAssessment: Risk[];
  executionTimeline: string;
}

interface TaskSelection {
  taskId: string;
  reason: string;
  complexity: number;
  role: string;
}

interface ParallelismConfig {
  target: number;
  analysis: string;
  roleAllocation: RoleAllocation[];
}

interface RoleAllocation {
  role: string;
  taskCount: number;
  estimatedHours: number;
}

interface ExpectedOutputs {
  codeOutputs: CodeOutput[];
  docOutputs: string[];
  acceptanceOutputs: string[];
}

interface CodeOutput {
  type: 'NEW' | 'MODIFIED';
  path: string;
}

interface TasksYaml {
  sprintId: string;
  mspecId: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  delta: DeltaLabel[];
  sprintTasks: SprintTask[];
  executionOrder: ExecutionPhase[];
  statusTracking: SprintStatusTracking;
  dailyUpdates: DailyUpdate[];
  acceptanceLog: AcceptanceLogEntry[];
}

interface SprintTask {
  taskId: string;
  selectedReason: string;
  expectedOutput: string;
  status: TaskStatus;
  startedAt?: string;
  completedAt?: string;
  blockingIssues: string[];
  blockedBy?: string[];
}

interface ExecutionPhase {
  phase: number;
  tasks: string[];
  parallel: boolean;
  roles: string[];
  dependsOn?: string[];
  status: string;
}

interface SprintStatusTracking {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  blockedTasks: number;
  completionRate: number;
  estimatedRemainingHours: number;
  elapsedHours: number;
}

interface DailyUpdate {
  date: string;
  summary: string;
  completedTasks: string[];
  newBlockingIssues: string[];
}

interface AcceptanceLogEntry {
  taskId: string;
  testResult?: string;
  codeReview?: string;
}

// === 通用记录 ===
interface ApprovalRecord {
  reviewer: string;
  role: string;
  date: string;
  conclusion: 'APPROVED' | 'REJECTED' | 'PENDING';
  notes?: string;
}

interface ChangeRecord {
  date: string;
  changeType: DeltaLabel;
  changeContent: string;
  author?: string;
}
```

---

## 9. 验收判定标准

### 9.1 TSpec验收标准

| 检查项 | 验收条件 | 工具/方法 |
|--------|---------|----------|
| proposal.md存在 | 文件存在于tspec目录 | fs.existsSync |
| design.md存在 | 文件存在于tspec目录 | fs.existsSync |
| tspec.md存在 | 整合文档已生成 | fs.existsSync |
| mspecs.yaml有效 | YAML语法正确，包含至少1个MSpec | yaml.parse |
| 所有MSpec已创建 | mspecs目录结构与yaml一致 | 目录遍历 |
| Capabilities定义完整 | 每个Capability有验收标准 | schema验证 |

### 9.2 MSpec验收标准

| 检查项 | 验收条件 | 工具/方法 |
|--------|---------|----------|
| proposal.md存在 | 文件存在于mspec目录 | fs.existsSync |
| design.md存在 | 文件存在于mspec目录 | fs.existsSync |
| mspec.md存在 | 整合文档已生成 | fs.existsSync |
| wbs.yaml有效 | YAML语法正确，atomTasks >= 1 | yaml.parse |
| AtomTask格式正确 | 必填字段完整 | schema验证 |
| 依赖图无环 | dependencyGraph无循环依赖 | DAG检测 |
| 关键路径已计算 | criticalPaths字段非空 | 字段验证 |

### 9.3 Sprint验收标准

| 检查项 | 验收条件 | 工具/方法 |
|--------|---------|----------|
| sspec.md存在 | Sprint设计文档已创建 | fs.existsSync |
| tasks.yaml有效 | YAML语法正确 | yaml.parse |
| 任务选择合理 | selectedTasks来自wbs.yaml | ID匹配验证 |
| 并行度达标 | parallelismScore >= 3 | 数值验证 |
| DAG顺序有效 | executionOrder符合依赖关系 | DAG验证 |

### 9.4 Delta状态验收

| Delta组合 | 验收检查 |
|-----------|---------|
| [ADDED] | 文件首次创建，无previous版本 |
| [ADDED, MODIFIED] | 文件存在且有changeHistory记录 |
| [ADDED, RENAMED] | renameHistory字段存在 |
| [..., DELETED] | deletedReason字段存在，status=DELETED |

---

## 10. 与OpenSpec的对比

### 10.1 结构对比

| 特性 | OpenSpec | OMT |
|------|----------|-----|
| 工作流层数 | 单层（change） | 三层（TSpec → MSpec → Sprint） |
| Schema驱动 | YAML定义artifacts | YAML + Markdown混合 |
| 依赖管理 | 单层artifact图 | 三层嵌套依赖图 |
| 任务分解 | tasks.md清单 | wbs.yaml结构化定义 |
| 执行模式 | 单次apply | Sprint循环执行 |

### 10.2 设计借鉴

| 借鉴点 | OpenSpec设计 | OMT实现 |
|--------|-------------|---------|
| Schema驱动 | schema.yaml定义artifacts | mspecs.yaml + wbs.yaml |
| Delta标签 | ADDED/MODIFIED/DELETED | 完全采纳 |
| 文件状态检测 | fs.existsSync判断完成 | 完全采纳 |
| YAML验收清单 | tasks.md checklist | tasks.yaml + wbs.yaml |
| 依赖图拓扑排序 | Kahn算法 | Sprint Selection算法 |

### 10.3 OMT创新点

| 创新点 | 说明 |
|--------|------|
| **三层嵌套结构** | TSpec → MSpec → Sprint的层次化分解 |
| **WBS量化定义** | AtomTask的复杂度、工时、依赖量化 |
| **Sprint动态构建** | 基于WBS状态动态选择任务组合 |
| **并行度约束** | 强制要求parallelism >= 3 |
| **Fin-Start Serial** | TSpec → MSpec的串行准入机制 |
| **Capability契约** | TSpec定义契约，MSpec实现契约 |

### 10.4 命名映射

| OpenSpec术语 | OMT术语 | 说明 |
|-------------|---------|------|
| change | TSpec | 顶层变更单元 |
| proposal.md | proposal.md | Why文档（相同） |
| spec.md | tspec.md | 整合规格文档 |
| design.md | design.md | How文档（相同） |
| tasks.md | wbs.yaml + tasks.yaml | 结构化任务定义 |
| openspec/ | .omt/ | 项目数据目录 |

---

## 11. 附录：模板文件示例

### 11.1 TSpec模板 (proposal.md)

```markdown
---
id: tspec_XXX_proposal
createdAt: "YYYY-MM-DDTHH:MM:SSZ"
updatedAt: "YYYY-MM-DDTHH:MM:SSZ"
status: DRAFT
delta: [ADDED]
---

# TSpec Proposal

**所属TSpec**: tspec_XXX
**作者**: <填入作者>
**日期**: <填入日期>

## Why

<!-- 描述问题和动机 -->

**问题背景**:
- 当前状态: <描述现状>
- 痛点分析: <列出痛点>
- 业务影响: <量化影响>

## What Changes

**变更范围**:
- 新增功能: <列出新增>
- 修改行为: <列出修改>
- 删除功能: <列出删除>

**变更类型**: FEATURE | FIX | REFACTOR | CHORE

## Capabilities

### Capability 1: <名称>

**描述**: <能力描述>

**验收标准**:
- [ ] <验收条件1>
- [ ] <验收条件2>

## Impact

**技术影响**:
- 受影响模块: <列出模块>

**风险评估**:
| 风险项 | 风险等级 | 缓解策略 |
|--------|---------|---------|
| <风险> | <等级> | <策略> |
```

### 11.2 WBS模板 (wbs.yaml)

```yaml
# wbs.yaml模板
mspecId: mspec_XXX
createdAt: "YYYY-MM-DDTHH:MM:SSZ"
updatedAt: "YYYY-MM-DDTHH:MM:SSZ"
status: DRAFT
delta: [ADDED]

atomTasks:
  - id: <task-id>
    description: "<任务描述>"
    complexity: <1-10>
    estimatedHours: <工时>
    assigneeRole: "<角色>"
    blockedBy: [<依赖任务ID>]
    riskLevel: LOW | MEDIUM | HIGH | CRITICAL
    status: PENDING
    capabilityMapping: "<capability-id>"
    sprintHistory: []

dependencyGraph:
  <task-id>: [<依赖任务ID>]

criticalPaths:
  - path: [<任务ID序列>]
    totalHours: <总工时>
    description: "<路径描述>"

acceptanceCriteria:
  - all_tasks_completed: "所有atomTasks状态为COMPLETED"
  - test_coverage: "测试覆盖率 >= 80%"

statistics:
  totalTasks: <数量>
  completedTasks: 0
  inProgressTasks: 0
  pendingTasks: <数量>
  totalEstimatedHours: <总工时>
  remainingHours: <总工时>
  averageComplexity: <平均值>
  parallelismScore: <并行度>
```

### 11.3 Sprint模板 (tasks.yaml)

```yaml
# tasks.yaml模板
sprintId: sprint_XXX
mspecId: mspec_XXX
createdAt: "YYYY-MM-DDTHH:MM:SSZ"
updatedAt: "YYYY-MM-DDTHH:MM:SSZ"
status: PENDING
delta: [ADDED]

sprintTasks:
  - taskId: <atomTask-id>
    selectedReason: "<选择理由>"
    expectedOutput: "<预期产出>"
    status: PENDING
    startedAt: null
    completedAt: null
    blockingIssues: []

executionOrder:
  - phase: 1
    tasks: [<任务ID>]
    parallel: true
    roles: [<角色>]
    status: PENDING

statusTracking:
  totalTasks: <数量>
  completedTasks: 0
  inProgressTasks: 0
  pendingTasks: <数量>
  blockedTasks: 0
  completionRate: 0
  estimatedRemainingHours: <工时>
  elapsedHours: 0

dailyUpdates: []
acceptanceLog: []
```

---

**文档版本**: 1.0
**最后更新**: 2026-05-01