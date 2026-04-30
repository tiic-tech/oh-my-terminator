# OMT Sprint Commit Hook 实现设计文档

## 技术栈声明

**TypeScript** + **pnpm**

---

## 格式选型说明

| 输出 | 格式 | 决策依据 |
|------|------|---------|
| `brain.json` | JSON | 程序高频读写、解析性能最优 |
| `pmb.yaml` | YAML | 人类编辑 lessons + 程序读取 |

---

## 1. TypeScript 主入口

```typescript
// src/hooks/hook-handler.ts

export async function handleSprintCommit(): Promise<HookResult> {
  const commitInfo = getLatestCommit();
  const parser = new CommitParser();
  const sprintInfo = parser.parse(commitInfo.message);
  
  if (!sprintInfo || sprintInfo.type !== 'sprint') {
    return { status: 'pass' };
  }
  
  const graspClient = new GraspMCPClient();
  const changeAnalysis = await graspClient.detectChanges({
    commitHash: commitInfo.hash,
    sprintId: sprintInfo.sprintId
  });
  
  const brainUpdater = new BrainUpdater(BRAIN_PATH);
  await brainUpdater.update({ sprintInfo, commitInfo, changeAnalysis });
  
  const pmbUpdater = new PMBUpdater(PMB_PATH);
  await pmbUpdater.update({ sprintInfo, commitInfo, changeAnalysis });
  
  return { status: 'success', sprintId: sprintInfo.sprintId };
}
```

---

## 2. brain.json 格式

```json
{
  "version": "1.0",
  "mirror": {
    "healthScore": {
      "score": 85,
      "grade": "B",
      "trend": "stable"
    },
    "hotspots": [],
    "recentCommits": []
  },
  "sprintHistory": {
    "completed": [],
    "totalHealthProgression": []
  }
}
```

---

## 3. pmb.yaml 格式

```yaml
version: "1.0"
sprintTracking:
  completedTasks: []
  failedTasks: []
  deferredTasks: []
  completionRate: 0.8

sprintLessons:
  - sprintId: "sprint_001"
    category: "technical"
    lesson: "Middleware integration underestimated"
    impact: "high"

knownPitfalls:
  - "Auth middleware expects JWT format"
```

---

## 4. 文件目录结构

```
src/hooks/
├── hook-handler.ts
├── commit-parser.ts
├── grasp-client.ts
├── brain-updater.ts
├── pmb-updater.ts

.omt/
├── brain.json               # JSON ✓ 高频读写
├── memory/
│   └── pmb.yaml             # YAML ✓ 混合编辑
└── logs/
    └── hook-errors.json
```