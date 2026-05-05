# 方案D 防御设计方案

> Blue Team 专家设计的具体可落地算法

---

## Phase 1: Source Root Discovery（源码根目录自动发现）

### 算法设计

```typescript
/**
 * Source Root Discovery Algorithm
 *
 * 自动发现源码根目录，无需用户显式指定。
 */

interface SourceRootCandidate {
  path: string;
  score: number;
  signals: SignalMatch[];
}

interface SignalMatch {
  type: SignalType;
  weight: number;
  matched: boolean;
  detail?: string;
}

type SignalType =
  | 'PACKAGE_JSON'
  | 'TS_CONFIG'
  | 'JS_CONFIG'
  | 'TYPICAL_DIR'       // src, lib, app, packages/*
  | 'SOURCE_FILES'      // .ts/.tsx/.js/.jsx 文件密度
  | 'GITIGNORE_PATTERN' // .gitignore 排除 pattern
  | 'NO_DIST_BUILD'     // 无 dist/build 目录
  | 'NO_NODE_MODULES';  // 无 node_modules

/**
 * Phase 1: Signal Detection (信号检测)
 */
function detectSignals(projectRoot: string): SignalMatch[] {
  const signals: SignalMatch[] = [];
  
  // 1. Package.json 检测
  signals.push({
    type: 'PACKAGE_JSON',
    weight: 10,
    matched: existsSync(join(projectRoot, 'package.json')),
    detail: 'package.json 存在表明项目根目录'
  });
  
  // 2. TypeScript 配置
  const tsConfigs = ['tsconfig.json', 'tsconfig.build.json'];
  const hasTsConfig = tsConfigs.some(f => existsSync(join(projectRoot, f)));
  signals.push({
    type: 'TS_CONFIG',
    weight: 8,
    matched: hasTsConfig,
    detail: 'TypeScript 配置文件表明源码项目'
  });
  
  // 3. 典型源码目录
  const typicalDirs = ['src', 'lib', 'app', 'source', 'sources'];
  const foundTypical = typicalDirs.filter(d => {
    const fullPath = join(projectRoot, d);
    return isDirectory(fullPath) && hasSourceFiles(fullPath);
  });
  
  if (foundTypical.length > 0) {
    signals.push({
      type: 'TYPICAL_DIR',
      weight: 15, // 高权重，典型目录是最强信号
      matched: true,
      detail: `发现典型源码目录: ${foundTypical.join(', ')}`
    });
  }
  
  // 4. 源码文件密度
  const sourceFiles = findSourceFiles(projectRoot, 1); // 仅第一层
  const density = sourceFiles.length;
  
  signals.push({
    type: 'SOURCE_FILES',
    weight: Math.min(density, 10), // 每个文件+1，最高10
    matched: density > 0,
    detail: `第一层发现 ${density} 个源码文件`
  });
  
  // 5. 排除 build 输出目录（负信号）
  const buildDirs = ['dist', 'build', 'out', 'output', '.next', '.nuxt'];
  const hasBuildDir = buildDirs.some(d => existsSync(join(projectRoot, d)));
  
  signals.push({
    type: 'NO_DIST_BUILD',
    weight: -5, // 负权重，存在则扣分
    matched: !hasBuildDir,
    detail: hasBuildDir ? `存在构建目录，扣分` : '无构建目录'
  });
  
  // 6. 排除 node_modules（强负信号）
  const hasNodeModules = existsSync(join(projectRoot, 'node_modules'));
  
  signals.push({
    type: 'NO_NODE_MODULES',
    weight: -20, // 强负权重
    matched: !hasNodeModules,
    detail: hasNodeModules ? '存在 node_modules，强扣分' : '无 node_modules'
  });
  
  return signals;
}

/**
 * Phase 2: Candidate Scoring (候选评分)
 */
function calculateCandidateScore(signals: SignalMatch[]): number {
  let score = 0;
  
  for (const signal of signals) {
    if (signal.matched) {
      score += signal.weight;
    }
  }
  
  // 归一化到 0-100
  return Math.max(0, Math.min(100, score));
}

/**
 * Phase 3: Multi-level Discovery (多层发现)
 */
function discoverSourceRoots(projectRoot: string): SourceRootCandidate[] {
  const candidates: SourceRootCandidate[] = [];
  
  // 3.1 检查项目根目录自身
  const rootSignals = detectSignals(projectRoot);
  const rootScore = calculateCandidateScore(rootSignals);
  
  if (rootScore >= 30) { // 阈值：30分以上才考虑
    candidates.push({
      path: projectRoot,
      score: rootScore,
      signals: rootSignals
    });
  }
  
  // 3.2 检查一级子目录
  const subdirs = getSubdirectories(projectRoot);
  
  for (const subdir of subdirs) {
    // 排除已知非源码目录
    if (isExcludedDirectory(subdir)) continue;
    
    const signals = detectSignals(subdir);
    const score = calculateCandidateScore(signals);
    
    if (score >= 30) {
      candidates.push({
        path: subdir,
        score: score,
        signals: signals
      });
    }
    
    // 3.3 深入检查典型目录（src, lib, app）
    if (isTypicalSourceDir(subdir)) {
      const deepCandidates = discoverDeepSourceRoots(subdir, 2);
      candidates.push(...deepCandidates);
    }
  }
  
  // 3.4 处理 monorepo：检查 packages/* 目录
  if (existsSync(join(projectRoot, 'packages'))) {
    const packagesDir = join(projectRoot, 'packages');
    const packageSubdirs = getSubdirectories(packagesDir);
    
    for (const pkgDir of packageSubdirs) {
      const signals = detectSignals(pkgDir);
      const score = calculateCandidateScore(signals);
      
      if (score >= 30) {
        // Monorepo 子包标记
        candidates.push({
          path: pkgDir,
          score: score,
          signals: [
            ...signals,
            { type: 'MONOREPO_PACKAGE', weight: 5, matched: true }
          ]
        });
      }
    }
  }
  
  return candidates;
}

/**
 * Phase 4: Selection Strategy (选择策略)
 */
function selectBestSourceRoot(
  candidates: SourceRootCandidate[],
  strategy: 'highest' | 'all' | 'prompt' = 'highest'
): string[] {
  
  if (candidates.length === 0) {
    return []; // 进入 fallback 流程
  }
  
  // 按分数排序
  candidates.sort((a, b) => b.score - a.score);
  
  switch (strategy) {
    case 'highest':
      // 选择最高分候选
      const best = candidates[0];
      
      // 如果有多个高分候选（分数差 <= 5），则标记为 "多候选场景"
      const similar = candidates.filter(c => Math.abs(c.score - best.score) <= 5);
      
      if (similar.length > 1) {
        // 返回所有相近分数候选，供后续 prompt 或聚合处理
        return similar.map(c => c.path);
      }
      
      return [best.path];
      
    case 'all':
      // 返回所有合格候选（>=30分）
      return candidates.map(c => c.path);
      
    case 'prompt':
      // 始终返回多个候选，触发 Agent prompt
      return candidates.slice(0, 3).map(c => c.path);
  }
}

/**
 * 典型源码目录判断
 */
function isTypicalSourceDir(dirPath: string): boolean {
  const basename = path.basename(dirPath);
  const typicalNames = ['src', 'lib', 'app', 'source', 'sources', 'core'];
  return typicalNames.includes(basename);
}

/**
 * 排除目录判断
 */
function isExcludedDirectory(dirPath: string): boolean {
  const basename = path.basename(dirPath);
  const excludedNames = [
    'node_modules', 'dist', 'build', 'out', 'output',
    '.git', '.github', '.vscode', '.idea',
    'test', 'tests', '__tests__', 'spec', 'specs',
    'docs', 'documentation', 'examples',
    'coverage', '.nyc_output',
    '.next', '.nuxt', 'public', 'static', 'assets'
  ];
  return excludedNames.includes(basename);
}

/**
 * 源码文件检测
 */
function hasSourceFiles(dirPath: string): boolean {
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.vue', '.svelte'];
  
  try {
    const files = readdirSync(dirPath);
    return files.some(f => {
      const ext = path.extname(f);
      return extensions.includes(ext);
    });
  } catch {
    return false;
  }
}
```

### Edge Case 处理

#### 场景 1: 无标准目录的项目
- **场景**: 项目无 `src`, `lib` 等标准目录，源码散落在根目录
- **策略**: 
  1. 检测根目录的源码文件密度
  2. 如果密度 >= 3 个文件，分数 +10
  3. 结合 `package.json` + `tsconfig.json` 信号
  4. 总分 >= 30 则选择根目录作为 sourceRoot
- **实现要点**: 
  ```typescript
  // 根目录源码文件密度检测
  const rootSourceFiles = findSourceFiles(projectRoot, 1);
  if (rootSourceFiles.length >= 3) {
    signals.push({
      type: 'ROOT_SOURCE_DENSITY',
      weight: 10,
      matched: true,
      detail: `根目录源码密度: ${rootSourceFiles.length}`
    });
  }
  ```

#### 场景 2: 多层嵌套目录
- **场景**: 源码在 `src/modules/core`, 需要选择合适的层级
- **策略**: 
  1. 使用"源码密度 + 导入结构"双重检测
  2. 深度探索：从 `src` 向下探索最多 2 层
  3. 选择第一层子目录数量最多且导入最密集的层级
- **实现要点**:
  ```typescript
  function discoverDeepSourceRoots(baseDir: string, maxDepth: number): SourceRootCandidate[] {
    if (maxDepth <= 0) return [];
    
    const candidates: SourceRootCandidate[] = [];
    const subdirs = getSubdirectories(baseDir);
    
    // 计算子目录层级密度
    const subdirCount = subdirs.length;
    if (subdirCount >= 5) {
      // 子目录多，可能是正确的层级
      const signals = detectSignals(baseDir);
      signals.push({
        type: 'SUBDIR_DENSITY',
        weight: subdirCount * 2, // 每个子目录 +2 分
        matched: true
      });
      candidates.push({ path: baseDir, score: calculateCandidateScore(signals), signals });
    }
    
    // 继续深入
    for (const subdir of subdirs) {
      const deep = discoverDeepSourceRoots(subdir, maxDepth - 1);
      candidates.push(...deep);
    }
    
    return candidates;
  }
  ```

#### 场景 3: Monorepo + 独立 src 并存
- **场景**: 项目有 `packages/*` (monorepo) 同时根目录有独立的 `src`
- **策略**:
  1. 分别评分：`packages/*` 每个子包独立评分
  2. 根目录 `src` 独立评分
  3. 返回所有高分候选（策略 'all'）
  4. 后续聚合处理：每个 sourceRoot 生成独立的 graph，然后合并
- **实现要点**:
  ```typescript
  // Monorepo 模式：返回多个 sourceRoot
  if (candidates.some(c => c.signals.some(s => s.type === 'MONOREPO_PACKAGE'))) {
    // 标记为 monorepo 模式
    return {
      sourceRoots: candidates.map(c => c.path),
      isMonorepo: true,
      aggregationStrategy: 'union' // 合并多个 graph
    };
  }
  ```

#### 场景 4: discoveredRoots 为空
- **场景**: 无法找到任何合格 sourceRoot（所有候选分数 < 30）
- **策略**: 
  1. 返回空数组
  2. 触发 Fallback Prompt（见 Phase 5）
  3. 提供诊断信息：为什么所有候选不合格
- **实现要点**:
  ```typescript
  if (candidates.length === 0) {
    return {
      sourceRoots: [],
      fallback: {
        reason: 'NO_QUALIFIED_CANDIDATE',
        diagnostics: [
          'No package.json found',
          'No typical source directory (src/lib.app)',
          'No TypeScript config',
          'Root source file density < 3'
        ],
        prompt: FALLBACK_PROMPT_TEMPLATE.noSourceRoot
      }
    };
  }
  ```

### 落地可行性评估
- **评分**: 9/10
- **需实现模块**:
  1. `SourceRootDetector` - 信号检测器
  2. `SignalRegistry` - 可扩展的信号注册表
  3. `CandidateScorer` - 候选评分器
  4. `SelectionStrategy` - 选择策略模块
  5. `MonorepoHandler` - Monorepo 特殊处理
- **实现复杂度**: 中等

---

## Phase 2: Dependency Score Calculation（依赖分数计算）

### 算法设计

```typescript
/**
 * Dependency Score Calculation Algorithm
 *
 * 处理循环依赖、外部依赖、动态导入、双向依赖。
 */

interface DependencyScore {
  node: string;
  rawImportedBy: number;
  rawImportsFrom: number;
  adjustedImportedBy: number;
  adjustedImportsFrom: number;
  netScore: number;
  cyclePenalty: number;
  dynamicImportPenalty: number;
}

interface ScoreAdjustment {
  type: 'cycle' | 'external' | 'dynamic' | 'reexport';
  penalty: number;
  affectedNodes: string[];
}

/**
 * Phase 1: Raw Count Collection（原始计数收集）
 */
function collectRawImportCounts(graph: CodeGraph): Map<string, DependencyScore> {
  const scores = new Map<string, DependencyScore>();
  
  for (const [nodeId, node] of graph.nodes) {
    if (node.type !== NodeType.FILE) continue;
    
    const importedByCount = countImportedByEdges(graph, nodeId);
    const importsFromCount = countImportsFromEdges(graph, nodeId);
    
    scores.set(nodeId, {
      node: nodeId,
      rawImportedBy: importedByCount,
      rawImportsFrom: importsFromCount,
      adjustedImportedBy: importedByCount,
      adjustedImportsFrom: importsFromCount,
      netScore: importedByCount - importsFromCount,
      cyclePenalty: 0,
      dynamicImportPenalty: 0
    });
  }
  
  return scores;
}

/**
 * Phase 2: Cycle Detection & Penalty（循环检测与惩罚）
 */
function detectCyclesAndApplyPenalty(
  scores: Map<string, DependencyScore>,
  graph: CodeGraph
): ScoreAdjustment[] {
  const adjustments: ScoreAdjustment[] = [];
  
  // 使用 DFS 检测循环
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];
  
  for (const [nodeId] of scores) {
    if (!visited.has(nodeId)) {
      detectCycleDFS(graph, nodeId, visited, recursionStack, cycles, []);
    }
  }
  
  // 对每个循环应用惩罚
  for (const cycle of cycles) {
    // 循环惩罚：每个循环成员扣减 netScore
    const penaltyPerMember = Math.ceil(cycle.length / 2); // 循环长度越大，惩罚越大
    
    for (const member of cycle) {
      const score = scores.get(member);
      if (score) {
        score.cyclePenalty += penaltyPerMember;
        score.adjustedImportedBy -= penaltyPerMember;
        score.netScore -= penaltyPerMember * 2; // 双向惩罚
      }
    }
    
    adjustments.push({
      type: 'cycle',
      penalty: penaltyPerMember * cycle.length,
      affectedNodes: cycle
    });
  }
  
  return adjustments;
}

/**
 * DFS 循环检测
 */
function detectCycleDFS(
  graph: CodeGraph,
  nodeId: string,
  visited: Set<string>,
  recursionStack: Set<string>,
  cycles: string[][],
  currentPath: string[]
): void {
  visited.add(nodeId);
  recursionStack.add(nodeId);
  currentPath.push(nodeId);
  
  // 获取导入目标（importsFrom）
  const importsFrom = graph.outEdges.get(nodeId) || [];
  
  for (const edge of importsFrom) {
    if (edge.type !== EdgeType.IMPORTS && edge.type !== EdgeType.RE_EXPORTS) continue;
    
    const target = edge.to;
    
    if (!visited.has(target)) {
      detectCycleDFS(graph, target, visited, recursionStack, cycles, currentPath);
    } else if (recursionStack.has(target)) {
      // 找到循环
      const cycleStart = currentPath.indexOf(target);
      const cycle = currentPath.slice(cycleStart);
      cycles.push(cycle);
    }
  }
  
  recursionStack.delete(nodeId);
  currentPath.pop();
}

/**
 * Phase 3: External Dependency Exclusion（外部依赖排除）
 */
function excludeExternalDependencies(
  scores: Map<string, DependencyScore>,
  graph: CodeGraph
): void {
  // 外部依赖节点不应计入分层计算
  for (const [nodeId, node] of graph.nodes) {
    if (node.type === NodeType.EXTERNAL) {
      scores.delete(nodeId); // 直接移除外部节点
    }
  }
  
  // 重新计算导入计数（排除指向 EXTERNAL 的边）
  for (const [nodeId, score] of scores) {
    const externalImports = countExternalImports(graph, nodeId);
    score.adjustedImportsFrom -= externalImports;
    score.netScore = score.adjustedImportedBy - score.adjustedImportsFrom;
  }
}

/**
 * Phase 4: Dynamic Import Handling（动态导入处理）
 */
function handleDynamicImports(
  scores: Map<string, DependencyScore>,
  graph: CodeGraph
): ScoreAdjustment[] {
  const adjustments: ScoreAdjustment[] = [];
  
  // 动态导入不计入 importedBy（因为运行时才确定）
  for (const edge of graph.edges) {
    if (edge.type !== EdgeType.DYNAMIC_IMPORTS) continue;
    
    const target = edge.to;
    const score = scores.get(target);
    
    if (score) {
      // 动态导入惩罚：降低 importedBy 计数
      score.dynamicImportPenalty += 1;
      score.adjustedImportedBy -= 1;
      score.netScore -= 1;
    }
  }
  
  // 记录调整
  const dynamicTargets = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.type === EdgeType.DYNAMIC_IMPORTS) {
      dynamicTargets.add(edge.to);
    }
  }
  
  if (dynamicTargets.size > 0) {
    adjustments.push({
      type: 'dynamic',
      penalty: dynamicTargets.size,
      affectedNodes: Array.from(dynamicTargets)
    });
  }
  
  return adjustments;
}

/**
 * Phase 5: Re-export De-duplication（重导出去重）
 */
function deDuplicateReExports(
  scores: Map<string, DependencyScore>,
  graph: CodeGraph
): void {
  // RE_EXPORTS 边不应重复计入导入关系
  // 例如: A imports B, B re-exports from C
  // A -> C 的依赖应通过 B 传递，而非直接
  
  for (const [nodeId, score] of scores) {
    const reExportsCount = countReExportEdges(graph, nodeId);
    
    // Re-export 的 importedBy 不应计入直接依赖
    score.adjustedImportedBy -= reExportsCount;
    score.netScore = score.adjustedImportedBy - score.adjustedImportsFrom;
  }
}

/**
 * 计算最终分数
 */
function calculateFinalScores(
  scores: Map<string, DependencyScore>
): Map<string, number> {
  const finalScores = new Map<string, number>();
  
  for (const [nodeId, score] of scores) {
    // 最终 netScore = 调整后 importedBy - 调整后 importsFrom
    finalScores.set(nodeId, score.netScore);
  }
  
  return finalScores;
}
```

### Edge Case 处理

#### 场景 1: 循环依赖处理
- **场景**: A → B → C → A 循环
- **策略**: 
  1. DFS 检测循环，记录所有循环成员
  2. 对每个循环成员应用惩罚：
     - 循环长度 3：每个成员扣 2 分
     - 循环长度 5+：每个成员扣 3 分
  3. 惩罚后重新排序，循环模块倾向于被分配到中间层（非 Foundation）
- **实现要点**:
  ```typescript
  // 循环惩罚公式
  const penaltyPerMember = Math.ceil(cycle.length / 2);
  // 循环长度 3: penalty = 2
  // 循环长度 4: penalty = 2
  // 循环长度 5: penalty = 3
  // 循环长度 6: penalty = 3
  ```

#### 场景 2: 外部依赖排除
- **场景**: 项目依赖 lodash、react 等
- **策略**: 
  1. EXTERNAL 类型节点完全排除
  2. 指向 EXTERNAL 的 IMPORTS 边不计入 importsFrom
  3. 分数计算仅基于内部模块关系
- **实现要点**:
  ```typescript
  // 统计外部导入
  function countExternalImports(graph: CodeGraph, nodeId: string): number {
    const outEdges = graph.outEdges.get(nodeId) || [];
    return outEdges.filter(e => 
      e.type === EdgeType.IMPORTS && e.to.startsWith('EXTERNAL:')
    ).length;
  }
  ```

#### 场景 3: 动态导入处理
- **场景**: `import('./module').then(...)` 动态导入
- **策略**:
  1. DYNAMIC_IMPORTS 边不计入 importedBy（运行时不确定）
  2. 动态导入目标获得 -1 惩罚（不确定性惩罚）
  3. 警告标记：动态导入目标层级不稳定
- **实现要点**:
  ```typescript
  // 动态导入惩罚
  score.dynamicImportPenalty += 1;
  score.adjustedImportedBy -= 1; // 不计入确定依赖
  score.netScore -= 1; // 不确定性惩罚
  ```

#### 场景 4: 双向依赖分数处理
- **场景**: A imports B, B imports A（同层互导）
- **策略**:
  1. 双向导入计入 "同层信号"
  2. 不作为违规，但记录为警告
  3. 分数处理：双向导入双方的 netScore 都为 0（无净差异）
  4. 合并到同一 Layer
- **实现要点**:
  ```typescript
  // 同层互导检测
  function detectMutualImports(graph: CodeGraph, groupA: string, groupB: string): boolean {
    const aToB = hasImportEdge(graph, groupA, groupB);
    const bToA = hasImportEdge(graph, groupB, groupA);
    return aToB && bToA;
  }
  
  // 同层互导不惩罚，仅警告
  if (mutualImport) {
    warnings.push(`Mutual import detected: ${groupA} <-> ${groupB} (same layer)`);
    // C8-11: Same-layer NOT violation
  }
  ```

### 落地可行性评估
- **评分**: 8/10
- **需实现模块**:
  1. `CycleDetector` - DFS 循环检测器
  2. `ScoreAdjustmentRegistry` - 分数调整策略注册表
  3. `ExternalDependencyFilter` - 外部依赖过滤器
  4. `DynamicImportHandler` - 动态导入处理器
  5. `ReExportDeDuplicator` - 重导出去重器
- **实现复杂度**: 中等

---

## Phase 3: Adaptive Depth Selection（自适应深度选择）

### 算法设计

```typescript
/**
 * Adaptive Depth Selection Algorithm
 *
 * 根据项目规模自动选择合适的分层深度。
 */

interface DepthConfig {
  minFiles: number;
  maxFiles: number;
  suggestedDepth: number;
  threshold: number;
}

interface AdaptiveDepthResult {
  selectedDepth: number;
  threshold: number;
  reasoning: string;
  projectSize: 'small' | 'medium' | 'large' | 'enterprise';
}

/**
 * 预设深度配置表
 *
 * WHY 这些阈值：
 * - 50: 小项目阈值 - 小于50文件通常结构简单，无需复杂分层
 * - 200: 中项目阈值 - 200+文件开始出现多层级依赖
 * - 500: 大项目阈值 - 500+文件需要更细粒度的分层
 * - 2000+: 企业级 - 需要更深的分层控制
 */
const DEPTH_PRESETS: DepthConfig[] = [
  { minFiles: 0,    maxFiles: 50,   suggestedDepth: 1, threshold: 5 },  // 小项目
  { minFiles: 51,   maxFiles: 200,  suggestedDepth: 2, threshold: 3 },  // 中项目
  { minFiles: 201,  maxFiles: 500,  suggestedDepth: 3, threshold: 2 },  // 大项目
  { minFiles: 501,  maxFiles: 2000, suggestedDepth: 4, threshold: 1 },  // 企业级
  { minFiles: 2001, maxFiles: Infinity, suggestedDepth: 5, threshold: 1 }, // 超大规模
];

/**
 * Phase 1: Project Size Detection（项目规模检测）
 */
function detectProjectSize(
  graph: CodeGraph,
  sourceRoots: string[]
): { totalFiles: number; projectSize: string } {
  
  let totalFiles = 0;
  
  for (const root of sourceRoots) {
    for (const [nodeId, node] of graph.nodes) {
      if (node.type === NodeType.FILE && nodeId.startsWith(`FILE:${root}`)) {
        totalFiles++;
      }
    }
  }
  
  // 分类项目规模
  let projectSize: 'small' | 'medium' | 'large' | 'enterprise';
  
  if (totalFiles <= 50) {
    projectSize = 'small';
  } else if (totalFiles <= 200) {
    projectSize = 'medium';
  } else if (totalFiles <= 500) {
    projectSize = 'large';
  } else {
    projectSize = 'enterprise';
  }
  
  return { totalFiles, projectSize };
}

/**
 * Phase 2: Depth Selection（深度选择）
 */
function selectAdaptiveDepth(
  totalFiles: number,
  projectSize: string
): AdaptiveDepthResult {
  
  // 查找匹配的预设
  const preset = DEPTH_PRESETS.find(
    p => totalFiles >= p.minFiles && totalFiles <= p.maxFiles
  ) || DEPTH_PRESETS[DEPTH_PRESETS.length - 1]; // 默认最大
  
  // 计算实际深度（考虑子目录层级）
  const actualDepth = Math.min(preset.suggestedDepth, 5); // 最大 5 层
  
  // 生成推理说明
  const reasoning = generateDepthReasoning(totalFiles, preset, projectSize);
  
  return {
    selectedDepth: actualDepth,
    threshold: preset.threshold,
    reasoning,
    projectSize: projectSize as 'small' | 'medium' | 'large' | 'enterprise'
  };
}

/**
 * Phase 3: Per-SourceRoot Adjustment（按 sourceRoot 调整）
 *
 * 处理同一项目不同包规模差异。
 */
function adjustDepthPerSourceRoot(
  graph: CodeGraph,
  sourceRoots: string[]
): Map<string, AdaptiveDepthResult> {
  
  const results = new Map<string, AdaptiveDepthResult>();
  
  for (const root of sourceRoots) {
    // 每个 sourceRoot 独立计算规模
    const { totalFiles, projectSize } = detectProjectSize(graph, [root]);
    
    // 独立选择深度
    const depthResult = selectAdaptiveDepth(totalFiles, projectSize);
    
    results.set(root, depthResult);
  }
  
  return results;
}

/**
 * Phase 4: Monorepo Aggregation（Monorepo 聚合）
 */
function aggregateMonorepoDepths(
  perRootResults: Map<string, AdaptiveDepthResult>
): AdaptiveDepthResult {
  
  // 取所有 sourceRoot 的最大深度
  let maxDepth = 0;
  let minThreshold = Infinity;
  let totalFiles = 0;
  
  for (const [, result] of perRootResults) {
    maxDepth = Math.max(maxDepth, result.selectedDepth);
    minThreshold = Math.min(minThreshold, result.threshold);
    // totalFiles 在聚合时不累加（每个包独立分层）
  }
  
  return {
    selectedDepth: maxDepth,
    threshold: minThreshold,
    reasoning: `Monorepo aggregation: max depth=${maxDepth}, min threshold=${minThreshold}`,
    projectSize: 'enterprise'
  };
}

/**
 * 生成深度选择推理说明
 */
function generateDepthReasoning(
  totalFiles: number,
  preset: DepthConfig,
  projectSize: string
): string {
  return [
    `Project size: ${projectSize} (${totalFiles} files)`,
    `Selected depth: ${preset.suggestedDepth} layers`,
    `Score threshold: ${preset.threshold} (groups with score diff > ${preset.threshold} start new layer)`,
    `Reasoning: ${getDepthReasonText(projectSize)}`
  ].join('\n');
}

function getDepthReasonText(projectSize: string): string {
  switch (projectSize) {
    case 'small':
      return 'Small projects typically have simple dependency structure. Single layer suffices.';
    case 'medium':
      return 'Medium projects need 2-3 layers to distinguish foundation from application.';
    case 'large':
      return 'Large projects require granular layer separation for maintainability.';
    case 'enterprise':
      return 'Enterprise-scale projects need deep layer hierarchy with strict enforcement.';
    default:
      return 'Standard depth applied.';
  }
}
```

### Edge Case 处理

#### 场景 1: 同项目不同包差异
- **场景**: Monorepo 中 packages/ui 有 10 文件，packages/core 有 200 文件
- **策略**:
  1. 每个 sourceRoot 独立计算深度
  2. packages/ui → depth=1（小项目）
  3. packages/core → depth=3（大项目）
  4. 聚合时取最大值（但不强制统一）
- **实现要点**:
  ```typescript
  // 每个 sourceRoot 独立分层
  const perRootDepths = adjustDepthPerSourceRoot(graph, sourceRoots);
  
  // 不强制统一深度，允许各包有不同层级
  for (const [root, depth] of perRootDepths) {
    console.log(`${root}: ${depth.selectedDepth} layers (threshold=${depth.threshold})`);
  }
  ```

#### 场景 2: 边界值处理
- **场景**: 项目刚好 50 文件（边界值）
- **策略**:
  1. 边界值使用 >= 判断，50 文件归入 "medium"
  2. 提供配置覆盖：用户可显式指定深度
  3. 边界文件项目的分数差异更敏感（使用较小 threshold）
- **实现要点**:
  ```typescript
  // 边界处理：51 才进入 medium，50 仍为 small
  if (totalFiles >= 51 && totalFiles <= 200) {
    projectSize = 'medium';
  }
  
  // 但提供用户配置覆盖
  if (options?.forceDepth) {
    return {
      selectedDepth: options.forceDepth,
      threshold: options.forceThreshold ?? 2,
      reasoning: 'User-configured depth override',
      projectSize
    };
  }
  ```

#### 场景 3: 超大规模项目
- **场景**: 项目 5000+ 文件
- **策略**:
  1. 最大深度限制为 5（防止过度分层）
  2. 使用最小 threshold=1（严格分层）
  3. 警告：超大规模可能需要人工干预
- **实现要点**:
  ```typescript
  if (totalFiles > 2000) {
    warnings.push('Ultra-large project (2000+ files). Consider manual layer configuration.');
    
    return {
      selectedDepth: 5, // 最大深度
      threshold: 1,     // 最严格
      reasoning: 'Ultra-large project. Maximum depth enforced.',
      projectSize: 'enterprise'
    };
  }
  ```

### 落地可行性评估
- **评分**: 10/10（完全自动化，无复杂依赖）
- **需实现模块**:
  1. `ProjectSizeDetector` - 项目规模检测器
  2. `DepthPresetRegistry` - 预设配置注册表
  3. `PerRootDepthCalculator` - 按源码根深度计算器
  4. `MonorepoDepthAggregator` - Monorepo 深度聚合器
- **实现复杂度**: 简单

---

## Phase 4: Layer Assignment（分层赋值优化）

### 算法设计

```typescript
/**
 * Layer Assignment Algorithm
 *
 * 动态阈值调整、相近分数 fallback、Layer role 可配置化。
 */

interface LayerAssignmentConfig {
  dynamicThreshold: boolean;
  roleNames: Record<number, string>;
  maxLayers: number;
  adjacentMergeThreshold: number; // 相邻分数合并阈值
  fuzzyMatchThreshold: number;    // 模糊匹配阈值
}

interface AssignedLayer {
  layer: number;
  role: string;
  groups: GroupAssignment[];
  confidence: number; // 0-1 分层置信度
}

interface GroupAssignment {
  name: string;
  score: number;
  layerReason: string;
}

const DEFAULT_LAYER_CONFIG: LayerAssignmentConfig = {
  dynamicThreshold: true,
  roleNames: {
    1: 'Foundation',
    2: 'Core',
    3: 'Application',
    4: 'Presentation',
    5: 'Integration'
  },
  maxLayers: 5,
  adjacentMergeThreshold: 2,
  fuzzyMatchThreshold: 5
};

/**
 * Phase 1: Dynamic Threshold Calculation（动态阈值计算）
 */
function calculateDynamicThreshold(
  scores: number[],
  projectSize: 'small' | 'medium' | 'large' | 'enterprise'
): number {
  
  // 计算分数分布统计
  const sortedScores = [...scores].sort((a, b) => b - a);
  const maxScore = sortedScores[0];
  const minScore = sortedScores[sortedScores.length - 1];
  const scoreRange = maxScore - minScore;
  
  // 根据项目规模和分数范围动态调整阈值
  let baseThreshold: number;
  
  switch (projectSize) {
    case 'small':
      // 小项目：宽松阈值，避免过度分层
      baseThreshold = Math.max(scoreRange * 0.3, 3);
      break;
    case 'medium':
      baseThreshold = Math.max(scoreRange * 0.2, 2);
      break;
    case 'large':
      baseThreshold = Math.max(scoreRange * 0.15, 2);
      break;
    case 'enterprise':
      // 企业级：严格阈值，精细分层
      baseThreshold = Math.max(scoreRange * 0.1, 1);
      break;
  }
  
  return Math.min(baseThreshold, 10); // 最大阈值 10
}

/**
 * Phase 2: Layer Assignment with Fuzzy Matching（模糊匹配分层）
 */
function assignLayersWithFuzzyMatching(
  groupScores: Map<string, number>,
  config: LayerAssignmentConfig,
  dynamicThreshold: number
): AssignedLayer[] {
  
  const layers: AssignedLayer[] = [];
  const sortedGroups = [...groupScores.entries()].sort((a, b) => b[1] - a[1]);
  
  let currentLayer = 1;
  let currentLayerGroups: GroupAssignment[] = [];
  let prevScore = sortedGroups[0]?.[1] ?? 0;
  let confidenceSum = 0;
  
  for (const [groupName, score] of sortedGroups) {
    const scoreDiff = Math.abs(score - prevScore);
    
    // 决策：是否开始新层
    let shouldStartNewLayer = false;
    let confidence = 1.0;
    
    if (currentLayerGroups.length > 0) {
      // 模糊匹配决策
      if (scoreDiff > dynamicThreshold) {
        // 明确超出阈值：高置信度新层
        shouldStartNewLayer = true;
        confidence = 0.9;
      } else if (scoreDiff > config.adjacentMergeThreshold) {
        // 在阈值与合并阈值之间：中等置信度
        // 使用 fallback：根据分数差距决定
        const gapRatio = scoreDiff / dynamicThreshold;
        
        if (gapRatio > 0.7) {
          // 较接近阈值：开始新层
          shouldStartNewLayer = true;
          confidence = 0.6;
        } else {
          // 较远离阈值：合并到当前层
          shouldStartNewLayer = false;
          confidence = 0.7;
        }
      } else {
        // 小差距：合并到当前层
        shouldStartNewLayer = false;
        confidence = 0.8;
      }
    }
    
    // 应用决策
    if (shouldStartNewLayer && currentLayer < config.maxLayers) {
      layers.push({
        layer: currentLayer,
        role: config.roleNames[currentLayer] || `Layer ${currentLayer}`,
        groups: currentLayerGroups,
        confidence: confidenceSum / currentLayerGroups.length
      });
      
      currentLayer++;
      currentLayerGroups = [];
      confidenceSum = 0;
    }
    
    currentLayerGroups.push({
      name: groupName,
      score: score,
      layerReason: generateLayerReason(score, prevScore, scoreDiff, shouldStartNewLayer)
    });
    
    confidenceSum += confidence;
    prevScore = score;
  }
  
  // 添加最后一层
  if (currentLayerGroups.length > 0) {
    layers.push({
      layer: currentLayer,
      role: config.roleNames[currentLayer] || `Layer ${currentLayer}`,
      groups: currentLayerGroups,
      confidence: confidenceSum / currentLayerGroups.length
    });
  }
  
  return layers;
}

/**
 * Phase 3: Layer Role Customization（层级角色自定义）
 */
function customizeLayerRoles(
  layers: AssignedLayer[],
  customRoles: Record<number, string> | undefined
): AssignedLayer[] {
  
  if (!customRoles) return layers;
  
  return layers.map(layer => ({
    ...layer,
    role: customRoles[layer.layer] || layer.role
  }));
}

/**
 * Phase 4: Confidence-Based Fallback（置信度回退）
 */
function applyConfidenceFallback(
  layers: AssignedLayer[]
): { layers: AssignedLayer[]; fallbackTriggered: boolean; reason?: string } {
  
  // 检查低置信度层
  const lowConfidenceLayers = layers.filter(l => l.confidence < 0.5);
  
  if (lowConfidenceLayers.length > 0) {
    // 回退策略：合并低置信度层到相邻层
    const mergedLayers = mergeLowConfidenceLayers(layers);
    
    return {
      layers: mergedLayers,
      fallbackTriggered: true,
      reason: `Low confidence detected in ${lowConfidenceLayers.length} layers. Merged to improve stability.`
    };
  }
  
  return {
    layers,
    fallbackTriggered: false
  };
}

/**
 * 合并低置信度层
 */
function mergeLowConfidenceLayers(layers: AssignedLayer[]): AssignedLayer[] {
  const result: AssignedLayer[] = [];
  
  for (const layer of layers) {
    if (layer.confidence < 0.5) {
      // 合并到前一层（如果存在）
      const prevLayer = result[result.length - 1];
      
      if (prevLayer) {
        prevLayer.groups.push(...layer.groups);
        // 更新置信度
        prevLayer.confidence = Math.min(prevLayer.confidence, layer.confidence + 0.2);
      } else {
        // 无前层，保留原层
        result.push(layer);
      }
    } else {
      result.push(layer);
    }
  }
  
  return result;
}

/**
 * 生成分层原因说明
 */
function generateLayerReason(
  score: number,
  prevScore: number,
  scoreDiff: number,
  isNewLayer: boolean
): string {
  if (isNewLayer) {
    return `Score gap ${scoreDiff} > threshold → new layer`;
  } else {
    if (scoreDiff <= 2) {
      return `Score ${score} close to prev ${prevScore} → same layer`;
    } else {
      return `Score ${score} merged with prev (below threshold)`;
    }
  }
}
```

### Edge Case 处理

#### 场景 1: threshold 动态调整
- **场景**: 项目分数范围很小（所有分数在 -5 到 +5 之间）
- **策略**:
  1. 动态阈值基于分数范围百分比
  2. scoreRange=10, threshold=max(10*0.2, 2)=2
  3. 如果 scoreRange=3（极小），threshold=max(3*0.2, 2)=2（最小 2）
- **实现要点**:
  ```typescript
  // 动态阈值最小值保护
  const MIN_THRESHOLD = 2;
  const MAX_THRESHOLD = 10;
  
  baseThreshold = Math.max(scoreRange * 0.2, MIN_THRESHOLD);
  baseThreshold = Math.min(baseThreshold, MAX_THRESHOLD);
  ```

#### 场景 2: 相近分数 fallback
- **场景**: Group A score=5, Group B score=7, threshold=3
- **策略**:
  1. scoreDiff=2 < threshold=3 → 不明确
  2. 计算差距比率：2/3 = 0.67
  3. 0.67 > 0.7 → 不满足，合并到当前层
  4. 置信度 = 0.7（中等）
- **实现要点**:
  ```typescript
  const gapRatio = scoreDiff / threshold;
  
  if (gapRatio > 0.7) {
    // 较接近阈值：倾向于新层
    shouldStartNewLayer = true;
    confidence = 0.6;
  } else {
    // 较远离阈值：合并
    shouldStartNewLayer = false;
    confidence = 0.7;
  }
  ```

#### 场景 3: Layer role 可配置化
- **场景**: 用户希望自定义层级名称（如 "Infrastructure" 替代 "Foundation"）
- **策略**:
  1. 配置文件支持 `layerRoles` 字段
  2. 合并用户配置与默认配置
  3. 未配置的层级使用默认名称
- **实现要点**:
  ```typescript
  // 配置文件格式
  const config: LayerAssignmentConfig = {
    ...DEFAULT_LAYER_CONFIG,
    roleNames: {
      1: 'Infrastructure', // 用户自定义
      2: 'Domain',         // 用户自定义
      3: DEFAULT_LAYER_CONFIG.roleNames[3], // 使用默认 'Application'
    }
  };
  ```

### 落地可行性评估
- **评分**: 9/10
- **需实现模块**:
  1. `DynamicThresholdCalculator` - 动态阈值计算器
  2. `FuzzyLayerAssigner` - 模糊分层器
  3. `LayerRoleCustomizer` - 层级角色自定义器
  4. `ConfidenceTracker` - 置信度追踪器
  5. `LayerMergeStrategy` - 层合并策略
- **实现复杂度**: 中等

---

## Phase 5: Fallback & Suggestions（回退和建议系统）

### 算法设计

```typescript
/**
 * Fallback & Suggestions System
 *
 * Agent prompt 模板、降级方案、空项目处理。
 */

// ============================================================================
// Fallback Prompt Templates
// ============================================================================

const FALLBACK_PROMPT_TEMPLATES = {
  noSourceRoot: `
## Source Root Discovery Failed

I couldn't automatically discover source code roots in this project.

**Diagnostics:**
${diagnostics.map(d => `- ${d}`).join('\n')}

**Please help by:**
1. Confirming the source code location (e.g., "src/", "lib/")
2. Or running \`codegraph analyze --source-root <path>\` manually

**Suggested paths to check:**
${suggestedPaths.map(p => `- ${p}`).join('\n')}
`,

  emptyGraph: `
## Empty Graph Detected

The CodeGraph contains no FILE nodes.

**Possible reasons:**
- Project hasn't been analyzed yet
- Source files not found
- Parser errors prevented node creation

**Please help by:**
1. Running \`codegraph analyze\` first
2. Checking if source directory exists
3. Verifying file extensions match expected types (.ts, .js, etc.)
`,

  lowConfidenceLayers: `
## Low Layer Assignment Confidence

Some layer assignments have low confidence (< 0.5).

**Affected groups:**
${lowConfidenceGroups.map(g => `- ${g.name} (confidence: ${g.confidence})`).join('\n')}

**Please help by:**
1. Reviewing the suggested layers above
2. Confirming if the grouping matches your architecture
3. Optionally configuring explicit layer assignments in \`.codegraph/config.json\`
`,

  cycleDetected: `
## Circular Dependencies Detected

${cycles.length} circular dependency chain(s) found.

**Affected modules:**
${cycles.map(c => `- Cycle: ${c.join(' → ')}`).join('\n')}

**Impact:**
- Layer assignment may be unstable for cycle members
- Architecture violations may occur

**Please help by:**
1. Breaking circular dependencies where possible
2. Using dependency injection to invert control
3. Confirming if cycles are intentional (same-layer mutual imports)
`,
};

// ============================================================================
// Agent Execution Strategy
// ============================================================================

interface FallbackPrompt {
  template: keyof typeof FALLBACK_PROMPT_TEMPLATES;
  diagnostics: string[];
  suggestedPaths?: string[];
  lowConfidenceGroups?: Array<{ name: string; confidence: number }>;
  cycles?: string[][];
}

interface AgentExecutionResult {
  executed: boolean;
  userResponse?: string;
  actionTaken?: string;
  timeoutMs?: number;
}

/**
 * Phase 1: Fallback Trigger Detection（回退触发检测）
 */
function detectFallbackTriggers(
  layersResult: LayersResult,
  sourceRoots: string[],
  scores: Map<string, DependencyScore>
): FallbackPrompt[] {
  
  const prompts: FallbackPrompt[] = [];
  
  // Trigger 1: No source roots discovered
  if (sourceRoots.length === 0) {
    prompts.push({
      template: 'noSourceRoot',
      diagnostics: [
        'No package.json found',
        'No typical source directory (src, lib, app)',
        'Root directory has no source files'
      ],
      suggestedPaths: ['src/', 'lib/', 'app/', 'packages/*/src/']
    });
  }
  
  // Trigger 2: Empty graph
  if (!layersResult.success || layersResult.layers.length === 0) {
    prompts.push({
      template: 'emptyGraph',
      diagnostics: ['Graph contains no FILE nodes']
    });
  }
  
  // Trigger 3: Low confidence layers
  const lowConfidenceLayers = layersResult.layers?.filter(l => l.confidence < 0.5) || [];
  if (lowConfidenceLayers.length > 0) {
    prompts.push({
      template: 'lowConfidenceLayers',
      diagnostics: ['Layer assignment confidence below threshold'],
      lowConfidenceGroups: lowConfidenceLayers.flatMap(l => 
        l.groups.map(g => ({ name: g.name, confidence: l.confidence }))
      )
    });
  }
  
  // Trigger 4: Cycles detected
  const cycles: string[][] = [];
  for (const [, score] of scores) {
    if (score.cyclePenalty > 0) {
      // 收集循环成员（简化）
      cycles.push([score.node]);
    }
  }
  
  if (cycles.length > 0) {
    prompts.push({
      template: 'cycleDetected',
      diagnostics: [`Detected ${cycles.length} cycles`],
      cycles
    });
  }
  
  return prompts;
}

/**
 * Phase 2: Agent Prompt Execution（Agent Prompt 执行）
 */
async function executeFallbackPrompt(
  prompt: FallbackPrompt,
  timeoutMs: number = 30000
): Promise<AgentExecutionResult> {
  
  const template = FALLBACK_PROMPT_TEMPLATES[prompt.template];
  
  // 构建完整 prompt 内容
  const content = buildPromptContent(template, prompt);
  
  try {
    // 发送 prompt 到 Agent/用户
    // 实际实现取决于 Agent 框架
    const response = await sendToAgent(content, timeoutMs);
    
    return {
      executed: true,
      userResponse: response,
      actionTaken: parseAgentResponse(response)
    };
  } catch (error) {
    // Agent 未响应或超时
    return {
      executed: false,
      timeoutMs,
      actionTaken: applyDefaultFallback(prompt)
    };
  }
}

/**
 * Phase 3: Default Fallback Strategy（默认降级策略）
 */
function applyDefaultFallback(prompt: FallbackPrompt): string {
  
  switch (prompt.template) {
    case 'noSourceRoot':
      // 默认使用当前目录作为 sourceRoot
      return 'Defaulted to current directory as sourceRoot';
      
    case 'emptyGraph':
      // 默认跳过分层分析
      return 'Skipped layer analysis (empty graph)';
      
    case 'lowConfidenceLayers':
      // 默认合并低置信度层
      return 'Merged low-confidence layers to adjacent layers';
      
    case 'cycleDetected':
      // 默认标记循环但不处理
      return 'Marked cycles as warnings (no automatic fix)';
      
    default:
      return 'Applied generic fallback';
  }
}

/**
 * Phase 4: Edge Case Handlers（边缘情况处理器）
 */

// 空项目处理
function handleEmptyProject(): LayersResult {
  return {
    success: false,
    layers: [],
    violations: [],
    healthScore: 0,
    groups: [],
    durationMs: 0,
    content: `
## Empty Project

No source files found in the specified directory.

**Suggested actions:**
1. Verify the source directory path
2. Check if project has .ts/.js files
3. Run \`codegraph analyze\` with correct parameters
`,
    warnings: ['Empty project - no layers to analyze'],
    nextSuggested: ['codegraph analyze --help']
  };
}

// 单文件项目处理
function handleSingleFileProject(filePath: string): LayersResult {
  return {
    success: true,
    layers: [{
      layer: 1,
      role: 'Single File',
      groups: [{
        name: path.basename(filePath),
        fileCount: 1,
        importedByCount: 0,
        importsFromCount: 0
      }],
      confidence: 1.0
    }],
    violations: [],
    healthScore: 100,
    groups: [{
      name: path.basename(filePath),
      assignedLayer: 1,
      netScore: 0
    }],
    durationMs: 0,
    content: `
## Single File Project

Only one source file detected: ${filePath}

**Layer assignment:** Single Layer (no dependencies to analyze)
`,
    warnings: ['Single file project - trivial layer structure']
  };
}

// 测试文件排除
function excludeTestFiles(graph: CodeGraph): CodeGraph {
  const testPatterns = [
    /\.test\.ts$/,
    /\.spec\.ts$/,
    /\.test\.tsx$/,
    /\.spec\.tsx$/,
    /__tests__\/.*\.ts$/,
    /__tests__\/.*\.tsx$/,
    /test\/.*\.ts$/,
    /tests\/.*\.ts$/,
  ];
  
  const filteredGraph = new CodeGraph();
  
  for (const [nodeId, node] of graph.nodes) {
    const filePath = nodeId.replace('FILE:', '');
    
    // 跳过测试文件
    if (testPatterns.some(p => p.test(filePath))) {
      continue;
    }
    
    filteredGraph.addNode(node);
  }
  
  // 复制边（排除涉及测试文件的边）
  for (const edge of graph.edges) {
    const fromPath = edge.from.replace('FILE:', '');
    const toPath = edge.to.replace('FILE:', '');
    
    if (testPatterns.some(p => p.test(fromPath) || p.test(toPath))) {
      continue;
    }
    
    filteredGraph.addEdge(edge);
  }
  
  return filteredGraph;
}

// 配置文件处理
function excludeConfigFiles(graph: CodeGraph): CodeGraph {
  const configPatterns = [
    /tsconfig\.json$/,
    /package\.json$/,
    /\.eslintrc/,
    /\.prettierrc/,
    /jest\.config/,
    /vite\.config/,
    /webpack\.config/,
    /rollup\.config/,
  ];
  
  // 同测试文件排除逻辑
  return filterGraphByPatterns(graph, configPatterns);
}

// Build 输出排除
function excludeBuildOutputs(graph: CodeGraph): CodeGraph {
  const buildPatterns = [
    /^dist\//,
    /^build\//,
    /^out\//,
    /^output\//,
    /^\.next\//,
    /^\.nuxt\//,
  ];
  
  return filterGraphByPatterns(graph, buildPatterns);
}

/**
 * 通用图过滤器
 */
function filterGraphByPatterns(
  graph: CodeGraph,
  patterns: RegExp[]
): CodeGraph {
  const filteredGraph = new CodeGraph();
  
  for (const [nodeId, node] of graph.nodes) {
    const filePath = nodeId.replace('FILE:', '');
    
    if (patterns.some(p => p.test(filePath))) {
      continue;
    }
    
    filteredGraph.addNode(node);
  }
  
  for (const edge of graph.edges) {
    const fromPath = edge.from.replace('FILE:', '');
    const toPath = edge.to.replace('FILE:', '');
    
    if (patterns.some(p => p.test(fromPath) || p.test(toPath))) {
      continue;
    }
    
    filteredGraph.addEdge(edge);
  }
  
  return filteredGraph;
}

/**
 * 构建完整 prompt 内容
 */
function buildPromptContent(
  template: string,
  prompt: FallbackPrompt
): string {
  let content = template;
  
  // 替换变量
  if (prompt.diagnostics) {
    content = content.replace('${diagnostics}', prompt.diagnostics.map(d => `- ${d}`).join('\n'));
  }
  
  if (prompt.suggestedPaths) {
    content = content.replace('${suggestedPaths}', prompt.suggestedPaths.map(p => `- ${p}`).join('\n'));
  }
  
  if (prompt.lowConfidenceGroups) {
    content = content.replace('${lowConfidenceGroups}', 
      prompt.lowConfidenceGroups.map(g => `- ${g.name} (confidence: ${g.confidence})`).join('\n'));
  }
  
  if (prompt.cycles) {
    content = content.replace('${cycles}', prompt.cycles.map(c => `- Cycle: ${c.join(' → ')}`).join('\n'));
  }
  
  return content;
}
```

### Edge Case 处理

#### 场景 1: discoveredRoots 为空
- **场景**: 无法发现任何源码根目录
- **策略**:
  1. 触发 `noSourceRoot` fallback prompt
  2. Agent 超时则使用默认降级：当前目录
  3. 提供诊断信息帮助用户定位问题
- **实现要点**:
  ```typescript
  if (sourceRoots.length === 0) {
    // Agent prompt 流程
    const prompt = {
      template: 'noSourceRoot',
      diagnostics: [...],
      suggestedPaths: ['src/', 'lib/', 'packages/*/']
    };
    
    const result = await executeFallbackPrompt(prompt, 30000);
    
    if (!result.executed) {
      // 降级：使用 cwd
      sourceRoots = [process.cwd()];
    }
  }
  ```

#### 场景 2: Agent 不执行
- **场景**: Agent 框架不可用或超时
- **策略**:
  1. 30 秒超时机制
  2. 超时后应用默认降级策略
  3. 记录日志：Agent 未响应，使用默认值
- **实现要点**:
  ```typescript
  try {
    const response = await sendToAgent(content, timeoutMs);
    return { executed: true, userResponse: response };
  } catch (timeoutError) {
    // 超时降级
    return {
      executed: false,
      timeoutMs,
      actionTaken: applyDefaultFallback(prompt)
    };
  }
  ```

#### 场景 3: 空项目/单文件项目
- **场景**: 项目无文件或仅一个文件
- **策略**:
  1. 空项目：返回空结果 + 帮助提示
  2. 单文件：返回单层结果 + trivial 警告
- **实现要点**:
  ```typescript
  const fileCount = countSourceFiles(graph);
  
  if (fileCount === 0) {
    return handleEmptyProject();
  }
  
  if (fileCount === 1) {
    const filePath = getSingleFilePath(graph);
    return handleSingleFileProject(filePath);
  }
  ```

#### 场景 4: 测试文件识别和排除
- **场景**: 项目包含大量测试文件，影响分层
- **策略**:
  1. 预过滤阶段排除测试文件
  2. 测试文件 pattern: `.test.ts`, `.spec.ts`, `__tests__/`
  3. 测试相关边也排除（测试导入不计入分层）
- **实现要点**:
  ```typescript
  // 在分层前预过滤
  const filteredGraph = excludeTestFiles(graph);
  const filteredGraph2 = excludeConfigFiles(filteredGraph);
  const filteredGraph3 = excludeBuildOutputs(filteredGraph2);
  
  // 使用过滤后的图进行分层
  const layers = getArchitectureLayers(filteredGraph3);
  ```

#### 场景 5: 配置文件处理
- **场景**: tsconfig.json、package.json 等不应分层
- **策略**:
  1. 配置文件 pattern 排除
  2. 配置文件不计入 FILE nodes
- **实现要点**:
  ```typescript
  const configPatterns = [
    /tsconfig\.json$/,
    /package\.json$/,
    /\.eslintrc/,
    /\.prettierrc/,
    ...
  ];
  ```

#### 场景 6: Build 输出排除
- **场景**: dist/、build/ 目录不应分层
- **策略**:
  1. 路径 pattern 排除
  2. Source Root Discovery 阶段已经扣分，但需要二次确认
- **实现要点**:
  ```typescript
  const buildPatterns = [
    /^dist\//,
    /^build\//,
    /^out\//,
    /^\.next\//,
    ...
  ];
  ```

### 落地可行性评估
- **评分**: 8/10
- **需实现模块**:
  1. `FallbackPromptRegistry` - 回退 prompt 注册表
  2. `AgentExecutor` - Agent 执行器（带超时）
  3. `DefaultFallbackStrategy` - 默认降级策略
  4. `EdgeCaseHandlerRegistry` - 边缘情况处理器注册表
  5. `GraphFilterer` - 图过滤器（测试/配置/build 排除）
- **实现复杂度**: 中等

---

## 总体落地可行性

| Phase | 评分 | 复杂度 | 关键模块数 |
|-------|------|--------|-----------|
| Phase 1: Source Root Discovery | 9/10 | 中等 | 5 |
| Phase 2: Dependency Score | 8/10 | 中等 | 5 |
| Phase 3: Adaptive Depth | 10/10 | 简单 | 4 |
| Phase 4: Layer Assignment | 9/10 | 中等 | 5 |
| Phase 5: Fallback & Edge Cases | 8/10 | 中等 | 5 |

**总体评分**: 8.6/10

**实现路径建议**:
1. Phase 3（自适应深度）最简单，可最先实现
2. Phase 5（Fallback）依赖其他 Phase，需最后实现
3. Phase 1-4 可并行开发，无强依赖

**预估总工作量**:
- 核心算法实现：约 20-30 个函数
- 测试覆盖（TDD）：约 50-80 个测试用例
- 配置文件支持：约 3 个 schema 定义

**风险点**:
1. Monorepo 处理：多个 sourceRoot 聚合逻辑复杂
2. 循环检测：DFS 在大型图上性能需优化
3. Agent 集成：Agent 执行器依赖外部框架，需抽象接口