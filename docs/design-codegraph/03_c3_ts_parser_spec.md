# CodeGraph TypeScript 解析器 - 导入提取技术规格

> **文档定位**: Change 3 (`cg-ts-parser-imports`) 的详细技术实现规格
> **关联文档**: [01_origin_blueprint.md](./01_origin_blueprint.md) 第4.2节, [develop_changes_plan.md](./develop_changes_plan.md) C3

---

## 目录

1. [概述与目标](#1-概述与目标)
2. [createProgram 配置](#2-createprogram-配置)
3. [导入解析流程](#3-导入解析流程)
4. [别名路径处理](#4-别名路径处理)
5. [外部依赖判定](#5-外部依赖判定)
6. [动态导入处理](#6-动态导入处理)
7. [重导出处理](#7-重导出处理)
8. [边界情况处理](#8-边界情况处理)
9. [性能优化策略](#9-性能优化策略)
10. [测试场景清单](#10-测试场景清单)
11. [接口定义](#11-接口定义)

---

## 1. 概述与目标

### 1.1 功能目标

基于 TypeScript Compiler API 提取 TypeScript/JavaScript 文件间的导入关系，生成以下图谱元素：

| 元素 | 描述 |
|------|------|
| `IMPORTS` 边 | 静态导入关系 `FILE:A → FILE:B` |
| `RE_EXPORTS` 边 | 重导出关系 `FILE:A → FILE:B` |
| `DYNAMIC_IMPORTS` 边 | 动态导入 `import()` 关系 |
| `EXTERNAL` 节点 | 外部依赖包（node_modules 或内置模块） |

### 1.2 技术选型

- **核心依赖**: `typescript` 包（TypeScript Compiler API）
- **解析策略**: 使用 `ts.createProgram` + `ts.resolveModuleName`
- **无需类型检查**: 设置 `checkJs: false`, `noEmit: true` 提升性能

### 1.3 设计约束

1. **零运行时依赖**: 仅依赖 `typescript` 包，无需其他解析库
2. **性能优先**: 大型项目（1000+文件）解析时间 < 5秒
3. **路径准确性**: 别名路径（`@/utils`）必须正确解析到实际文件
4. **容错性**: 解析失败的文件不中断整体流程，记录错误继续

---

## 2. createProgram 配置

### 2.1 Program 创建流程

```typescript
import ts from 'typescript';

interface ProgramConfig {
  projectRoot: string;      // 项目根目录绝对路径
  filePaths: string[];      // 待解析文件列表（相对路径）
  configPath?: string;      // tsconfig.json 路径（可选）
}

function createTsProgram(config: ProgramConfig): ts.Program {
  // Step 1: 定位 tsconfig.json
  const configPath = config.configPath 
    ?? ts.findConfigFile(config.projectRoot, ts.sys.fileExists, 'tsconfig.json');
  
  // Step 2: 读取配置
  let compilerOptions: ts.CompilerOptions = getDefaultCompilerOptions();
  
  if (configPath) {
    const configReadResult = ts.readConfigFile(configPath, ts.sys.readFile);
    if (!configReadResult.error) {
      const parsedConfig = ts.parseJsonConfigFileContent(
        configReadResult.config,
        ts.sys,
        config.projectRoot,
        undefined,  // existing options
        configPath
      );
      compilerOptions = { ...compilerOptions, ...parsedConfig.options };
    }
  }
  
  // Step 3: 创建 Program
  const program = ts.createProgram(
    config.filePaths.map(f => path.resolve(config.projectRoot, f)),
    compilerOptions,
    createCompilerHost(compilerOptions, config.projectRoot)
  );
  
  return program;
}
```

### 2.2 默认 CompilerOptions

```typescript
function getDefaultCompilerOptions(): ts.CompilerOptions {
  return {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Node16,
    
    // 性能优化选项
    allowJs: true,              // 解析 JS 文件
    checkJs: false,             // 不对 JS 进行类型检查
    noEmit: true,               // 不生成输出文件
    skipLibCheck: true,         // 跳过 .d.ts 检查
    skipDefaultLibCheck: true,  // 跳过默认 lib 检查
    
    // 模块解析选项
    resolveJsonModule: true,    // 支持 JSON 导入
    esModuleInterop: true,      // 支持 CommonJS 互操作
    
    // 路径解析基础
    baseUrl: undefined,         // 将在 Step 2 中从 tsconfig 覆盖
    paths: undefined,           // 将在 Step 2 中从 tsconfig 覆盖
  };
}
```

### 2.3 CompilerHost 实现

```typescript
function createCompilerHost(
  options: ts.CompilerOptions,
  projectRoot: string
): ts.CompilerHost {
  
  const host: ts.CompilerHost = {
    // 文件系统操作
    fileExists: (fileName: string) => {
      const resolved = path.resolve(projectRoot, fileName);
      return ts.sys.fileExists(resolved);
    },
    
    readFile: (fileName: string) => {
      const resolved = path.resolve(projectRoot, fileName);
      return ts.sys.readFile(resolved);
    },
    
    // 目录操作
    directoryExists: (dirName: string) => {
      const resolved = path.resolve(projectRoot, dirName);
      return ts.sys.directoryExists(resolved);
    },
    
    getDirectories: (dirName: string) => {
      const resolved = path.resolve(projectRoot, dirName);
      return ts.sys.getDirectories(resolved);
    },
    
    // 当前目录
    getCurrentDirectory: () => projectRoot,
    
    // 路径规范
    getCanonicalFileName: (fileName: string) => 
      ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
    
    getNewLine: () => ts.sys.newLine,
    
    // 默认 lib 定位
    getDefaultLibFileName: (opts: ts.CompilerOptions) => 
      ts.getDefaultLibFileName(opts),
    
    // 源文件获取（关键）
    getSourceFile: (fileName: string, languageVersion: ts.ScriptTarget) => {
      const resolved = path.resolve(projectRoot, fileName);
      const content = host.readFile(resolved);
      if (content === undefined) return undefined;
      return ts.createSourceFile(resolved, content, languageVersion, true);
    },
    
    // 写入操作（不需要）
    writeFile: () => {},
    
    // 模块解析缓存（可选优化）
    resolveModuleNames: undefined,  // 使用默认解析
  };
  
  return host;
}
```

### 2.4 配置优先级

```
配置合并优先级（后者覆盖前者）：

1. getDefaultCompilerOptions() 基础默认值
2. tsconfig.json 中的 compilerOptions
3. 显式传入的 override options（如有）

关键配置说明：
┌─────────────────────────────────────────────────────────────┐
│ 配置项            │ 作用                                      │
├─────────────────────────────────────────────────────────────┤
│ baseUrl           │ 路径解析的基准目录                         │
│ paths             │ 别名映射规则                               │
│ moduleResolution  │ 模块解析策略（Node16 推荐）                │
│ allowJs           │ 是否解析 .js/.jsx 文件                     │
│ resolveJsonModule │ 是否支持 import './data.json'             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 导入解析流程

### 3.1 核心解析架构

```
┌─────────────────────────────────────────────────────────────┐
│                    导入解析流程                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SourceFile                                                 │
│      │                                                      │
│      ▼                                                      │
│  遍历 AST 节点                                               │
│      │                                                      │
│      ├─ ImportDeclaration                                    │
│      ├─ ExportDeclaration (with 'from')                     │
│      ├─ ImportEqualsDeclaration                             │
│      ├─ CallExpression (import())                           │
│      └                                                      │
│      ▼                                                      │
│  提取模块说明符 (moduleSpecifier)                            │
│      │                                                      │
│      │  例: './utils', '@/components/Button', 'react'       │
│      │                                                      │
│      ▼                                                      │
│  resolveModuleName()                                        │
│      │                                                      │
│      ├─ 内部模块 → 返回 resolvedFileName                    │
│      ├─ 外部模块 → 返回 packageId                           │
│      └                                                      │
│      ▼                                                      │
│  生成边/节点                                                 │
│      │                                                      │
│      ├─ 内部 → IMPORTS/RE_EXPORTS 边                        │
│      └─ 外部 → EXTERNAL 节点                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 模块解析 Host

```typescript
interface ModuleResolutionHost {
  fileExists: (fileName: string) => boolean;
  readFile: (fileName: string) => string | undefined;
  directoryExists: (dirName: string) => boolean;
  getDirectories: (dirName: string) => string[];
  getCurrentDirectory: () => string;
  getCanonicalFileName: (fileName: string) => string;
}

function createModuleResolutionHost(
  projectRoot: string,
  compilerOptions: ts.CompilerOptions
): ModuleResolutionHost {
  
  return {
    fileExists: (fileName: string) => {
      // 尝试多种扩展名
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.d.ts'];
      for (const ext of extensions) {
        const fullPath = path.resolve(projectRoot, fileName + ext);
        if (fs.existsSync(fullPath)) return true;
      }
      return false;
    },
    
    readFile: (fileName: string) => {
      const resolved = path.resolve(projectRoot, fileName);
      try {
        return fs.readFileSync(resolved, 'utf-8');
      } catch {
        return undefined;
      }
    },
    
    directoryExists: (dirName: string) => {
      const resolved = path.resolve(projectRoot, dirName);
      return fs.existsSync(resolved) && fs.statSync(resolved).isDirectory();
    },
    
    getDirectories: (dirName: string) => {
      const resolved = path.resolve(projectRoot, dirName);
      try {
        return fs.readdirSync(resolved)
          .filter(name => fs.statSync(path.join(resolved, name)).isDirectory());
      } catch {
        return [];
      }
    },
    
    getCurrentDirectory: () => projectRoot,
    
    getCanonicalFileName: (fileName: string) => 
      fileName,  // macOS/Linux case-sensitive
  };
}
```

### 3.3 resolveModuleName 调用

```typescript
interface ResolvedModuleInfo {
  resolvedPath: string | null;     // 解析后的绝对路径（内部模块）
  isExternal: boolean;             // 是否为外部依赖
  packageName?: string;            // 外部包名
  packageVersion?: string;         // 外部包版本
}

function resolveModuleSpecifier(
  specifier: string,
  sourceFile: ts.SourceFile,
  program: ts.Program,
  compilerOptions: ts.CompilerOptions,
  projectRoot: string
): ResolvedModuleInfo {
  
  const host = createModuleResolutionHost(projectRoot, compilerOptions);
  
  // 使用 TypeScript 内置模块解析
  const resolved = ts.resolveModuleName(
    specifier,
    sourceFile.fileName,
    compilerOptions,
    host,
    program.getModuleResolver?.()  // 可选的缓存 resolver
  );
  
  // 解析结果分析
  if (resolved.resolvedModule) {
    const module = resolved.resolvedModule;
    
    // 判断是否为外部模块
    const isExternal = isExternalModule(module.resolvedFileName, projectRoot);
    
    if (isExternal) {
      // 提取包名
      const packageInfo = extractPackageInfo(module.resolvedFileName, projectRoot);
      return {
        resolvedPath: null,
        isExternal: true,
        packageName: packageInfo.name,
        packageVersion: packageInfo.version,
      };
    } else {
      // 内部模块
      const relativePath = path.relative(projectRoot, module.resolvedFileName);
      return {
        resolvedPath: relativePath,
        isExternal: false,
      };
    }
  }
  
  // 未找到模块
  return {
    resolvedPath: null,
    isExternal: true,  // 视为外部（可能未安装）
    packageName: specifier,
  };
}
```

### 3.4 解析结果处理流程

```typescript
function processImportDeclaration(
  importDecl: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  context: ParserContext
): ImportResult {
  
  // 1. 提取模块说明符
  const specifier = getModuleSpecifier(importDecl);
  if (!specifier) return { type: 'error', message: 'Empty specifier' };
  
  // 2. 解析模块路径
  const resolved = resolveModuleSpecifier(
    specifier,
    sourceFile,
    context.program,
    context.compilerOptions,
    context.projectRoot
  );
  
  // 3. 获取导入位置
  const line = sourceFile.getLineAndCharacterOfPosition(importDecl.getStart()).line + 1;
  
  // 4. 分析导入类型
  const importSpecifiers = analyzeImportBindings(importDecl);
  
  // 5. 生成结果
  if (resolved.isExternal) {
    return {
      type: 'external',
      specifier,
      packageName: resolved.packageName!,
      line,
      importSpecifiers,
    };
  } else {
    return {
      type: 'internal',
      specifier,
      resolvedPath: resolved.resolvedPath!,
      line,
      importSpecifiers,
    };
  }
}

function getModuleSpecifier(decl: ts.ImportDeclaration | ts.ExportDeclaration): string | null {
  const moduleSpecifier = decl.moduleSpecifier;
  if (!moduleSpecifier) return null;
  
  if (ts.isStringLiteral(moduleSpecifier)) {
    return moduleSpecifier.text;
  }
  
  return null;
}

function analyzeImportBindings(decl: ts.ImportDeclaration): ImportSpecifierInfo[] {
  const result: ImportSpecifierInfo[] = [];
  const importClause = decl.importClause;
  
  if (!importClause) return result;
  
  // 默认导入: import React from 'react'
  if (importClause.name) {
    result.push({
      type: 'default',
      name: importClause.name.text,
      importedName: 'default',
    });
  }
  
  // 命名导入: import { useState, useEffect } from 'react'
  if (importClause.namedBindings) {
    if (ts.isNamedImports(importClause.namedBindings)) {
      for (const element of importClause.namedBindings.elements) {
        result.push({
          type: 'named',
          name: element.name.text,
          importedName: element.propertyName?.text ?? element.name.text,
        });
      }
    }
    
    // 命名空间导入: import * as utils from './utils'
    if (ts.isNamespaceImport(importClause.namedBindings)) {
      result.push({
        type: 'namespace',
        name: importClause.namedBindings.name.text,
        importedName: '*',
      });
    }
  }
  
  return result;
}
```

---

## 4. 别名路径处理

### 4.1 paths 配置解析

```typescript
interface PathAliasConfig {
  baseUrl: string;
  paths: Map<string, string[]>;
}

function parsePathsConfig(compilerOptions: ts.CompilerOptions, projectRoot: string): PathAliasConfig | null {
  if (!compilerOptions.baseUrl && !compilerOptions.paths) {
    return null;
  }
  
  const baseUrl = compilerOptions.baseUrl 
    ? path.resolve(projectRoot, compilerOptions.baseUrl)
    : projectRoot;
  
  const paths = new Map<string, string[]>();
  
  if (compilerOptions.paths) {
    for (const [pattern, mappings] of Object.entries(compilerOptions.paths)) {
      // 将每个映射转换为基于 baseUrl 的绝对路径
      const resolvedMappings = mappings.map(m => 
        path.resolve(baseUrl, m)
      );
      paths.set(pattern, resolvedMappings);
    }
  }
  
  return { baseUrl, paths };
}
```

### 4.2 paths 配置示例

```typescript
// tsconfig.json 示例
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],                   // @/utils → src/utils
      "@components/*": ["components/*"],  // @components/Button → src/components/Button
      "@utils": ["utils/index.ts"],   // @utils → src/utils/index.ts
      "@/lib/*": ["lib/*", "shared/lib/*"]  // 多映射尝试
    }
  }
}

// 解析逻辑：
// 1. 输入: '@/utils/format' 来自 'src/pages/Home.tsx'
// 2. 匹配 pattern '@/*'
// 3. 替换 '*' → 'utils/format'
// 4. 基于 baseUrl → 'src/utils/format'
// 5. 尝试扩展名 → 'src/utils/format.ts' 或 'src/utils/format/index.ts'
```

### 4.3 别名解析实现

```typescript
function resolveAliasPath(
  specifier: string,
  pathConfig: PathAliasConfig,
  host: ModuleResolutionHost
): string | null {
  
  // 非别名路径直接返回
  if (specifier.startsWith('./') || specifier.startsWith('../') || path.isAbsolute(specifier)) {
    return null;
  }
  
  // 遍历 paths 配置匹配
  for (const [pattern, mappings] of pathConfig.paths) {
    const match = matchPathPattern(specifier, pattern);
    if (match) {
      // 尝试每个映射路径
      for (const mapping of mappings) {
        const candidatePath = resolveMappingPath(mapping, match.wildcardMatch);
        
        // 尝试多种扩展名
        const resolved = tryResolveWithExtensions(candidatePath, host);
        if (resolved) {
          return resolved;
        }
      }
    }
  }
  
  return null;
}

function matchPathPattern(specifier: string, pattern: string): { matched: boolean; wildcardMatch?: string } {
  // 处理通配符模式
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    if (specifier.startsWith(prefix)) {
      return {
        matched: true,
        wildcardMatch: specifier.slice(prefix.length),
      };
    }
  }
  
  // 精确匹配
  if (specifier === pattern) {
    return { matched: true };
  }
  
  return { matched: false };
}

function resolveMappingPath(mapping: string, wildcardMatch?: string): string {
  if (mapping.endsWith('*') && wildcardMatch) {
    return mapping.slice(0, -1) + wildcardMatch;
  }
  return mapping;
}

function tryResolveWithExtensions(basePath: string, host: ModuleResolutionHost): string | null {
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.d.ts'];
  
  for (const ext of extensions) {
    const fullPath = basePath + ext;
    if (host.fileExists(fullPath)) {
      return fullPath;
    }
  }
  
  // 尝试 index 文件
  const indexExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
  const indexPath = path.join(basePath, 'index');
  
  for (const ext of indexExtensions) {
    const fullPath = indexPath + ext;
    if (host.fileExists(fullPath)) {
      return fullPath;
    }
  }
  
  return null;
}
```

### 4.4 baseUrl 作用说明

```
baseUrl 的三层作用：

┌─────────────────────────────────────────────────────────────┐
│                    baseUrl 作用层级                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Level 1: 路径基准                                          │
│  └─ 相对导入解析的基准目录                                   │
│  └─ import './utils' 基于 baseUrl 解析                      │
│                                                             │
│  Level 2: paths 映射基准                                    │
│  └─ paths 配置中的映射路径相对于 baseUrl                     │
│  └─ "@/*": ["*"] → baseUrl + *                              │
│                                                             │
│  Level 3: 模块搜索起点                                      │
│  └─ 无相对路径的裸模块名搜索起点                             │
│  └─ import 'utils' → baseUrl/utils (若未在 node_modules)    │
│                                                             │
│  注意：Level 3 通常是误用，应依赖 moduleResolution           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 外部依赖判定

### 5.1 node_modules 判断逻辑

```typescript
function isExternalModule(resolvedFileName: string, projectRoot: string): boolean {
  const normalizedPath = path.normalize(resolvedFileName);
  const normalizedRoot = path.normalize(projectRoot);
  
  // 1. 检查是否在 node_modules 内
  if (normalizedPath.includes(`${normalizedRoot}/node_modules/`) ||
      normalizedPath.includes(`${normalizedRoot}/node_modules\\`)) {
    return true;
  }
  
  // 2. 检查是否在项目根目录外
  if (!normalizedPath.startsWith(normalizedRoot)) {
    return true;
  }
  
  // 3. 检查 TypeScript 内置 lib
  if (normalizedPath.includes('node_modules/typescript/lib')) {
    return true;
  }
  
  return false;
}

function extractPackageInfo(filePath: string, projectRoot: string): { name: string; version?: string } {
  // 从 node_modules 路径提取包名
  const nodeModulesMarker = '/node_modules/';
  const markerIndex = filePath.indexOf(nodeModulesMarker);
  
  if (markerIndex === -1) {
    // Windows 路径
    const winMarker = '\\node_modules\\';
    const winIndex = filePath.indexOf(winMarker);
    if (winIndex === -1) {
      return { name: filePath };
    }
    return extractPackageFromPath(filePath, winIndex + winMarker.length);
  }
  
  return extractPackageFromPath(filePath, markerIndex + nodeModulesMarker.length);
}

function extractPackageFromPath(filePath: string, startIndex: number): { name: string; version?: string } {
  const afterNodeModules = filePath.slice(startIndex);
  const segments = afterNodeModules.split(/[/\\]/);
  
  // 处理 scoped package (@org/package)
  if (segments[0].startsWith('@')) {
    const packageName = `${segments[0]}/${segments[1]}`;
    return { name: packageName };
  }
  
  return { name: segments[0] };
}
```

### 5.2 EXTERNAL 节点生成

```typescript
interface ExternalNodeResult {
  node: GraphNode;
  isNew: boolean;  // 是否首次发现
}

function createExternalNode(
  packageName: string,
  existingNodes: Map<string, GraphNode>
): ExternalNodeResult {
  
  const nodeId = `EXTERNAL:${packageName}`;
  
  // 检查是否已存在
  if (existingNodes.has(nodeId)) {
    return { node: existingNodes.get(nodeId)!, isNew: false };
  }
  
  // 创建新节点
  const node: GraphNode = {
    id: nodeId,
    type: NodeType.EXTERNAL,
    path: packageName,
    name: packageName,
    metadata: {
      // 可选：记录首次发现位置
      firstSeenFile: undefined,  // 由调用方填充
    },
  };
  
  return { node, isNew: true };
}
```

### 5.3 内置模块判定

```typescript
const BUILTIN_MODULES = new Set([
  // Node.js 内置模块
  'fs', 'path', 'os', 'crypto', 'util', 'stream', 'events', 'http', 'https',
  'net', 'url', 'querystring', 'child_process', 'cluster', 'dgram', 'dns',
  'readline', 'repl', 'tls', 'tty', 'v8', 'vm', 'zlib', 'worker_threads',
  'console', 'process', 'buffer', 'timers', 'perf_hooks', 'assert', 'constants',
  
  // Node.js 兼容模块（TypeScript lib）
  'node:fs', 'node:path', 'node:os', /* ... */
]);

function isBuiltinModule(specifier: string): boolean {
  // 直接匹配
  if (BUILTIN_MODULES.has(specifier)) {
    return true;
  }
  
  // node: 前缀匹配
  if (specifier.startsWith('node:')) {
    return true;
  }
  
  return false;
}

function processBuiltinImport(specifier: string): ExternalNodeResult {
  // 内置模块视为 EXTERNAL，但不从 node_modules 解析
  const packageName = specifier.replace(/^node:/, '');
  const node: GraphNode = {
    id: `EXTERNAL:${specifier}`,
    type: NodeType.EXTERNAL,
    path: specifier,
    name: packageName,
    metadata: {
      kind: 'builtin',
    },
  };
  
  return { node, isNew: true };
}
```

---

## 6. 动态导入处理

### 6.1 import() AST 识别

```typescript
function findDynamicImports(sourceFile: ts.SourceFile): DynamicImportInfo[] {
  const results: DynamicImportInfo[] = [];
  
  ts.forEachChild(sourceFile, visit);
  
  function visit(node: ts.Node) {
    // 检查 CallExpression
    if (ts.isCallExpression(node)) {
      // 检查是否为 import() 调用
      if (isImportCall(node)) {
        const specifier = extractDynamicSpecifier(node);
        if (specifier) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          results.push({
            specifier,
            line,
            expression: node.expression,
          });
        }
      }
    }
    
    // 继续遍历子节点
    ts.forEachChild(node, visit);
  }
  
  return results;
}

function isImportCall(node: ts.CallExpression): boolean {
  const expression = node.expression;
  
  // 直接 import 调用
  if (ts.isIdentifier(expression) && expression.text === 'import') {
    return true;
  }
  
  // 可能的其他形式（较少见）
  // 如：require('import')() 等
  
  return false;
}

function extractDynamicSpecifier(node: ts.CallExpression): string | null {
  if (node.arguments.length === 0) return null;
  
  const firstArg = node.arguments[0];
  
  // 字符串字面量参数
  if (ts.isStringLiteral(firstArg)) {
    return firstArg.text;
  }
  
  // 动态表达式参数（无法静态解析）
  if (!ts.isStringLiteral(firstArg)) {
    // 记录为动态表达式导入
    return null;  // 或返回特殊标记
  }
  
  return null;
}
```

### 6.2 动态表达式处理

```typescript
interface DynamicExpressionImport {
  type: 'dynamic-expression';
  expressionText: string;  // 表达式文本，如 '`./pages/${pageName}`'
  line: number;
}

function analyzeDynamicExpressionImport(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile
): DynamicExpressionImport | null {
  if (node.arguments.length === 0) return null;
  
  const firstArg = node.arguments[0];
  
  if (!ts.isStringLiteral(firstArg)) {
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    
    // 提取表达式文本
    const printer = ts.createPrinter();
    const expressionText = printer.printNode(
      ts.EmitHint.Expression,
      firstArg,
      sourceFile
    );
    
    return {
      type: 'dynamic-expression',
      expressionText,
      line,
    };
  }
  
  return null;
}
```

### 6.3 DYNAMIC_IMPORTS 边生成

```typescript
function processDynamicImport(
  info: DynamicImportInfo | DynamicExpressionImport,
  sourceFilePath: string,
  context: ParserContext
): EdgeResult {
  
  const sourceNodeId = `FILE:${sourceFilePath}`;
  
  if (info.type === 'dynamic-expression') {
    // 无法解析的动态导入
    // 创建特殊的边标记
    return {
      type: 'dynamic-expression',
      edge: {
        from: sourceNodeId,
        to: 'EXTERNAL:dynamic-unknown',  // 特殊标记
        edgeType: EdgeType.DYNAMIC_IMPORTS,
        metadata: {
          line: info.line,
          isDynamic: true,
          expression: info.expressionText,
        },
      },
    };
  }
  
  // 静态字符串参数的动态导入
  const resolved = resolveModuleSpecifier(
    info.specifier,
    context.sourceFile,
    context.program,
    context.compilerOptions,
    context.projectRoot
  );
  
  if (resolved.isExternal) {
    return {
      type: 'external',
      edge: {
        from: sourceNodeId,
        to: `EXTERNAL:${resolved.packageName}`,
        edgeType: EdgeType.DYNAMIC_IMPORTS,
        metadata: {
          line: info.line,
          isDynamic: true,
          importSpecifier: info.specifier,
        },
      },
    };
  } else {
    return {
      type: 'internal',
      edge: {
        from: sourceNodeId,
        to: `FILE:${resolved.resolvedPath}`,
        edgeType: EdgeType.DYNAMIC_IMPORTS,
        metadata: {
          line: info.line,
          isDynamic: true,
          importSpecifier: info.specifier,
        },
      },
    };
  }
}
```

---

## 7. 重导出处理

### 7.1 export { } from 语法

```typescript
function processExportDeclaration(
  exportDecl: ts.ExportDeclaration,
  sourceFile: ts.SourceFile,
  context: ParserContext
): ExportResult[] {
  
  const results: ExportResult[] = [];
  
  // 无 moduleSpecifier 的 export { } 本模块内重导出，不产生边
  if (!exportDecl.moduleSpecifier) {
    return results;
  }
  
  const specifier = getModuleSpecifier(exportDecl);
  if (!specifier) return results;
  
  const line = sourceFile.getLineAndCharacterOfPosition(exportDecl.getStart()).line + 1;
  
  // 解析模块路径
  const resolved = resolveModuleSpecifier(
    specifier,
    sourceFile,
    context.program,
    context.compilerOptions,
    context.projectRoot
  );
  
  // 分析导出符号
  const exportSymbols = analyzeExportBindings(exportDecl);
  
  if (resolved.isExternal) {
    results.push({
      type: 'external',
      specifier,
      packageName: resolved.packageName!,
      line,
      exportSymbols,
      edgeType: EdgeType.RE_EXPORTS,
    });
  } else {
    results.push({
      type: 'internal',
      specifier,
      resolvedPath: resolved.resolvedPath!,
      line,
      exportSymbols,
      edgeType: EdgeType.RE_EXPORTS,
    });
  }
  
  return results;
}

function analyzeExportBindings(decl: ts.ExportDeclaration): ExportSymbolInfo[] {
  const results: ExportSymbolInfo[] = [];
  
  // export { a, b as c } from './utils'
  if (decl.exportClause && ts.isNamedExports(decl.exportClause)) {
    for (const element of decl.exportClause.elements) {
      results.push({
        exportedName: element.name.text,
        importedName: element.propertyName?.text ?? element.name.text,
      });
    }
  }
  
  // export * from './utils'
  if (!decl.exportClause) {
    results.push({
      exportedName: '*',
      importedName: '*',
    });
  }
  
  // export * as namespace from './utils'
  if (decl.exportClause && ts.isNamespaceExport(decl.exportClause)) {
    results.push({
      exportedName: decl.exportClause.name.text,
      importedName: '*',
    });
  }
  
  return results;
}
```

### 7.2 export * from 处理

```typescript
function processExportAllDeclaration(
  exportAllDecl: ts.ExportAllDeclaration,
  sourceFile: ts.SourceFile,
  context: ParserContext
): ExportResult {
  
  const specifier = getModuleSpecifier(exportAllDecl);
  if (!specifier) {
    return { type: 'error', message: 'Empty specifier in export *' };
  }
  
  const line = sourceFile.getLineAndCharacterOfPosition(exportAllDecl.getStart()).line + 1;
  
  const resolved = resolveModuleSpecifier(
    specifier,
    sourceFile,
    context.program,
    context.compilerOptions,
    context.projectRoot
  );
  
  // namespace 别名（ES2020+）
  const namespaceName = exportAllDecl.exportClause 
    ? (ts.isNamespaceExport(exportAllDecl.exportClause) ? exportAllDecl.exportClause.name.text : null)
    : null;
  
  if (resolved.isExternal) {
    return {
      type: 'external',
      specifier,
      packageName: resolved.packageName!,
      line,
      exportSymbols: [{ exportedName: namespaceName ?? '*', importedName: '*' }],
      edgeType: EdgeType.RE_EXPORTS,
    };
  } else {
    return {
      type: 'internal',
      specifier,
      resolvedPath: resolved.resolvedPath!,
      line,
      exportSymbols: [{ exportedName: namespaceName ?? '*', importedName: '*' }],
      edgeType: EdgeType.RE_EXPORTS,
    };
  }
}
```

### 7.3 export * as namespace 处理

```typescript
// TypeScript 4.5+ 支持
// export * as utils from './utils'

function processNamespaceExportAll(
  decl: ts.ExportAllDeclaration,
  sourceFile: ts.SourceFile,
  context: ParserContext
): ExportResult {
  // 与 processExportAllDeclaration 类似
  // 但 exportSymbols 中 exportedName 为命名空间名称
  
  return processExportAllDeclaration(decl, sourceFile, context);
}
```

---

## 8. 边界情况处理

### 8.1 JSON 模块导入

```typescript
// import data from './data.json'

function handleJsonImport(
  specifier: string,
  resolvedPath: string,
  context: ParserContext
): boolean {
  if (!context.compilerOptions.resolveJsonModule) {
    // JSON 导入未启用，跳过
    return false;
  }
  
  if (resolvedPath.endsWith('.json')) {
    // JSON 文件作为模块处理
    // 创建 FILE 节点，但不提取 MODULE（JSON 无导出符号）
    return true;
  }
  
  return false;
}
```

### 8.2 CSS/样式文件导入

```typescript
// import './styles.css'  // 常见于前端项目
// import styles from './styles.module.css'

function handleStyleImport(
  specifier: string,
  resolvedPath: string | null,
  context: ParserContext
): ImportResult | null {
  const styleExtensions = ['.css', '.scss', '.sass', '.less', '.styl'];
  
  if (resolvedPath && styleExtensions.some(ext => resolvedPath.endsWith(ext))) {
    // 样式文件导入
    // 创建 FILE 节点（若配置启用），但不产生 IMPORTS 边
    // 或作为特殊标记处理
    return {
      type: 'style-import',
      specifier,
      resolvedPath,
      // 不生成 IMPORTS 边
    };
  }
  
  return null;
}
```

### 8.3 未找到模块处理

```typescript
function handleUnresolvedModule(
  specifier: string,
  sourceFile: ts.SourceFile,
  context: ParserContext
): ImportResult {
  const line = sourceFile.getLineAndCharacterOfPosition(sourceFile.getStart()).line + 1;
  
  // 记录解析失败
  context.errors.push({
    file: sourceFile.fileName,
    specifier,
    line,
    message: `Module '${specifier}' not found`,
  });
  
  // 作为 EXTERNAL 处理（可能未安装）
  return {
    type: 'external',
    specifier,
    packageName: specifier,
    line,
    importSpecifiers: [],
  };
}
```

### 8.4 循环导入处理

```typescript
// TypeScript 自动处理循环导入
// A → B → A

// 解析时不特殊处理，记录实际关系
// 循环依赖检测在图算法层处理（Tarjan）

function handleCircularImport(
  resolvedPath: string,
  context: ParserContext
): boolean {
  // 不在解析层处理，正常记录 IMPORTS 边
  // 循环检测交给图算法层
  return true;
}
```

### 8.5 类型导入处理

```typescript
// import type { User } from './types'
// TypeScript 3.8+

function isTypeOnlyImport(decl: ts.ImportDeclaration): boolean {
  const importClause = decl.importClause;
  if (!importClause) return false;
  
  // import type { User }
  if (importClause.isTypeOnly) {
    return true;
  }
  
  // import { type User }
  if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
    for (const element of importClause.namedBindings.elements) {
      if (element.isTypeOnly) {
        return true;
      }
    }
  }
  
  return false;
}

function processTypeOnlyImport(
  decl: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  context: ParserContext
): ImportResult | null {
  // 类型导入仍产生 IMPORTS 边（类型定义也属于代码依赖）
  // 但在 metadata 中标记为 type-only
  
  const specifier = getModuleSpecifier(decl);
  if (!specifier) return null;
  
  const resolved = resolveModuleSpecifier(
    specifier,
    sourceFile,
    context.program,
    context.compilerOptions,
    context.projectRoot
  );
  
  const line = sourceFile.getLineAndCharacterOfPosition(decl.getStart()).line + 1;
  
  return {
    type: resolved.isExternal ? 'external' : 'internal',
    specifier,
    resolvedPath: resolved.resolvedPath,
    packageName: resolved.packageName,
    line,
    importSpecifiers: analyzeImportBindings(decl),
    metadata: {
      isTypeOnly: true,
    },
  };
}
```

---

## 9. 性能优化策略

### 9.1 解析缓存

```typescript
interface ResolverCache {
  // 模块说明符 → 解析结果
  moduleCache: Map<string, ResolvedModuleInfo>;
  
  // 文件 → 导入列表
  fileImportsCache: Map<string, ImportResult[]>;
  
  // 清空策略
  clear(): void;
}

function createResolverCache(): ResolverCache {
  return {
    moduleCache: new Map(),
    fileImportsCache: new Map(),
    clear() {
      this.moduleCache.clear();
      this.fileImportsCache.clear();
    },
  };
}

// 在 ParserContext 中使用缓存
interface ParserContext {
  program: ts.Program;
  compilerOptions: ts.CompilerOptions;
  projectRoot: string;
  sourceFile: ts.SourceFile;
  errors: ParseError[];
  cache: ResolverCache;
}
```

### 9.2 批量解析

```typescript
async function parseFilesBatch(
  filePaths: string[],
  context: GlobalContext
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  
  // 并行解析（可配置并发数）
  const concurrency = context.options.concurrency ?? 4;
  
  const batches = chunkArray(filePaths, Math.ceil(filePaths.length / concurrency));
  
  await Promise.all(batches.map(async batch => {
    for (const filePath of batch) {
      const result = parseFile(filePath, context);
      nodes.push(...result.nodes);
      edges.push(...result.edges);
    }
  }));
  
  return { nodes, edges };
}
```

### 9.3 Program 复用

```typescript
// 在增量更新时复用 Program
class ProgramManager {
  private program: ts.Program | null = null;
  private compilerOptions: ts.CompilerOptions;
  private projectRoot: string;
  
  getProgram(filePaths: string[]): ts.Program {
    if (!this.program) {
      this.program = createTsProgram({
        projectRoot: this.projectRoot,
        filePaths,
        compilerOptions: this.compilerOptions,
      });
    }
    
    // TypeScript Program 支持增量更新
    // 可使用 program.getSourceFile + 同步更新
    
    return this.program;
  }
  
  invalidateProgram(): void {
    this.program = null;
  }
}
```

### 9.4 懒加载 SourceFile

```typescript
// 仅在需要时读取文件内容
class LazySourceFileCache {
  private cache: Map<string, ts.SourceFile | null> = new Map();
  private program: ts.Program;
  
  getSourceFile(filePath: string): ts.SourceFile | null {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath);
    }
    
    const sourceFile = this.program.getSourceFile(filePath);
    this.cache.set(filePath, sourceFile);
    return sourceFile;
  }
}
```

---

## 10. 测试场景清单

### 10.1 基础导入场景

| ID | 场景 | 测试代码 | 预期结果 |
|----|------|----------|----------|
| T01 | 相对路径导入 | `import { a } from './utils'` | IMPORTS 边 FILE:src/foo.ts → FILE:src/utils.ts |
| T02 | 相对路径多级 | `import { b } from '../lib/helper'` | FILE:src/foo.ts → FILE:lib/helper.ts |
| T03 | 默认导入 | `import React from 'react'` | IMPORTS 边 → EXTERNAL:react |
| T04 | 命名导入 | `import { useState, useEffect } from 'react'` | IMPORTS 边，importSpecifier: 'named:useState,useEffect' |
| T05 | 命名空间导入 | `import * as utils from './utils'` | IMPORTS 边，importSpecifier: 'namespace:utils' |
| T06 | 混合导入 | `import React, { useState } from 'react'` | IMPORTS 边，importSpecifier: 'default+named' |
| T07 | 无绑定导入 | `import './styles.css'` | IMPORTS 边 FILE:src/foo.ts → FILE:src/styles.css |
| T08 | 空 import | `import {} from './utils'` | 无 IMPORTS 边（无实际依赖） |

### 10.2 别名路径场景

| ID | 场景 | tsconfig paths | 测试代码 | 预期结果 |
|----|------|----------------|----------|----------|
| T11 | 简单别名 | `{ "@/*": ["*"] }` | `import { x } from '@/utils'` | FILE:src/foo.ts → FILE:src/utils.ts |
| T12 | 多级别名 | `{ "@components/*": ["components/*"] }` | `import Button from '@components/Button'` | FILE:src/foo.ts → FILE:src/components/Button.tsx |
| T13 | 精确别名 | `{ "@utils": ["utils/index.ts"] }` | `import { helper } from '@utils'` | FILE:src/foo.ts → FILE:src/utils/index.ts |
| T14 | 多映射 | `{ "@/lib/*": ["lib/*", "shared/lib/*"] }` | `import { x } from '@/lib/foo'` | 优先尝试 lib/foo，其次 shared/lib/foo |
| T15 | 无 baseUrl | 无 baseUrl，仅 paths | `import { x } from '@/utils'` | 解析失败或基于项目根 |

### 10.3 外部依赖场景

| ID | 场景 | 测试代码 | 预期结果 |
|----|------|----------|----------|
| T21 | npm 包 | `import { x } from 'lodash'` | EXTERNAL:lodash 节点 |
| T22 | scoped 包 | `import { x } from '@org/package'` | EXTERNAL:@org/package 节点 |
| T23 | 子路径导入 | `import { x } from 'lodash/fp'` | EXTERNAL:lodash，metadata: { subpath: 'fp' } |
| T24 | Node.js 内置 | `import { readFileSync } from 'fs'` | EXTERNAL:fs，metadata: { kind: 'builtin' } |
| T25 | node: 前缀 | `import { readFileSync } from 'node:fs'` | EXTERNAL:node:fs |
| T26 | 未安装包 | `import { x } from 'nonexistent'` | EXTERNAL:nonexistent（记录错误） |

### 10.4 动态导入场景

| ID | 场景 | 测试代码 | 预期结果 |
|----|------|----------|----------|
| T31 | 静态字符串 | `import('./utils')` | DYNAMIC_IMPORTS 边 FILE:src/foo.ts → FILE:src/utils.ts |
| T32 | 外部动态 | `import('lodash')` | DYNAMIC_IMPORTS 边 → EXTERNAL:lodash |
| T33 | 模板字符串 | `import(`./pages/${page}`)` | DYNAMIC_IMPORTS 边，metadata: { expression: '`./pages/${page}`' } |
| T34 | 变量参数 | `import(moduleName)` | DYNAMIC_IMPORTS 边 → EXTERNAL:dynamic-unknown |
| T35 | 条件动态 | `if (condition) import('./lazy')` | DYNAMIC_IMPORTS 边 FILE:src/foo.ts → FILE:src/lazy.ts |

### 10.5 重导出场景

| ID | 场景 | 测试代码 | 预期结果 |
|----|------|----------|----------|
| T41 | 命名重导出 | `export { a, b } from './utils'` | RE_EXPORTS 边 FILE:src/foo.ts → FILE:src/utils.ts |
| T42 | 重命名重导出 | `export { a as x } from './utils'` | RE_EXPORTS 边，metadata: { renamed: 'a→x' } |
| T43 | 全量重导出 | `export * from './utils'` | RE_EXPORTS 边，importSpecifier: '*' |
| T44 | 命名空间重导出 | `export * as utils from './utils'` | RE_EXPORTS 边，importSpecifier: 'namespace:utils' |
| T45 | 外部重导出 | `export { useState } from 'react'` | RE_EXPORTS 边 → EXTERNAL:react |
| T46 | 链式重导出 | `export { a } from './mid'; // mid: export { a } from './source'` | RE_EXPORTS 边 FILE:src/foo.ts → FILE:src/mid.ts |

### 10.6 类型导入场景

| ID | 场景 | 测试代码 | 预期结果 |
|----|------|----------|----------|
| T51 | 类型导入 | `import type { User } from './types'` | IMPORTS 边，metadata: { isTypeOnly: true } |
| T52 | 内联类型 | `import { type User, name } from './types'` | IMPORTS 边，部分 type-only |
| T53 | 类型重导出 | `export type { User } from './types'` | RE_EXPORTS 边，metadata: { isTypeOnly: true } |

### 10.7 边界情况场景

| ID | 场景 | 测试代码 | 预期结果 |
|----|------|----------|----------|
| T61 | JSON 导入 | `import data from './data.json'` | IMPORTS 边（若 resolveJsonModule: true） |
| T62 | CSS 导入 | `import './styles.css'` | IMPORTS 边 FILE:src/foo.ts → FILE:src/styles.css |
| T63 | 循环导入 | A imports B, B imports A | 双向 IMPORTS 边（循环检测在图算法层） |
| T64 | 解析失败 | `import { x } from './missing'` | 记录错误，跳过边生成 |
| T65 | 空文件 | 文件无导入 | 无边生成 |
| T66 | 仅注释文件 | `// comment only` | 无边生成 |
| T67 | .d.ts 文件 | `import { x } from './types.d.ts'` | IMPORTS 边 FILE:src/foo.ts → FILE:src/types.d.ts |

### 10.8 性能测试场景

| ID | 场景 | 验证标准 |
|----|------|----------|
| P01 | 1000 文件项目 | 解析时间 < 5 秒 |
| P02 | 大型 monorepo | 5000 文件 < 15 秒 |
| P03 | 内存使用 | < 256 MB（Node.js 默认堆） |
| P04 | 缓存效果 | 第二次解析时间减少 50%+ |
| P05 | 并发解析 | 4 并发比单线程快 3x+ |

---

## 11. 接口定义

### 11.1 解析器主接口

```typescript
interface TsParser {
  parseFiles(filePaths: string[], projectRoot: string): Promise<ParseResult>;
}

interface ParseResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  errors: ParseError[];
  stats: ParseStats;
}

interface ParseError {
  file: string;
  specifier?: string;
  line?: number;
  message: string;
  code: string;  // 错误代码，如 'MODULE_NOT_FOUND'
}

interface ParseStats {
  filesProcessed: number;
  importsFound: number;
  exportsFound: number;
  dynamicImportsFound: number;
  externalPackagesFound: number;
  parseTimeMs: number;
}
```

### 11.2 内部类型定义

```typescript
interface ImportSpecifierInfo {
  type: 'default' | 'named' | 'namespace';
  name: string;         // 本地绑定名
  importedName: string; // 导入的原始名（default, *, 或具体名）
}

interface ExportSymbolInfo {
  exportedName: string;  // 导出的名称
  importedName: string;  // 从源模块导入的名称
}

interface ImportResult {
  type: 'internal' | 'external' | 'dynamic-expression' | 'style-import' | 'error';
  specifier: string;
  resolvedPath?: string | null;
  packageName?: string;
  line: number;
  importSpecifiers?: ImportSpecifierInfo[];
  metadata?: Record<string, unknown>;
  message?: string;  // 仅 error 类型
}

interface ExportResult {
  type: 'internal' | 'external' | 'error';
  specifier: string;
  resolvedPath?: string | null;
  packageName?: string;
  line: number;
  exportSymbols: ExportSymbolInfo[];
  edgeType: EdgeType.RE_EXPORTS;
  metadata?: Record<string, unknown>;
  message?: string;  // 仅 error 类型
}

interface DynamicImportInfo {
  specifier: string;
  line: number;
  expression: ts.CallExpression;
}

interface EdgeResult {
  type: 'internal' | 'external' | 'dynamic-expression';
  edge: GraphEdge;
}
```

### 11.3 解析器配置

```typescript
interface TsParserOptions {
  // 性能配置
  concurrency?: number;         // 并发解析数，默认 4
  useCache?: boolean;           // 是否启用缓存，默认 true
  
  // 解析配置
  resolveJsonModule?: boolean;  // 强制覆盖 tsconfig
  allowJs?: boolean;            // 强制覆盖 tsconfig
  
  // 过滤配置
  skipStyleImports?: boolean;   // 跳过样式文件导入，默认 false
  skipTypeOnlyImports?: boolean; // 跳过 type-only 导入，默认 false
  
  // 错误处理
  ignoreModuleNotFound?: boolean; // 忽略未找到模块错误，默认 false
  maxErrors?: number;           // 最大错误数，默认 100
}
```

### 11.4 导出接口

```typescript
// packages/codegraph/src/parser/ts-parser.ts

export interface TsParser {
  parseFiles(filePaths: string[], projectRoot: string, options?: TsParserOptions): Promise<ParseResult>;
}

export function createTsParser(): TsParser {
  return new TsParserImpl();
}

export interface ParseResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  errors: ParseError[];
  stats: ParseStats;
}

// 内部模块导出（供其他 change 使用）
export { resolveModuleSpecifier } from './import-resolver';
export { parsePathsConfig, resolveAliasPath } from './alias-resolver';
export { isExternalModule, isBuiltinModule } from './external-detector';
export { findDynamicImports } from './dynamic-import-handler';
export { processExportDeclaration, processExportAllDeclaration } from './reexport-handler';
```

---

## 附录 A: TypeScript AST 关键节点类型

```typescript
// 导入相关节点
ts.ImportDeclaration          // import { x } from 'y'
ts.ImportClause               // import 后的绑定部分
ts.ImportSpecifier            // 命名导入的单个元素 { x }
ts.NamespaceImport            // import * as ns
ts.ImportEqualsDeclaration    // import fs = require('fs')

// 导出相关节点
ts.ExportDeclaration          // export { x } from 'y'
ts.ExportAllDeclaration       // export * from 'y'
ts.ExportSpecifier            // 命名导出的单个元素 { x }
ts.NamespaceExport            // export * as ns

// 动态导入
ts.CallExpression             // import('...') 调用表达式
```

---

## 附录 B: tsconfig.json 示例配置

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Node16",
    
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@components/*": ["components/*"],
      "@utils": ["utils/index.ts"],
      "@lib/*": ["lib/*", "shared/lib/*"]
    },
    
    "allowJs": true,
    "checkJs": false,
    "resolveJsonModule": true,
    
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

**文档版本**: v1.0  
**创建日期**: 2026-05-02  
**关联 Change**: C3 - `cg-ts-parser-imports`  
**下一步**: 实现导入解析核心逻辑，完成 Change 3 交付