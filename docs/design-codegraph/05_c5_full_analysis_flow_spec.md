# CodeGraph 全量分析流程 - 技术规格

> **文档定位**: Change 5 (`cg-full-analysis-flow`) 的详细技术实现规格
> **关联文档**: [01_origin_blueprint.md](./01_origin_blueprint.md) 第5.2节, [develop_changes_plan.md](./develop_changes_plan.md) C5

---

## 目录

1. [概述与目标](#1-概述与目标)
2. [接口定义](#2-接口定义)
3. [Parser注册机制](#3-parser注册机制)
4. [分析流程](#4-分析流程)
5. [错误处理策略](#5-错误处理策略)
6. [边界情况处理](#6-边界情况处理)
7. [性能优化策略](#7-性能优化策略)
8. [测试场景清单](#8-测试场景清单)
9. [与 C1-C4 集成示例](#9-与-c1-c4-集成示例)

---

## 1. 概述与目标

### 1.1 功能目标

组合 C1-C4 组件，执行完整仓库分析流程：

| 输入 | 输出 |
|------|------|
| 项目根目录路径 (`cwd: string`) | `FullAnalysisResult` (图 + 统计 + 警告) |

**流程组成**:
- C2 Scanner: 扫描目录 → FILE/DIRECTORY 节点 + CONTAINS 边
- C3 Parser: 解析导入 → IMPORTS/RE_EXPORTS 边 + EXTERNAL 节点
- C4 Parser: 提取模块 → MODULE 节点 + DECLARES 边
- C1 Graph: 合并结果 → CodeGraph 完整图谱

### 1.2 技术选型

| 选择 | 理由 |
|------|------|
| **组合 C1-C4** | 无新依赖，复用已实现组件 |
| **Sequential Parsing** | MVP 简化，后续可优化为并行 |
| **Continue-on-error** | 单文件失败不中断整体流程 |
| **Progress Callback** | 可选进度报告，默认静默 |

### 1.3 设计约束

| 约束 | 描述 |
|------|------|
| **错误隔离** | 解析失败记录警告，不影响其他文件 |
| **内存友好** | 顺序解析，立即释放 AST |
| **类型安全** | 所有接口 TypeScript 强类型 |
| **单向数据流** | Scanner → Parser → Graph，无循环依赖 |

---

## 2. 接口定义

### 2.1 主接口签名

```typescript
/**
 * 执行全量仓库分析
 * @param cwd - 项目根目录绝对路径
 * @param options - 可选配置
 * @returns 分析结果，包含图、统计和警告
 */
async function analyzeFull(cwd: string, options?: AnalysisOptions): Promise<FullAnalysisResult>;
```

### 2.2 FullAnalysisResult 结构

```typescript
interface FullAnalysisResult {
  /** 分析完成的代码图谱 */
  graph: CodeGraph;
  
  /** 分析统计信息 */
  stats: AnalysisStats;
  
  /** 所有非致命警告列表 */
  warnings: string[];
}
```

### 2.3 AnalysisStats 统计

```typescript
interface AnalysisStats {
  /** 扫描耗时 (ms) */
  scanTimeMs: number;
  
  /** 解析耗时 (ms) */
  parseTimeMs: number;
  
  /** 总耗时 (ms) */
  totalTimeMs: number;
  
  /** 成功解析文件数 */
  filesParsed: number;
  
  /** 解析错误数 */
  parseErrors: number;
  
  /** DIRECTORY 节点数 */
  directories: number;
  
  /** FILE 节点数 */
  files: number;
  
  /** MODULE 节点数 */
  modules: number;
  
  /** 总边数 */
  edges: number;
}
```

### 2.4 AnalysisOptions 配置

```typescript
interface AnalysisOptions {
  /** 待解析的文件扩展名（默认 ['.ts', '.tsx', '.js', '.jsx', '.mjs']） */
  extensions?: string[];
  
  /** 进度回调函数（可选） */
  onProgress?: ProgressCallback;
  
  /** 扫描选项（传递给 C2 Scanner） */
  scanOptions?: ScanOptions;
  
  /** 自定义忽略规则 */
  ignoreRules?: string[];
}
```

### 2.5 ProgressCallback 进度报告

```typescript
/**
 * 进度回调函数类型
 */
type ProgressCallback = (event: ProgressEvent) => void;

interface ProgressEvent {
  /** 当前阶段 */
  phase: 'scan' | 'parse' | 'merge' | 'complete';
  
  /** 当前处理数量 */
  current: number;
  
  /** 总数量 */
  total: number;
  
  /** 描述信息 */
  message?: string;
  
  /** 当前处理的文件路径（parse 阶段） */
  filePath?: string;
}
```

---

## 3. Parser注册机制

### 3.1 Parser 接口

```typescript
/**
 * 解析器接口 - 所有语言解析器必须实现
 */
interface Parser {
  /** 解析器名称 */
  name: string;
  
  /** 支持的文件扩展名列表 */
  extensions: string[];
  
  /**
   * 解析单个文件
   * @param filePath - 文件相对路径
   * @param content - 文件内容
   * @param projectRoot - 项目根目录
   * @returns 解析结果（节点和边）
   */
  parse(filePath: string, content: string, projectRoot: string): Promise<ParserResult>;
}

interface ParserResult {
  /** 生成的节点列表 */
  nodes: GraphNode[];
  
  /** 生成的边列表 */
  edges: GraphEdge[];
  
  /** 解析警告 */
  warnings: string[];
}
```

### 3.2 ParserRegistry 注册表

```typescript
/**
 * 解析器注册表接口
 */
interface ParserRegistry {
  /**
   * 注册解析器
   * @param parser - 解析器实例
   */
  register(parser: Parser): void;
  
  /**
   * 根据扩展名获取解析器
   * @param extension - 文件扩展名（如 '.ts'）
   * @returns 解析器实例或 undefined
   */
  getParser(extension: string): Parser | undefined;
  
  /**
   * 检查是否有对应扩展名的解析器
   * @param extension - 文件扩展名
   */
  hasParser(extension: string): boolean;
  
  /**
   * 获取所有已注册的扩展名
   * @returns 扩展名列表
   */
  getAllExtensions(): string[];
}
```

### 3.3 DefaultParserRegistry 实现

```typescript
/**
 * 默认解析器注册表实现
 */
class DefaultParserRegistry implements ParserRegistry {
  private parsers: Map<string, Parser> = new Map();
  private extensionMap: Map<string, Parser> = new Map();
  
  register(parser: Parser): void {
    // 注册到名称映射
    this.parsers.set(parser.name, parser);
    
    // 注册每个扩展名
    for (const ext of parser.extensions) {
      this.extensionMap.set(ext, parser);
    }
  }
  
  getParser(extension: string): Parser | undefined {
    return this.extensionMap.get(extension);
  }
  
  hasParser(extension: string): boolean {
    return this.extensionMap.has(extension);
  }
  
  getAllExtensions(): string[] {
    return Array.from(this.extensionMap.keys());
  }
}
```

### 3.4 内置 TypeScript 解析器注册

```typescript
// 在 analyzeFull 初始化时自动注册
const registry = new DefaultParserRegistry();

// 注册内置 TypeScript 解析器（C3 + C4）
registry.register(new TypeScriptParser());

// TypeScriptParser 支持的扩展名
// ['.ts', '.tsx', '.js', '.jsx', '.mjs']
```

---

## 4. 分析流程

### 4.1 全量分析流程架构

```
┌─────────────────────────────────────────────────────────────┐
│                    全量分析流程架构                           │
├─────────────────────────────────────────────────────────────┤
│  输入: cwd (项目根目录)                                       │
│      │                                                      │
│      ▼                                                      │
│  ┌─────────────────┐                                        │
│  │  Step 1: Scan   │  scanDirectory(cwd)                    │
│  │  (C2 Scanner)   │  → nodes, edges, filesToParse          │
│  └─────────────────┘                                        │
│      │                                                      │
│      ▼                                                      │
│  ┌─────────────────┐                                        │
│  │  Step 2: Group  │  按扩展名分组                            │
│  │  by Extension   │  → Map<ext, filePaths>                 │
│  └─────────────────┘                                        │
│      │                                                      │
│      ▼                                                      │
│  ┌─────────────────┐                                        │
│  │  Step 3: Parse  │  Sequential parsing                     │
│  │  (C3/C4 Parser) │  → ParserResult per file                │
│  └─────────────────┘                                        │
│      │                                                      │
│      ▼                                                      │
│  ┌─────────────────┐                                        │
│  │  Step 4: Merge  │  graph.addNode/addEdge                  │
│  │  into CodeGraph │  → CodeGraph (C1)                       │
│  └─────────────────┘                                        │
│      │                                                      │
│      ▼                                                      │
│  输出: FullAnalysisResult                                    │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Step 1: 文件系统扫描

```typescript
// Step 1: 扫描目录结构，生成 FILE/DIRECTORY 节点
const scanResult = scanDirectory(cwd, options?.scanOptions);

// 扫描结果包含:
// - nodes: DIRECTORY 和 FILE 节点
// - edges: CONTAINS 边
// - filesToParse: 待解析文件路径列表
// - stats: 统计信息
// - warnings: 非致命警告

// 进度报告
if (options?.onProgress) {
  options.onProgress({
    phase: 'scan',
    current: 1,
    total: 1,
    message: `Found ${scanResult.filesToParse.length} files to parse`,
  });
}
```

### 4.3 Step 2: 按扩展名分组

```typescript
// Step 2: 将文件按扩展名分组，为解析器选择做准备
function groupFilesByExtension(filesToParse: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  
  for (const filePath of filesToParse) {
    const ext = path.extname(filePath);
    const group = groups.get(ext) ?? [];
    group.push(filePath);
    groups.set(ext, group);
  }
  
  return groups;
}

// 分组示例:
// Map {
//   '.ts'   => ['src/main.ts', 'src/utils/format.ts'],
//   '.tsx'  => ['src/components/Button.tsx'],
//   '.js'   => ['lib/helper.js'],
// }
```

### 4.4 Step 3: Sequential Parsing

```typescript
// Step 3: 解析每个文件，提取导入/导出/模块信息
for (const filePath of scanResult.filesToParse) {
  // 读取文件内容
  const content = fs.readFileSync(path.resolve(cwd, filePath), 'utf-8');
  
  // 根据扩展名选择解析器
  const ext = path.extname(filePath);
  const parser = registry.getParser(ext);
  
  // 无对应解析器 → 跳过
  if (!parser) {
    warnings.push(`No parser for extension: ${ext}`);
    continue;
  }
  
  // 执行解析
  try {
    const parserResult = await parser.parse(filePath, content, cwd);
    mergeParserResult(graph, parserResult);
    stats.filesParsed++;
  } catch (error) {
    warnings.push(`Parse failed: ${filePath} - ${error.message}`);
    stats.parseErrors++;
    // Continue to next file
  }
  
  // 进度报告
  if (options?.onProgress) {
    options.onProgress({
      phase: 'parse',
      current: stats.filesParsed + stats.parseErrors,
      total: scanResult.filesToParse.length,
      filePath,
    });
  }
}
```

### 4.5 Step 4: Merge into CodeGraph

```typescript
// Step 4: 将所有解析结果合并到 CodeGraph
function mergeParserResult(graph: CodeGraph, result: ParserResult): void {
  // 添加节点 (MODULE, EXPORT, IMPORT, EXTERNAL 等)
  for (const node of result.nodes) {
    graph.addNode(node);
  }
  
  // 添加边 (IMPORTS, RE_EXPORTS, DYNAMIC_IMPORTS, DECLARES 等)
  for (const edge of result.edges) {
    graph.addEdge(edge);
  }
}

// 最终图包含:
// - C2 扫描节点: DIRECTORY, FILE
// - C2 扫描边: CONTAINS
// - C3/C4 解析节点: MODULE, EXTERNAL
// - C3/C4 解析边: IMPORTS, RE_EXPORTS, DYNAMIC_IMPORTS, DECLARES
```

---

## 5. 错误处理策略

### 5.1 Continue-on-Error Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    错误处理策略架构                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  原则: Continue-on-error                                    │
│  ├─ 单文件解析失败不中断整体流程                             │
│  ├─ 记录错误继续处理下一个文件                               │
│  ├─ 最终返回完整的图 + 错误列表                              │
│                                                             │
│  错误分类:                                                   │
│  ├─ Scanner 级错误: 返回空结果 + warning                    │
│  │  └─ 例如: 路径不存在、权限不足                           │
│  ├─ Parser 级错误: 记录 warning，跳过该文件                 │
│  │  └─ 例如: 解析失败、语法错误                             │
│  ├─ Merge 级错误: 不发生（图操作不抛异常）                   │
│  │  └─ 例如: 节点已存在、边已存在                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Parser Failure Handling

```typescript
try {
  const result = await parser.parse(filePath, content);
  mergeParserResult(graph, result);
  stats.filesParsed++;
} catch (error) {
  // 记录警告
  warnings.push(`Parse failed: ${filePath} - ${error.message}`);
  
  // 统计错误
  stats.parseErrors++;
  
  // Continue to next file - 不抛出异常
}
```

### 5.3 Scanner Failure Handling

```typescript
// Scanner 级错误已在 C2 中处理，返回空结果 + warning
// analyzeFull 接收后直接合并（空结果不影响流程）

if (scanResult.warnings.length > 0) {
  warnings.push(...scanResult.warnings);
}

// 即使扫描失败，流程继续（返回空图）
```

---

## 6. 边界情况处理

### 6.1 Empty Project

```typescript
// 无可解析文件
if (scanResult.filesToParse.length === 0) {
  // 返回仅有 DIRECTORY/FILE 节点的图
  // stats.filesParsed = 0
  // warnings 可能包含 "No parseable files found"
  return { graph, stats, warnings };
}
```

### 6.2 All Files Fail Parsing

```typescript
// 所有文件解析失败
// stats.filesParsed = 0
// stats.parseErrors = N (文件总数)
// warnings 包含所有解析错误
// graph 仅包含 C2 扫描结果 (FILE/DIRECTORY + CONTAINS)
```

### 6.3 Mixed File Types

```typescript
// 不同扩展名文件
// 仅解析有注册解析器的扩展名
// 无解析器的文件 → warning: "No parser for extension: .vue"
```

### 6.4 Large Project Memory

```typescript
// 大型项目内存策略
// Sequential parsing + immediate AST release

for (const filePath of filesToParse) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = await parser.parse(filePath, content);
  mergeParserResult(graph, result);
  // AST 在 parse 返回后自动释放（无额外持有）
}
```

### 6.5 Git Unavailable

```typescript
// Git 不可用场景（C5 MVP 不涉及 Git 操作）
// C6 增量更新才需要 Git
// C5 全量分析无需 Git，忽略此场景
```

---

## 7. 性能优化策略

### 7.1 Sequential Parsing (MVP)

```typescript
// MVP: 顺序解析（简单可靠）
// 后续优化: worker_threads 并行解析
```

### 7.2 Immediate AST Release

```typescript
// 解析完成后立即释放 AST
// Parser.parse 返回后不再持有 AST 引用
// TypeScript Program 在解析完成后 dispose
```

### 7.3 No Intermediate Storage

```typescript
// 无中间文件存储
// 直接从内存合并到 CodeGraph
// 避免 JSON 序列化开销（C6 基线持久化时才序列化）
```

---

## 8. 测试场景清单

### 8.1 基础分析场景

| ID | 场景 | Fixture | 预期结果 |
|----|------|---------|----------|
| T01 | 小型项目全量分析 | 5 文件 fixture | graph: 5 FILE + MODULE 节点 |
| T02 | 空项目分析 | 空 fixture | graph: 仅 ROOT DIRECTORY |
| T03 | 混合文件类型 | .ts + .js + .json | 仅解析 .ts/.js，跳过 .json |
| T04 | 大型项目 | 100 文件 fixture | totalTime < 5s |

### 8.2 错误处理场景

| ID | 场景 | Fixture | 预期结果 |
|----|------|---------|----------|
| T05 | 单文件解析失败 | 语法错误文件 | warnings: 1 error, stats.parseErrors = 1 |
| T06 | 多文件解析失败 | 3 个错误文件 | warnings: 3 errors, 成功文件仍入图 |
| T07 | Scanner 级错误 | 不存在路径 | warnings: "Path does not exist" |
| T08 | 无解析器扩展名 | .vue 文件 | warnings: "No parser for .vue" |

### 8.3 进度报告场景

| ID | 场景 | 配置 | 预期结果 |
|----|------|------|----------|
| T09 | 进度回调触发 | onProgress: callback | 回调被调用 N 次 |
| T10 | 阶段顺序 | - | phase: scan → parse → complete |
| T11 | 静默模式 | onProgress: undefined | 无回调触发 |

### 8.4 集成测试场景

| ID | 场景 | 验证内容 |
|----|------|----------|
| T12 | C1-C4 集成 | 图节点/边完整性 |
| T13 | MODULE 节点生成 | C4 模块提取正确 |
| T14 | IMPORTS 边生成 | C3 导入解析正确 |
| T15 | EXTERNAL 节点 | 外部依赖识别正确 |

---

## 9. 与 C1-C4 集成示例

### 9.1 完整集成代码

```typescript
import { CodeGraph } from './graph';           // C1
import { scanDirectory } from './scanner';     // C2
import { TypeScriptParser } from './ts-parser'; // C3 + C4
import { DefaultParserRegistry } from './parser-registry';

/**
 * C5 全量分析主函数
 */
export async function analyzeFull(
  cwd: string, 
  options?: AnalysisOptions
): Promise<FullAnalysisResult> {
  // 初始化
  const graph = new CodeGraph();               // C1
  const registry = new DefaultParserRegistry();
  registry.register(new TypeScriptParser());   // C3 + C4
  
  const warnings: string[] = [];
  const stats: AnalysisStats = createEmptyStats();
  const startTime = performance.now();
  
  // Step 1: Scan (C2)
  const scanStart = performance.now();
  const scanResult = scanDirectory(cwd, options?.scanOptions);
  stats.scanTimeMs = performance.now() - scanStart;
  warnings.push(...scanResult.warnings);
  
  // Merge scan results
  for (const node of scanResult.nodes) graph.addNode(node);
  for (const edge of scanResult.edges) graph.addEdge(edge);
  stats.directories = scanResult.stats.directories;
  stats.files = scanResult.stats.files;
  
  // Step 2-3: Parse files (C3 + C4)
  const parseStart = performance.now();
  for (const filePath of scanResult.filesToParse) {
    const ext = path.extname(filePath);
    const parser = registry.getParser(ext);
    
    if (!parser) {
      warnings.push(`No parser for extension: ${ext}`);
      continue;
    }
    
    try {
      const content = fs.readFileSync(path.resolve(cwd, filePath), 'utf-8');
      const result = await parser.parse(filePath, content, cwd);
      
      for (const node of result.nodes) graph.addNode(node);
      for (const edge of result.edges) graph.addEdge(edge);
      
      stats.filesParsed++;
    } catch (error) {
      warnings.push(`Parse failed: ${filePath} - ${error.message}`);
      stats.parseErrors++;
    }
  }
  stats.parseTimeMs = performance.now() - parseStart;
  
  // Final stats
  stats.modules = graph.getNodes().filter(n => n.type === 'MODULE').length;
  stats.edges = graph.getEdges().length;
  stats.totalTimeMs = performance.now() - startTime;
  
  return { graph, stats, warnings };
}
```

### 9.2 CLI 命令使用示例

```typescript
// codegraph analyze 命令
import { analyzeFull } from '@oh-my-terminator/codegraph';

const result = await analyzeFull('./my-project');

console.log(`Analysis complete:`);
console.log(`  Files: ${result.stats.files}`);
console.log(`  Modules: ${result.stats.modules}`);
console.log(`  Edges: ${result.stats.edges}`);
console.log(`  Time: ${result.stats.totalTimeMs}ms`);

if (result.warnings.length > 0) {
  console.warn(`Warnings (${result.warnings.length}):`);
  for (const w of result.warnings) {
    console.warn(`  - ${w}`);
  }
}
```

---

**文档版本**: v1.0  
**创建日期**: 2026-05-03  
**关联 Change**: C5 - `cg-full-analysis-flow`  
**下一步**: 创建 OpenSpec change `/opsx:new cg-full-analysis-flow`