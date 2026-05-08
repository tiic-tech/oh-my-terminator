# OMT Git颗粒度策略 + Scope约束机制

**设计日期**: 2026-05-01
**设计目标**: 定义Git分支层级、提交粒度、Scope约束阈值，实现可推进/失败/回滚/验证的系统

---

## 1. 概述

本文档定义Oh-My-Terminator (OMT) 项目的Git操作策略，包括：

- **分支层级设计**: 多级分支策略，匹配OMT层级结构
- **Tag策略**: 验收锚点标记，支持版本追溯和回滚
- **提交粒度**: 以Sprint为atomic change unit，避免过细粒度
- **Scope约束**: 防止MSpec拆解失控的阈值机制
- **Worktree策略**: 并行开发隔离机制

---

## 2. Git分支层级设计

### 2.1 分支命名规范

| 分支类型 | 命名格式 | 用途 | 生命周期 |
|---------|---------|------|---------|
| main | `main` | 主分支（stable） | 永久 |
| feat/mspec | `feat/mspec_<id>` | MSpec功能开发 | MSpec周期 |
| sprint | `sprint/<num>` | Sprint子分支 | Sprint周期 |
| hotfix | `hotfix/<id>` | 紧急修复 | 临时 |
| experiment | `exp/<id>` | 实验性开发 | 临时 |

**命名示例**:
```
main                          # 主分支
feat/mspec_001                # MSpec_001功能分支
feat/mspec_002                # MSpec_002功能分支
sprint/s001_m001              # Sprint_001 (属于MSpec_001)
sprint/s002_m001              # Sprint_002 (属于MSpec_001)
hotfix/h001_auth_jwt          # 紧急修复JWT问题
exp/e001_ai_prompt_tuning     # AI prompt调优实验
```

### 2.2 分支创建时机

```typescript
interface BranchCreationPolicy {
  // MSpec分支创建
  mspecBranch: {
    trigger: 'MSpec开始执行';
    parent: 'main';
    naming: 'feat/mspec_<id>';
    conditions: ['MSpec状态变为IN_PROGRESS'];
  };
  
  // Sprint分支创建
  sprintBranch: {
    trigger: 'Sprint开始执行';
    parent: 'feat/mspec_<id>';
    naming: 'sprint/<num>';
    conditions: ['Sprint复杂度 >= SPRINT_COMPLEXITY_THRESHOLD'];
  };
  
  // 热修复分支
  hotfixBranch: {
    trigger: '紧急问题发现';
    parent: 'main';
    naming: 'hotfix/<id>';
    conditions: ['问题优先级为CRITICAL'];
  };
}
```

**Sprint分支创建阈值**:
```
SPRINT_COMPLEXITY_THRESHOLD = {
  atomTaskCount: 10,     // AtomTask数量 >= 10
  estimatedDuration: '4h', // 预估时长 >= 4小时
  riskLevel: 'medium',   // 风险等级 >= medium
}
```

### 2.3 分支合并时机

| 源分支 | 目标分支 | 合并时机 | 合并方式 |
|-------|---------|---------|---------|
| sprint/<num> | feat/mspec_<id> | Sprint验收通过 | Squash merge |
| feat/mspec_<id> | main | MSpec验收通过 | PR merge |
| hotfix/<id> | main | 修复验证通过 | PR merge |
| exp/<id> | feat/mspec_<id> | 实验成功 | Cherry-pick |

**合并策略说明**:
- **Squash merge**: 将Sprint多个commit压缩为单个atomic commit
- **PR merge**: 通过Pull Request流程，触发CI验证
- **Cherry-pick**: 选择性合并实验成功的提交

### 2.4 ASCII分支层级图

```
                    ┌─────────────────────────────────────────┐
                    │              main (stable)              │
                    │   [tag: stable/tspec_<id>]              │
                    └─────────────────┬───────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
    ┌─────────▼─────────┐   ┌─────────▼─────────┐   ┌─────────▼─────────┐
    │ feat/mspec_001    │   │ feat/mspec_002    │   │ feat/mspec_003    │
    │ [tag: milestone]  │   │                   │   │                   │
    └─────────┬─────────┘   └─────────┬─────────┘   └─────────┬─────────┘
              │                       │                       │
    ┌─────────┼─────────┐             │             ┌─────────┼─────────┐
    │         │         │             │             │         │         │
┌───▼───┐ ┌───▼───┐ ┌───▼───┐         │         ┌───▼───┐ ┌───▼───┐ ┌───▼───┐
│s001  │ │s002  │ │s003  │         │         │s004  │ │s005  │ │s006  │
│_m001 │ │_m001 │ │_m001 │         │         │_m002 │ │_m002 │ │_m002 │
└───┬───┘ └───┬───┘ └───┬───┘         │         └───┬───┘ └───┬───┘ └───┬───┘
    │         │         │             │             │         │         │
    │ Squash  │ Squash  │ Squash      │             │ Squash  │ Squash  │ Squash
    │ merge   │ merge   │ merge       │             │ merge   │ merge   │ merge
    │         │         │             │             │         │         │
┌───▼─────────▼─────────▼───┐         │         ┌───▼─────────▼─────────▼───┐
│  feat/mspec_001 (updated) │         │         │  feat/mspec_002 (updated) │
└───────────────────────────┘         │         └───────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
            ┌───────▼───────┐ ┌───────▼───────┐ ┌───────▼───────┐
            │  PR merge     │ │  PR merge     │ │  PR merge     │
            │  (CI verify)  │ │  (CI verify)  │ │  (CI verify)  │
            └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
                    │                 │                 │
            ┌───────▼─────────────────▼─────────────────▼───────┐
            │                 main (stable)                    │
            │         [tag: stable/tspec_<id>]                 │
            └──────────────────────────────────────────────────┘

生命周期说明:
─────────────────────────────────────────────────────────────────
1. MSpec开始 → 创建feat/mspec_<id>
2. Sprint开始(复杂度>=阈值) → 创建sprint/<num>
3. Sprint完成 → squash merge回feat/mspec_<id>
4. MSpec完成 → PR merge到main
5. TSpec验收 → 打stable tag
─────────────────────────────────────────────────────────────────
```

---

## 3. Tag策略设计

### 3.1 Tag类型

| Tag类型 | 前缀 | 格式 | 用途 | 必需性 |
|--------|------|-----|------|-------|
| stable | `stable/` | `stable/tspec_<id>` | TSpec验收锚点 | **必须** |
| milestone | `milestone/` | `milestone/mspec_<id>_v<n>` | MSpec中间版本 | 可选 |
| release | `release/` | `release/v<semver>` | 正式发布版本 | 可选 |
| rollback | `rollback/` | `rollback/<id>` | 回滚标记 | 临时 |

**Tag命名示例**:
```
stable/tspec_001              # TSpec_001验收通过
stable/tspec_002              # TSpec_002验收通过
milestone/mspec_001_v1        # MSpec_001第一次里程碑
milestone/mspec_001_v2        # MSpec_001第二次里程碑
release/v1.0.0                # 1.0.0正式发布
rollback/r001_failed_auth    # 认证失败回滚标记
```

### 3.2 Tag触发时机

```typescript
interface TagTriggerPolicy {
  stableTag: {
    trigger: 'TSpec验收通过';
    conditions: [
      '所有MSpec已完成',
      '所有验收测试通过',
      '文档已更新'
    ];
    action: 'git tag stable/tspec_<id> main';
    postAction: [
      '推送到远程仓库',
      '更新PMB记录',
      '生成验收报告'
    ];
  };
  
  milestoneTag: {
    trigger: 'MSpec里程碑达成';
    conditions: [
      'MSpec进度 >= 50%',
      '关键功能已实现',
      'MSpec负责人确认'
    ];
    action: 'git tag milestone/mspec_<id>_v<n> feat/mspec_<id>';
    postAction: ['可选推送到远程'];
  };
  
  releaseTag: {
    trigger: '产品发布';
    conditions: [
      '至少一个TSpec完成',
      '产品经理确认',
      '发布说明已编写'
    ];
    action: 'git tag release/v<semver> main';
    postAction: [
      '推送到远程',
      '创建GitHub Release',
      '通知相关方'
    ];
  };
}
```

### 3.3 Tag用途矩阵

| 用途 | stable tag | milestone tag | release tag |
|-----|-----------|---------------|-------------|
| **快速定位** | ✅ 已验收版本 | ✅ 中间版本 | ✅ 发布版本 |
| **回滚锚点** | ✅ 安全回滚点 | ⚠️ 可选回滚 | ✅ 发布回滚 |
| **版本追溯** | ✅ TSpec追溯 | ✅ MSpec追溯 | ✅ 产品追溯 |
| **CI触发** | ✅ 发布流水线 | ❌ 不触发 | ✅ 发布流水线 |
| **验收证明** | ✅ 完整验收 | ⚠️ 部分验收 | ✅ 发布验收 |

---

## 4. 提交粒度设计

### 4.1 提交层级策略

```
┌─────────────────────────────────────────────────────────────────┐
│                     OMT提交粒度层级                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  层级              策略                说明                      │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  AtomTask         不单独commit          太细粒度                 │
│                   (仅作为Sprint的       不利于回滚               │
│                   atomic change的       不利于追溯               │
│                   组成部分)                                     │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Sprint           ✅ atomic commit       最佳粒度                │
│                   (Sprint完成时提交)     便于回滚                 │
│                   包含所有AtomTask      便于追溯                 │
│                   作为atomic change     便于审计                 │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  MSpec            不单独commit          通过PR merge             │
│                   (通过feat/mspec_<id>  PR包含多个               │
│                   分支的PR merge)       Sprint commits           │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  TSpec            不单独commit          验收标记                 │
│                   (通过stable tag       不是代码提交             │
│                   标记验收完成)         是版本锚点               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Commit Message格式

**OMT专用格式**:
```
<type>: <scope> - <description>

[type: feat|fix|refactor|test|docs|chore|perf|ci]
[scope: sprint_<num>|mspec_<id>|tspec_<id>]
[description: 简明描述，不超过50字符]

[optional body]
- 详细说明变更内容
- 列出关键AtomTask
- 关联的MSpec/TSpec ID

[optional footer]
Co-Authored-By: <agent-name> <agent-type>
```

**Commit Message示例**:

```bash
# Sprint完成提交
feat: sprint_001_m001 - 实现用户认证核心API

变更内容:
- AtomTask_001: JWT token生成逻辑
- AtomTask_002: 用户登录验证
- AtomTask_003: Session管理

关联: MSpec_001 (用户认证模块)

Co-Authored-By: planner agent

---

# Sprint修复提交
fix: sprint_003_m002 - 修复JWT token过期问题

问题:
- Token过期时间计算错误
- 刷新token逻辑缺失

修复:
- AtomTask_010: 修正过期时间公式
- AtomTask_011: 添加refresh token流程

关联: MSpec_002 (Token管理)

---

# 文档更新
docs: sprint_005_m001 - 更新API文档

变更:
- AtomTask_020: 补充认证API说明
- AtomTask_021: 添加错误码列表

关联: MSpec_001
```

### 4.3 Commit Hook设计

```typescript
interface CommitHookPolicy {
  preCommit: {
    checks: [
      '运行单元测试',
      '执行lint检查',
      '验证commit message格式',
      '检查敏感信息泄露'
    ];
    onFailure: '阻止提交，显示错误详情';
    timeout: 60000; // 60秒
  };
  
  postCommit: {
    actions: [
      '更新PMB记录',
      '推送AtomTask完成状态',
      '通知相关Agent',
      '触发CI构建(可选)'
    ];
    asyncExecution: true; // 异步执行，不阻塞提交
  };
  
  commitMsgHook: {
    validation: {
      typePattern: '^(feat|fix|refactor|test|docs|chore|perf|ci)$',
      scopePattern: '^(sprint_|mspec_|tspec_)[a-z0-9_]+$',
      descriptionMaxLength: 50,
      requiredFields: ['type', 'scope', 'description']
    };
    onInvalid: '拒绝提交，提示正确格式';
  };
}
```

**Hook脚本示例**:

```bash
#!/bin/bash
# .git/hooks/pre-commit

# 1. 运行单元测试
echo "Running unit tests..."
npm test -- --coverageThreshold=80
if [ $? -ne 0 ]; then
  echo "❌ Unit tests failed. Commit blocked."
  exit 1
fi

# 2. 执行lint检查
echo "Running lint checks..."
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ Lint errors found. Commit blocked."
  exit 1
fi

# 3. 验证commit message格式
# (通过commit-msg hook实现)
echo "✅ Pre-commit checks passed."
exit 0
```

---

## 5. Scope约束机制

### 5.1 拆解阈值设计

**大项目估算公式**:
```
预估总atom_tasks = 项目复杂度评估得分
最小MSpec数量 = ceil(预估总atom_tasks / maxAtomTasksPerMSpec)
```

**阈值配置**:
```typescript
interface ScopeConstraints {
  // MSpec约束阈值
  maxAtomTasksPerMSpec: number;     // 单个MSpec最大AtomTask数量
                                    // 默认: 50
  
  maxSprintsPerMSpec: number;       // 单个MSpec最大Sprint数量
                                    // 默认: 5
  
  maxEstimatedDuration: string;     // 单个MSpec最大预估时长
                                    // 默认: '2d' (2天)
  
  // 大项目识别阈值
  minMSpecsForLargeProject: number; // 大型项目最小MSpec数量
                                    // 默认: 20
  
  largeProjectAtomThreshold: number; // 大型项目AtomTask阈值
                                     // 默认: 1000
  
  // Sprint约束阈值
  maxAtomTasksPerSprint: number;    // 单个Sprint最大AtomTask数量
                                    // 默认: 10
  
  minAtomTasksPerSprint: number;    // 单个Sprint最小AtomTask数量
                                    // 默认: 1
  
  sprintDurationRange: {            // Sprint时长范围
    min: string;                    // 默认: '30m'
    max: string;                    // 默认: '4h'
  };
}

const DEFAULT_SCOPE_CONSTRAINTS: ScopeConstraints = {
  maxAtomTasksPerMSpec: 50,
  maxSprintsPerMSpec: 5,
  maxEstimatedDuration: '2d',
  minMSpecsForLargeProject: 20,
  largeProjectAtomThreshold: 1000,
  maxAtomTasksPerSprint: 10,
  minAtomTasksPerSprint: 1,
  sprintDurationRange: {
    min: '30m',
    max: '4h'
  }
};
```

### 5.2 Scope验证机制

**TSpec→MSpec转换验证**:

```typescript
interface ScopeValidationResult {
  valid: boolean;
  warning?: string;
  error?: string;
  current: number;
  recommended?: number;
  suggestion?: string;
}

function validateMSpecScope(tspec: TSpec): ScopeValidationResult {
  const estimatedTasks = estimateTotalAtomTasks(tspec);
  const recommendedMSpecCount = Math.ceil(
    estimatedTasks / MAX_ATOM_TASKS_PER_MSPEC
  );
  
  // 检查MSpec数量
  if (tspec.mspecs.length < recommendedMSpecCount) {
    return {
      valid: false,
      warning: `建议增加MSpec数量至${recommendedMSpecCount}`,
      current: tspec.mspecs.length,
      recommended: recommendedMSpecCount,
      suggestion: '细化功能模块拆分'
    };
  }
  
  // 检查大项目识别
  if (estimatedTasks >= LARGE_PROJECT_ATOM_THRESHOLD) {
    if (tspec.mspecs.length < MIN_MSPECS_FOR_LARGE_PROJECT) {
      return {
        valid: false,
        error: `大型项目(${estimatedTasks} AtomTasks)需要至少${MIN_MSPECS_FOR_LARGE_PROJECT}个MSpec`,
        current: tspec.mspecs.length,
        recommended: MIN_MSPECS_FOR_LARGE_PROJECT
      };
    }
  }
  
  // 检查MSpec均匀分布
  const avgTasksPerMSpec = estimatedTasks / tspec.mspecs.length;
  if (avgTasksPerMSpec > MAX_ATOM_TASKS_PER_MSPEC * 0.8) {
    return {
      valid: true,
      warning: `MSpec平均任务数(${avgTasksPerMSpec})接近阈值`,
      current: avgTasksPerMSpec
    };
  }
  
  return { valid: true, current: tspec.mspecs.length };
}
```

### 5.3 WBS验证机制

**MSpec→WBS转换验证**:

```typescript
interface WBSScopeValidationResult extends ScopeValidationResult {
  atomTaskCount: number;
  sprintCount: number;
  estimatedDuration: string;
}

function validateWBScope(mspec: MSpec): WBSScopeValidationResult {
  const atomTaskCount = mspec.wbs.atomTasks.length;
  const sprintCount = mspec.wbs.sprints.length;
  const estimatedDuration = calculateTotalDuration(mspec.wbs);
  
  // 检查AtomTask数量阈值
  if (atomTaskCount > MAX_ATOM_TASKS_PER_MSPEC) {
    return {
      valid: false,
      error: `MSpec拆解超过阈值(${MAX_ATOM_TASKS_PER_MSPEC})`,
      atomTaskCount,
      sprintCount,
      estimatedDuration,
      suggestion: '拆分为多个MSpec'
    };
  }
  
  // 检查Sprint数量阈值
  if (sprintCount > MAX_SPRINTS_PER_MSPEC) {
    return {
      valid: false,
      error: `Sprint数量超过阈值(${MAX_SPRINTS_PER_MSPEC})`,
      atomTaskCount,
      sprintCount,
      estimatedDuration,
      suggestion: '优化Sprint粒度或拆分MSpec'
    };
  }
  
  // 检查预估时长
  const durationHours = parseDuration(estimatedDuration);
  const maxDurationHours = parseDuration(MAX_ESTIMATED_DURATION);
  
  if (durationHours > maxDurationHours) {
    return {
      valid: false,
      error: `预估时长(${estimatedDuration})超过阈值(${MAX_ESTIMATED_DURATION})`,
      atomTaskCount,
      sprintCount,
      estimatedDuration,
      suggestion: '拆分为多个MSpec'
    };
  }
  
  // 检查Sprint平均任务数
  const avgTasksPerSprint = atomTaskCount / sprintCount;
  if (avgTasksPerSprint > MAX_ATOM_TASKS_PER_SPRINT) {
    return {
      valid: true,
      warning: `Sprint平均任务数(${avgTasksPerSprint})偏高`,
      atomTaskCount,
      sprintCount,
      estimatedDuration,
      suggestion: '考虑增加Sprint数量'
    };
  }
  
  return {
    valid: true,
    atomTaskCount,
    sprintCount,
    estimatedDuration
  };
}
```

### 5.4 验证时机矩阵

| 验证点 | 验证内容 | 验证函数 | 失败处理 |
|-------|---------|---------|---------|
| TSpec→MSpec | MSpec数量合理性 | validateMSpecScope | 阻止转换，提示拆分 |
| MSpec→WBS | AtomTask/Sprint数量 | validateWBScope | 阻止WBS生成，提示拆分 |
| Sprint→AtomTask | Sprint粒度 | validateSprintScope | 警告，不阻止 |
| Sprint完成 | 实际vs预估对比 | validateExecutionScope | 记录偏差，调整阈值 |

---

## 6. Worktree使用策略

### 6.1 Worktree触发条件

```typescript
interface WorktreeTriggerPolicy {
  // 并行开发触发
  parallelDevelopment: {
    condition: '同时开发多个MSpec';
    threshold: '>= 2 MSpecs同时IN_PROGRESS';
    example: 'MSpec_001 + MSpec_002并行开发';
  };
  
  // 失败恢复实验触发
  failureRecovery: {
    condition: 'Sprint失败需实验修复';
    threshold: 'Sprint失败次数 >= 2';
    example: 'Sprint_003失败，创建exp_001隔离实验';
  };
  
  // 紧急修复触发
  hotfixIsolation: {
    condition: '生产环境紧急问题';
    threshold: '问题优先级 = CRITICAL';
    example: '认证系统崩溃，创建hotfix_001';
  };
  
  // 代码审查隔离触发
  reviewIsolation: {
    condition: '大型重构审查';
    threshold: '重构范围 >= 3 files';
    example: '架构重构，创建review_001';
  };
}
```

### 6.2 Worktree命名规范

```
Worktree路径结构:
.omt/worktrees/<type>/<id>/

类型命名:
- parallel: 并行开发
- exp: 实验隔离
- hotfix: 紧急修复
- review: 代码审查

示例:
.omt/worktrees/parallel/mspec_001/    # MSpec_001并行开发
.omt/worktrees/parallel/mspec_002/    # MSpec_002并行开发
.omt/worktrees/exp/exp_001/           # 实验隔离
.omt/worktrees/hotfix/h001_auth/      # 紧急修复
.omt/worktrees/review/r001_arch/      # 代码审查
```

### 6.3 Worktree生命周期

```
┌─────────────────────────────────────────────────────────────────┐
│                  Worktree生命周期                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 创建阶段                                                     │
│     git worktree add .omt/worktrees/<id> feat/mspec_<id>        │
│     - 检查分支是否存在                                           │
│     - 创建worktree目录                                           │
│     - 初始化环境                                                 │
│                                                                 │
│  2. 使用阶段                                                     │
│     cd .omt/worktrees/<id>                                       │
│     - 在隔离目录执行开发                                         │
│     - 独立的git操作                                              │
│     - 独立的测试环境                                             │
│                                                                 │
│  3. 完成阶段                                                     │
│     git commit -m "feat: sprint_<num>_<mspec> - ..."            │
│     git push origin feat/mspec_<id>                              │
│     - 提交变更                                                   │
│     - 推送到远程                                                 │
│                                                                 │
│  4. 合并阶段                                                     │
│     cd <main_project>                                            │
│     git merge feat/mspec_<id>  (或通过PR)                        │
│     - 合并回主分支                                               │
│     - 执行CI验证                                                 │
│                                                                 │
│  5. 清理阶段                                                     │
│     git worktree remove .omt/worktrees/<id>                      │
│     git branch -d feat/mspec_<id>  (可选)                        │
│     - 删除worktree目录                                           │
│     - 清理分支                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.4 Worktree操作命令参考

```bash
# 创建worktree
git worktree add .omt/worktrees/parallel/mspec_001 feat/mspec_001

# 查看所有worktree
git worktree list

# 在worktree中工作
cd .omt/worktrees/parallel/mspec_001
npm install  # 初始化环境
npm test     # 运行测试

# 提交变更
git add .
git commit -m "feat: sprint_001_m001 - 实现认证API"

# 推送到远程
git push origin feat/mspec_001

# 返回主项目
cd <main_project_path>

# 合并变更
git merge feat/mspec_001 --squash
git commit -m "feat: mspec_001 - 用户认证模块完成"

# 清理worktree
git worktree remove .omt/worktrees/parallel/mspec_001

# 清理分支(如果不再需要)
git branch -d feat/mspec_001
```

---

## 7. TypeScript接口定义

### 7.1 Git策略接口

```typescript
/**
 * Git分支策略
 */
interface GitBranchStrategy {
  // 分支类型定义
  branchTypes: Map<BranchType, BranchDefinition>;
  
  // 分支命名规则
  namingConvention: {
    pattern: string;
    examples: string[];
    validation: RegExp;
  };
  
  // 创建策略
  creationPolicy: BranchCreationPolicy;
  
  // 合并策略
  mergePolicy: BranchMergePolicy;
  
  // 清理策略
  cleanupPolicy: {
    autoDeleteAfterMerge: boolean;
    preserveDays: number;
    protectedBranches: string[];
  };
}

interface BranchDefinition {
  type: BranchType;
  namingPattern: string;
  parentBranch: BranchType;
  lifecycle: 'permanent' | 'temporary' | 'conditional';
  mergeTarget: BranchType;
  protectionLevel: 'protected' | 'unprotected';
}

type BranchType = 'main' | 'feat_mspec' | 'sprint' | 'hotfix' | 'experiment';

interface BranchMergePolicy {
  sprintToMspec: {
    method: 'squash';
    requireReview: boolean;
    triggerCI: boolean;
  };
  
  mspecToMain: {
    method: 'pr';
    requireReview: true;
    triggerCI: true;
    approvalsRequired: number;
  };
  
  hotfixToMain: {
    method: 'pr';
    requireReview: true;
    priority: 'urgent';
  };
}
```

### 7.2 Git提交策略接口

```typescript
/**
 * Git提交策略
 */
interface GitCommitStrategy {
  // 提交粒度层级
  granularityLevels: GranularityLevel[];
  
  // Commit message格式
  messageFormat: CommitMessageFormat;
  
  // Hook策略
  hookPolicy: CommitHookPolicy;
  
  // 提交频率约束
  frequencyConstraint: {
    maxCommitsPerSprint: number;
    minCommitsPerSprint: number;
    recommendedInterval: string;
  };
}

interface GranularityLevel {
  level: 'AtomTask' | 'Sprint' | 'MSpec' | 'TSpec';
  policy: 'no-commit' | 'atomic-commit' | 'merge-only' | 'tag-only';
  rationale: string;
}

interface CommitMessageFormat {
  pattern: string;
  typeOptions: CommitType[];
  scopePattern: string;
  descriptionRules: {
    maxLength: number;
    language: 'zh' | 'en';
    style: 'imperative' | 'descriptive';
  };
  requiredFooter: string[];
}

type CommitType = 'feat' | 'fix' | 'refactor' | 'test' | 'docs' | 'chore' | 'perf' | 'ci';
```

### 7.3 Git Tag策略接口

```typescript
/**
 * Git Tag策略
 */
interface GitTagStrategy {
  // Tag类型定义
  tagTypes: Map<TagType, TagDefinition>;
  
  // 触发策略
  triggerPolicy: TagTriggerPolicy;
  
  // 用途矩阵
  usageMatrix: TagUsageMatrix;
  
  // 版本命名规则
  versionNaming: {
    stableFormat: string;
    milestoneFormat: string;
    releaseFormat: string;  // SemVer
  };
}

interface TagDefinition {
  type: TagType;
  prefix: string;
  format: string;
  required: boolean;
  trigger: string;
  targetBranch: BranchType;
}

type TagType = 'stable' | 'milestone' | 'release' | 'rollback';

interface TagUsageMatrix {
  quickLocate: Map<TagType, boolean>;
  rollbackAnchor: Map<TagType, boolean>;
  versionTrace: Map<TagType, boolean>;
  ciTrigger: Map<TagType, boolean>;
  acceptanceProof: Map<TagType, boolean>;
}
```

### 7.4 Worktree策略接口

```typescript
/**
 * Git Worktree策略
 */
interface GitWorktreeStrategy {
  // 触发条件
  triggerPolicy: WorktreeTriggerPolicy;
  
  // 命名规范
  namingConvention: {
    basePath: string;  // .omt/worktrees/
    typePrefixes: Map<string, string>;
  };
  
  // 生命周期管理
  lifecycle: {
    creation: WorktreeCreationStep[];
    usage: WorktreeUsageStep[];
    completion: WorktreeCompletionStep[];
    cleanup: WorktreeCleanupStep[];
  };
  
  // 并发限制
  concurrencyLimit: {
    maxParallelWorktrees: number;
    resourceQuota: {
      diskSpace: string;
      memory: string;
    };
  };
}

interface WorktreeCreationStep {
  step: number;
  command: string;
  validation: string[];
  onError: string;
}
```

### 7.5 Scope约束接口

```typescript
/**
 * Scope约束配置
 */
interface ScopeConstraints {
  // MSpec约束
  maxAtomTasksPerMSpec: number;
  maxSprintsPerMSpec: number;
  maxEstimatedDuration: string;
  
  // 大项目识别
  minMSpecsForLargeProject: number;
  largeProjectAtomThreshold: number;
  
  // Sprint约束
  maxAtomTasksPerSprint: number;
  minAtomTasksPerSprint: number;
  sprintDurationRange: {
    min: string;
    max: string;
  };
}

/**
 * Scope验证结果
 */
interface ScopeValidationResult {
  valid: boolean;
  warning?: string;
  error?: string;
  current: number;
  recommended?: number;
  suggestion?: string;
}

/**
 * WBS验证结果
 */
interface WBSScopeValidationResult extends ScopeValidationResult {
  atomTaskCount: number;
  sprintCount: number;
  estimatedDuration: string;
}

/**
 * 验证策略
 */
interface ScopeValidationPolicy {
  // 验证时机
  validationPoints: ValidationPoint[];
  
  // 验证函数映射
  validators: Map<ValidationPoint, ValidatorFunction>;
  
  // 失败处理策略
  failureHandling: Map<ValidationPoint, FailureAction>;
}

type ValidationPoint = 
  | 'TSpec_to_MSpec'
  | 'MSpec_to_WBS'
  | 'Sprint_to_AtomTask'
  | 'Sprint_completion';

type ValidatorFunction = 
  | typeof validateMSpecScope
  | typeof validateWBScope
  | typeof validateSprintScope
  | typeof validateExecutionScope;

type FailureAction = 'block' | 'warn' | 'log';
```

---

## 8. ASCII流程图

### 8.1 Git分支生命周期流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                Git分支生命周期完整流程                            │
└─────────────────────────────────────────────────────────────────┘

                    ┌──────────────────┐
                    │   TSpec开始      │
                    └────────────┬─────┘
                                 │
                                 ▼
                    ┌──────────────────┐
                    │ 估算AtomTask数量  │
                    └────────────┬─────┘
                                 │
                                 ▼
              ┌──────────────────────────────────┐
              │ Scope验证: validateMSpecScope()  │
              └────────────┬─────────────────────┘
                           │
               ┌───────────┴───────────┐
               │                       │
          ┌────▼────┐            ┌─────▼─────┐
          │ 验证通过 │            │ 验证失败  │
          └────┬────┘            └─────┬─────┘
               │                       │
               ▼                       ▼
    ┌──────────────────┐    ┌──────────────────┐
    │ 创建MSpec分支     │    │ 调整MSpec数量     │
    │ feat/mspec_<id>  │    │ (重新拆分)        │
    └────────────┬─────┘    └──────────────────┘
                 │
                 ▼
    ┌──────────────────┐
    │   MSpec开始      │
    └────────────┬─────┘
                 │
                 ▼
    ┌──────────────────┐
    │ 生成WBS          │
    └────────────┬─────┘
                 │
                 ▼
              ┌──────────────────────────────────┐
              │ Scope验证: validateWBScope()     │
              └────────────┬─────────────────────┘
                           │
               ┌───────────┴───────────┐
               │                       │
          ┌────▼────┐            ┌─────▼─────┐
          │ 验证通过 │            │ 验证失败  │
          └────┬────┘            └─────┬─────┘
               │                       │
               ▼                       ▼
    ┌──────────────────┐    ┌──────────────────┐
    │ Sprint规划        │    │ 调整WBS          │
    └────────────┬─────┘    │ (拆分Sprint)     │
                 │          └──────────────────┘
                 ▼
    ┌──────────────────────────────────┐
    │ Sprint复杂度评估                  │
    └────────────┬─────────────────────┘
                 │
       ┌─────────┴─────────┐
       │                   │
  ┌────▼────┐        ┌─────▼─────┐
  │ >=阈值  │        │  <阈值    │
  └────┬────┘        └─────┬─────┘
       │                   │
       ▼                   ▼
┌──────────────────┐ ┌──────────────────┐
│ 创建Sprint分支    │ │ 直接在MSpec分支 │
│ sprint/<num>     │ │ 开发            │
└────────┬─────────┘ └────────┬─────────┘
         │                    │
         ▼                    │
┌──────────────────┐          │
│ Sprint开发        │          │
│ (隔离环境)        │          │
└────────┬─────────┘          │
         │                    │
         └────────────────────┘
                 │
                 ▼
    ┌──────────────────┐
    │ Sprint完成        │
    │ (AtomTask执行)    │
    └────────────┬─────┘
                 │
                 ▼
    ┌──────────────────┐
    │ Sprint验收        │
    └────────────┬─────┘
                 │
       ┌─────────┴─────────┐
       │                   │
  ┌────▼────┐        ┌─────▼─────┐
  │ 通过    │        │ 失败      │
  └────┬────┘        └─────┬─────┘
       │                   │
       ▼                   ▼
┌──────────────────┐ ┌──────────────────┐
│ Sprint commit     │ │ 失败分析         │
│ (atomic change)   │ │ 创建实验分支     │
└────────┬─────────┘ │ exp/<id>         │
         │           └──────────────────┘
         │                   │
         ▼                   ▼
┌──────────────────┐ ┌──────────────────┐
│ Squash merge     │ │ 实验修复         │
│ 回feat/mspec_<id>│ │ 验证通过         │
└────────┬─────────┘ └────────┬─────────┘
         │                    │
         └────────────────────┘
                 │
                 ▼
    ┌──────────────────┐
    │ 所有Sprint完成?  │
    └────────────┬─────┘
                 │
       ┌─────────┴─────────┐
       │                   │
  ┌────▼────┐        ┌─────▼─────┐
  │ 否      │        │ 是        │
  └────┬────┘        └─────┬─────┘
       │                   │
       ▼                   ▼
┌──────────────────┐ ┌──────────────────┐
│ 下一Sprint        │ │ MSpec完成        │
└──────────────────┘ └────────┬─────────┘
                           │
                           ▼
              ┌──────────────────┐
              │ 创建PR           │
              │ feat/mspec_<id>  │
              │ → main           │
              └────────────┬─────┘
                           │
                           ▼
              ┌──────────────────┐
              │ CI验证           │
              └────────────┬─────┘
                           │
               ┌───────────┴───────────┐
               │                       │
          ┌────▼────┐            ┌─────▼─────┐
          │ 通过    │            │ 失败      │
          └────┬────┘            └─────┬─────┘
               │                       │
               ▼                       ▼
    ┌──────────────────┐    ┌──────────────────┐
    │ PR merge到main    │    │ 修复问题         │
    └────────────┬─────┘    │ (回到feat分支)   │
                 │          └──────────────────┘
                 ▼
    ┌──────────────────┐
    │ 所有MSpec完成?   │
    └────────────┬─────┘
                 │
       ┌─────────┴─────────┐
       │                   │
  ┌────▼────┐        ┌─────▼─────┐
  │ 否      │        │ 是        │
  └────┬────┘        └─────┬─────┘
       │                   │
       ▼                   ▼
┌──────────────────┐ ┌──────────────────┐
│ 下一MSpec         │ │ TSpec验收        │
└──────────────────┘ └────────┬─────────┘
                           │
                           ▼
              ┌──────────────────┐
              │ 打stable tag     │
              │ stable/tspec_<id>│
              └────────────┬─────┘
                           │
                           ▼
              ┌──────────────────┐
              │ TSpec完成        │
              └──────────────────┘
```

### 8.2 Scope约束验证流程图

```
┌─────────────────────────────────────────────────────────────────┐
│               Scope约束验证流程                                   │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────┐
│          输入: 项目需求           │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│     Step 1: TSpec复杂度评估       │
│     - 功能点分析                  │
│     - 技术难度评估                │
│     - 依赖关系梳理                │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│     Step 2: AtomTask估算          │
│     预估总atom_tasks = 复杂度得分  │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│     Step 3: 大项目识别            │
│     预估tasks >= LARGE_THRESHOLD? │
└────────────┬─────────────────────┘
             │
   ┌─────────┴─────────┐
   │                   │
┌──▼──┐           ┌────▼────┐
│ 是  │           │ 否      │
└──┬──┘           └────┬────┘
   │                   │
   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐
│ 大项目策略        │ │ 常规项目策略     │
│ minMSpecs = 20   │ │ minMSpecs =      │
│                  │ │ ceil(tasks/50)   │
└────────┬─────────┘ └────────┬─────────┘
         │                    │
         └────────────────────┘
                 │
                 ▼
┌──────────────────────────────────┐
│     Step 4: TSpec→MSpec转换       │
│     验证: validateMSpecScope()    │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│     检查MSpec数量                 │
│     mspecs.length >= recommended? │
└────────────┬─────────────────────┘
             │
   ┌─────────┴─────────┐
   │                   │
┌──▼──┐           ┌────▼────┐
│ 通过│           │ 失败    │
└──┬──┘           └────┬────┘
   │                   │
   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐
│ 继续MSpec规划     │ │ 强制拆分MSpec    │
│                  │ │ 调整至推荐数量    │
└────────┬─────────┘ └──────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│     Step 5: MSpec→WBS转换         │
│     验证: validateWBScope()       │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│     检查AtomTask数量              │
│     atomTasks <= MAX_PER_MSPEC?   │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│     检查Sprint数量                │
│     sprints <= MAX_PER_MSPEC?     │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│     检查预估时长                  │
│     duration <= MAX_DURATION?     │
└────────────┬─────────────────────┘
             │
   ┌─────────┴─────────┐
   │                   │
┌──▼──┐           ┌────▼────┐
│ 通过│           │ 失败    │
└──┬──┘           └────┬────┘
   │                   │
   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐
│ 继续Sprint拆分    │ │ 拆分MSpec        │
│                  │ │ 或优化WBS        │
└────────┬─────────┘ └──────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│     Step 6: Sprint→AtomTask拆分   │
│     验证: validateSprintScope()   │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│     检查Sprint粒度                │
│     atomTasks在[min, max]范围?    │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│     检查Sprint时长                │
│     duration在[min, max]范围?     │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────┐
│     输出: WBS     │
│     (已验证)      │
└──────────────────┘
```

### 8.3 Worktree使用流程图

```
┌─────────────────────────────────────────────────────────────────┐
│               Worktree使用流程                                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────┐
│     检测Worktree触发条件          │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│     触发条件检查                  │
│     1. 并行开发(>=2 MSpecs)?      │
│     2. 失败恢复(>=2次失败)?       │
│     3. 紧急修复(CRITICAL)?        │
│     4. 大型重构(>=3 files)?       │
└────────────┬─────────────────────┘
             │
   ┌─────────┴─────────┐
   │                   │
┌──▼──┐           ┌────▼────┐
│ 触发│           │ 不触发  │
└──┬──┘           └────┬────┘
   │                   │
   │                   ▼
   │           ┌──────────────────┐
   │           │ 正常单分支开发    │
   │           └──────────────────┘
   │
   ▼
┌──────────────────────────────────┐
│     Step 1: 创建Worktree          │
│     git worktree add <path> <br> │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│     Step 2: 确定Worktree类型      │
│     - parallel (并行开发)         │
│     - exp (实验隔离)              │
│     - hotfix (紧急修复)           │
│     - review (代码审查)           │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│     Step 3: 创建目录结构          │
│     .omt/worktrees/<type>/<id>/  │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│     Step 4: 初始化环境            │
│     - npm install                │
│     - 配置复制                    │
│     - 依赖安装                    │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│     Step 5: 在Worktree开发        │
│     cd .omt/worktrees/<id>        │
│     - 独立git操作                 │
│     - 独立测试环境                │
│     - 独立构建环境                │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│     Step 6: 开发完成              │
│     git commit + git push         │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│     Step 7: 合并回主分支          │
│     cd <main_project>             │
│     git merge <branch>            │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│     Step 8: 验证合并              │
│     - CI运行                      │
│     - 测试通过                    │
│     - 代码审查                    │
└────────────┬─────────────────────┘
             │
   ┌─────────┴─────────┐
   │                   │
┌──▼──┐           ┌────▼────┐
│ 通过│           │ 失败    │
└──┬──┘           └────┬────┘
   │                   │
   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐
│ Step 9: 清理     │ │ 回退到Worktree   │
│ Worktree         │ │ 修复问题         │
└────────┬─────────┘ └────────┬─────────┘
         │                    │
         ▼                    │
┌──────────────────┐          │
│ git worktree     │          │
│ remove <path>    │          │
└────────┬─────────┘          │
         │                    │
         ▼                    │
┌──────────────────┐          │
│ 清理分支(可选)    │          │
│ git branch -d    │◄─────────┘
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│     完成         │
└──────────────────┘
```

---

## 9. 配置示例

### 9.1 默认配置

```typescript
// omt.config.ts

import { ScopeConstraints } from './types';

export const DEFAULT_SCOPE_CONSTRAINTS: ScopeConstraints = {
  maxAtomTasksPerMSpec: 50,
  maxSprintsPerMSpec: 5,
  maxEstimatedDuration: '2d',
  minMSpecsForLargeProject: 20,
  largeProjectAtomThreshold: 1000,
  maxAtomTasksPerSprint: 10,
  minAtomTasksPerSprint: 1,
  sprintDurationRange: {
    min: '30m',
    max: '4h'
  }
};

export const DEFAULT_GIT_STRATEGY = {
  branch: {
    creationThreshold: {
      sprintComplexity: {
        atomTaskCount: 10,
        estimatedDuration: '4h',
        riskLevel: 'medium'
      }
    }
  },
  commit: {
    granularity: 'Sprint',
    messageFormat: {
      pattern: '<type>: <scope> - <description>',
      types: ['feat', 'fix', 'refactor', 'test', 'docs', 'chore']
    }
  },
  tag: {
    stableTagRequired: true,
    milestoneTagOptional: true
  },
  worktree: {
    maxParallel: 3,
    basePath: '.omt/worktrees/'
  }
};
```

### 9.2 可调参数

```typescript
// 环境变量配置

process.env.OMT_MAX_ATOM_TASKS_PER_MSPEC = '50';
process.env.OMT_MAX_SPRINTS_PER_MSPEC = '5';
process.env.OMT_MIN_MSPECS_LARGE_PROJECT = '20';
process.env.OMT_SPRINT_BRANCH_THRESHOLD = '10';
process.env.OMT_MAX_PARALLEL_WORKTREES = '3';
```

---

## 10. 总结

本文档定义的Git颗粒度策略和Scope约束机制确保：

### 10.1 核心保障

| 保障点 | 机制 | 效果 |
|-------|------|-----|
| **可推进** | Sprint atomic commit | 明确进度里程碑 |
| **可失败** | Worktree隔离实验 | 安全失败恢复 |
| **可回滚** | stable tag锚点 | 快速定位回滚点 |
| **可验证** | Scope阈值检查 | 防止拆解失控 |

### 10.2 实施路径

1. **Phase 1**: 实现Scope验证函数
2. **Phase 2**: 集成Git Hook脚本
3. **Phase 3**: 开发Worktree管理工具
4. **Phase 4**: 建立CI/CD流水线
5. **Phase 5**: 持续优化阈值参数

---

**文档版本**: v1.0
**维护者**: OMT Architecture Team
**更新日志**: 2026-05-01 初版发布