# OMT自主创新设计蓝图 - Batch 2 Part A

**设计日期**: 2026-04-30
**设计范围**: 章节1-3（自主创新必要性 + grasp repo建模 + PMB历史记录）
**参考依据**: 08_batch1_diff_analysis.md 核心结论

---

## Chapter 1: 自主创新必要性分析

### 1.1 为什么OMT必须自主创新？

OMT与OpenSpec/Agency的核心定位差异决定了自主创新不可避免：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    定位差异驱动的自主创新必要性                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│      OpenSpec           │     Agency-Orchestrator │          OMT            │
│  (单次Change生命周期)     │   (一次性Workflow执行)    │   (长周期持续性系统)      │
├─────────────────────────┼─────────────────────────┼─────────────────────────┤
│ • Change完成即结束       │ • Workflow执行完毕即结束 │ • Sprint循环持续迭代     │
│ • 无状态持久化           │ • 内存Context传递       │ • brain.json持久化      │
│ • 无中间过程存储         │ • 只存储最终结果        │ • PMB记录每步执行       │
│ • 无Agent概念           │ • Agent执行结束即销毁   │ • Agent生命周期监控     │
│ • 无验收闭环            │ • 无验收决策            │ • Gap Analysis验收     │
│ • 无失败恢复            │ • Retry内存级          │ • Sprint失败恢复       │
└─────────────────────────┴─────────────────────────┴─────────────────────────┘

              定位差异 → 能力缺口 → 必须自主创新
```

**定位差异的本质**：

| 定位维度 | OpenSpec/Agency | OMT | 创新必要性 |
|---------|-----------------|-----|-----------|
| 时间范围 | 单次执行（分钟级） | 长周期开发（天/周级） | OMT需要跨时间状态追踪 |
| 状态持续性 | 一次性内存状态 | 持久化状态（跨Session） | OMT需要状态持久化机制 |
| 过程记录 | 只记录结果 | 记录全过程 | OMT需要中间过程存储 |
| Agent管理 | 无/隐含Agent | 显式Agent生命周期 | OMT需要Agent监控机制 |
| 决策闭环 | 无验收决策 | Gap Analysis验收 | OMT需要验收闭环 |

### 1.2 借鉴原则：自主创新的三重判断框架

```markdown
┌─────────────────────────────────────────────────────────────────────────────┐
│                    自主创新三重判断框架                                         │
└─────────────────────────────────────────────────────────────────────────────┘

对于每个参考设计点，执行三重判断：

1. 【定位匹配度判断】
   ┌───────────────────┐
   │ 是否与OMT定位一致？│
   └───────────────────┘
         │
    ┌────┴────┬────────────┬────────────┐
    │         │            │            │
    ▼         ▼            ▼            ▼
 完全匹配   部分匹配     不匹配      定位相反
    │         │            │            │
    ▼         ▼            ▼            ▼
 ✅借鉴    ⚠️改造借鉴   ❌不借鉴    ❌明确拒绝

2. 【能力缺口判断】
   ┌─────────────────────┐
   │ OMT是否有此能力？    │
   │ 参考项目能否提供？   │
   └─────────────────────┘
         │
    ┌────┴────┬────────────┬────────────┐
    │         │            │            │
    ▼         ▼            ▼            ▼
  OMT有    OMT无且需要  OMT无且不需要  参考无此能力
    │         │            │            │
    ▼         ▼            ▼            ▼
 比较优劣   ⚠️改造借鉴   ❌不借鉴    ✅自主创新

3. 【改造成本判断】
   ┌───────────────────────┐
   │ 改造借鉴的复杂度？      │
   │ 自主创新的ROI如何？    │
   └───────────────────────┘
         │
    ┌────┴────┬────────────┬────────────┐
    │         │            │            │
    ▼         ▼            ▼            ▼
  低成本    中成本       高成本      极高成本
    │         │            │            │
    ▼         ▼            ▼            ▼
 ⚠️改造    评估后决策   ✅自主创新   ✅自主创新
```

**借鉴原则核心陈述**：

1. **定位驱动原则**：以OMT长周期持续性定位为判断基准
2. **批判性评估原则**：每个设计点都要问"OMT真的需要这个吗？"
3. **自主创新优先原则**：当参考项目无法提供时，自主创新而非强行改造
4. **明确拒绝原则**：不适合OMT的设计点明确拒绝并说明理由

### 1.3 自主创新的三大动因

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    自主创新三大动因分类                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 动因1: 定位不符                                                              │
│ ─────────────────────────────────────────────────────────────────────────── │
│ 参考项目定位与OMT根本冲突，无法借鉴                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ • OpenSpec单次Change生命周期 vs OMT多Sprint循环                              │
│ • Agency一次性执行 vs OMT持续性系统                                           │
│ • 参考项目无验收闭环 vs OMT有Gap Analysis验收                                 │
│                                                                             │
│ 自主创新项：                                                                  │
│   I4: Sprint循环机制                                                         │
│   I5: Terminator全自动模式                                                   │
│   I9: Gap Analysis验收决策                                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 动因2: 能力缺失                                                              │
│ ─────────────────────────────────────────────────────────────────────────── │
│ 参考项目完全缺失某能力，OMT必须自建                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ • OpenSpec无repo概念，Agency无repo抽象                                       │
│ • OpenSpec无Agent概念，Agency无Agent监控                                     │
│ • 两者都无状态持久化                                                          │
│ • 两者都无中间过程存储                                                        │
│                                                                             │
│ 自主创新项：                                                                  │
│   I1: grasp repo建模 + brain.json                                            │
│   I2: PMB Sprint历史记录                                                     │
│   I3: Agent生命周期监控                                                      │
│   I11: 失败恢复机制                                                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 动因3: 粒度不匹配                                                            │
│ ─────────────────────────────────────────────────────────────────────────── │
│ 参考项目粒度与OMT需求不匹配，改造成本高于自主创新                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ • OpenSpec Artifact粒度太粗，OMT需要AtomTask粒度                             │
│ • Agency需人工定义Workflow步骤，OMT需要自动分解                               │
│ • Agency Context传递简单，OMT需要复杂Context组装                              │
│                                                                             │
│ 自主创新项：                                                                  │
│   I6: 自动WBS分解算法                                                        │
│   I10: 四层artifacts一致性对齐                                               │
│   I5: Context动态组装                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**11个自主创新项分类归属**：

| 自主创新项 | 动因类型 | 具体说明 |
|-----------|---------|---------|
| I1: grasp repo + brain.json | 能力缺失 | OpenSpec无repo概念，Agency无repo抽象 |
| I2: PMB历史记录 | 能力缺失 | 两者都无中间过程存储 |
| I3: Agent生命周期监控 | 能力缺失 | Agency无Agent监控，OpenSpec无Agent概念 |
| I4: Sprint循环机制 | 定位不符 | 参考项目都是一次性执行 |
| I5: Terminator全自动 | 定位不符 | 参考项目无全自动托管设计 |
| I6: 自动WBS分解 | 粒度不匹配 | Agency需人工定义，改造成本极高 |
| I7: Sprint Selection | 粒度不匹配 | OMT已有设计，无参考来源 |
| I8: Gap Analysis验收 | 定位不符 | 参考项目无验收概念 |
| I9: MSpec动态调整 | 定位不符 | 参考项目无动态调整机制 |
| I10: 四层artifacts对齐 | 粒度不匹配 | OpenSpec只有单层Artifact |
| I11: 失败恢复 | 能力缺失 | Agency只有内存Retry，无持久化恢复 |

---

## Chapter 2: grasp repo建模 + brain.json

### 2.1 设计原理：为什么需要Repo建模？

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Repo建模必要性分析                                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ OMT长周期开发的三大需求                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ 1. 【健康度追踪】                                                             │
│    • 多Sprint执行期间，repo健康状态需要持续监控                                │
│    • 测试覆盖率变化：Sprint前85% → Sprint后88%                                │
│    • 构建状态追踪：确保每次Sprint不破坏构建                                    │
│    • 依赖版本变化：追踪npm/pip依赖更新                                        │
│                                                                             │
│ 2. 【状态一致性】                                                             │
│    • Agent启动时需要完整的repo上下文                                          │
│    • 多Agent协作需要共享repo认知                                              │
│    • Sprint失败恢复需要知道失败时的repo状态                                    │
│                                                                             │
│ 3. 【决策依据】                                                               │
│    • Gap Analysis需要参考repo当前状态做验收决策                               │
│    • Sprint Selection需要知道哪些任务已完成                                   │
│    • WBS分解需要了解repo当前实现进度                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

              OpenSpec/Agency无repo概念 → OMT必须自主创新
```

**与参考项目的对比**：

| 维度 | OpenSpec | Agency-Orchestrator | OMT |
|-----|----------|---------------------|-----|
| repo抽象 | ❌ 无repo概念 | ❌ 无repo抽象 | ✅ grasp repo建模 |
| 状态追踪 | ❌ 无追踪 | ❌ 无追踪 | ✅ brain.json持久化 |
| 健康度监控 | ❌ 无监控 | ❌ 无监控 | ✅ HealthMetrics |
| Agent上下文 | ⚠️ 隐含CLI | ⚠️ 内存Context | ✅ brain.json共享 |

### 2.2 grasp repo抽象模型

```typescript
/**
 * grasp repo 抽象模型
 * 
 * 设计理念：
 * - grasp repo是OMT对开发仓库的完整抽象
 * - 作为Agent认知的"记忆中枢"
 * - 支持状态持久化和跨Session一致性
 */

interface GraspRepo {
  /** repo根目录绝对路径 */
  root: string;
  
  /** git状态：追踪commit、branch、remote等 */
  git: GitState;
  
  /** 健康度指标：测试覆盖率、构建状态等 */
  health: HealthMetrics;
  
  /** artifacts注册表：追踪所有OMT artifacts */
  artifacts: ArtifactRegistry;
  
  /** brain状态：全局认知存储 */
  brain: BrainState;
}

/**
 * git状态模型
 */
interface GitState {
  /** 当前分支名 */
  currentBranch: string;
  
  /** 最新commit SHA */
  lastCommit: string;
  
  /** 未提交的变更数量 */
  uncommittedChanges: number;
  
  /** 远程仓库URL */
  remoteUrl: string;
  
  /** 上次同步时间 */
  lastSyncTime: string;
  
  /** open PR数量（如有） */
  openPullRequests: number;
}

/**
 * 健康度指标模型
 */
interface HealthMetrics {
  /** 测试覆盖率百分比 */
  testCoverage: number;
  
  /** 构建状态：passing/failing/pending */
  buildStatus: 'passing' | 'failing' | 'pending';
  
  /** lint状态：clean/warnings/errors */
  lintStatus: 'clean' | 'warnings' | 'errors';
  
  /** 类型检查状态（TS项目） */
  typeCheckStatus: 'passing' | 'failing' | 'not_applicable';
  
  /** 安全扫描状态 */
  securityScanStatus: 'clean' | 'warnings' | 'vulnerabilities';
  
  /** 指标更新时间 */
  lastUpdated: string;
}

/**
 * artifacts注册表
 */
interface ArtifactRegistry {
  /** 已存在的TSpec文件路径 */
  tspecPath: string | null;
  
  /** 已存在的MSpec文件列表 */
  mspecPaths: string[];
  
  /** 已完成的Sprint记录 */
  completedSprints: SprintRecord[];
  
  /** 当前活跃Sprint */
  activeSprint: string | null;
  
  /** WBS进度追踪 */
  wbsProgress: WBSProgress;
}

/**
 * Sprint记录
 */
interface SprintRecord {
  sprintId: string;
  status: 'completed' | 'failed' | 'skipped';
  completedAt: string;
  commitSHA: string;
}

/**
 * WBS进度
 */
interface WBSProgress {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  remainingTasks: number;
}
```

### 2.3 brain.json结构设计

```json
{
  "$schema": "https://omt.dev/schemas/brain.json",
  "version": "1.0.0",
  "last_updated": "2026-04-30T18:30:00Z",
  
  "repo_health": {
    "test_coverage": 85,
    "build_status": "passing",
    "lint_status": "clean",
    "type_check_status": "passing",
    "security_scan_status": "clean",
    "last_commit": "abc123def456",
    "open_issues": 3,
    "open_pull_requests": 1,
    "dependencies": {
      "outdated": 2,
      "vulnerable": 0
    }
  },
  
  "sprint_history": [
    {
      "sprint_id": "sprint_001",
      "status": "completed",
      "started_at": "2026-04-28T10:00:00Z",
      "completed_at": "2026-04-28T16:30:00Z",
      "tasks_completed": 5,
      "tasks_failed": 0,
      "commit_sha": "abc123",
      "gap_analysis_result": "ACCEPTED"
    },
    {
      "sprint_id": "sprint_002",
      "status": "completed",
      "started_at": "2026-04-29T09:00:00Z",
      "completed_at": "2026-04-29T15:00:00Z",
      "tasks_completed": 4,
      "tasks_failed": 1,
      "commit_sha": "def456",
      "gap_analysis_result": "NEW_MSPEC"
    }
  ],
  
  "agent_pool_status": {
    "spawned_agents": [
      {
        "agent_id": "backend-developer-001",
        "role": "backend-developer",
        "status": "idle",
        "last_task": "task_001",
        "spawned_at": "2026-04-28T10:00:00Z"
      },
      {
        "agent_id": "code-reviewer-001",
        "role": "code-reviewer",
        "status": "active",
        "current_task": "task_005",
        "spawned_at": "2026-04-28T14:00:00Z"
      }
    ],
    "total_spawned": 2,
    "currently_active": 1
  },
  
  "wbs_progress": {
    "total_tasks": 20,
    "completed_tasks": 9,
    "failed_tasks": 1,
    "remaining_tasks": 10,
    "completion_percentage": 45
  },
  
  "context_cache": {
    "tspec_summary": "实现用户认证模块...",
    "current_mspec_summary": "AuthController API设计...",
    "last_brainstorm_output": "idea: 用户认证...",
    "last_pitch_output": "澄清问题：..."
  }
}
```

### 2.4 状态追踪机制

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    brain.json状态追踪机制                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Sprint生命周期中的brain.json交互                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   omt:sprint 开始                                                            │
│       │                                                                     │
│       ├──► 加载 brain.json                                                  │
│       │    • 读取repo_health作为执行前状态                                   │
│       │    • 读取sprint_history获取历史上下文                               │
│       │    • 读取wbs_progress决定任务选择                                   │
│       │                                                                     │
│       ▼                                                                     │
│   Agent spawn                                                               │
│       │                                                                     │
│       ├──► Agent读取 brain.json                                             │
│       │    • 作为Agent的初始认知                                            │
│       │    • 理解repo当前状态                                               │
│       │    • 获取历史决策参考                                               │
│       │                                                                     │
│       ▼                                                                     │
│   任务执行                                                                   │
│       │                                                                     │
│       ├──► 实时更新 brain.json（每任务完成）                                 │
│       │    • 更新wbs_progress                                               │
│       │    • 更新agent_pool_status                                          │
│       │                                                                     │
│       ▼                                                                     │
│   omt:review 完成                                                           │
│       │                                                                     │
│       ├──► 更新 brain.json                                                  │
│       │    • 更新repo_health（执行后状态）                                   │
│       │    • 新增sprint_history记录                                         │
│       │    • 清理agent_pool_status                                          │
│       │                                                                     │
│       ▼                                                                     │
│   brain.json持久化完成                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. Agent启动时的brain.json上下文组装                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   loadAgent(assigneeRole)                                                   │
│       │                                                                     │
│       ├──► 构建Agent Prompt                                                 │
│       │                                                                     │
│       │    <project_context>                                                │
│       │      <!-- 从 brain.json 加载 -->                                    │
│       │      Repo State:                                                    │
│       │        - Test Coverage: {{brain.repo_health.test_coverage}}%       │
│       │        - Build Status: {{brain.repo_health.build_status}}          │
│       │        - Last Commit: {{brain.repo_health.last_commit}}            │
│       │                                                                     │
│       │      Sprint History:                                                │
│       │        - Completed: {{brain.sprint_history.completed.length}}      │
│       │        - Last Result: {{brain.sprint_history[-1].gap_analysis}}    │
│       │                                                                     │
│       │      WBS Progress:                                                  │
│       │        - Remaining: {{brain.wbs_progress.remaining_tasks}}         │
│       │    </project_context>                                               │
│       │                                                                     │
│       ▼                                                                     │
│   Agent拥有完整repo认知                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. 失败恢复时的brain.json状态回滚                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Sprint失败检测                                                             │
│       │                                                                     │
│       ├──► 读取 brain.json                                                  │
│       │    • 获取失败时的repo_health                                        │
│       │    • 获取失败Sprint的任务列表                                       │
│       │    • 识别失败任务                                                   │
│       │                                                                     │
│       ▼                                                                     │
│   恢复决策                                                                   │
│       │                                                                     │
│       ├──► 根据brain.json决定恢复策略                                       │
│       │    • 重试失败任务                                                   │
│       │    • 回滚到失败前commit                                             │
│       │    • 调整MSpec重新分解                                              │
│       │                                                                     │
│       ▼                                                                     │
│   恢复执行                                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.5 ASCII架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    grasp repo建模架构                                         │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │   grasp repo     │
                              │   (抽象层)        │
                              └──────────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
          ▼                          ▼                          ▼
   ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
   │  GitState   │            │ HealthMetrics│            │ Artifacts   │
   │             │            │             │            │ Registry    │
   │ • branch    │            │ • coverage  │            │ • tspec     │
   │ • commit    │            │ • build     │            │ • mspecs    │
   │ • remote    │            │ • lint      │            │ • sprints   │
   └─────────────┘            └─────────────┘            └─────────────┘
          │                          │                          │
          └──────────────────────────┼──────────────────────────┘
                                     │
                                     ▼
                              ┌──────────────────┐
                              │   brain.json     │
                              │   (持久化层)      │
                              └──────────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
          ▼                          ▼                          ▼
   ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
   │ repo_health │            │sprint_history│            │agent_pool   │
   │             │            │             │            │ _status     │
   │ • coverage  │            │ • sprint_id │            │ • spawned   │
   │ • build     │            │ • status    │            │ • active    │
   │ • commit    │            │ • result    │            │ • idle      │
   └─────────────┘            └─────────────┘            └─────────────┘
          │                          │                          │
          │                          │                          │
          ▼                          ▼                          ▼
   ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
   │ Agent上下文 │            │ Sprint决策  │            │ 失败恢复    │
   │ 加载        │            │ 依据        │            │ 回滚        │
   └─────────────┘            └─────────────┘            └─────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                    brain.json读写时机                                         │
└─────────────────────────────────────────────────────────────────────────────┘

时间线 ───────────────────────────────────────────────────────────────────►

  omt:start          Agent spawn         任务执行          omt:review
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
 ┌─────────┐        ┌─────────┐        ┌─────────┐        ┌─────────┐
 │ READ    │        │ READ    │        │ UPDATE  │        │ WRITE   │
 │ brain   │        │ brain   │        │ brain   │        │ brain   │
 │         │        │         │        │ (实时)   │        │ (持久化) │
 └─────────┘        └─────────┘        └─────────┘        └─────────┘
      │                  │                  │                  │
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
  初始化上下文      Agent认知构建      进度追踪更新      Sprint归档记录
```

---

## Chapter 3: PMB Sprint历史记录

### 3.1 设计原理：为什么需要PMB？

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PMB必要性分析                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Agency-Orchestrator的中间过程缺失                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Agency Workflow执行流程：                                                     │
│                                                                             │
│   inputs → Step1 → Step2 → Step3 → outputs                                  │
│            │      │      │                                                  │
│            │      │      │                                                   │
│            ▼      ▼      ▼                                                   │
│          内存   内存   内存   ←── 执行结束即丢失                              │
│         Context Context Context                                             │
│                                                                             │
│ 问题：                                                                       │
│   • 无法追溯中间步骤的决策依据                                                │
│   • 无法定位失败发生的具体环节                                                │
│   • 无法支持失败后的精准恢复                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ OMT中间过程记录需求                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ 1. 【历史追溯】                                                              │
│    • Gap Analysis验收时需要知道每个任务的执行结果                             │
│    • 需要追溯"为什么这个任务选择这个实现方案"                                  │
│    • 需要追溯Agent的决策过程                                                 │
│                                                                             │
│ 2. 【失败定位】                                                              │
│    • Sprint失败时需要精确定位失败任务                                        │
│    • 需要知道失败任务的重试历史                                              │
│    • 需要知道失败任务依赖哪些已完成任务                                      │
│                                                                             │
│ 3. 【上下文传递】                                                            │
│    • 新Sprint需要读取历史Sprint的执行结果                                    │
│    • Agent需要知道之前的Agent做了什么                                        │
│    • WBS分解需要知道已完成的任务内容                                        │
│                                                                             │
│ 解决方案：PMB (Project Memory Board)                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**PMB vs Agency Context对比**：

| 维度 | Agency Context | PMB |
|-----|---------------|-----|
| 存储位置 | 内存 | YAML文件持久化 |
| 生命周期 | Workflow执行期间 | 跨Session永久保存 |
| 记录内容 | inputs + outputs | 每步执行结果 + 决策依据 |
| 失败支持 | Retry后丢失 | 失败信息持久化 + 重试计数 |
| 历史追溯 | ❌ 无法追溯 | ✅ 完整历史记录 |
| Agent共享 | ⚠️ 同Workflow内 | ✅ 跨Sprint共享 |

### 3.2 pmb.yaml结构设计

```yaml
# PMB (Project Memory Board) 结构设计
# 存储位置: .omt/pmb.yaml
# 设计理念: 记录每个Sprint的完整执行过程

version: "1.0.0"
project_name: "oh-my-terminator"
created_at: "2026-04-28T10:00:00Z"
last_updated: "2026-04-30T18:30:00Z"

# Sprint历史记录（核心）
sprints:
  # Sprint 001 - 成功完成
  - id: sprint_001
    status: completed
    started_at: "2026-04-28T10:00:00Z"
    completed_at: "2026-04-28T16:30:00Z"
    duration_minutes: 390
    
    # Sprint选择的任务
    selected_tasks:
      - task_001
      - task_002
      - task_003
      - task_004
      - task_005
    
    # 任务执行记录
    tasks:
      - id: task_001
        status: completed
        assignee_role: backend-developer
        started_at: "2026-04-28T10:05:00Z"
        completed_at: "2026-04-28T11:30:00Z"
        duration_minutes: 85
        result_summary: "实现了AuthController基础API"
        result_artifact: "src/controllers/AuthController.ts"
        dependencies_used: []
        decision_log:
          - timestamp: "2026-04-28T10:10:00Z"
            decision: "选择JWT认证方案"
            reason: "基于brain.json历史，项目已使用JWT"
      
      - id: task_002
        status: completed
        assignee_role: backend-developer
        started_at: "2026-04-28T11:35:00Z"
        completed_at: "2026-04-28T13:00:00Z"
        duration_minutes: 85
        result_summary: "实现了User模型和数据库schema"
        result_artifact: "src/models/User.ts"
        dependencies_used: [task_001]
        decision_log:
          - timestamp: "2026-04-28T11:40:00Z"
            decision: "使用PostgreSQL而非MongoDB"
            reason: "TSpec指定了PostgreSQL"
      
      - id: task_003
        status: completed
        assignee_role: backend-developer
        started_at: "2026-04-28T13:05:00Z"
        completed_at: "2026-04-28T14:30:00Z"
        duration_minutes: 85
        result_summary: "实现了认证中间件"
        result_artifact: "src/middleware/authMiddleware.ts"
        dependencies_used: [task_001, task_002]
      
      - id: task_004
        status: completed
        assignee_role: qa-agent
        started_at: "2026-04-28T14:35:00Z"
        completed_at: "2026-04-28T15:30:00Z"
        duration_minutes: 55
        result_summary: "编写了认证API单元测试"
        result_artifact: "tests/auth.test.ts"
        dependencies_used: [task_001, task_002, task_003]
      
      - id: task_005
        status: completed
        assignee_role: code-reviewer
        started_at: "2026-04-28T15:35:00Z"
        completed_at: "2026-04-28T16:30:00Z"
        duration_minutes: 55
        result_summary: "代码审查通过，发现2个minor issues已修复"
        result_artifact: "review.json"
        dependencies_used: [task_001, task_002, task_003, task_004]
    
    # Sprint摘要
    sprint_summary:
      tasks_completed: 5
      tasks_failed: 0
      artifacts_created:
        - src/controllers/AuthController.ts
        - src/models/User.ts
        - src/middleware/authMiddleware.ts
        - tests/auth.test.ts
      commit_sha: "abc123def456"
    
    # Gap Analysis结果
    gap_analysis:
      result: ACCEPTED
      analyzed_at: "2026-04-28T17:00:00Z"
      acceptance_criteria_met:
        - "所有API端点已实现"
        - "测试覆盖率达标(85%+)"
        - "代码审查通过"

  # Sprint 002 - 有失败任务但最终完成
  - id: sprint_002
    status: completed
    started_at: "2026-04-29T09:00:00Z"
    completed_at: "2026-04-29T15:00:00Z"
    duration_minutes: 360
    
    selected_tasks:
      - task_006
      - task_007
      - task_008
      - task_009
    
    tasks:
      - id: task_006
        status: completed
        assignee_role: backend-developer
        started_at: "2026-04-29T09:05:00Z"
        completed_at: "2026-04-29T10:30:00Z"
        result_summary: "实现了密码加密逻辑"
        result_artifact: "src/utils/passwordHash.ts"
        dependencies_used: [task_002]
      
      - id: task_007
        status: failed
        assignee_role: backend-developer
        started_at: "2026-04-29T10:35:00Z"
        failed_at: "2026-04-29T11:30:00Z"
        error_message: "数据库连接超时，无法完成集成测试"
        error_type: "INFRASTRUCTURE_ERROR"
        retry_count: 2
        retry_history:
          - retry_at: "2026-04-29T11:35:00Z"
            result: failed
            error: "连接仍然超时"
          - retry_at: "2026-04-29T12:00:00Z"
            result: failed
            error: "连接仍然超时"
        recovery_action: "跳过此任务，进入下一个Sprint"
      
      - id: task_008
        status: completed
        assignee_role: backend-developer
        started_at: "2026-04-29T12:05:00Z"
        completed_at: "2026-04-29T13:30:00Z"
        result_summary: "实现了登录API"
        result_artifact: "src/controllers/LoginController.ts"
        dependencies_used: [task_001, task_006]
      
      - id: task_009
        status: completed
        assignee_role: code-reviewer
        started_at: "2026-04-29T13:35:00Z"
        completed_at: "2026-04-29T15:00:00Z"
        result_summary: "审查通过"
        result_artifact: "review.json"
        dependencies_used: [task_006, task_008]
    
    sprint_summary:
      tasks_completed: 3
      tasks_failed: 1
      commit_sha: "def456ghi789"
    
    gap_analysis:
      result: NEW_MSPEC
      analyzed_at: "2026-04-29T16:00:00Z"
      reason: "task_007失败，需要新的MSpec处理数据库连接问题"
      new_mspec_needed:
        topic: "数据库连接优化"
        priority: HIGH

# 当前活跃状态
current_state:
  active_sprint: null
  last_completed_sprint: sprint_002
  wbs_status:
    total_tasks: 20
    completed_tasks: 8
    failed_tasks: 1
    remaining_tasks: 11

# Agent历史统计
agent_statistics:
  backend-developer:
    total_tasks: 6
    completed: 5
    failed: 1
    avg_duration_minutes: 85
  code-reviewer:
    total_tasks: 2
    completed: 2
    failed: 0
    avg_duration_minutes: 55
  qa-agent:
    total_tasks: 1
    completed: 1
    failed: 0
    avg_duration_minutes: 55
```

### 3.3 中间过程记录机制

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PMB中间过程记录机制                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. 任务执行时的实时记录                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   TaskRunner.execute(task)                                                  │
│       │                                                                     │
│       ├──► 任务开始                                                          │
│       │    PMB.update_task_status(task_id, "in_progress")                  │
│       │    PMB.record_task_start(task_id, timestamp)                       │
│       │                                                                     │
│       ▼                                                                     │
│   Agent执行                                                                  │
│       │                                                                     │
│       ├──► Agent决策                                                         │
│       │    PMB.record_decision(task_id, decision, reason)                  │
│       │                                                                     │
│       ▼                                                                     │
│   任务完成                                                                   │
│       │                                                                     │
│       ├──► 成功                                                              │
│       │    PMB.update_task_status(task_id, "completed")                    │
│       │    PMB.record_task_result(task_id, summary, artifact)              │
│       │    PMB.record_task_duration(task_id, duration)                     │
│       │                                                                     │
│       ├──► 失败                                                              │
│       │    PMB.update_task_status(task_id, "failed")                       │
│       │    PMB.record_task_error(task_id, error_message, error_type)       │
│       │    PMB.increment_retry_count(task_id)                              │
│       │    PMB.record_retry_history(task_id, retry_result)                 │
│       │                                                                     │
│       ▼                                                                     │
│   PMB持久化（每次任务后）                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. 决策日志记录                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Agent执行过程中的关键决策记录：                                              │
│                                                                             │
│   decision_log:                                                             │
│     - timestamp: "2026-04-28T10:10:00Z"                                     │
│       decision: "选择JWT认证方案"                                            │
│       reason: "基于brain.json历史，项目已使用JWT"                            │
│       alternatives_considered:                                              │
│         - "OAuth2.0（成本太高）"                                             │
│         - "Session-based（不适合微服务架构）"                                │
│       confidence: HIGH                                                      │
│                                                                             │
│   记录时机：                                                                  │
│     • 技术选型决策                                                          │
│     • 架构方案决策                                                          │
│     • API设计决策                                                           │
│     • 测试策略决策                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. Sprint结束时的摘要生成                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   omt:review 完成后                                                          │
│       │                                                                     │
│       ├──► PMB.generate_sprint_summary(sprint_id)                          │
│       │    • 统计tasks_completed/tasks_failed                              │
│       │    • 列出artifacts_created                                         │
│       │    • 记录commit_sha                                                 │
│       │    • 计算总duration                                                 │
│       │                                                                     │
│       ▼                                                                     │
│   Gap Analysis执行                                                          │
│       │                                                                     │
│       ├──► PMB.record_gap_analysis(sprint_id, result)                      │
│       │    • 记录ACCEPTED/NEW_MSPEC/FAILED                                  │
│       │    • 记录决策依据                                                   │
│       │    • 如需NEW_MSPEC，记录需求                                        │
│       │                                                                     │
│       ▼                                                                     │
│   PMB持久化                                                                  │
│       │                                                                     │
│       ├──► 更新current_state                                               │
│       │    • 更新last_completed_sprint                                     │
│       │    • 更新wbs_status                                                 │
│       │                                                                     │
│       ▼                                                                     │
│   PMB完成                                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 历史追溯应用场景

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PMB历史追溯应用场景                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 场景1: Gap Analysis验收决策                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Gap Analysis Agent                                                        │
│       │                                                                     │
│       ├──► 读取 PMB.sprints[-1].tasks                                       │
│       │    • 检查每个task的执行结果                                         │
│       │    • 验证artifacts是否符合MSpec                                     │
│       │                                                                     │
│       ├──► 读取 PMB.sprints[-1].gap_analysis                                │
│       │    • 获取上一个Sprint的验收结果                                      │
│       │    • 判断是否需要NEW_MSPEC                                          │
│       │                                                                     │
│       ├──► 决策依据                                                          │
│       │    • tasks_completed == selected_tasks.length → ACCEPTED候选       │
│       │    • 存在failed任务 → 分析失败原因                                   │
│       │    • artifacts对齐检查 → 对齐MSpec design                          │
│       │                                                                     │
│       ▼                                                                     │
│   验收决策输出                                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 场景2: 失败恢复定位                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Sprint失败恢复                                                             │
│       │                                                                     │
│       ├──► 读取 PMB.sprints[-1].tasks                                       │
│       │    • 找到status="failed"的任务                                      │
│       │    • 读取error_message和error_type                                  │
│       │    • 检查retry_count和retry_history                                 │
│       │                                                                     │
│       ├──► 分析失败原因                                                      │
│       │    • INFRASTRUCTURE_ERROR → 检查环境问题                            │
│       │    • IMPLEMENTATION_ERROR → 检查代码问题                            │
│       │    • DEPENDENCY_ERROR → 检查依赖任务                                │
│       │                                                                     │
│       ├──► 决定恢复策略                                                      │
│       │    • retry_count < max_retry → 重试                                │
│       │    • retry_count >= max_retry → 调整MSpec                          │
│       │    • DEPENDENCY_ERROR → 先修复依赖任务                              │
│       │                                                                     │
│       ▼                                                                     │
│   恢复执行                                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 场景3: 新Sprint上下文获取                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   omt:sprint 开始                                                            │
│       │                                                                     │
│       ├──► 读取 PMB.current_state                                           │
│       │    • 获取wbs_status.remaining_tasks                                │
│       │    • 确定还需要执行的任务                                            │
│       │                                                                     │
│       ├──► 读取 PMB.sprints历史                                              │
│       │    • 获取之前Sprint的执行结果                                       │
│       │    • 了解哪些任务已完成                                             │
│       │    • 了解哪些artifacts已创建                                        │
│       │                                                                     │
│       ├──► 构建Sprint上下文                                                  │
│       │    • completed_artifacts → 作为dependencies                        │
│       │    • decision_log → 作为决策参考                                    │
│       │    • sprint_summary → 作为进度参考                                  │
│       │                                                                     │
│       ▼                                                                     │
│   Sprint Selection决策                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 场景4: Agent上下文共享                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Agent A执行完成                                                            │
│       │                                                                     │
│       ├──► PMB记录执行结果                                                   │
│       │    • result_summary                                                 │
│       │    • result_artifact                                                │
│       │    • decision_log                                                   │
│       │                                                                     │
│       ▼                                                                     │
│   Agent B启动（依赖Agent A的任务）                                            │
│       │                                                                     │
│       ├──► 读取 PMB.sprints[-1].tasks[A.task_id]                           │
│       │    • 获取Agent A的执行结果                                          │
│       │    • 理解Agent A的决策依据                                          │
│       │    • 获取dependencies_artifacts                                    │
│       │                                                                     │
│       ▼                                                                     │
│   Agent B拥有完整上下文                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 ASCII架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PMB架构与数据流                                            │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │    PMB.yaml      │
                              │  (持久化存储)     │
                              └──────────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
          ▼                          ▼                          ▼
   ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
   │   sprints   │            │current_state│            │agent_stats  │
   │             │            │             │            │             │
   │ • sprint_id │            │ • active    │            │ • completed │
   │ • tasks     │            │ • wbs_status│            │ • failed    │
   │ • summary   │            │ • last      │            │ • duration  │
   └─────────────┘            └─────────────┘            └─────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                    Sprint任务记录结构                                         │
└─────────────────────────────────────────────────────────────────────────────┘

   sprint_001
       │
       ├── selected_tasks: [task_001, task_002, ...]
       │
       ├── tasks:
       │       │
       │       ├── task_001 ───────────────────────────────────────┐
       │       │    │                                                │
       │       │    ├── status: completed                           │
       │       │    ├── assignee_role: backend-developer            │
       │       │    ├── started_at: timestamp                       │
       │       │    ├── completed_at: timestamp                     │
       │       │    ├── duration_minutes: 85                        │
       │       │    ├── result_summary: "实现了..."                  │
       │       │    ├── result_artifact: path                       │
       │       │    ├── dependencies_used: []                       │
       │       │    │                                                │
       │       │    └──► decision_log:                               │
       │       │         ┌───────────────────────────────────────┐ │
       │       │         │ timestamp: "..."                       │ │
       │       │         │ decision: "选择JWT认证方案"             │ │
       │       │         │ reason: "基于brain.json历史..."        │ │
       │       │         │ alternatives_considered: [...]         │ │
       │       │         │ confidence: HIGH                       │ │
       │       │         └───────────────────────────────────────┘ │
       │       │                                                    │
       │       ├── task_002 ...                                     │
       │       │                                                    │
       │       └──► task_007 (失败任务示例) ─────────────────────────┐
       │            │                                              │
       │            ├── status: failed                              │
       │            ├── error_message: "数据库连接超时"              │
       │            ├── error_type: INFRASTRUCTURE_ERROR            │
       │            ├── retry_count: 2                              │
       │            │                                              │
       │            └──► retry_history:                             │
       │                 ┌───────────────────────────────────────┐ │
       │                 │ - retry_at: "..."                      │ │
       │                 │   result: failed                        │ │
       │                 │   error: "连接仍然超时"                  │ │
       │                 │                                         │ │
       │                 │ - retry_at: "..."                      │ │
       │                 │   result: failed                        │ │
       │                 │   error: "连接仍然超时"                  │ │
       │                 └───────────────────────────────────────┘ │
       │                                                          │
       ├── sprint_summary:
       │       │
       │       ├── tasks_completed: 5
       │       ├── tasks_failed: 0
       │       ├── artifacts_created: [...]
       │       ├── commit_sha: "abc123"
       │
       └── gap_analysis:
               │
               ├── result: ACCEPTED
               ├── analyzed_at: timestamp
               ├── acceptance_criteria_met: [...]


┌─────────────────────────────────────────────────────────────────────────────┐
│                    PMB读写时机完整流程                                         │
└─────────────────────────────────────────────────────────────────────────────┘

  Sprint生命周期 ───────────────────────────────────────────────────────────►

  omt:sprint     TaskRunner      Agent执行      Task完成      omt:review     Gap
      │              │              │              │              │         Analysis
      │              │              │              │              │              │
      ▼              ▼              ▼              ▼              ▼              ▼
 ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
 │ READ    │    │ UPDATE  │    │ RECORD  │    │ WRITE   │    │ UPDATE  │    │ WRITE   │
 │ current │    │ task    │    │ decision│    │ result  │    │ summary │    │ gap     │
 │ _state  │    │ status  │    │ log     │    │ to PMB  │    │ sprint  │    │ result  │
 └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
      │              │              │              │              │              │
      │              │              │              │              │              │
      ▼              ▼              ▼              ▼              ▼              ▼
  获取历史      追踪执行      记录决策      持久化结果      Sprint归档    验收记录
  上下文        进度          依据          artifacts       commit SHA    决策


┌─────────────────────────────────────────────────────────────────────────────┐
│                    PMB与brain.json协同                                        │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │   OMT Session    │
                              └──────────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
          ▼                          ▼                          ▼
   ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
   │ brain.json  │            │  PMB.yaml   │            │ Sprint执行  │
   │             │            │             │            │             │
   │ • repo健康  │◄──────────►│ • Sprint历史│◄──────────►│ • 任务执行  │
   │ • agent状态 │   同步     │ • 任务记录 │   同步     │ • Agent调度 │
   │ • wbs进度   │            │ • 决策日志 │            │ • 结果输出  │
   └─────────────┘            └─────────────┘            └─────────────┘
          │                          │                          │
          │                          │                          │
          ▼                          ▼                          ▼
   ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
   │ 全局状态    │            │ 过程记录    │            │ 实时执行    │
   │ 持久化      │            │ 持久化      │            │ 状态        │
   └─────────────┘            └─────────────┘            └─────────────┘

协同机制：
  • brain.json存储全局状态，PMB存储过程记录
  • Sprint开始时读取两者，结束时更新两者
  • Agent上下文同时包含brain.json和PMB信息
  • 失败恢复时先查PMB定位失败，再查brain.json获取状态
```

---

**Part A 设计完成**

下一步：Batch 2 Part B（章节4-6）将涵盖：
- Chapter 4: Agent生命周期监控
- Chapter 5: Sprint循环机制 + Terminator全自动
- Chapter 6: 自动WBS分解算法

---

**文档信息**
- 文档编号: 08_batch2_partA.md
- 创建日期: 2026-04-30
- 设计范围: 自主创新项 I1-I2 + 必要性分析
- 参考依据: 08_batch1_diff_analysis.md