# CodeGraph CLI 与 Tool API 对齐分析

> 对照 Tool API 设计 CLI 命令，确保 Agent-Friendly 和功能完整性

---

## 1. Tool API 清单（第 7 章）

| API | 功能 | Milestone | MVP? |
|-----|------|-----------|------|
| **7.1** `getScope(target)` | 输出节点的完整作用域信息 | M1 | ✓ |
| **7.2** `getQuickBrief(filePath)` | 极简版本（导入数、是否有测试、是否deprecated） | M1 | ✓ |
| **7.3** `getImpact(targets)` | 影响范围分析（BFS 下游） | M1 | ✓ |
| **7.4** `getArchitectureLayers()` | 分层描述 + 违规导入对 | M1 | ✓ |
| **7.5** `getArchConstraints()` | 架构约束规则 + 违反次数 | M3 | ✗ |
| **7.6** `buildContextFor(desc)` | 按任务描述构建上下文包 | M4 | ✗ |
| **7.7** `getChangesSince(commit)` | 变更摘要（新增/删除/修改） | M2 | ✗ |
| **7.8** `predictImpact(files)` | getImpact 别名 | M2 | ✗ |
| **7.9** `getMaturityScore()` | 成熟度评分 + 详情 | M3 | ✗ |
| **7.10** `getTestScope(file)` | 建议测试范围 | M3 | ✗ |

---

## 2. CLI 命令清单（当前设计）

| Change | 命令 | 对应 API | 参数 | --json? |
|--------|------|----------|------|---------|
| **C9** | `analyze` | 无对应（流程操作） | `[cwd]` | ❌ 未定义 |
| **C9** | `update` | 无对应（流程操作） | `[cwd]` | ❌ 未定义 |
| **C10** | `scope <target>` | `getScope` | `target` | ❌ 未定义 |
| **C10** | `impact <files...>` | `getImpact` | `files` | ❌ 未定义 |
| **C10** | `layers` | `getArchitectureLayers` | 无 | ❌ 未定义 |

### 第 15 章 CLI 命令（完整规划）

| 命令 | 功能 | Milestone | MVP? |
|------|------|-----------|------|
| `analyze` | 全量分析 + 写入基线 | M1 | ✓ |
| `update` | 增量更新 | M1 | ✓ |
| `health` | 成熟度评分 + 详情 | M3 | ✗ |
| `scope <target>` | 作用域查询 | M1 | ✓ |
| `impact <files>` | 影响范围 | M1 | ✓ |
| `constraints` | 架构约束列表 | M3 | ✗ |
| `context <desc>` | 根据描述生成上下文 | M4 | ✗ |
| `task-suggest <desc>` | 任务拆解建议 | M4 | ✗ |
| `test-scope <file>` | 测试范围推荐 | M3 | ✗ |
| `cochange <file>` | 共同修改推荐 | M4 | ✗ |
| `explore` | 交互式 REPL | M5 | ✗ |
| `report --output <path>` | HTML 报告 | M3 | ✗ |
| `serve` | MCP Server | M7 | ✗ |

---

## 3. Gap 分析

### MVP Gap（M1 需要但缺失）

| Tool API | CLI 命令 | Gap 原因 | 建议 |
|----------|----------|----------|------|
| `getQuickBrief` | ❌ 无 | C10 未包含 | **新增**: `brief <file>` |
| `getScope` | `scope` ✓ | 已覆盖 | 参数需对齐 |
| `getImpact` | `impact` ✓ | 已覆盖 | 参数需对齐 |
| `getArchitectureLayers` | `layers` ✓ | 已覆盖 | 无参数 |

### 结构化输出 Gap

| 问题 | 当前状态 | 建议 |
|------|----------|------|
| `--json` 支持 | ❌ 未定义 | **所有命令添加 `--json` flag** |
| JSON Schema | ❌ 未定义 | **为每个命令定义 schema** |
| 状态信息 | ❌ 未定义 | **添加 success/stats/durationMs** |
| 下一步建议 | ❌ 未定义 | **添加 nextSuggested 字段** |

---

## 4. CLI 命令补充建议

### MVP 补充（Change C10 扩展）

```diff
Change 10: CLI 命令 - 查询命令 [CLI]

+ **新增命令**:
+ - `codegraph brief <file>` - getQuickBrief 对应命令
+   - 输出：导入数、被导入数、是否有测试、是否deprecated
+   - --json: {imports, importedBy, hasTest, deprecated}
+
+ **所有命令添加 `--json` 输出**:
+ - `scope <target> --json`
+ - `impact <files...> --json`
+ - `layers --json`
+ - `brief <file> --json`
```

### 后续 Milestone CLI 补充

| Milestone | 新增命令 | 对应 API |
|-----------|---------|----------|
| M2 | `changes-since <commit>` | `getChangesSince` |
| M3 | `health` | `getMaturityScore` |
| M3 | `constraints` | `getArchConstraints` |
| M3 | `test-scope <file>` | `getTestScope` |
| M4 | `context <desc>` | `buildContextFor` |
| M4 | `task-suggest <desc>` | 任务辅助 API |

---

## 5. JSON Schema 设计

### analyze 命令

```typescript
interface AnalyzeResult {
  success: boolean;
  stats: {
    filesScanned: number;
    modulesExtracted: number;
    edgesCreated: { imports: number; exports: number; contains: number };
  };
  baseline: { path: string; commitHash: string; timestamp: number };
  durationMs: number;
  warnings: string[];
  nextSuggested: string[];
}
```

### scope 命令

```typescript
interface ScopeResult {
  target: string;
  exports: { name: string; kind: string; id: string }[];
  imports: { from: string; type: string; specifiers: string[] }[];
  importedBy: { file: string; specifiers: string[] }[];
  testFile?: string;
  complexity?: number;
  lastModified?: string;
  metadata: { hasTest: boolean; deprecated: boolean; isHotspot: boolean };
}
```

### brief 命令

```typescript
interface BriefResult {
  file: string;
  imports: number;
  importedBy: number;
  hasTest: boolean;
  deprecated: boolean;
  quickFacts: string[]; // ["High complexity", "No tests", "Recently modified"]
}
```

### impact 命令

```typescript
interface ImpactResult {
  targets: string[];
  directImpact: { file: string; relation: string }[];
  transitiveImpact: { file: string; depth: number; path: string[] }[];
  summary: { directCount: number; transitiveCount: number; totalAffected: number };
  recommendations: string[];
}
```

### layers 命令

```typescript
interface LayersResult {
  layers: { name: string; files: number; pathPattern: string }[];
  violations: { from: string; to: string; count: number }[];
  summary: { layerCount: number; violationCount: number };
}
```

---

## 6. 更新后的 Change Tasks 建议

### Change 9 更新

```markdown
## 1. CLI Framework Setup

- [ ] 1.1 Create CLI entry point with cac library
- [ ] 1.2 Implement --json flag handling
- [ ] 1.3 Create JSON output formatter utility

## 2. analyze Command

- [ ] 2.1 Implement analyze command
- [ ] 2.2 Add --json output with AnalyzeResult schema
- [ ] 2.3 Add success/stats/durationMs fields
- [ ] 2.4 Add nextSuggested recommendations

## 3. update Command

- [ ] 3.1 Implement update command
- [ ] 3.2 Add --json output with UpdateResult schema
- [ ] 3.3 Add change summary (added/removed/modified)
```

### Change 10 更新

```markdown
## 1. Query Commands Framework

- [ ] 1.1 Create query command base class
- [ ] 1.2 Implement --json flag for all query commands
- [ ] 1.3 Create JSON schema validators

## 2. scope Command

- [ ] 2.1 Implement scope command
- [ ] 2.2 Add --json output with ScopeResult schema
- [ ] 2.3 Handle missing node errors

## 3. brief Command (新增)

- [ ] 3.1 Implement brief command (getQuickBrief 对应)
- [ ] 3.2 Add --json output with BriefResult schema
- [ ] 3.3 Output quick facts array

## 4. impact Command

- [ ] 4.1 Implement impact command
- [ ] 4.2 Add --json output with ImpactResult schema
- [ ] 4.3 Include transitive impact and recommendations

## 5. layers Command

- [ ] 5.1 Implement layers command
- [ ] 5.2 Add --json output with LayersResult schema
- [ ] 5.3 Include violations summary
```

---

## 7. Agent 使用场景示例

### 场景 1: Agent 执行分析后获取统计

```bash
# Agent 执行
codegraph analyze --json

# 解析结果
{
  "success": true,
  "stats": { "filesScanned": 42 },
  "nextSuggested": ["codegraph health --json", "codegraph layers --json"]
}

# Agent 根据 nextSuggested 执行下一步
codegraph layers --json
```

### 场景 2: Agent 快速获取文件信息

```bash
# 人类需要详细信息
codegraph scope src/auth.ts

# Agent 需要结构化数据
codegraph brief src/auth.ts --json
# 输出: {imports: 3, importedBy: 5, hasTest: true, deprecated: false}
```

### 场景 3: Agent 分析影响范围

```bash
codegraph impact src/auth.ts src/user.ts --json

# 输出包含 recommendations
{
  "recommendations": [
    "Run tests for: tests/auth.test.ts, tests/user.test.ts",
    "Review changes in: src/pages/login.tsx"
  ]
}
```

---

## 8. 对齐检查表

| 检查项 | 状态 | 备注 |
|--------|------|------|
| Tool API 全覆盖 | ❌ | MVP 缺少 brief 命令 |
| --json flag 全支持 | ❌ | 需要在 C9/C10 实现 |
| JSON Schema 定义 | ❌ | 需要定义每个命令的 schema |
| 状态信息输出 | ❌ | 需要添加 success/stats |
| 下一步建议 | ❌ | 需要添加 nextSuggested |
| 错误处理 JSON | ❌ | 需要定义错误 JSON 格式 |

---

## 9. 结论

### 关键发现

1. **MVP Gap**: `getQuickBrief` API 缺少对应 CLI 命令 `brief`
2. **结构化输出**: 所有 CLI 命令缺少 `--json` flag 和 schema
3. **状态驱动**: 缺少 success/stats/nextSuggested 状态信息

### 建议行动

| 优先级 | 行动 | 目标 |
|--------|------|------|
| **P0** | Change C9/C10 添加 `--json` flag | Agent-Friendly |
| **P0** | Change C10 新增 `brief` 命令 | Tool API 对齐 |
| **P1** | 定义所有命令的 JSON schema | 结构化输出 |
| **P1** | 添加 success/stats/nextSuggested | 状态驱动 |
| **P2** | 定义错误 JSON 格式 | 错误处理 |

---

**版本**: v1.0
**创建**: 2026-05-03
**关联**: Change C9, C10, cli-structured-output-design.md