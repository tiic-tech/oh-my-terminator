# OMT MSpec 微调机制设计文档

## 1. 概述

### 1.1 MSpec 微调的定义

MSpec 微调是指：当 M1 完成后，Orchestrator 分析 M2 的原始 MSpec (v1.0)，结合 M1 完成的实际状态，判断是否需要调整 M2 的 Scope、Target 或 WBS。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MSpec 微调在 OMT 流程中的位置                              │
└─────────────────────────────────────────────────────────────────────────────┘

M1 所有 Sprint 完成 (WBS v1.0 全部执行)
        │
        ├── 1. 全 repo 关系建模
        │       ├── grasp_brain_index (完整索引)
        │       ├── 更新 .omt/brain.json mirror
        │       └── 获取完整 health_grade
        │
        ├── 2. M1 Review Gate
        │       ├── 检验 M1 是否达到 MSpec 目标
        │       ├── 分析 M1 完成内容的质量
        │       └── 记录到 MSpec reviews
        │
        ├── 3. MSpec 微调判断 (本设计核心)
        │       │
        │       ├── 读取 M2 原始 MSpec (v1.0)
        │       ├── 结合 M1 完成的实际状态
        │       ├── 执行触发条件检测
        │       └── 判断是否需要微调
        │               │
        │               ├── 无触发 → 保持 M2 MSpec v1.0
        │               ├── 弱触发 → 建议微调 (用户决策)
        │               └── 强触发 → 强制微调 → 生成 M2 MSpec v1.1
        │
        └── 4. 进入 M2 Sprint 执行
                │
                │ 重复 M1 的过程
                │
                ▼
        M2 完成 → 分析 M3 → ... → 所有 MSpec 完成
```

### 1.2 微调的核心原则

```yaml
mspec_adjustment_principles:
  principle_1:
    name: "最小变更原则"
    description: "微调应尽量保持 MSpec 原有结构，只修改必要的部分"
    
  principle_2:
    name: "依赖驱动原则"
    description: "微调主要基于 M1 对 M2 的依赖影响，而非主观判断"
    
  principle_3:
    name: "证据导向原则"
    description: "所有微调决策必须有 grasp/PMB 数据支撑，不能凭空调整"
    
  principle_4:
    name: "用户决策优先"
    description: "弱触发条件下，用户有权选择是否微调"
```

---

## 2. 输入数据定义

### 2.1 MSpec 微调所需的数据源

| 数据源 | 获取方式 | 用途 |
|--------|---------|------|
| M2 原始 MSpec | `openspec/changes/archive/m2-v1.0/` | 作为微调基准 |
| M1 MSpec Reviews | `openspec/changes/archive/m1/reviews/` | 了解 M1 完成情况 |
| brain.json | `.omt/brain.json` | 当前 repo 状态 |
| PMB | `.omt/memory/pmb.json` | Sprint 执行历史 |
| grasp_brain_index | MCP Server grasp | 全 repo 关系模型 |

### 2.2 数据提取结构

```yaml
mspec_adjustment_input:
  # 来源: M2 原始 MSpec
  m2_original:
    proposal:
      scope: "<M2 原始 Scope 定义>"
      target: "<M2 原始 Target 定义>"
      dependencies: "<M2 对 M1 的依赖假设>"
    design:
      modules: ["<M2 要实现的模块列表>"]
      interfaces: ["<M2 预期的接口定义>"]
    wbs_v1:
      atom_tasks: ["<原始 WBS 任务列表>"]
      total_tasks: 30
      
  # 来源: M1 Review
  m1_review:
    completion_status: "COMPLETE | PARTIAL | FAILED"
    health_grade: "A | B | C | D | F"
    deferred_tasks: ["<M1 延期任务列表>"]
    lessons: ["<M1 Sprint Lessons>"]
    
  # 来源: brain.json
  repo_state:
    health_score: 85
    hotspots: ["<当前热点文件>"]
    modules_implemented: ["<已实现模块>"]
    
  # 来源: PMB
  sprint_history:
    m1_sprints_completed: 3
    m1_total_tasks: 30
    m1_completion_rate: 0.9
    
  # 来源: grasp_brain_index
  grasp_analysis:
    architecture: "<当前架构状态>"
    module_interfaces: "<当前接口定义>"
    dependency_graph: "<当前依赖关系>"
    affected_by_m1: ["<M1 变更影响范围>"]
```

---

## 3. 触发条件分类

### 3.1 强触发条件 (必须微调)

当检测到以下条件时，**强制执行 MSpec 微调**：

```yaml
strong_triggers:
  trigger_1:
    name: "接口不兼容"
    condition: "M1 实现与 M2 预期接口不兼容"
    detection:
      - grasp_detect_changes: 发现 M2 依赖模块的接口变更
      - grasp_api_surface: M1 新增的 API 签名与 M2 预期不一致
      - M1 WBS: M1 新增的模块破坏了 M2 WBS 的依赖假设
    action:
      - 更新 M2 Design: 修改接口定义
      - 更新 M2 WBS: 添加接口适配任务
      - 生成 M2 MSpec v1.1
    example:
      scenario: "M1 实现了 OAuth2，但接口是 JWT 格式"
      impact: "M2 原本假设使用 JWT，现在需要适配 OAuth2"
      adjustment: "在 M2 WBS 添加 OAuth2 适配任务"
      
  trigger_2:
    name: "安全问题遗留"
    condition: "M1 遗留安全问题影响 M2"
    detection:
      - grasp_security: 发现 M2 目标模块有 CRITICAL/HIGH 问题
      - brain.json.security_issues: M1 未修复且涉及 M2 的安全问题
    action:
      - 更新 M2 Proposal: 添加安全修复 Scope
      - 更新 M2 WBS: 插入安全修复任务（优先级最高）
      - 生成 M2 MSpec v1.1
    example:
      scenario: "M1 遗留 SQL注入漏洞在 auth 模块"
      impact: "M2 要扩展 auth 功能，必须先修复漏洞"
      adjustment: "M2 Sprint-1 添加安全修复 atom_task"
      
  trigger_3:
    name: "健康度严重偏离"
    condition: "M1 完成后 repo 健康度不达标"
    detection:
      - brain.json.health_grade: Grade < "C"
      - grasp_metrics: 复杂度/覆盖率严重低于目标
    action:
      - 更新 M2 Proposal: 添加质量提升 Scope
      - 更新 M2 WBS: 添加重构/测试补充任务
      - 生成 M2 MSpec v1.1
    example:
      scenario: "M1 完成后 health_grade = D"
      impact: "M2 基于 D 级代码开发，风险极高"
      adjustment: "M2 前两个 Sprint 用于重构和测试补充"
      
  trigger_4:
    name: "关键依赖缺失"
    condition: "M1 未完成 M2 关键依赖"
    detection:
      - M1 deferred_tasks: 包含 M2 blocked_by 的任务
      - grasp_dependents: M2 依赖的模块未实现或部分实现
    action:
      - 更新 M2 WBS: 将 M1 deferred 任务纳入 M2
      - 或: 重新定义 M2 Scope 排除依赖
      - 生成 M2 MSpec v1.1
    example:
      scenario: "M1 deferred 了 database-migration 任务"
      impact: "M2 WBS 中的 backend-api 依赖 database-migration"
      adjustment: "将 database-migration 作为 M2 Sprint-1 首要任务"
```

### 3.2 弱触发条件 (建议微调)

当检测到以下条件时，**建议微调但需用户确认**：

```yaml
weak_triggers:
  trigger_1:
    name: "效率偏差"
    condition: "M1 完成效率与预期差异大"
    detection:
      - PMB.sprint_tracking: M1 实际耗时 vs M1 预估耗时
      - 偏差率 > 50% (严重低估或高估)
    action:
      - 建议: 调整 M2 WBS 任务复杂度估算
      - 建议: 增加 M2 时间缓冲
      - 用户决策: 是否采纳建议
    example:
      scenario: "M1 预估 40 hours，实际 80 hours"
      impact: "暗示 M2 复杂度可能也被低估"
      recommendation: "M2 WBS 任务估算 × 1.5"
      
  trigger_2:
    name: "延期任务影响"
    condition: "M1 deferred_tasks 可能影响 M2"
    detection:
      - PMB.deferred_tasks: deferred 任务与 M2 模块相关
      - grasp_affected_modules: deferred 任务的 blast radius
    action:
      - 建议: 将相关 deferred 任务纳入 M2 Scope
      - 建议: 在 M2 增加兼容性处理任务
      - 用户决策: 是否采纳建议
    example:
      scenario: "M1 deferred 了 logging-config 任务"
      impact: "M2 的 error-handling 模块依赖 logging"
      recommendation: "M2 Sprint-1 添加 logging-config 完成"
      
  trigger_3:
    name: "PMB Lessons 风险提示"
    condition: "M1 Lessons 提到 M2 相关风险"
    detection:
      - PMB.sprint_lessons: 包含 M2 相关的技术难点
      - lessons.impact = "high" 且涉及 M2 Scope
    action:
      - 建议: 在 M2 Proposal 添加风险缓解措施
      - 建议: 在 M2 WBS 添加 Spike 任务
      - 用户决策: 是否采纳建议
    example:
      scenario: "M1 Lessons: 'middleware integration underestimated'"
      impact: "M2 有更多 middleware 任务"
      recommendation: "M2 Sprint-1 添加 middleware spike"
      
  trigger_4:
    name: "热点文件重叠"
    condition: "M1 热点文件与 M2 目标模块重叠"
    detection:
      - brain.json.hotspots: 热点文件属于 M2 目标模块
      - hotspot.score > 7 (高风险)
    action:
      - 建议: 在 M2 增加重构任务降低复杂度
      - 建议: 优先处理热点模块
      - 用户决策: 是否采纳建议
    example:
      scenario: "M1 hotspot: src/auth/index.ts (score=9)"
      impact: "M2 要扩展 auth 模块"
      recommendation: "M2 Sprint-1 先重构 auth/index.ts"
```

### 3.3 无触发条件 (保持原 MSpec)

当**未检测到任何触发条件**时，保持 M2 原始 MSpec：

```yaml
no_trigger_conditions:
  condition_1:
    name: "M1 按预期完成"
    criteria:
      - M1 completion_rate >= 90%
      - M1 health_grade >= "B"
      - M1 deferred_tasks = [] 或不影响 M2
      
  condition_2:
    name: "M1 与 M2 边界清晰"
    criteria:
      - grasp_architecture: 模块边界未变化
      - M2 依赖模块未被 M1 修改
      - M1 接口与 M2 预期一致
      
  condition_3:
    name: "无安全/质量问题"
    criteria:
      - brain.json.security_issues: CRITICAL/HIGH = 0
      - M1 模块 health_grade >= "B"
      
  action:
    - 保持 M2 MSpec v1.0
    - 直接进入 M2 Sprint 执行
    - 记录 "无微调" 到 M2 Review
```

---

## 4. 微调决策算法

### 4.1 决策流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MSpec 微调决策流程                                         │
└─────────────────────────────────────────────────────────────────────────────┘

M1 Review Gate 完成
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: 数据收集                                                │
├─────────────────────────────────────────────────────────────────┤
│  • 读取 M2 原始 MSpec                                            │
│  • 读取 M1 Review                                                │
│  • 读取 brain.json                                               │
│  • 读取 PMB                                                      │
│  • 执行 grasp_brain_index 查询                                   │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: 强触发检测                                              │
├─────────────────────────────────────────────────────────────────┤
│  执行检测:                                                        │
│  • detect_interface_compatibility(m1_result, m2_expected)       │
│  • detect_security_impact(m1_security, m2_modules)              │
│  • detect_health_deviation(m1_health, target_grade)             │
│  • detect_missing_dependencies(m1_deferred, m2_blocked_by)      │
│                                                                  │
│  if 任一条件满足:                                                 │
│      → goto Step 4 (强制微调)                                    │
└─────────────────────────────────────────────────────────────────┘
        │
        │ 无强触发
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: 弱触发检测                                              │
├─────────────────────────────────────────────────────────────────┤
│  执行检测:                                                        │
│  • detect_efficiency_deviation(m1_actual, m1_estimated)          │
│  • detect_deferral_impact(m1_deferred, m2_scope)                │
│  • detect_lessons_risk(m1_lessons, m2_scope)                    │
│  • detect_hotspot_overlap(m1_hotspots, m2_modules)               │
│                                                                  │
│  if 任一条件满足:                                                 │
│      → goto Step 5 (建议微调，用户决策)                           │
│  else:                                                           │
│      → goto Step 6 (保持原 MSpec)                                │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: 强制微调                                                │
├─────────────────────────────────────────────────────────────────┤
│  根据触发类型执行:                                                │
│  • trigger_1 (接口不兼容): 更新 Design + WBS                     │
│  • trigger_2 (安全问题): 插入安全修复任务                         │
│  • trigger_3 (健康度偏离): 插入重构/测试任务                      │
│  • trigger_4 (依赖缺失): 纳入 deferred 或重定义 Scope            │
│                                                                  │
│  输出: M2 MSpec v1.1                                             │
│  记录: 微调原因到 M2 Review                                       │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 5: 建议微调                                                │
├─────────────────────────────────────────────────────────────────┤
│  生成微调建议报告:                                                │
│  • 触发条件描述                                                   │
│  • 影响范围评估                                                   │
│  • 建议调整内容                                                   │
│  • 预期收益                                                       │
│                                                                  │
│  AskUserQuestion: 是否采纳建议?                                   │
│  • YES → 执行微调 → M2 MSpec v1.1                               │
│  • NO → 保持原 MSpec → M2 MSpec v1.0                            │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 6: 保持原 MSpec                                            │
├─────────────────────────────────────────────────────────────────┤
│  • 无需修改 M2 MSpec                                             │
│  • 记录: "无微调，基于 M1 正常完成"                               │
│  • 直接进入 M2 Sprint 执行                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 检测函数实现

```python
def detect_interface_compatibility(m1_result: dict, m2_expected: dict) -> bool:
    """
    检测 M1 实现与 M2 预期接口是否兼容
    
    Returns:
        True = 不兼容 (触发微调)
        False = 兼容 (无触发)
    """
    
    # 从 M1 获取实际接口
    m1_interfaces = grasp_api_surface(m1_result.modules)
    
    # 从 M2 获取预期接口
    m2_interfaces = m2_expected.interfaces
    
    # 比较接口签名
    for expected in m2_interfaces:
        actual = find_matching_interface(m1_interfaces, expected.name)
        
        if actual is None:
            # M2 预期接口不存在
            return True
        
        if not is_signature_compatible(actual.signature, expected.signature):
            # 签名不匹配
            return True
    
    return False


def detect_security_impact(m1_security: dict, m2_modules: list) -> bool:
    """
    检测 M1 安全问题是否影响 M2
    
    Returns:
        True = 有影响 (触发微调)
        False = 无影响
    """
    
    # 获取 M1 未修复的安全问题
    unresolved_issues = m1_security.get('unresolved', [])
    
    # 检查问题是否涉及 M2 目标模块
    for issue in unresolved_issues:
        if issue.severity in ['CRITICAL', 'HIGH']:
            # 检查 blast radius
            affected_modules = grasp_dependents(issue.file)
            
            for m2_module in m2_modules:
                if m2_module in affected_modules:
                    return True
    
    return False


def detect_health_deviation(m1_health: dict, target_grade: str) -> bool:
    """
    检测 M1 健康度是否严重偏离
    
    Returns:
        True = 偏离严重 (触发微调)
        False = 达标
    """
    
    m1_grade = m1_health.get('grade', 'F')
    
    # Grade 评分映射
    grade_scores = {'A': 4, 'B': 3, 'C': 2, 'D': 1, 'F': 0}
    
    if grade_scores.get(m1_grade, 0) < grade_scores.get(target_grade, 3) - 1:
        # 相差超过一个等级
        return True
    
    # 检查具体指标
    if m1_health.get('test_coverage', 0) < 60:
        return True
    
    if m1_health.get('complexity_avg', 0) > 20:
        return True
    
    return False


def detect_missing_dependencies(m1_deferred: list, m2_blocked_by: dict) -> bool:
    """
    检测 M1 deferred 任务是否阻塞 M2
    
    Returns:
        True = 有阻塞 (触发微调)
        False = 无阻塞
    """
    
    deferred_ids = [t.task_id for t in m1_deferred]
    
    # 检查 M2 WBS 中是否有任务依赖 deferred 任务
    for task_id, blockers in m2_blocked_by.items():
        for blocker in blockers:
            if blocker in deferred_ids:
                return True
    
    return False
```

---

## 5. 微调操作类型

### 5.1 Scope 微调

```yaml
scope_adjustment_types:
  type_1:
    name: "扩展 Scope"
    trigger: "接口不兼容"
    operation:
      - 新增模块到 M2 Scope
      - 例: M1 实现了 OAuth2，M2 需添加 OAuth2-Adapter 模块
      
  type_2:
    name: "收缩 Scope"
    trigger: "依赖缺失"
    operation:
      - 移除依赖未满足的模块
      - 例: M1 deferred database，M2 移除 backend-api
      
  type_3:
    name: "替换 Scope"
    trigger: "M1 实现了预期之外的模块"
    operation:
      - 替换 M2 原定模块为新模块
      - 例: M1 实现了 Redis-session，M2 将 JWT-session 替换为 Redis-adapter
```

### 5.2 Target 微调

```yaml
target_adjustment_types:
  type_1:
    name: "降低 Target"
    trigger: "健康度偏离"
    operation:
      - 降低质量目标
      - 例: 原 Target Grade=A，调整为 Grade=B
      
  type_2:
    name: "调整验收标准"
    trigger: "安全问题遗留"
    operation:
      - 添加安全验收条件
      - 例: 新增 "0 CRITICAL/HIGH security issues" 作为验收标准
      
  type_3:
    name: "推迟交付时间"
    trigger: "效率偏差"
    operation:
      - 延长 M2 预估时间
      - 例: 原 2 weeks，调整为 3 weeks
```

### 5.3 WBS 微调

```yaml
wbs_adjustment_types:
  type_1:
    name: "插入任务"
    trigger: "安全问题/健康度偏离"
    operation:
      - 在 WBS 前部插入新任务
      - 例: Sprint-1 添加 "fix-security-issue-001"
      
  type_2:
    name: "移除任务"
    trigger: "Scope 收缩"
    operation:
      - 移除依赖不满足的任务
      - 例: 移除 "implement-backend-api" (依赖 database 未完成)
      
  type_3:
    name: "调整任务顺序"
    trigger: "延期任务影响"
    operation:
      - 优先完成 deferred 任务
      - 例: 将 deferred 的 "config-setup" 提升为 Sprint-1 Task-001
      
  type_4:
    name: "更新任务复杂度"
    trigger: "效率偏差"
    operation:
      - 重新估算任务复杂度
      - 例: 原 complexity=5，调整为 complexity=8
```

---

## 6. 微调输出格式

### 6.1 MSpec v1.1 结构

```yaml
# M2 MSpec v1.1 (微调后)
mspec_v1_1:
  version: "1.1"
  adjusted_from: "1.0"
  adjustment_reason: "<触发条件描述>"
  adjustment_date: "<timestamp>"
  
  proposal:
    scope:
      original: "<v1.0 Scope>"
      adjusted: "<v1.1 Scope>"
      change_summary: "<变更摘要>"
    target:
      original: "<v1.0 Target>"
      adjusted: "<v1.1 Target>"
    adjustment_log:
      - trigger: "interface_incompatibility"
        evidence: "M1 OAuth2 vs M2 JWT expected"
        action: "Add OAuth2-Adapter module"
        
  design:
    interfaces:
      original: [...]
      adjusted: [...]
    modules:
      original: [...]
      adjusted: [...]
      
  wbs:
    version: "1.1"
    total_tasks: 35  # 原 30 + 新增 5
    new_tasks:
      - id: "adapter-001"
        description: "Implement OAuth2 adapter"
        complexity: 6
        inserted_at: "Sprint-1 Task-001"
    removed_tasks: []
    reordered_tasks: ["config-001 → Sprint-1"]
    
  reviews:
    adjustment_review:
      trigger_detected: true
      user_confirmed: true  # 强触发时为 null
      confidence: 0.95
```

### 6.2 微调报告格式

```markdown
## MSpec 微调报告

**目标 Milestone**: M2
**原始版本**: v1.0
**微调版本**: v1.1
**微调日期**: 2026-04-30

---

### 触发条件

**触发类型**: 强触发 - 接口不兼容
**触发证据**:
- M1 实现了 OAuth2 认证 (接口: token-based)
- M2 原定使用 JWT 认证 (接口: header-based)
- 签名不匹配: OAuth2 expects `Bearer` token, M2 expects `Authorization` header

---

### 微调操作

#### Scope 变更
| 操作类型 | 内容 |
|---------|------|
| 扩展 | 新增 OAuth2-Adapter 模块 |

#### WBS 变更
| 操作类型 | 任务 | 位置 |
|---------|------|------|
| 插入 | adapter-001: Implement OAuth2 adapter | Sprint-1 Task-001 |
| 插入 | adapter-002: Create token conversion utility | Sprint-1 Task-002 |
| 重排序 | auth-middleware → Sprint-2 | 原 Sprint-1 |

---

### 预期影响

**任务数变化**: 30 → 35 (+5)
**预估时间变化**: 2 weeks → 2.5 weeks (+3 days)
**风险降低**: 高 (避免接口冲突导致的返工)

---

### 验收决策

**决策**: 强制微调
**依据**: 接口不兼容触发条件 #1
**确认状态**: 自动执行 (强触发无需用户确认)
```

---

## 7. 完整示例

### 7.1 示例场景：接口不兼容触发微调

```yaml
example_scenario:
  context:
    m1_status:
      completed_modules: ["auth-oauth2"]
      interfaces_implemented:
        - name: "login"
          signature: "OAuth2.login(provider: string) → Token"
        - name: "validate"
          signature: "OAuth2.validate(bearer_token: string) → boolean"
      health_grade: "B"
      
    m2_original:
      scope: "Extend auth system with JWT support"
      expected_interfaces:
        - name: "login"
          signature: "JWT.login(username: string, password: string) → JWTToken"
        - name: "validate"
          signature: "JWT.validate(auth_header: string) → boolean"
      wbs_tasks: 30
      
  detection:
    step_1: "detect_interface_compatibility"
    result:
      login_interface: "INCOMPATIBLE"
        - m1_actual: "OAuth2.login(provider)"
        - m2_expected: "JWT.login(username, password)"
      validate_interface: "INCOMPATIBLE"
        - m1_actual: "OAuth2.validate(bearer_token)"
        - m2_expected: "JWT.validate(auth_header)"
    trigger: "STRONG_TRIGGER_1"
    
  adjustment:
    scope_change:
      original: "Extend auth with JWT"
      adjusted: "Add OAuth2 adapter + extend auth with session management"
      reason: "M1 implemented OAuth2, M2 must adapt rather than replace"
      
    wbs_change:
      new_tasks:
        - id: "adapter-001"
          description: "Create OAuth2-to-session adapter"
          complexity: 6
          assignee_role: "backend-dev"
          blocked_by: []
        - id: "adapter-002"
          description: "Implement session token converter"
          complexity: 4
          assignee_role: "backend-dev"
          blocked_by: ["adapter-001"]
      reordered:
        - "jwt-001 → Sprint-2"  # 原 Sprint-1，现在依赖 adapter 完成
        
    target_change:
      original_target: "JWT auth system"
      adjusted_target: "OAuth2 + Session hybrid auth system"
      
  output:
    mspec_version: "v1.1"
    total_tasks: 32  # 30 + 2 new
    estimated_time: "+2 days"
    review_recorded:
      trigger: "interface_incompatibility"
      evidence: "OAuth2 vs JWT signature mismatch"
      action: "Add adapter module"
```

### 7.2 示例场景：无触发保持原 MSpec

```yaml
example_scenario_no_trigger:
  context:
    m1_status:
      completed_modules: ["core-engine", "grasp-integration"]
      interfaces_implemented:
        - name: "analyze"
          signature: "Engine.analyze(repo_path) → AnalysisResult"
      health_grade: "B"
      deferred_tasks: []
      
    m2_original:
      scope: "Implement orchestrator module"
      expected_interfaces:
        - name: "plan"
          signature: "Orchestrator.plan(query) → TaskTree"
      blocked_by: ["core-engine.analyze"]  # 依赖 M1
      
  detection:
    step_1: "detect_interface_compatibility"
    result: "COMPATIBLE"  # M2 不依赖 M1 的接口签名
    
    step_2: "detect_security_impact"
    result: "NO_IMPACT"  # M1 无安全问题
    
    step_3: "detect_health_deviation"
    result: "NO_DEVIATION"  # M1 Grade=B, Target=B
    
    step_4: "detect_missing_dependencies"
    result: "NO_BLOCKING"  # M1 deferred=[], M2 dependencies satisfied
    
    step_5: "weak_trigger_detection"
    result: "NONE"  # M1 效率正常，无延期，lessons 无风险
    
  decision:
    action: "KEEP_ORIGINAL"
    mspec_version: "v1.0"  # 保持原版
    review_recorded:
      trigger: "none"
      reason: "M1 completed normally, no impact on M2"
      
  execution:
    proceed_to: "M2 Sprint-1"
    wbs: "Original 30 tasks"
    estimated_time: "Original 2 weeks"
```

---

## 8. 与其他模块的集成

### 8.1 与 Sprint Selection 的集成

```yaml
integration_with_sprint_selection:
  flow:
    - "MSpec 微调完成 → 输出 WBS v1.1"
    - "WBS v1.1 → Sprint Selection Algorithm"
    - "Sprint Selection → 选择 Top 10 tasks 组成 Sprint-1"
    
  data_flow:
    input_to_sprint_selection:
      - "WBS.remaining_tasks (可能因微调而变化)"
      - "WBS.DAG (可能因任务插入而变化)"
      - "PMB (包含 M1 Lessons)"
      - "grasp_detect_changes (当前 repo 状态)"
      
  impact:
    - "微调可能增加任务 → WBS 增大 → Sprint Selection 需重新计算权重"
    - "微调可能重排序 → DAG 变化 → 关键路径可能变化"
    - "微调可能添加 blocker → blocked_by 变化 → 可执行池可能缩小"
```

### 8.2 与 Gap Analysis 的集成

```yaml
integration_with_gap_analysis:
  flow:
    - "所有 MSpec 完成 → Gap Analysis"
    - "Gap Analysis → 发现偏差 → 可能触发新 MSpec"
    - "新 MSpec → MSpec 微调逻辑（从上一个 MSpec 分析）"
    
  relationship:
    - "MSpec 微调发生在 Milestone 之间"
    - "Gap Analysis 发生在项目验收时"
    - "两者共同确保项目一致性"
```

---

## 9. 实现建议

### 9.1 推荐实现位置

```yaml
implementation_location:
  skill:
    path: ".claude/skills/mspec-adjustment/SKILL.md"
    purpose: "定义微调触发条件和操作"
    
  agent:
    type: "Orchestrator"
    responsibility: "执行微调决策和 MSpec 更新"
    
  files:
    - ".omt/hooks/mspec-adjuster.js"
    - ".omt/config/adjustment-rules.yaml"
```

### 9.2 关键文件清单

| 文件 | 职责 |
|------|------|
| `.claude/skills/mspec-adjustment/SKILL.md` | 微调流程定义 |
| `.omt/hooks/mspec-adjuster.js` | 微调执行逻辑 |
| `.omt/config/adjustment-rules.yaml` | 触发条件配置 |
| `openspec/changes/archive/m*/mspec-v1.x/` | MSpec 版本存储 |