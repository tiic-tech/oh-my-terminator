# C7 技术规格：Scope查询与QuickBrief

> **文档定位**: 为 `cg-api-scope` Change 提供无歧义的实现规格，消除开发歧义。
> **关联文档**: [01_origin_blueprint.md](./01_origin_blueprint.md) §7.1-7.2

---

## 1. Scope查询 (getScope)

### 1.1 输入与输出定义

```typescript
/**
 * Scope查询输入
 *
 * 支持两种目标类型：
 * - FILE 节点: 查询文件的完整导入/导出关系
 * - MODULE 节点: 查询特定导出符号的上下文
 */
interface GetScopeInput {
  /** 目标节点 ID，如 "FILE:src/auth.ts" 或 "MODULE:src/utils.ts#formatDate" */
  target: string;
}

/**
 * Scope查询输出
 *
 * 包含结构化数据和压缩文本两种形式
 */
interface GetScopeOutput {
  /** Agent友好的压缩文本输出（目标 ≤600 tokens） */
  content: string;
  /** 导出符号列表（仅 MODULE 节点） */
  exports: string[];
  /** 导入的文件/模块列表 */
  imports: string[];
  /** 被导入的文件列表（反向依赖） */
  importedBy: string[];
  /** 上游调用列表（MVP阶段可能为空，标记TODO） */
  upstreamCalls: string[];
  /** 下游调用列表（MVP阶段可能为空，标记TODO） */
  downstreamCalls: string[];
  /** 关联测试文件路径 */
  testFile: string | null;
  /** 复杂度等级和数值 */
  complexity: { level: 'low' | 'medium' | 'high'; value: number };
  /** 最近修改信息 */
  lastModified: { commit?: string; relativeTime?: string };
  /** 是否标记为 deprecated */
  deprecated: boolean;
}
```

### 1.2 核心查询算法

**步骤概览**:

```
getScope(target) → GetScopeOutput
├─ Step 1: 目标规范化 (normalizeTarget)
│   ├─ FILE:xxx → 直接使用
│   └─ MODULE:xxx#yyy → 解析所属 FILE，可选返回 MODULE 详情
│
├─ Step 2: 导出列表提取 (extractExports)
│   ├─ 从 nodes 中筛选 type=MODULE 且 path 匹配
│   └─ 按 name 排序，生成 "kind:name" 格式
│
├─ Step 3: 导入列表提取 (extractImports)
│   ├─ 从 outEdges 获取 IMPORTS/RE_EXPORTS/DYNAMIC_IMPORTS 边
│   └─ 解析目标节点 ID，去重并排序
│
├─ Step 4: 被导入列表提取 (extractImportedBy)
│   ├─ 从 inEdges 获取 IMPORTS/RE_EXPORTS 边
│   └─ 解析源节点 ID，去重并排序
│
├─ Step 5: 测试文件关联 (findTestFile)
│   ├─ 检查 metadata.testFile
│   └─ 回退命名约定匹配
│
├─ Step 6: 复杂度聚合 (aggregateComplexity)
│   ├─ FILE 节点: 聚合所有子 MODULE 的 complexity
│   └─ MODULE 节点: 直接读取 metadata.complexity
│
├─ Step 7: 格式化输出 (formatScopeOutput)
│   └─ 生成压缩文本格式
│
└─ 返回 GetScopeOutput
```

**详细算法实现**:

```typescript
import { CodeGraph, NodeType, EdgeType, GraphNode } from '../types.js';

/**
 * 目标规范化
 *
 * 将输入 ID 解析为有效的查询目标
 */
function normalizeTarget(graph: CodeGraph, target: string): {
  fileNode: GraphNode | null;
  moduleNode: GraphNode | null;
  originalTarget: string;
} {
  // 情况1: FILE 节点
  if (target.startsWith('FILE:')) {
    const fileNode = graph.getNode(target);
    return { fileNode, moduleNode: null, originalTarget: target };
  }

  // 情况2: MODULE 节点
  if (target.startsWith('MODULE:')) {
    const moduleNode = graph.getNode(target);
    if (!moduleNode) {
      return { fileNode: null, moduleNode: null, originalTarget: target };
    }

    // 解析所属 FILE 节点
    // MODULE:src/utils.ts#formatDate → FILE:src/utils.ts
    const filePath = moduleNode.path;
    const fileId = `FILE:${filePath}`;
    const fileNode = graph.getNode(fileId);

    return { fileNode, moduleNode, originalTarget: target };
  }

  // 情况3: 路径字符串（无前缀） → 自动添加 FILE: 前缀
  const fileId = `FILE:${target}`;
  const fileNode = graph.getNode(fileId);
  return { fileNode, moduleNode: null, originalTarget: fileId };
}

/**
 * 导出列表提取
 *
 * 从 FILE 节点提取所有导出的 MODULE 节点
 */
function extractExports(graph: CodeGraph, fileNode: GraphNode): string[] {
  if (!fileNode || fileNode.type !== NodeType.FILE) {
    return [];
  }

  const exports: string[] = [];

  // 遍历所有节点，筛选属于该文件的 MODULE
  for (const [id, node] of graph.nodes) {
    if (node.type !== NodeType.MODULE) continue;
    if (node.path !== fileNode.path) continue;

    // 格式: "kind:name" 或 "name"（无 kind 时）
    const kind = node.metadata?.kind || 'unknown';
    const name = node.name;
    exports.push(`${kind}:${name}`);
  }

  // 按名称排序
  exports.sort();
  return exports;
}

/**
 * 导入列表提取
 *
 * 从 outEdges 获取该文件导入的所有目标
 */
function extractImports(graph: CodeGraph, fileNode: GraphNode): string[] {
  if (!fileNode) return [];

  const imports = new Set<string>();
  const outEdges = graph.outEdges.get(fileNode.id) || [];

  for (const edge of outEdges) {
    // 处理 IMPORTS, RE_EXPORTS, DYNAMIC_IMPORTS 边
    if (edge.type === EdgeType.IMPORTS ||
        edge.type === EdgeType.RE_EXPORTS ||
        edge.type === EdgeType.DYNAMIC_IMPORTS) {

      const targetNode = graph.getNode(edge.to);
      if (targetNode) {
        // 返回文件路径（不含 FILE: 前缀）
        imports.add(targetNode.path);
      }
    }
  }

  return Array.from(imports).sort();
}

/**
 * 被导入列表提取
 *
 * 从 inEdges 获取导入该文件的所有源文件
 */
function extractImportedBy(graph: CodeGraph, fileNode: GraphNode): string[] {
  if (!fileNode) return [];

  const importedBy = new Set<string>();
  const inEdges = graph.inEdges.get(fileNode.id) || [];

  for (const edge of inEdges) {
    // 处理 IMPORTS, RE_EXPORTS 边（反向）
    if (edge.type === EdgeType.IMPORTS ||
        edge.type === EdgeType.RE_EXPORTS) {

      const sourceNode = graph.getNode(edge.from);
      if (sourceNode && sourceNode.type === NodeType.FILE) {
        importedBy.add(sourceNode.path);
      }
    }
  }

  return Array.from(importedBy).sort();
}

/**
 * 测试文件关联查找
 *
 * 优先使用 metadata.testFile，回退命名约定
 */
function findTestFile(
  graph: CodeGraph,
  fileNode: GraphNode,
  projectRoot?: string
): string | null {
  // 优先级1: MODULE 节点的 metadata.testFile
  // 遍历文件下所有 MODULE，查找 testFile
  for (const [id, node] of graph.nodes) {
    if (node.type !== NodeType.MODULE) continue;
    if (node.path !== fileNode.path) continue;

    if (node.metadata?.testFile) {
      return node.metadata.testFile;
    }
  }

  // 优先级2: FILE 节点的 metadata.testFile（如果存在）
  // 注意：当前 schema 中 FILE 节点不直接存储 testFile
  // 但为扩展性保留此逻辑

  // 优先级3: 命名约定匹配
  // src/utils.ts → src/__tests__/utils.test.ts 或 tests/utils.test.ts
  const filePath = fileNode.path;

  // 常见测试文件命名模式
  const testPatterns = [
    filePath.replace(/\.ts$/, '.test.ts'),
    filePath.replace(/\.tsx$/, '.test.tsx'),
    filePath.replace(/^src\//, 'src/__tests__/'),
    filePath.replace(/^src\//, 'tests/'),
    filePath.replace(/\.ts$/, '.spec.ts'),
  ];

  for (const testPath of testPatterns) {
    const testId = `FILE:${testPath}`;
    if (graph.getNode(testId)) {
      return testPath;
    }
  }

  return null;
}

/**
 * 复杂度聚合
 *
 * FILE 节点: 聚合所有子 MODULE 的 complexity
 * MODULE 节点: 直接读取 metadata.complexity
 */
function aggregateComplexity(
  graph: CodeGraph,
  fileNode: GraphNode,
  moduleNode?: GraphNode | null
): { level: 'low' | 'medium' | 'high'; value: number } {
  // MODULE 节点: 直接返回
  if (moduleNode && moduleNode.metadata?.complexity !== undefined) {
    const value = moduleNode.metadata.complexity;
    return { level: getComplexityLevel(value), value };
  }

  // FILE 节点: 聚合
  if (!fileNode) {
    return { level: 'low', value: 0 };
  }

  let totalComplexity = 0;

  for (const [id, node] of graph.nodes) {
    if (node.type !== NodeType.MODULE) continue;
    if (node.path !== fileNode.path) continue;

    if (node.metadata?.complexity !== undefined) {
      totalComplexity += node.metadata.complexity;
    }
  }

  return { level: getComplexityLevel(totalComplexity), value: totalComplexity };
}

/**
 * 复杂度等级判定
 */
function getComplexityLevel(value: number): 'low' | 'medium' | 'high' {
  if (value <= 5) return 'low';
  if (value <= 15) return 'medium';
  return 'high';
}

/**
 * 最近修改信息提取
 */
function getLastModified(
  graph: CodeGraph,
  fileNode: GraphNode
): { commit?: string; relativeTime?: string } {
  const result: { commit?: string; relativeTime?: string } = {};

  // 从 MODULE 节点聚合最近修改信息
  let latestCommit: string | undefined;
  let maxFrequency = 0;

  for (const [id, node] of graph.nodes) {
    if (node.type !== NodeType.MODULE) continue;
    if (node.path !== fileNode.path) continue;

    if (node.metadata?.lastModifiedCommit) {
      latestCommit = node.metadata.lastModifiedCommit;
    }
    if (node.metadata?.changeFrequency !== undefined) {
      maxFrequency = Math.max(maxFrequency, node.metadata.changeFrequency);
    }
  }

  if (latestCommit) {
    result.commit = latestCommit;
  }

  // relativeTime 可根据 changeFrequency 估算
  // 例如: changeFrequency=5 → "5 commits in last 30 days"
  if (maxFrequency > 0) {
    result.relativeTime = `${maxFrequency} commits in last 30 days`;
  }

  return result;
}

/**
 * deprecated 检测
 */
function checkDeprecated(graph: CodeGraph, fileNode: GraphNode): boolean {
  // 检查文件下是否有任何 MODULE 标记为 deprecated
  for (const [id, node] of graph.nodes) {
    if (node.type !== NodeType.MODULE) continue;
    if (node.path !== fileNode.path) continue;

    if (node.metadata?.deprecated) {
      return true;
    }
  }
  return false;
}
```

### 1.3 输出格式规范

**压缩文本格式 (Agent-Friendly)**:

目标 token 占用 ≤600，采用紧凑 Markdown 格式。

**FILE 节点输出模板**:

```markdown
## Scope: src/utils/format.ts

### Exports (5)
- function:formatDate, function:formatNumber, function:formatCurrency
- variable:DATE_FORMAT, variable:CURRENCY_SYMBOL
- default:Formatter

### Imports (3)
- ./utils/math (IMPORTS)
- lodash (EXTERNAL)
- ./config (IMPORTS)

### Imported by (4)
- src/index.ts, src/pages/Home.tsx, src/components/Button.tsx, src/api/client.ts

### Metadata
- Test: src/__tests__/format.test.ts
- Complexity: medium (12)
- Modified: 5 commits in last 30 days
- Deprecated: no
```

**MODULE 节点输出模板**:

```markdown
## Scope: formatDate (src/utils/format.ts)

### Kind
- function (exported)

### JSDoc (truncated)
- Utility function for formatting dates...

### Imports (file-level)
- see parent file

### Imported by (2)
- src/index.ts (named:formatDate)
- src/pages/Home.tsx (named:formatDate)

### Metadata
- Complexity: low (3)
- LOC: 15
- Deprecated: no
```

**空值处理规则**:

| 场景 | 输出格式 |
|------|---------|
| 无导出 | `### Exports: none` |
| 无导入 | `### Imports: none` |
| 无被导入 | `### Imported by: none (isolated)` |
| 无测试文件 | `### Test: none` |
| 无复杂度数据 | `### Complexity: unknown` |
| 无修改信息 | `### Modified: unknown` |

### 1.4 边界场景处理

| 场景 | 处理方式 |
|------|---------|
| Target 不存在 | 返回 `{ content: "## Scope Error\n- Target not found: ${target}" }` |
| 空导入列表 | 输出 "none"，不报错 |
| 空被导入列表 | 输出 "none (isolated)"，标记为孤立文件 |
| MODULE ID 解析失败 | 回退查找 FILE 节点，若无则报错 |
| EXTERNAL 节点作为目标 | 特殊处理，仅显示包名和被导入信息 |
| 无 metadata 的 MODULE | 使用默认值，不报错 |

**错误处理代码**:

```typescript
export function getScope(graph: CodeGraph, target: string): GetScopeOutput {
  const normalized = normalizeTarget(graph, target);

  // 错误处理: 目标不存在
  if (!normalized.fileNode && !normalized.moduleNode) {
    return {
      content: `## Scope Error\n- Target not found: ${target}`,
      exports: [],
      imports: [],
      importedBy: [],
      upstreamCalls: [],
      downstreamCalls: [],
      testFile: null,
      complexity: { level: 'low', value: 0 },
      lastModified: {},
      deprecated: false
    };
  }

  // EXTERNAL 节点特殊处理
  if (normalized.fileNode?.type === NodeType.EXTERNAL) {
    return getScopeForExternal(graph, normalized.fileNode);
  }

  // 正常流程
  const fileNode = normalized.fileNode!;
  const moduleNode = normalized.moduleNode;

  const exports = extractExports(graph, fileNode);
  const imports = extractImports(graph, fileNode);
  const importedBy = extractImportedBy(graph, fileNode);
  const testFile = findTestFile(graph, fileNode);
  const complexity = aggregateComplexity(graph, fileNode, moduleNode);
  const lastModified = getLastModified(graph, fileNode);
  const deprecated = checkDeprecated(graph, fileNode);

  // CALLS 边处理 (MVP 阶段可能无数据)
  const upstreamCalls: string[] = [];  // TODO: 从 CALLS 边提取
  const downstreamCalls: string[] = []; // TODO: 从 CALLS 边提取

  const content = formatScopeOutput(
    target,
    exports,
    imports,
    importedBy,
    testFile,
    complexity,
    lastModified,
    deprecated,
    moduleNode
  );

  return {
    content,
    exports,
    imports,
    importedBy,
    upstreamCalls,
    downstreamCalls,
    testFile,
    complexity,
    lastModified,
    deprecated
  };
}

/**
 * EXTERNAL 节点特殊处理
 */
function getScopeForExternal(graph: CodeGraph, node: GraphNode): GetScopeOutput {
  const importedBy = extractImportedBy(graph, node);

  const content = `## Scope: ${node.name} (EXTERNAL)

### Imported by (${importedBy.length})
${importedBy.length > 0 ? importedBy.map(f => `- ${f}`).join('\n') : '- none'}

### Note
- External package from node_modules
- No exports/imports data available`;

  return {
    content,
    exports: [],
    imports: [],
    importedBy,
    upstreamCalls: [],
    downstreamCalls: [],
    testFile: null,
    complexity: { level: 'low', value: 0 },
    lastModified: {},
    deprecated: false
  };
}
```

---

## 2. QuickBrief (getQuickBrief)

### 2.1 输入与输出定义

```typescript
/**
 * QuickBrief 输入
 *
 * 仅接受 FILE 节点路径
 */
interface GetQuickBriefInput {
  /** 文件路径，如 "src/utils/format.ts" 或 "FILE:src/utils/format.ts" */
  filePath: string;
}

/**
 * QuickBrief 输出
 *
 * 极简统计信息，目标 token ≤100
 */
interface GetQuickBriefOutput {
  /** Agent友好的压缩文本 */
  content: string;
  /** 导入文件数量 */
  importCount: number;
  /** 被导入文件数量 */
  importedByCount: number;
  /** 是否有测试文件 */
  hasTest: boolean;
  /** 是否标记 deprecated */
  deprecated: boolean;
  /** 复杂度等级 */
  complexityLevel: 'low' | 'medium' | 'high' | 'unknown';
}
```

### 2.2 统计逻辑

**简化版 Scope 查询，仅统计数量**:

```typescript
export function getQuickBrief(graph: CodeGraph, filePath: string): GetQuickBriefOutput {
  // 规范化输入
  const target = filePath.startsWith('FILE:') ? filePath : `FILE:${filePath}`;
  const fileNode = graph.getNode(target);

  // 错误处理: 文件不存在
  if (!fileNode) {
    return {
      content: `## Brief: ${filePath}\n- Status: not found`,
      importCount: 0,
      importedByCount: 0,
      hasTest: false,
      deprecated: false,
      complexityLevel: 'unknown'
    };
  }

  // 统计导入数量
  const importCount = countImports(graph, fileNode);

  // 统计被导入数量
  const importedByCount = countImportedBy(graph, fileNode);

  // 检测测试文件
  const hasTest = findTestFile(graph, fileNode) !== null;

  // 检测 deprecated
  const deprecated = checkDeprecated(graph, fileNode);

  // 获取复杂度等级
  const complexity = aggregateComplexity(graph, fileNode);
  const complexityLevel = complexity.level;

  // 格式化输出
  const content = formatQuickBriefOutput(
    filePath,
    importCount,
    importedByCount,
    hasTest,
    deprecated,
    complexityLevel
  );

  return {
    content,
    importCount,
    importedByCount,
    hasTest,
    deprecated,
    complexityLevel
  };
}

/**
 * 统计导入数量
 */
function countImports(graph: CodeGraph, fileNode: GraphNode): number {
  const outEdges = graph.outEdges.get(fileNode.id) || [];
  return outEdges.filter(e =>
    e.type === EdgeType.IMPORTS ||
    e.type === EdgeType.RE_EXPORTS ||
    e.type === EdgeType.DYNAMIC_IMPORTS
  ).length;
}

/**
 * 统计被导入数量
 */
function countImportedBy(graph: CodeGraph, fileNode: GraphNode): number {
  const inEdges = graph.inEdges.get(fileNode.id) || [];
  return inEdges.filter(e =>
    e.type === EdgeType.IMPORTS ||
    e.type === EdgeType.RE_EXPORTS
  ).length;
}
```

### 2.3 输出格式

**压缩文本格式**:

```markdown
## Brief: src/utils/format.ts
- Imports: 3
- Imported by: 4
- Test: yes
- Deprecated: no
- Complexity: medium
```

**极简版本 (单行)**:

```
format.ts: 3 in, 4 out, tested, medium complexity
```

**格式化代码**:

```typescript
function formatQuickBriefOutput(
  filePath: string,
  importCount: number,
  importedByCount: number,
  hasTest: boolean,
  deprecated: boolean,
  complexityLevel: string
): string {
  const fileName = filePath.split('/').pop() || filePath;
  const testStatus = hasTest ? 'yes' : 'no';
  const deprecatedStatus = deprecated ? 'yes (WARNING)' : 'no';

  return `## Brief: ${filePath}
- Imports: ${importCount}
- Imported by: ${importedByCount}
- Test: ${testStatus}
- Deprecated: ${deprecatedStatus}
- Complexity: ${complexityLevel}`;
}
```

---

## 3. 公共类型定义

```typescript
// packages/codegraph/src/api/types.ts

/**
 * Scope 查询结果
 */
export interface ScopeResult {
  content: string;
  exports: string[];
  imports: string[];
  importedBy: string[];
  upstreamCalls: string[];
  downstreamCalls: string[];
  testFile: string | null;
  complexity: ComplexityInfo;
  lastModified: ModifiedInfo;
  deprecated: boolean;
}

/**
 * QuickBrief 查询结果
 */
export interface QuickBriefResult {
  content: string;
  importCount: number;
  importedByCount: number;
  hasTest: boolean;
  deprecated: boolean;
  complexityLevel: 'low' | 'medium' | 'high' | 'unknown';
}

/**
 * 复杂度信息
 */
export interface ComplexityInfo {
  level: 'low' | 'medium' | 'high';
  value: number;
}

/**
 * 最近修改信息
 */
export interface ModifiedInfo {
  commit?: string;
  relativeTime?: string;
}
```

---

## 4. 测试场景

### 4.1 Fixture 结构

使用现有 fixture: `packages/codegraph/tests/fixtures/import-test-project/`

```
fixtures/import-test-project/
├── src/
│   ├── index.ts              # 主入口，导入多个文件
│   ├── utils/
│   │   ├── format.ts         # 被多个文件导入
│   │   └── math.ts           # 被 index.ts 和 re-export.ts 导入
│   ├── config.ts             # 被 index.ts 导入
│   ├── re-export.ts          # 重导出场景
│   ├── dynamic-import.ts     # 动态导入
│   ├── external-refs.ts      # 外部依赖
│   └── components/
│       └── Button.tsx        # React 组件
└── tsconfig.json             # 带 paths 配置
```

### 4.2 getScope 测试场景

**场景 1: FILE 节点查询 - 核心文件**

输入: `getScope("FILE:src/utils/format.ts")`

期望输出:

```markdown
## Scope: src/utils/format.ts

### Exports (5)
- function:formatDate, function:formatNumber, function:formatCurrency
- variable:DATE_FORMAT, variable:CURRENCY_SYMBOL
- default:Formatter

### Imports
- none (leaf file)

### Imported by (3)
- src/index.ts, src/re-export.ts, [可能更多]

### Metadata
- Test: none
- Complexity: [根据 fixture 计算]
- Modified: unknown
- Deprecated: no
```

**场景 2: FILE 节点查询 - 主入口文件**

输入: `getScope("FILE:src/index.ts")`

期望输出:

```markdown
## Scope: src/index.ts

### Exports (3)
- function:main, type:FormatResult, interface:AppConfig

### Imports (5)
- ./utils/format (IMPORTS)
- ./utils/math (IMPORTS)
- ./config (IMPORTS)
- lodash (EXTERNAL)
- ./dynamic-import (IMPORTS)

### Imported by
- none (entry point)

### Metadata
- Test: none
- Complexity: [根据 fixture 计算]
- Deprecated: no
```

**场景 3: MODULE 节点查询**

输入: `getScope("MODULE:src/utils/format.ts#formatDate")`

期望输出:

```markdown
## Scope: formatDate (src/utils/format.ts)

### Kind
- function (exported)

### Imported by
- src/index.ts, src/re-export.ts

### Metadata
- Complexity: low
- LOC: [根据 fixture]
- Deprecated: no
```

**场景 4: EXTERNAL 节点查询**

输入: `getScope("EXTERNAL:lodash")`

期望输出:

```markdown
## Scope: lodash (EXTERNAL)

### Imported by (2)
- src/index.ts, src/re-export.ts

### Note
- External package from node_modules
- No exports/imports data available
```

**场景 5: Target 不存在**

输入: `getScope("FILE:src/nonexistent.ts")`

期望输出:

```markdown
## Scope Error
- Target not found: FILE:src/nonexistent.ts
```

**场景 6: 孤立文件**

输入: `getScope("FILE:src/external-refs.ts")` (假设无导入者)

期望输出包含:

```markdown
### Imported by
- none (isolated)
```

### 4.3 getQuickBrief 测试场景

**场景 1: 核心文件**

输入: `getQuickBrief("src/utils/format.ts")`

期望输出:

```markdown
## Brief: src/utils/format.ts
- Imports: 0
- Imported by: 3
- Test: no
- Deprecated: no
- Complexity: medium
```

**场景 2: 入口文件**

输入: `getQuickBrief("src/index.ts")`

期望输出:

```markdown
## Brief: src/index.ts
- Imports: 5
- Imported by: 0
- Test: no
- Deprecated: no
- Complexity: medium
```

**场景 3: 文件不存在**

输入: `getQuickBrief("src/nonexistent.ts")`

期望输出:

```markdown
## Brief: src/nonexistent.ts
- Status: not found
```

**场景 4: Deprecated 文件**

输入: `getQuickBrief("src/utils/deprecated.ts")` (fixture 需添加)

期望输出:

```markdown
## Brief: src/utils/deprecated.ts
- Imports: 1
- Imported by: 2
- Test: no
- Deprecated: yes (WARNING)
- Complexity: low
```

### 4.4 单元测试清单

```typescript
// tests/unit/api/scope.test.ts

describe('getScope', () => {
  it('should return exports list for FILE node', () => {
    // 验证导出符号列表正确
  });

  it('should return imports list for FILE node', () => {
    // 验证导入文件列表正确
  });

  it('should return imported-by list for FILE node', () => {
    // 验证反向依赖列表正确
  });

  it('should handle MODULE node by resolving to FILE', () => {
    // MODULE 输入转换为 FILE 并返回额外信息
  });

  it('should handle EXTERNAL node specially', () => {
    // EXTERNAL 节点返回简化信息
  });

  it('should return error for nonexistent target', () => {
    // 目标不存在时的错误处理
  });

  it('should mark isolated files correctly', () => {
    // 无导入者的文件标记为 isolated
  });

  it('should find test file by naming convention', () => {
    // 命名约定匹配测试文件
  });

  it('should aggregate complexity for FILE node', () => {
    // FILE 节点复杂度聚合正确
  });

  it('should detect deprecated status', () => {
    // deprecated 检测正确
  });

  it('should handle empty exports/imports gracefully', () => {
    // 空列表处理不报错
  });

  it('should handle wildcard re-exports', () => {
    // A3 场景: 通配符重导出处理
  });
});

describe('getQuickBrief', () => {
  it('should return counts only without detailed lists', () => {
    // 仅返回数量，不返回列表
  });

  it('should accept both FILE: prefix and plain path', () => {
    // 输入格式灵活性
  });

  it('should return not found for nonexistent file', () => {
    // 文件不存在处理
  });

  it('should include deprecated warning when applicable', () => {
    // deprecated 标记显示
  });

  it('should output compact single-line format', () => {
    // 输出格式验证
  });
});
```

---

## 5. Token估算

### 5.1 输出 Token 计算

**getScope 输出估算**:

| 内容类型 | Token估算公式 |
|----------|---------------|
| 标题行 | ~10 tokens |
| 导出列表 | ~5 + exports.length × 3 |
| 导入列表 | ~5 + imports.length × 4 |
| 被导入列表 | ~5 + importedBy.length × 4 |
| Metadata | ~50 tokens |
| **总计** | ~75 + exports×3 + imports×4 + importedBy×4 |

**典型场景估算**:

| 文件类型 | Exports | Imports | ImportedBy | Total Tokens |
|----------|---------|---------|------------|--------------|
| 小型工具文件 | 3 | 2 | 5 | ~110 |
| 中型服务文件 | 8 | 5 | 12 | ~190 |
| 大型组件文件 | 15 | 10 | 20 | ~300 |
| 入口文件 | 5 | 20 | 0 | ~160 |

**getQuickBrief 输出估算**: ~30-50 tokens (固定)

### 5.2 Token 优化策略

当估算超过 600 tokens 时的裁剪策略:

```typescript
function formatScopeOutputWithTokenLimit(
  ...args: ScopeOutputArgs
): string {
  // 先计算估算值
  const estimatedTokens = estimateTokens(exports, imports, importedBy);

  if (estimatedTokens > 600) {
    // 裁剪策略1: 被导入列表截断
    if (importedBy.length > 10) {
      const truncated = importedBy.slice(0, 10);
      return formatWithTruncatedList(truncated, importedBy.length - 10);
    }

    // 裁剪策略2: 导入列表截断
    if (imports.length > 10) {
      const truncated = imports.slice(0, 10);
      return formatWithTruncatedImports(truncated, imports.length - 10);
    }
  }

  return formatScopeOutput(...args);
}
```

---

## 6. 完整实现代码骨架

```typescript
// packages/codegraph/src/api/scope.ts

import { CodeGraph, NodeType, EdgeType, GraphNode } from '../types.js';
import { ScopeResult, QuickBriefResult, ComplexityInfo, ModifiedInfo } from './types.js';

/**
 * Scope查询API
 *
 * 获取文件或模块的完整上下文信息
 *
 * @param graph - CodeGraph 实例
 * @param target - 目标节点 ID (FILE:xxx 或 MODULE:xxx#yyy)
 * @returns ScopeResult 包含结构化数据和压缩文本
 */
export function getScope(graph: CodeGraph, target: string): ScopeResult {
  // 实现见 1.2 算法
  // ...
}

/**
 * QuickBrief API
 *
 * 获取文件的极简统计信息
 *
 * @param graph - CodeGraph 实例
 * @param filePath - 文件路径 (可含 FILE: 前缀)
 * @returns QuickBriefResult 包含统计数据和压缩文本
 */
export function getQuickBrief(graph: CodeGraph, filePath: string): QuickBriefResult {
  // 实现见 2.2 算法
  // ...
}

// 导出辅助函数供测试使用
export {
  normalizeTarget,
  extractExports,
  extractImports,
  extractImportedBy,
  findTestFile,
  aggregateComplexity,
  checkDeprecated
};
```

```typescript
// packages/codegraph/src/api/index.ts

export { getScope, getQuickBrief } from './scope.js';
export type { ScopeResult, QuickBriefResult, ComplexityInfo, ModifiedInfo } from './types.js';
```

---

## 7. 实现注意事项

### 7.1 边缘情况处理

| 场景 | 处理方式 |
|------|---------|
| FILE 节点无 MODULE | 返回空 exports 列表，不报错 |
| MODULE 节点无 metadata | 使用默认值，不报错 |
| 动态导入目标未解析 | 标记为 DYNAMIC_IMPORTS，目标可能为空 |
| 重导出通配符 (A3) | 单条边，importSpecifier="wildcard" |
| 路径别名导入 | 目标已解析为真实路径（解析器负责） |

### 7.2 性能考量

- **节点遍历**: 遍历所有 nodes 查找 MODULE 时，使用 `Map.values()` 避免创建临时数组
- **索引使用**: 优先使用 `inEdges` 和 `outEdges` 索引，避免遍历全部 edges
- **复杂度聚合**: 可预计算并缓存 FILE 级复杂度（后续优化）

### 7.3 与后续 Milestone 的关系

- **M2**: CALLS 边加入后，`upstreamCalls` 和 `downstreamCalls` 将填充实际数据
- **M3**: `testFile` 将集成到架构约束引擎进行验证
- **M4**: `getScope` 输出将被 `buildContextFor` 使用作为上下文注入

---

## 8. 交付文件清单

```
packages/codegraph/src/
├─ api/
│   ├─ scope.ts       # getScope, getQuickBrief 实现
│   ├─ types.ts       # ScopeResult, QuickBriefResult 类型定义
│   └─ index.ts       # API 导出入口
└─ tests/
    └─ unit/
        └─ api/
            └─ scope.test.ts  # 单元测试
```

---

**文档版本**: v1.0
**创建日期**: 2026-05-03
**用途**: Change 7 (`cg-api-scope`) 实现参考