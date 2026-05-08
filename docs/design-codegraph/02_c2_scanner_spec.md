# CodeGraph 文件系统扫描 - 技术规格

> **文档定位**: Change 2 (`cg-file-system-scanner`) 的详细技术实现规格
> **关联文档**: [01_origin_blueprint.md](./01_origin_blueprint.md) 第4.1节, [develop_changes_plan.md](./develop_changes_plan.md) C2

---

## 目录

1. [概述与目标](#1-概述与目标)
2. [接口定义](#2-接口定义)
3. [扫描流程](#3-扫描流程)
4. [忽略规则](#4-忽略规则)
5. [CONTAINS 边生成策略](#5-contains-边生成策略)
6. [文件分类与收集](#6-文件分类与收集)
7. [节点 ID 格式规范](#7-节点-id-格式规范)
8. [边界情况处理](#8-边界情况处理)
9. [性能优化策略](#9-性能优化策略)
10. [测试场景清单](#10-测试场景清单)
11. [与 C1 集成示例](#11-与-c1-集成示例)

---

## 1. 概述与目标

### 1.1 功能目标

扫描项目目录结构，生成以下图谱元素：

| 元素 | 描述 | 示例 |
|------|------|------|
| `DIRECTORY` 节点 | 项目中的每个非空目录 | `DIRECTORY:src`, `DIRECTORY:src/components` |
| `FILE` 节点 | 项目中的每个文件 | `FILE:src/main.ts`, `FILE:src/utils.ts` |
| `CONTAINS` 边 | 目录与子元素的关系 | `DIRECTORY:src → FILE:src/main.ts` |

同时收集待解析的文件列表（按扩展名过滤），供 C3 解析器使用。

### 1.2 技术选型

| 选择 | 理由 |
|------|------|
| **Node.js fs 模块** | 零外部依赖，原生支持递归遍历 |
| **fs.readdir + recursive** | Node.js 18+ 支持递归选项，性能良好 |
| **不引入 glob/fast-glob** | 保持轻量，MVP 足够 |
| **不读取 .gitignore** | MVP 简化，硬编码默认规则 |

### 1.3 设计约束

| 约束 | 描述 |
|------|------|
| **零外部依赖** | 仅使用 Node.js 标准库 `fs`, `path` |
| **性能优先** | 1000 目录项目扫描时间 < 500ms |
| **容错性** | 错误不中断流程，记录 warning 继续 |
| **单向数据流** | Scanner 返回数据，调用方负责添加到 Graph |

---

## 2. 接口定义

### 2.1 主接口签名

```typescript
/**
 * 扫描目录结构，生成节点和边
 * @param root - 项目根目录的绝对路径
 * @param options - 可选配置
 * @returns 扫描结果，包含节点、边、待解析文件列表和统计信息
 */
function scanDirectory(root: string, options?: ScanOptions): ScanResult;
```

### 2.2 ScanResult 结构

```typescript
interface ScanResult {
  /** 生成的所有节点（DIRECTORY + FILE） */
  nodes: GraphNode[];
  
  /** 生成的所有 CONTAINS 边 */
  edges: GraphEdge[];
  
  /** 待解析的文件路径列表（相对路径） */
  filesToParse: string[];
  
  /** 统计信息 */
  stats: {
    directories: number;  // DIRECTORY 节点数量
    files: number;        // FILE 节点数量
    skipped: number;      // 被忽略的目录/文件数量
  };
  
  /** 非致命错误/警告列表 */
  warnings: string[];
}
```

### 2.3 ScanOptions 配置

```typescript
interface ScanOptions {
  /** 待解析的文件扩展名（默认 ['.ts', '.tsx', '.js', '.jsx', '.mjs']） */
  extensions?: string[];
  
  /** 覆盖默认忽略规则（若提供，则不使用默认规则） */
  ignoreRules?: string[];
  
  /** 是否包含隐藏目录（以 . 开头），默认 false */
  includeHidden?: boolean;
  
  /** 最大递归深度，默认 20（防止无限递归） */
  maxDepth?: number;
}
```

### 2.4 默认配置值

```typescript
const DEFAULT_OPTIONS: Required<ScanOptions> = {
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
  ignoreRules: [
    '.git/',
    'node_modules/',
    'dist/',
    'build/',
    '.next/',
    '.cache/',
    '.codegraph/',
    'coverage/',
    '__pycache__/',  // Python 缓存（为多语言预留）
    '.DS_Store',     // macOS 系统文件
  ],
  includeHidden: false,
  maxDepth: 20,
};
```

---

## 3. 扫描流程

### 3.1 核心扫描架构

```
┌─────────────────────────────────────────────────────────────┐
│                    扫描流程架构                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  输入: root (绝对路径)                                       │
│      │                                                      │
│      ▼                                                      │
│  验证路径存在性                                              │
│      │                                                      │
│      ├─ 不存在 → 返回空结果 + warning                        │
│      └                                                      │
│      ▼                                                      │
│  创建根目录节点                                              │
│      │                                                      │
│      │  id: "DIRECTORY:<相对路径>"                          │
│      │  path: "<相对路径>"                                  │
│      │                                                      │
│      ▼                                                      │
│  递归遍历 (fs.readdir with recursive)                       │
│      │                                                      │
│      ├─ 对每个条目:                                         │
│      │   ├─ 检查忽略规则                                    │
│      │   ├─ 检查是否隐藏文件                                │
│      │   ├─ 目录 → 创建 DIRECTORY 节点 + CONTAINS 边       │
│      │   └─ 文件 → 创建 FILE 节点 + CONTAINS 边            │
│      │                                                      │
│      ▼                                                      │
│  收集待解析文件                                              │
│      │                                                      │
│      │  检查扩展名匹配                                       │
│      │                                                      │
│      ▼                                                      │
│  返回 ScanResult                                            │
│      │                                                      │
│      ├─ nodes[]                                             │
│      ├─ edges[]                                             │
│      ├─ filesToParse[]                                      │
│      ├─ stats                                               │
│      └─ warnings[]                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 递归遍历实现

```typescript
import fs from 'fs';
import path from 'path';

async function scanRecursive(
  currentDir: string,
  rootDir: string,
  options: Required<ScanOptions>,
  depth: number,
  result: ScanResult,
  parentNodeId: string
): Promise<void> {
  
  // 深度检查
  if (depth > options.maxDepth) {
    result.warnings.push(`Max depth ${options.maxDepth} reached at ${currentDir}`);
    return;
  }
  
  // 目录读取
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
  } catch (error) {
    // 权限错误处理
    const relativePath = path.relative(rootDir, currentDir);
    result.warnings.push(`Permission denied: ${relativePath}`);
    result.stats.skipped++;
    return;
  }
  
  // 空目录检查 - 不创建节点
  if (entries.length === 0) {
    result.stats.skipped++;
    return;
  }
  
  // 当前目录相对路径
  const relativeDir = path.relative(rootDir, currentDir);
  const currentNodeId = relativeDir === '' 
    ? 'DIRECTORY:.' 
    : `DIRECTORY:${relativeDir}`;
  
  // 处理每个条目
  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    const entryRelativePath = relativeDir === '' 
      ? entry.name 
      : path.join(relativeDir, entry.name);
    
    // 忽略规则检查
    if (shouldIgnore(entryRelativePath, options.ignoreRules)) {
      result.stats.skipped++;
      continue;
    }
    
    // 隐藏文件检查
    if (!options.includeHidden && entry.name.startsWith('.')) {
      result.stats.skipped++;
      continue;
    }
    
    // 符号链接检查 - 不跟随
    if (entry.isSymbolicLink()) {
      result.warnings.push(`Symlink skipped: ${entryRelativePath}`);
      result.stats.skipped++;
      continue;
    }
    
    if (entry.isDirectory()) {
      // 创建 DIRECTORY 节点
      const dirNode: GraphNode = {
        id: `DIRECTORY:${entryRelativePath}`,
        type: NodeType.DIRECTORY,
        path: entryRelativePath,
        name: entry.name,
      };
      result.nodes.push(dirNode);
      result.stats.directories++;
      
      // 创建 CONTAINS 边（父目录 → 子目录）
      result.edges.push({
        from: currentNodeId,
        to: dirNode.id,
        type: EdgeType.CONTAINS,
      });
      
      // 递归扫描子目录
      await scanRecursive(
        entryPath,
        rootDir,
        options,
        depth + 1,
        result,
        dirNode.id
      );
      
    } else if (entry.isFile()) {
      // 创建 FILE 节点
      const fileNode: GraphNode = {
        id: `FILE:${entryRelativePath}`,
        type: NodeType.FILE,
        path: entryRelativePath,
        name: entry.name,
      };
      result.nodes.push(fileNode);
      result.stats.files++;
      
      // 创建 CONTAINS 边（目录 → 文件）
      result.edges.push({
        from: currentNodeId,
        to: fileNode.id,
        type: EdgeType.CONTAINS,
      });
      
      // 检查是否需要收集
      const ext = path.extname(entry.name);
      if (options.extensions.includes(ext)) {
        result.filesToParse.push(entryRelativePath);
      }
    }
  }
}
```

### 3.3 主函数实现

```typescript
export function scanDirectory(root: string, options?: ScanOptions): ScanResult {
  // 合并配置
  const mergedOptions: Required<ScanOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  
  // 初始化结果
  const result: ScanResult = {
    nodes: [],
    edges: [],
    filesToParse: [],
    stats: { directories: 0, files: 0, skipped: 0 },
    warnings: [],
  };
  
  // 路径验证
  if (!fs.existsSync(root)) {
    result.warnings.push(`Path does not exist: ${root}`);
    return result;
  }
  
  if (!fs.statSync(root).isDirectory()) {
    result.warnings.push(`Path is not a directory: ${root}`);
    return result;
  }
  
  // 创建根目录节点
  result.nodes.push({
    id: 'DIRECTORY:.',
    type: NodeType.DIRECTORY,
    path: '.',
    name: path.basename(root) || 'root',
  });
  result.stats.directories++;
  
  // 开始递归扫描
  scanRecursiveSync(root, root, mergedOptions, 0, result, 'DIRECTORY:.');
  
  return result;
}

// 同步版本（更简单，性能更好）
function scanRecursiveSync(
  currentDir: string,
  rootDir: string,
  options: Required<ScanOptions>,
  depth: number,
  result: ScanResult,
  parentNodeId: string
): void {
  // ... 同上，使用 fs.readdirSync
}
```

---

## 4. 忽略规则

### 4.1 默认忽略规则列表

| 规则 | 说明 |
|------|------|
| `.git/` | Git 版本控制目录 |
| `node_modules/` | npm 依赖目录 |
| `dist/` | 构建输出目录 |
| `build/` | 构建输出目录 |
| `.next/` | Next.js 构建缓存 |
| `.cache/` | 通用缓存目录 |
| `.codegraph/` | CodeGraph 基线目录 |
| `coverage/` | 测试覆盖率报告 |
| `__pycache__/` | Python 缓存（预留） |
| `.DS_Store` | macOS 系统文件 |

### 4.2 规则匹配算法

```typescript
/**
 * 判断路径是否应该被忽略
 * 使用 startsWith 检查，支持目录和文件匹配
 */
function shouldIgnore(relativePath: string, rules: string[]): boolean {
  const normalizedPath = path.normalize(relativePath);
  
  for (const rule of rules) {
    const normalizedRule = path.normalize(rule);
    
    // 目录规则 (以 / 结尾)
    if (normalizedRule.endsWith('/') || normalizedRule.endsWith('\\')) {
      const rulePrefix = normalizedRule.slice(0, -1);
      
      // 完全匹配目录名
      if (normalizedPath === rulePrefix) {
        return true;
      }
      
      // 路径以该目录开头
      if (normalizedPath.startsWith(rulePrefix + '/') ||
          normalizedPath.startsWith(rulePrefix + '\\')) {
        return true;
      }
      
      // 目录名匹配（如 node_modules 在任意位置）
      const segments = normalizedPath.split(/[/\\]/);
      if (segments.includes(rulePrefix)) {
        return true;
      }
    } else {
      // 文件规则 - 精确匹配文件名
      if (normalizedPath === normalizedRule) {
        return true;
      }
      
      // 或路径以规则结尾
      if (normalizedPath.endsWith('/' + normalizedRule) ||
          normalizedPath.endsWith('\\' + normalizedRule)) {
        return true;
      }
    }
  }
  
  return false;
}
```

### 4.3 MVP 不支持的功能

```
MVP 阶段明确不支持：
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ❌ .gitignore 读取                                         │
│     └─ 理由：增加复杂度，MVP 硬编码足够                      │
│     └─ 后续：M2+ 可选支持                                   │
│                                                             │
│  ❌ .codegraphignore 自定义规则                             │
│     └─ 理由：MVP 使用 options.ignoreRules 覆盖              │
│     └─ 后续：M2+ 支持                                       │
│                                                             │
│  ❌ 正则表达式规则                                           │
│     └ 理由：startsWith 匹配已覆盖大部分场景                 │
│     └─ 后续：若需要可扩展                                   │
│                                                             │
│  ❌ negation 规则 (!pattern)                                │
│     └─ 理由：MVP 不需要                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. CONTAINS 边生成策略

### 5.1 递归 CONTAINS 策略（决策）

```
采用递归 CONTAINS 策略：

┌─────────────────────────────────────────────────────────────┐
│                    CONTAINS 边生成示例                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  项目结构:                                                   │
│  src/                                                        │
│    components/                                               │
│      Button.tsx                                              │
│    utils/                                                    │
│      format.ts                                               │
│    main.ts                                                   │
│                                                             │
│  生成的 CONTAINS 边:                                         │
│  1. DIRECTORY:. → DIRECTORY:src                             │
│  2. DIRECTORY:. → FILE:README.md (若有)                     │
│  3. DIRECTORY:src → DIRECTORY:src/components                │
│  4. DIRECTORY:src → DIRECTORY:src/utils                     │
│  5. DIRECTORY:src → FILE:src/main.ts                        │
│  6. DIRECTORY:src/components → FILE:src/components/Button.tsx│
│  7. DIRECTORY:src/utils → FILE:src/utils/format.ts          │
│                                                             │
│  特点:                                                       │
│  ✅ 每个目录 CONTAINS 其直接子元素                           │
│  ✅ 子目录也是 CONTAINS 目标                                 │
│  ✅ 形成完整的目录树                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 边方向说明

```
CONTAINS 边方向：
  
  父目录 → 子目录/文件
  
  from: 父目录节点 ID (DIRECTORY:...)
  to:   子元素节点 ID (DIRECTORY:... 或 FILE:...)
  type: EdgeType.CONTAINS

示例：
  { from: "DIRECTORY:src", to: "FILE:src/main.ts", type: "CONTAINS" }
  { from: "DIRECTORY:src", to: "DIRECTORY:src/components", type: "CONTAINS" }
```

### 5.3 根目录 CONTAINS

```typescript
// 根目录节点
const rootNode: GraphNode = {
  id: 'DIRECTORY:.',
  type: NodeType.DIRECTORY,
  path: '.',          // 相对于项目根
  name: 'root',       // 或项目目录名
};

// 根目录 CONTAINS 其直接子元素
// 例如: DIRECTORY:. → DIRECTORY:src
//       DIRECTORY:. → FILE:README.md
```

---

## 6. 文件分类与收集

### 6.1 待解析扩展名

| 扩展名 | 语言 | 说明 |
|--------|------|------|
| `.ts` | TypeScript | 主要 TypeScript 文件 |
| `.tsx` | TypeScript + JSX | React/Vue 组件 |
| `.js` | JavaScript | 纯 JavaScript 文件 |
| `.jsx` | JavaScript + JSX | React 组件 |
| `.mjs` | ES Module | ES 模块文件 |

### 6.2 其他扩展名处理

```typescript
// 其他扩展名文件的处理策略

┌─────────────────────────────────────────────────────────────┐
│                    文件分类处理策略                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  待解析扩展名 (.ts/.tsx/.js/.jsx/.mjs):                      │
│  ├─ 创建 FILE 节点                                          │
│  ├─ 创建 CONTAINS 边                                        │
│  └─ 收集到 filesToParse[]                                   │
│                                                             │
│  其他扩展名 (.json/.css/.md/.html 等):                       │
│  ├─ 创建 FILE 节点                                          │
│  ├─ 创建 CONTAINS 边                                        │
│  └─ 不收集到 filesToParse[]                                 │
│     （这些文件由 C3 解析器在导入时间接处理）                  │
│                                                             │
│  声明文件 (.d.ts):                                           │
│  ├─ 创建 FILE 节点                                          │
│  ├─ 创建 CONTAINS 边                                        │
│  ├─ 不收集到 filesToParse[]                                 │
│  │  （TypeScript 解析器会自动处理）                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 扩展名检查函数

```typescript
/**
 * 检查文件扩展名是否在待解析列表中
 */
function isParseableFile(fileName: string, extensions: string[]): boolean {
  const ext = path.extname(fileName);
  return extensions.includes(ext);
}

/**
 * 获取文件扩展名分类
 */
function classifyFile(fileName: string, extensions: string[]): {
  isParseable: boolean;
  extension: string;
  category: 'typescript' | 'javascript' | 'declaration' | 'config' | 'style' | 'other';
} {
  const ext = path.extname(fileName);
  
  const isParseable = extensions.includes(ext);
  
  let category: string;
  if (ext === '.ts' || ext === '.tsx') {
    category = 'typescript';
  } else if (ext === '.js' || ext === '.jsx' || ext === '.mjs') {
    category = 'javascript';
  } else if (ext === '.d.ts') {
    category = 'declaration';
  } else if (['.json', '.yaml', '.yml', '.toml'].includes(ext)) {
    category = 'config';
  } else if (['.css', '.scss', '.sass', '.less', '.styl'].includes(ext)) {
    category = 'style';
  } else {
    category = 'other';
  }
  
  return { isParseable, extension: ext, category };
}
```

---

## 7. 节点 ID 格式规范

### 7.1 DIRECTORY 节点 ID

```typescript
// 格式规则

┌─────────────────────────────────────────────────────────────┐
│                    DIRECTORY 节点 ID 格式                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  格式: "DIRECTORY:<相对路径>"                                │
│                                                             │
│  根目录:                                                     │
│  ├─ id: "DIRECTORY:."                                       │
│  ├─ path: "."                                               │
│  └─ name: "<项目目录名>"                                     │
│                                                             │
│  一级子目录:                                                 │
│  ├─ id: "DIRECTORY:src"                                     │
│  ├─ path: "src"                                             │
│  └─ name: "src"                                             │
│                                                             │
│  多级子目录:                                                 │
│  ├─ id: "DIRECTORY:src/components/ui"                       │
│  ├─ path: "src/components/ui"                               │
│  └─ name: "ui"                                              │
│                                                             │
│  路径分隔符: 使用 POSIX 风格 (/)                             │
│  ├─ Windows 路径需要转换: src\\components → src/components  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 FILE 节点 ID

```typescript
// 格式规则

┌─────────────────────────────────────────────────────────────┐
│                    FILE 节点 ID 格式                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  格式: "FILE:<相对路径>"                                     │
│                                                             │
│  根目录文件:                                                 │
│  ├─ id: "FILE:README.md"                                    │
│  ├─ path: "README.md"                                       │
│  └─ name: "README.md"                                       │
│                                                             │
│  子目录文件:                                                 │
│  ├─ id: "FILE:src/main.ts"                                  │
│  ├─ path: "src/main.ts"                                     │
│  └─ name: "main.ts"                                         │
│                                                             │
│  多级目录文件:                                               │
│  ├─ id: "FILE:src/components/ui/Button.tsx"                 │
│  ├─ path: "src/components/ui/Button.tsx"                    │
│  └─ name: "Button.tsx"                                      │
│                                                             │
│  路径分隔符: 使用 POSIX 风格 (/)                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 路径规范化

```typescript
/**
 * 将路径规范化为 POSIX 风格（使用 / 分隔）
 */
function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

/**
 * 生成节点 ID
 */
function generateNodeId(type: NodeType, relativePath: string): string {
  const normalized = normalizePath(relativePath);
  return `${type}:${normalized}`;
}
```

---

## 8. 边界情况处理

### 8.1 权限错误处理

```typescript
┌─────────────────────────────────────────────────────────────┐
│                    权限错误处理策略                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  场景: fs.readdir 抛出 EACCES 错误                           │
│                                                             │
│  处理:                                                       │
│  ├─ 跳过该目录                                               │
│  ├─ 记录 warning: "Permission denied: <path>"               │
│  ├─ stats.skipped++                                         │
│  └─ 继续扫描其他目录                                         │
│                                                             │
│  不:                                                         │
│  ├─ ❌ 抛出异常中断流程                                      │
│  ├─ ❌ 创建空的 DIRECTORY 节点                               │
│                                                             │
│  示例代码:                                                   │
│  try {                                                       │
│    entries = fs.readdirSync(currentDir, { withFileTypes }); │
│  } catch (error) {                                          │
│    if (error.code === 'EACCES') {                           │
│      result.warnings.push(`Permission denied: ${relPath}`); │
│      result.stats.skipped++;                                │
│      return;                                                │
│    }                                                        │
│    throw error; // 其他错误抛出                              │
│  }                                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 符号链接处理

```typescript
┌─────────────────────────────────────────────────────────────┐
│                    符号链接处理策略                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  场景: 遇到符号链接（symlink）                               │
│                                                             │
│  处理:                                                       │
│  ├─ 不跟随符号链接                                           │
│  ├─ 跳过该条目                                               │
│  ├─ 记录 warning: "Symlink skipped: <path>"                 │
│  ├─ stats.skipped++                                         │
│                                                             │
│  理由:                                                       │
│  ├─ 防止无限循环                                             │
│  ├─ 符号链接可能指向项目外                                   │
│  ├─ 保持图结构的确定性                                       │
│                                                             │
│  检测方法:                                                   │
│  entry.isSymbolicLink() // Dirent 方法                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.3 空目录处理

```typescript
┌─────────────────────────────────────────────────────────────┐
│                    空目录处理策略                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  场景: 目录没有任何文件或子目录                               │
│                                                             │
│  处理:                                                       │
│  ├─ 不创建 DIRECTORY 节点                                    │
│  ├─ 不创建 CONTAINS 边                                       │
│  ├─ stats.skipped++                                         │
│  ├─ 不记录 warning（正常情况）                               │
│                                                             │
│  理由:                                                       │
│  ├─ 空目录对代码结构无意义                                   │
│  ├─ 减少图的节点数量                                         │
│  ├─ 避免创建无用的 CONTAINS 边                               │
│                                                             │
│  特殊情况:                                                   │
│  ├─ 仅包含被忽略文件的目录 → 视为空目录                      │
│  │  （例如仅包含 .gitkeep 的目录）                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.4 不存在路径处理

```typescript
┌─────────────────────────────────────────────────────────────┐
│                    不存在路径处理策略                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  场景: 传入的 root 路径不存在                                 │
│                                                             │
│  处理:                                                       │
│  ├─ 返回空 ScanResult                                       │
│  │  nodes: [], edges: [], filesToParse: []                  │
│  ├─ stats: { directories: 0, files: 0, skipped: 0 }         │
│  ├─ warnings: ["Path does not exist: <root>"]               │
│                                                             │
│  不:                                                         │
│  ├─ ❌ 抛出异常                                              │
│  ├─ ❌ 返回 null/undefined                                  │
│                                                             │
│  场景: 传入的是文件而非目录                                   │
│                                                             │
│  处理:                                                       │
│  ├─ 同上，返回空结果                                         │
│  ├─ warnings: ["Path is not a directory: <root>"]           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.5 隐藏目录/文件处理

```typescript
┌─────────────────────────────────────────────────────────────┐
│                    隐藏目录/文件处理策略                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  定义: 以 . 开头的目录或文件（除特定规则外）                  │
│                                                             │
│  默认行为 (includeHidden: false):                           │
│  ├─ 跳过所有以 . 开头的条目                                  │
│  │  例如: .env, .eslintrc, .storybook/                      │
│  ├─ stats.skipped++                                         │
│                                                             │
│  但忽略规则优先:                                             │
│  ├─ .git/ 由忽略规则处理（不只是隐藏检查）                   │
│  ├─ .codegraph/ 由忽略规则处理                              │
│                                                             │
│  开启 includeHidden 时:                                      │
│  ├─ 仍然应用忽略规则                                         │
│  ├─ 但 .env, .eslintrc 等会被扫描                           │
│  │  （可能有用：某些项目有 .env.example）                    │
│                                                             │
│  特殊隐藏目录（即使 includeHidden=true 也忽略）:             │
│  ├─ .git/ （忽略规则）                                       │
│  ├─ .codegraph/ （忽略规则）                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.6 深度限制处理

```typescript
┌─────────────────────────────────────────────────────────────┐
│                    深度限制处理策略                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  场景: 递归深度超过 maxDepth (默认 20)                       │
│                                                             │
│  处理:                                                       │
│  ├─ 停止该分支的递归                                         │
│  ├─ 记录 warning: "Max depth <n> reached at <path>"         │
│  ├─ stats.skipped++                                         │
│                                                             │
│  理由:                                                       │
│  ├─ 防止无限递归（malformed 项目结构）                       │
│  ├─ 控制内存和性能                                           │
│                                                             │
│  常见深度:                                                   │
│  ├─ 典型项目: 5-8 层                                         │
│  ├─ maxDepth=20 覆盖绝大部分场景                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. 性能优化策略

### 9.1 使用同步 API

```typescript
// MVP 使用同步 API（更简单，性能足够）

理由:
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  fs.readdirSync 比 fs.promises.readdir 更快                │
│  ├─ 无 Promise 包装开销                                      │
│  ├─ V8 优化同步调用                                          │
│                                                             │
│  扫描时间 < 500ms 时，异步无意义                             │
│  ├─ 1000 目录项目实测: ~200ms                               │
│  ├─ 异步的优势在 IO 密集场景                                 │
│  ├─ 文件系统扫描不是 IO 密集（目录信息缓存）                  │
│                                                             │
│  后续优化:                                                   │
│  ├─ 若扫描时间 > 1s，可改用异步并行                          │
│  ├─ 使用 worker_threads 进行并行扫描                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 避免深度递归栈溢出

```typescript
/**
 * 使用迭代方式而非递归（可选优化）
 */
function scanIterative(root: string, options: ScanOptions): ScanResult {
  const result: ScanResult = createEmptyResult();
  const queue: { dir: string; parentId: string; depth: number }[] = [];
  
  // 初始化队列
  queue.push({ dir: root, parentId: 'DIRECTORY:.', depth: 0 });
  
  while (queue.length > 0) {
    const { dir, parentId, depth } = queue.shift()!;
    
    if (depth > options.maxDepth!) {
      result.warnings.push(`Max depth reached at ${dir}`);
      continue;
    }
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      // ... 处理逻辑
      
      if (entry.isDirectory()) {
        // 将子目录加入队列而非递归调用
        queue.push({
          dir: path.join(dir, entry.name),
          parentId: newNodeId,
          depth: depth + 1,
        });
      }
    }
  }
  
  return result;
}
```

### 9.3 预分配结果数组

```typescript
// 对于大型项目，预分配数组减少扩容开销

function scanDirectory(root: string, options?: ScanOptions): ScanResult {
  // 估算规模（可选）
  const estimatedSize = estimateDirectorySize(root);
  
  const result: ScanResult = {
    nodes: new Array(estimatedSize.nodes),  // 预分配
    edges: new Array(estimatedSize.edges),
    filesToParse: [],
    stats: { directories: 0, files: 0, skipped: 0 },
    warnings: [],
  };
  
  // ... 但 MVP 不需要，直接使用动态数组
}
```

### 9.4 大目录处理建议

```typescript
┌─────────────────────────────────────────────────────────────┐
│                    大目录性能优化建议                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  node_modules 被忽略:                                        │
│  ├─ 最大目录已不在扫描范围                                   │
│  ├─ 剩余目录通常 < 500 个                                    │
│                                                             │
│  性能基准:                                                   │
│  ├─ 100 目录: < 50ms                                        │
│  ├─ 500 目录: < 200ms                                       │
│  ├─ 1000 目录: < 500ms                                      │
│                                                             │
│  超过 1s 时:                                                 │
│  ├─ 检查是否有未忽略的大目录                                 │
│  ├─ 考虑添加到忽略规则                                       │
│  ├─ 或使用异步并行版本                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. 测试场景清单

### 10.1 基础扫描场景

| ID | 场景 | Fixture 结构 | 预期结果 |
|----|------|--------------|----------|
| T01 | 空目录扫描 | `<empty>` | nodes: `[DIRECTORY:.]`, filesToParse: `[]`, warnings: `[]` |
| T02 | 单文件目录 | `main.ts` | nodes: `[DIRECTORY:., FILE:main.ts]`, edges: `[DIRECTORY:. → FILE:main.ts]` |
| T03 | 单目录无文件 | `src/` (空) | nodes: `[DIRECTORY:.]`, stats.skipped: `1` |
| T04 | 单目录含文件 | `src/main.ts` | nodes: `[DIRECTORY:., DIRECTORY:src, FILE:src/main.ts]`, edges: `[DIRECTORY:. → DIRECTORY:src, DIRECTORY:src → FILE:src/main.ts]` |

### 10.2 多层嵌套场景

| ID | 场景 | Fixture 结构 | 预期结果 |
|----|------|--------------|----------|
| T05 | 两层嵌套 | `src/utils/format.ts` | nodes: 4, edges: 3, filesToParse: `[src/utils/format.ts]` |
| T06 | 三层嵌套 | `src/components/ui/Button.tsx` | nodes: 5, edges: 4 |
| T07 | 多个同级目录 | `src/a.ts`, `lib/b.ts` | nodes: 4, edges: 2 |
| T08 | 混合文件和目录 | `src/main.ts`, `README.md`, `src/utils/format.ts` | nodes: 5, edges: 3, filesToParse: `[src/main.ts, src/utils/format.ts]` |

### 10.3 忽略规则场景

| ID | 场景 | Fixture 结构 | 预期结果 |
|----|------|--------------|----------|
| T09 | node_modules 被忽略 | `src/main.ts`, `node_modules/react/index.js` | nodes: 不含 node_modules |
| T10 | .git 被忽略 | `.git/config`, `src/main.ts` | nodes: 不含 .git |
| T11 | dist 被忽略 | `dist/bundle.js`, `src/main.ts` | filesToParse 不含 dist |
| T12 | 多个忽略目录 | `node_modules/`, `.git/`, `dist/`, `src/` | 仅扫描 src |
| T13 | 自定义忽略规则 | `temp/a.ts`, `src/b.ts` | options.ignoreRules: `['temp/']` → 仅扫描 src |

### 10.4 CONTAINS 边场景

| ID | 场景 | 验证内容 |
|----|------|----------|
| T14 | 根目录 CONTAINS 子目录 | `src/main.ts` → edge: `DIRECTORY:. → DIRECTORY:src` |
| T15 | 根目录 CONTAINS 文件 | `README.md` → edge: `DIRECTORY:. → FILE:README.md` |
| T16 | 子目录 CONTAINS 文件 | `src/main.ts` → edge: `DIRECTORY:src → FILE:src/main.ts` |
| T17 | 子目录 CONTAINS 孙目录 | `src/components/Button.tsx` → edge: `DIRECTORY:src → DIRECTORY:src/components` |
| T18 | CONTAINS 边总数 | 3 层结构 → edges 数量 = 目录数 + 文件数 - 1 |

### 10.5 文件分类场景

| ID | 场景 | 文件扩展名 | 预期 filesToParse |
|----|------|------------|-------------------|
| T19 | TypeScript 文件 | `.ts` | 包含 |
| T20 | TSX 文件 | `.tsx` | 包含 |
| T21 | JavaScript 文件 | `.js`, `.jsx` | 包含 |
| T22 | ES Module | `.mjs` | 包含 |
| T23 | JSON 文件 | `.json` | 不包含 |
| T24 | CSS 文件 | `.css` | 不包含 |
| T25 | Markdown 文件 | `.md` | 不包含 |
| T26 | 声明文件 | `.d.ts` | 不包含（默认） |
| T27 | 自定义扩展名 | `.vue` | options.extensions 添加后包含 |

### 10.6 边界情况场景

| ID | 场景 | 输入 | 预期结果 |
|----|------|------|----------|
| T28 | 路径不存在 | `/nonexistent/path` | nodes: `[]`, warnings: `["Path does not exist"]` |
| T29 | 路径是文件 | `./main.ts` (文件) | nodes: `[]`, warnings: `["Path is not a directory"]` |
| T30 | 符号链接 | `src/link → ../external` | warnings: `["Symlink skipped: src/link"]` |
| T31 | 权限错误 | 无权限目录 | warnings: `["Permission denied"]`, skipped++ |
| T32 | 空目录 | `src/` (空) | 不创建 `DIRECTORY:src` 节点 |
| T33 | 仅含忽略文件的目录 | `temp/.gitkeep` | 不创建 `DIRECTORY:temp` 节点 |
| T34 | 深度超限 | 25 层嵌套 | warnings: `["Max depth reached"]` |

### 10.7 隐藏文件场景

| ID | 场景 | Fixture 结构 | 预期结果 (默认) |
|----|------|--------------|-----------------|
| T35 | 隐藏文件 | `.env` | 跳过 |
| T36 | 隐藏目录 | `.storybook/` | 跳过 |
| T37 | 隐藏配置文件 | `.eslintrc.json` | 跳过 |
| T38 | includeHidden=true | `.env.example` | 包含 |
| T39 | .git 即使 includeHidden | `.git/` | 仍然跳过（忽略规则） |

### 10.8 性能测试场景

| ID | 场景 | 验证标准 |
|----|------|----------|
| P01 | 100 目录项目 | 扫描时间 < 50ms |
| P02 | 500 目录项目 | 扫描时间 < 200ms |
| P03 | 1000 目录项目 | 扫描时间 < 500ms |
| P04 | 大型 monorepo | 2000 目录 < 1s |
| P05 | 内存使用 | < 50MB |

---

## 11. 与 C1 集成示例

### 11.1 基础集成流程

```typescript
import { CodeGraph, NodeType, EdgeType, GraphNode, GraphEdge } from '@oh-my-terminator/codegraph';
import { scanDirectory } from './scanner';

// 创建空图
const graph = new CodeGraph();

// 执行扫描
const result = scanDirectory('./src', {
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
});

// 添加节点
for (const node of result.nodes) {
  graph.addNode(node);
}

// 添加边
for (const edge of result.edges) {
  graph.addEdge(edge);
}

// 输出统计
console.log(`Scanned ${result.stats.directories} directories, ${result.stats.files} files`);
console.log(`Found ${result.filesToParse.length} files to parse`);

// 将 filesToParse 传递给 C3 解析器
import { parseFiles } from './parser/ts-parser';

const parseResult = await parseFiles(result.filesToParse, './src');
for (const node of parseResult.nodes) graph.addNode(node);
for (const edge of parseResult.edges) graph.addEdge(edge);
```

### 11.2 全量分析入口（C5）

```typescript
/**
 * C5 全量分析流程的扫描部分
 */
async function analyzeFull(cwd: string): Promise<CodeGraph> {
  const graph = new CodeGraph();
  
  // Step 1: 扫描文件系统
  const scanResult = scanDirectory(cwd);
  
  // Step 2: 添加扫描结果到图
  for (const node of scanResult.nodes) {
    graph.addNode(node);
  }
  for (const edge of scanResult.edges) {
    graph.addEdge(edge);
  }
  
  // Step 3: 解析文件（C3）
  const parseResult = await parseFiles(scanResult.filesToParse, cwd);
  
  // Step 4: 添加解析结果到图
  for (const node of parseResult.nodes) {
    graph.addNode(node);
  }
  for (const edge of parseResult.edges) {
    graph.addEdge(edge);
  }
  
  return graph;
}
```

### 11.3 CLI 命令使用（C9）

```typescript
// codegraph analyze 命令中的扫描步骤

export async function runAnalyze(cwd: string): Promise<void> {
  console.log('Scanning file system...');
  
  const scanResult = scanDirectory(cwd);
  
  console.log(`Found ${scanResult.stats.directories} directories`);
  console.log(`Found ${scanResult.stats.files} files`);
  console.log(`${scanResult.filesToParse.length} files to parse`);
  
  if (scanResult.warnings.length > 0) {
    console.warn('Warnings:');
    for (const warning of scanResult.warnings) {
      console.warn(`  - ${warning}`);
    }
  }
  
  // 继续解析...
}
```

### 11.4 错误处理示例

```typescript
/**
 * 处理扫描过程中的警告
 */
function handleScanResult(result: ScanResult): void {
  // 检查是否有严重警告
  const criticalWarnings = result.warnings.filter(w => 
    w.includes('Permission denied') || 
    w.includes('Max depth')
  );
  
  if (criticalWarnings.length > 0) {
    console.error('Critical warnings during scan:');
    for (const w of criticalWarnings) {
      console.error(`  - ${w}`);
    }
    // 决定是否继续
  }
  
  // 检查是否扫描了足够的内容
  if (result.stats.files === 0) {
    console.warn('No files found. Check ignore rules.');
  }
}
```

---

## 附录 A: Fixture 测试目录结构

```
tests/fixtures/
├─ empty-project/              # T01
│  (空目录)
│
├─ single-file/                # T02
│  └─ main.ts
│
├─ single-empty-dir/           # T03
│  └─ src/ (空)
│
├─ two-level-nested/           # T05
│  └─ src/
│     └─ utils/
│        └─ format.ts
│
├─ three-level-nested/         # T06
│  └─ src/
│     └─ components/
│        └─ ui/
│           └─ Button.tsx
│
├─ with-node-modules/          # T09
│  ├─ src/
│  │  └─ main.ts
│  └─ node_modules/
│     └─ react/
│        └─ index.js
│
├─ with-git/                   # T10
│  ├─ .git/
│  │  └─ config
│  └─ src/
│     └─ main.ts
│
├─ with-symlink/               # T30
│  ├─ src/
│  │  └─ main.ts
│  └─ link → ../external/  (符号链接)
│
├─ hidden-files/               # T35-T39
│  ├─ .env
│  ├─ .env.example
│  ├─ .storybook/
│  │  └─ config.js
│  └─ src/
│     └─ main.ts
│
├─ deep-nested/                # T34
│  └─ a/
│     └─ b/
│        └─ ... (25层)
│           └─ deep.ts
│
└─ mixed-content/              # T08, T19-T27
   ├─ src/
   │  ├─ main.ts
   │  ├─ utils.ts
   │  └─ components/
   │     └─ Button.tsx
   ├─ lib/
   │  └─ helper.js
   ├─ README.md
   ├─ package.json
   └─ styles.css
```

---

## 附录 B: 性能基准测试方法

```typescript
// tests/performance/scanner.bench.ts

import { scanDirectory } from '../../src/scanner';
import { performance } from 'perf_hooks';

function benchmark(name: string, root: string, expectedTime: number): void {
  const start = performance.now();
  const result = scanDirectory(root);
  const elapsed = performance.now() - start;
  
  console.log(`${name}:`);
  console.log(`  Time: ${elapsed.toFixed(2)}ms (expected < ${expectedTime}ms)`);
  console.log(`  Nodes: ${result.nodes.length}`);
  console.log(`  Edges: ${result.edges.length}`);
  console.log(`  Files to parse: ${result.filesToParse.length}`);
  
  if (elapsed > expectedTime) {
    console.error(`  FAILED: Exceeded expected time`);
  } else {
    console.log(`  PASSED`);
  }
}

// 运行基准测试
benchmark('100 dirs', './fixtures/100-dirs', 50);
benchmark('500 dirs', './fixtures/500-dirs', 200);
benchmark('1000 dirs', './fixtures/1000-dirs', 500);
```

---

**文档版本**: v1.0  
**创建日期**: 2026-05-03  
**关联 Change**: C2 - `cg-file-system-scanner`  
**下一步**: 实现扫描核心逻辑，完成 Change 2 交付