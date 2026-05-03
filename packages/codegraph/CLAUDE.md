# CodeGraph Development Guidelines

> 开发原则与流程规范 — 所有代码开发必须遵循

---

## 核心原则

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

### 4. Checkpoint Commits (节点提交)

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
│  1. 准备阶段                                                     │
│     ├─ 确认 change artifacts 已完成               │
│     ├─ 创建 feat 分支: git checkout -b feat/<change>            │
│     └─ 阅读 tasks.md，理解任务分组                                │
│                                                                 │
│  2. 开发阶段 (每个任务组)                                         │
│     ├─ ──────────────────────────────────────────────────────── │
│     │  TDD 循环 (每个 task):                                    │
│     │    ├─ RED:   写测试 → 运行 → 确认失败                       │
│     │    ├─ GREEN: 写实现 → 运行 → 确认通过                       │
│     │    ├─ REFACTOR: 优化代码 → 确认测试仍通过                   │
│     │    └─ 覆盖率: 验证 ≥ 80%                                   │
│     ├─ ──────────────────────────────────────────────────────── │
│     │  任务组完成:                                               │
│     │    ├─ 判断是否需要 checkpoint commit                       │
│     │    ├─ 如需要: git add + git commit                        │
│     │    └─ 继续下一任务组                                       │
│     ├─ ──────────────────────────────────────────────────────── │
│                                                                 │
│  3. 完成阶段                                                     │
│     ├─ 所有 tasks 完成                                          │
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

**开发前**:
- [ ] feat 分支已创建
- [ ] tasks.md 已阅读
- [ ] 理解当前任务组的依赖关系

**每个 Task**:
- [ ] 测试先写 (RED)
- [ ] 测试失败确认
- [ ] 实现最小代码 (GREEN)
- [ ] 测试通过确认
- [ ] 代码优化 (REFACTOR)
- [ ] 覆盖率 ≥ 80%

**任务组完成**:
- [ ] 判断是否 checkpoint commit
- [ ] 提交格式正确

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

**版本**: v1.0
**创建**: 2026-05-03
**适用**: CodeGraph MVP 开发 (C1-C12)