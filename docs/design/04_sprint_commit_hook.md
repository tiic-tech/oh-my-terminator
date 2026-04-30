# OMT Sprint Commit Hook 实现设计文档

## 1. 架构概览

### 1.1 Hook 处理流程

```
Git Post-Commit Event
       │
       ▼
[Hook Handler Entry] (.omt/hooks/hook-handler.ts)
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
       │         ▼                         ▼
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

## 2. hook-handler.ts 主入口结构

```typescript
/**
 * OMT Sprint Commit Hook Handler
 * Location: .omt/hooks/hook-handler.ts
 * Build: pnpm
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { GraspMCPClient } from './grasp-client';
import { CommitParser } from './commit-parser';
import { BrainUpdater } from './brain-updater';
import { PMBUpdater } from './pmb-updater';
import { Logger } from './logger';

// 配置常量
const OMT_DIR: string = path.resolve(process.cwd(), '.omt');
const BRAIN_PATH: string = path.join(OMT_DIR, 'brain.json');
const PMB_PATH: string = path.join(OMT_DIR, 'memory', 'pmb.json');
const GRASP_MCP_TIMEOUT: number = 30000;

// 类型定义
interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  timestamp: Date;
}

interface SprintInfo {
  type: string;
  subject: string;
  sprint_id?: string;
  milestone_id?: string;
  sprint_number?: number;
  tasks_completed?: string[];
  tasks_failed?: string[];
  tasks_deferred?: string[];
  lessons?: string[];
}

interface ChangeAnalysis {
  changed_files: string[];
  health_score: number | null;
  grade?: string;
  hotspots: HotspotInfo[];
  analysis_mode: 'grasp_full' | 'git_fallback';
}

interface HotspotInfo {
  file: string;
  reason: string;
  score: number;
}

interface HookResult {
  status: 'pass' | 'success' | 'error';
  reason?: string;
  sprint_id?: string;
  error?: string;
}

interface NextSprintContext {
  brain: BrainData;
  pmb: PMBData;
  sprintInfo: SprintInfo;
}

interface BrainData {
  version: string;
  mirror: {
    health_score: {
      score: number;
      grade: string;
      trend: string;
      last_updated?: string;
    };
    hotspots: HotspotInfo[];
    recent_commits: RecentCommit[];
  };
  sprint_history: {
    completed: string[];
    total_health_progression: number[];
  };
}

interface PMBData {
  version: string;
  sprint_tracking: {
    completed_tasks: string[];
    failed_tasks: string[];
    deferred_tasks: string[];
    completion_rate: number;
  };
  status_summary: {
    milestone_progress: Record<string, MilestoneProgress>;
  };
  sprint_lessons: SprintLesson[];
}

interface RecentCommit {
  hash: string;
  type: string;
  sprint_id: string;
  health_delta: number;
}

interface MilestoneProgress {
  sprints_completed: number;
  health_progression: number[];
}

interface SprintLesson {
  sprint_id: string;
  category: string;
  lesson: string;
  impact: string;
}

async function main(): Promise<HookResult> {
  const logger = new Logger(OMT_DIR);
  
  try {
    // Step 1: 获取最新 commit 信息
    const commitInfo: CommitInfo = getLatestCommit();
    
    // Step 2: 解析 commit message
    const parser = new CommitParser();
    const sprintInfo: SprintInfo | null = parser.parse(commitInfo.message);
    
    // Step 3: 检查是否为 Sprint commit
    if (!sprintInfo || sprintInfo.type !== 'sprint') {
      return { status: 'pass', reason: 'non_sprint_commit' };
    }
    
    // Step 4: 调用 Grasp MCP 获取变更分析
    const graspClient = new GraspMCPClient({ timeout: GRASP_MCP_TIMEOUT });
    const changeAnalysis: ChangeAnalysis = await graspClient.detectChanges({
      commitHash: commitInfo.hash,
      sprintId: sprintInfo.sprint_id!
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
    const nextSprintContext: NextSprintContext = prepareNextSprintContext({
      brain: brainUpdater.brain,
      pmb: pmbUpdater.pmb,
      sprintInfo
    });
    
    writeNextSprintContext(nextSprintContext);
    
    return { status: 'success', sprint_id: sprintInfo.sprint_id };
    
  } catch (error: unknown) {
    return handleHookError(error as Error, logger);
  }
}

function getLatestCommit(): CommitInfo {
  return {
    hash: execSync('git rev-parse HEAD').toString().trim(),
    message: execSync('git log -1 --format=%B').toString().trim(),
    author: execSync('git log -1 --format=%an').toString().trim(),
    timestamp: new Date(parseInt(execSync('git log -1 --format=%ct').toString()) * 1000)
  };
}

function prepareNextSprintContext(context: NextSprintContext): NextSprintContext {
  // 实现细节：分析历史数据，生成建议
  return context;
}

function writeNextSprintContext(context: NextSprintContext): void {
  const outputPath: string = path.join(OMT_DIR, 'memory', 'next-sprint-context.json');
  fs.writeFileSync(outputPath, JSON.stringify(context, null, 2));
}

function handleHookError(error: Error, logger: Logger): HookResult {
  logger.error('Hook execution failed', error);
  return { status: 'error', error: error.message };
}

export { main };
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

```typescript
/**
 * Commit Parser - TypeScript Implementation
 * Location: .omt/hooks/commit-parser.ts
 */

interface ConventionalCommitParts {
  type: string | null;
  scope?: string;
  subject: string;
}

interface SprintMeta {
  sprint_id?: string;
  milestone_id?: string;
  sprint_number?: number;
  tasks_completed?: string[];
  tasks_failed?: string[];
  tasks_deferred?: string[];
  lessons?: string[];
}

interface ParsedSprintInfo extends ConventionalCommitParts, SprintMeta {}

class CommitParser {
  
  parse(message: string): ParsedSprintInfo | null {
    if (!this.hasSprintMarker(message)) {
      return null;
    }
    
    const conventionalParts: ConventionalCommitParts = this.parseConventionalCommit(message);
    const sprintMeta: SprintMeta = this.parseSprintMeta(message);
    
    return {
      type: conventionalParts.type,
      subject: conventionalParts.subject,
      scope: conventionalParts.scope,
      ...sprintMeta
    };
  }
  
  private hasSprintMarker(message: string): boolean {
    const patterns: RegExp[] = [
      /^sprint:/i,
      /SPRINT_META:/i,
      /Sprint-Id:\s*\S+/i
    ];
    return patterns.some(pattern => pattern.test(message));
  }
  
  private parseConventionalCommit(message: string): ConventionalCommitParts {
    const lines: string[] = message.split('\n');
    const firstLine: string = lines[0];
    const typeMatch: RegExpMatchArray | null = firstLine.match(/^(\w+)(?:\((\w+)\))?:\s*(.+)$/);
    
    if (!typeMatch) {
      return { type: null, subject: firstLine };
    }
    
    const [, type, scope, subject] = typeMatch;
    return { type, scope, subject: subject.trim() };
  }
  
  private parseSprintMeta(message: string): SprintMeta {
    const metaMatch: RegExpMatchArray | null = message.match(/SPRINT_META:\s*\n([\s\S]*?)(?:\n\n|\n*$/)/);
    
    if (!metaMatch) {
      return this.parseSprintFromFooter(message);
    }
    
    return this.parseSimpleYAML(metaMatch[1]);
  }
  
  private parseSprintFromFooter(message: string): SprintMeta {
    // Fallback: 从 message footer 提取 sprint 信息
    const lines: string[] = message.split('\n');
    const result: SprintMeta = {};
    
    for (const line of lines) {
      const sprintIdMatch: RegExpMatchArray | null = line.match(/Sprint-Id:\s*(\S+)/i);
      if (sprintIdMatch) {
        result.sprint_id = sprintIdMatch[1];
      }
    }
    
    return result;
  }
  
  private parseSimpleYAML(yamlContent: string): SprintMeta {
    const result: SprintMeta = {};
    const lines: string[] = yamlContent.split('\n');
    
    for (const line of lines) {
      const keyMatch: RegExpMatchArray | null = line.match(/^\s+(\w+):\s*(.*)$/);
      if (keyMatch) {
        const key: string = keyMatch[1];
        const value: string = keyMatch[2];
        
        if (value.startsWith('[') && value.endsWith(']')) {
          (result as Record<string, string[]>)[key] = value.slice(1, -1).split(',').map(s => s.trim());
        } else {
          (result as Record<string, string | number>)[key] = value.trim();
        }
      }
    }
    
    return result;
  }
}

export { CommitParser };
```

---

## 4. Grasp MCP 调用方式

### 4.1 Grasp MCP Client

```typescript
/**
 * Grasp MCP Client - TypeScript Implementation
 * Location: .omt/hooks/grasp-client.ts
 */

import { execSync } from 'child_process';

interface GraspMCPClientOptions {
  timeout?: number;
}

interface DetectChangesOptions {
  commitHash: string;
  sprintId: string;
}

interface GraspToolResult {
  files?: string[];
  score?: number;
  grade?: string;
}

interface HotspotFile {
  file: string;
  reason: string;
  score: number;
}

interface AggregatedResult {
  changed_files: string[];
  health_score: number | null;
  grade?: string;
  hotspots: HotspotFile[];
  analysis_mode: 'grasp_full' | 'git_fallback';
}

class GraspMCPClient {
  private timeout: number;
  
  constructor(options: GraspMCPClientOptions = {}) {
    this.timeout = options.timeout || 30000;
  }
  
  async detectChanges(options: DetectChangesOptions): Promise<AggregatedResult> {
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
      
    } catch (error: unknown) {
      return this.fallbackDetectChanges(commitHash);
    }
  }
  
  private async callTool(toolName: string, params: Record<string, unknown>): Promise<GraspToolResult> {
    // 通过 MCP 协议调用 Grasp
    // 实现细节: spawn npx grasp-mcp-server
    return {} as GraspToolResult;
  }
  
  private aggregateResults(
    changes: GraspToolResult | undefined,
    health: GraspToolResult | undefined,
    hotspots: GraspToolResult | undefined
  ): AggregatedResult {
    return {
      changed_files: changes?.files || [],
      health_score: health?.score ?? null,
      grade: health?.grade,
      hotspots: hotspots?.files?.map(f => ({
        file: f,
        reason: 'high_complexity',
        score: 0
      })) || [],
      analysis_mode: 'grasp_full'
    };
  }
  
  private fallbackDetectChanges(commitHash: string): AggregatedResult {
    // 使用 git diff 作为 fallback
    const changedFiles: string[] = execSync(
      `git diff-tree --no-commit-id --name-only -r ${commitHash}`
    ).toString().trim().split('\n').filter(Boolean);
    
    return {
      changed_files: changedFiles,
      health_score: null,
      hotspots: [],
      analysis_mode: 'git_fallback'
    };
  }
}

export { GraspMCPClient };
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
        "file": "src/core/engine.ts",
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

```typescript
/**
 * Brain Updater - TypeScript Implementation
 * Location: .omt/hooks/brain-updater.ts
 */

import * as fs from 'fs';

interface BrainUpdateData {
  sprintInfo: SprintInfo;
  commitInfo: CommitInfo;
  changeAnalysis: ChangeAnalysis;
}

interface BrainUpdaterResult {
  updated: boolean;
  health_score: number;
}

interface SprintInfo {
  type: string;
  subject: string;
  sprint_id?: string;
  milestone_id?: string;
  sprint_number?: number;
  tasks_completed?: string[];
  tasks_failed?: string[];
  tasks_deferred?: string[];
  lessons?: string[];
}

interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  timestamp: Date;
}

interface ChangeAnalysis {
  changed_files: string[];
  health_score: number | null;
  grade?: string;
  hotspots: HotspotInfo[];
  analysis_mode: 'grasp_full' | 'git_fallback';
}

interface HotspotInfo {
  file: string;
  reason: string;
  score: number;
}

interface BrainMirror {
  health_score: {
    score: number;
    grade: string;
    trend: string;
    last_updated?: string;
  };
  hotspots: HotspotInfo[];
  recent_commits: RecentCommit[];
}

interface RecentCommit {
  hash: string;
  type: string;
  sprint_id: string;
  health_delta: number;
}

interface BrainData {
  version: string;
  mirror: BrainMirror;
  sprint_history: {
    completed: string[];
    total_health_progression: number[];
  };
}

class BrainUpdater {
  private brainPath: string;
  public brain: BrainData;
  
  constructor(brainPath: string) {
    this.brainPath = brainPath;
    this.brain = this.loadBrain();
  }
  
  private loadBrain(): BrainData {
    if (!fs.existsSync(this.brainPath)) {
      return this.createDefaultBrain();
    }
    return JSON.parse(fs.readFileSync(this.brainPath, 'utf8')) as BrainData;
  }
  
  private createDefaultBrain(): BrainData {
    return {
      version: '1.0',
      mirror: {
        health_score: { score: 80, grade: 'B', trend: 'stable' },
        hotspots: [],
        recent_commits: []
      },
      sprint_history: {
        completed: [],
        total_health_progression: [80]
      }
    };
  }
  
  async update(updateData: BrainUpdateData): Promise<BrainUpdaterResult> {
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
  
  private updateHealthScore(changeAnalysis: ChangeAnalysis): void {
    if (changeAnalysis.health_score !== null) {
      this.brain.mirror.health_score = {
        score: changeAnalysis.health_score,
        grade: changeAnalysis.grade || 'B',
        trend: this.calculateTrend(),
        last_updated: new Date().toISOString()
      };
    }
  }
  
  private updateHotspots(changeAnalysis: ChangeAnalysis): void {
    if (changeAnalysis.hotspots.length > 0) {
      this.brain.mirror.hotspots = changeAnalysis.hotspots;
    }
  }
  
  private updateRecentCommits(commitInfo: CommitInfo, sprintInfo: SprintInfo): void {
    this.brain.mirror.recent_commits.push({
      hash: commitInfo.hash,
      type: sprintInfo.type,
      sprint_id: sprintInfo.sprint_id || '',
      health_delta: 0
    });
  }
  
  private recordHealthProgression(): void {
    this.brain.sprint_history.total_health_progression.push(
      this.brain.mirror.health_score.score
    );
  }
  
  private calculateTrend(): string {
    const progression = this.brain.sprint_history.total_health_progression;
    if (progression.length < 2) return 'stable';
    
    const last = progression[progression.length - 1];
    const prev = progression[progression.length - 2];
    
    if (last > prev + 2) return 'improving';
    if (last < prev - 2) return 'declining';
    return 'stable';
  }
  
  private saveBrain(): void {
    fs.writeFileSync(this.brainPath, JSON.stringify(this.brain, null, 2));
  }
}

export { BrainUpdater };
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

```typescript
/**
 * PMB Updater - TypeScript Implementation
 * Location: .omt/hooks/pmb-updater.ts
 */

import * as fs from 'path';
import * as path from 'path';

interface PMBUpdateData {
  sprintInfo: SprintInfo;
  commitInfo: CommitInfo;
  changeAnalysis: ChangeAnalysis;
}

interface PMBUpdaterResult {
  updated: boolean;
  sprint_tracking: SprintTracking;
}

interface SprintInfo {
  type: string;
  subject: string;
  sprint_id?: string;
  milestone_id?: string;
  sprint_number?: number;
  tasks_completed?: string[];
  tasks_failed?: string[];
  tasks_deferred?: string[];
  lessons?: string[];
}

interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  timestamp: Date;
}

interface ChangeAnalysis {
  changed_files: string[];
  health_score: number | null;
  grade?: string;
  hotspots: HotspotInfo[];
  analysis_mode: 'grasp_full' | 'git_fallback';
}

interface HotspotInfo {
  file: string;
  reason: string;
  score: number;
}

interface SprintTracking {
  completed_tasks: string[];
  failed_tasks: string[];
  deferred_tasks: string[];
  completion_rate: number;
}

interface MilestoneProgress {
  sprints_completed: number;
  health_progression: number[];
}

interface SprintLesson {
  sprint_id: string;
  category: string;
  lesson: string;
  impact: string;
}

interface PMBData {
  version: string;
  sprint_tracking: SprintTracking;
  status_summary: {
    milestone_progress: Record<string, MilestoneProgress>;
  };
  sprint_lessons: SprintLesson[];
}

class PMBUpdater {
  private pmbPath: string;
  public pmb: PMBData;
  
  constructor(pmbPath: string) {
    this.pmbPath = pmbPath;
    this.pmb = this.loadPMB();
  }
  
  private loadPMB(): PMBData {
    if (!fs.existsSync(this.pmbPath)) {
      return this.createDefaultPMB();
    }
    return JSON.parse(fs.readFileSync(this.pmbPath, 'utf8')) as PMBData;
  }
  
  private createDefaultPMB(): PMBData {
    return {
      version: '1.0',
      sprint_tracking: {
        completed_tasks: [],
        failed_tasks: [],
        deferred_tasks: [],
        completion_rate: 0
      },
      status_summary: {
        milestone_progress: {}
      },
      sprint_lessons: []
    };
  }
  
  async update(updateData: PMBUpdateData): Promise<PMBUpdaterResult> {
    const { sprintInfo } = updateData;
    
    // 1. 更新 Sprint Tracking
    this.updateSprintTracking(sprintInfo);
    
    // 2. 更新 Status Summary
    this.updateStatusSummary(sprintInfo);
    
    // 3. 记录 Lessons
    this.recordSprintLessons(sprintInfo);
    
    this.savePMB();
    
    return { updated: true, sprint_tracking: this.pmb.sprint_tracking };
  }
  
  private updateSprintTracking(sprintInfo: SprintInfo): void {
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
    const total: number = this.pmb.sprint_tracking.completed_tasks.length +
                  this.pmb.sprint_tracking.failed_tasks.length +
                  this.pmb.sprint_tracking.deferred_tasks.length;
    
    this.pmb.sprint_tracking.completion_rate = 
      total > 0 ? this.pmb.sprint_tracking.completed_tasks.length / total : 0;
  }
  
  private updateStatusSummary(sprintInfo: SprintInfo): void {
    const milestoneId = sprintInfo.milestone_id || 'default';
    
    if (!this.pmb.status_summary.milestone_progress[milestoneId]) {
      this.pmb.status_summary.milestone_progress[milestoneId] = {
        sprints_completed: 0,
        health_progression: []
      };
    }
    
    this.pmb.status_summary.milestone_progress[milestoneId].sprints_completed += 1;
  }
  
  private recordSprintLessons(sprintInfo: SprintInfo): void {
    for (const lesson of sprintInfo.lessons || []) {
      this.pmb.sprint_lessons.push({
        sprint_id: sprintInfo.sprint_id || '',
        category: 'technical',
        lesson: lesson,
        impact: 'medium'
      });
    }
  }
  
  private savePMB(): void {
    const dir: string = path.dirname(this.pmbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.pmbPath, JSON.stringify(this.pmb, null, 2));
  }
}

export { PMBUpdater };
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

### 8.1 安装后结构 (目标项目 `.omt/`)

```
.omt/
├── hooks/
│   ├── hook-handler.ts        # 主入口处理器
│   ├── commit-parser.ts       # Commit message 解析器
│   ├── grasp-client.ts        # Grasp MCP 客户端
│   ├── brain-updater.ts       # brain.json 更新器
│   ├── pmb-updater.ts         # PMB 更新器
│   ├── error-handler.ts       # 错误处理模块
│   └── logger.ts              # 日志模块
├── brain.json                 # 仓库镜像状态
├── memory/
│   ├── pmb.json               # Project Memory Brain
│   └── next-sprint-context.json
└── logs/
```

---

## 开发时 Repo 文件结构

### 开发结构 vs 安装后结构的区别

本文档 §8.1 描述的是 **安装后结构** (目标项目 `.omt/` 目录)，由 `omt init` 创建。而 **开发时结构** 是 OMT 内核本身的仓库结构，用于开发和构建这些 Hook 组件。

| 维度 | 开发时结构 (本 Repo) | 安装后结构 (目标项目 `.omt/`) |
|------|---------------------|------------------------------|
| **用途** | 开发 Hook 源码 | 运行已编译的 Hook |
| **创建方式** | 手动创建，Git 管理 | `omt init` 自动生成 |
| **生命周期** | 持久化，持续迭代 | 随项目动态变化 |
| **核心内容** | TypeScript 源码、测试 | 编译后的 JS 脚本、运行时数据 |

### Sprint Commit Hook 模块在开发结构中的位置

Sprint Commit Hook 源码位于 `src/hooks/post-commit/`:

```
src/hooks/
├── post-commit/               # Post-commit Hook (对应本文档)
│   ├── hook-handler.ts        # 主入口处理器 (对应 §2)
│   ├── commit-parser.ts       # Commit 消息解析器 (对应 §3)
│   ├── grasp-client.ts        # Grasp MCP 客户端 (对应 §4)
│   ├── brain-updater.ts       # brain.json 更新器 (对应 §5)
│   ├── pmb-updater.ts         # PMB 更新器 (对应 §6)
│   ├── error-handler.ts       # 错误处理模块 (对应 §7)
│   ├── logger.ts              # 日志模块
│   └── types.ts               # 类型定义
│
├── pre-mspec/                 # Pre-MSpec Hook
│   ├── hook-handler.ts        # Hook 主入口
│   ├── repo-query.ts          # Repo 关系查询
│   └── context-prep.ts        # Context 准备
│
└── shared/                    # 共享模块
    ├── base-hook.ts           # Hook 基类
    ├── grasp-base.ts          # Grasp 基础客户端
    └ json-utils.ts            # JSON 操作工具
```

### Hook 的测试结构

```
tests/unit/hooks/
├── post-commit.test.ts        # Post-commit Hook 主测试
├── commit-parser.test.ts      # Commit 解析器单元测试
├── brain-updater.test.ts      # Brain 更新器单元测试
├── pmb-updater.test.ts        # PMB 更新器单元测试
├── grasp-client.test.ts       # Grasp 客户端单元测试
│
tests/integration/
├── git-hooks.test.ts          # Git Hooks 集成测试
├── sprint-commit-flow.test.ts # 完整 Sprint commit 流程测试
│
tests/fixtures/
├── sample-commits/            # 示例 commit messages
│   ├── sprint-commit-valid.txt
│   ├── sprint-commit-invalid.txt
│   ├── conventional-commit.txt
│
├── sample-brain/              # 示例 brain.json
│   ├── brain-initial.json
│   ├── brain-after-sprint.json
│
├── sample-pmb/                # 示例 PMB
│   ├── pmb-initial.json
│   ├── pmb-after-sprint.json
│
├── mock-grasp/                # Mock Grasp 输出
│   ├── grasp-detect-changes.json
│   ├── grasp-health-score.json
│   ├── grasp-hotspots.json
```

### Hook 与其他模块的文件关系

| 本模块文件 | 依赖模块 | 依赖文件 |
|-----------|---------|---------|
| `hook-handler.ts` | `src/core/repo-model/` | `grasp-client.ts` |
| `brain-updater.ts` | `src/types/` | `brain.ts` |
| `pmb-updater.ts` | `src/types/` | `pmb.ts` |
| `grasp-client.ts` | `src/services/` | `mcp-service.ts`, `grasp-service.ts` |

### 构建与安装流程

```
scripts/install/
├── install-hooks.ts           # Git Hooks 安装脚本
│   # 1. 将 src/hooks/post-commit/*.ts 编译为 JS
│   # 2. 复制到目标项目 .omt/hooks/
│   # 3. 配置 Git post-commit hook 指向 .omt/hooks/hook-handler.js
│
├── create-omt-dir.ts          # .omt/ 目录创建
│   # 1. 创建 .omt/hooks/
│   # 2. 创建 .omt/memory/
│   # 3. 创建初始 brain.json, pmb.json
│
└ init-config.ts               # 初始配置生成
│   # 1. 生成 .omt/config/hooks.json
│   # 2. 配置 Grasp MCP 连接
```

### 文件命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| Hook 源码 | `hook-handler.ts`, `*-updater.ts` | `brain-updater.ts`, `pmb-updater.ts` |
| Hook 测试 | `hook-name.test.ts` | `post-commit.test.ts` |
| Hook fixtures | `sprint-commit-*.txt` | `sprint-commit-valid.txt` |
| 运行时数据 | `brain.json`, `pmb.json` | `.omt/brain.json` |
| 配置文件 | `hooks.json` | `.omt/config/hooks.json` |

### 开发结构与安装后结构的映射

| 开发时源码 | 安装后产物 | 构建命令 |
|-----------|-----------|---------|
| `src/hooks/post-commit/*.ts` | `.omt/hooks/*.js` | `pnpm build:hooks` |
| `src/types/*.ts` | 内嵌到 JS | `pnpm build:types` |
| `tests/fixtures/sample-brain/*.json` | `.omt/brain.json` 初始模板 | `omt init` |
| `tests/fixtures/sample-pmb/*.json` | `.omt/memory/pmb.json` 初始模板 | `omt init` |