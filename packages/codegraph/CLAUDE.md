# CodeGraph Development Guidelines

> 开发原则与流程规范 — 所有代码开发必须遵循

---

## 核心原则

### 0. Coding Taste SKILL (代码品味)

**所有编程任务开始前必须加载 coding-taste SKILL**:

```bash
# 在任何代码编写之前，必须执行
/coding-taste
```

**目的**:
- 确保代码符合最佳实践
- 保持代码简洁、可读、可维护
- 遵循"代码品味"标准

**执行时机**:
- 进入开发阶段前
- 开始编写任何代码前
- 与 TDD Workflow 配合使用

**注意**: coding-taste SKILL 与 tdd-workflow 是互补的开发范式，必须同时遵循。

---

### 1. TDD Workflow (测试驱动开发)

**所有代码开发必须遵循 TDD 流程**:

```
RED → GREEN → REFACTOR
  │      │        │
  │      │        └─ 优化代码结构，保持测试通过
  │      └────────── 写最小实现，让测试通过
  │  ────────────── 先写测试，测试必须失败
```

**执行顺序**:
1. **RED**: 先写测试，运行测试确认失败
2. **GREEN**: 写最小实现代码，让测试通过
3. **REFACTOR**: 优化代码，确保测试仍然通过
4. **验证覆盖率**: 每个模块测试覆盖率 ≥ 80%

**禁止**: 先写实现再补测试 — 这不是 TDD

---

### 2. Code Review (代码审查)

**所有实现完成后必须执行 code-reviewer 审查**:

```bash
# 完成一个任务组后，触发审查
/code-review
```

**审查要点**:
- [ ] 代码符合 TDD 产出（测试先行）
- [ ] 测试覆盖率 ≥ 80%
- [ ] 无明显性能问题
- [ ] 无安全隐患
- [ ] 符合项目编码规范

**审查结果处理**:
- CRITICAL/HIGH 问题 → 立即修复
- MEDIUM 问题 → 尽量修复
- LOW 问题 → 记录，后续处理

---

### 3. Branch Strategy (分支策略)

**进入正式开发必须创建 feat 分支**:

```bash
# 从 main 创建功能分支
git checkout main
git checkout -b feat/cg-core-graph-structure

# 所有开发在 feat 分支进行
# 完成后不直接 merge，等待审查
```

**分支命名规则**:
- 功能开发: `feat/<change-name>` (如 `feat/cg-core-graph-structure`)
- Bug修复: `fix/<issue-name>`
- 重构: `refactor/<refactor-name>`

**Merge 规则**:
- 完成所有 tasks → 不直接 merge
- 执行 code-reviewer 审查
- 审查通过 → 创建 PR 或 merge
- 审查不通过 → 修复后重新审查

---

### 4. Batched Development Strategy (分批次开发策略)

**执行 Change tasks 前必须评估复杂度，决定是否分批次开发**:

```
Tasks 复杂度评估:
┌─────────────────────────────────────────────────────────────┐
│  Tasks Group 复杂度判断                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  总 Tasks 数量:                                              │
│  ├─ < 30 tasks  → 单批次开发                                 │
│  ├─ 30-60 tasks → 分 2-3 批次                                │
│  ├─ 60-100 tasks → 分 3-5 批次                               │
│  └─ > 100 tasks → 分 5+ 批次，每批次 20-30 tasks              │
│                                                             │
│  其他复杂度因素:                                              │
│  ├─ 跨文件依赖数量                                            │
│  ├─ 新增类型/接口数量                                         │
│  ├─ 需要新建 fixture 数量                                     │
│  └─ 技术栈复杂度                                              │
│                                                             │
│  分批次原则:                                                  │
│  ├─ 优先保证每批次质量，而非速度                              │
│  ├─ 每批次完成后进行中期汇报                                   │
│  ├─ 每批次必须严格遵循 coding-taste + tdd-workflow            │
│  └─ 批次间进行 checkpoint commit                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**分批次执行流程**:
1. **评估**: 阅读 tasks.md，统计总任务数，评估复杂度
2. **规划**: 确定批次划分，每批次 20-70 tasks
3. **执行**: 每批次严格遵循 coding-taste + tdd-workflow
4. **汇报**: 批次完成后进行中期汇报，确认方向正确
5. **提交**: 每批次完成后 checkpoint commit
6. **继续**: 下一批次开始前确认前一批次无遗留问题

**禁止**:
- ❌ 激进的开发方式（追求速度牺牲质量）
- ❌ 跳过 coding-taste SKILL 加载
- ❌ 跳过 TDD RED→GREEN→REFACTOR 循环
- ❌ 批次间不进行汇报和确认

**用户反馈示例** (来自实际开发):
> "不能进行激进的开发方式。一定要遵循tdd-workflow，宁愿分批次开发，比如先开发60-70个tasks，进行中期汇报。要保障质量，不要追求速度"

---

### 5. Checkpoint Commits (节点提交)

**每完成一个任务组判断是否需要 git commit**:

```
tasks.md 任务组结构：
## 1. Package Setup       ← 完成后判断是否 commit
## 2. Core Types          ← 完成后判断是否 commit
## 3. CodeGraph Class     ← 完成后判断是否 commit
...
```

**判断标准**:
| 任务组类型 | 是否提交 | 理由 |
|-----------|---------|------|
| Setup/配置 | ✓ 提交 | 独立可验证的基础设施 |
| 类型定义 | ✓ 提交 | 无运行时依赖，可独立测试 |
| 核心实现 | ✓ 提交 | 功能完整，测试通过 |
| 测试补充 | 可选 | 通常跟随实现一起提交 |
| 文档 | 可选 | 可单独提交或合并 |

**Checkpoint 提交格式**:
```
feat(<change>): Complete task group N - <group-name>

Tasks completed:
- N.1 <task description>
- N.2 <task description>
...

All tests passing. Coverage: X%
```

---

## 开发流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                    CodeGraph 开发流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  0. 前置检查 (NEW!)                                              │
│     ├─ 加载 coding-taste SKILL: /coding-taste                   │
│     └─ 确认理解代码品味标准                                       │
│                                                                 │
│  1. 准备阶段                                                     │
│     ├─ 确认 change artifacts 已完成               │
│     ├─ 创建 feat 分支: git checkout -b feat/<change>            │
│     ├─ 阅读 tasks.md，理解任务分组                                │
│     └─ 评估复杂度，决定分批次策略 (NEW!)                          │
│        ├─ 统计总任务数                                            │
│        ├─ 划分批次 (20-70 tasks/批次)                            │
│        └─ 确认批次规划                                            │
│                                                                 │
│  2. 开发阶段 (每个批次)                                           │
│     ├─ ──────────────────────────────────────────────────────── │
│     │  批次开始前:                                               │
│     │    ├─ 加载 coding-taste SKILL                             │
│     │    └─ 确认批次任务范围                                      │
│     ├─ ──────────────────────────────────────────────────────── │
│     │  TDD 循环 (每个 task):                                    │
│     │    ├─ RED:   写测试 → 运行 → 确认失败                       │
│     │    ├─ GREEN: 写实现 → 运行 → 确认通过                       │
│     │    ├─ REFACTOR: 优化代码 → 确认测试仍通过                   │
│     │    └─ 覆盖率: 验证 ≥ 80%                                   │
│     ├─ ──────────────────────────────────────────────────────── │
│     │  批次完成:                                                 │
│     │    ├─ 执行中期汇报 (NEW!)                                  │
│     │    ├─ checkpoint commit                                   │
│     │    └─ 确认无遗留问题                                       │
│     ├─ ──────────────────────────────────────────────────────── │
│                                                                 │
│  3. 完成阶段                                                     │
│     ├─ 所有批次完成                                              │
│     ├─ 执行 code-reviewer 审查                                  │
│     ├─ 处理审查问题                                              │
│     ├─ 审查通过                                                 │
│     ├─ 可选: 创建 PR                                            │
│     └─ Merge 或等待进一步处理                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 快速检查清单

**开发前 (NEW!)**:
- [ ] 加载 coding-taste SKILL
- [ ] feat 分支已创建
- [ ] tasks.md 已阅读
- [ ] 复杂度已评估
- [ ] 批次规划已确定

**每个批次开始前**:
- [ ] 重新加载 coding-taste SKILL
- [ ] 确认批次任务范围

**每个 Task**:
- [ ] 测试先写 (RED)
- [ ] 测试失败确认
- [ ] 实现最小代码 (GREEN)
- [ ] 测试通过确认
- [ ] 代码优化 (REFACTOR)
- [ ] 覆盖率 ≥ 80%
- [ ] 符合 coding-taste 标准

**批次完成**:
- [ ] 进行中期汇报
- [ ] checkpoint commit
- [ ] 确认无遗留问题

**Change 完成**:
- [ ] 所有 tasks 完成
- [ ] code-reviewer 审查执行
- [ ] 审查问题处理完毕
- [ ] 不直接 merge (等待审查结果)

---

## 相关文档

- [01_origin_blueprint.md](../docs/design-codegraph/01_origin_blueprint.md) — 技术规格
- [develop_changes_plan.md](../docs/design-codegraph/develop_changes_plan.md) — Change 拆分规划
- [openspec/changes/](../openspec/changes/) — Change artifacts 目录

---

**版本**: v2.0
**更新**: 2026-05-03
**适用**: CodeGraph MVP 开发 (C1-C12)

**v2.0 新增约束**:
- 0. Coding Taste SKILL - 所有编程前必须加载
- 4. Batched Development Strategy - 分批次开发，优先质量而非速度