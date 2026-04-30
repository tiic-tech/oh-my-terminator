# OMT Gap 分析标准设计文档

## 技术栈声明

**TypeScript** + **pnpm**

---

## 格式选型说明

| 输出 | 格式 | 决策依据 |
|------|------|---------|
| `gap-report.md` | Markdown | 分析报告、可视化、人类阅读 |

> **待确认**: Markdown 章节格式需参考 OpenSpec 源码后校准。

---

## 1. TypeScript 类型定义

```typescript
// src/types/gap-analysis.ts

export type GapThreshold = 'small' | 'medium' | 'large';
export type GapDecision = 'ACCEPTED' | 'CONDITIONAL' | 'REJECTED';

export interface GapReport {
  projectName: string;
  calculationDate: string;
  tspecVersion: string;
  
  dimensions: {
    feature: GapDimension;
    quality: GapDimension;
    test: GapDimension;
    security: GapDimension;
  };
  
  compositeGap: number;
  thresholdCategory: GapThreshold;
  decision: GapDecision;
  mspecRequired: boolean | 'optional';
  
  recommendations: string[];
}

export interface GapDimension {
  gapPercentage: number;
  weight: number;
  weightedValue: number;
  details: Record<string, unknown>;
}
```

---

## 2. Gap 计算核心

```typescript
// src/services/gap-analysis/gap-calculator.ts

export function calculateCompositeGap(input: GapCalculationInput): GapReport {
  const featureGap = calculateFeatureGap(input.tspec, input.graspAnalysis);
  const qualityGap = calculateQualityGap(input.tspec, input.brainJson);
  const testGap = calculateTestGap(input.brainJson);
  const securityGap = calculateSecurityGap(input.brainJson);
  
  const compositeGap = 
    featureGap.weightedValue +
    qualityGap.weightedValue +
    testGap.weightedValue +
    securityGap.weightedValue;
  
  const thresholdCategory = determineThreshold(compositeGap);
  const decision = makeDecision(compositeGap);
  
  return {
    projectName: input.tspec.projectName,
    calculationDate: new Date().toISOString(),
    tspecVersion: input.tspec.version,
    dimensions: { feature: featureGap, quality: qualityGap, test: testGap, security: securityGap },
    compositeGap,
    thresholdCategory,
    decision,
    mspecRequired: decision === 'REJECTED',
    recommendations: generateRecommendations(featureGap, qualityGap, testGap, securityGap)
  };
}
```

---

## 3. 验收决策

```typescript
// src/services/gap-analysis/decision-maker.ts

export function determineThreshold(compositeGap: number): GapThreshold {
  if (compositeGap < 10) return 'small';
  if (compositeGap <= 30) return 'medium';
  return 'large';
}

export function makeDecision(compositeGap: number): GapDecision {
  const threshold = determineThreshold(compositeGap);
  
  if (threshold === 'small') return 'ACCEPTED';
  if (threshold === 'medium') return 'CONDITIONAL';
  return 'REJECTED';
}
```

---

## 4. gap-report.md 初步格式

```markdown
# Gap Analysis Report

**Project**: <project-name>
**Analysis Date**: <timestamp>
**TSpec Version**: <version>

---

## Composite Gap

| Dimension | Gap | Weight | Weighted | Status |
|-----------|-----|--------|----------|--------|
| Feature | 20.8% | 0.35 | 7.28% | ⚠️ |
| Quality | 10.0% | 0.20 | 2.0% | ⚠️ |
| Test | 21.25% | 0.25 | 5.31% | ⚠️ |
| Security | 100% | 0.20 | 20.0% | ❌ |
| **Composite** | **34.59%** | - | - | **LARGE** |

---

## Decision

**Status**: REJECTED
**Threshold**: Large (>30%)
**Action**: Create new MSpec

---

## Dimension Details

### Feature Gap (20.8%)

- Total Features: 12
- Implemented: 9.5
- Missing: 2.5

### Security Gap (100%)

- Critical: 1
- High: 2
- Medium: 3
- Low: 5

---

## MSpec Recommendation

**Type**: security-fix
**Name**: M4-security-fix

**Priority**:
1. Fix CRITICAL SQL injection
2. Fix HIGH XSS issues
```

---

## 5. 文件目录结构

```
.omt/tspecs/tspec_<timestamp>/
├── proposal.md
├── design.md
├── reviews.md
├── gap-report.md           # Markdown ✓ 分析报告
│
└── mspecs/mspec_<timestamp>/
    ├── proposal.md
    ├── design.md
    ├── reviews.md
    └── sprints/sprint_<num>/
        └── review.md

src/services/gap-analysis/
├── gap-calculator.ts
├── feature-gap-calculator.ts
├── quality-gap-calculator.ts
├── test-gap-calculator.ts
├── security-gap-calculator.ts
└── decision-maker.ts
```