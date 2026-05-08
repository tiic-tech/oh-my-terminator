# CodeGraph CLI 结构化输出设计

> 强化 Agent-Friendly CLI 设计，借鉴 OpenSpec 工作流

---

## 设计原则

| 原则 | 说明 |
|------|------|
| **JSON First** | 所有命令默认支持 `--json` 输出 |
| **状态驱动** | 返回执行状态、统计信息、下一步建议 |
| **Schema 定义** | 每个命令有明确的 JSON schema |
| **向后兼容** | 默认输出人类可读文本，`--json` 输出结构化数据 |

---

## CLI 命令扩展设计

### 1. analyze 命令

**人类可读输出**:
```
✓ Analysis complete

Files scanned: 42
Modules extracted: 156
Edges created: 89 imports, 12 exports

Baseline saved to: .codegraph/baseline.json
Time: 2.3s
```

**JSON 输出 (`--json`)**:
```json
{
  "success": true,
  "stats": {
    "filesScanned": 42,
    "modulesExtracted": 156,
    "edgesCreated": {
      "imports": 89,
      "exports": 12,
      "contains": 45
    }
  },
  "baseline": {
    "path": ".codegraph/baseline.json",
    "commitHash": "abc123",
    "timestamp": 1234567890
  },
  "durationMs": 2300,
  "warnings": [],
  "nextSuggested": ["codegraph scope --all --json", "codegraph health --json"]
}
```

---

### 2. scope 命令

**人类可读输出**:
```
## Scope: src/auth.ts
- Exports: login, logout, validateToken
- Imports: src/utils.ts, src/db.ts
...
```

**JSON 输出 (`--json`)**:
```json
{
  "target": "FILE:src/auth.ts",
  "exports": [
    {"name": "login", "kind": "function", "id": "MODULE:src/auth.ts#login"},
    {"name": "logout", "kind": "function", "id": "MODULE:src/auth.ts#logout"}
  ],
  "imports": [
    {"from": "FILE:src/utils.ts", "type": "IMPORTS", "specifiers": ["formatDate", "validate"]},
    {"from": "FILE:src/db.ts", "type": "IMPORTS", "specifiers": ["query"]}
  ],
  "importedBy": [
    {"file": "FILE:src/pages/login.tsx", "specifiers": ["login"]},
    {"file": "FILE:src/api/auth.ts", "specifiers": ["validateToken"]}
  ],
  "testFile": "FILE:tests/auth.test.ts",
  "complexity": 12,
  "lastModified": "2 days ago",
  "metadata": {
    "hasTest": true,
    "deprecated": false,
    "isHotspot": false
  }
}
```

---

### 3. impact 命令

**JSON 输出 (`--json`)**:
```json
{
  "targets": ["FILE:src/auth.ts"],
  "directImpact": [
    {"file": "FILE:src/pages/login.tsx", "relation": "imports"},
    {"file": "FILE:src/api/auth.ts", "relation": "imports"}
  ],
  "transitiveImpact": [
    {"file": "FILE:src/pages/dashboard.tsx", "depth": 2, "path": ["login.tsx", "auth.ts"]}
  ],
  "summary": {
    "directCount": 2,
    "transitiveCount": 5,
    "totalAffected": 7
  },
  "recommendations": [
    "Run tests for: tests/auth.test.ts, tests/pages/login.test.tsx",
    "Review changes in: src/pages/login.tsx, src/api/auth.ts"
  ]
}
```

---

### 4. health 命令

**JSON 输出 (`--json`)**:
```json
{
  "score": 72,
  "grade": "B",
  "details": {
    "cycles": {
      "count": 1,
      "severity": "medium",
      "nodes": ["FILE:src/a.ts", "FILE:src/b.ts"]
    },
    "architecture": {
      "layers": 4,
      "violations": 3,
      "topViolation": "src/backend imports src/frontend"
    },
    "hotspots": {
      "count": 2,
      "files": ["FILE:src/core.ts", "FILE:src/utils.ts"]
    },
    "testCoverage": {
      "estimated": 65,
      "filesWithoutTests": 12
    }
  },
  "recommendations": [
    "Fix cycle: src/a.ts ↔ src/b.ts",
    "Add tests for 12 untested files"
  ]
}
```

---

### 5. context 命令 (Agent 专用)

**JSON 输出 (`--json`)**:
```json
{
  "taskDescription": "Add user authentication to login page",
  "contextPackage": {
    "content": "## Relevant Files\n\n### src/auth.ts\n...",
    "estimatedTokens": 450,
    "filesIncluded": [
      {"path": "src/auth.ts", "relevance": 0.95},
      {"path": "src/pages/login.tsx", "relevance": 0.90},
      {"path": "src/db.ts", "relevance": 0.60}
    ],
    "filesOmitted": 3,
    "omittedReason": "token budget exceeded"
  },
  "constraints": [
    "Do not modify src/backend/** files",
    "Maintain separation between auth and db layers"
  ],
  "suggestedTests": [
    "tests/auth.test.ts",
    "tests/pages/login.test.tsx"
  ]
}
```

---

## JSON Schema 定义

每个命令应定义 schema，便于 Agent 验证：

```typescript
interface AnalyzeResult {
  success: boolean;
  stats: AnalysisStats;
  baseline: BaselineInfo;
  durationMs: number;
  warnings: string[];
  nextSuggested: string[];
}

interface ScopeResult {
  target: string;
  exports: ExportInfo[];
  imports: ImportInfo[];
  importedBy: ImportedByInfo[];
  testFile?: string;
  complexity?: number;
  lastModified?: string;
  metadata: ScopeMetadata;
}

interface ImpactResult {
  targets: string[];
  directImpact: ImpactNode[];
  transitiveImpact: TransitiveImpactNode[];
  summary: ImpactSummary;
  recommendations: string[];
}

interface HealthResult {
  score: number;
  grade: string;
  details: HealthDetails;
  recommendations: string[];
}

interface ContextResult {
  taskDescription: string;
  contextPackage: ContextPackage;
  constraints: string[];
  suggestedTests: string[];
}
```

---

## 实现建议

### MVP Phase (C9: CLI 命令)

在 Change 9 实现时，每个 CLI 命令：

1. **默认输出**: 人类可读文本
2. **`--json` flag**: 结构化 JSON 输出
3. **错误处理**: JSON 格式的错误信息

```typescript
// CLI 命令框架
program
  .command('scope <target>')
  .option('--json', 'Output as JSON')
  .action((target, options) => {
    const result = graph.getScope(target);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatScopeAsText(result));
    }
  });
```

---

## 与 OpenSpec 对齐

借鉴 OpenSpec 的设计：

| OpenSpec CLI | CodeGraph CLI 对应 |
|--------------|-------------------|
| `--change <name>` | `--file <path>` 或位置参数 |
| `--json` 输出 | `--json` 输出 |
| `status` 命令 | `health` 命令 |
| `instructions` 命令 | `context` 命令 (智能推荐) |
| 状态机管理 | 图状态管理 |

---

## Agent 使用示例

```bash
# Agent 执行全量分析
codegraph analyze --json

# Agent 解析结果，决定下一步
# if result.success && result.stats.filesScanned > 0:
#   执行 codegraph health --json 检查健康度

# Agent 查询影响范围
codegraph impact src/auth.ts --json

# Agent 构建上下文
codegraph context "Add rate limiting to API" --json --max-tokens 500
```

---

## 版本规划

| Milestone | CLI 增强 |
|-----------|---------|
| M1 (C9) | 基础命令 + `--json` 输出 |
| M3 | health/constraints 命令 JSON schema |
| M4 | context 命令 (Agent 专用) |

---

**结论**: CodeGraph 应在 Change 9 (CLI 命令) 中引入 `--json` 结构化输出设计，与 OpenSpec 工作流对齐，便于 Agent 消费。

---

**版本**: v1.0
**创建**: 2026-05-03
**关联**: Change C9: cg-cli-analyze-update