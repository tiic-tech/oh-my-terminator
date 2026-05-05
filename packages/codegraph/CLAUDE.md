# CodeGraph Development Constraints

> 核心行为约束 — 所有开发必须遵循

---
## 0. Orchestrator Role(主Agent 角色)

主Agent 应主动做好 Orchestrator的角色：
1. 做好和用户的Conversation，采集并协助澄清需求
2. 做好Subagent的分派：做好开发的Context的组装和分发，开发细节优先分配subagent执行，保护主Agent的Context容量
3. 做好任务派发的验收，git版本管理，子subagent的全生命周期管理

## 1. SKILL Loading (强制加载)

**任何代码开发前必须加载 SKILL**:

```bash
/coding-taste   # 代码品味标准
/tdd-workflow   # 测试驱动开发流程
```

**Subagent Prompt 必须包含**:
```
Load coding-taste SKILL first. Load tdd-workflow SKILL. Then implement following TDD workflow.
```

---

## 2. TDD Workflow (测试驱动)

```
RED → GREEN → REFACTOR
```

1. **RED**: 先写测试，运行确认失败
2. **GREEN**: 最小实现，运行确认通过
3. **REFACTOR**: 优化代码，确保测试仍通过

**禁止**: 先实现后补测试

---

## 3. Subagent Parallelism (并行限制)

**MAX_PARALLEL_SUBAGENTS = 3**

禁止一次性并行超过3个subagent（会导致API禁止访问）

**依赖分析前置**:
- 并行分配前必须分析任务依赖关系
- 按拓扑顺序分发，下游任务等待上游完成
- 同一文件不可分配给多个subagent

---

## 4. Checkpoint Commit (节点提交)

**批次完成 → 立即 commit**

- 每个批次完成后必须git commit
- 禁止跨多个批次一次性commit
- 禁止积累大量修改后才commit

---

## 5. OpenSpec Artifacts (用户触发)

**Agent 禁止创建 OpenSpec artifacts**

只有在用户手动输入 `/opsx:COMMAND` 时，才执行对应COMMAND创建artifacts。

**禁止行为**:
- ❌ 未经用户输入 `/opsx:*` 命令，擅自创建任何 openspec artifacts
- ❌ 在 package 目录创建 openspec/（必须在 repo 根目录 `/openspec/changes/<change>/`）

---

**版本**: v3.0
**更新**: 2026-05-04
**精简**: 保留核心行为约束，去除冗余描述