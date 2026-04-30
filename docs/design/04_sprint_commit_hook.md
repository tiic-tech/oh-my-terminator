# OMT Sprint Commit Hook 实现设计文档

## 1. 架构概览

### 1.1 Hook 处理流程

```
Git Post-Commit Event
       │
       ▼
[Hook Handler Entry] (.omt/hooks/hook-handler.js)
       │
       ├─► [Commit Message Parser] ──► Is Sprint Commit?
       │         │                         │
       │         │                    NO ─► Exit (pass)
       │         │                         │
       │         │                    YES ─► Continue
       │         │                         │
       │         ▼                         ▼
       │   [Sprint Info Extractor]         │
       │         │                         │
       │         ▼                         │
       │   [Grasp MCP Client]              │
       │         │                         │
       │         ├─► grasp_detect_changes
       │         ├─► grasp_health_score
       │         ├─► grasp_hotspots
       │         │                         │
       │         ▼                         │
       │   [Change Analysis Result]        │
       │                                   │
       ▼                                   ▼
[brain.json Updater]           [pmb.json Updater]
       │                                   │
       ├─► health_score/grade              ├─► sprint_tracking
       ├─► hotspots                        ├─► status_summary
       ├─► recent_commits                  ├─► sprint_lessons
       │                                   │
       ▼                                   ▼
[Next Sprint Context Prep] ──► Hook Complete
```

---

## 2. hook-handler.js 主入口结构

```javascript
/**
 * OMT Sprint Commit Hook Handler
 * Location: .omt/hooks/hook-handler.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { GraspMCPClient } = require('./grasp-client');
const { CommitParser } = require('./commit-parser');
const { BrainUpdater } = require('./brain-updater');
const { PMBUpdater } = require('./pmb-updater');
const { Logger } = require('./logger');

// 配置常量
const OMT_DIR = path.resolve(process.cwd(), '.omt');
const BRAIN_PATH = path.join(OMT_DIR, 'brain.json');
const PMB_PATH = path.join(OMT_DIR, 'memory', 'pmb.json');
const GRASP_MCP_TIMEOUT = 30000;

async function main() {
  const logger = new Logger(OMT_DIR);
  
  try {
    // Step 1: 获取最新 commit 信息
    const commitInfo = getLatestCommit();
    
    // Step 2: 解析 commit message
    const parser = new CommitParser();
    const sprintInfo = parser.parse(commitInfo.message);
    
    // Step 3: 检查是否为 Sprint commit
    if (!sprintInfo || sprintInfo.type !== 'sprint') {
      return { status: 'pass', reason: 'non_sprint_commit' };
    }
    
    // Step 4: 调用 Grasp MCP 获取变更分析
    const graspClient = new GraspMCPClient({ timeout: GRASP_MCP_TIMEOUT });
    const changeAnalysis = await graspClient.detectChanges({
      commitHash: commitInfo.hash,
      sprintId: sprintInfo.sprint_id
    });
    
    // Step 5: 更新 brain.json
    const brainUpdater = new BrainUpdater(BRAIN_PATH);
    await brainUpdater.update({
      sprintInfo,
      commitInfo,
      changeAnalysis
    });
    
    // Step 6: 更新 pmb.json
    const pmbUpdater = new PMBUpdater(PMB_PATH);
    await pmbUpdater.update({
      sprintInfo,
      commitInfo,
      changeAnalysis
    });
    
    // Step 7: 为下一个 Sprint 准备 context
    const nextSprintContext = prepareNextSprintContext({
      brain: brainUpdater.brain,
      pmb: pmbUpdater.pmb,
      sprintInfo
    });
    
    writeNextSprintContext(nextSprintContext);
    
    return { status: 'success', sprint_id: sprintInfo.sprint_id };
    
  } catch (error) {
    return handleHookError(error, logger);
  }
}

function getLatestCommit() {
  return {
    hash: execSync('git rev-parse HEAD').toString().trim(),
    message: execSync('git log -1 --format=%B').toString().trim(),
    author: execSync('git log -1 --format=%an').toString().trim(),
    timestamp: new Date(parseInt(execSync('git log -1 --format=%ct')) * 1000)
  };
}

module.exports = { main };
```

---

## 3. Commit Message 解析逻辑

### 3.1 Sprint Commit Message 格式

```markdown
---
type: sprint
scope: <milestone-id>
subject: Sprint-N completed (X/10 tasks done, Y deferred)
---

## Sprint Summary
- Sprint ID: sprint-3
- Milestone: milestone-1
- Status: PARTIAL_COMPLETE (7 done, 3 deferred)

## Completed Tasks
- [✓] task-001: Implement OAuth2 provider class
- [✓] task-002: Add token refresh logic

## Deferred Tasks
- [○] task-003: Integrate with existing middleware
  - Reason: Interface mismatch
  - Recommendation: DEFER_TO_SPRINT-4

## Next Sprint Suggestions
1. Add spike task: research middleware compatibility

SPRINT_META:
  sprint_id: milestone-1/sprint-3
  milestone_id: milestone-1
  sprint_number: 3
  tasks_completed: [task-001, task-002]
  tasks_failed: []
  tasks_deferred: [task-003]
  lessons: ["Middleware integration underestimated"]
```

### 3.2 Commit Parser 实现

```javascript
class CommitParser {
  
  parse(message) {
    if (!this.hasSprintMarker(message)) {
      return null;
    }
    
    const conventionalParts = this.parseConventionalCommit(message);
    const sprintMeta = this.parseSprintMeta(message);
    
    return {
      type: conventionalParts.type,
      subject: conventionalParts.subject,
      ...sprintMeta
    };
  }
  
  hasSprintMarker(message) {
    const patterns = [
      /^sprint:/i,
      /SPRINT_META:/i,
      /Sprint-Id:\s*\S+/i
    ];
    return patterns.some(pattern => pattern.test(message));
  }
  
  parseConventionalCommit(message) {
    const lines = message.split('
');
    const firstLine = lines[0];
    const typeMatch = firstLine.match(/^(\w+)(?:\((\w+)\))?:\s*(.+)$/);
    
    if (!typeMatch) {
      return { type: null, subject: firstLine };
    }
    
    const [, type, scope, subject] = typeMatch;
    return { type, scope, subject: subject.trim() };
  }
  
  parseSprintMeta(message) {
    const metaMatch = message.match(/SPRINT_META:\s*
([\s\S]*?)(?:

|
*$/)/);
    
    if (!metaMatch) {
      return this.parseSprintFromFooter(message);
    }
    
    return this.parseSimpleYAML(metaMatch[1]);
  }
  
  parseSimpleYAML(yamlContent) {
    const result = {};
    const lines = yamlContent.split('
');
    
    for (const line of lines) {
      const keyMatch = line.match(/^\s+(\w+):\s*(.*)$/);
      if (keyMatch) {
        const key = keyMatch[1];
        const value = keyMatch[2];
        
        if (value.startsWith('[') && value.endsWith(']')) {
          result[key] = value.slice(1, -1).split(',').map(s => s.trim());
        } else {
          result[key] = value.trim();
        }
      }
    }
    
    return result;
  }
}

module.exports = { CommitParser };
```

---

## 4. Grasp MCP 调用方式

### 4.1 Grasp MCP Client

```javascript
class GraspMCPClient {
  
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
  }
  
  async detectChanges(options) {
    const { commitHash } = options;
    
    try {
      // 并行调用多个 Grasp 工具
      const [changes, health, hotspots] = await Promise.all([
        this.callTool('grasp_detect_changes', {
          scope: 'staged',
          analysis_depth: 'function'
        }),
        this.callTool('grasp_health_score', {}),
        this.callTool('grasp_hotspots', { limit: 10 })
      ]);
      
      return this.aggregateResults(changes, health, hotspots);
      
    } catch (error) {
      return this.fallbackDetectChanges(commitHash);
    }
  }
  
  async callTool(toolName, params) {
    // 通过 MCP 协议调用 Grasp
    // 实现细节: spawn npx grasp-mcp-server
  }
  
  aggregateResults(changes, health, hotspots) {
    return {
      changed_files: changes?.files || [],
      health_score: health?.score,
      grade: health?.grade,
      hotspots: hotspots?.files || [],
      analysis_mode: 'grasp_full'
    };
  }
  
  fallbackDetectChanges(commitHash) {
    // 使用 git diff 作为 fallback
    const changedFiles = execSync(
      `git diff-tree --no-commit-id --name-only -r ${commitHash}`
    ).toString().trim().split('
').filter(Boolean);
    
    return {
      changed_files: changedFiles,
      health_score: null,
      hotspots: [],
      analysis_mode: 'git_fallback'
    };
  }
}

module.exports = { GraspMCPClient };
```

---

## 5. brain.json 更新逻辑

### 5.1 brain.json 结构

```json
{
  "version": "1.0",
  "mirror": {
    "health_score": {
      "score": 85,
      "grade": "B",
      "trend": "stable"
    },
    "hotspots": [
      {
        "file": "src/core/engine.js",
        "reason": "high_complexity",
        "score": 8.5
      }
    ],
    "recent_commits": [
      {
        "hash": "abc123",
        "type": "sprint",
        "sprint_id": "milestone-1/sprint-3",
        "health_delta": 2
      }
    ]
  },
  "sprint_history": {
    "completed": ["milestone-1/sprint-1", "milestone-1/sprint-2"],
    "total_health_progression": [80, 82, 85]
  }
}
```

### 5.2 Brain Updater 实现

```javascript
class BrainUpdater {
  
  constructor(brainPath) {
    this.brainPath = brainPath;
    this.brain = this.loadBrain();
  }
  
  loadBrain() {
    if (!fs.existsSync(this.brainPath)) {
      return this.createDefaultBrain();
    }
    return JSON.parse(fs.readFileSync(this.brainPath, 'utf8'));
  }
  
  async update(updateData) {
    const { sprintInfo, commitInfo, changeAnalysis } = updateData;
    
    // 1. 更新健康度评分
    this.updateHealthScore(changeAnalysis);
    
    // 2. 更新热点文件
    this.updateHotspots(changeAnalysis);
    
    // 3. 更新最近提交
    this.updateRecentCommits(commitInfo, sprintInfo);
    
    // 4. 记录健康度趋势
    this.recordHealthProgression();
    
    this.saveBrain();
    
    return { updated: true, health_score: this.brain.mirror.health_score.score };
  }
  
  updateHealthScore(changeAnalysis) {
    if (changeAnalysis.health_score) {
      this.brain.mirror.health_score = {
        score: changeAnalysis.health_score,
        grade: changeAnalysis.grade,
        trend: this.calculateTrend(),
        last_updated: new Date().toISOString()
      };
    }
  }
  
  saveBrain() {
    fs.writeFileSync(this.brainPath, JSON.stringify(this.brain, null, 2));
  }
}

module.exports = { BrainUpdater };
```

---

## 6. PMB 更新逻辑

### 6.1 PMB 结构

```json
{
  "version": "1.0",
  "sprint_tracking": {
    "completed_tasks": ["task-001", "task-002"],
    "failed_tasks": [],
    "deferred_tasks": ["task-003"],
    "completion_rate": 0.8
  },
  "status_summary": {
    "milestone_progress": {
      "milestone-1": {
        "sprints_completed": 3,
        "health_progression": [80, 85, 88]
      }
    }
  },
  "sprint_lessons": [
    {
      "sprint_id": "milestone-1/sprint-3",
      "category": "technical",
      "lesson": "Middleware integration underestimated",
      "impact": "high"
    }
  ]
}
```

### 6.2 PMB Updater 实现

```javascript
class PMBUpdater {
  
  constructor(pmbPath) {
    this.pmbPath = pmbPath;
    this.pmb = this.loadPMB();
  }
  
  async update(updateData) {
    const { sprintInfo, commitInfo } = updateData;
    
    // 1. 更新 Sprint Tracking
    this.updateSprintTracking(sprintInfo);
    
    // 2. 更新 Status Summary
    this.updateStatusSummary(sprintInfo);
    
    // 3. 记录 Lessons
    this.recordSprintLessons(sprintInfo);
    
    this.savePMB();
    
    return { updated: true, sprint_tracking: this.pmb.sprint_tracking };
  }
  
  updateSprintTracking(sprintInfo) {
    // 合并任务列表
    for (const taskId of sprintInfo.tasks_completed || []) {
      if (!this.pmb.sprint_tracking.completed_tasks.includes(taskId)) {
        this.pmb.sprint_tracking.completed_tasks.push(taskId);
      }
    }
    
    for (const taskId of sprintInfo.tasks_deferred || []) {
      if (!this.pmb.sprint_tracking.deferred_tasks.includes(taskId)) {
        this.pmb.sprint_tracking.deferred_tasks.push(taskId);
      }
    }
    
    // 计算完成率
    const total = this.pmb.sprint_tracking.completed_tasks.length +
                  this.pmb.sprint_tracking.failed_tasks.length +
                  this.pmb.sprint_tracking.deferred_tasks.length;
    
    this.pmb.sprint_tracking.completion_rate = 
      this.pmb.sprint_tracking.completed_tasks.length / total;
  }
  
  savePMB() {
    const dir = path.dirname(this.pmbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.pmbPath, JSON.stringify(this.pmb, null, 2));
  }
}

module.exports = { PMBUpdater };
```

---

## 7. 错误处理策略

| 错误类型 | 处理策略 | 是否阻塞 Commit |
|---------|----------|----------------|
| Grasp MCP 超时 | 使用 git fallback | NO |
| Grasp MCP 不可用 | 使用 git fallback | NO |
| brain.json 解析错误 | 重建默认结构 | NO |
| PMB.json 写入错误 | 记录错误，跳过更新 | NO |

所有错误均不阻塞 git commit，确保开发流程不受影响。

---

## 8. 文件目录结构

```
.omt/
├── hooks/
│   ├── hook-handler.js        # 主入口处理器
│   ├── commit-parser.js       # Commit message 解析器
│   ├── grasp-client.js        # Grasp MCP 客户端
│   ├── brain-updater.js       # brain.json 更新器
│   ├── pmb-updater.js         # PMB 更新器
│   ├── error-handler.js       # 错误处理模块
│   └── logger.js              # 日志模块
├── brain.json                 # 仓库镜像状态
├── memory/
│   ├── pmb.json               # Project Memory Brain
│   └── next-sprint-context.json
└── logs/
    └─────────────────────────────────────────────────────────────────┘
```