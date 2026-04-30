# OMT 项目 Gap 分析标准设计文档

## 1. 概述

### 1.1 设计背景

OMT (Oh-My-Terminator) 项目的验收流程遵循以下架构：

```
┌─────────────────────────────────────────────────────────────────┐
│                    OMT 验收流程架构                              │
└─────────────────────────────────────────────────────────────────┘

Input Query
   │
   ▼
[Orchestrator]
   ├─ 生成顶层 TSpec (Proposal, Design, Milestones, Reviews)
   │
   ▼
For each Milestone (Fin-Start):
   ├─ pre-mspec hook: 查询模块1 (grasp_brain_index)
   ├─ 生成 MSpec (Proposal, Design, Reviews 标准, Sprints)
   │
   ▼
   For each Sprint:
      ├─ atom_tasks DAG 执行
      ├─ Sprint Review Gate
      └─ 更新 MSpec Reviews
   │
   ▼
   Milestone Review Gate → 记录至 MSpec Reviews

All Milestones Complete
   │
   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Gap 分析 + 验收决策                           │
├─────────────────────────────────────────────────────────────────┤
│  输入: TSpec (验收标准)                                          │
│  输入: 所有 MSpec reviews                                        │
│  输入: .omt/brain.json (当前 repo 状态)                          │
│  输入: grasp_brain_index (全 repo 关系模型)                      │
│                                                                 │
│  输出: Gap Report                                                │
│  决策: 验收通过 / 创建新 MSpec                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 核心数据源定义

| 数据源 | 位置 | 内容 | Gap 分析用途 |
|--------|------|------|-------------|
| TSpec | `.omt/tspecs/tspec_<timestamp>/` | 项目顶层规范：目标定义、交付物清单、关键指标 | 验收基准线 |
| MSpec Reviews | `.omt/tspecs/tspec_<timestamp>/mspecs/mspec_<timestamp>/sprints/sprint_<number>/reviews/` | 每个 Milestone 的完成情况 | 实际完成状态 |
| brain.json | `.omt/brain.json` | repo 当前状态：health_grade、完成模块 | 质量/健康指标 |
| grasp_brain_index | MCP Server grasp | 全 repo 关系模型 | 功能完整性验证 |

---

## 2. Gap 计算公式设计

### 2.1 功能 Gap (Feature Gap)

**定义**: 交付物缺失率，衡量已实现功能与 TSpec 定义目标的差距。

```
┌─────────────────────────────────────────────────────────────────┐
│                    功能 Gap 计算模型                             │
└─────────────────────────────────────────────────────────────────┘

              TSpec 交付物清单
                     │
                     ▼
     ┌───────────────────────────────────┐
     │  模块 A  │  模块 B  │  模块 C  │ ...│
     ├───────────────────────────────────┤
     │  功能1  │  功能5  │  功能9  │     │
     │  功能2  │  功能6  │  功能10 │     │
     │  功能3  │  功能7  │  功能11 │     │
     │  功能4  │  功能8  │  功能12 │     │
     └───────────────────────────────────┘
                     │
                     ▼
              grasp_brain_index 查询
                     │
                     ▼
     ┌───────────────────────────────────┐
     │  已实现  │  已实现  │  部分    │     │
     │  ✓      │  ✓      │  △      │     │
     │  ✓      │  ✗      │  ✓      │     │
     │  ✓      │  ✓      │  ✗      │     │
     └───────────────────────────────────┘
```

**计算公式**:

```typescript
// Feature Gap 计算公式
const calculateFeatureGap = (implementedFeatures: number, totalRequiredFeatures: number): number => {
  return 1 - (implementedFeatures / totalRequiredFeatures);
};

// 功能状态权重枚举
type FeatureStatus = 'complete' | 'partial' | 'missing';

const FEATURE_WEIGHTS: Record<FeatureStatus, number> = {
  complete: 1.0,  // ✓
  partial: 0.5,   // △
  missing: 0.0,   // ✗
};

// 计算已实现功能数量
const countImplementedFeatures = (features: FeatureStatus[]): number => {
  return features.reduce((sum, status) => sum + FEATURE_WEIGHTS[status], 0);
};

// 总功能数量
const getTotalFeatures = (deliverables: Record<string, string[]>): number => {
  return Object.values(deliverables).flat().length;
};
```

**详细计算步骤**:

```yaml
feature_gap_calculation:
  step_1_extract_tspec:
    source: ".omt/tspecs/tspec_<timestamp>/tspec.md"
    extraction:
      - section: "## Deliverables"
        pattern: "### Module:"
        items: "functional requirements list"
    output: 
      - deliverables_map: {module: [features]}

  step_2_query_grasp:
    tool: "grasp_brain_index"
    queries:
      - "grasp_architecture": "获取模块结构"
      - "grasp_file_deps": "验证模块存在性"
      - "grasp_metrics": "获取函数级指标"
    output:
      - implementation_status: {feature: status}

  step_3_compare:
    algorithm: "weighted_comparison"
    weights:
      complete: 1.0
      partial: 0.5
      missing: 0.0
    formula: "Σ(weighted_status) / Σ(total_features)"

  step_4_calculate_gap:
    formula: "1 - completion_rate"
    output: "Feature_Gap_Percentage"
```

**示例计算**:

```
TSpec 交付物清单:
  模块 A: 4 功能 (全部定义)
  模块 B: 4 功能 (全部定义)
  模块 C: 4 功能 (全部定义)
  总计: 12 功能

grasp_brain_index 查询结果:
  模块 A: 4 complete (✓✓✓✓) → 4.0
  模块 B: 3 complete, 1 missing (✓✗✓✓) → 3.0
  模块 C: 1 partial, 2 complete, 1 missing (△✓✗✓) → 0.5 + 1.0 + 0.0 + 1.0 = 2.5

Implemented_Features = 4.0 + 3.0 + 2.5 = 9.5
Total_Required_Features = 12

Feature_Gap = 1 - (9.5 / 12) = 1 - 0.792 = 0.208 = 20.8%
```

---

### 2.2 质量 Gap (Quality Gap)

**定义**: health_grade 偏差，衡量当前代码质量与目标质量等级的差距。

```
┌─────────────────────────────────────────────────────────────────┐
│                    质量 Gap 计算模型                             │
└─────────────────────────────────────────────────────────────────┘

           TSpec 目标 Grade                    brain.json 当前 Grade
                  │                                    │
                  ▼                                    ▼
          ┌───────────────┐                    ┌───────────────┐
          │   Grade: A    │                    │   Grade: B    │
          │  (95-100分)   │                    │  (80-89分)    │
          └───────────────┘                    └───────────────┘
                  │                                    │
                  ▼                                    ▼
          Target_Score = 95                    Current_Score = 85
                  │                                    │
                  └────────────────┬───────────────────┘
                                   │
                                   ▼
                        Quality_Gap = |95 - 85| / 100 = 10%
```

**计算公式**:

```typescript
// Grade 分数映射
type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';

const GRADE_SCORES: Record<HealthGrade, number> = {
  A: 97.5,  // 95-100 取中值
  B: 84.5,  // 80-89 取中值
  C: 74.5,  // 70-79 取中值
  D: 64.5,  // 60-69 取中值
  F: 29.5,  // 0-59 取中值
};

// 质量 Gap 计算函数
const calculateQualityGap = (targetGrade: HealthGrade, currentGrade: HealthGrade): number => {
  const targetScore = GRADE_SCORES[targetGrade];
  const currentScore = GRADE_SCORES[currentGrade];
  return Math.abs(targetScore - currentScore) / 100;
};
```

**Grade 评分体系** (基于 brain.json health_grade):

```yaml
health_grade_criteria:
  Grade_A:  # 优秀 (95-100)
    criteria:
      - test_coverage: ">= 90%"
      - no_security_issues: true
      - cyclomatic_complexity_avg: "< 10"
      - code_duplication: "< 5%"
      - documentation_coverage: ">= 80%"
    score_range: [95, 100]

  Grade_B:  # 良好 (80-89)
    criteria:
      - test_coverage: ">= 80%"
      - security_issues: "<= 2 minor"
      - cyclomatic_complexity_avg: "< 15"
      - code_duplication: "< 10%"
      - documentation_coverage: ">= 60%"
    score_range: [80, 89]

  Grade_C:  # 一般 (70-79)
    criteria:
      - test_coverage: ">= 60%"
      - security_issues: "<= 5 minor"
      - cyclomatic_complexity_avg: "< 20"
      - code_duplication: "< 15%"
      - documentation_coverage: ">= 40%"
    score_range: [70, 79]

  Grade_D:  # 较差 (60-69)
    criteria:
      - test_coverage: ">= 40%"
      - security_issues: "any severity"
      - cyclomatic_complexity_avg: "< 30"
      - code_duplication: "< 25%"
    score_range: [60, 69]

  Grade_F:  # 失败 (< 60)
    criteria:
      - test_coverage: "< 40%"
      - security_issues: "critical or high"
      - high_complexity_modules: "> 30%"
    score_range: [0, 59]
```

**示例计算**:

```
TSpec 目标 Grade: A (目标分数: 95)
brain.json 当前 Grade: B (当前分数: 85)

Quality_Gap = |95 - 85| / 100 = 10%

解读: 质量差距 10%，处于 "中等偏差" 范围，需要提升测试覆盖率和修复安全问题。
```

---

### 2.3 测试 Gap (Test Gap)

**定义**: 测试覆盖率偏差，衡量当前测试覆盖率与目标 80% 的差距。

```
┌─────────────────────────────────────────────────────────────────┐
│                    测试 Gap 计算模型                             │
└─────────────────────────────────────────────────────────────────┘

                目标覆盖率
                    │
                    ▼
            ┌───────────────┐
            │   Target:     │
            │    80%        │
            └───────────────┘
                    │
                    │
    ┌───────────────┴───────────────┐
    │                               │
    ▼                               ▼
┌───────────────┐           ┌───────────────┐
│  单元测试     │           │  集成测试     │
│  Coverage: X%│           │  Coverage: Y% │
└───────────────┘           └───────────────┘
    │                               │
    └───────────────┬───────────────┘
                    │
                    ▼
            Current_Coverage = (X + Y) / 2
                    │
                    ▼
            Test_Gap = |80% - Current_Coverage|
```

**计算公式**:

```typescript
// 默认目标覆盖率: 80%
const TARGET_COVERAGE = 0.8;

// 覆盖率权重
const COVERAGE_WEIGHTS = {
  unit: 0.4,
  integration: 0.3,
  e2e: 0.3,
};

// 计算当前覆盖率 (加权平均)
const calculateCurrentCoverage = (coverages: TestCoverage): number => {
  return (
    coverages.unit * COVERAGE_WEIGHTS.unit +
    coverages.integration * COVERAGE_WEIGHTS.integration +
    coverages.e2e * COVERAGE_WEIGHTS.e2e
  );
};

// 测试 Gap 计算函数
const calculateTestGap = (currentCoverage: number): number => {
  return Math.abs(TARGET_COVERAGE - currentCoverage) / TARGET_COVERAGE;
};

// 类型定义
interface TestCoverage {
  unit: number;      // 单元测试覆盖率 (0-1)
  integration: number; // 集成测试覆盖率 (0-1)
  e2e: number;       // E2E测试覆盖率 (0-1)
}
```

**覆盖率数据源**:

```yaml
test_coverage_sources:
  primary:
    location: ".omt/brain.json"
    fields:
      - "test_coverage.unit"
      - "test_coverage.integration"
      - "test_coverage.e2e"

  secondary:
    tool: "grasp_metrics"
    query: "grasp_test_coverage"
    output: "coverage-report.json"

  fallback:
    command: "pnpm test --coverage --reporter=json"
    output: "coverage/coverage-final.json"
    # TypeScript 项目使用 vitest 或 jest 进行覆盖率测试
```

**示例计算**:

```
目标覆盖率: 80%
当前覆盖率 (brain.json):
  - 单元测试: 75%
  - 集成测试: 60%
  - E2E测试: 50%

Current_Coverage = 75% * 0.4 + 60% * 0.3 + 50% * 0.3
                 = 30% + 18% + 15% = 63%

Test_Gap = |80% - 63%| / 80% = 17% / 80% = 21.25%

解读: 测试差距 21.25%，处于 "中等偏差" 范围，需要补充集成测试和 E2E 测试。
```

---

### 2.4 安全 Gap (Security Gap)

**定义**: 安全问题数量，衡量当前安全状态与目标 (0 issues) 的差距。

```
┌─────────────────────────────────────────────────────────────────┐
│                    安全 Gap 计算模型                             │
└─────────────────────────────────────────────────────────────────┘

                目标状态
                    │
                    ▼
            ┌───────────────┐
            │  Target:      │
            │   0 issues    │
            └───────────────┘
                    │
                    │
    ┌───────────────┴───────────────┐
    │                               │
    ▼                               ▼
┌───────────────┐           ┌───────────────┐
│  Critical: N  │           │  High: M      │
│  High: K      │           │  Medium: L    │
│  Medium: J    │           │  Low: P       │
└───────────────┘           └───────────────┘
    │                               │
    └───────────────┬───────────────┘
                    │
                    ▼
            Security_Gap = Σ(severity_weight * count)
```

**计算公式**:

```typescript
// 安全问题严重程度权重
type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

const SEVERITY_WEIGHTS: Record<SecuritySeverity, number> = {
  critical: 40,
  high: 20,
  medium: 10,
  low: 5,
  info: 1,
};

// 最大惩罚值: 100 (Gap 范围 0% - 100%)
const MAX_PENALTY = 100;

// 安全问题计数类型
interface SecurityIssueCount {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info?: number;
}

// 安全 Gap 计算函数
const calculateSecurityGap = (issues: SecurityIssueCount): number => {
  const totalPenalty = 
    issues.critical * SEVERITY_WEIGHTS.critical +
    issues.high * SEVERITY_WEIGHTS.high +
    issues.medium * SEVERITY_WEIGHTS.medium +
    issues.low * SEVERITY_WEIGHTS.low +
    (issues.info ?? 0) * SEVERITY_WEIGHTS.info;
  
  return Math.min(totalPenalty / MAX_PENALTY, 1.0);
};
```

**安全问题来源**:

```yaml
security_issues_sources:
  primary:
    location: ".omt/brain.json"
    fields:
      - "security_issues.critical"
      - "security_issues.high"
      - "security_issues.medium"
      - "security_issues.low"

  secondary:
    tools:
      - "grasp_security_scan"
      - "snyk scan"
      - "pnpm audit / npm audit"

  severity_classification:
    critical: "SQL注入、认证绕过、RCE"
    high: "XSS、CSRF、敏感数据泄露"
    medium: "信息泄露、配置错误"
    low: "最佳实践建议"
```

**示例计算**:

```
目标: 0 issues (Security_Gap = 0%)

当前安全状态:
  - Critical: 1 (权重: 40) → 40
  - High: 2 (权重: 20) → 40
  - Medium: 3 (权重: 10) → 30
  - Low: 5 (权重: 5) → 25

Σ(severity_weight * issue_count) = 40 + 40 + 30 + 25 = 135

Security_Gap = min(135 / 100, 1.0) = 100%  # 超过上限，封顶为 100%

解读: 安全差距 100%，处于 "大偏差" 范围，必须创建新 MSpec 修复安全问题。
```

---

## 3. 综合 Gap 计算 (多维度加权)

### 3.1 权重设计原则

基于 OMT 项目特性，各维度权重分配：

```yaml
gap_dimension_weights:
  feature_gap:
    weight: 0.35
    rationale: "功能完整性是验收的核心指标"
    priority: 1

  quality_gap:
    weight: 0.20
    rationale: "代码质量决定长期可维护性"
    priority: 2

  test_gap:
    weight: 0.25
    rationale: "测试覆盖率保障功能可靠性"
    priority: 3

  security_gap:
    weight: 0.20
    rationale: "安全是生产级项目的必要条件"
    priority: 4
```

### 3.2 综合 Gap 公式

```typescript
// Gap 维度权重
interface GapWeights {
  feature: number;   // 0.35
  quality: number;   // 0.20
  test: number;      // 0.25
  security: number;  // 0.20
}

const DEFAULT_GAP_WEIGHTS: GapWeights = {
  feature: 0.35,
  quality: 0.20,
  test: 0.25,
  security: 0.20,
};

// Gap 计算结果类型
interface GapResult {
  featureGap: number;
  qualityGap: number;
  testGap: number;
  securityGap: number;
  compositeGap: number;
}

// 综合 Gap 计算函数
const calculateCompositeGap = (
  gaps: Omit<GapResult, 'compositeGap'>,
  weights: GapWeights = DEFAULT_GAP_WEIGHTS
): GapResult => {
  const compositeGap = 
    gaps.featureGap * weights.feature +
    gaps.qualityGap * weights.quality +
    gaps.testGap * weights.test +
    gaps.securityGap * weights.security;
  
  return {
    ...gaps,
    compositeGap,
  };
};

// 范围: 0% - 100% (0.0 - 1.0)
```

### 3.3 Gap 计算流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                    综合 Gap 计算流程                             │
└─────────────────────────────────────────────────────────────────┘

    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │  功能 Gap   │     │  质量 Gap   │     │  测试 Gap   │
    │   × 0.35    │     │   × 0.20    │     │   × 0.25    │
    └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
           │                   │                   │
           ▼                   ▼                   ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │   20.8%     │     │    10%      │     │   21.25%    │
    │  × 0.35     │     │  × 0.20     │     │  × 0.25     │
    │  = 7.28%    │     │  = 2.0%     │     │  = 5.31%    │
    └─────────────┘     └─────────────┘     └─────────────┘
           │                   │                   │
           │                   │                   │
           └───────────────────┼───────────────────┘
                               │
                               │
    ┌─────────────┐            │
    │  安全 Gap   │            │
    │   × 0.20    │            │
    └──────┬──────┘            │
           │                   │
           ▼                   ▼
    ┌─────────────┐     ┌─────────────────────────┐
    │   100%      │     │   Σ Weighted Gaps       │
    │  × 0.20     │     │   = 7.28 + 2.0 +        │
    │  = 20%      │     │     5.31 + 20 = 34.59%  │
    └─────────────┘     └─────────────────────────┘
                               │
                               ▼
                      ┌─────────────┐
                      │ Composite   │
                      │   Gap:      │
                      │   34.59%    │
                      └─────────────┘
```

---

## 4. 验收决策逻辑

### 4.1 Gap 阈值定义

```yaml
gap_thresholds:
  small:  # 小偏差
    range: [0, 10)
    decision: "验收通过"
    action: "记录偏差，项目完结"
    mspec_required: false

  medium:  # 中等偏差
    range: [10, 30]
    decision: "需补充"
    action: "可选创建新 MSpec"
    mspec_required: "optional"
    recommendation: "评估偏差影响，决定是否补充"

  large:  # 大偏差
    range: (30, 100]
    decision: "必须创建新 MSpec"
    action: "强制创建补充 MSpec"
    mspec_required: true
    recommendation: "分析偏差原因，针对性修复"
```

### 4.2 决策算法

```typescript
// 验收决策结果类型
interface AcceptanceDecision {
  status: 'ACCEPTED' | 'CONDITIONAL' | 'REJECTED';
  threshold: 'small' | 'medium' | 'large';
  action: 'generate_acceptance_report' | 'evaluate_and_confirm' | 'create_supplemental_mspec';
  mspecRequired: boolean | 'optional';
  message: string;
  recommendation?: string;
}

// Gap 阈值常量
const GAP_THRESHOLDS = {
  small: { min: 0, max: 10 },
  medium: { min: 10, max: 30 },
  large: { min: 30, max: 100 },
};

// 验收决策函数
const acceptanceDecision = (compositeGap: number): AcceptanceDecision => {
  if (compositeGap < GAP_THRESHOLDS.small.max) {
    return {
      status: 'ACCEPTED',
      threshold: 'small',
      action: 'generate_acceptance_report',
      mspecRequired: false,
      message: `验收通过。综合 Gap: ${compositeGap.toFixed(2)}% (阈值 < 10%)`,
    };
  }
  
  if (compositeGap <= GAP_THRESHOLDS.medium.max) {
    return {
      status: 'CONDITIONAL',
      threshold: 'medium',
      action: 'evaluate_and_confirm',
      mspecRequired: 'optional',
      message: `需补充。综合 Gap: ${compositeGap.toFixed(2)}% (阈值 10-30%)`,
      recommendation: '评估偏差影响范围，决定是否创建补充 MSpec',
    };
  }
  
  // compositeGap > 30
  return {
    status: 'REJECTED',
    threshold: 'large',
    action: 'create_supplemental_mspec',
    mspecRequired: true,
    message: `必须创建新 MSpec。综合 Gap: ${compositeGap.toFixed(2)}% (阈值 > 30%)`,
    recommendation: '分析偏差根本原因，创建针对性修复 MSpec',
  };
};
```

### 4.3 分维度决策规则

当综合 Gap 处于阈值边界时，需要检查各分维度 Gap：

```yaml
dimension_specific_rules:
  security_critical:
    condition: "security_gap > 50%"
    override: true
    action: "强制创建安全修复 MSpec，无论综合 Gap 值"
    
  feature_critical:
    condition: "feature_gap > 40%"
    override: true
    action: "强制创建功能补全 MSpec"
    
  test_critical:
    condition: "test_gap > 50%"
    override: false
    action: "建议创建测试补充 MSpec，但允许用户决策"
    
  quality_critical:
    condition: "quality_gap > 30%"
    override: false
    action: "建议创建质量提升 MSpec"
```

---

## 5. 新 MSpec 创建建议

### 5.1 MSpec 创建触发条件

```yaml
mspec_creation_triggers:
  mandatory:
    - condition: "composite_gap > 30%"
      mspec_type: "gap-supplement"
      
    - condition: "security_gap > 50%"
      mspec_type: "security-fix"
      
    - condition: "feature_gap > 40%"
      mspec_type: "feature-complete"

  optional:
    - condition: "composite_gap >= 10 and <= 30"
      mspec_type: "gap-supplement"
      user_decision: true
      
    - condition: "test_gap > 50%"
      mspec_type: "test-enhance"
      user_decision: true
```

### 5.2 针对性 MSpec 模板

基于 Gap 分析结果，生成针对性 MSpec：

```yaml
mspec_template_by_gap_type:
  feature_complete:
    name_pattern: "M<next>-feature-complete"
    proposal_focus:
      - "缺失功能列表"
      - "优先级排序"
      - "实现工作量估算"
    design_focus:
      - "功能实现方案"
      - "与现有模块集成"
      - "pre-mspec hook: 查询 grasp_brain_index"
    tasks_focus:
      - "按优先级实现缺失功能"
      - "补充相关测试"
      
  security_fix:
    name_pattern: "M<next>-security-fix"
    proposal_focus:
      - "安全问题分类"
      - "严重程度排序"
      - "修复策略"
    design_focus:
      - "安全修复方案"
      - "修复顺序 (Critical → High → Medium → Low)"
      - "回归测试策略"
    tasks_focus:
      - "按严重程度修复安全问题"
      - "安全测试验证"
      
  test_enhance:
    name_pattern: "M<next>-test-enhance"
    proposal_focus:
      - "当前覆盖率分析"
      - "目标覆盖率 (80%)"
      - "测试补充范围"
    design_focus:
      - "测试策略设计"
      - "测试类型分配 (Unit/Integration/E2E)"
      - "关键路径覆盖"
    tasks_focus:
      - "补充单元测试"
      - "补充集成测试"
      - "补充 E2E 测试"
      
  quality_improve:
    name_pattern: "M<next>-quality-improve"
    proposal_focus:
      - "当前 Grade 分析"
      - "目标 Grade 定义"
      - "改进范围"
    design_focus:
      - "代码质量改进方案"
      - "重构策略"
      - "复杂度降低方案"
    tasks_focus:
      - "降低圈复杂度"
      - "消除代码重复"
      - "补充文档"
```

---

## 6. 示例计算场景

### 6.1 场景一: 小偏差验收通过

```yaml
scenario_1:
  project: "oh-my-terminator v0.1.0"
  tspec:
    deliverables:
      module_core: ["repo_scan", "grasp_integration", "brain_json"]
      module_orchestrator: ["tspec_gen", "mspec_gen", "sprint_scheduler"]
      module_executor: ["task_runner", "agent_pool"]
    target_grade: "A"
    target_test_coverage: "80%"
    target_security_issues: 0
  
  brain_json:
    health_grade: "B"
    test_coverage:
      unit: 78%
      integration: 70%
      e2e: 65%
    security_issues:
      critical: 0
      high: 0
      medium: 1
      low: 3

  gap_calculation:
    feature_gap: 6.25%      # 功能基本完成
    quality_gap: 10%        # Grade B vs A
    test_gap: 10.37%        # 覆盖率略低
    security_gap: 25%       # 有少量安全问题
    composite_gap: 9.78%    # 小于 10%

  decision:
    threshold: "small"
    status: "ACCEPTED"
    message: "验收通过。综合 Gap: 9.78%"
```

### 6.2 场景二: 大偏差需创建 MSpec

```yaml
scenario_2:
  brain_json:
    health_grade: "C"
    test_coverage:
      unit: 65%
      integration: 50%
      e2e: 40%
    security_issues:
      critical: 1
      high: 2
      medium: 5
      low: 8

  gap_calculation:
    feature_gap: 18.75%
    quality_gap: 20%
    test_gap: 33.75%
    security_gap: 100%      # Critical issue 存在
    composite_gap: 39.0%

  decision:
    threshold: "large"
    status: "REJECTED"
    override_rule: "security_critical"
    mspec_type: "security-fix"
    mspec_name: "M4-security-fix"
```

---

## 7. Gap Report 输出格式

```markdown
## Gap 分析报告

**项目**: <project_name>
**分析日期**: <analysis_date>

### 综合评估

| 指标 | Gap 值 | 权重 | 加权值 | 状态 |
|------|--------|------|--------|------|
| 功能 Gap | 20.8% | 0.35 | 7.28% | WARNING |
| 质量 Gap | 10.0% | 0.20 | 2.0% | WARNING |
| 测试 Gap | 21.25% | 0.25 | 5.31% | WARNING |
| 安全 Gap | 100% | 0.20 | 20.0% | CRITICAL |
| **综合 Gap** | **34.59%** | - | - | **LARGE** |

### 验收决策

**决策**: 必须创建新 MSpec
**阈值**: 大偏差 (Gap > 30%)

### MSpec 创建建议

**推荐类型**: security-fix
**推荐名称**: M4-security-fix
```

---

## 开发时 Repo 文件结构

### 开发结构 vs 安装后结构的区别

OMT 项目有两种截然不同的文件结构场景:

| 维度 | 开发时结构 (本 Repo) | 安装后结构 (目标项目 `.omt/`) |
|------|---------------------|------------------------------|
| **用途** | 开发 OMT harness-engine 内核 | 在目标项目中运行 OMT |
| **创建方式** | 手动创建，Git 管理 | `omt init` 或 `/omt:init` 自动生成 |
| **生命周期** | 持久化，持续迭代 | 随项目动态变化 |
| **核心内容** | 源码、测试、构建脚本 | 运行时数据、配置、缓存 |

### Gap Analysis 模块在开发结构中的位置

Gap Analysis 算法源码位于 `src/algorithms/gap-analysis/`:

```
src/algorithms/gap-analysis/
├── index.ts                # 主入口，导出 calculateGap API
├── feature-gap.ts          # 功能 Gap 计算 (对应本文档 §2.1)
├── quality-gap.ts          # 质量 Gap 计算 (对应本文档 §2.2)
├── test-gap.ts             # 测试 Gap 计算 (对应本文档 §2.3)
├── security-gap.ts         # 安全 Gap 计算 (对应本文档 §2.4)
├── composite-gap.ts        # 综合 Gap 计算 (对应本文档 §3)
├── decision-maker.ts       # 验收决策逻辑 (对应本文档 §4)
├── mspec-suggester.ts      # MSpec 创建建议 (对应本文档 §5)
└── types.ts                # Gap 相关类型定义
```

### Gap Analysis 的测试结构

```
tests/unit/algorithms/
├── gap-analysis.test.ts    # Gap Analysis 主测试
├── feature-gap.test.ts     # 功能 Gap 单元测试
├── quality-gap.test.ts     # 质量 Gap 单元测试
├── test-gap.test.ts        # 测试 Gap 单元测试
├── security-gap.test.ts    # 安全 Gap 单元测试
├── composite-gap.test.ts   # 综合 Gap 单元测试
├── decision-maker.test.ts  # 验收决策单元测试
```

### Gap Analysis 的测试 fixtures

```
tests/fixtures/
├── sample-tspecs/          # 示例 TSpec (用于验收基准线)
│   ├── tspec-basic.json
│   ├── tspec-complex.json
│
├── sample-brain/           # 示例 brain.json (用于 repo 状态)
│   ├── brain-grade-a.json
│   ├── brain-grade-b.json
│   ├── brain-grade-c.json
│   ├── brain-grade-f.json
│
├── mock-grasp/             # Mock Grasp 输出
│   ├── grasp-architecture.json
│   ├── grasp-dependents.json
│   ├── grasp-metrics.json
```

### Gap Analysis 与其他模块的文件关系

| 本模块文件 | 依赖模块 | 依赖文件 |
|-----------|---------|---------|
| `feature-gap.ts` | `src/types/` | `tspec.ts`, `grasp.ts` |
| `quality-gap.ts` | `src/types/` | `brain.ts` |
| `security-gap.ts` | `src/types/` | `brain.ts` |
| `decision-maker.ts` | `src/algorithms/mspec-adjustment/` | `types.ts` |

### 安装后结构中 Gap Analysis 的运行时数据

Gap Analysis 在目标项目中不产生独立文件，其计算结果存储在:

```
.omt/
├── brain.json              # 包含 health_grade、security_issues
├── memory/
│   ├── pmb.json            # 包含 sprint_tracking 数据
│   └── next-sprint-context.json # Gap 计算上下文
├── tspecs/
│   └── tspec_<timestamp>/
│       └── reviews/
│           └── gap-report.md  # Gap 分析报告输出
```

### 文件命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| Gap 计算模块 | `*-gap.ts` | `feature-gap.ts`, `quality-gap.ts` |
| Gap 测试文件 | `*-gap.test.ts` | `feature-gap.test.ts` |
| Gap fixtures | `gap-*.json` 或 `brain-*.json` | `brain-grade-a.json` |
| Gap 报告 | `gap-report.md` | `.omt/tspecs/.../reviews/gap-report.md` |