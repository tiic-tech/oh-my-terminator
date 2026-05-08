# OMT自主创新设计蓝图（Batch 2）

**设计日期**: 2026-04-30
**参考依据**: 08_batch1_diff_analysis.md 核心结论
**设计目标**: 详细设计OMT 11项自主创新内容

---

## 文档结构

本蓝图由4个Part组成，涵盖11个自主创新项的完整设计：

| Part | 章节 | 自主创新项 | 行数 |
|------|------|-----------|------|
| **Part A** | Ch1-3 | I1: grasp repo建模, I2: PMB持久化 | ~1200行 |
| **Part B** | Ch4-6 | I3: Agent生命周期, I4: Skill注入, I5: Context组装 | ~1600行 |
| **Part C** | Ch7-9 | I6: 四层Artifacts对齐, I7: WBS分解, I8: Sprint循环 | ~1400行 |
| **Part D** | Ch10-11 | I9: Gap验收, I10: 失败恢复, I11: Terminator托管 | ~700行 |

---

## 自主创新清单总览

| 编号 | 创新项 | 动因类型 | 参考项目无法提供的原因 |
|-----|-------|---------|---------------------|
| I1 | grasp repo建模 + brain.json | 能力缺失 | OpenSpec无repo概念，Agency无repo抽象 |
| I2 | PMB Sprint历史记录 | 能力缺失 | 两者都无中间过程存储 |
| I3 | Agent生命周期监控 | 能力缺失 | Agency无Agent监控，OpenSpec无Agent概念 |
| I4 | Skill动态注入系统 | 粒度不匹配 | OpenSpec Skill是静态，Agency无Skill概念 |
| I5 | Context动态组装 | 粒度不匹配 | Agency只有简单变量传递 |
| I6 | 四层artifacts一致性对齐 | 粒度不匹配 | OpenSpec只有单层Artifact |
| I7 | 自动WBS分解算法 | 能力缺失 | Agency需人工定义Workflow步骤 |
| I8 | Sprint循环机制 | 定位不符 | 参考项目都是一次性执行系统 |
| I9 | Gap验收闭环 | 定位不符 | 参考项目无验收决策概念 |
| I10 | 失败恢复机制 | 能力缺失 | Agency只有内存级Retry，无持久化恢复 |
| I11 | Terminator全自动托管 | 定位不符 | 参考项目无全自动托管设计 |

---

## 完整文档索引

本蓝图已分为4个独立文件存储，便于分章节阅读：

1. **Part A**: `docs/design/08_batch2_partA.md`
   - Chapter 1: 自主创新必要性分析
   - Chapter 2: grasp repo建模 + brain.json
   - Chapter 3: PMB Sprint历史记录

2. **Part B**: `docs/design/08_batch2_partB.md`
   - Chapter 4: Agent生命周期监控系统
   - Chapter 5: Skill动态注入系统
   - Chapter 6: Context动态组装系统

3. **Part C**: `docs/design/08_batch2_partC.md`
   - Chapter 7: 四层Artifacts一致性对齐
   - Chapter 8: 自动WBS分解算法
   - Chapter 9: Sprint循环机制

4. **Part D**: `docs/design/08_batch2_partD.md`
   - Chapter 10: Gap验收闭环 + 失败恢复机制
   - Chapter 11: Terminator托管模式 + 实现路线图

---

## 架构分层总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OMT自主创新架构分层                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 4: 验收托管层 (I9-I11)                                                  │
│ ─────────────────────────────────────────────                                │
│                                                                             │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐      │
│   │ GapAnalyzer     │────▶│ FailureHandler  │────▶│ TerminatorCtrl  │      │
│   │ (验收决策)       │     │ (失败恢复)       │     │ (托管模式)       │      │
│   └─────────────────┘     └─────────────────┘     └─────────────────┘      │
│                                                                             │
│   职责: 验收决策、失败恢复、全自动托管                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 3: 执行引擎层 (I6-I8)                                                   │
│ ─────────────────────────────────────────────                                │
│                                                                             │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                          │
│   │Artifacts    │ │    WBS      │ │  SprintLoop │                          │
│   │Aligner      │ │ Decomposer  │ │             │                          │
│   └─────────────┘ └─────────────┘ └─────────────┘                          │
│                                                                             │
│   职责: artifacts对齐、任务分解、Sprint循环                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 2: 生命周期层 (I3-I5)                                                   │
│ ─────────────────────────────────────────────                                │
│                                                                             │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐      │
│   │ AgentLifecycle  │────▶│ SkillRegistry   │────▶│ ContextAssembler│      │
│   │ Manager         │     │                 │     │                 │      │
│   └─────────────────┘     └─────────────────┘     └─────────────────┘      │
│                                                                             │
│   职责: Agent生命周期管理、Skill动态注入、Context组装                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 1: 基础建模层 (I1-I2)                                                   │
│ ─────────────────────────────────────────────                                │
│                                                                             │
│   ┌─────────────────┐     ┌─────────────────┐                              │
│   │ GraspRepo       │────▶│ PMBManager      │                              │
│   │ Analyzer        │     │                 │                              │
│   └─────────────────┘     └─────────────────┘                              │
│                                                                             │
│   输出: brain.json (Repo状态) + pmb.yaml (Sprint历史)                          │
│   职责: Repo建模、状态持久化                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 实现优先级路线图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OMT实现路线图                                                │
└─────────────────────────────────────────────────────────────────────────────┘

Phase 1 (P0 - 核心能力) ──────────────────────────────────────────────────────
│
│ I1: grasp repo建模 + brain.json
│     ── Repo状态抽象 + 健康度追踪
│     ── 关键文件: .omt/brain.json
│     ── 实现: GraspRepoAnalyzer
│
│ I2: PMB持久化
│     ── Sprint历史记录 + 失败追踪
│     ── 关键文件: .omt/pmb.yaml
│     ── 实现: PMBManager
│
│ I3: Agent生命周期
│     ── spawn → monitor → 销毁
│     ── 关键文件: .omt/agents/*.md
│     ── 实现: AgentRegistry + AgentLifecycleManager
│
│ I6: 四层artifacts对齐
│     ── TSpec→MSpec→Sprint→AtomTask一致性
│     ── 关键文件: .omt/artifacts/
│     ── 实现: ArtifactsAlignmentValidator
│
│ I7: 自动WBS分解
│     ── MSpec → AtomTask DAG
│     ── 关键文件: .omt/wbs/
│     ── 实现: WBSDecomposer
│
│ I8: Sprint循环
│     ── Sprint Selection + Execution + Review循环
│     ── 关键文件: .omt/sprints/
│     ── 实现: SprintLoop
│
│ I9: Gap验收闭环
│     ── ACCEPTED/NEW_MSPEC/FAILED决策
│     ── 关键文件: .omt/gap/
│     ── 实现: GapAnalyzer

Phase 2 (P1 - 增强能力) ──────────────────────────────────────────────────────
│
│ I4: Skill动态注入
│     ── 按assigneeRole动态注入Skill
│     ── 关键文件: .omt/skills/
│     ── 实现: SkillRegistry
│
│ I5: Context动态组装
│     ── MSpec Design + Dependencies + Brain + PMB
│     ── 关键文件: .omt/context/
│     ── 实现: ContextAssembler
│
│ I10: 失败恢复
│     ── PMB失败记录 + Sprint恢复
│     ── 关键文件: .omt/recovery/
│     ── 实现: FailureHandler

Phase 3 (P2 - 托管模式) ──────────────────────────────────────────────────────
│
│ I11: Terminator全自动
│     ── 全自动托管 + 暂停/恢复
│     ── 关键文件: .omt/terminator.yaml
│     ── 实现: TerminatorController
```

---

## 设计完成日期

- **Part A**: 2026-04-30
- **Part B**: 2026-04-30
- **Part C**: 2026-04-30
- **Part D**: 2026-04-30

---

## 下一步

根据路线图开始 Phase 1 实现：
1. `I1`: 实现 GraspRepoAnalyzer + brain.json 结构
2. `I2`: 实现 PMBManager + pmb.yaml 结构
3. `I3`: 实现 AgentRegistry + Agent生命周期状态机

---

**文档索引**:
- Part A 完整内容: `docs/design/08_batch2_partA.md`
- Part B 完整内容: `docs/design/08_batch2_partB.md`
- Part C 完整内容: `docs/design/08_batch2_partC.md`
- Part D 完整内容: `docs/design/08_batch2_partD.md`