# OMT MSpec 微调机制设计文档

## 技术栈声明

**TypeScript** + **pnpm**

---

## 格式选型说明

| 输出 | 格式 | 决策依据 |
|------|------|---------|
| `adjustment-review.md` | Markdown | 微调报告、人类阅读 |
| `wbs.yaml` | YAML | 程序解析 |

---

## 1. TypeScript 类型

```typescript
// src/types/mspec-adjustment.ts

export type TriggerType = 'strong' | 'weak' | 'none';

export interface AdjustmentTrigger {
  type: TriggerType;
  name: string;
  condition: string;
  evidence: string;
}

export interface MSpecAdjustmentResult {
  originalVersion: string;
  adjustedVersion: string;
  triggers: AdjustmentTrigger[];
}
```

---

## 2. 检测函数

```typescript
// src/services/mspec-adjustment/detector.ts

export function detectAdjustmentNeed(input: MSpecAdjustmentInput): {
  triggers: AdjustmentTrigger[];
  type: TriggerType;
} {
  const strongTriggers = detectStrongTriggers(input);
  if (strongTriggers.length > 0) return { triggers: strongTriggers, type: 'strong' };
  
  const weakTriggers = detectWeakTriggers(input);
  if (weakTriggers.length > 0) return { triggers: weakTriggers, type: 'weak' };
  
  return { triggers: [], type: 'none' };
}
```

---

## 3. adjustment-review.md 初步格式

```markdown
# MSpec Adjustment Review

**Adjusted From**: v1.0
**Adjustment Date**: <timestamp>

---

## Triggers

| Type | Condition | Evidence |
|------|-----------|----------|
| Strong | Interface mismatch | OAuth2 vs JWT |

---

## Adjustments

| Type | Operation | Description |
|------|-----------|-------------|
| WBS | Add | +2 adapter tasks |

---

## Impact

- Tasks: 30 → 32 (+2)
- Scope: Extended
```