# OMT Alignment输出格式规范（12）

**设计日期**: 2026-05-01
**所属系列**: OMT核心设计文档系列 - Artifacts对齐机制
**参考来源**:
- `09_terminator_phase_refinement.md` - ALIGN Phase定义
- `11_artifacts_format_specification.md` - Delta标签标准
- `13_chain_update_mechanism.md` - 链式更新关联

---

## 1. alignment文件完整结构

### 1.1 文件路径规范

```
.omt/alignment/
├── alignment_<phase>_<timestamp>.yaml   # 对齐检查记录
└── proposals/                            # 链式更新提案（可选子目录）
    └── chain_update_<id>.yaml
```

### 1.2 完整YAML Schema

```yaml
# alignment_<phase>_<timestamp>.yaml
# 例: alignment_sprint_20260501T143000.yaml

id: <alignment-id>                     # 唯一标识，例: ALIGN_001
timestamp: <ISO-8601时间戳>             # 对齐检查时间
trigger_phase: <触发Phase>              # 触发对齐的Phase状态
scope:                                  # 对齐检查范围
  type: 'FULL' | 'PARTIAL'              # 全量检查或部分检查
  target:                               # 部分检查时的目标
    artifact_type: 'TSpec' | 'MSpec' | 'Sprint'
    artifact_id: string                 # 例: tspec_001, mspec_002

alignment_results:                      # 三层结果容器
  tspec_to_mspec:                       # TSpec→MSpec对齐层
    findings: AlignmentFinding[]        # 该层发现列表
    score: number                       # 该层对齐评分(0-100)
    status: 'PASS' | 'WARN' | 'FAIL'    # 该层状态
  
  mspec_to_sprint:                      # MSpec→Sprint对齐层
    findings: AlignmentFinding[]
    score: number
    status: 'PASS' | 'WARN' | 'FAIL'
  
  sprint_to_atomtask:                   # Sprint→AtomTask对齐层
    findings: AlignmentFinding[]
    score: number
    status: 'PASS' | 'WARN' | 'FAIL'

alignment_score:                        # 总体对齐评分
  overall: number                       # 总分(0-100)
  breakdown:                            # 分层评分明细
    tspec_mspec: number
    mspec_sprint: number
    sprint_atomtask: number

critical_issues:                        # 关键问题汇总
  count: number                         # 关键问题数量
  issues:                               # 关键问题列表
    - finding_id: string                # 关联的发现ID
      severity: 'ERROR' | 'WARNING'     # 严重程度
      description: string               # 问题描述
      requires_chain_update: boolean    # 是否需要链式更新

chain_update_proposals:                 # 链式更新建议（可选）
  generated: boolean                    # 是否已生成提案
  proposals:                            # 提案列表
    - proposal_id: string               # 提案ID
      direction: 'UPWARD' | 'DOWNWARD'  # 更新方向
      trigger_finding: string           # 触发发现ID
      status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED'

user_decision:                          # 用户决策记录
  required: boolean                     # 是否需要用户决策
  made: boolean                         # 是否已决策
  decision: 'ACCEPT' | 'REJECT' | 'DEFER' # 决策结果
  reason: string                        # 决策理由
  timestamp: <ISO-8601>                 # 决策时间

status: 'COMPLETED' | 'PENDING_DECISION' | 'CHAIN_UPDATE_EXECUTING' | 'ARCHIVED'

metadata:
  created_by: string                    # 创建者（Agent或用户）
  schema_version: string                # Schema版本，例: '1.0'
  related_files:                        # 相关文件引用
    - type: 'review'                    # 文件类型
      path: string                      # 文件路径
```

---

## 2. AlignmentFinding TypeScript接口

### 2.1 核心接口定义

```typescript
/**
 * AlignmentFinding - 对齐发现
 * 
 * 描述在四层artifacts对齐检查中发现的具体差异
 */
interface AlignmentFinding {
  // 发现唯一标识
  id: string;                           // 例: FIND_T001
  
  // 发现类型（四种状态标签）
  type: AlignmentFindingType;
  
  // 所属对齐层级
  layer: AlignmentLayer;
  
  // 关联artifact路径
  artifact: string;                     // 例: 'tspec_001/design.md'
  
  // 发现描述
  description: string;                  // 简明描述
  
  // 严重程度
  severity: SeverityLevel;
  
  // 详细信息
  details: FindingDetails;
  
  // 建议处理方式
  suggestion: string;
  
  // 链式更新路径（可选）
  chain_update?: ChainUpdatePath;
  
  // PMB同步标记
  pmb_sync: boolean;                    // 是否需要同步到PMB
}

/**
 * 发现类型枚举
 * 
 * 对齐状态标签，与artifact delta标签语义一致
 */
enum AlignmentFindingType {
  ADDED = 'ADDED',       // 新增内容：下层新增，上层未定义
  MODIFIED = 'MODIFIED', // 内容修改：下层内容与上层定义不一致
  DELETED = 'DELETED',   // 内容删除：下层删除，上层仍有定义
  RENAMED = 'RENAMED'    // 名称变更：实体重命名，需追踪一致性
}

/**
 * 对齐层级枚举
 */
enum AlignmentLayer {
  TSPEC_TO_MSPEC = 'TSpec→MSpec',       // TSpec与MSpec对齐层
  MSPEC_TO_SPRINT = 'MSpec→Sprint',     // MSpec与Sprint对齐层
  SPRINT_TO_ATOMTASK = 'Sprint→AtomTask' // Sprint与AtomTask对齐层
}

/**
 * 严重程度枚举
 */
enum SeverityLevel {
  ERROR = 'ERROR',     // 严重错误：必须修复，阻塞继续执行
  WARNING = 'WARNING', // 警告：建议修复，不阻塞但影响质量
  INFO = 'INFO'        // 信息：提示性发现，无需立即处理
}
```

### 2.2 详细信息结构

```typescript
/**
 * FindingDetails - 发现详细信息
 */
interface FindingDetails {
  // 发现位置
  location: {
    file: string;                       // 文件路径
    section?: string;                   // 具体章节（可选）
    line_range?: {                      // 行号范围（可选）
      start: number;
      end: number;
    }
  };
  
  // 期望内容（上层定义）
  expected: {
    summary: string;                    // 期望内容摘要
    source: string;                     // 期望来源文件
  };
  
  // 实际内容（下层实现）
  actual: {
    summary: string;                    // 实际内容摘要
    source: string;                     // 实际来源文件
  };
  
  // 差异对比（可选）
  diff?: {
    type: 'content' | 'structure' | 'naming';
    description: string;
  };
}
```

### 2.3 链式更新路径

```typescript
/**
 * ChainUpdatePath - 链式更新路径
 * 
 * 描述需要执行链式更新的路径信息
 */
interface ChainUpdatePath {
  // 是否需要链式更新
  required: boolean;
  
  // 更新方向
  direction: 'UPWARD' | 'DOWNWARD' | 'NONE';
  
  // 涉及的artifacts
  affected_artifacts: string[];         // 例: ['tspec_001', 'mspec_002']
  
  // 建议的更新操作
  suggested_action: 'UPDATE' | 'CREATE' | 'DELETE' | 'CONFIRM';
}
```

---

## 3. 状态标签详细定义

### 3.1 ADDED状态

| 属性 | 定义 |
|-----|------|
| **语义** | 下层新增内容，上层artifact未定义对应内容 |
| **触发场景** | Sprint新增功能模块，但MSpec/TSpec未包含相关定义 |
| **严重程度判定** | ERROR: 核心功能新增；WARNING: 辅助功能新增；INFO: 文档/注释新增 |
| **处理建议** | UPWARD链式更新：将下层新增内容向上层传播 |

**示例**:
```
Sprint新增 "GraphQL API查询接口"
MSpec仅定义 "REST API设计"
→ 发现: ADDED @ sprint_003/tasks.yaml
→ 建议: UPWARD更新MSpec，添加GraphQL设计定义
```

### 3.2 MODIFIED状态

| 属性 | 定义 |
|-----|------|
| **语义** | 下层实现内容与上层定义不一致 |
| **触发场景** | Sprint实现偏离MSpec设计规格 |
| **严重程度判定** | ERROR: 核心行为偏离；WARNING: 边缘行为偏离；INFO: 格式/命名偏离 |
| **处理建议** | UPWARD或DOWNWARD链式更新：协调上下层一致性 |

**示例**:
```
MSpec定义 "用户认证使用JWT"
Sprint实现 "用户认证使用Session"
→ 发现: MODIFIED @ sprint_002/auth_module.ts
→ 建议: 判断哪个更合理，执行对应方向更新
```

### 3.3 DELETED状态

| 属性 | 定义 |
|-----|------|
| **语义** | 上层定义存在，下层已删除对应实现 |
| **触发场景** | Sprint删除某功能模块，但MSpec/TSpec仍定义该功能 |
| **严重程度判定** | ERROR: 核心功能删除；WARNING: 辅助功能删除；INFO: 过时功能删除 |
| **处理建议** | UPWARD链式更新：将删除决策向上层传播，或恢复下层实现 |

**示例**:
```
TSpec定义 "支持IE11浏览器"
Sprint删除 IE11兼容代码
→ 发现: DELETED @ sprint_001/browser_compat.ts
→ 建议: UPWARD更新TSpec，移除IE11支持要求
```

### 3.4 RENAMED状态

| 属性 | 定义 |
|-----|------|
| **语义** | 实体（文件、模块、函数）名称变更，影响跨层引用一致性 |
| **触发场景** | Sprint重命名API端点，MSpec定义使用旧名称 |
| **严重程度判定** | ERROR: 核心API/接口重命名；WARNING: 内部模块重命名；INFO: 辅助命名变更 |
| **处理建议** | 确认命名变更意图，执行一致性更新 |

**示例**:
```
MSpec定义 API端点: /api/users
Sprint实现 API端点: /api/v2/users
→ 发现: RENAMED @ sprint_002/api_routes.yaml
→ 建议: 更新MSpec定义，或回退Sprint命名变更
```

---

## 4. 核心YAML示例

### 4.1 示例一：包含MODIFIED发现

```yaml
id: ALIGN_001
timestamp: '2026-05-01T14:30:00Z'
trigger_phase: 'REVIEW'
scope:
  type: 'FULL'

alignment_results:
  tspec_to_mspec:
    findings: []
    score: 95
    status: 'PASS'
  
  mspec_to_sprint:
    findings:
      - id: 'FIND_M001'
        type: 'MODIFIED'
        layer: 'MSpec→Sprint'
        artifact: 'mspec_002/design.md'
        description: '认证机制实现与MSpec定义不一致'
        severity: 'ERROR'
        details:
          location:
            file: 'sprint_002/auth_impl.ts'
            section: 'AuthenticationModule'
          expected:
            summary: 'JWT认证机制'
            source: 'mspec_002/design.md#auth'
          actual:
            summary: 'Session认证机制'
            source: 'sprint_002/auth_impl.ts'
        suggestion: '执行UPWARD链式更新，或调整Sprint实现'
        chain_update:
          required: true
          direction: 'UPWARD'
          affected_artifacts: ['mspec_002', 'tspec_001']
          suggested_action: 'UPDATE'
        pmb_sync: true
    score: 60
    status: 'FAIL'
  
  sprint_to_atomtask:
    findings: []
    score: 90
    status: 'PASS'

alignment_score:
  overall: 75
  breakdown:
    tspec_mspec: 95
    mspec_sprint: 60
    sprint_atomtask: 90

critical_issues:
  count: 1
  issues:
    - finding_id: 'FIND_M001'
      severity: 'ERROR'
      description: '认证机制不一致，可能影响系统安全'
      requires_chain_update: true

chain_update_proposals:
  generated: true
  proposals:
    - proposal_id: 'CHAIN_001'
      direction: 'UPWARD'
      trigger_finding: 'FIND_M001'
      status: 'PENDING'

user_decision:
  required: true
  made: false
  decision: null
  reason: null
  timestamp: null

status: 'PENDING_DECISION'

metadata:
  created_by: 'ArtifactsAligner'
  schema_version: '1.0'
  related_files:
    - type: 'review'
      path: '.omt/reviews/review_sprint_002.yaml'
```

### 4.2 示例二：包含ADDED发现

```yaml
id: ALIGN_002
timestamp: '2026-05-01T16:00:00Z'
trigger_phase: 'REVIEW'
scope:
  type: 'PARTIAL'
  target:
    artifact_type: 'Sprint'
    artifact_id: 'sprint_003'

alignment_results:
  tspec_to_mspec:
    findings: []
    score: 100
    status: 'PASS'
  
  mspec_to_sprint:
    findings:
      - id: 'FIND_A001'
        type: 'ADDED'
        layer: 'MSpec→Sprint'
        artifact: 'sprint_003/tasks.yaml'
        description: '新增GraphQL查询功能，MSpec未定义'
        severity: 'WARNING'
        details:
          location:
            file: 'sprint_003/graphql_query.ts'
          expected:
            summary: 'N/A（上层未定义）'
            source: 'N/A'
          actual:
            summary: 'GraphQL用户查询接口实现'
            source: 'sprint_003/graphql_query.ts'
        suggestion: '执行UPWARD更新，将GraphQL能力加入MSpec设计'
        chain_update:
          required: true
          direction: 'UPWARD'
          affected_artifacts: ['mspec_002']
          suggested_action: 'UPDATE'
        pmb_sync: true
    score: 80
    status: 'WARN'
  
  sprint_to_atomtask:
    findings: []
    score: 95
    status: 'PASS'

alignment_score:
  overall: 88
  breakdown:
    tspec_mspec: 100
    mspec_sprint: 80
    sprint_atomtask: 95

critical_issues:
  count: 0
  issues: []

chain_update_proposals:
  generated: false
  proposals: []

user_decision:
  required: true
  made: false
  decision: null
  reason: null
  timestamp: null

status: 'PENDING_DECISION'

metadata:
  created_by: 'ArtifactsAligner'
  schema_version: '1.0'
  related_files: []
```

---

## 5. alignment文件命名规范

### 5.1 文件名格式

```
alignment_<phase>_<timestamp>.yaml
```

| 组成部分 | 说明 | 示例 |
|---------|------|------|
| `alignment_` | 固定前缀 | `alignment_` |
| `<phase>` | 触发对齐的Phase状态 | `sprint`, `review`, `gap_analysis` |
| `<timestamp>` | ISO-8601时间戳（紧凑格式） | `20260501T143000` |
| `.yaml` | 固定后缀 | `.yaml` |

### 5.2 命名示例

```
# 正确命名
alignment_review_20260501T143000.yaml    # REVIEW阶段触发
alignment_sprint_20260502T100000.yaml    # Sprint执行后触发
alignment_gap_analysis_20260503T090000.yaml  # GAP_ANALYSIS前触发

# 错误命名（避免）
alignment-001.yaml                       # 缺少Phase和Timestamp
alignment_20260501.yaml                  # 缺少Phase标识
alignment_review.yaml                    # 缺少Timestamp
```

### 5.3 存储路径

```
.omt/alignment/
├── alignment_review_20260501T143000.yaml
├── alignment_review_20260501T160000.yaml
├── alignment_sprint_20260502T100000.yaml
└── proposals/                           # 链式更新提案目录
    ├── chain_update_001.yaml
    └── chain_update_002.yaml
```

---

## 6. 核心接口汇总

```typescript
// ============================================
// Alignment核心接口汇总
// ============================================

// 枚举定义
enum AlignmentFindingType { ADDED, MODIFIED, DELETED, RENAMED }
enum AlignmentLayer { TSPEC_TO_MSPEC, MSPEC_TO_SPRINT, SPRINT_TO_ATOMTASK }
enum SeverityLevel { ERROR, WARNING, INFO }
enum AlignmentStatus { COMPLETED, PENDING_DECISION, CHAIN_UPDATE_EXECUTING, ARCHIVED }

// 核心数据结构
interface AlignmentFinding {
  id: string;
  type: AlignmentFindingType;
  layer: AlignmentLayer;
  artifact: string;
  description: string;
  severity: SeverityLevel;
  details: FindingDetails;
  suggestion: string;
  chain_update?: ChainUpdatePath;
  pmb_sync: boolean;
}

interface AlignmentRecord {
  id: string;
  timestamp: Date;
  trigger_phase: string;
  scope: AlignmentScope;
  alignment_results: ThreeLayerResults;
  alignment_score: AlignmentScore;
  critical_issues: CriticalIssues;
  chain_update_proposals: ChainUpdateProposalRefs;
  user_decision: UserDecision;
  status: AlignmentStatus;
  metadata: AlignmentMetadata;
}

interface ThreeLayerResults {
  tspec_to_mspec: LayerResult;
  mspec_to_sprint: LayerResult;
  sprint_to_atomtask: LayerResult;
}

interface LayerResult {
  findings: AlignmentFinding[];
  score: number;
  status: 'PASS' | 'WARN' | 'FAIL';
}
```

---

## 7. 与相关文档关系

| 文档编号 | 文档名称 | 关系说明 |
|---------|---------|---------|
| **12B** | Alignment三层检查详细定义 | 本文档定义的AlignmentLayer具体检查规则（已合并至本文档第8章） |
| **12C** | Alignment评分与PMB同步 | 本文档的alignment_score和pmb_sync机制详解（已合并至本文档第9-12章） |
| **13** | 链式更新机制 | 本文档的chain_update_proposals具体实现 |
| **11** | Artifacts格式规范 | Delta标签（ADDED/MODIFIED/DELETED/RENAMED）源定义 |

---

## 8. 三层对齐检查机制

### 8.1 三层对齐架构概述

OMT系统采用三层递进式对齐检查机制，确保四层artifacts（TSpec→MSpec→Sprint→AtomTask）之间的信息一致性。

```
┌─────────────────────────────────────────────────────────────┐
│                    三层对齐检查架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: TSpec → MSpec                                     │
│  [技术规格层 → 里程碑规格层]                                 │
│                                                             │
│  Layer 2: MSpec → Sprint                                    │
│  [里程碑规格层 → Sprint执行层]                              │
│                                                             │
│  Layer 3: Sprint → AtomTask                                 │
│  [Sprint执行层 → 原子任务层]                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 8.2 Layer 1: TSpec→MSpec对齐检查

#### 8.2.1 检查项清单

| 检查项ID | 检查项名称 | 严重等级 | 检查规则 |
|---------|-----------|---------|---------|
| L1-001 | Milestone数量一致性 | HIGH | MSpec数量 = TSpec.milestones.length |
| L1-002 | 技术约束遵循 | HIGH | 每个MSpec.techStack包含TSpec.technicalConstraints |
| L1-003 | 能力覆盖完整性 | MEDIUM | MSpec汇总覆盖TSpec.allCapabilities |
| L1-004 | 依赖关系正确性 | MEDIUM | MSpec依赖图无循环且符合TSpec约束 |

#### 8.2.2 检查规则详解

**L1-001 Milestone数量一致性**

```
检查算法:
1. 解析TSpec.milestones.yaml
2. 提取milestone定义列表
3. 统计MSpec目录下mspec_*.md文件数量
4. 对比数量是否一致

发现类型映射:
- ADDED: MSpec数量多于TSpec定义（可能新增milestone）
- DELETED: MSpec数量少于TSpec定义（milestone遗漏）
- MODIFIED: 数量一致但ID不匹配

示例场景:
TSpec定义: [milestone_001, milestone_002, milestone_003]
实际MSpec: [mspec_001, mspec_002]  # 缺失mspec_003 → DELETED
```

**L1-002 技术约束遵循**

```
检查算法:
1. 提取TSpec.technicalConstraints字段
2. 遍历每个MSpec.techStack字段
3. 验证约束项是否被遵循

发现类型映射:
- MODIFIED: 技术栈与约束不一致
- ADDED: 使用了未定义的新技术

示例场景:
TSpec约束: "必须使用React 18+"
MSpec.techStack: "Vue 3"  # 不一致 → MODIFIED
```

**L1-003 能力覆盖完整性**

```
检查算法:
1. 汇总TSpec.allCapabilities
2. 收集所有MSpec.capabilities
3. 检查覆盖情况

发现类型映射:
- DELETED: TSpec定义能力未被任何MSpec覆盖
- ADDED: MSpec包含TSpec未定义的能力

示例场景:
TSpec能力: [auth, api, storage]
MSpec覆盖: [auth, api]  # storage缺失 → DELETED
```

---

### 8.3 Layer 2: MSpec→Sprint对齐检查

#### 8.3.1 检查项清单

| 检查项ID | 检查项名称 | 严重等级 | 检查规则 |
|---------|-----------|---------|---------|
| L2-001 | WBS任务数量 | HIGH | Sprint任务总数 = MSpec.wbs.totalTasks |
| L2-002 | Sprint任务范围 | HIGH | Sprint任务不超出MSpec范围 |
| L2-003 | assigneeRole匹配 | MEDIUM | Sprint.assigneeRole存在于MSpec.roles |
| L2-004 | 依赖关系一致 | MEDIUM | Sprint依赖符合MSpec.wbs.dependencies |

#### 8.3.2 检查规则详解

**L2-001 WBS任务数量**

```
检查算法:
1. 解析MSpec.wbs.yaml
2. 统计WBS定义的总任务数
3. 检查Sprint.yaml中任务列表长度

发现类型映射:
- ADDED: Sprint任务多于WBS定义
- DELETED: Sprint任务少于WBS定义
- MODIFIED: 数量一致但任务内容差异

示例场景:
MSpec.wbs: 15个任务
Sprint.yaml: 12个任务  # 缺失3个 → DELETED
```

**L2-002 Sprint任务范围**

```
检查算法:
1. 提取MSpec边界定义
2. 验证每个Sprint任务归属
3. 检查任务是否超出MSpec职责范围

发现类型映射:
- ADDED: 任务超出MSpec边界
- MODIFIED: 任务边界模糊

示例场景:
MSpec职责: "用户认证模块"
Sprint任务: "支付系统集成"  # 越界 → ADDED
```

---

### 8.4 Layer 3: Sprint→AtomTask对齐检查

#### 8.4.1 检查项清单

| 检查项ID | 检查项名称 | 严重等级 | 检查规则 |
|---------|-----------|---------|---------|
| L3-001 | DAG依赖完整 | HIGH | AtomTask DAG无孤立节点 |
| L3-002 | 任务状态一致 | HIGH | AtomTask状态与Sprint.status一致 |
| L3-003 | artifacts对齐 | MEDIUM | AtomTask产出与Sprint.artifacts一致 |
| L3-004 | 执行顺序正确 | MEDIUM | AtomTask执行顺序符合DAG拓扑 |

#### 8.4.2 检查规则详解

**L3-001 DAG依赖完整**

```
检查算法:
1. 解析AtomTask依赖关系
2. 构建DAG图
3. 检测孤立节点（无依赖且无被依赖）
4. 验证所有节点可达

发现类型映射:
- DELETED: 孤立节点（未连接到DAG）
- MODIFIED: 依赖断裂

示例场景:
AtomTask DAG:
  task_001 → task_002 → task_003
  task_004 (孤立)  # 无依赖关系 → DELETED
```

**L3-002 任务状态一致**

```
检查算法:
1. 遍历Sprint.status字段
2. 检查每个AtomTask.status是否与Sprint整体状态一致
3. 验证状态转换合法性

发现类型映射:
- MODIFIED: AtomTask状态与Sprint不一致
- ADDED: 非法状态（如PENDING的Sprint中有COMPLETED的AtomTask）

示例场景:
Sprint.status: PENDING
AtomTask.status: COMPLETED  # 不一致 → MODIFIED
```

---

### 8.5 检查算法接口设计

```typescript
/**
 * 三层对齐检查器接口
 */
interface AlignmentChecker {
  // Layer 1: TSpec→MSpec对齐检查
  checkTSpecToMSpec(tspec: TSpec, mspecs: MSpec[]): AlignmentResult;
  
  // Layer 2: MSpec→Sprint对齐检查
  checkMSpecToSprint(mspec: MSpec, sprint: Sprint): AlignmentResult;
  
  // Layer 3: Sprint→AtomTask对齐检查
  checkSprintToAtomTask(sprint: Sprint, tasks: AtomTask[]): AlignmentResult;
}

/**
 * 对齐检查结果
 */
interface AlignmentResult {
  // 检查有效性
  valid: boolean;
  
  // 发现列表
  findings: AlignmentFinding[];
  
  // 对齐评分（0-100）
  score: number;
  
  // 检查层级
  layer: 'L1' | 'L2' | 'L3';
  
  // 检查时间戳
  timestamp: Date;
}

/**
 * 对齐发现定义
 */
interface AlignmentFinding {
  // 发现唯一标识
  finding_id: string;
  
  // 检查项ID
  check_item_id: string;  // 如 'L1-001'
  
  // 发现类型
  type: FindingType;
  
  // 严重等级
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  
  // 问题描述
  description: string;
  
  // 相关artifact路径
  related_artifacts: string[];
  
  // 建议修复
  recommendation?: string;
}

/**
 * 发现类型枚举
 */
enum FindingType {
  ADDED = 'ADDED',      // 新增不一致
  MODIFIED = 'MODIFIED', // 修改不一致
  DELETED = 'DELETED'   // 删除不一致
}
```

---

### 8.6 检查执行顺序

#### 8.6.1 顺序执行规则

```
执行顺序: Layer1 → Layer2 → Layer3

规则说明:
1. 必须按层级顺序执行，不可跳层
2. 下层检查依赖上层检查结果
3. 上层检查失败时，下层检查跳过并标记依赖失败

依赖关系:
┌─────────────────────────────────────────────────────────────┐
│  L1.checkTSpecToMSpec()                                     │
│      │                                                      │
│      │ valid=true → 继续                                    │
│      │ valid=false → L2/L3跳过，标记DEPENDENCY_BLOCKED      │
│      ▼                                                      │
│  L2.checkMSpecToSprint()                                    │
│      │                                                      │
│      │ valid=true → 继续                                    │
│      │ valid=false → L3跳过，标记DEPENDENCY_BLOCKED         │
│      ▼                                                      │
│  L3.checkSprintToAtomTask()                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 8.6.2 同层并行检查

```typescript
/**
 * 同一层内检查项可并行执行
 */
async function executeLayerChecks(layer: 'L1' | 'L2' | 'L3'): Promise<AlignmentResult[]> {
  const checkItems = getCheckItemsForLayer(layer);
  
  // 并行执行所有检查项
  const results = await Promise.all(
    checkItems.map(item => executeCheckItem(item))
  );
  
  return results;
}

/**
 * L1层并行检查示例
 */
// L1-001, L1-002, L1-003, L1-004 可并行执行
// 结果汇总后输出AlignmentResult
```

---

### 8.7 检查输出格式

```yaml
# .omt/alignment/alignment_<id>.yaml
alignment_id: alignment_20260501_001
timestamp: 2026-05-01T10:30:00Z
overall_score: 85

layer_results:
  L1:
    valid: true
    score: 90
    findings:
      - finding_id: F001
        check_item_id: L1-003
        type: DELETED
        severity: MEDIUM
        description: "storage能力未被MSpec覆盖"
        
  L2:
    valid: true
    score: 80
    findings:
      - finding_id: F002
        check_item_id: L2-004
        type: MODIFIED
        severity: LOW
        description: "Sprint依赖顺序略有调整"
        
  L3:
    valid: false
    score: 75
    findings:
      - finding_id: F003
        check_item_id: L3-001
        type: DELETED
        severity: HIGH
        description: "AtomTask DAG存在孤立节点"
```

---

### 8.8 检查触发时机

| 触发点 | COMMAND | 检查范围 |
|-------|---------|---------|
| Sprint执行完成 | omt:align | 全量三层检查 |
| Tune调整后 | omt:align-part | 部分对齐检查 |
| Phase转换时 | 自动触发 | 对应层级检查 |
| 链式更新前 | ChainUpdate | 影响范围检查 |

---

## 9. PMB同步机制

### 9.1 触发条件

PMB（Progress Memory Block）同步在以下场景触发：

| 触发场景 | 触发条件 | 同步内容 |
|---------|---------|---------|
| 发现pmb_sync=true | AlignmentFinding中标记需要同步 | 将finding详情写入PMB |
| 链式更新执行前 | chain_update_proposals.status=PENDING | 记录更新意图 |
| 用户决策后 | user_decision.made=true | 记录决策结果 |
| Alignment完成 | status=COMPLETED | 记录整体对齐状态 |

### 9.2 Sync记录YAML结构

```yaml
# .omt/pmb/sync_alignment_<id>.yaml
sync_id: SYNC_ALIGN_<alignment_id>_<timestamp>
source_type: 'ALIGNMENT'
source_ref: <alignment-id>               # 关联的alignment记录ID

sync_content:
  # 同步类型
  sync_type: 'FINDING' | 'CHAIN_UPDATE' | 'USER_DECISION' | 'ALIGNMENT_COMPLETE'
  
  # 同步时间戳
  timestamp: <ISO-8601>
  
  # 同步详情
  details:
    # FINDING类型
    finding_id: string                   # 例: FIND_M001
    finding_type: 'ADDED' | 'MODIFIED' | 'DELETED' | 'RENAMED'
    severity: 'ERROR' | 'WARNING' | 'INFO'
    layer: AlignmentLayer
    description: string
    
    # CHAIN_UPDATE类型
    proposal_id: string
    direction: 'UPWARD' | 'DOWNWARD'
    affected_artifacts: string[]
    
    # USER_DECISION类型
    decision: 'ACCEPT_ALL' | 'REJECT_ALL' | 'SELECTIVE' | 'MANUAL_FIX'
    reason: string
    
    # ALIGNMENT_COMPLETE类型
    overall_score: number
    critical_count: number

sync_status: 'PENDING' | 'SYNCED' | 'FAILED' | 'BLOCKED'

metadata:
  synced_by: string                      # 同步执行者
  schema_version: '1.0'
```

### 9.3 阻塞检查机制

```typescript
/**
 * PMB同步阻塞检查
 * 
 * 防止重复同步和冲突写入
 */
interface PMBSyncBlocker {
  // 检查是否存在待处理的sync记录
  hasPendingSync(alignmentId: string): boolean;
  
  // 检查是否存在冲突的sync记录
  hasConflictSync(sourceRef: string, syncType: SyncType): boolean;
  
  // 获取阻塞原因
  getBlockingReason(): BlockingReason | null;
}

enum BlockingReason {
  PENDING_SYNC_EXISTS,      // 存在待处理sync
  CONFLICT_WITH_ACTIVE,     // 与活跃sync冲突
  DEPENDENCY_NOT_SYNCED,    // 依赖项未同步
  USER_DECISION_PENDING     // 用户决策待处理
}

/**
 * 阻塞检查流程
 */
function checkSyncBlock(alignment: AlignmentRecord): SyncBlockResult {
  // 1. 检查是否有PENDING状态的sync记录
  if (pmb.hasPendingSync(alignment.id)) {
    return { blocked: true, reason: 'PENDING_SYNC_EXISTS' };
  }
  
  // 2. 检查是否需要用户决策且尚未决策
  if (alignment.user_decision.required && !alignment.user_decision.made) {
    return { blocked: true, reason: 'USER_DECISION_PENDING' };
  }
  
  // 3. 检查链式更新依赖
  if (alignment.chain_update_proposals.generated) {
    const pendingProposals = alignment.chain_update_proposals.proposals
      .filter(p => p.status === 'PENDING');
    if (pendingProposals.length > 0) {
      return { blocked: true, reason: 'DEPENDENCY_NOT_SYNCED' };
    }
  }
  
  return { blocked: false, reason: null };
}
```

### 9.4 同步执行示例

```yaml
# 示例：FINDING类型sync记录
sync_id: SYNC_ALIGN_ALIGN_001_20260501T143500
source_type: 'ALIGNMENT'
source_ref: 'ALIGN_001'

sync_content:
  sync_type: 'FINDING'
  timestamp: '2026-05-01T14:35:00Z'
  details:
    finding_id: 'FIND_M001'
    finding_type: 'MODIFIED'
    severity: 'ERROR'
    layer: 'MSpec→Sprint'
    description: '认证机制实现与MSpec定义不一致'

sync_status: 'SYNCED'

metadata:
  synced_by: 'ArtifactsAligner'
  schema_version: '1.0'
```

---

## 10. 用户决策处理

### 10.1 决策选项定义

| 决策选项 | 语义 | 适用场景 |
|---------|------|---------|
| **ACCEPT_ALL** | 接收所有发现，执行链式更新 | 对齐问题可控，下层实现优于上层定义 |
| **REJECT_ALL** | 拒绝所有发现，保持现有状态 | 对齐问题为提示性，无需处理 |
| **SELECTIVE** | 选择性处理部分发现 | 部分发现需处理，其他可忽略 |
| **MANUAL_FIX** | 手动修复，不执行链式更新 | 问题复杂，需人工干预 |

### 10.2 决策流程与状态转换

```
决策选项状态转换表：
┌──────────────┬─────────────────────────────────────┬───────────────────────┐
│ 决策选项     │ 执行动作                            │ 后续状态              │
├──────────────┼─────────────────────────────────────┼───────────────────────┤
│ ACCEPT_ALL   │ 1. 执行所有chain_update_proposals   │ CHAIN_UPDATE_EXECUTING│
│              │ 2. 更新相关artifacts                │ → COMPLETED           │
│              │ 3. PMB记录决策                      │                       │
├──────────────┼─────────────────────────────────────┼───────────────────────┤
│ REJECT_ALL   │ 1. 关闭所有findings                 │ COMPLETED             │
│              │ 2. 不执行链式更新                   │                       │
│              │ 3. PMB记录拒绝原因                  │                       │
├──────────────┼─────────────────────────────────────┼───────────────────────┤
│ SELECTIVE    │ 1. 用户指定处理finding列表          │ PARTIAL_EXECUTING     │
│              │ 2. 执行部分chain_update             │ → COMPLETED           │
│              │ 3. 其他finding标记为IGNORED         │                       │
├──────────────┼─────────────────────────────────────┼───────────────────────┤
│ MANUAL_FIX   │ 1. 暂停alignment流程                │ MANUAL_FIX_PENDING    │
│              │ 2. 生成修复建议文档                 │                       │
│              │ 3. 等待用户手动干预                 │                       │
└──────────────┴─────────────────────────────────────┴───────────────────────┘
```

### 10.3 决策后后续处理

```yaml
# 用户决策后的alignment记录更新示例
user_decision:
  required: true
  made: true
  decision: 'SELECTIVE'
  reason: '仅处理ERROR级别发现，WARNING级别忽略'
  selected_findings: ['FIND_M001', 'FIND_A001']  # SELECTIVE时指定
  ignored_findings: ['FIND_W001', 'FIND_W002']
  timestamp: '2026-05-01T15:00:00Z'

# 后续处理
post_decision_actions:
  - action: 'CHAIN_UPDATE'
    target_finding: 'FIND_M001'
    proposal_id: 'CHAIN_001'
    status: 'EXECUTING'
  
  - action: 'CHAIN_UPDATE'
    target_finding: 'FIND_A001'
    proposal_id: 'CHAIN_002'
    status: 'EXECUTING'
  
  - action: 'IGNORE'
    target_finding: 'FIND_W001'
    reason: 'WARNING级别，用户选择忽略'

status: 'CHAIN_UPDATE_EXECUTING'
```

### 10.4 ASCII决策流程图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    用户决策处理流程                                            │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────┐
                    │   Alignment检查完成          │
                    │   status: PENDING_DECISION   │
                    └─────────────────────────────┘
                                │
                                │ user_decision.required=true
                                ▼
                    ┌─────────────────────────────┐
                    │   向用户呈现对齐发现          │
                    │   - 发现列表                  │
                    │   - 严重程度                  │
                    │   - 建议处理                  │
                    └─────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │    用户选择决策选项     │
                    └───────────┬───────────┘
                                │
        ┌────────────┬──────────┼──────────┬────────────┐
        │            │          │          │            │
        ▼            ▼          ▼          ▼            ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│ACCEPT_ALL │ │REJECT_ALL │ │ SELECTIVE │ │MANUAL_FIX │
└───────────┘ └───────────┘ └───────────┘ └───────────┘
        │            │          │          │
        │            │          │          │
        ▼            ▼          ▼          ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│执行全部    │ │关闭全部    │ │用户指定    │ │暂停流程    │
│chain_update│ │findings    │ │finding列表 │ │生成修复    │
│            │ │            │ │            │ │建议文档    │
└───────────┘ └───────────┘ └───────────┘ └───────────┘
        │            │          │          │
        │            │          │          │
        ▼            ▼          ▼          ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│更新所有    │ │PMB记录     │ │执行部分    │ │等待用户    │
│artifacts   │ │拒绝原因    │ │chain_update│ │手动干预    │
│            │ │            │ │            │ │            │
└───────────┘ └───────────┘ └───────────┘ └───────────┘
        │            │          │          │
        │            │          │          │
        ▼            ▼          ▼          │
┌───────────┐ ┌───────────┐ ┌───────────┐ │
│PMB同步    │ │status:     │ │其他finding│ │
│决策记录    │ │COMPLETED   │ │标记IGNORED│ │
└───────────┘ └───────────┘ └───────────┘ │
        │            │          │          │
        ▼            ▼          ▼          ▼
┌───────────────────────────────────────────────────────────────┐
│                         COMPLETED                              │
│                  （或MANUAL_FIX_PENDING等待）                   │
└───────────────────────────────────────────────────────────────┘
```

---

## 11. Alignment评分机制

### 11.1 权重设计

| 层级 | 权重系数 | 理由 |
|-----|---------|------|
| TSpec→MSpec | 0.20 | 高层定义，发现较少但影响大 |
| MSpec→Sprint | 0.35 | 核心执行层，发现频率最高 |
| Sprint→AtomTask | 0.25 | 原子任务层，细节差异 |

| 严重程度 | 扣分系数 | 理由 |
|---------|---------|------|
| ERROR | 10分/个 | 阻塞性问题，必须处理 |
| WARNING | 3分/个 | 影响质量，建议处理 |
| INFO | 0分/个 | 提示性发现，不扣分 |

### 11.2 评分公式

```
总体评分公式:

OverallScore = Σ(LayerScore_i × Weight_i)

LayerScore公式:

LayerScore = 100 - Σ(FindingPenalty_j)

FindingPenalty_j = SeverityPenalty × ImpactFactor

其中:
- SeverityPenalty: ERROR=10, WARNING=3, INFO=0
- ImpactFactor: 核心功能=1.5, 辅助功能=1.0, 文档=0.5

最低分阈值: 0分（不允许负分）
```

### 11.3 阈值设置

| 评分等级 | 分数范围 | 状态 | 处理要求 |
|---------|---------|------|---------|
| **PASS** | 85-100 | 通过 | 无需处理，直接COMPLETED |
| **WARN** | 60-84 | 警告 | 需用户决策，PENDING_DECISION |
| **FAIL** | 0-59 | 失败 | 必须修复，不可继续执行 |

### 11.4 评分示例

```yaml
# 评分计算示例
alignment_score:
  overall: 75                    # 总体评分
  breakdown:                     # 分层明细
    tspec_mspec: 95              # Layer1: 100 - 0 - 3 = 97 → 取95
    mspec_sprint: 60             # Layer2: 100 - 10 - 30 = 60
    sprint_atomtask: 90          # Layer3: 100 - 10 = 90

  calculation_detail:
    L1:
      base_score: 100
      findings:
        - id: 'FIND_W001'
          severity: 'WARNING'
          penalty: 3
          impact_factor: 1.0
          total_penalty: 3
      layer_score: 97            # min(97, 95) = 95 (归一化)
      
    L2:
      base_score: 100
      findings:
        - id: 'FIND_M001'
          severity: 'ERROR'
          penalty: 10
          impact_factor: 1.5     # 核心功能
          total_penalty: 15
        - id: 'FIND_W001'
          severity: 'WARNING'
          penalty: 3
          impact_factor: 1.0
          total_penalty: 3
        - id: 'FIND_W002'
          severity: 'WARNING'
          penalty: 3
          impact_factor: 1.0
          total_penalty: 3
      layer_score: 79            # 100 - 15 - 3 - 3 = 79
      
    L3:
      base_score: 100
      findings:
        - id: 'FIND_D001'
          severity: 'ERROR'
          penalty: 10
          impact_factor: 1.0
          total_penalty: 10
      layer_score: 90

# 总体计算
# Overall = 95×0.20 + 79×0.35 + 90×0.25
#         = 19 + 27.65 + 22.5
#         = 69.15 → 归一化为75
```

---

## 12. 完整流程图

### 12.1 Alignment完整流程ASCII图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Alignment完整流程（从触发到完成）                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────┐
│   触发源: Phase转换/COMMAND   │
│   REVIEW → ALIGN             │
│   omt:align / omt:align-part │
└─────────────────────────────┘
            │
            ▼
┌─────────────────────────────┐
│   初始化Alignment检查        │
│   - 确定scope (FULL/PARTIAL) │
│   - 创建alignment记录        │
│   - 设置三层检查目标          │
└─────────────────────────────┘
            │
            ▼
┌─────────────────────────────┐
│   Layer1: TSpec→MSpec检查     │
│   ┌───────────────────────┐ │
│   │ 并行执行L1检查项        │ │
│   │ L1-001~L1-004         │ │
│   └───────────────────────┘ │
│   - 输出Layer1 findings      │
│   - 计算Layer1 score         │
└─────────────────────────────┘
            │
            │ valid=true
            ▼
┌─────────────────────────────┐
│   Layer2: MSpec→Sprint检查    │
│   ┌───────────────────────┐ │
│   │ 并行执行L2检查项        │ │
│   │ L2-001~L2-004         │ │
│   └───────────────────────┘ │
│   - 输出Layer2 findings      │
│   - 计算Layer2 score         │
└─────────────────────────────┘
            │
            │ valid=true
            ▼
┌─────────────────────────────┐
│   Layer3: Sprint→AtomTask    │
│   ┌───────────────────────┐ │
│   │ 并行执行L3检查项        │ │
│   │ L3-001~L3-004         │ │
│   └───────────────────────┘ │
│   - 输出Layer3 findings      │
│   - 计算Layer3 score         │
└─────────────────────────────┘
            │
            ▼
┌─────────────────────────────┐
│   汇总三层检查结果            │
│   - 合并findings列表          │
│   - 计算overall score         │
│   - 确定alignment status      │
└─────────────────────────────┘
            │
            ├───────────────────────────────────────┐
            │                                       │
            │ score≥85                              │ score<85
            │ status=PASS                           │ status=WARN/FAIL
            ▼                                       ▼
┌─────────────────────────────┐       ┌─────────────────────────────┐
│   生成chain_update_proposals │       │   标记critical_issues        │
│   （如有需要）                │       │   - ERROR级别统计             │
│                              │       │   - 需链式更新统计            │
└─────────────────────────────┘       └─────────────────────────────┘
            │                                       │
            │                                       ▼
            │                           ┌─────────────────────────────┐
            │                           │   用户决策待处理              │
            │                           │   status: PENDING_DECISION   │
            │                           │                              │
            │                           │   PMB阻塞检查:                │
            │                           │   - 检查pending sync         │
            │                           │   - 检查decision pending     │
            │                           └─────────────────────────────┘
            │                                       │
            │                                       ▼
            │                           ┌─────────────────────────────┐
            │                           │   向用户呈现发现              │
            │                           │   - 分层findings列表          │
            │                           │   - severity标记              │
            │                           │   - 建议处理方式              │
            │                           └─────────────────────────────┘
            │                                       │
            │                           ┌───────────┴───────────┐
            │                           │    用户决策选项        │
            │                           └───────────┬───────────┘
            │                                       │
            │               ┌──────────┬────────────┼────────────┬──────────┐
            │               │          │            │            │          │
            │               ▼          ▼            ▼            ▼          │
            │       ┌───────────┐┌───────────┐┌───────────┐┌───────────┐    │
            │       │ACCEPT_ALL ││REJECT_ALL ││ SELECTIVE ││MANUAL_FIX │    │
            │       └───────────┘└───────────┘└───────────┘└───────────┘    │
            │               │          │            │            │          │
            │               ▼          ▼            ▼            ▼          │
            │       ┌───────────────────────────────────────────────────┐   │
            │       │              PMB同步决策记录                        │   │
            │       │              sync_status: SYNCED                   │   │
            │       └───────────────────────────────────────────────────┘   │
            │               │          │            │            │          │
            ▼               ▼          ▼            ▼            ▼          │
┌─────────────────────────────┐       │            │            │          │
│   PMB同步                    │       │            │            │          │
│   sync_type: ALIGNMENT_COMPLETE│     │            │            │          │
└─────────────────────────────┘       │            │            │          │
            │                          │            │            │          │
            │                          │            │            │          │
            ▼                          ▼            ▼            ▼          ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                              COMPLETED                                    │
│   status: COMPLETED                                                       │
│   alignment记录归档                                                       │
│   Phase转换: ALIGN → GAP_ANALYSIS                                         │
└───────────────────────────────────────────────────────────────────────────┘

特殊情况路径：
┌─────────────────────────────────────────────────────────────────────────────┐
│  MANUAL_FIX路径:                                                            │
│                                                                             │
│  MANUAL_FIX_PENDING ──▶ 用户手动干预 ──▶ 重新触发alignment检查              │
│                                                                             │
│  SELECTIVE路径:                                                             │
│                                                                             │
│  执行部分chain_update ──▶ 更新artifacts ──▶ PARTIAL_COMPLETED              │
│                                                                             │
│  Layer检查失败路径:                                                         │
│                                                                             │
│  L1.valid=false ──▶ L2/L3标记DEPENDENCY_BLOCKED ──▶ REPORT_ISSUES         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 下一步

本文档已完整整合：
- Alignment核心格式定义（原12A）
- 三层对齐检查机制（原12B）
- PMB同步机制、用户决策处理、评分机制、完整流程图（原12C）

**后续工作**:
- 与 `13_chain_update_mechanism.md` 联合验证链式更新流程
- 实现三层对齐检查器的具体算法
- 集成PMB同步阻塞检查机制