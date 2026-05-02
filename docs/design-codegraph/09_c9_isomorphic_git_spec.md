## C9 技术规格：Git变更检测与增量更新

> 本文档为 `develop_changes_plan.md` 中 Change 9 (`cg-cli-analyze-update`) 补充具体的技术实现细节，消除开发歧义。

---

### 1. Git操作API

#### 1.1 isomorphic-git 核心API调用

```typescript
import * as git from 'isomorphic-git';
import { fs } from 'fs/promises'; // 或使用 nodefs adapter

// 项目根目录
const cwd = process.cwd();

// ============================================
// API 1: 获取当前 HEAD commit hash
// ============================================
async function getCurrentHead(cwd: string): Promise<string> {
  const head = await git.resolveRef({ fs, dir: cwd, ref: 'HEAD' });
  return head; // 返回完整的 commit SHA
}

// ============================================
// API 2: 获取 commit 历史
// ============================================
async function getCommitHistory(
  cwd: string,
  since?: string // 起始 commit hash（可选）
): Promise<git.CommitObject[]> {
  const commits = await git.log({
    fs,
    dir: cwd,
    ref: 'HEAD',
    depth: since ? undefined : 1, // 如果有 since，获取所有；否则只取 HEAD
  });
  
  // 如果指定了 since，过滤出从 since 到 HEAD 的 commits
  if (since) {
    const sinceIndex = commits.findIndex(c => c.oid === since);
    if (sinceIndex > 0) {
      return commits.slice(0, sinceIndex); // 返回 since 之后的所有 commits
    }
    // 如果 since 不在历史中，返回所有
    return commits;
  }
  
  return commits;
}

// ============================================
// API 3: 获取两个 commit 之间的变更文件
// ============================================
interface FileChange {
  path: string;      // 文件相对路径
  type: 'ADD' | 'MODIFY' | 'DELETE';
}

async function getFileChangesBetweenCommits(
  cwd: string,
  fromCommit: string, // 基线 commit
  toCommit: string    // 目标 commit (HEAD)
): Promise<FileChange[]> {
  // 使用 walk API 比较两棵树
  const changes: FileChange[] = [];
  
  // Walker 配置：获取两棵树并比较
  const walkers = [
    git.TREE({ ref: fromCommit }), // 基线树
    git.TREE({ ref: toCommit }),   // 当前树
  ];
  
  await git.walk({
    fs,
    dir: cwd,
    trees: walkers,
    // Walker 处理函数
    walk: async (entries) => {
      const [fromEntry, toEntry] = entries;
      
      // 只处理文件，忽略目录
      if (fromEntry?.type === 'tree' || toEntry?.type === 'tree') {
        return entries; // 继续遍历子目录
      }
      
      const path = fromEntry?.path || toEntry?.path;
      if (!path) return null;
      
      // 判断变更类型
      const fromOid = fromEntry?.oid;
      const toOid = toEntry?.oid;
      
      if (!fromOid && toOid) {
        // from 不存在，to 存在 → 新文件
        changes.push({ path, type: 'ADD' });
      } else if (fromOid && !toOid) {
        // from 存在，to 不存在 → 删除
        changes.push({ path, type: 'DELETE' });
      } else if (fromOid !== toOid) {
        // 两者都存在但 OID 不同 → 修改
        changes.push({ path, type: 'MODIFY' });
      }
      
      return null; // 不继续遍历该节点的子节点（文件无子节点）
    },
  });
  
  return changes;
}
```

#### 1.2 备选方案：逐 commit 遍历

如果 `walk` API 在某些场景不稳定，可采用逐 commit 遍历方式：

```typescript
async function getFileChangesByWalkingCommits(
  cwd: string,
  sinceCommit: string
): Promise<FileChange[]> {
  const changeMap = new Map<string, FileChange>();
  
  // 获取 commit 历史
  const commits = await git.log({
    fs,
    dir: cwd,
    ref: 'HEAD',
    // 从 HEAD 开始，直到 sinceCommit
  });
  
  // 找到 sinceCommit 的位置
  const startIdx = commits.findIndex(c => c.oid === sinceCommit);
  const relevantCommits = startIdx > 0 ? commits.slice(0, startIdx) : commits;
  
  for (const commit of relevantCommits) {
    // 每个 commit 获取其 parent 和变更
    const parentOid = commit.commit.parent[0];
    
    if (!parentOid) continue; // 初始 commit 无 parent
    
    // 比较该 commit 与其 parent
    const changes = await getFileChangesBetweenCommits(cwd, parentOid, commit.oid);
    
    // 合并变更（同一文件可能有多次变更，只保留最终状态）
    for (const change of changes) {
      const existing = changeMap.get(change.path);
      if (existing) {
        // 如果之前是 ADD，现在 DELETE → 最终不存在（不记录）
        // 如果之前是 ADD，现在 MODIFY → 仍是 ADD
        // 如果之前是 MODIFY，现在 DELETE → DELETE
        // 如果之前是 DELETE，现在 ADD → MODIFY（恢复后变更）
        if (existing.type === 'ADD' && change.type === 'DELETE') {
          changeMap.delete(change.path);
        } else if (existing.type === 'DELETE' && change.type === 'ADD') {
          changeMap.set(change.path, { path: change.path, type: 'MODIFY' });
        } else {
          changeMap.set(change.path, change);
        }
      } else {
        changeMap.set(change.path, change);
      }
    }
  }
  
  return Array.from(changeMap.values());
}
```

---

### 2. 变更文件获取完整实现

#### 2.1 Git 变更检测模块

```typescript
// packages/codegraph/src/git/change-detector.ts

import * as git from 'isomorphic-git';
import * as fsPromises from 'fs/promises';
import path from 'path';

// fs adapter for isomorphic-git
const fs = {
  promises: fsPromises,
  readFileSync: (p: string) => fsPromises.readFile(p),
  writeFileSync: (p: string, content: string) => fsPromises.writeFile(p, content),
  // ... 其他必要方法
};

export interface FileChange {
  path: string;
  type: 'ADD' | 'MODIFY' | 'DELETE';
}

export interface GitChangeResult {
  lastCommit: string;
  currentHead: string;
  changes: FileChange[];
  hasChanges: boolean;
}

/**
 * 检测 Git 变更的完整流程
 */
export async function detectGitChanges(cwd: string): Promise<GitChangeResult> {
  // Step 1: 读取 lastCommit.txt
  const lastCommitPath = path.join(cwd, '.codegraph', 'lastCommit.txt');
  let lastCommit: string;
  
  try {
    lastCommit = await fsPromises.readFile(lastCommitPath, 'utf-8').trim();
  } catch (e) {
    // lastCommit.txt 不存在，说明从未分析过
    throw new Error('No baseline found. Run `codegraph analyze` first.');
  }
  
  // Step 2: 获取当前 HEAD
  const currentHead = await git.resolveRef({
    fs: fs.promises,
    dir: cwd,
    ref: 'HEAD',
  });
  
  // Step 3: 检查是否需要更新
  if (lastCommit === currentHead) {
    return {
      lastCommit,
      currentHead,
      changes: [],
      hasChanges: false,
    };
  }
  
  // Step 4: 获取变更文件
  const changes = await getFileChangesBetweenCommits(cwd, lastCommit, currentHead);
  
  return {
    lastCommit,
    currentHead,
    changes,
    hasChanges: changes.length > 0,
  };
}

/**
 * 获取两个 commit 之间的变更文件
 */
async function getFileChangesBetweenCommits(
  cwd: string,
  fromCommit: string,
  toCommit: string
): Promise<FileChange[]> {
  const changes: FileChange[] = [];
  
  try {
    // 使用 walk API 比较树
    await git.walk({
      fs: fs.promises,
      dir: cwd,
      trees: [
        git.TREE({ ref: fromCommit }),
        git.TREE({ ref: toCommit }),
      ],
      walk: async (entries) => {
        const [fromEntry, toEntry] = entries;
        
        // 跳过目录
        if (fromEntry?.type === 'tree' || toEntry?.type === 'tree') {
          return entries;
        }
        
        const fromPath = fromEntry?.path;
        const toPath = toEntry?.path;
        const path = fromPath || toPath;
        
        if (!path) return null;
        
        // 过滤支持的文件类型
        if (!isSupportedFile(path)) {
          return null;
        }
        
        const fromOid = fromEntry?.oid;
        const toOid = toEntry?.oid;
        
        // 变更类型判定
        if (!fromOid && toOid) {
          changes.push({ path, type: 'ADD' });
        } else if (fromOid && !toOid) {
          changes.push({ path, type: 'DELETE' });
        } else if (fromOid !== toOid) {
          changes.push({ path, type: 'MODIFY' });
        }
        
        return null;
      },
    });
  } catch (error) {
    // 如果 walk API 失败，回退到逐 commit 遍历
    console.warn('walk API failed, falling back to commit-by-commit approach');
    return getFileChangesByWalkingCommits(cwd, fromCommit, toCommit);
  }
  
  return changes;
}

/**
 * 判断文件是否需要处理
 */
function isSupportedFile(filePath: string): boolean {
  const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
  const ext = path.extname(filePath);
  return supportedExtensions.includes(ext);
}
```

#### 2.2 变更类型判定逻辑

```typescript
// 变更类型判定矩阵
//
// fromEntry.oid | toEntry.oid | 变更类型 | 说明
// --------------|-------------|----------|------------------
// null          | 存在        | ADD      | 新文件（基线不存在）
// 存在          | null        | DELETE   | 删除（当前不存在）
// 存在但不同    | 存在但不同  | MODIFY   | 内容变更
// 相同          | 相同        | 无变更   | 跳过

interface ChangeTypeMatrix {
  fromOid: string | null;
  toOid: string | null;
  result: 'ADD' | 'MODIFY' | 'DELETE' | 'NONE';
}

const CHANGE_TYPE_MATRIX: ChangeTypeMatrix[] = [
  { fromOid: null, toOid: 'exists', result: 'ADD' },
  { fromOid: 'exists', toOid: null, result: 'DELETE' },
  { fromOid: 'oid1', toOid: 'oid2', result: 'MODIFY' }, // oid1 !== oid2
  { fromOid: 'oid1', toOid: 'oid1', result: 'NONE' },   // 相同
];

function determineChangeType(
  fromOid: string | undefined,
  toOid: string | undefined
): 'ADD' | 'MODIFY' | 'DELETE' | 'NONE' {
  if (!fromOid && toOid) return 'ADD';
  if (fromOid && !toOid) return 'DELETE';
  if (fromOid && toOid && fromOid !== toOid) return 'MODIFY';
  return 'NONE';
}
```

---

### 3. 增量更新流程

#### 3.1 简化增量更新实现（MVP）

```typescript
// packages/codegraph/src/analyzer/incremental-update.ts

import { CodeGraph, GraphNode, NodeType } from '../types';
import { detectGitChanges, FileChange } from '../git/change-detector';
import { loadBaseline, saveBaseline } from '../persistence/baseline';
import { parseFiles } from '../parser/ts-parser';
import { removeNode, removeEdgesForFile } from '../graph';

export interface IncrementalUpdateResult {
  graph: CodeGraph;
  delta: {
    addedFiles: string[];
    modifiedFiles: string[];
    deletedFiles: string[];
    newNodes: number;
    removedNodes: number;
  };
}

/**
 * MVP 简化版增量更新
 * 
 * 简化策略：
 * 1. 不实现完整的级联更新（M2 内容）
 * 2. 仅处理直接变更的文件
 * 3. 删除变更文件的旧节点，重新解析
 * 4. 不追踪导出变化导致的级联影响
 */
export async function updateIncrementally(cwd: string): Promise<IncrementalUpdateResult> {
  // Step 1: 检测 Git 变更
  const changeResult = await detectGitChanges(cwd);
  
  if (!changeResult.hasChanges) {
    // 无变更，返回现有基线
    const { graph } = await loadBaseline(cwd);
    return {
      graph,
      delta: {
        addedFiles: [],
        modifiedFiles: [],
        deletedFiles: [],
        newNodes: 0,
        removedNodes: 0,
      },
    };
  }
  
  // Step 2: 加载现有基线
  const { graph } = await loadBaseline(cwd);
  
  // Step 3: 分类变更
  const addedFiles = changeResult.changes.filter(c => c.type === 'ADD').map(c => c.path);
  const modifiedFiles = changeResult.changes.filter(c => c.type === 'MODIFY').map(c => c.path);
  const deletedFiles = changeResult.changes.filter(c => c.type === 'DELETE').map(c => c.path);
  
  // Step 4: 处理删除和修改文件
  const filesToRemove = [...deletedFiles, ...modifiedFiles];
  let removedNodes = 0;
  
  for (const filePath of filesToRemove) {
    // 删除 FILE 节点及其 MODULE 子节点
    removedNodes += removeFileFromGraph(graph, filePath);
  }
  
  // Step 5: 处理新增和修改文件（重新解析）
  const filesToParse = [...addedFiles, ...modifiedFiles];
  let newNodes = 0;
  
  if (filesToParse.length > 0) {
    const { nodes, edges } = await parseFiles(filesToParse, cwd);
    
    // 合并入图（注意：parseFiles 返回的边可能指向已删除的节点）
    for (const node of nodes) {
      graph.addNode(node);
      newNodes++;
    }
    for (const edge of edges) {
      // 验证边的两端节点都存在
      if (graph.nodes.has(edge.from) && graph.nodes.has(edge.to)) {
        graph.addEdge(edge);
      }
    }
  }
  
  // Step 6: 更新基线
  await saveBaseline(cwd, graph, changeResult.currentHead);
  
  // Step 7: 更新 lastCommit.txt
  const lastCommitPath = path.join(cwd, '.codegraph', 'lastCommit.txt');
  await fsPromises.writeFile(lastCommitPath, changeResult.currentHead);
  
  return {
    graph,
    delta: {
      addedFiles,
      modifiedFiles,
      deletedFiles,
      newNodes,
      removedNodes,
    },
  };
}

/**
 * 从图中移除文件及其相关节点/边
 */
function removeFileFromGraph(graph: CodeGraph, filePath: string): number {
  let removedCount = 0;
  
  // 1. 找到 FILE 节点
  const fileId = `FILE:${filePath}`;
  const fileNode = graph.nodes.get(fileId);
  
  if (!fileNode) return 0;
  
  // 2. 找到该文件的所有 MODULE 子节点
  const moduleNodesToRemove: string[] = [];
  for (const [id, node] of graph.nodes) {
    if (node.type === NodeType.MODULE && node.path.startsWith(filePath)) {
      moduleNodesToRemove.push(id);
    }
  }
  
  // 3. 移除 MODULE 节点
  for (const moduleId of moduleNodesToRemove) {
    graph.removeNode(moduleId);
    removedCount++;
  }
  
  // 4. 移除 FILE 节点
  graph.removeNode(fileId);
  removedCount++;
  
  // 5. 清除与该文件相关的所有边
  // removeNode 已经会清除以该节点为端点的边
  // 但还需要清除 IMPORTS 边中涉及该文件的边
  graph.removeEdgesForFile(filePath);
  
  return removedCount;
}
```

#### 3.2 图操作方法实现

```typescript
// packages/codegraph/src/graph.ts (补充方法)

class CodeGraph {
  // ... 现有方法 ...
  
  /**
   * 移除节点及其关联边，并更新索引
   */
  removeNode(id: string): void {
    // 1. 从 nodes map 中删除
    this.nodes.delete(id);
    
    // 2. 清除以该节点为源的所有边
    const outEdges = this.outEdges.get(id) || [];
    for (const edge of outEdges) {
      // 从 edges 数组中删除
      const edgeIndex = this.edges.findIndex(
        e => e.from === edge.from && e.to === edge.to && e.type === edge.type
      );
      if (edgeIndex >= 0) {
        this.edges.splice(edgeIndex, 1);
      }
      // 从目标的 inEdges 中删除
      const targetInEdges = this.inEdges.get(edge.to) || [];
      const inIndex = targetInEdges.findIndex(
        e => e.from === edge.from && e.to === edge.to && e.type === edge.type
      );
      if (inIndex >= 0) {
        targetInEdges.splice(inIndex, 1);
      }
    }
    this.outEdges.delete(id);
    
    // 3. 清除以该节点为目标的所有边
    const inEdges = this.inEdges.get(id) || [];
    for (const edge of inEdges) {
      // 从 edges 数组中删除
      const edgeIndex = this.edges.findIndex(
        e => e.from === edge.from && e.to === edge.to && e.type === edge.type
      );
      if (edgeIndex >= 0) {
        this.edges.splice(edgeIndex, 1);
      }
      // 从源的 outEdges 中删除
      const sourceOutEdges = this.outEdges.get(edge.from) || [];
      const outIndex = sourceOutEdges.findIndex(
        e => e.from === edge.from && e.to === edge.to && e.type === edge.type
      );
      if (outIndex >= 0) {
        sourceOutEdges.splice(outIndex, 1);
      }
    }
    this.inEdges.delete(id);
  }
  
  /**
   * 移除所有与指定文件相关的边
   * 包括：该文件的 IMPORTS 边、指向该文件的 IMPORTS 边
   */
  removeEdgesForFile(filePath: string): void {
    const fileId = `FILE:${filePath}`;
    
    // 过滤出需要删除的边
    const edgesToRemove = this.edges.filter(edge => {
      // IMPORTS 边：文件作为源或目标
      if (edge.type === EdgeType.IMPORTS) {
        if (edge.from === fileId || edge.to === fileId) return true;
      }
      // RE_EXPORTS 边
      if (edge.type === EdgeType.RE_EXPORTS) {
        if (edge.from === fileId || edge.to === fileId) return true;
      }
      // DYNAMIC_IMPORTS 边
      if (edge.type === EdgeType.DYNAMIC_IMPORTS) {
        if (edge.from === fileId || edge.to === fileId) return true;
      }
      // MODULE 边：路径匹配
      if (edge.from.startsWith(`MODULE:${filePath}`) ||
          edge.to.startsWith(`MODULE:${filePath}`)) {
        return true;
      }
      return false;
    });
    
    // 删除边并更新索引
    for (const edge of edgesToRemove) {
      this.removeEdge(edge);
    }
  }
  
  /**
   * 移除单条边并更新索引
   */
  removeEdge(edge: GraphEdge): void {
    // 从 edges 数组删除
    const index = this.edges.findIndex(
      e => e.from === edge.from && e.to === edge.to && e.type === edge.type
    );
    if (index >= 0) {
      this.edges.splice(index, 1);
    }
    
    // 从 outEdges 删除
    const outEdges = this.outEdges.get(edge.from) || [];
    const outIndex = outEdges.findIndex(
      e => e.from === edge.from && e.to === edge.to && e.type === edge.type
    );
    if (outIndex >= 0) {
      outEdges.splice(outIndex, 1);
    }
    
    // 从 inEdges 删除
    const inEdges = this.inEdges.get(edge.to) || [];
    const inIndex = inEdges.findIndex(
      e => e.from === edge.from && e.to === edge.to && e.type === edge.type
    );
    if (inIndex >= 0) {
      inEdges.splice(inIndex, 1);
    }
  }
}
```

---

### 4. 简化策略说明

#### 4.1 MVP 范围界定

| 功能 | MVP (C9) | M2 (C14) | 说明 |
|------|----------|----------|------|
| 删除变更文件节点 | ✅ 实现 | - | 直接删除 FILE 及 MODULE 子节点 |
| 重新解析变更文件 | ✅ 实现 | - | 仅解析 ADD/MODIFY 文件 |
| 清除相关边 | ✅ 实现 | - | `removeEdgesForFile` |
| 级联更新 | ❌ 不实现 | ✅ 实现 | 导出变化时更新导入者 |
| 导出变化检测 | ❌ 不实现 | ✅ 实现 | 比较新旧 MODULE 节点列表 |
| 受影响文件重解析 | ❌ 不实现 | ✅ 实现 | 通过 `inEdges` 查找导入者 |
| 虚拟边清理 | ❌ 不实现 | ✅ 实现 | 处理指向不存在节点的边 |

#### 4.2 MVP 级联缺失的影响与缓解

**潜在问题**：

1. **无效边残留**：如果文件 A 导入了文件 B，B 被删除但 A 未更新，则 A 的 IMPORTS 边指向不存在的节点。

2. **导出变化未传播**：如果文件 B 的导出列表变化（删除了某导出），文件 A 仍引用旧的导出。

**缓解措施（MVP）**：

```typescript
// 在合并新解析结果时，验证边的有效性
for (const edge of edges) {
  if (graph.nodes.has(edge.from) && graph.nodes.has(edge.to)) {
    graph.addEdge(edge);
  } else {
    // 警告：边指向不存在的节点
    console.warn(`Skipping invalid edge: ${edge.from} → ${edge.to}`);
  }
}

// 在 getScope/getImpact API 中过滤无效边
function getValidEdges(graph: CodeGraph): GraphEdge[] {
  return graph.edges.filter(e => 
    graph.nodes.has(e.from) && graph.nodes.has(e.to)
  );
}
```

#### 4.3 用户警告

```typescript
// CLI 输出警告
console.log(`
Incremental update completed (MVP mode).

⚠️  Warning: Cascade update not implemented.
   If exports were removed from changed files,
   importing files may have stale references.
   
   For full cascade support, upgrade to M2.
`);
```

---

### 5. lastCommit.txt 更新

#### 5.1 获取当前 HEAD commit hash

```typescript
// packages/codegraph/src/git/head-commit.ts

import * as git from 'isomorphic-git';

/**
 * 获取当前 HEAD commit hash
 */
export async function getHeadCommit(cwd: string): Promise<string> {
  try {
    const headRef = await git.resolveRef({
      fs: fsPromises,
      dir: cwd,
      ref: 'HEAD',
    });
    return headRef;
  } catch (error) {
    throw new Error(`Failed to resolve HEAD: ${error.message}`);
  }
}

/**
 * 检查是否在 Git 仓库中
 */
export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await git.resolveRef({ fs: fsPromises, dir: cwd, ref: 'HEAD' });
    return true;
  } catch {
    return false;
  }
}
```

#### 5.2 写入 lastCommit.txt

```typescript
// packages/codegraph/src/persistence/last-commit.ts

import path from 'path';
import { promises as fsPromises } from 'fs';

const LAST_COMMIT_FILE = 'lastCommit.txt';

/**
 * 更新 lastCommit.txt
 */
export async function updateLastCommit(cwd: string, commitHash: string): Promise<void> {
  const filePath = path.join(cwd, '.codegraph', LAST_COMMIT_FILE);
  await fsPromises.writeFile(filePath, commitHash, 'utf-8');
}

/**
 * 读取 lastCommit.txt
 */
export async function readLastCommit(cwd: string): Promise<string | null> {
  const filePath = path.join(cwd, '.codegraph', LAST_COMMIT_FILE);
  try {
    const content = await fsPromises.readFile(filePath, 'utf-8');
    return content.trim();
  } catch {
    return null;
  }
}
```

---

### 6. 测试场景

#### 6.1 模拟 Git 变更测试

```typescript
// packages/codegraph/tests/integration/incremental-update.test.ts

import { promises as fsPromises } from 'fs';
import path from 'path';
import * as git from 'isomorphic-git';

describe('Incremental Update', () => {
  let testRepoPath: string;
  
  beforeAll(async () => {
    // 创建测试仓库
    testRepoPath = path.join(__dirname, 'fixtures', 'test-repo');
    await setupTestRepo(testRepoPath);
  });
  
  describe('getFileChangesBetweenCommits', () => {
    it('should detect ADD for new file', async () => {
      // 初始 commit
      const commit1 = await createCommit(testRepoPath, 'initial');
      
      // 添加新文件
      await fsPromises.writeFile(
        path.join(testRepoPath, 'new-file.ts'),
        'export const x = 1;'
      );
      const commit2 = await createCommit(testRepoPath, 'add file');
      
      const changes = await getFileChangesBetweenCommits(testRepoPath, commit1, commit2);
      
      expect(changes).toContainEqual({
        path: 'new-file.ts',
        type: 'ADD',
      });
    });
    
    it('should detect MODIFY for changed file', async () => {
      // 创建文件
      await fsPromises.writeFile(
        path.join(testRepoPath, 'existing.ts'),
        'export const y = 2;'
      );
      const commit1 = await createCommit(testRepoPath, 'create');
      
      // 修改文件
      await fsPromises.writeFile(
        path.join(testRepoPath, 'existing.ts'),
        'export const y = 3;' // 改变内容
      );
      const commit2 = await createCommit(testRepoPath, 'modify');
      
      const changes = await getFileChangesBetweenCommits(testRepoPath, commit1, commit2);
      
      expect(changes).toContainEqual({
        path: 'existing.ts',
        type: 'MODIFY',
      });
    });
    
    it('should detect DELETE for removed file', async () => {
      // 创建文件
      await fsPromises.writeFile(
        path.join(testRepoPath, 'to-delete.ts'),
        'export const z = 4;'
      );
      const commit1 = await createCommit(testRepoPath, 'create');
      
      // 删除文件
      await fsPromises.unlink(path.join(testRepoPath, 'to-delete.ts'));
      const commit2 = await createCommit(testRepoPath, 'delete');
      
      const changes = await getFileChangesBetweenCommits(testRepoPath, commit1, commit2);
      
      expect(changes).toContainEqual({
        path: 'to-delete.ts',
        type: 'DELETE',
      });
    });
  });
  
  describe('updateIncrementally', () => {
    it('should remove nodes for deleted files', async () => {
      // 先执行全量分析
      await analyzeFull(testRepoPath);
      
      // 获取初始节点数
      const { graph: before } = await loadBaseline(testRepoPath);
      const beforeCount = before.nodes.size;
      
      // 删除文件并提交
      await fsPromises.unlink(path.join(testRepoPath, 'some-file.ts'));
      await createCommit(testRepoPath, 'delete file');
      
      // 执行增量更新
      const result = await updateIncrementally(testRepoPath);
      
      expect(result.delta.deletedFiles).toContain('some-file.ts');
      expect(result.graph.nodes.size).toBeLessThan(beforeCount);
    });
    
    it('should add nodes for new files', async () => {
      await analyzeFull(testRepoPath);
      const { graph: before } = await loadBaseline(testRepoPath);
      const beforeCount = before.nodes.size;
      
      // 添加文件
      await fsPromises.writeFile(
        path.join(testRepoPath, 'new-module.ts'),
        'export function newFunc() {}'
      );
      await createCommit(testRepoPath, 'add file');
      
      const result = await updateIncrementally(testRepoPath);
      
      expect(result.delta.addedFiles).toContain('new-module.ts');
      expect(result.graph.nodes.size).toBeGreaterThan(beforeCount);
      expect(result.graph.nodes.has('FILE:new-module.ts')).toBe(true);
      expect(result.graph.nodes.has('MODULE:new-module.ts#newFunc')).toBe(true);
    });
    
    it('should update lastCommit.txt', async () => {
      await analyzeFull(testRepoPath);
      
      // 添加文件并提交
      await fsPromises.writeFile(
        path.join(testRepoPath, 'another.ts'),
        'export const another = 1;'
      );
      const newCommit = await createCommit(testRepoPath, 'add another');
      
      await updateIncrementally(testRepoPath);
      
      const savedCommit = await readLastCommit(testRepoPath);
      expect(savedCommit).toBe(newCommit);
    });
  });
});

// Helper functions
async function setupTestRepo(repoPath: string): Promise<void> {
  await fsPromises.mkdir(repoPath, { recursive: true });
  await git.init({ fs: fsPromises, dir: repoPath });
}

async function createCommit(repoPath: string, message: string): Promise<string> {
  await git.add({ fs: fsPromises, dir: repoPath, filepath: '.' });
  const oid = await git.commit({
    fs: fsPromises,
    dir: repoPath,
    message,
    author: { name: 'Test', email: 'test@test.com' },
  });
  return oid;
}
```

#### 6.2 Fixture 仓库设计

```
tests/fixtures/sample-project/
├─ src/
│   ├─ index.ts          # 导入 utils 和 types
│   ├─ utils.ts          # 导出 formatDate, parseJSON
│   ├─ types.ts          # 导出 User, Config
│   └─ components/
│       └─ Button.tsx    # React 组件
├─ .git/                 # Git 仓库
├─ .codegraph/           # 分析结果
│   ├─ baseline.json
│   └─ lastCommit.txt
└─ tsconfig.json
```

---

### 7. CLI 命令实现

#### 7.1 analyze 命令

```typescript
// packages/codegraph/src/cli/commands/analyze.ts

import { analyzeFull } from '../../analyzer';
import { getHeadCommit } from '../../git/head-commit';
import { updateLastCommit } from '../../persistence/last-commit';

export async function runAnalyze(cwd: string): Promise<void> {
  console.log('Running full analysis...');
  
  const graph = await analyzeFull(cwd);
  const headCommit = await getHeadCommit(cwd);
  await updateLastCommit(cwd, headCommit);
  
  console.log(`
Analysis completed.
  Files: ${graph.nodes.filter(n => n.type === 'FILE').length}
  Modules: ${graph.nodes.filter(n => n.type === 'MODULE').length}
  Edges: ${graph.edges.length}
  Commit: ${headCommit}
`);
}
```

#### 7.2 update 命令

```typescript
// packages/codegraph/src/cli/commands/update.ts

import { updateIncrementally } from '../../analyzer/incremental-update';
import { detectGitChanges } from '../../git/change-detector';

export async function runUpdate(cwd: string): Promise<void> {
  console.log('Checking for changes...');
  
  const changeResult = await detectGitChanges(cwd);
  
  if (!changeResult.hasChanges) {
    console.log('No changes detected. Graph is up-to-date.');
    return;
  }
  
  console.log(`
Changes detected:
  From: ${changeResult.lastCommit}
  To:   ${changeResult.currentHead}
  Files: ${changeResult.changes.length}
  
  + Added: ${changeResult.changes.filter(c => c.type === 'ADD').length}
  ~ Modified: ${changeResult.changes.filter(c => c.type === 'MODIFY').length}
  - Deleted: ${changeResult.changes.filter(c => c.type === 'DELETE').length}
`);
  
  const result = await updateIncrementally(cwd);
  
  console.log(`
Update completed.
  New nodes: ${result.delta.newNodes}
  Removed nodes: ${result.delta.removedNodes}
  
⚠️  MVP mode: Cascade update not implemented.
    See documentation for limitations.
`);
}
```

---

### 8. 依赖安装

#### 8.1 package.json 配置

```json
{
  "dependencies": {
    "isomorphic-git": "^1.24.0"
  },
  "devDependencies": {
    "@types/node": "^18.x"
  }
}
```

#### 8.2 fs adapter 配置

```typescript
// packages/codegraph/src/git/fs-adapter.ts

import { promises as fsPromises } from 'fs';

// isomorphic-git 需要的 fs adapter
export const fs = {
  promises: fsPromises,
  
  // 同步方法包装（某些 API 需要）
  readFileSync: async (path: string) => {
    return fsPromises.readFile(path);
  },
  
  writeFileSync: async (path: string, content: string | Buffer) => {
    return fsPromises.writeFile(path, content);
  },
  
  statSync: async (path: string) => {
    return fsPromises.stat(path);
  },
  
  mkdirSync: async (path: string, options?: any) => {
    return fsPromises.mkdir(path, options);
  },
  
  readdirSync: async (path: string) => {
    return fsPromises.readdir(path);
  },
  
  unlinkSync: async (path: string) => {
    return fsPromises.unlink(path);
  },
  
  rmdirSync: async (path: string) => {
    return fsPromises.rmdir(path);
  },
};
```

---

### 9. 总结

本技术规格为 C9 提供了：

| 内容 | 完成度 |
|------|--------|
| isomorphic-git API 调用示例 | ✅ 完整 |
| 变更文件获取方法 | ✅ 完整 |
| 变更类型判定逻辑 | ✅ 完整 |
| 增量更新流程 | ✅ MVP简化版 |
| 图操作方法实现 | ✅ 完整 |
| lastCommit.txt 更新 | ✅ 完整 |
| 测试场景设计 | ✅ 完整 |
| CLI 命令实现 | ✅ 完整 |
| 简化策略说明 | ✅ 明确MVP/M2边界 |

开发歧义消除：开发者可以直接参照本文档的代码示例实现 update 命令，无需猜测 isomorphic-git 的具体用法。