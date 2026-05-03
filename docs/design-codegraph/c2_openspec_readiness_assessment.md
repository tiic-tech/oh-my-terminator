# C2 文件系统扫描 - OpenSpec 就绪评估

> 对照 C3 规格文档结构，评估 C2 是否具备进入 OpenSpec 开发的条件

---

## 评估维度

| 维度 | C3 规格 | C2 当前状态 | 评估 |
|------|---------|------------|------|
| **功能目标** | 明确列出 IMPORTS/RE_EXPORTS/EXTERNAL | "生成 DIRECTORY/FILE 节点和 CONTAINS 边" | ⚠️ 模糊 |
| **技术选型** | TypeScript Compiler API | 未指定（Node.js fs?） | ❌ 缺失 |
| **设计约束** | 性能/路径准确性/容错性 | 未定义 | ❌ 缺失 |
| **接口定义** | `parseFiles(filePaths, root)` 返回 `{nodes, edges}` | 未定义 | ❌ 缺失 |
| **忽略规则** | 动态导入处理章节 | 简单列表 `.git/`, `node_modules/` | ⚠️ 不完整 |
| **边界情况** | 独立章节（循环导入、JSON 导入等） | 未定义 | ❌ 缺失 |
| **性能策略** | 独立章节（并发、缓存） | 未定义 | ❌ 缺失 |
| **测试场景** | 独立章节（10+ 场景） | "节点数量正确" | ❌ 不够具体 |

---

## 关键歧义清单

### 1. 接口定义歧义

**问题**: Scanner 函数签名未定义

**需要定义**:
```typescript
// 方案 A: 返回节点/边列表
interface ScanResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  filesToParse: string[]; // .ts/.tsx/.js/.jsx/.mjs 文件列表
}

function scanDirectory(root: string, options?: ScanOptions): ScanResult;

// 方案 B: 直接操作 CodeGraph
function scanDirectoryInto(graph: CodeGraph, root: string): void;
```

**决策点**: 应该返回数据还是直接操作 Graph？

---

### 2. 忽略规则歧义

**问题**: 忽略规则来源未明确

**需要定义**:
- 硬编码默认规则（C2 范围）
- `.gitignore` 读取（是否支持？）
- `.codegraphignore` 自定义（是否支持？）

**C2 MVP 范围建议**: 仅硬编码默认规则

---

### 3. CONTAINS 边生成歧义

**问题**: 边的方向和粒度未明确

**需要定义**:
```
方案 A: 仅一级 CONTAINS
  DIRECTORY:src CONTAINS FILE:src/main.ts
  DIRECTORY:src CONTAINS FILE:src/utils.ts
  (不创建子目录 CONTAINS)

方案 B: 递归 CONTAINS
  DIRECTORY:src CONTAINS DIRECTORY:src/components
  DIRECTORY:src/components CONTAINS FILE:src/components/Button.tsx
```

**Blueprint 说明**: "目录→文件或子目录" → 方案 B

---

### 4. 节点 ID 格式歧义

**问题**: DIRECTORY 节点 ID 格式

**已定义**: `DIRECTORY:src` (相对路径)

**需要确认**:
- 根目录节点 ID: `DIRECTORY:.` 或 `DIRECTORY:` ?
- 空目录是否创建节点？
- 隐藏目录（如 `.storybook`）是否创建？

---

### 5. 错误处理歧义

**问题**: 错误场景未定义

**需要定义**:
| 场景 | 处理策略 |
|------|----------|
| 权限错误 | 跳过并记录 warning |
| 符号链接 | 跟随或跳过？ |
| 空目录 | 是否创建节点？ |
| 不存在的路径 | 报错退出还是返回空？ |

---

### 6. 与 C1 集成歧义

**问题**: Scanner 如何与 CodeGraph 集成

**方案 A**: Scanner 返回数据，调用方添加
```typescript
const graph = new CodeGraph();
const { nodes, edges } = scanDirectory('./src');
for (const node of nodes) graph.addNode(node);
for (const edge of edges) graph.addEdge(edge);
```

**方案 B**: Scanner 直接操作 Graph
```typescript
const graph = new CodeGraph();
scanDirectoryInto(graph, './src');
```

**建议**: 方案 A 更符合单向数据流原则

---

### 7. 文件扩展名收集歧义

**问题**: 哪些扩展名需要收集

**Blueprint 定义**: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`

**需要确认**:
- `.d.ts` 声明文件是否收集？
- `.cts`, `.mts` 新扩展名是否收集？
- `.vue`, `.svelte` 是否支持（多语言插件）？

**C2 MVP 建议**: 仅 Blueprint 定义的基础扩展名

---

## OpenSpec 就绪评估

### 必须解决（P0）

| 歧义 | 必须在 OpenSpec specs 阶段解决 |
|------|-------------------------------|
| 接口定义 | ✓ 必须定义 `scanDirectory` 签名 |
| 返回值类型 | ✓ 必须定义 `ScanResult` 结构 |
| CONTAINS 边粒度 | ✓ 必须明确递归 vs 一级 |
| 与 C1 集成方式 | ✓ 必须明确返回数据 vs 操作 Graph |

### 可在 design 阶段解决（P1）

| 歧义 | 可在 OpenSpec design 阶段解决 |
|------|------------------------------|
| 错误处理策略 | 技术决策 |
| 性能策略 | 技术决策 |
| 隐藏目录处理 | 技术决策 |

### 可后续迭代（P2）

| 歧义 | MVP 后处理 |
|------|-----------|
| `.gitignore` 支持 | M2+ |
| `.codegraphignore` 支持 | M2+ |
| 新扩展名支持 | M6 多语言 |

---

## 结论

### 是否具备进入 OpenSpec 条件？

**判断**: ❌ **不完全具备**

**原因**:
1. 缺少类似 C3 的详细规格文档
2. 4 个 P0 关键歧义未解决
3. 接口定义缺失将导致 specs 无法编写

### 建议

**方案 A**: 先创建规格文档

```
docs/design-codegraph/02_c2_scanner_spec.md
- 参考 03_c3_ts_parser_spec.md 结构
- 定义接口、边界情况、测试场景
```

**方案 B**: 直接进入 OpenSpec，在 specs 阶段消除歧义

```
/opsx:new cg-file-system-scanner
- 在 specs 阶段定义 ScanResult 接口
- 在 design 阶段做技术决策
```

### 推荐路径

**推荐**: 方案 A - 先创建规格文档

**理由**:
1. C3/C4/C6 都有规格文档，保持一致性
2. 规格文档有助于多 Change 并行开发时减少依赖等待
3. 规格文档可以提前评审，避免 OpenSpec 流程中反复修改

---

## 规格文档模板建议

参考 C3 规格，C2 应包含：

```markdown
# C2 文件系统扫描 - 技术规格

## 1. 概述与目标
- 功能目标（节点/边生成）
- 技术选型（Node.js fs 模块）
- 设计约束（性能、容错）

## 2. 接口定义
- scanDirectory(root, options) 签名
- ScanResult 返回值结构

## 3. 扫描流程
- 递归遍历算法
- CONTAINS 边生成策略

## 4. 忽略规则
- 默认规则列表
- 规则匹配算法

## 5. 文件分类
- 待解析文件扩展名
- 其他文件处理

## 6. 边界情况
- 权限错误
- 符号链接
- 空目录

## 7. 性能策略
- 并发处理
- 内存控制

## 8. 测试场景
- Fixture 设计
- 测试用例列表
```

---

**版本**: v1.0
**创建**: 2026-05-03