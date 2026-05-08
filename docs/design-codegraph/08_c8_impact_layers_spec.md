# C8 技术规格：影响范围与分层推断

> **文档定位**: 为 `cg-api-impact-layers` Change 提供无歧义的实现规格，消除开发歧义。
> **关联文档**: [01_origin_blueprint.md](./01_origin_blueprint.md) §6.2-6.3, §7.3-7.4

---

## 1. 影响范围分析 (getImpact)

### 1.1 输入与输出定义

```typescript
interface GetImpactInput {
  targets: string[];  // 文件或模块 ID 列表，如 ["FILE:src/auth.ts", "MODULE:src/utils.ts#formatDate"]
}

interface GetImpactOutput {
  content: string;           // 压缩文本输出
  affectedFiles: string[];   // 结构化数据：受影响文件路径列表
  directDependents: number;  // 直接依赖者数量
  indirectDependents: number; // 间接依赖者数量
}
```

### 1.2 BFS 遍历算法

**核心逻辑**: 使用反向索引 `inEdges` 沿 IMPORTS 边反向遍历，找出所有依赖目标节点的文件。

> **C8-1决议**: 默认排除测试目录（tests/、__tests__/），可通过 `options.includeTests` 配置包含。
> **C8-6决议**: 不处理 DYNAMIC_IMPORTS 边，与 C7 A2 决议保持一致。动态导入在运行时解析目标，无法静态反向追踪。

```typescript
function getImpact(graph: CodeGraph, targets: string[], options?: { maxDepth?: number; includeTests?: boolean }): GetImpactOutput {
  const visited = new Set<string>();
  const directDependents = new Set<string>();
  const indirectDependents = new Set<string>();
  
  // 步骤1: 将输入目标规范化为 FILE 节点
  const fileTargets = new Set<string>();
  for (const target of targets) {
    if (target.startsWith('FILE:')) {
      fileTargets.add(target);
    } else if (target.startsWith('MODULE:')) {
      // MODULE 节点 → 找到所属 FILE 节点
      // MODULE:src/utils.ts#formatDate → FILE:src/utils.ts
      const filePath = target.split('#')[0].replace('MODULE:', 'FILE:');
      fileTargets.add(filePath);
    }
  }
  
  // 步骤2: BFS 第一层 - 直接依赖者
  for (const target of fileTargets) {
    const inEdges = graph.inEdges.get(target) || [];
    for (const edge of inEdges) {
      // 只处理 IMPORTS 边（MVP 阶段无 CALLS 边）
      // C8-6决议: 不处理 DYNAMIC_IMPORTS 边（与 C7 A2 对齐）
      if (edge.type === EdgeType.IMPORTS || edge.type === EdgeType.RE_EXPORTS) {
        const dependent = edge.from;  // from 是依赖方
        
        // C8-1决议: 测试文件过滤（默认排除）
        const includeTests = options?.includeTests ?? false;
        if (!includeTests && isTestFile(dependent)) continue;
        
        if (!visited.has(dependent)) {
          visited.add(dependent);
          directDependents.add(dependent);
        }
      }
    }
  }
  
  // 步骤3: BFS 继续遍历 - 间接依赖者
  const queue = [...directDependents];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const inEdges = graph.inEdges.get(current) || [];
    for (const edge of inEdges) {
      if (edge.type === EdgeType.IMPORTS || edge.type === EdgeType.RE_EXPORTS) {
        const dependent = edge.from;
        if (!visited.has(dependent)) {
          visited.add(dependent);
          indirectDependents.add(dependent);
          queue.push(dependent);  // 继续向上游遍历
        }
      }
    }
  }
  
  // 步骤4: 生成输出文本
  const allAffected = [...directDependents, ...indirectDependents];
  const content = formatImpactOutput(fileTargets, directDependents, indirectDependents);
  
  return {
    content,
    affectedFiles: allAffected.map(id => id.replace('FILE:', '')),
    directDependents: directDependents.size,
    indirectDependents: indirectDependents.size
  };
}
```

### 1.3 递归深度控制

**深度限制**: 默认最大深度 10 层，防止极端情况下的无限遍历。

> **C8-2决议**: `maxDepth=0` 表示仅返回直接依赖者（第一层），不遍历间接依赖。
>
> | maxDepth值 | 遍历行为 |
> |------------|---------|
> | 0 | 仅直接依赖者（第一层） |
> | 1 | 直接依赖者（同0） |
> | 2-10 | 到指定深度层 |
> | >10 | 默认截断于第10层 |

```typescript
// BFS 带深度控制
function getImpactWithDepthLimit(
  graph: CodeGraph, 
  targets: string[], 
  maxDepth: number = 10,
  options?: { includeTests?: boolean }
): GetImpactOutput {
  // C8-2决议: maxDepth=0 表示仅返回直接依赖者
  // 实现中 depth=1 表示第一层（直接依赖），depth>=maxDepth 时停止继续遍历
  // 因此 maxDepth=0 或 1 都仅返回直接依赖者
  const visited = new Set<string>();
  const layers: Set<string>[] = [new Set(), new Set()]; // [direct, indirect]
  
  // 第一层初始化（同上）
  // ...
  
  // BFS 遍历带深度计数
  const queue: { nodeId: string; depth: number }[] = 
    directDependents.map(id => ({ nodeId: id, depth: 1 }));
  
  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;  // 达到深度限制，停止
    
    const inEdges = graph.inEdges.get(nodeId) || [];
    for (const edge of inEdges) {
      if (edge.type === EdgeType.IMPORTS || edge.type === EdgeType.RE_EXPORTS) {
        const dependent = edge.from;
        if (!visited.has(dependent)) {
          visited.add(dependent);
          layers[1].add(dependent);  // 间接层
          queue.push({ nodeId: dependent, depth: depth + 1 });
        }
      }
    }
  }
  
  // ...
}
```

### 1.4 输出格式模板

> **C8-4决议**: `via` 字段在 API 层返回数组格式，支持多路径场景。文本输出简化显示为逗号分隔字符串。

```
## Impact Analysis

### Target Files
- src/auth.ts
- src/utils.ts#formatDate

### Direct Dependents (3 files)
- src/pages/login.tsx → imports auth.ts
- src/api/client.ts → imports auth.ts
- src/components/AuthProvider.tsx → imports auth.ts

### Indirect Dependents (5 files)
- src/pages/dashboard.tsx (via login.tsx)
- src/pages/profile.tsx (via AuthProvider.tsx)
- src/api/handlers.ts (via client.ts)
- src/hooks/useAuth.ts (via AuthProvider.tsx)
- src/App.tsx (via dashboard.tsx)

### Summary
- Total affected: 8 files
- Direct: 3, Indirect: 5
- Estimated blast radius: medium
```

**API层via字段格式**:
```typescript
// C8-4决议: via为数组，支持多路径
interface AffectedFile {
  path: string;
  distance: number;
  via: string[];  // 如 ["src/services/auth.ts", "src/components/Modal.tsx"]
}
```

---

## 2. 分层推断算法 (getArchitectureLayers)

### 2.1 一级子目录分组

**定义**: 一级子目录是相对于项目源码根目录的第一个目录层级。

```typescript
// 示例：假设项目根为 /project，源码根为 src/
// src/pages/foo.ts        → 一级子目录 = "pages"
// src/components/Bar.tsx  → 一级子目录 = "components"
// src/utils/date/format.ts → 一级子目录 = "utils"
// src/index.ts            → 无一级子目录（根目录文件）
```

**分组规则**:

```typescript
interface DirectoryGroup {
  name: string;           // 一级子目录名，如 "pages"
  files: string[];        // 该组下所有 FILE 节点 ID
  importStats: {
    importedBy: Map<string, number>;  // 被哪些组导入，各多少次
    importsFrom: Map<string, number>; // 导入哪些组，各多少次
  };
}

function groupFilesByFirstLevelDirectory(
  graph: CodeGraph, 
  sourceRoot: string = 'src'
): Map<string, DirectoryGroup> {
  const groups = new Map<string, DirectoryGroup>();
  
  // 初始化根目录文件组（特殊组）
  groups.set('__root__', { 
    name: '__root__', 
    files: [], 
    importStats: { importedBy: new Map(), importsFrom: new Map() }
  });
  
  for (const [nodeId, node] of graph.nodes) {
    if (node.type !== NodeType.FILE) continue;
    
    // 提取相对路径
    const relativePath = node.path;  // 如 "src/pages/login.tsx"
    
    // 判断是否在源码根目录下
    if (!relativePath.startsWith(sourceRoot + '/')) {
      continue;  // 跳过非源码文件
    }
    
    // 提取一级子目录
    const pathAfterSrc = relativePath.slice(sourceRoot.length + 1);  // "pages/login.tsx"
    const firstSlashIndex = pathAfterSrc.indexOf('/');
    
    let groupName: string;
    if (firstSlashIndex === -1) {
      // 无子目录 → 根目录文件
      groupName = '__root__';
    } else {
      // 有子目录 → 提取一级目录名
      groupName = pathAfterSrc.slice(0, firstSlashIndex);  // "pages"
    }
    
    // 初始化组（如果不存在）
    if (!groups.has(groupName)) {
      groups.set(groupName, {
        name: groupName,
        files: [],
        importStats: { importedBy: new Map(), importsFrom: new Map() }
      });
    }
    
    // 添加文件到组
    groups.get(groupName)!.files.push(nodeId);
  }
  
  return groups;
}
```

### 2.2 统计组间导入方向

**遍历逻辑**: 对每条 IMPORTS 边，确定其所属组，并统计方向。

```typescript
function computeImportDirectionStats(
  graph: CodeGraph, 
  groups: Map<string, DirectoryGroup>
): void {
  for (const edge of graph.edges) {
    // 只处理 IMPORTS 和 RE_EXPORTS 边
    if (edge.type !== EdgeType.IMPORTS && edge.type !== EdgeType.RE_EXPORTS) {
      continue;
    }
    
    // 解析边的源和目标
    const fromFile = edge.from;  // FILE:src/pages/login.tsx
    const toFile = edge.to;      // FILE:src/auth.ts
    
    // 确定所属组
    const fromGroup = getGroupNameFromFile(fromFile, 'src');
    const toGroup = getGroupNameFromFile(toFile, 'src');
    
    // 跳过同一组内的导入（不计入组间统计）
    if (fromGroup === toGroup) continue;
    
    // 跳过外部依赖组
    if (toGroup === '__external__') continue;
    
    // 更新统计
    // fromGroup 导入了 toGroup
    const fromGroupData = groups.get(fromGroup);
    if (fromGroupData) {
      const count = fromGroupData.importStats.importsFrom.get(toGroup) || 0;
      fromGroupData.importStats.importsFrom.set(toGroup, count + 1);
    }
    
    // toGroup 被 fromGroup 导入
    const toGroupData = groups.get(toGroup);
    if (toGroupData) {
      const count = toGroupData.importStats.importedBy.get(fromGroup) || 0;
      toGroupData.importStats.importedBy.set(fromGroup, count + 1);
    }
  }
}

function getGroupNameFromFile(fileId: string, sourceRoot: string): string {
  // FILE:src/pages/login.tsx → "pages"
  const path = fileId.replace('FILE:', '');
  
  if (!path.startsWith(sourceRoot + '/')) {
    return '__external__';  // 外部文件
  }
  
  const pathAfterSrc = path.slice(sourceRoot.length + 1);
  const firstSlashIndex = pathAfterSrc.indexOf('/');
  
  if (firstSlashIndex === -1) {
    return '__root__';
  }
  return pathAfterSrc.slice(0, firstSlashIndex);
}
```

### 2.3 层级推断判定

**判定原则**:
- **被导入数多 = 底层**（基础设施，被广泛依赖）
- **导入别人多 = 上层**（应用层，依赖基础设施）
- **相互导入 = 同层或需要拆分警告**（C8-11决议: 同层互导不视为违规，可选输出警告）

**算法步骤**:

```typescript
interface LayerAssignment {
  layer: number;           // 层级序号，1=最底层（基础设施）
  role: string;            // 层级角色名称
  groups: string[];        // 该层包含的组名
}

function inferArchitectureLayers(
  groups: Map<string, DirectoryGroup>
): LayerAssignment[] {
  // 步骤1: 计算每个组的净依赖分数
  // netScore = 被导入次数 - 导入次数
  // 正值大 → 被更多组依赖 → 更底层
  // 负值大 → 依赖更多组 → 更上层
  
  const groupScores: { name: string; netScore: number; importedBy: number; importsFrom: number }[] = [];
  
  for (const [groupName, groupData] of groups) {
    const importedByCount = Array.from(groupData.importStats.importedBy.values())
      .reduce((sum, c) => sum + c, 0);
    const importsFromCount = Array.from(groupData.importStats.importsFrom.values())
      .reduce((sum, c) => sum + c, 0);
    
    groupScores.push({
      name: groupName,
      netScore: importedByCount - importsFromCount,
      importedBy: importedByCount,
      importsFrom: importsFromCount
    });
  }
  
  // 步骤2: 按净分数降序排序（分数高 → 层级低）
  groupScores.sort((a, b) => b.netScore - a.netScore);
  
  // 步骤3: 分配层级
  // 策略: 相邻分数差距小于阈值(2)的归为同一层
  const LAYER_THRESHOLD = 2;
  // C8-3决议: 阈值判定示例
  // 阈值语义: 相邻组分数差距 <= 阈值时归为同层
  //
  // 示例计算:
  // | 组名 | netScore | 与前组差值 | 层级判定 |
  // |------|----------|-----------|---------|
  // | utils | 45 | - | Layer 1 (起始) |
  // | types | 32 | |45-32|=13 > 2 | Layer 2 (差值大) |
  // | components | 30 | |32-30|=2 <= 2 | Layer 2 (同层) |
  // | services | -10 | |30-(-10)|=40 > 2 | Layer 3 (差值大) |
  // | pages | -30 | |-10-(-30)|=20 > 2 | Layer 4 (差值大) |
  //
  // 结果: Layer1={utils}, Layer2={types,components}, Layer3={services}, Layer4={pages}
  const layers: LayerAssignment[] = [];
  let currentLayer = 1;
  let currentLayerGroups: string[] = [];
  let prevScore = groupScores[0]?.netScore ?? 0;
  
  const LAYER_ROLES: Record<number, string> = {
    1: 'Foundation',
    2: 'Core',
    3: 'Application',
    4: 'Presentation'
  };
  
  for (const score of groupScores) {
    if (Math.abs(score.netScore - prevScore) > LAYER_THRESHOLD && currentLayerGroups.length > 0) {
      // 分数差距足够大，开始新的一层
      layers.push({
        layer: currentLayer,
        role: LAYER_ROLES[currentLayer] || `Layer ${currentLayer}`,
        groups: currentLayerGroups
      });
      currentLayer++;
      currentLayerGroups = [];
    }
    currentLayerGroups.push(score.name);
    prevScore = score.netScore;
  }
  
  // 添加最后一层
  if (currentLayerGroups.length > 0) {
    layers.push({
      layer: currentLayer,
      role: LAYER_ROLES[currentLayer] || `Layer ${currentLayer}`,
      groups: currentLayerGroups
    });
  }
  
  return layers;
}
```

### 2.4 违规检测

**规则**: 低层不应导入高层。

> **C8-10决议**: `expectedLayerGap` 字段重命名为 `layerGap`，表示实际层级差距（违规跨越的层级数）。
> **C8-11决议**: 同层互导（fromLayer === toLayer）不视为违规，可选输出警告。

```typescript
interface LayerViolation {
  fromGroup: string;   // 违规导入方（应为高层）
  toGroup: string;     // 被导入方（应为低层）
  count: number;       // 违规导入次数
  // C8-10决议: 重命名为 layerGap，表示跨越的层级数
  layerGap: number;    // toLayer - fromLayer（违规时为正值，表示跨越层级数）
}

function detectLayerViolations(
  groups: Map<string, DirectoryGroup>,
  layers: LayerAssignment[],
  options?: { warnOnMutualImport?: boolean }
): LayerViolation[] {
  const violations: LayerViolation[] = [];
  const mutualWarnings: string[] = [];  // C8-11: 同层互导警告
  
  // 构建组 → 层级映射
  const groupToLayer = new Map<string, number>();
  for (const layer of layers) {
    for (const group of layer.groups) {
      groupToLayer.set(group, layer.layer);
    }
  }
  
  // 检查每条组间导入
  for (const [groupName, groupData] of groups) {
    const fromLayer = groupToLayer.get(groupName) ?? 0;
    
    for (const [targetGroup, count] of groupData.importStats.importsFrom) {
      const toLayer = groupToLayer.get(targetGroup) ?? 0;
      
      // C8-11决议: 同层互导不视为违规，可选警告
      if (fromLayer === toLayer) {
        if (options?.warnOnMutualImport) {
          mutualWarnings.push(`${groupName} and ${targetGroup} have mutual imports (same layer)`);
        }
        continue;
      }
      
      // 违规判定: 高层号导入低层号（号大=上层）
      // 正常: 上层导入底层 (fromLayer > toLayer)
      // 违规: 低层导入高层 (fromLayer < toLayer)
      if (fromLayer < toLayer) {
        violations.push({
          fromGroup: groupName,
          toGroup: targetGroup,
          count,
          layerGap: toLayer - fromLayer  // C8-10: 跨越层级数
        });
      }
    }
  }
  
  return violations;
}
```

### 2.5 输出格式模板

> **C8-5决议**: healthScore 计算公式明确如下:
> ```
> 基础分 = 100
> 扣分规则:
> - minor violation: -5 points (layerGap = 1)
> - moderate violation: -10 points (layerGap = 2)
> - critical violation: -15 points (layerGap >= 3)
> 最低分 = 0
> ```

```
## Architecture Layers

### Layer 1 (Foundation)
- **utils**: 12 files, imported by 8 groups (45 times)
- **types**: 5 files, imported by 6 groups (32 times)
- Role: Core utilities and type definitions

### Layer 2 (Core)
- **services**: 8 files, imported by 4 groups (28 times)
- **hooks**: 6 files, imported by 3 groups (15 times)
- Role: Business logic and shared state

### Layer 3 (Application)
- **components**: 15 files, imported by 2 groups (22 times)
- Role: UI components

### Layer 4 (Presentation)
- **pages**: 10 files, imports from 3 layers above
- Role: Page-level composition

## Layer Violations (2 detected)
- **components → pages**: 3 imports (should be pages → components)
  - components/Layout.tsx → pages/Home.tsx
  - components/Header.tsx → pages/Dashboard.tsx
  - components/Modal.tsx → pages/Settings.tsx
- **utils → services**: 1 import (should be services → utils)
  - utils/api-helper.ts → services/AuthService.ts

## Layer Health Score: 85/100
- Violation penalty: -15 points (3 violations)
```

---

## 3. 完整实现代码骨架

```typescript
// packages/codegraph/src/api/impact.ts

import { CodeGraph, EdgeType, NodeType } from '../types';

export function getImpact(
  graph: CodeGraph,
  targets: string[],
  options?: { maxDepth?: number }
): ImpactResult {
  const maxDepth = options?.maxDepth ?? 10;
  
  // 规范化目标为 FILE 节点
  const fileTargets = normalizeTargetsToFile(graph, targets);
  
  // BFS 遍历
  const result = bfsDependents(graph, fileTargets, maxDepth);
  
  // 格式化输出
  const content = formatImpactText(fileTargets, result);
  
  return {
    content,
    affectedFiles: result.allAffected,
    directDependents: result.direct.size,
    indirectDependents: result.indirect.size
  };
}

// packages/codegraph/src/api/layers.ts

import { CodeGraph, EdgeType, NodeType } from '../types';

export function getArchitectureLayers(
  graph: CodeGraph,
  options?: { sourceRoot?: string }
): LayersResult {
  const sourceRoot = options?.sourceRoot ?? 'src';
  
  // 步骤1: 按一级子目录分组
  const groups = groupFilesByFirstLevelDirectory(graph, sourceRoot);
  
  // 步骤2: 统计组间导入方向
  computeImportDirectionStats(graph, groups);
  
  // 步骤3: 推断层级
  const layers = inferArchitectureLayers(groups);
  
  // 步骤4: 检测违规
  const violations = detectLayerViolations(groups, layers);
  
  // 步骤5: 格式化输出
  const content = formatLayersText(groups, layers, violations);
  
  return {
    content,
    layers,
    violations,
    healthScore: calculateLayerHealthScore(violations, groups)
  };
}
```

---

## 4. 测试场景

### 4.1 Fixture 结构

```
fixtures/sample-project/
├── src/
│   ├── index.ts              # 根文件，导入 pages
│   ├── utils/
│   │   ├── format.ts         # 被 services、components 导入
│   │   └── validate.ts       # 被 services 导入
│   ├── types/
│   │   ├── index.ts          # 被全项目导入
│   │   └── api.ts            # 被 services 导入
│   ├── services/
│   │   ├── auth.ts           # 导入 utils、types；被 pages 导入
│   │   └── api.ts            # 导入 utils、types；被 pages 导入
│   ├── components/
│   │   ├── Button.tsx        # 导入 types；被 pages 导入
│   │   └── Modal.tsx         # 导入 types、utils；被 pages 导入
│   ├── pages/
│   │   ├── Home.tsx          # 导入 components、services、utils
│   │   └── Login.tsx         # 导入 components、services
│   │   └── Dashboard.tsx     # 导入 components、services、utils
│   └── tests/
│       ├── auth.test.ts      # 导入 services（测试文件，不计入分层）
```

### 4.2 期望分层输出

```
## Architecture Layers

### Layer 1 (Foundation)
- **types**: 2 files, imported by 5 groups
- **utils**: 2 files, imported by 3 groups

### Layer 2 (Core)
- **services**: 2 files, imported by 1 group (pages)
- **components**: 2 files, imported by 1 group (pages)

### Layer 3 (Application)
- **pages**: 3 files, imports from 2 layers above

### Layer 4 (Presentation)
- **__root__**: 1 file (index.ts), imports pages

## Layer Violations: 0
✓ All imports follow layer hierarchy
```

### 4.3 影响范围测试场景

**输入**: `getImpact(["FILE:src/utils/format.ts"])`

**期望输出**:

```
## Impact Analysis

### Target Files
- src/utils/format.ts

### Direct Dependents (3 files)
- src/services/auth.ts → imports format.ts
- src/services/api.ts → imports format.ts
- src/components/Modal.tsx → imports format.ts

### Indirect Dependents (4 files)
- src/pages/Home.tsx (via auth.ts, Modal.tsx)
- src/pages/Dashboard.tsx (via api.ts, Modal.tsx)
- src/pages/Login.tsx (via auth.ts)
- src/index.ts (via Home.tsx)

### Summary
- Total affected: 7 files
- Direct: 3, Indirect: 4
```

### 4.4 违规场景测试

**Fixture**: 添加违规导入

```typescript
// src/components/Button.tsx 添加违规导入
import { Home } from '../pages/Home';  // 违规：components 导入 pages
```

**期望输出**:

```
## Layer Violations (1 detected)
- **components → pages**: 1 import (should be pages → components)
  - components/Button.tsx → pages/Home.tsx
  
## Layer Health Score: 90/100
- Violation penalty: -10 points
```

### 4.5 单元测试清单

```typescript
// tests/unit/api/impact.test.ts

describe('getImpact', () => {
  it('should return empty for isolated file', () => {
    // 无导入者的文件
  });
  
  it('should find direct dependents', () => {
    // 只有一层依赖
  });
  
  it('should traverse indirect dependents via BFS', () => {
    // 多层依赖链
  });
  
  it('should respect depth limit', () => {
    // 深度超过 maxDepth 时截断
  });
  
  it('should handle MODULE target by resolving to FILE', () => {
    // MODULE 输入转换为 FILE
  });
  
  it('should not include test files in impact', () => {
    // 测试文件不计入影响范围（可选配置）
  });
});

// tests/unit/api/layers.test.ts

describe('getArchitectureLayers', () => {
  it('should group files by first-level directory', () => {
    // 验证分组正确性
  });
  
  it('should place __root__ files in separate group', () => {
    // 根目录文件处理
  });
  
  it('should infer layers by import direction', () => {
    // utils 被 services 导入 → utils 在底层
  });
  
  it('should detect layer violations', () => {
    // components 导入 pages 应为违规
  });
  
  it('should handle mutual imports within same layer', () => {
    // 同层互导不视为违规
  });
  
  it('should calculate health score based on violations', () => {
    // 健康度计算公式验证
  });
  
  it('should handle project without src directory', () => {
    // 非 src 根项目（如 lib/、app/）
  });
});
```

---

## 5. API 类型定义汇总

```typescript
// packages/codegraph/src/api/types.ts

export interface ImpactResult {
  content: string;
  affectedFiles: string[];
  directDependents: number;
  indirectDependents: number;
}

export interface LayersResult {
  content: string;
  layers: LayerAssignment[];
  violations: LayerViolation[];
  healthScore: number;
}

export interface LayerAssignment {
  layer: number;
  role: string;
  groups: string[];
  stats: {
    fileCount: number;
    importedByCount: number;
    importsFromCount: number;
  }[];
}

export interface LayerViolation {
  fromGroup: string;
  toGroup: string;
  count: number;
  affectedFiles: string[];  // 具体违规文件对
  // C8-10决议: 重命名为 layerGap，表示跨越的层级数
  layerGap: number;         // toLayer - fromLayer（违规时为正值）
}
```

---

## 6. 实现注意事项

### 6.1 边缘情况处理

| 场景 | 处理方式 |
|------|---------|
| 无 src 目录 | 支持自定义 sourceRoot 参数，默认 'src' |
| 根目录文件 | 录入 `__root__` 特殊组，单独分层 |
| 外部依赖 | 跳过 EXTERNAL 节点，不计入分组 |
| 测试目录 | C8-1决议: 默认排除 `tests/`、`__tests__/`，可通过 `includeTests` 配置计入 |
| DYNAMIC_IMPORTS | C8-6决议: 不计入影响范围遍历（与 C7 A2 对齐），动态导入目标无法静态反向追踪 |
| 空组 | 无文件的组不参与分层 |
| 无导入关系 | 单文件项目返回单层结构 |

### 6.2 性能考量

- **BFS 遍历**: 使用 Set 防止重复访问，O(V+E) 复杂度
- **分组统计**: 预计算导入矩阵，避免重复遍历边
- **大项目**: 1000+ 文件时，考虑惰性计算（仅计算用户关注的层）

### 6.3 与后续 Milestone 的关系

- **M2**: CALLS 边加入后，`getImpact` 需扩展支持函数级影响分析
- **M3**: `detectLayerViolations` 将集成到架构约束引擎
- **M4**: `buildContextFor` 将使用分层信息优先注入底层模块上下文

---

## 7. CLI输出格式

> **跨规格说明**: CLI JSON 输出格式遵循 C7 §3.5 定义的模式。
> 错误代码与 C6 附录 A 对齐，确保 CLI 命令统一的 Agent-Friendly 输出。

```typescript
// §7 CLI输出格式
// CLI命令 --json 输出的结构化schema

/**
 * impact命令JSON输出格式
 * 
 * 对应CLI: codegraph impact <target> --json
 * 映射自: GetImpactOutput (§1.1)
 */
interface ImpactResult {
  success: boolean;
  targets: string[];                           // 输入目标列表
  affectedFiles: AffectedFile[];               // 结构化受影响文件列表
  summary: {
    total: number;                             // 总受影响文件数
    direct: number;                            // 直接依赖者数量
    indirect: number;                          // 间接依赖者数量
  };
  blastRadius: 'low' | 'medium' | 'high' | 'unknown';  // 影响范围等级
  durationMs: number;
  warnings?: string[];
  nextSuggested?: string[];
}

/**
 * 受影响文件详情
 */
interface AffectedFile {
  path: string;                                // 文件路径（不含 FILE: 前缀）
  distance: number;                            // 距离目标的层级（1=直接, 2+=间接）
  via?: string[];                              // 中间依赖路径（间接依赖时）
}

/**
 * layers命令JSON输出格式
 * 
 * 对应CLI: codegraph layers --json
 * 映射自: LayersResult (§5 API类型定义)
 */
interface LayersResult {
  success: boolean;
  layers: CLILayer[];                          // 层级列表
  violations: CLILayerViolation[];             // 违规列表
  healthScore: number;                         // 健康度分数 (0-100)
  groups: CLIGroupSummary[];                   // 组摘要列表
  durationMs: number;
  warnings?: string[];
  nextSuggested?: string[];
}

/**
 * CLI层级输出
 * 映射自: LayerAssignment
 */
interface CLILayer {
  layer: number;                               // 层级序号（1=最底层）
  role: string;                                // 层级角色名称
  groups: CLIGroupInLayer[];                   // 该层包含的组
}

/**
 * 层内组详情
 */
interface CLIGroupInLayer {
  name: string;                                // 组名（如 "utils", "types"）
  fileCount: number;                           // 文件数量
  importedByCount: number;                     // 被导入次数
  importsFromCount: number;                    // 导入次数
}

/**
 * CLI违规输出
 * 映射自: LayerViolation
 */
interface CLILayerViolation {
  fromGroup: string;                           // 违规导入方（应为高层）
  toGroup: string;                             // 被导入方（应为低层）
  count: number;                               // 违规导入次数
  affectedFiles: ViolationFilePair[];          // 具体违规文件对
  severity: 'minor' | 'moderate' | 'critical'; // 违规严重程度
  suggestion: string;                          // 修复建议
}

/**
 * 违规文件对
 */
interface ViolationFilePair {
  from: string;                                // 违规导入文件
  to: string;                                  // 被导入文件
}

/**
 * 组摘要（用于层级推断说明）
 */
interface CLIGroupSummary {
  name: string;
  assignedLayer: number;
  netScore: number;                            // 净依赖分数（被导入-导入）
}

/**
 * CLI统一错误格式
 * 与 C6 附录 B 错误消息模板对齐
 */
interface CLIError {
  success: false;
  error: {
    code: string;                              // E00x 格式
    message: string;
    suggestion?: string;
  };
  durationMs: number;
}

/**
 * 错误代码定义
 */
const CLIErrorCodes = {
  E001_TARGET_NOT_FOUND: 'Target node not found in graph',
  E002_PARSE_ERROR: 'Failed to parse baseline data',
  E003_NO_IMPACT: 'No dependents found for target',
  E004_NO_LAYERS: 'No architecture layers could be inferred',
  E005_EMPTY_GRAPH: 'Graph contains no FILE nodes',
};
```

---

## 8. CLI JSON测试

> **跨规格说明**: CLI JSON 输出测试与 Change 10 (`cg-cli-query-commands`) 对齐。

### 8.1 impact命令JSON测试

**场景 1: impact命令成功返回**

输入: `codegraph impact FILE:src/utils/format.ts --json`

期望输出符合 ImpactResult schema:
```json
{
  "success": true,
  "targets": ["FILE:src/utils/format.ts"],
  "affectedFiles": [
    {"path": "src/services/auth.ts", "distance": 1},
    {"path": "src/services/api.ts", "distance": 1},
    {"path": "src/components/Modal.tsx", "distance": 1},
    {"path": "src/pages/Home.tsx", "distance": 2, "via": ["src/services/auth.ts"]},
    {"path": "src/pages/Dashboard.tsx", "distance": 2, "via": ["src/services/api.ts"]},
    {"path": "src/pages/Login.tsx", "distance": 2, "via": ["src/services/auth.ts"]},
    {"path": "src/index.ts", "distance": 3, "via": ["src/pages/Home.tsx"]}
  ],
  "summary": {
    "total": 7,
    "direct": 3,
    "indirect": 4
  },
  "blastRadius": "medium",
  "durationMs": 45,
  "warnings": [],
  "nextSuggested": [
    "codegraph scope FILE:src/services/auth.ts",
    "codegraph layers"
  ]
}
```

**验证要点**:
- `success: true` 存在
- `affectedFiles[].distance` 反映正确层级关系
- `summary.total = direct + indirect`
- `blastRadius` 根据 total 动态计算:
  - low: total ≤ 3
  - medium: total 4-10
  - high: total > 10
- `nextSuggested` 包含有效的后续命令

**场景 2: impact命令多目标**

输入: `codegraph impact FILE:src/utils/format.ts FILE:src/types/api.ts --json`

期望输出:
```json
{
  "success": true,
  "targets": ["FILE:src/utils/format.ts", "FILE:src/types/api.ts"],
  "affectedFiles": [
    {"path": "src/services/auth.ts", "distance": 1},
    {"path": "src/services/api.ts", "distance": 1},
    {"path": "src/components/Modal.tsx", "distance": 1},
    {"path": "src/pages/Home.tsx", "distance": 2, "via": ["src/services/auth.ts"]}
  ],
  "summary": {"total": 4, "direct": 3, "indirect": 1},
  "blastRadius": "low",
  "durationMs": 52
}
```

**验证要点**:
- 多目标的依赖者合并去重
- C8-12决议: distance取最小值，via取对应最短路径

**场景 3: impact命令无依赖者**

输入: `codegraph impact FILE:src/isolated.ts --json`

期望输出:
```json
{
  "success": true,
  "targets": ["FILE:src/isolated.ts"],
  "affectedFiles": [],
  "summary": {"total": 0, "direct": 0, "indirect": 0},
  "blastRadius": "unknown",
  "durationMs": 12,
  "warnings": ["No dependents found - file may be isolated or entry point"],
  "nextSuggested": ["codegraph scope FILE:src/isolated.ts"]
}
```

**验证要点**:
- 无依赖者时返回空列表，而非错误
- `blastRadius: unknown` 表示无法判断
- warnings 包含提示信息

**场景 4: impact命令目标不存在**

输入: `codegraph impact FILE:src/nonexistent.ts --json`

期望输出符合 CLIError schema:
```json
{
  "success": false,
  "error": {
    "code": "E001_TARGET_NOT_FOUND",
    "message": "Target 'FILE:src/nonexistent.ts' not found in graph",
    "suggestion": "Run `codegraph analyze` to build graph first"
  },
  "durationMs": 8
}
```

**Exit code**: 2 (目标不存在)

### 8.2 layers命令JSON测试

**场景 1: layers命令成功返回**

输入: `codegraph layers --json`

期望输出符合 LayersResult schema:
```json
{
  "success": true,
  "layers": [
    {
      "layer": 1,
      "role": "Foundation",
      "groups": [
        {"name": "types", "fileCount": 2, "importedByCount": 32, "importsFromCount": 0},
        {"name": "utils", "fileCount": 2, "importedByCount": 45, "importsFromCount": 5}
      ]
    },
    {
      "layer": 2,
      "role": "Core",
      "groups": [
        {"name": "services", "fileCount": 2, "importedByCount": 15, "importsFromCount": 28},
        {"name": "components", "fileCount": 2, "importedByCount": 22, "importsFromCount": 10}
      ]
    },
    {
      "layer": 3,
      "role": "Application",
      "groups": [
        {"name": "pages", "fileCount": 3, "importedByCount": 5, "importsFromCount": 35}
      ]
    },
    {
      "layer": 4,
      "role": "Presentation",
      "groups": [
        {"name": "__root__", "fileCount": 1, "importedByCount": 0, "importsFromCount": 3}
      ]
    }
  ],
  "violations": [],
  "healthScore": 100,
  "groups": [
    {"name": "types", "assignedLayer": 1, "netScore": 32},
    {"name": "utils", "assignedLayer": 1, "netScore": 40},
    {"name": "services", "assignedLayer": 2, "netScore": -13},
    {"name": "components", "assignedLayer": 2, "netScore": 12},
    {"name": "pages", "assignedLayer": 3, "netScore": -30},
    {"name": "__root__", "assignedLayer": 4, "netScore": -3}
  ],
  "durationMs": 125,
  "warnings": [],
  "nextSuggested": []
}
```

**验证要点**:
- `layers[].layer` 从1开始递增
- `healthScore` = 100 - (violations.length × penalty)
- `groups[].netScore` 正值=底层倾向，负值=上层倾向
- 无违规时 violations 为空数组

**场景 2: layers命令带违规**

输入: `codegraph layers --json` (含违规导入的 fixture)

期望输出:
```json
{
  "success": true,
  "layers": [
    {"layer": 1, "role": "Foundation", "groups": [{"name": "utils", "fileCount": 2, "importedByCount": 45, "importsFromCount": 5}]},
    {"layer": 2, "role": "Core", "groups": [{"name": "components", "fileCount": 2, "importedByCount": 22, "importsFromCount": 10}]},
    {"layer": 3, "role": "Application", "groups": [{"name": "pages", "fileCount": 3, "importedByCount": 5, "importsFromCount": 35}]}
  ],
  "violations": [
    {
      "fromGroup": "components",
      "toGroup": "pages",
      "count": 3,
      "affectedFiles": [
        {"from": "src/components/Layout.tsx", "to": "src/pages/Home.tsx"},
        {"from": "src/components/Header.tsx", "to": "src/pages/Dashboard.tsx"},
        {"from": "src/components/Modal.tsx", "to": "src/pages/Settings.tsx"}
      ],
      "severity": "moderate",
      "suggestion": "Move shared logic from pages to components, or create a shared services layer"
    },
    {
      "fromGroup": "utils",
      "toGroup": "services",
      "count": 1,
      "affectedFiles": [{"from": "src/utils/api-helper.ts", "to": "src/services/AuthService.ts"}],
      "severity": "minor",
      "suggestion": "Consider moving api-helper.ts to services directory"
    }
  ],
  "healthScore": 85,
  "groups": [
    {"name": "utils", "assignedLayer": 1, "netScore": 40},
    {"name": "components", "assignedLayer": 2, "netScore": 12},
    {"name": "pages", "assignedLayer": 3, "netScore": -30}
  ],
  "durationMs": 98,
  "warnings": ["2 layer violations detected"],
  "nextSuggested": [
    "codegraph scope FILE:src/components/Layout.tsx"
  ]
}
```

**验证要点**:
- violations 按严重程度排序 (critical > moderate > minor)
- `severity` 根据 layerGap 计算（C8-10决议: 使用 layerGap）:
  - minor: gap = 1
  - moderate: gap = 2
  - critical: gap ≥ 3
- `healthScore` 计算公式: `100 - (minor×5 + moderate×10 + critical×15)`
- `suggestion` 提供可操作的修复建议

**场景 3: layers命令空图**

输入: `codegraph layers --json` (无 FILE 节点的图)

期望输出:
```json
{
  "success": false,
  "error": {
    "code": "E005_EMPTY_GRAPH",
    "message": "Graph contains no FILE nodes - cannot infer architecture layers",
    "suggestion": "Run `codegraph analyze` with valid source directory"
  },
  "durationMs": 5
}
```

**Exit code**: 1 (一般错误)

### 8.3 CLI JSON测试清单

```typescript
// tests/integration/cli/impact-cli.test.ts

describe('impact CLI JSON output', () => {
  it('should return valid ImpactResult for single target', () => {
    // 单目标查询，验证 schema
  });

  it('should return valid ImpactResult for multiple targets', () => {
    // 多目标查询，合并去重验证
  });

  it('should calculate blastRadius correctly', () => {
    // blastRadius 计算逻辑验证
  });

  it('should return empty affectedFiles for isolated file', () => {
    // 无依赖者场景
  });

  it('should return CLIError with E001 for nonexistent target', () => {
    // 目标不存在错误
  });

  it('should include via path for indirect dependents', () => {
    // 间接依赖路径追踪
  });

  it('should exit with code 0 on success', () => {
    // Exit code 验证
  });

  it('should exit with code 2 on target not found', () => {
    // Exit code 验证
  });
});

// tests/integration/cli/layers-cli.test.ts

describe('layers CLI JSON output', () => {
  it('should return valid LayersResult for analyzed project', () => {
    // 执行 CLI 命令，验证 JSON schema
  });

  it('should calculate healthScore based on violations', () => {
    // healthScore 计算公式验证
  });

  it('should assign severity based on layer gap', () => {
    // severity 计算逻辑验证
  });

  it('should return CLIError with E005 for empty graph', () => {
    // 空图错误处理
  });

  it('should include netScore for each group', () => {
    // netScore 计算验证
  });

  it('should generate actionable suggestions for violations', () => {
    // suggestion 内容验证
  });

  it('should exit with code 0 on success', () => {
    // Exit code 验证
  });

  it('should exit with code 1 on empty graph error', () => {
    // Exit code 验证
  });
});
```

---

## 9. CLI命令映射

> **跨规格说明**: 本节定义 API 输出如何映射到 CLI JSON 输出格式。
> CLI 命令实现在 Change 10 (`cg-cli-query-commands`) 中完成。

### 9.1 impact命令

**CLI调用**: `codegraph impact <target...> --json`

**映射函数**:
```typescript
function mapImpactToCLI(
  api: GetImpactOutput,
  targets: string[],
  durationMs: number
): ImpactResult {
  // 计算 blastRadius
  // C8-8决议: 边界值归属确认: 3=low, 10=medium
  const total = api.affectedFiles.length;
  let blastRadius: 'low' | 'medium' | 'high' | 'unknown';
  if (total === 0) {
    blastRadius = 'unknown';
  } else if (total <= 3) {
    blastRadius = 'low';      // 3 归属于 low
  } else if (total <= 10) {
    blastRadius = 'medium';   // 10 归属于 medium
  } else {
    blastRadius = 'high';
  }

  // 构建 affectedFiles 结构
  // 需要从 BFS 过程中获取 distance 和 via 信息
  // API GetImpactOutput 需扩展或 CLI 层重新计算
  const affectedFiles: AffectedFile[] = api.affectedFiles.map(path => ({
    path,
    distance: 1, // TODO: 从扩展 API 或 CLI 层计算
    via: []      // TODO: 从扩展 API 或 CLI 层计算
  }));

  // 生成 warnings
  const warnings: string[] = [];
  if (total === 0) {
    warnings.push('No dependents found - file may be isolated or entry point');
  }

  // 生成 nextSuggested
  const nextSuggested: string[] = [];
  if (api.affectedFiles.length > 0) {
    // C8-9决议: 建议查看最近的直接依赖者（第一个依赖者）
    // topDependent 代表"最近的直接依赖者"，按 BFS 顺序排列
    const topDependent = api.affectedFiles[0];
    nextSuggested.push(`codegraph scope FILE:${topDependent}`);
  }
  nextSuggested.push('codegraph layers');

  return {
    success: true,
    targets,
    affectedFiles,
    summary: {
      total,
      direct: api.directDependents,
      indirect: api.indirectDependents
    },
    blastRadius,
    durationMs,
    warnings,
    nextSuggested
  };
}
```

**API 扩展建议**: 为支持完整的 CLI JSON 输出，GetImpactOutput 可扩展:
```typescript
interface GetImpactOutputExtended extends GetImpactOutput {
  /** 带层级信息的受影响文件列表（可选） */
  affectedWithDistance?: { path: string; distance: number; via: string[] }[];
}
```

### 9.2 layers命令

**CLI调用**: `codegraph layers --json`

**映射函数**:
```typescript
function mapLayersToCLI(
  api: LayersResult,
  groups: Map<string, DirectoryGroup>,
  durationMs: number
): LayersResult {
  // 映射 layers
  const layers: CLILayer[] = api.layers.map(layer => ({
    layer: layer.layer,
    role: layer.role,
    groups: layer.groups.map(groupName => {
      const groupData = groups.get(groupName);
      const stats = layer.stats?.find(s => s.fileCount !== undefined);
      return {
        name: groupName,
        fileCount: stats?.fileCount ?? groupData?.files.length ?? 0,
        importedByCount: stats?.importedByCount ?? 
          Array.from(groupData?.importStats.importedBy.values() || []).reduce((a, b) => a + b, 0),
        importsFromCount: stats?.importsFromCount ?? 
          Array.from(groupData?.importStats.importsFrom.values() || []).reduce((a, b) => a + b, 0)
      };
    })
  }));

  // 映射 violations 并计算 severity
  // C8-10决议: 使用 layerGap（而非 expectedLayerGap）
  const violations: CLILayerViolation[] = api.violations.map(v => ({
    fromGroup: v.fromGroup,
    toGroup: v.toGroup,
    count: v.count,
    affectedFiles: v.affectedFiles.map(pair => ({
      from: pair.split(' → ')[0],
      to: pair.split(' → ')[1]
    })),
    severity: calculateSeverity(v.layerGap),  // C8-10: 使用 layerGap
    suggestion: generateViolationSuggestion(v)
  }));

  // 构建 groups 摘要
  const groupSummaries: CLIGroupSummary[] = [];
  for (const layer of api.layers) {
    for (const groupName of layer.groups) {
      const groupData = groups.get(groupName);
      if (groupData) {
        const importedBy = Array.from(groupData.importStats.importedBy.values())
          .reduce((a, b) => a + b, 0);
        const importsFrom = Array.from(groupData.importStats.importsFrom.values())
          .reduce((a, b) => a + b, 0);
        groupSummaries.push({
          name: groupName,
          assignedLayer: layer.layer,
          netScore: importedBy - importsFrom
        });
      }
    }
  }

  // 生成 warnings
  const warnings: string[] = [];
  if (violations.length > 0) {
    warnings.push(`${violations.length} layer violations detected`);
  }

  return {
    success: true,
    layers,
    violations,
    healthScore: api.healthScore,
    groups: groupSummaries,
    durationMs,
    warnings,
    nextSuggested: violations.length > 0 
      ? [`codegraph scope FILE:${violations[0].affectedFiles[0].from}`]
      : []
  };
}

function calculateSeverity(gap: number): 'minor' | 'moderate' | 'critical' {
  if (gap >= 3) return 'critical';
  if (gap === 2) return 'moderate';
  return 'minor';
}

function generateViolationSuggestion(v: LayerViolation): string {
  const fromLayer = v.fromGroup;
  const toLayer = v.toGroup;
  
  // C8-10: 使用 layerGap（而非 expectedLayerGap）
  if (v.layerGap >= 3) {
    return `Critical violation: ${fromLayer} (lower layer) imports from ${toLayer} (higher layer). Consider restructuring architecture`;
  }
  if (v.layerGap === 2) {
    return `Move shared logic from ${toLayer} to ${fromLayer}, or create a shared middle layer`;
  }
  return `Consider moving the importing file to ${toLayer} directory`;
}
```

### 9.3 错误映射

**impact 命令错误映射**:
```typescript
function mapImpactErrorToCLI(
  target: string,
  errorCode: keyof typeof CLIErrorCodes,
  durationMs: number
): CLIError {
  const suggestions: Record<string, string> = {
    E001_TARGET_NOT_FOUND: 'Run `codegraph analyze` to build graph first',
    E003_NO_IMPACT: 'File may be isolated - check with `codegraph scope`',
  };

  return {
    success: false,
    error: {
      code: errorCode,
      message: CLIErrorCodes[errorCode],
      suggestion: suggestions[errorCode]
    },
    durationMs
  };
}
```

**layers 命令错误映射**:
```typescript
function mapLayersErrorToCLI(
  errorCode: keyof typeof CLIErrorCodes,
  durationMs: number
): CLIError {
  const suggestions: Record<string, string> = {
    E004_NO_LAYERS: 'Project may have flat structure or no import relationships',
    E005_EMPTY_GRAPH: 'Run `codegraph analyze` with valid source directory',
  };

  return {
    success: false,
    error: {
      code: errorCode,
      message: CLIErrorCodes[errorCode],
      suggestion: suggestions[errorCode]
    },
    durationMs
  };
}
```

### 9.4 Exit Codes

> **C8-7决议**: 错误码体系与 C6 附录 A 对齐，扩展 E003-E005。

**错误码扩展定义** (与 C6 对齐):
```typescript
const CLIErrorCodes = {
  // C6基础错误码（继承）
  E001_TARGET_NOT_FOUND: 'Target node not found in graph',
  E002_PARSE_ERROR: 'Failed to parse baseline data',
  
  // C8扩展错误码
  E003_NO_IMPACT: 'No dependents found for target',
  E004_NO_LAYERS: 'No architecture layers could be inferred',
  E005_EMPTY_GRAPH: 'Graph contains no FILE nodes',
};
```

**Exit Codes**:

| Exit Code | 含义 | 触发场景 |
|-----------|------|---------|
| 0 | 成功 | 命令正常执行完成 |
| 1 | 一般错误 | 空图、无法推断层级等 |
| 2 | 目标不存在 | impact 查询的目标未找到 |

---

**文档版本**: v1.2  
**创建日期**: 2026-05-02  
**更新日期**: 2026-05-03  
**更新说明**: 消除12个开发歧义（详见c8_ambiguity_resolution.md）
**用途**: Change 8 (`cg-api-impact-layers`) 实现参考 + Change 10 CLI 输出映射参考