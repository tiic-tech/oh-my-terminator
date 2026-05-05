# Hybrid Layer Inference Design (方案D)

> Red Team攻击、Blue Team解决方案与综合判断

---

## 1. 概述

### 1.1 方案D核心思想

方案D（混合推断策略）采用**多信号融合 + 自适应阈值 + Agent辅助回退**的三层防御架构：

```
┌─────────────────────────────────────────────────────────────┐
│                    Hybrid Inference Pipeline                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Phase 1: Source Root Discovery                            │
│    └─ 信号检测系统 (权重评分 + 排除列表)                      │
│                                                             │
│  Phase 2: Dependency Score Calculation                      │
│    └─ 循环检测 + 外部排除 + 动态导入惩罚                      │
│                                                             │
│  Phase 3: Adaptive Depth Selection                          │
│    └─ DEPTH_PRESETS配置表 (基于项目规模)                     │
│                                                             │
│  Phase 4: Layer Assignment                                  │
│    └ 动态阈值 + 模糊匹配 + 置信度追踪                        │
│                                                             │
│  Phase 5: Fallback & Suggestions                            │
│    └ Agent Prompt + 预过滤器 + 默认降级                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 为什么需要改进现有layers算法

现有算法存在以下核心缺陷：

| 问题类别 | 现有算法缺陷 | 影响 |
|---------|------------|------|
| Source Root | 简单密度分析，无排除机制 | tests/误判为源码根 |
| 依赖分数 | 无循环处理，无外部排除 | score混乱 |
| 自适应深度 | threshold=2固定值，无依据 | 不适配项目规模 |
| 分层决策 | 硬阈值，无置信度 | 分数均匀时无法分层 |
| Edge Cases | 无处理 | 空项目崩溃 |

---

## 2. Red Team攻击报告

### Phase 1攻击：Source Root Discovery漏洞

| ID | 攻击点 | 严重性 | 描述 |
|----|-------|--------|------|
| P1-1 | 文件密度分析陷阱 | **CRITICAL** | tests/目录文件数>src/，被选为sourceRoot |
| P1-2 | node_modules/dist污染 | **CRITICAL** | node_modules包含package.json，被误判为项目 |
| P1-3 | 多重嵌套冲突 | **CRITICAL** | src/modules/core 与 src 同时满足条件 |
| P1-4 | Monorepo混合结构 | HIGH | packages/* + 根目录src并存，如何选择？ |

**攻击演示**：

```
Project Structure:
├── tests/           (150 test files)
├── src/             (30 source files)
├── node_modules/    (contains package.json in nested packages)
└── dist/            (build output)

现有算法结果:
sourceRoot = "tests/"  ❌ WRONG

Blue Team防御:
tests/ → 排除列表 (典型测试目录)
node_modules/ → -20负权重
dist/ → -5负权重
最终: sourceRoot = "src/" ✅
```

### Phase 2攻击：Dependency Score漏洞

| ID | 攻击点 | 严重性 | 描述 |
|----|-------|--------|------|
| P2-1 | 循环依赖score混乱 | **CRITICAL** | A→B→C→A循环，三者score无法区分 |
| P2-2 | 外部依赖污染 | HIGH | lodash导入计入importsFrom，score失真 |
| P2-3 | 动态import不可检测 | HIGH | `import('./module')`运行时加载，静态分析失败 |
| P2-4 | 类型文件误判 | MEDIUM | types.ts netScore=200 → Foundation层错误 |

**攻击演示**：

```typescript
// 循环依赖场景
// A.ts imports B
// B.ts imports C
// C.ts imports A

// 现有算法:
// A: importedBy=1, importsFrom=1, netScore=0
// B: importedBy=1, importsFrom=1, netScore=0
// C: importedBy=1, importsFrom=1, netScore=0
// → 无法区分谁在上层 ❌

// Blue Team防御:
// DFS检测循环 → 对每个成员扣分
// penalty = ceil(cycle.length / 2) = 2
// 循环成员score调整后趋向中间层 ✅
```

### Phase 3攻击：自适应深度伪科学

| ID | 攻击点 | 严重性 | 描述 |
|----|-------|--------|------|
| P3-1 | threshold=2无依据 | HIGH | 为什么是2？不是3？不是1？ |
| P3-2 | "自适应"未定义 | **CRITICAL** | 文档声称自适应但无具体算法 |
| P3-3 | Monorepo包大小差异 | HIGH | packages/ui=10文件 vs packages/core=200文件 |

**攻击质疑**：

> "自适应"算法声称根据项目规模调整，但现有代码：
> ```typescript
> threshold = 2  // 硬编码，完全不自适应
> ```
>
> 这是"自适应"还是"伪科学"？

### Phase 4攻击：分层决策缺陷

| ID | 攻击点 | 严重性 | 描述 |
|----|-------|--------|------|
| P4-1 | 硬阈值问题 | HIGH | scoreDiff > threshold 直接判断，无模糊空间 |
| P4-2 | score分布均匀 | MEDIUM | 所有score在[-2,+2]范围，threshold=2无法分层 |
| P4-3 | Layer role命名 | HIGH | Foundation/Core/Application假设Web应用 |
| P4-4 | 跨层级引用检测 | MEDIUM | 检测违反但无后续action |

**攻击演示**：

```
Score分布:
Group A: score=5
Group B: score=4
Group C: score=3
threshold=2

现有算法:
A-B diff=1 < 2 → same layer
B-C diff=1 < 2 → same layer
→ 所有group合并为Layer 1 ❌

Blue Team防御:
动态阈值 = scoreRange * 0.2 = (5-3)*0.2 = 0.4
最小保护 = 2
最终threshold = max(0.4, 2) = 2
模糊匹配: gapRatio = diff/threshold
如果 gapRatio > 0.7 → 开始新层 ✅
```

### Phase 5攻击：Fallback缺陷

| ID | 攻击点 | 严重性 | 描述 |
|----|-------|--------|------|
| P5-1 | Agent可能不懂fallbackPrompt | HIGH | prompt复杂，Agent可能无法理解 |
| P5-2 | discoveredRoots为空无处理 | MEDIUM | 触发fallback但无默认降级 |

### Edge Cases攻击

| ID | 攻击点 | 严重性 | 描述 |
|----|-------|--------|------|
| E1 | 空项目 | **CRITICAL** | 无文件时程序崩溃 |
| E2 | 单文件项目 | **CRITICAL** | 无法分层 |
| E3 | 全测试项目 | HIGH | 只有.test.ts文件 |
| E4 | 配置文件处理 | MEDIUM | tsconfig.json被当作FILE node |
| E5 | build输出污染 | **CRITICAL** | dist/*.js被纳入分析 |

---

## 3. Blue Team解决方案

### 3.1 Phase 1: Source Root Discovery

**信号检测系统**：

```typescript
interface SignalMatch {
  type: SignalType;
  weight: number;   // 正权重加分，负权重扣分
  matched: boolean;
  detail?: string;
}

// 权重分配表
const SIGNAL_WEIGHTS = {
  // 正信号（加分）
  PACKAGE_JSON:    +10,  // 项目根标记
  TS_CONFIG:       +8,   // TypeScript项目
  TYPICAL_DIR:     +15,  // 最强信号: src/lib.app
  SOURCE_FILES:    +1~10, // 文件密度

  // 负信号（扣分）
  NO_DIST_BUILD:   -5,   // 构建输出扣分
  NO_NODE_MODULES: -20,  // 强负权重
};
```

**排除列表**：

```typescript
const EXCLUDED_DIRECTORIES = [
  'node_modules', 'dist', 'build', 'out', 'output',
  '.git', '.github', '.vscode', '.idea',
  'test', 'tests', '__tests__', 'spec', 'specs',  // 测试目录排除
  'docs', 'documentation', 'examples',
  'coverage', '.nyc_output',
  '.next', '.nuxt', 'public', 'static', 'assets'
];
```

**选择阈值**：

- 最低30分才能成为候选
- 分数差<=5的多个候选视为"多候选场景"
- Monorepo模式：返回所有高分候选

### 3.2 Phase 2: Dependency Score Calculation

**循环检测DFS**：

```typescript
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

  const importsFrom = graph.outEdges.get(nodeId) || [];

  for (const edge of importsFrom) {
    if (edge.type !== EdgeType.IMPORTS) continue;

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
```

**循环惩罚公式**：

```typescript
// 循环长度越大，惩罚越大
const penaltyPerMember = Math.ceil(cycle.length / 2);

// 循环长度 3: penalty = 2
// 循环长度 4: penalty = 2
// 循环长度 5: penalty = 3
// 循环长度 6: penalty = 3

score.cyclePenalty += penaltyPerMember;
score.adjustedImportedBy -= penaltyPerMember;
score.netScore -= penaltyPerMember * 2;  // 双向惩罚
```

**外部依赖完全移除**：

```typescript
// EXTERNAL节点完全移除，不计入分层
for (const [nodeId, node] of graph.nodes) {
  if (node.type === NodeType.EXTERNAL) {
    scores.delete(nodeId);
  }
}
```

**动态导入惩罚**：

```typescript
// DYNAMIC_IMPORTS边不计入importedBy
score.dynamicImportPenalty += 1;
score.adjustedImportedBy -= 1;
score.netScore -= 1;  // 不确定性惩罚

// 警告标记
warnings.push(`Dynamic import target: ${target} (layer unstable)`);
```

### 3.3 Phase 3: Adaptive Depth Selection

**DEPTH_PRESETS配置表**：

| 项目规模 | 文件数范围 | suggestedDepth | threshold | 理由 |
|---------|-----------|---------------|----------|------|
| Small | 0-50 | 1 | 5 | 简单结构，无需复杂分层 |
| Medium | 51-200 | 2 | 3 | 需区分foundation与application |
| Large | 201-500 | 3 | 2 | 需更细粒度分层 |
| Enterprise | 501-2000 | 4 | 1 | 严格分层控制 |
| Ultra-large | 2001+ | 5 | 1 | 最大深度，人工干预警告 |

**阈值依据**：

> **WHY这些阈值**：
> - 50: 小项目边界 - 结构简单，单层足够
> - 200: 中项目边界 - 出现多层级依赖
> - 500: 大项目边界 - 需细粒度分层
> - 2000: 企业级边界 - 需深度分层控制

**Per-SourceRoot独立计算**：

```typescript
// 每个sourceRoot独立计算深度（解决Monorepo差异）
function adjustDepthPerSourceRoot(graph: CodeGraph, sourceRoots: string[]) {
  const results = new Map<string, AdaptiveDepthResult>();

  for (const root of sourceRoots) {
    const { totalFiles, projectSize } = detectProjectSize(graph, [root]);
    const depthResult = selectAdaptiveDepth(totalFiles, projectSize);
    results.set(root, depthResult);
  }

  return results;
}

// packages/ui (10 files) → depth=1
// packages/core (200 files) → depth=3
// 不强制统一深度
```

### 3.4 Phase 4: Layer Assignment

**动态阈值计算**：

```typescript
function calculateDynamicThreshold(scores: number[], projectSize: string): number {
  const sortedScores = [...scores].sort((a, b) => b - a);
  const maxScore = sortedScores[0];
  const minScore = sortedScores[sortedScores.length - 1];
  const scoreRange = maxScore - minScore;

  let baseThreshold: number;

  switch (projectSize) {
    case 'small':
      baseThreshold = Math.max(scoreRange * 0.3, 3);  // 宽松阈值
      break;
    case 'medium':
      baseThreshold = Math.max(scoreRange * 0.2, 2);
      break;
    case 'large':
      baseThreshold = Math.max(scoreRange * 0.15, 2);
      break;
    case 'enterprise':
      baseThreshold = Math.max(scoreRange * 0.1, 1);  // 严格阈值
      break;
  }

  return Math.min(baseThreshold, 10);  // 最大阈值10
}
```

**模糊匹配决策**：

```typescript
const scoreDiff = Math.abs(score - prevScore);
const gapRatio = scoreDiff / dynamicThreshold;

if (gapRatio > 0.7) {
  // 较接近阈值 → 开始新层
  shouldStartNewLayer = true;
  confidence = 0.6;  // 中等置信度
} else {
  // 较远离阈值 → 合到当前层
  shouldStartNewLayer = false;
  confidence = 0.7;
}
```

**置信度追踪与回退**：

```typescript
// 检查低置信度层 (<0.5)
const lowConfidenceLayers = layers.filter(l => l.confidence < 0.5);

if (lowConfidenceLayers.length > 0) {
  // 回退策略：合并低置信度层到相邻层
  const mergedLayers = mergeLowConfidenceLayers(layers);
}
```

**Layer role可配置化**：

```typescript
const DEFAULT_LAYER_ROLES = {
  1: 'Foundation',
  2: 'Core',
  3: 'Application',
  4: 'Presentation',
  5: 'Integration'
};

// 用户可自定义覆盖
const customRoles = {
  1: 'Infrastructure',  // 替代 Foundation
  2: 'Domain',          // 替代 Core
};
```

### 3.5 Phase 5: Fallback & Suggestions

**FALLBACK_PROMPT_TEMPLATES**：

```typescript
const FALLBACK_PROMPT_TEMPLATES = {
  noSourceRoot: `
## Source Root Discovery Failed

I couldn't automatically discover source code roots in this project.

**Diagnostics:**
${diagnostics}

**Please help by:**
1. Confirming the source code location (e.g., "src/", "lib/")
2. Or running \`codegraph analyze --source-root <path>\` manually
`,
  emptyGraph: `
## Empty Graph Detected

The CodeGraph contains no FILE nodes.

**Possible reasons:**
- Project hasn't been analyzed yet
- Source files not found
`,
};
```

**预过滤器**：

```typescript
// 测试文件排除
function excludeTestFiles(graph: CodeGraph): CodeGraph {
  const testPatterns = [
    /\.test\.ts$/, /\.spec\.ts$/,
    /\.test\.tsx$/, /\.spec\.tsx$/,
    /__tests__\/.*\.ts$/,
    /test\/.*\.ts$/, /tests\/.*\.ts$/,
  ];
  // ...过滤逻辑
}

// 配置文件排除
function excludeConfigFiles(graph: CodeGraph): CodeGraph {
  const configPatterns = [
    /tsconfig\.json$/, /package\.json$/,
    /\.eslintrc/, /\.prettierrc/,
    /jest\.config/, /vite\.config/,
  ];
  // ...过滤逻辑
}

// Build输出排除
function excludeBuildOutputs(graph: CodeGraph): CodeGraph {
  const buildPatterns = [
    /^dist\//, /^build\//, /^out\//,
    /^\.next\//, /^\.nuxt\//,
  ];
  // ...过滤逻辑
}
```

**Agent执行器**：

```typescript
async function executeFallbackPrompt(prompt: FallbackPrompt, timeoutMs = 30000) {
  try {
    const response = await sendToAgent(content, timeoutMs);
    return { executed: true, userResponse: response };
  } catch (timeoutError) {
    // 30秒超时 → 应用默认降级
    return {
      executed: false,
      timeoutMs,
      actionTaken: applyDefaultFallback(prompt)
    };
  }
}
```

**默认降级策略**：

| Trigger | Default Action |
|---------|---------------|
| noSourceRoot | 使用当前目录作为sourceRoot |
| emptyGraph | 跳过分层分析 |
| lowConfidenceLayers | 合并低置信度层 |
| cycleDetected | 标记循环警告，不自动修复 |

**空项目/单文件处理**：

```typescript
function handleEmptyProject(): LayersResult {
  return {
    success: false,
    layers: [],
    content: `## Empty Project\nNo source files found.`,
    warnings: ['Empty project - no layers to analyze']
  };
}

function handleSingleFileProject(filePath: string): LayersResult {
  return {
    success: true,
    layers: [{
      layer: 1,
      role: 'Single File',
      groups: [{ name: path.basename(filePath), fileCount: 1 }],
      confidence: 1.0
    }],
    warnings: ['Single file project - trivial layer structure']
  };
}
```

---

## 4. 综合判断（Orchestrator视角）

### 4.1 最终评分

**总评分: 6/10**

| 维度 | 评分 | 说明 |
|------|------|------|
| 攻击覆盖率 | 7/10 | 大多数CRITICAL问题有解决方案 |
| 方案完整性 | 6/10 | Phase 1-5覆盖完整，但部分细节模糊 |
| 实现可行性 | 5/10 | 24模块，20-30函数，中等复杂度 |
| 文档质量 | 7/10 | 算法描述清晰，Edge Case处理详细 |
| 风险控制 | 5/10 | Agent依赖风险，DFS性能风险 |

### 4.2 攻击有效性评估

| 攻击 | 是否解决 | 解决方案 |
|------|---------|----------|
| P1-1 tests误判 | ✅ 已解决 | 排除列表 + 负权重 |
| P1-2 node_modules污染 | ✅ 已解决 | -20负权重 |
| P1-3 多重嵌套 | ✅ 已解决 | 多候选策略 + 分数差判断 |
| P1-4 Monorepo混合 | ✅ 已解决 | 返回多个sourceRoot |
| P2-1 循环依赖 | ✅ 已解决 | DFS检测 + 惩罚公式 |
| P2-2 外部依赖 | ✅ 已解决 | EXTERNAL节点移除 |
| P2-3 动态import | ✅ 已解决 | -1惩罚 + 警告 |
| P2-4 类型文件误判 | ❌ 未解决 | 仍依赖netScore，无类型文件检测 |
| P3-1 threshold无依据 | ✅ 已解决 | DEPTH_PRESETS配置表 |
| P3-2 自适应伪科学 | ✅ 已解决 | 配置表 + 理由说明 |
| P3-3 Monorepo差异 | ✅ 已解决 | Per-SourceRoot独立计算 |
| P4-1 硬阈值 | ✅ 已解决 | 动态阈值 + 模糊匹配 |
| P4-2 score均匀 | ✅ 已解决 | gapRatio模糊判断 |
| P4-3 Layer role | ⚠️ 部分 | 可配置化，但默认值仍假设Web |
| P4-4 跨层引用 | ⚠️ 部分 | 只检测，无action策略 |
| P5-1 Agent不懂prompt | ⚠️ 部分 | 有模板但未简化 |
| P5-2 roots为空 | ✅ 已解决 | 默认降级策略 |
| E1 空项目 | ✅ 已解决 | handleEmptyProject() |
| E2 单文件 | ✅ 已解决 | handleSingleFileProject() |
| E3 全测试 | ✅ 已解决 | excludeTestFiles() |
| E4 配置文件 | ✅ 已解决 | excludeConfigFiles() |
| E5 build污染 | ✅ 已解决 | excludeBuildOutputs() |

### 4.3 实现复杂度分析

```
模块总数: 24
函数总数: 20-30
测试用例: 50-80

Phase分布:
├── Phase 1: 5模块 (中等复杂度)
├── Phase 2: 5模块 (中等复杂度)
├── Phase 3: 4模块 (简单)
├── Phase 4: 5模块 (中等复杂度)
├── Phase 5: 5模块 (中等复杂度)

依赖关系:
Phase 3 ← 无依赖 (可最先实现)
Phase 5 ← 依赖 Phase 1-4 (最后实现)
Phase 1-4 ← 可并行开发
```

---

## 5. 已解决的问题

| 问题 | 原因 | Blue Team方案 | 状态 |
|------|------|--------------|------|
| 文件密度分析漏洞 | tests/文件数>src/ | 信号检测 + 排除列表 | ✅ |
| node_modules污染 | 包含package.json | -20负权重 | ✅ |
| dist/build污染 | 构建输出目录 | excludeBuildOutputs() | ✅ |
| "自适应"伪科学 | threshold硬编码=2 | DEPTH_PRESETS配置表 | ✅ |
| threshold无依据 | 无科学依据 | 配置表 + 理由说明文档 | ✅ |
| 循环依赖score混乱 | 无循环处理 | DFS检测 + ceil(len/2)惩罚 | ✅ |
| 外部依赖污染 | lodash计入imports | EXTERNAL节点完全移除 | ✅ |
| 动态import不可检测 | 静态分析失败 | -1惩罚 + 警告标记 | ✅ |
| 硬阈值分层 | scoreDiff>2判断 | 动态阈值 + gapRatio模糊匹配 | ✅ |
| score分布均匀 | 无法区分 | 模糊匹配 + 置信度追踪 | ✅ |
| 测试文件污染 | .test.ts纳入分析 | excludeTestFiles()预过滤 | ✅ |
| 配置文件误判 | tsconfig当作FILE | excludeConfigFiles() | ✅ |
| 空项目崩溃 | 无文件时异常 | handleEmptyProject() | ✅ |
| 单文件无法分层 | 只1个文件 | handleSingleFileProject() | ✅ |
| discoveredRoots为空 | 无默认处理 | 默认降级 + cwd | ✅ |

---

## 6. 未解决的问题（第二轮状态更新）

> 状态标注：✅ 已解决 | ⚠️ 部分解决 | ❌ 仍需设计

| 问题 | 原因 | 建议方案 | 优先级 | 状态 |
|------|------|----------|--------|------|
| 类型文件误判 | types.ts netScore=200 → Foundation | FileTypeInfo检测 + Layer 0 Types层 | HIGH | ⚠️ 部分解决（有方案但需接受误判率） |
| 空项目/单文件未整合 | 边缘处理函数孤立 | Phase 0 detectSpecialCases整合 | MEDIUM | ✅ 已解决（Blue Team完整方案） |
| 跨层级引用检测后无action | 只检测违反 | ViolationLevel + RemediationStrategy | MEDIUM | ✅ 已解决（仅警告不自动调整） |
| Layer role默认值不通用 | 假设Web应用 | 抽象Role系统 + 预设模板 | LOW | ✅ 已解决（预设模板+用户自定义） |
| fallbackPrompt复杂 | Agent可能不理解 | 分级Prompt + 多级fallback | LOW | ✅ 已解决（简化prompt+默认降级） |

**类型文件误判深入分析**（第二轮更新）：

```
场景: src/types/index.ts
- 被所有模块导入（提供类型定义）
- importedBy = 50
- importsFrom = 0
- netScore = 50 → Foundation层

问题: 这是类型定义文件，不应在Foundation
正确分层: 应在Domain层或独立Type层

第二轮Blue Team方案:
├── FileTypeInfo检测
│   ├── isPureTypeFile: 检测纯类型文件
│   ├── hasRuntimeContent: 检测混合文件
│   └── typeImportRatio: 类型导入比例
├── Score调整公式
│   ├── 纯类型文件: -50 (强制降级)
│   └── 混合文件: -20 (部分降级)
└── Layer 0策略: 新增Types层（编译时依赖）

评分: 8/10，复杂度：中等
结论: 可能无完美解决方案，需接受误判率
```

---

## 7. 分阶段实现建议

### 阶段1：立即修复（Priority: HIGH）

| 任务 | 模块 | 预估工时 | 阻塞问题 |
|------|------|----------|----------|
| stderr分离 | CLI输出 | 2h | 无 |
| CLI输出修复 | 命令格式 | 1h | 无 |
| DEPTH_PRESETS集成 | Phase 3 | 4h | 无 |

**阶段1不阻塞，可立即开始**

### 阶段2：中期实现（Priority: MEDIUM）

| 任务 | 模块 | 预估工时 | 依赖 |
|------|------|----------|------|
| 自适应深度完整实现 | Phase 3 | 8h | 无 |
| 预过滤器集成 | Phase 5 | 6h | 无 |
| 动态阈值计算 | Phase 4 | 6h | Phase 3 |
| 模糊匹配决策 | Phase 4 | 4h | 动态阈值 |

**阶段2可并行开发Phase 3 + Phase 5预过滤**

### 阶段3：长期完善（Priority: LOW）

| 任务 | 模块 | 预估工时 | 依赖 |
|------|------|----------|------|
| Source Root Discovery信号系统 | Phase 1 | 12h | 无 |
| 循环依赖DFS检测 | Phase 2 | 10h | 无 |
| Agent Fallback完整流程 | Phase 5 | 8h | Phase 1-4 |
| 置信度追踪系统 | Phase 4 | 6h | Phase 2 |

**阶段3风险**：
- DFS在大型图上性能需优化
- Agent执行器依赖外部框架

---

## 8. 待讨论问题

### Q1: 类型文件检测策略

选项：

| 方案 | 描述 | 优缺点 |
|------|------|--------|
| A. 文件名pattern | `/types\.ts$/`, `/index\.ts$/` | 简单，但可能误判非类型文件 |
| B. 内容检测 | 检测`export type *`, `export interface *` | 准确，但需解析文件内容 |
| C. 无runtime依赖 | 检测无实际值导入 | 精确，但复杂度高 |
| D. 独立Type Layer | 类型文件单独分层 | 清晰，但增加复杂度 |

**建议**: 方案B + D组合

### Q2: 空项目/单文件整合方案

选项：

| 方案 | 描述 |
|------|------|
| A. 入口检测 | 在`getArchitectureLayers()`入口检测 |
| B. 预分析检测 | 在图构建前检测文件数 |
| C. 报告层检测 | 在输出报告时检测 |

**建议**: 方案B，预分析阶段检测更高效

### Q3: fallbackPrompt简洁化

现有prompt过于详细，Agent可能无法理解核心意图。

建议：

```typescript
// 简化版prompt
const SIMPLE_PROMPT = `
Cannot find sourceRoot. Please specify:
1. Source directory path (e.g., src/)
2. Or skip layer analysis
`;
```

### Q4: Layer role抽象化命名

现有命名假设Web应用（Foundation/Presentation），不适用于CLI/Library项目。

建议命名体系：

| 项目类型 | Layer命名 |
|---------|----------|
| Web App | Foundation → Core → Application → Presentation |
| CLI | Foundation → Domain → Service → CLI |
| Library | Foundation → Core → API |
| Generic | Layer1 → Layer2 → Layer3 → Layer4 |

**建议**: 提供预设模板 + 用户自定义

---

## 9. 附录：算法伪代码

### 9.1 完整Pipeline伪代码

```typescript
function hybridLayerInference(projectRoot: string): LayersResult {
  // Phase 0: Edge Case Detection
  const fileCount = countSourceFiles(projectRoot);
  if (fileCount === 0) return handleEmptyProject();
  if (fileCount === 1) return handleSingleFileProject();

  // Phase 1: Source Root Discovery
  const sourceRoots = discoverSourceRoots(projectRoot);
  if (sourceRoots.length === 0) {
    const fallback = await executeFallbackPrompt('noSourceRoot');
    if (!fallback.executed) {
      sourceRoots = [projectRoot];  // Default fallback
    }
  }

  // Phase 2: Build Graph & Filter
  let graph = buildCodeGraph(sourceRoots);
  graph = excludeTestFiles(graph);
  graph = excludeConfigFiles(graph);
  graph = excludeBuildOutputs(graph);

  // Phase 3: Dependency Score Calculation
  const scores = calculateDependencyScores(graph);
  detectCyclesAndApplyPenalty(scores, graph);
  excludeExternalDependencies(scores, graph);
  handleDynamicImports(scores, graph);

  // Phase 4: Adaptive Depth Selection
  const { totalFiles, projectSize } = detectProjectSize(graph, sourceRoots);
  const { selectedDepth, threshold } = selectAdaptiveDepth(totalFiles, projectSize);

  // Phase 5: Layer Assignment
  const dynamicThreshold = calculateDynamicThreshold(scores, projectSize);
  const layers = assignLayersWithFuzzyMatching(scores, threshold, dynamicThreshold);

  // Phase 6: Confidence Fallback
  const result = applyConfidenceFallback(layers);
  if (result.fallbackTriggered) {
    await executeFallbackPrompt('lowConfidenceLayers');
  }

  return result;
}
```

---

## 10. 参考文档

- [方案D-防御设计方案.md](../方案D-防御设计方案.md) - Blue Team原始设计方案
- Red Team攻击记录（内部讨论）

---

## 15. 第三轮对抗讨论：语言无关架构可行性

> 用户目标澄清 + Red Team架构攻击 + Blue Team Plugin设计

### 15.1 核心澄清：用户目标明确

第二轮讨论后，用户澄清了工具范围限制，这对架构设计产生重大影响：

**允许的工具**：

| 工具类别 | 具体工具 | 用途 |
|---------|---------|------|
| 编译器工具 | TypeScript Compiler API | AST解析，import type检测 |
| AST解析 | Python AST / tree-sitter | 源码结构分析 |
| 语言Parser | Go parser, Rust syn | 各语言原生解析 |
| 静态分析 | 任何静态分析方法 | 依赖关系分析 |

**禁止的工具**：

| 工具类别 | 具体工具 | 禁用原因 |
|---------|---------|----------|
| AI模型 | LLM, Claude, GPT | 用户约束 |
| 机器学习 | ML模型 | 用户约束 |

**目标澄清**：

```
┌─────────────────────────────────────────────────────────────┐
│                User Goal Clarification                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  目标: 通过算法设计 + 代码本身 → 高质量repo关系建模          │
│                                                              │
│  允许: ✓ TypeScript Compiler API                            │
│        ✓ Python AST / tree-sitter                           │
│        ✓ Go parser, Rust syn                                │
│        ✓ 任何编译器工具                                      │
│        ✓ 任何静态分析方法                                    │
│                                                              │
│  禁止: ✗ LLM / AI模型                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 15.2 Red Team攻击：语言无关类型检测架构

**攻击目标**：第二轮讨论提出"语言无关类型检测架构"

**攻击结论评分**：2/10（伪命题）

核心攻击证据：

**证据1：语义不一致**

TypeScript的"type"是编译时消失的概念，Go的"interface"是运行时存在的类型：

| 语言 | 类型定义机制 | 编译时存在 | 运行时存在 | Layer 0语义 |
|------|-------------|----------|----------|------------|
| TypeScript | export type, .d.ts | YES | NO | 合适 |
| Python | .pyi stub | YES | YES(可选) | 语义冲突 |
| Go | interface{} | NO | YES | 语义冲突 |
| Rust | trait | YES | NO(有impl) | 部分合适 |
| Java | interface | NO | YES | 语义冲突 |

**证据2：抽象层收益负**

强行统一导致Go用户困惑：
- Go interface明明有运行时存在，为何在Layer 0（编译时消失层）？
- 统一抽象层的概念模型在不同语言下产生认知偏差

**证据3：跨语言Edge Case致命**

| Edge Case | 描述 | 静态分析限制 |
|-----------|------|-------------|
| TS调用Python IPC | TypeScript调用Python进程 | 无法检测跨语言IPC |
| FFI边界 | Rust extern "C"调用C++ | 需特殊FFI detection |
| Protobuf/GraphQL IDL | IDL生成多语言代码 | 需IDL-aware detection |
| WASM边界 | Rust编译为WASM被TS调用 | 需WASM boundary detection |

```
┌─────────────────────────────────────────────────────────────┐
│         Cross-Language Edge Case Analysis                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Edge Case 1: TypeScript → Python IPC                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  // TS code                                            │   │
│  │  const result = spawn('python', ['script.py']);       │   │
│  │  // 静态分析: 看不到Python依赖                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Edge Case 2: FFI边界                                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  // Rust                                               │   │
│  │  extern "C" { fn cpp_function(); }                    │   │
│  │  // 需: FFI boundary detection                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Edge Case 3: Protobuf IDL                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  // .proto → generates TS + Python + Go code          │   │
│  │  // 需: IDL-aware detection                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Edge Case 4: WASM边界                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  // Rust compiled to WASM, called by TS               │   │
│  │  // 需: WASM boundary detection                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Red Team攻击结论**：

语言无关类型检测架构是伪命题：
1. 语义冲突无法统一（编译时消失 vs 运行时存在）
2. 抽象层收益负（增加用户认知负担）
3. Edge Case致命（跨语言边界静态分析失效）

### 15.3 Blue Team解决方案：Plugin架构设计

**方案评分**：9/10（可落地但需调整）

核心设计：

**设计1：渐进式类型纯度模型**（而非二元分类）

```
┌─────────────────────────────────────────────────────────────┐
│           Progressive Type Purity Model                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  purityLevel 0: 纯编译时（TS .d.ts, Python .pyi）            │
│    → Layer 0 (编译时消失层)                                  │
│                                                              │
│  purityLevel 1: 有运行时存在（Go interface, Rust trait）     │
│    → Layer 1 (有运行时存在但主要作为类型契约)                │
│                                                              │
│  purityLevel 2: 完全运行时（业务逻辑）                       │
│    → Layer 2+ (常规分层)                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**设计2：语言差异处理**

| 语言 | 检测方法 | Layer建议 | 检测依据 |
|------|---------|----------|----------|
| TypeScript | ImportClause.isTypeOnly | Layer 0 | import type检测 |
| Python | .pyi stub文件检测 | Layer 0 | stub文件pattern |
| Go | interface检测 | Layer 1 | 运行时存在 |
| Rust | trait检测 | Layer 1 | impl存在 |
| Java | interface检测 | Layer 1 | 运行时存在 |

**设计3：Plugin架构**

```typescript
// Plugin抽象接口
interface TypeDefinitionDetector {
  language: string;
  detectTypeDefinitions(sourceCode: string): TypeDetectionResult;
  suggestLayer(result: TypeDetectionResult): LayerSuggestion;
}

interface TypeDetectionResult {
  typeNodes: TypeNodeInfo[];
  purityLevel: 0 | 1 | 2;
  runtimePresence: boolean;
  confidence: number;
}

interface LayerSuggestion {
  suggestedLayer: number;
  reason: string;
  alternativeLayers?: number[];
}

// Plugin Registry
class LanguagePluginRegistry {
  private detectors: Map<string, TypeDefinitionDetector>;
  
  register(detector: TypeDefinitionDetector): void {
    this.detectors.set(detector.language, detector);
  }
  
  detect(filePath: string, sourceCode: string): DetectionResult {
    const language = this.detectLanguage(filePath);
    const detector = this.detectors.get(language);
    if (!detector) {
      return this.defaultDetection(filePath, sourceCode);
    }
    return detector.detectTypeDefinitions(sourceCode);
  }
  
  suggestLayer(filePath: string, result: TypeDetectionResult): LayerSuggestion {
    const language = this.detectLanguage(filePath);
    const detector = this.detectors.get(language);
    if (!detector) {
      return { suggestedLayer: 1, reason: 'Unknown language' };
    }
    return detector.suggestLayer(result);
  }
}
```

**设计4：配置文件扩展**

```json
// .codegraph/config.json
{
  "typeDefinition": {
    "purityLevelOverrides": {
      "src/types/**/*.ts": 0,
      "src/interfaces/**/*.go": 1
    },
    "ffiBoundaries": [
      { "from": "rust", "to": "c++", "path": "src/ffi/**" }
    ],
    "idlAware": {
      "protobuf": "proto/**/*.proto",
      "graphql": "schema/**/*.graphql"
    }
  }
}
```

### 15.4 综合判断：Plugin系统设计

**最终架构建议**：语言特定 + Plugin系统

```
┌─────────────────────────────────────────────────────────────┐
│              Plugin-Based Architecture                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: Plugin Registry                                   │
│  ├── TypeScript Plugin                                      │
│  │   ├── Compiler API ImportClause.isTypeOnly              │
│  │   ├── export type/interface detection                    │
│  │   └── Layer建议: 0 (编译时)                              │
│  │                                                          │
│  ├── Python Plugin                                          │
│  │   ├── .pyi stub检测                                      │
│  │   └── Layer建议: 0                                       │
│  │                                                          │
│  ├── Go/Rust/Java Plugin                                    │
│  │   ├── interface/trait detection                          │
│  │   ├── 标记为"运行时类型"                                  │
│  │   └── Layer建议: 1 (非编译时消失)                        │
│  │                                                          │
│  └──────────────────────────────────────────────────────────│
│                                                              │
│  Layer 2: 配置覆盖系统                                       │
│  └──────────────────────────────────────────────────────────│
│  └── .codegraph/config.json                                 │
│      ├── typeFiles手动标记                                   │
│      ├── ffiBoundaries跨语言配置                             │
│      └── idlAware IDL生成代码                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 16. 架构设计决策

### 16.1 TypeScript Compiler API能力分析

**现有能力**：

TypeScript Compiler API提供完整的import type检测能力：

```typescript
// ImportClause.isTypeOnly API
import * as ts from 'typescript';

function checkImportTypeOnly(node: ts.ImportClause): boolean {
  return node.isTypeOnly;  // TypeScript Compiler API原生支持
}

// 示例检测
// import type { Foo } from './types' → isTypeOnly = true
// import { Foo } from './types' → isTypeOnly = false
```

**当前实现差距**：

| 差距 | 当前状态 | 需要扩展 |
|------|---------|----------|
| ParsedImportInfo.importType | 只区分'import' | 're-export' | 'dynamic' | 需添加isTypeOnly字段 |
| import type检测 | 未实现 | 需扩展extractImportInfo函数 |
| export type检测 | 未实现 | 需扩展export detection |

**Parser扩展设计**：

```typescript
// 当前ParsedImportInfo
interface ParsedImportInfo {
  importType: 'import' | 're-export' | 'dynamic';
  source: string;
  imports: ImportSpecifier[];
  isExternal: boolean;
}

// 扩展后ParsedImportInfo
interface ParsedImportInfo {
  importType: 'import' | 're-export' | 'dynamic';
  source: string;
  imports: ImportSpecifier[];
  isExternal: boolean;
  isTypeOnly: boolean;  // 新增: import type检测
  typeOnlySpecifiers?: string[];  // 新增: 类型导入列表
}

// 扩展extractImportInfo
function extractImportInfo(
  importClause: ts.ImportClause,
  sourceFile: ts.SourceFile
): ParsedImportInfo {
  // ...existing logic...
  
  // 新增: isTypeOnly检测
  const isTypeOnly = importClause.isTypeOnly;
  
  // 新增: typeOnly specifiers检测
  const typeOnlySpecifiers = extractTypeOnlySpecifiers(importClause);
  
  return {
    ...existingInfo,
    isTypeOnly,
    typeOnlySpecifiers
  };
}
```

### 16.2 跨语言语义冲突解决方案

**核心矛盾**：

| 语言 | "类型"概念 | 编译时 | 运行时 | Layer建议 |
|------|----------|--------|--------|----------|
| TypeScript | type/interface | 消失 | 无 | Layer 0 |
| Python | .pyi stub | 有 | 有(可选) | Layer 0（stub）/ Layer 1（实际） |
| Go | interface{} | 有 | 有 | Layer 1 |
| Rust | trait | 有 | 有(impl) | Layer 1 |
| Java | interface | 有 | 有 | Layer 1 |

**解决方案**：语言特定Plugin + purityLevel

```typescript
// 语言特定Plugin实现示例

class TypeScriptTypeDetector implements TypeDefinitionDetector {
  language = 'typescript';
  
  detectTypeDefinitions(sourceCode: string): TypeDetectionResult {
    // 使用Compiler API检测
    const typeNodes = this.extractTypeNodes(sourceCode);
    const hasRuntimeExports = this.checkRuntimeExports(sourceCode);
    
    return {
      typeNodes,
      purityLevel: hasRuntimeExports ? 1 : 0,
      runtimePresence: hasRuntimeExports,
      confidence: 0.9  // TypeScript检测高置信度
    };
  }
  
  suggestLayer(result: TypeDetectionResult): LayerSuggestion {
    if (result.purityLevel === 0) {
      return { suggestedLayer: 0, reason: 'Pure type-only exports' };
    }
    return { suggestedLayer: 1, reason: 'Has runtime exports' };
  }
}

class GoTypeDetector implements TypeDefinitionDetector {
  language = 'go';
  
  detectTypeDefinitions(sourceCode: string): TypeDetectionResult {
    const interfaces = this.extractInterfaces(sourceCode);
    
    // Go interface有运行时存在
    return {
      typeNodes: interfaces,
      purityLevel: 1,  // 永远是1，不是0
      runtimePresence: true,
      confidence: 0.8
    };
  }
  
  suggestLayer(result: TypeDetectionResult): LayerSuggestion {
    return {
      suggestedLayer: 1,
      reason: 'Go interface has runtime presence',
      alternativeLayers: [2]  // 可能作为Domain层
    };
  }
}
```

### 16.3 Plugin系统设计

**核心接口**：

```typescript
// src/plugins/types.ts

interface LanguagePlugin {
  language: string;
  version: string;
  
  // 类型定义检测
  detectTypes(filePath: string): TypeDetectionResult;
  
  // Layer建议
  suggestLayer(result: TypeDetectionResult): LayerSuggestion;
  
  // FFI边界检测（可选）
  detectFFIBoundaries?(filePath: string): FFIBoundaryInfo[];
  
  // IDL aware检测（可选）
  detectIDLGenerated?(filePath: string): IDLInfo | null;
}

interface TypeDetectionResult {
  types: TypeInfo[];
  purityLevel: PurityLevel;
  hasRuntimePresence: boolean;
  confidence: number;
  metadata?: Record<string, unknown>;
}

enum PurityLevel {
  PURE_COMPILE_TIME = 0,    // 编译时消失
  HAS_RUNTIME_PRESENCE = 1, // 有运行时存在
  FULL_RUNTIME = 2          // 完全运行时
}

interface TypeInfo {
  name: string;
  kind: 'interface' | 'type' | 'class' | 'struct' | 'trait';
  exported: boolean;
  position: { line: number; column: number };
}
```

**Plugin Registry**：

```typescript
// src/plugins/registry.ts

class PluginRegistry {
  private plugins: Map<string, LanguagePlugin> = new Map();
  private config: TypeConfig;
  
  constructor(configPath?: string) {
    this.config = this.loadConfig(configPath);
  }
  
  register(plugin: LanguagePlugin): void {
    this.plugins.set(plugin.language, plugin);
  }
  
  detect(filePath: string, sourceCode?: string): DetectionResult {
    const language = this.detectLanguageFromPath(filePath);
    const plugin = this.plugins.get(language);
    
    if (!plugin) {
      // 未注册语言使用默认检测
      return this.defaultDetection(filePath, sourceCode);
    }
    
    const typeResult = plugin.detectTypes(filePath);
    const layerSuggestion = plugin.suggestLayer(typeResult);
    
    // 应用配置覆盖
    const finalLayer = this.applyConfigOverride(filePath, layerSuggestion);
    
    return {
      typeResult,
      layerSuggestion,
      finalLayer,
      pluginUsed: plugin.language
    };
  }
  
  private detectLanguageFromPath(filePath: string): string {
    const ext = path.extname(filePath);
    const languageMap = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java'
    };
    return languageMap[ext] || 'unknown';
  }
  
  private applyConfigOverride(
    filePath: string,
    suggestion: LayerSuggestion
  ): number {
    const overrides = this.config.purityLevelOverrides;
    for (const [pattern, layer] of Object.entries(overrides)) {
      if (minimatch(filePath, pattern)) {
        return layer;
      }
    }
    return suggestion.suggestedLayer;
  }
}
```

### 16.4 配置覆盖系统

**配置文件格式**：

```json
// .codegraph/config.json
{
  "version": "1.0",
  "typeDefinition": {
    "purityLevelOverrides": {
      "src/types/**/*.ts": 0,
      "src/interfaces/**/*.ts": 0,
      "src/models/**/*.go": 1
    },
    "ffiBoundaries": [
      {
        "from": "rust",
        "to": "c++",
        "pattern": "src/ffi/**/*.rs",
        "layer": 0
      }
    ],
    "idlAware": {
      "protobuf": {
        "pattern": "proto/**/*.proto",
        "generatedPattern": "src/generated/**/*.ts",
        "layer": 0
      },
      "graphql": {
        "pattern": "schema/**/*.graphql",
        "generatedPattern": "src/generated/**/*.ts",
        "layer": 0
      }
    },
    "wasmBoundaries": [
      {
        "from": "rust",
        "to": "wasm",
        "pattern": "src/wasm/**/*.rs",
        "layer": 0
      }
    ]
  }
}
```

**配置加载**：

```typescript
// src/config/type-config-loader.ts

interface TypeConfig {
  purityLevelOverrides: Record<string, number>;
  ffiBoundaries: FFIBoundaryConfig[];
  idlAware: Record<string, IDLConfig>;
  wasmBoundaries: WASMBoundaryConfig[];
}

function loadTypeConfig(projectRoot: string): TypeConfig {
  const configPath = path.join(projectRoot, '.codegraph', 'config.json');
  
  if (!fs.existsSync(configPath)) {
    return getDefaultTypeConfig();
  }
  
  const configContent = fs.readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(configContent);
  
  return validateTypeConfig(parsed.typeDefinition);
}

function getDefaultTypeConfig(): TypeConfig {
  return {
    purityLevelOverrides: {},
    ffiBoundaries: [],
    idlAware: {},
    wasmBoundaries: []
  };
}
```

---

## 17. 最终实现路径

### 17.1 P0-P6实现路径

| Phase | 任务 | 利用工具 | 优先级 | 预估工时 |
|-------|------|----------|--------|----------|
| P0 | 扩展TS Parser，import type检测 | TypeScript Compiler API | 立即 | 4h |
| P1 | Plugin Registry架构 | 纯算法 | Week1 | 8h |
| P2 | FileTypeInfo metadata | AST分析 | Week2 | 6h |
| P3 | Layer assignment集成 | 依赖分数调整 | Week3 | 8h |
| P4 | Python stubs检测 | Python AST | Week4 | 6h |
| P5 | Go/Rust/Java interface | 各语言parser | Week5 | 12h |
| P6 | 用户配置系统 | JSON配置 | Week6 | 8h |

**总工时**：46h（约6周）

### 17.2 关键文件路径树

```
packages/codegraph/src/
├── parser/
│   ├── ts-parser/
│   │   ├── import-extractor.ts       # [MODIFY] 扩展import type检测
│   │   │   └── 添加: isTypeOnly字段
│   │   │   └── 添加: typeOnlySpecifiers提取
│   │   │
│   │   └── export-extractor.ts       # [MODIFY] 扩展export type检测
│   │       └── 添加: export type检测
│   │       └── 添加: export interface检测
│   │
│   └── typescript-adapter.ts         # [MODIFY] 添加metadata
│       └── 添加: FileTypeInfo生成
│       └── 添加: typeImportRatio计算
│       └── 添加: purityLevel判断
│
├── plugins/
│   ├── registry.ts                   # [NEW] Plugin Registry
│   │   └── 新增: PluginRegistry类
│   │   └── 新增: register/detect方法
│   │   └── 新增: 配置覆盖应用
│   │
│   ├── types.ts                      # [NEW] Plugin类型定义
│   │   └── 新增: LanguagePlugin接口
│   │   └── 新增: TypeDetectionResult接口
│   │   └── 新增: PurityLevel枚举
│   │
│   ├── typescript-plugin.ts          # [NEW] TypeScript Plugin
│   │   └── 新增: TypeScriptTypeDetector
│   │   └── 新增: ImportClause.isTypeOnly使用
│   │   └── 新增: purityLevel=0建议
│   │
│   ├── python-plugin.ts              # [NEW] Python Plugin
│   │   └── 新增: PythonTypeDetector
│   │   └── 新增: .pyi stub检测
│   │   └── 新增: purityLevel=0建议（stub）
│   │
│   ├── go-plugin.ts                  # [NEW] Go Plugin
│   │   └── 新增: GoTypeDetector
│   │   └── 新增: interface{}检测
│   │   └── 新增: purityLevel=1建议
│   │
│   ├── rust-plugin.ts                # [NEW] Rust Plugin
│   │   └── 新增: RustTypeDetector
│   │   └── 新增: trait检测
│   │   └── 新增: purityLevel=1建议
│   │
│   └── java-plugin.ts                # [NEW] Java Plugin
│       └── 新增: JavaTypeDetector
│       └── 新增: interface检测
│       └── 新增: purityLevel=1建议
│
├── api/
│   └── layers/
│       ├── type-definition-layer.ts  # [NEW] Layer 0 Types层
│       │   └── 新增: Types层定义
│       │   └── 新增: purityLevel过滤
│       │   └── 新增: 编译时依赖处理
│       │
│       └── inference/
│           └── core.ts               # [MODIFY] Layer推断核心
│               └── 添加: Plugin集成
│               └── 添加: purityLevel判断
│               └── 添加: Layer 0生成
│
├── config/
│   ├── type-config-schema.ts         # [NEW] 配置Schema
│   │   └── 新增: TypeConfig接口
│   │   └── 新增: FFIBoundaryConfig接口
│   │   └── 新增: IDLConfig接口
│   │
│   └── type-config-loader.ts         # [NEW] 配置加载
│       └── 新增: loadTypeConfig函数
│       └── 新增: validateTypeConfig函数
│       └── 新增: getDefaultTypeConfig函数
│
└── types/
    └── layer-types.ts                # [MODIFY] 类型定义扩展
        └── 添加: PurityLevel枚举
        └── 添加: TypeDetectionResult接口
        └── 添加: LayerSuggestion接口
        └── 添加: FFIBoundaryInfo接口
        └── 添加: IDLInfo接口
```

### 17.3 测试文件清单

```
packages/codegraph/src/
└── __tests__/
    └── plugins/
        ├── registry.test.ts          # [NEW] Plugin Registry测试
        │   └── 测试: register/detect
        │   └── 测试: 配置覆盖
        │   └── 测试: 未注册语言fallback
        │
        ├── typescript-plugin.test.ts # [NEW] TS Plugin测试
        │   └── 测试: import type检测
        │   └── 测试: export type检测
        │   └── 测试: purityLevel=0建议
        │
        ├── python-plugin.test.ts     # [NEW] Python Plugin测试
        │   └── 测试: .pyi stub检测
        │   └── 测试: purityLevel建议
        │
        ├── go-plugin.test.ts         # [NEW] Go Plugin测试
        │   └── 测试: interface检测
        │   └── 测试: purityLevel=1建议
        │
        ├── rust-plugin.test.ts       # [NEW] Rust Plugin测试
        │   └── 测试: trait检测
        │   └── 测试: purityLevel=1建议
        │
        └── config/
            ├── type-config-loader.test.ts # [NEW] 配置加载测试
            │   └── 测试: 配置解析
            │   └── 测试: 默认配置
            │   └── 测试: 验证逻辑
            │
            └── ffi-boundary.test.ts  # [NEW] FFI边界测试
                └── 测试: FFI检测
                └── 测试: WASM边界
                └── 测试: IDL生成代码
```

---

## 18. 附录：第三轮讨论关键发现

### 18.1 "静态分析"范围澄清

**澄清结果**：

| 分析类型 | 工具 | 允许？ |
|---------|------|-------|
| AST解析 | TypeScript Compiler API, Python AST, tree-sitter | ✓ 允许 |
| 编译器分析 | Go parser, Rust syn, Java parser | ✓ 允许 |
| 类型检测 | ImportClause.isTypeOnly, .pyi stub检测 | ✓ 允许 |
| LLM推断 | Claude, GPT, Claude API | ✗ 禁止 |
| ML模型 | 任何机器学习模型 | ✗ 禁止 |

**边界界定**：

```
┌─────────────────────────────────────────────────────────────┐
│            Static Analysis Scope Definition                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ✓ 允许: 编译器工具                                          │
│    ├── TypeScript Compiler API                              │
│    ├── Python AST / ast module                              │
│    ├── Go go/parser package                                 │
│    ├── Rust syn crate                                       │
│    └── Java javac / ASM                                     │
│                                                              │
│  ✓ 允许: 静态分析方法                                        │
│    ├── AST遍历                                              │
│    ├── 依赖图构建                                           │
│    ├── 类型检测                                             │
│    ├── 控制流分析                                           │
│    └── 数据流分析                                           │
│                                                              │
│  ✗ 禁止: AI/ML工具                                           │
│    ├── LLM API调用                                          │
│    ├── ML模型训练                                           │
│    ├── 神经网络推理                                          │
│    └── 概率推断                                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 18.2 Parser能力vs当前实现差距

**差距矩阵**：

| 能力 | TypeScript Compiler API提供 | 当前实现 | 需要扩展 |
|------|---------------------------|---------|----------|
| import type检测 | ImportClause.isTypeOnly | 未使用 | 是 |
| export type检测 | exportDeclaration.isTypeOnly | 未使用 | 是 |
| 类型别名检测 | ts.TypeAliasDeclaration | 未使用 | 是 |
| interface检测 | ts.InterfaceDeclaration | 未使用 | 是 |
| namespace检测 | ts.NamespaceDeclaration | 未使用 | 是 |
| 泛型参数检测 | ts.TypeParameter | 未使用 | 是 |

**TypeScript Parser扩展需求**：

```typescript
// 当前实现（import-extractor.ts）
function extractImportInfo(importDecl: ts.ImportDeclaration): ParsedImportInfo {
  // 只提取基本import信息
  const source = importDecl.moduleSpecifier.getText();
  const imports = extractImportSpecifiers(importDecl);
  return { importType: 'import', source, imports, isExternal: false };
}

// 扩展后实现
function extractImportInfoExtended(importDecl: ts.ImportDeclaration): ParsedImportInfo {
  const importClause = importDecl.importClause;
  
  // 关键: 使用isTypeOnly API
  const isTypeOnly = importClause?.isTypeOnly ?? false;
  
  // 区分type-only specifiers
  const namedBindings = importClause?.namedBindings;
  if (namedBindings && ts.isNamedImports(namedBindings)) {
    const typeOnlySpecifiers = namedBindings.elements
      .filter(e => e.isTypeOnly)
      .map(e => e.name.getText());
  }
  
  return {
    importType: 'import',
    source,
    imports,
    isExternal: false,
    isTypeOnly,          // 新增
    typeOnlySpecifiers   // 新增
  };
}
```

### 18.3 语言差异本质分析

**本质矛盾**：

| 语言 | 类型系统本质 | 运行时影响 | 分析难度 |
|------|-------------|----------|----------|
| TypeScript | 结构类型，编译时消失 | 无 | 低（Compiler API完整） |
| Python | Duck typing，可选类型注解 | 有 | 中（stub检测） |
| Go | 结构类型，接口隐式实现 | 有 | 中（interface检测） |
| Rust | Trait系统，显式impl | 有 | 高（trait + impl检测） |
| Java | 名义类型，显式implements | 有 | 中（interface检测） |

**统一抽象层不可行**：

```
原因1: 编译时消失 vs 运行时存在
┌─────────────────────────────────────────────────────────────┐
│  TypeScript: export type Foo = {...}                        │
│    → 编译后消失，不占用运行时空间                            │
│                                                              │
│  Go: type Foo interface { Method() }                        │
│    → 运行时存在，interface值可以是nil或具体类型              │
│                                                              │
│  强行统一 → Go用户困惑                                       │
└─────────────────────────────────────────────────────────────┘

原因2: 类型契约 vs 运行时行为
┌─────────────────────────────────────────────────────────────┐
│  TypeScript: 类型只是编译时契约                              │
│                                                              │
│  Go/Rust/Java: 类型是运行时行为的一部分                      │
│    → interface/trait有runtime dispatch                      │
│                                                              │
│  强行统一 → 语义冲突                                         │
└─────────────────────────────────────────────────────────────┘
```

**结论**：语言特定Plugin + purityLevel分级是正确方向

---

**文档版本**: v3.0
**创建日期**: 2026-05-05
**第二轮更新**: 2026-05-05
**第三轮更新**: 2026-05-05
**状态**: 待评审（第三轮对抗讨论完成）

---

## 11. 第二轮对抗讨论

> Red Team深度攻击 + Blue Team针对性解决方案

### 11.1 Red Team攻击总结（第二轮）

第二轮攻击聚焦第一轮遗留问题和深度攻击场景：

```
┌─────────────────────────────────────────────────────────────┐
│               Red Team Attack Round 2                        │
├─────────────────────────────────────────────────────────────┤
│  问题1: 类型文件误判          难度: 极难 (★★★★★)            │
│  问题2: 空项目/单文件处理     难度: 中等 (★★★☆☆)            │
│  问题3: 跨层级引用检测        难度: 困难 (★★★★☆)            │
│  问题4: Layer role命名        难度: 中等 (★★★☆☆)            │
│  问题5: Agent prompt          难度: 中等 (★★★☆☆)            │
└─────────────────────────────────────────────────────────────┘
```

**问题1: 类型文件误判**

| 攻击点 | 描述 | 严重性 |
|--------|------|--------|
| Attack-1 | `import type` vs `import value` 边界模糊（文件混合类型和运行时值） | CRITICAL |
| Attack-2 | 旧语法无法区分type-only import（TypeScript 3.8之前） | HIGH |
| Attack-3 | Namespace vs Module影响判断 | HIGH |
| Attack-4 | 类型推断链式依赖打破层级假设 | MEDIUM |

**结论**: 可能无完美解决方案，需接受误判率

**问题2: 空项目/单文件处理**

| 攻击点 | 描述 | 严重性 |
|--------|------|--------|
| Attack-1 | 检测时机错误（函数存在但未调用） | HIGH |
| Attack-2 | 单文件定义模糊（是否排除配置文件） | MEDIUM |
| Attack-3 | 返回值语义冲突（空项目false vs 单文件true） | MEDIUM |
| Attack-4 | CLI用户体验设计 | LOW |

**结论**: 有完美方案（入口统一检测）

**问题3: 跨层级引用检测**

| 攻击点 | 描述 | 严重性 |
|--------|------|--------|
| Attack-1 | 跨层级定义不明确（跳1层 vs 跳2层） | CRITICAL |
| Attack-2 | 违规后处理策略缺失（仅警告无action） | HIGH |
| Attack-3 | 自动调整层级的副作用（级联效应） | HIGH |
| Attack-4 | 跨包层级引用处理（Monorepo） | MEDIUM |

**结论**: 有完美方案（仅警告不自动调整）

**问题4: Layer role命名**

| 攻击点 | 描述 | 严重性 |
|--------|------|--------|
| Attack-1 | 抽象命名 vs 具体命名两难 | HIGH |
| Attack-2 | 项目类型自动检测困难 | MEDIUM |
| Attack-3 | 国际化命名需求 | LOW |
| Attack-4 | Agent对role名称理解障碍 | LOW |

**结论**: 有完美方案（预设模板+用户自定义）

**问题5: Agent prompt**

| 攻击点 | 描述 | 严重性 |
|--------|------|--------|
| Attack-1 | 术语理解障碍（sourceRoot/monorepo/barrel exports） | HIGH |
| Attack-2 | Agent执行失败后二次fallback | MEDIUM |
| Attack-3 | 用户干预需求但用户可能不懂 | MEDIUM |
| Attack-4 | CLI直接调用场景无Agent | LOW |

**结论**: 有完美方案（简化prompt+默认降级）

### 11.2 Blue Team解决方案总结（第二轮）

**问题1解决方案：FileTypeInfo检测**

```typescript
interface FileTypeInfo {
  isPureTypeFile: boolean;      // 仅导出类型
  hasRuntimeContent: boolean;   // 包含运行时代码
  typeImportRatio: number;      // 类型导入占比 (0-1)
  detectedBy: 'filename' | 'content' | 'imports';
}

// Score调整公式
function adjustTypeFileScore(baseScore: number, info: FileTypeInfo): number {
  if (info.isPureTypeFile) {
    return baseScore - 50;  // 强制降级到中间层
  }
  if (info.typeImportRatio > 0.7) {
    return baseScore - 20;  // 部分降级
  }
  return baseScore;
}

// Layer 0策略: 新增Types层（编译时依赖）
const TYPE_LAYER_CONFIG = {
  layer: 0,
  role: 'Types',
  description: '编译时类型定义，无运行时依赖',
  confidence: 1.0,
  rules: ['.d.ts', 'types.ts', 'interfaces.ts']
};
```

**评分**: 8/10，复杂度：中等

**问题2解决方案：Phase 0检测整合**

```typescript
interface SpecialCaseResult {
  type: 'empty' | 'single-file' | 'single-group' | 'normal';
  sourceFiles: string[];
  warning?: string;
}

function detectSpecialCases(projectRoot: string): SpecialCaseResult {
  const sourceFiles = findSourceFiles(projectRoot);
  
  if (sourceFiles.length === 0) {
    return { type: 'empty', sourceFiles: [], warning: 'Empty project' };
  }
  
  if (sourceFiles.length === 1) {
    return { 
      type: 'single-file', 
      sourceFiles, 
      warning: 'Single file - trivial layer structure' 
    };
  }
  
  // 检测是否所有文件在同一目录（单组）
  const directories = new Set(sourceFiles.map(f => dirname(f)));
  if (directories.size === 1) {
    return { 
      type: 'single-group', 
      sourceFiles, 
      warning: 'Single directory - flat structure' 
    };
  }
  
  return { type: 'normal', sourceFiles };
}

function handleSpecialCase(result: SpecialCaseResult): LayersResult {
  switch (result.type) {
    case 'empty':
      return { 
        success: false, 
        error: 'Empty project - no files to analyze',
        layers: [] 
      };
    case 'single-file':
      return { 
        success: true, 
        layers: [{
          layer: 1, 
          role: 'Single File', 
          groups: [{ name: basename(result.sourceFiles[0]), fileCount: 1 }],
          confidence: 1.0
        }],
        warnings: [result.warning]
      };
    default:
      return proceedWithNormalInference(result.sourceFiles);
  }
}
```

**评分**: 9/10，复杂度：低

**问题3解决方案：Violation处理策略**

```typescript
interface ViolationLevel {
  level: 'minor' | 'moderate' | 'critical';
  threshold: number;  // 跨层级数: 1/2/3+
  reportLevel: 'info' | 'warning' | 'error';
  suggestion: string;
  autoFix: boolean;
  ciBlock: boolean;  // CI/CD阻断
}

const VIOLATION_LEVELS: ViolationLevel[] = [
  { level: 'minor', threshold: 1, reportLevel: 'info', autoFix: false, ciBlock: false },
  { level: 'moderate', threshold: 2, reportLevel: 'warning', autoFix: false, ciBlock: false },
  { level: 'critical', threshold: 3, reportLevel: 'error', autoFix: false, ciBlock: true }
];

interface RemediationStrategy {
  type: 'move-file' | 'add-interface' | 'extract-module' | 'none';
  description: string;
  affectedFiles: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
}

function generateRemediation(violation: Violation): RemediationStrategy {
  if (violation.crossLayerCount === 1) {
    return { 
      type: 'add-interface', 
      description: 'Add interface layer between layers',
      affectedFiles: [violation.sourceFile],
      estimatedEffort: 'low'
    };
  }
  
  if (violation.crossLayerCount >= 2) {
    return { 
      type: 'move-file', 
      description: 'Move file to appropriate layer',
      affectedFiles: [violation.sourceFile],
      estimatedEffort: 'medium'
    };
  }
  
  return { type: 'none', description: 'No automatic fix', affectedFiles: [], estimatedEffort: 'low' };
}

// Monorepo跨包配置
interface MonorepoLayerConfig {
  mode: 'independent' | 'cross-package-constrained';
  crossPackagePolicy: 'allow' | 'warn' | 'block';
}
```

**评分**: 7/10，复杂度：中等

**问题4解决方案：抽象Role系统**

```typescript
// 抽象Role系统 - 移除固定语义，用户可配置
interface LayerRoleConfig {
  abstractName: string;      // Layer1, Layer2...
  concreteRole?: string;     // 用户自定义: Foundation, Domain...
  description: string;
}

const DEFAULT_ROLES_BY_PROJECT_TYPE: Record<ProjectType, LayerRoleConfig[]> = {
  'web-app': [
    { abstractName: 'Layer1', concreteRole: 'Foundation', description: 'Base infrastructure' },
    { abstractName: 'Layer2', concreteRole: 'Core', description: 'Business logic' },
    { abstractName: 'Layer3', concreteRole: 'Application', description: 'App services' },
    { abstractName: 'Layer4', concreteRole: 'Presentation', description: 'UI components' }
  ],
  'cli': [
    { abstractName: 'Layer1', concreteRole: 'Foundation', description: 'Core utilities' },
    { abstractName: 'Layer2', concreteRole: 'Domain', description: 'Domain logic' },
    { abstractName: 'Layer3', concreteRole: 'Service', description: 'Service layer' },
    { abstractName: 'Layer4', concreteRole: 'CLI', description: 'CLI interface' }
  ],
  'library': [
    { abstractName: 'Layer1', concreteRole: 'Foundation', description: 'Core exports' },
    { abstractName: 'Layer2', concreteRole: 'Core', description: 'Main functionality' },
    { abstractName: 'Layer3', concreteRole: 'API', description: 'Public API' }
  ],
  'generic': [
    { abstractName: 'Layer1', description: 'Lowest dependency' },
    { abstractName: 'Layer2', description: 'Medium dependency' },
    { abstractName: 'Layer3', description: 'Highest dependency' }
  ]
};

// 项目类型检测算法
function detectProjectType(projectRoot: string): ProjectType {
  const signals = {
    hasReact: checkPackageJson('react'),
    hasVue: checkPackageJson('vue'),
    hasNextJs: checkPackageJson('next'),
    hasExpress: checkPackageJson('express'),
    hasCLIEntry: checkFile('cli.ts', 'cli.js', 'index.ts'),
    hasExports: checkPackageJsonExports()
  };
  
  if (signals.hasReact || signals.hasVue || signals.hasNextJs) return 'web-app';
  if (signals.hasExpress) return 'api-service';
  if (signals.hasCLIEntry) return 'cli';
  if (signals.hasExports) return 'library';
  
  return 'generic';
}

// Layer配置文件格式
// .codegraph/layer-config.json
{
  "projectType": "cli",
  "customRoles": {
    "Layer1": "Infrastructure",
    "Layer2": "Domain"
  }
}
```

**评分**: 7/10，复杂度：中等

**问题5解决方案：分级Prompt系统**

```typescript
interface FallbackPromptLevel {
  level: 1 | 2 | 3;
  target: 'agent' | 'user' | 'auto';
  complexity: 'simple' | 'detailed' | 'minimal';
}

const PROMPT_LEVELS: FallbackPromptLevel[] = [
  { 
    level: 1, 
    target: 'agent', 
    complexity: 'simple',
    template: `
Cannot find sourceRoot. Suggested paths:
${suggestions.map(s => `- ${s}`).join('\n')}

Select one or provide custom path.
    `
  },
  { 
    level: 2, 
    target: 'user', 
    complexity: 'detailed',
    template: `
## Source Root Discovery Failed

**Diagnosis:**
- File distribution: ${fileDistribution}
- Most likely roots: ${suggestions}

**Actions:**
1. Confirm source directory
2. Run: codegraph analyze --source-root <path>
3. Skip layer analysis
    `
  },
  { 
    level: 3, 
    target: 'auto', 
    complexity: 'minimal',
    action: 'Use cwd as sourceRoot'
  }
];

function handleEmptySourceRoot(
  context: InferenceContext
): FallbackAction {
  
  // Level 1: Agent简化prompt
  if (context.isAgentMode) {
    const suggestions = suggestSourceRoots(context);
    return { 
      type: 'suggest', 
      prompt: PROMPT_LEVELS[0].template,
      suggestions 
    };
  }
  
  // Level 2: 用户详细prompt
  if (context.hasUserInteraction) {
    const distribution = analyzeFileDistribution(context.projectRoot);
    return { 
      type: 'suggest', 
      prompt: PROMPT_LEVELS[1].template,
      distribution 
    };
  }
  
  // Level 3: 自动降级
  return { 
    type: 'auto-degrade', 
    sourceRoot: context.projectRoot,
    warning: 'Using cwd as fallback sourceRoot'
  };
}

// CLI场景区分
function emitFallbackOutput(action: FallbackAction, isAgent: boolean): void {
  if (isAgent) {
    // Agent模式：stdout输出结构化数据
    console.log(JSON.stringify(action));
  } else {
    // CLI模式：stderr输出警告，stdout输出结果
    if (action.warning) {
      process.stderr.write(`WARNING: ${action.warning}\n`);
    }
    console.log(action.sourceRoot);
  }
}
```

**评分**: 8/10，复杂度：低

### 11.3 综合判断表格（第二轮）

| 问题 | Red Team难度 | Blue Team评分 | 复杂度 | 最终状态 | 结论 |
|------|-------------|--------------|--------|----------|------|
| 问题1: 类型文件误判 | ★★★★★ | 8/10 | 中等 | ⚠️ 部分解决 | 有方案但需接受误判率 |
| 问题2: 空项目/单文件 | ★★★☆☆ | 9/10 | 低 | ✅ 已解决 | Phase 0统一检测完美方案 |
| 问题3: 跨层级引用 | ★★★★☆ | 7/10 | 中等 | ✅ 已解决 | 仅警告不自动调整 |
| 问题4: Layer role命名 | ★★★☆☆ | 7/10 | 中等 | ✅ 已解决 | 预设模板+用户自定义 |
| 问题5: Agent prompt | ★★★☆☆ | 8/10 | 低 | ✅ 已解决 | 分级prompt+多级fallback |

**第二轮总体评分提升**: 6/10 → 7.5/10

---

## 12. 最终未解决问题评估

> 基于第二轮讨论的最终状态

### 12.1 问题解决状态矩阵

```
┌─────────────────────────────────────────────────────────────┐
│           Problem Resolution Status Matrix                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ✅ 已解决 (4/5):                                            │
│    ├── 问题2: 空项目/单文件 - Blue Team完整方案              │
│    ├── 问题3: 跨层级引用   - 仅警告不自动调整                │
│    ├── 问题4: Layer role   - 预设模板+用户自定义             │
│    ├── 问题5: Agent prompt - 分级prompt+默认降级             │
│                                                              │
│  ⚠️ 部分解决 (1/5):                                          │
│    └── 问题1: 类型文件误判 - 有方案但需接受误判率            │
│                                                              │
│  ❌ 仍需设计 (0/5):                                           │
│    └── 无                                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 12.2 问题1（类型文件误判）深入分析

**为什么无法完美解决**:

```
根本矛盾:
┌─────────────────────────────────────────────────────────────┐
│  import type { Foo } from './types';                        │
│  import { Bar } from './types';  // Bar可能是类型别名       │
│                                                             │
│  TypeScript编译器知道，但静态分析工具不知道                  │
│  需要完整TypeScript API支持                                 │
└─────────────────────────────────────────────────────────────┘
```

**Edge Case清单**:

| Edge Case | 描述 | 处理策略 |
|-----------|------|----------|
| 混合文件 | 同时导出类型和运行时值 | typeImportRatio > 0.7 → -20惩罚 |
| .d.ts文件 | 纯类型声明文件 | 直接排除或Layer 0 |
| namespace导出 | `export namespace Types {}` | 需特殊检测 |
| 旧语法 | TypeScript < 3.8 无 `import type` | 无法区分，接受误判 |
| 类型推断链 | `type A = B; type B = C;` | 静态分析无法追踪 |

**建议误判率容忍度**: 5-10%

---

## 13. 实现优先级（第二轮）

> 基于解决方案评分和复杂度的最终优先级

```
┌─────────────────────────────────────────────────────────────┐
│             Implementation Priority (Round 2)                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  P0: 立即实现                                                │
│    └── 问题2: 空项目/单文件处理                              │
│        ├── 理由: Blue Team评分9/10，复杂度低                │
│        ├── 工时: 4h                                         │
│        └── 依赖: 无                                         │
│                                                              │
│  P1: 下一批次                                                │
│    └── 问题5: Agent prompt简化                              │
│        ├── 理由: Blue Team评分8/10，复杂度低                │
│        ├── 工时: 6h                                         │
│        └── 依赖: 无                                         │
│                                                              │
│  P2: 需外部支持                                              │
│    ├── 问题1: 类型文件检测                                   │
│    │   ├── 理由: 需TypeScript API配合                       │
│    │   ├── 工时: 12h                                        │
│    │   └── 依赖: typescript-adapter扩展                     │
│    │                                                        │
│    └── 问题3: Violation处理策略                              │
│        ├── 理由: 策略设计需careful                           │
│        ├── 工时: 8h                                         │
│        └── 依赖: CI/CD集成设计                              │
│                                                              │
│  P3: 长期优化                                                │
│    └── 问题4: Layer role配置系统                             │
│        ├── 琔由: 需用户配置机制                             │
│        ├── 工时: 10h                                        │
│        └── 依赖: 配置文件设计                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 13.1 详细实现计划

**P0实现计划（问题2）**:

| 步骤 | 任务 | 预估工时 | 输出 |
|------|------|----------|------|
| 1 | 定义SpecialCaseResult类型 | 0.5h | interface定义 |
| 2 | 实现detectSpecialCases函数 | 1h | 检测函数 |
| 3 | 实现handleSpecialCase函数 | 1h | 处理函数 |
| 4 | 集成到getArchitectureLayers入口 | 1h | API入口修改 |
| 5 | 单元测试 | 1h | test coverage |

**P1实现计划（问题5）**:

| 步骤 | 任务 | 预估工时 | 输出 |
|------|------|----------|------|
| 1 | 定义FallbackPromptLevel类型 | 0.5h | interface定义 |
| 2 | 实现PROMPT_LEVELS模板 | 1h | 模板常量 |
| 3 | 实现handleEmptySourceRoot函数 | 2h | fallback处理 |
| 4 | 实现emitFallbackOutput CLI区分 | 1h | 输出处理 |
| 5 | 单元测试 | 1.5h | test coverage |

---

## 14. 关键文件路径

> 需要修改/新增的文件清单

### 14.1 需修改文件

```
packages/codegraph/src/
├── api/
│   └── layers/
│       ├── index.ts                    # [MODIFY] Layers API入口
│       │   └── 添加: Phase 0 detectSpecialCases调用
│       │
│       ├── inference/
│       │   ├── core.ts                 # [MODIFY] Layer推断核心
│       │   │   └── 添加: FileTypeInfo检测
│       │   │   └── 添加: 类型文件Score调整
│       │   │
│       │   └── violations.ts           # [MODIFY] Violation检测
│       │       └── 添加: ViolationLevel定义
│       │       └── 添加: RemediationStrategy生成
│       │       └── 添加: Monorepo跨包检测
│       │
│       ├── source-root-fallback.ts     # [NEW] sourceRoot fallback处理
│       │   └── 新增: FallbackPromptLevel
│       │   └── 新增: handleEmptySourceRoot
│       │   └── 新增: suggestSourceRoots
│       │   └── 新增: analyzeFileDistribution
│       │
│       └── remediation.ts              # [NEW] 补救策略生成
│           └── 新增: generateRemediation
│           └── 新增: RemediationStrategy类型
│           └── 新增: CI/CD report生成
│
├── parser/
│   └── typescript-adapter.ts           # [MODIFY] TypeScript parser
│       └── 添加: import type metadata解析
│       └── 添加: typeImportRatio计算
│       └── 添加: FileTypeInfo生成
│
├── config/
│   ├── project-type-detector.ts        # [NEW] 项目类型检测
│   │   └── 新增: detectProjectType函数
│   │   └── 新增: DEFAULT_ROLES_BY_PROJECT_TYPE
│   │   └── 新增: 项目特征信号检测
│   │
│   └── layer-config-loader.ts          # [NEW] Layer配置加载
│       └── 新增: .codegraph/layer-config.json解析
│       └── 新增: customRoles合并逻辑
│
└── types/
    └── layer-types.ts                  # [MODIFY] 类型定义扩展
        └── 添加: FileTypeInfo接口
        └── 添加: SpecialCaseResult接口
        └── 添加: ViolationLevel接口
        └── 添加: RemediationStrategy接口
        └── 添加: LayerRoleConfig接口
        └── 添加: FallbackPromptLevel接口
```

### 14.2 新增文件职责

| 文件 | 职责 | 依赖 |
|------|------|------|
| source-root-fallback.ts | sourceRoot fallback多级处理 | 无 |
| remediation.ts | Violation补救策略生成 | violations.ts |
| project-type-detector.ts | 项目类型自动检测 | package.json解析 |
| layer-config-loader.ts | 用户自定义Layer配置加载 | project-type-detector.ts |

### 14.3 文件依赖关系图

```
                    index.ts (API入口)
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
  core.ts         violations.ts    source-root-fallback.ts
        │               │               │
        │               ▼               │
        │         remediation.ts        │
        │               │               │
        ▼               │               │
typescript-adapter.ts   │               │
        │               │               │
        └───────────────┼───────────────┤
                        │               │
                        ▼               ▼
              project-type-detector.ts  layer-config-loader.ts
                        │               │
                        └───────────────┼
                                        │
                                        ▼
                                  layer-types.ts (类型定义)
```

### 14.4 测试文件清单

```
packages/codegraph/src/
└── __tests__/
    └── api/
        └── layers/
            ├── special-cases.test.ts       # [NEW] Phase 0检测测试
            │   └── 测试: 空项目/单文件/单组
            │
            ├── type-file-detection.test.ts # [NEW] 类型文件测试
            │   └── 测试: 纯类型/混合/误判率
            │
            ├── violation-handling.test.ts  # [NEW] Violation测试
            │   └── 测试: 跨层级检测/补救策略
            │
            ├── fallback-prompt.test.ts     # [NEW] Fallback测试
            │   └── 测试: Agent/User/Auto三级
            │
            └── project-type.test.ts        # [NEW] 项目类型测试
                └── 测试: web-app/cli/library/generic检测
```

---

## 附录：第二轮讨论总结

### Red Team攻击有效性

第二轮攻击发现5个新问题，其中：
- 极难问题1个（类型文件误判）
- 困难问题1个（跨层级引用）
- 中等问题3个（空项目、Layer role、Agent prompt）

### Blue Team解决方案质量

| 评分维度 | 平均得分 |
|----------|----------|
| 方案完整性 | 8.2/10 |
| 实现可行性 | 7.8/10 |
| Edge Case覆盖 | 7.5/10 |
| 文档清晰度 | 8.0/10 |

### 最终推荐方案

1. **立即实现**: 问题2（空项目/单文件）- 评分最高，复杂度最低
2. **下一批次**: 问题5（Agent prompt）- 简化prompt收益大
3. **需TypeScript支持**: 问题1（类型文件）- 无法纯静态解决
4. **策略设计需careful**: 问题3（Violation）- 不自动调整避免副作用
5. **需用户配置机制**: 问题4（Layer role）- 配置文件设计