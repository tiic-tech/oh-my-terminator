# CodeGraph C6: 基线版本管理技术规格

> **文档定位**: Change 6 `cg-baseline-persistence` 的详细技术规格，定义基线版本兼容性、迁移策略和失败处理机制。
>
> **关联文档**:
> - [01_origin_blueprint.md](./01_origin_blueprint.md) §3.4 Baseline结构、§5.1基线存储
> - [develop_changes_plan.md](./develop_changes_plan.md) Change 6定义

---

## 目录

1. [Baseline结构扩展](#1-baseline结构扩展)
2. [版本兼容性检查](#2-版本兼容性检查)
3. [不兼容处理策略](#3-不兼容处理策略)
4. [loadBaseline失败处理](#4-loadbaseline失败处理)
5. [升级路径设计](#5-升级路径设计)
6. [测试场景](#6-测试场景)

---

## 1. Baseline结构扩展

### 1.1 当前结构（Blueprint定义）

```typescript
interface Baseline {
  graph: SerializedCodeGraph;
  commitHash: string;
  timestamp: number;
  architectureConstraints: string[];
  healthScore: number;
  skillDemand: SkillDemand;
}
```

### 1.2 扩展后的结构

```typescript
interface Baseline {
  // ===== 核心数据 =====
  graph: SerializedCodeGraph;
  commitHash: string;
  timestamp: number;

  // ===== 版本元数据（新增） =====
  schemaVersion: SchemaVersion;        // Schema版本标识
  generatorVersion: string;            // 生成工具版本 (e.g. "1.0.0")

  // ===== 智能分析结果 =====
  architectureConstraints: string[];
  healthScore: number;
  skillDemand: SkillDemand;

  // ===== 兼容性标记 =====
  migrationHistory?: MigrationRecord[];  // 迁移历史记录
  deprecated?: boolean;                  // 是否已废弃（触发重建）
}

interface SchemaVersion {
  major: number;      // 主版本：不兼容变更
  minor: number;      // 次版本：向后兼容的新功能
  patch: number;      // 补丁版本：向后兼容的修复

  // 版本字符串格式: "major.minor.patch" (e.g. "1.0.0")
  toString(): string;
}

interface MigrationRecord {
  fromVersion: string;    // 原版本
  toVersion: string;      // 目标版本
  migratedAt: number;     // 迁移时间戳
  strategy: 'migrate' | 'rebuild';  // 使用的策略
}

// SerializedCodeGraph 同步更新
interface SerializedCodeGraph {
  nodes: [string, GraphNode][];
  edges: GraphEdge[];
  commitHash: string;
  timestamp: number;

  // 新增字段
  schemaVersion?: SchemaVersion;  // 可选，兼容旧基线
}
```

### 1.3 版本演进规则

遵循语义化版本（Semantic Versioning）：

| 版本级别 | 变更类型 | 示例 |
|---------|---------|-----|
| **Major** | 破坏性变更，不兼容旧版本 | 节点类型枚举重命名、图结构重组 |
| **Minor** | 新增功能，向后兼容 | 新增元数据字段、新增边类型 |
| **Patch** | Bug修复，向后兼容 | 复杂度计算公式调整、序列化格式优化 |

**初始版本**: `1.0.0`

### 1.4 版本存储位置

```
.codegraph/
├── baseline.json         # 包含 schemaVersion
├── lastCommit.txt        # Git commit hash
├── history.ldjson        # DeltaSummary记录（每条含版本）
└── .version              # 单独版本文件（可选，用于快速检查）
```

`.version` 文件格式：
```json
{
  "schema": "1.0.0",
  "generator": "1.0.0",
  "lastMigration": null
}
```

---

## 2. 版本兼容性检查

### 2.1 checkSchemaCompatibility 函数

```typescript
/**
 * 检查基线schema兼容性
 * @param baseline 加载的基线数据
 * @param currentVersion 当前工具支持的schema版本
 * @returns 兼容性结果
 */
function checkSchemaCompatibility(
  baseline: Baseline,
  currentVersion: SchemaVersion
): CompatibilityResult {
  // 无版本标识的旧基线
  if (!baseline.schemaVersion) {
    return {
      compatible: false,
      reason: 'legacy_baseline',
      action: 'rebuild',
      message: 'Legacy baseline without schema version - requires rebuild'
    };
  }

  const baselineV = baseline.schemaVersion;
  const currentV = currentVersion;

  // Major版本不匹配 -> 不兼容
  if (baselineV.major !== currentV.major) {
    return {
      compatible: false,
      reason: 'major_version_mismatch',
      action: baselineV.major < currentV.major ? 'migrate' : 'rebuild',
      message: `Major version mismatch: baseline=${baselineV}, current=${currentV}`,
      details: {
        baselineVersion: baselineV.toString(),
        currentVersion: currentV.toString()
      }
    };
  }

  // Minor版本较低 -> 可兼容，建议迁移
  if (baselineV.minor < currentV.minor) {
    return {
      compatible: true,
      reason: 'minor_version_old',
      action: 'migrate',
      message: `Baseline minor version outdated: ${baselineV} < ${currentV}`
    };
  }

  // Patch版本较低 -> 可兼容，可选迁移
  if (baselineV.patch < currentV.patch) {
    return {
      compatible: true,
      reason: 'patch_version_old',
      action: 'proceed',  // 可直接使用，无需迁移
      message: `Baseline patch version outdated: ${baselineV} < ${currentV}`
    };
  }

  // 版本完全匹配或更高 -> 完全兼容
  return {
    compatible: true,
    reason: 'version_match',
    action: 'proceed',
    message: `Version compatible: ${baselineV}`
  };
}

interface CompatibilityResult {
  compatible: boolean;         // 是否可直接使用
  reason: CompatibilityReason; // 不兼容原因
  action: CompatibilityAction; // 建议的处理策略
  message: string;             // 人类可读的消息
  details?: {                  // 详细信息
    baselineVersion?: string;
    currentVersion?: string;
  };
}

type CompatibilityReason =
  | 'legacy_baseline'          // 无版本标识的旧基线
  | 'major_version_mismatch'   // 主版本不匹配
  | 'minor_version_old'        // 次版本落后
  | 'patch_version_old'        // 补丁版本落后
  | 'version_match'            // 版本匹配
  | 'version_future';          // 基线版本高于当前（警告）

type CompatibilityAction =
  | 'error'      // 报错退出
  | 'rebuild'    // 重新全量分析
  | 'migrate'    // 尝试迁移
  | 'proceed';   // 直接使用
```

### 2.2 版本比较逻辑

```typescript
class SchemaVersion {
  major: number;
  minor: number;
  patch: number;

  constructor(major: number, minor: number, patch: number) {
    this.major = major;
    this.minor = minor;
    this.patch = patch;
  }

  toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  }

  static parse(versionStr: string): SchemaVersion {
    const parts = versionStr.split('.');
    if (parts.length !== 3) {
      throw new Error(`Invalid version format: ${versionStr}`);
    }
    return new SchemaVersion(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10),
      parseInt(parts[2], 10)
    );
  }

  // 比较操作
  isGreaterThan(other: SchemaVersion): boolean {
    return (
      this.major > other.major ||
      (this.major === other.major && this.minor > other.minor) ||
      (this.major === other.major && this.minor === other.minor && this.patch > other.patch)
    );
  }

  isCompatibleWith(other: SchemaVersion): boolean {
    // Major版本相同即为兼容
    return this.major === other.major;
  }
}
```

### 2.3 当前版本定义

```typescript
// packages/codegraph/src/version.ts
export const CURRENT_SCHEMA_VERSION = new SchemaVersion(1, 0, 0);
export const GENERATOR_VERSION = '1.0.0';

// 版本更新时机
// - Major: 图结构核心字段变更（NodeType/EdgeType重定义）
// - Minor: 新增可选字段（GraphNode.metadata扩展）
// - Patch: 计算逻辑优化（不影响数据结构）
```

---

## 3. 不兼容处理策略

### 3.1 四种策略详解

| 策略 | 适用场景 | 行为 | 用户提示 |
|-----|---------|-----|---------|
| **error** | 严重不兼容，无法自动处理 | 抛出错误，终止操作 | "Baseline incompatible, manual intervention required" |
| **rebuild** | 结构变更无法迁移 | 执行全量重新分析 | "Rebuilding baseline due to schema changes..." |
| **migrate** | 可自动迁移的变更 | 执行迁移脚本，更新基线 | "Migrating baseline from v{old} to v{new}..." |
| **proceed** | 兼容或微小差异 | 直接加载使用 | "Loading compatible baseline..." |

### 3.2 策略选择矩阵

```typescript
function determineAction(result: CompatibilityResult, config?: ActionConfig): CompatibilityAction {
  // 用户配置覆盖默认策略
  if (config?.forceAction) {
    return config.forceAction;
  }

  // 默认策略矩阵
  switch (result.reason) {
    case 'legacy_baseline':
      return 'rebuild';  // 旧基线无版本信息，强制重建

    case 'major_version_mismatch':
      // 基线版本更高 -> 报错（未来版本）
      if (result.details?.baselineVersion && result.details.currentVersion) {
        const baselineV = SchemaVersion.parse(result.details.baselineVersion);
        const currentV = SchemaVersion.parse(result.details.currentVersion);
        if (baselineV.isGreaterThan(currentV)) {
          return 'error';  // 基线来自未来版本，无法处理
        }
      }
      // 基线版本较低 -> 尝试迁移
      return 'migrate';

    case 'minor_version_old':
      return config?.autoMigrate ? 'migrate' : 'proceed';  // 可选迁移

    case 'patch_version_old':
      return 'proceed';  // 直接使用

    case 'version_match':
      return 'proceed';

    default:
      return 'error';  // 未知情况，安全报错
  }
}

interface ActionConfig {
  forceAction?: CompatibilityAction;    // 强制使用指定策略
  autoMigrate?: boolean;                // 是否自动迁移minor版本差异
  allowRebuild?: boolean;               // 是否允许自动重建
}
```

### 3.3 策略执行实现

```typescript
async function executeAction(
  action: CompatibilityAction,
  baseline: Baseline | null,
  cwd: string,
  config?: ActionConfig
): Promise<ActionResult> {
  switch (action) {
    case 'error':
      throw new IncompatibleBaselineError(
        'Baseline schema incompatible with current version. ' +
        'Please run `codegraph analyze --force` to rebuild.'
      );

    case 'rebuild':
      if (!config?.allowRebuild && !config?.forceAction) {
        // 询问用户确认
        console.log('Baseline schema requires rebuild. Continue? [y/N]');
        const answer = await promptUser();
        if (answer !== 'y') {
          throw new Error('Rebuild cancelled by user');
        }
      }
      console.log('Rebuilding baseline...');
      const graph = await analyzeFull(cwd);
      return { graph, action: 'rebuild', migrated: false };

    case 'migrate':
      if (!baseline) {
        throw new Error('Cannot migrate: no baseline loaded');
      }
      console.log(`Migrating baseline from v${baseline.schemaVersion} to v${CURRENT_SCHEMA_VERSION}...`);
      const migratedBaseline = await migrateBaseline(baseline, cwd);
      return { graph: migratedBaseline.graph, action: 'migrate', migrated: true };

    case 'proceed':
      if (!baseline) {
        throw new Error('Cannot proceed: no baseline loaded');
      }
      return { graph: baseline.graph, action: 'proceed', migrated: false };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

interface ActionResult {
  graph: CodeGraph;
  action: CompatibilityAction;
  migrated: boolean;
}

class IncompatibleBaselineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IncompatibleBaselineError';
  }
}
```

---

## 4. loadBaseline失败处理

### 4.1 失败场景分类

```typescript
type LoadFailureReason =
  | 'file_not_found'          // baseline.json不存在
  | 'parse_error'             // JSON解析失败
  | 'invalid_structure'       // 结构不符合预期
  | 'schema_incompatible'     // schema版本不兼容
  | 'corrupted_data'          // 数据损坏（校验失败）
  | 'permission_error';       // 文件权限问题
```

### 4.2 loadBaseline实现

```typescript
async function loadBaseline(
  cwd: string,
  options?: LoadBaselineOptions
): Promise<LoadBaselineResult> {
  const baselinePath = join(cwd, '.codegraph/baseline.json');

  // Step 1: 检查文件存在
  if (!await fileExists(baselinePath)) {
    return handleFailure('file_not_found', cwd, options);
  }

  // Step 2: 读取并解析JSON
  let rawContent: string;
  try {
    rawContent = await readFile(baselinePath, 'utf-8');
  } catch (e) {
    return handleFailure('permission_error', cwd, options, e);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (e) {
    return handleFailure('parse_error', cwd, options, e);
  }

  // Step 3: 结构验证
  const validationResult = validateBaselineStructure(parsed);
  if (!validationResult.valid) {
    return handleFailure('invalid_structure', cwd, options, validationResult);
  }

  const baseline = parsed as Baseline;

  // Step 4: 数据完整性校验
  const integrityResult = verifyDataIntegrity(baseline);
  if (!integrityResult.valid) {
    return handleFailure('corrupted_data', cwd, options, integrityResult);
  }

  // Step 5: 版本兼容性检查
  const compatResult = checkSchemaCompatibility(baseline, CURRENT_SCHEMA_VERSION);

  // Step 6: 根据兼容性和配置决定下一步
  if (!compatResult.compatible) {
    return handleFailure('schema_incompatible', cwd, options, compatResult);
  }

  // Step 7: 执行选定的action
  const action = determineAction(compatResult, options?.actionConfig);
  const actionResult = await executeAction(action, baseline, cwd, options?.actionConfig);

  return {
    success: true,
    graph: actionResult.graph,
    baseline,
    compatibility: compatResult,
    executedAction: actionResult.action,
    migrated: actionResult.migrated
  };
}

interface LoadBaselineOptions {
  actionConfig?: ActionConfig;
  onFailure?: FailureHandler;          // 自定义失败处理
  strict?: boolean;                    // 严格模式（不允许自动修复）
}

interface LoadBaselineResult {
  success: boolean;
  graph?: CodeGraph;
  baseline?: Baseline;
  compatibility?: CompatibilityResult;
  executedAction?: CompatibilityAction;
  migrated?: boolean;
  failure?: FailureInfo;
}

interface FailureInfo {
  reason: LoadFailureReason;
  error?: Error;
  details?: unknown;
}
```

### 4.3 失败处理函数

```typescript
async function handleFailure(
  reason: LoadFailureReason,
  cwd: string,
  options?: LoadBaselineOptions,
  details?: unknown
): Promise<LoadBaselineResult> {
  // 自定义处理优先
  if (options?.onFailure) {
    return options.onFailure(reason, cwd, details);
  }

  // 默认处理策略
  switch (reason) {
    case 'file_not_found':
      // 无基线 -> 自动全量分析（首次运行）
      console.log('No baseline found. Running full analysis...');
      const graph = await analyzeFull(cwd);
      return {
        success: true,
        graph,
        executedAction: 'rebuild',
        migrated: false
      };

    case 'parse_error':
      // JSON损坏 -> 提示用户选择
      console.error('Failed to parse baseline.json:', details);
      console.log('Options:');
      console.log('  1. Rebuild baseline (codegraph analyze --force)');
      console.log('  2. Restore from backup (if available)');
      return {
        success: false,
        failure: { reason, details }
      };

    case 'invalid_structure':
      // 结构不符合 -> 自动重建（除非严格模式）
      if (options?.strict) {
        return {
          success: false,
          failure: { reason, details }
        };
      }
      console.warn('Baseline structure invalid. Rebuilding...');
      const rebuiltGraph = await analyzeFull(cwd);
      return {
        success: true,
        graph: rebuiltGraph,
        executedAction: 'rebuild',
        migrated: false
      };

    case 'schema_incompatible':
      // 版本不兼容 -> 根据compatResult决定
      const compatResult = details as CompatibilityResult;
      if (options?.actionConfig?.forceAction) {
        const actionResult = await executeAction(
          options.actionConfig.forceAction,
          null,
          cwd,
          options.actionConfig
        );
        return {
          success: true,
          graph: actionResult.graph,
          executedAction: actionResult.action,
          migrated: actionResult.migrated
        };
      }
      return {
        success: false,
        failure: { reason, details: compatResult }
      };

    case 'corrupted_data':
      // 数据损坏 -> 自动重建
      console.error('Baseline data corrupted:', details);
      console.log('Rebuilding baseline...');
      const recoveredGraph = await analyzeFull(cwd);
      return {
        success: true,
        graph: recoveredGraph,
        executedAction: 'rebuild',
        migrated: false
      };

    case 'permission_error':
      // 权限问题 -> 报错
      return {
        success: false,
        failure: { reason, details }
      };

    default:
      return {
        success: false,
        failure: { reason, details }
      };
  }
}
```

### 4.4 结构验证函数

```typescript
function validateBaselineStructure(data: unknown): ValidationResult {
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Baseline must be an object'] };
  }

  const baseline = data as Record<string, unknown>;
  const errors: string[] = [];

  // 必需字段
  const requiredFields = ['graph', 'commitHash', 'timestamp'];
  for (const field of requiredFields) {
    if (!(field in baseline)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // graph字段验证
  if (baseline.graph) {
    const graphErrors = validateSerializedGraph(baseline.graph);
    errors.push(...graphErrors);
  }

  // timestamp验证
  if (baseline.timestamp && typeof baseline.timestamp !== 'number') {
    errors.push('timestamp must be a number');
  }

  // commitHash验证
  if (baseline.commitHash && typeof baseline.commitHash !== 'string') {
    errors.push('commitHash must be a string');
  }

  // schemaVersion验证（可选）
  if (baseline.schemaVersion) {
    const versionErrors = validateSchemaVersion(baseline.schemaVersion);
    errors.push(...versionErrors);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateSerializedGraph(graph: unknown): string[] {
  const errors: string[] = [];
  if (!graph || typeof graph !== 'object') {
    errors.push('graph must be an object');
    return errors;
  }

  const g = graph as Record<string, unknown>;

  if (!Array.isArray(g.nodes)) {
    errors.push('graph.nodes must be an array');
  }

  if (!Array.isArray(g.edges)) {
    errors.push('graph.edges must be an array');
  }

  return errors;
}

function validateSchemaVersion(version: unknown): string[] {
  const errors: string[] = [];
  if (!version || typeof version !== 'object') {
    errors.push('schemaVersion must be an object');
    return errors;
  }

  const v = version as Record<string, unknown>;
  if (typeof v.major !== 'number') errors.push('schemaVersion.major must be number');
  if (typeof v.minor !== 'number') errors.push('schemaVersion.minor must be number');
  if (typeof v.patch !== 'number') errors.push('schemaVersion.patch must be number');

  return errors;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

### 4.5 数据完整性校验

```typescript
function verifyDataIntegrity(baseline: Baseline): IntegrityResult {
  const errors: string[] = [];

  // 节点ID唯一性检查
  const nodeIds = new Set<string>();
  for (const [id, node] of baseline.graph.nodes) {
    if (nodeIds.has(id)) {
      errors.push(`Duplicate node ID: ${id}`);
    }
    nodeIds.add(id);

    // 节点自引用检查
    if (node.id !== id) {
      errors.push(`Node ID mismatch: stored=${id}, node.id=${node.id}`);
    }
  }

  // 边引用有效性检查
  for (const edge of baseline.graph.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`Edge references missing source node: ${edge.from}`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`Edge references missing target node: ${edge.to}`);
    }
  }

  // 时间戳合理性
  if (baseline.timestamp > Date.now()) {
    errors.push('Timestamp is in the future');
  }

  // commitHash格式（简单检查）
  if (baseline.commitHash && !/^[a-f0-9]{7,40}$/.test(baseline.commitHash)) {
    errors.push('Invalid commit hash format');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

interface IntegrityResult {
  valid: boolean;
  errors: string[];
}
```

---

## 5. 升级路径设计

### 5.1 向后兼容原则

**核心原则**：新版本必须能够读取旧版本基线，除非Major版本变更。

```
┌─────────────────────────────────────────────────────────────┐
│                    版本兼容性矩阵                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  基线版本     工具版本      结果                              │
│  ──────────────────────────────────────────────────────     │
│  1.0.0       1.0.0        ✓ 直接使用                         │
│  1.0.0       1.0.1        ✓ 直接使用（patch升级）             │
│  1.0.0       1.1.0        ✓ 直接使用（可选迁移）              │
│  1.0.0       2.0.0        ✗ 需迁移或重建                      │
│  2.0.0       1.0.0        ✗ 报错（未来版本）                   │
│  无版本       1.0.0        △ 自动重建                         │
│                                                             │
│  规则：                                                      │
│  - Major相同 → 兼容                                          │
│  - 基线Major < 工具Major → 可迁移                             │
│  - 基线Major > 工具Major → 报错                               │
│  - 无版本标识 → 视为legacy，自动重建                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 迁移脚本框架

```typescript
interface MigrationScript {
  fromVersion: string;
  toVersion: string;
  migrate: (baseline: Baseline) => Baseline;
  description: string;
}

// 注册迁移脚本
const migrationRegistry: Map<string, MigrationScript> = new Map();

function registerMigration(script: MigrationScript) {
  const key = `${script.fromVersion}->${script.toVersion}`;
  migrationRegistry.set(key, script);
}

// 执行迁移
async function migrateBaseline(baseline: Baseline, cwd: string): Promise<Baseline> {
  const fromV = baseline.schemaVersion?.toString() || 'legacy';
  const toV = CURRENT_SCHEMA_VERSION.toString();

  // 查找直接迁移脚本
  const directKey = `${fromV}->${toV}`;
  const script = migrationRegistry.get(directKey);

  if (script) {
    // 单步迁移
    const migrated = script.migrate(baseline);
    migrated.schemaVersion = CURRENT_SCHEMA_VERSION;
    migrated.generatorVersion = GENERATOR_VERSION;
    migrated.migrationHistory = [
      ...(baseline.migrationHistory || []),
      {
        fromVersion: fromV,
        toVersion: toV,
        migratedAt: Date.now(),
        strategy: 'migrate'
      }
    ];

    // 写入迁移后的基线
    await saveBaseline(migrated, cwd);
    return migrated;
  }

  // 查找迁移路径（多步）
  const path = findMigrationPath(fromV, toV);
  if (path) {
    let current = baseline;
    for (const step of path) {
      current = step.migrate(current);
    }
    current.schemaVersion = CURRENT_SCHEMA_VERSION;
    current.generatorVersion = GENERATOR_VERSION;
    current.migrationHistory = [
      ...(baseline.migrationHistory || []),
      ...path.map(step => ({
        fromVersion: step.fromVersion,
        toVersion: step.toVersion,
        migratedAt: Date.now(),
        strategy: 'migrate'
      }))
    ];

    await saveBaseline(current, cwd);
    return current;
  }

  // 无迁移路径 -> 重建
  console.warn(`No migration path from ${fromV} to ${toV}. Rebuilding...`);
  const graph = await analyzeFull(cwd);
  return {
    graph: graph.toJSON(),
    commitHash: graph.commitHash,
    timestamp: Date.now(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    generatorVersion: GENERATOR_VERSION,
    architectureConstraints: [],
    healthScore: 0,
    skillDemand: { testWriter: 0, refactorSpecialist: 0, architect: 0, securityReviewer: 0 },
    migrationHistory: [
      {
        fromVersion: fromV,
        toVersion: toV,
        migratedAt: Date.now(),
        strategy: 'rebuild'
      }
    ]
  };
}

function findMigrationPath(fromV: string, toV: string): MigrationScript[] | null {
  // 简化实现：BFS查找迁移路径
  // 实际可用图算法优化
  const queue: { version: string; path: MigrationScript[] }[] = [
    { version: fromV, path: [] }
  ];
  const visited = new Set<string>([fromV]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    // 查找从current.version出发的所有迁移
    for (const [key, script] of migrationRegistry) {
      if (script.fromVersion === current.version) {
        const nextV = script.toVersion;
        const newPath = [...current.path, script];

        if (nextV === toV) {
          return newPath;  // 找到路径
        }

        if (!visited.has(nextV)) {
          visited.add(nextV);
          queue.push({ version: nextV, path: newPath });
        }
      }
    }
  }

  return null;  // 无路径
}
```

### 5.3 首个迁移脚本示例

```typescript
// packages/codegraph/src/migrations/legacy-to-1.0.0.ts

registerMigration({
  fromVersion: 'legacy',
  toVersion: '1.0.0',
  description: 'Convert legacy baseline (no schemaVersion) to v1.0.0',
  migrate: (baseline: Baseline): Baseline => {
    // Legacy baseline已经在核心字段上兼容
    // 仅需添加版本元数据
    return {
      ...baseline,
      schemaVersion: { major: 1, minor: 0, patch: 0 },
      generatorVersion: '1.0.0',
      migrationHistory: [{
        fromVersion: 'legacy',
        toVersion: '1.0.0',
        migratedAt: Date.now(),
        strategy: 'migrate'
      }]
    };
  }
});
```

### 5.4 Minor版本迁移示例

```typescript
// packages/codegraph/src/migrations/1.0.0-to-1.1.0.ts
// 假设1.1.0新增了 testCoverage 字段

registerMigration({
  fromVersion: '1.0.0',
  toVersion: '1.1.0',
  description: 'Add testCoverage field to MODULE metadata',
  migrate: (baseline: Baseline): Baseline => {
    // 为每个MODULE节点添加testCoverage默认值
    const nodes = baseline.graph.nodes.map(([id, node]) => {
      if (node.type === 'MODULE') {
        return [id, {
          ...node,
          metadata: {
            ...node.metadata,
            testCoverage: undefined  // 新字段，默认未计算
          }
        }];
      }
      return [id, node];
    });

    return {
      ...baseline,
      graph: {
        ...baseline.graph,
        nodes
      },
      schemaVersion: { major: 1, minor: 1, patch: 0 }
    };
  }
});
```

### 5.5 Major版本迁移示例（罕见）

```typescript
// packages/codegraph/src/migrations/1.x-to-2.0.0.ts
// 假设2.0.0重定义了NodeType枚举

registerMigration({
  fromVersion: '1.x',  // 通配，匹配所有1.x版本
  toVersion: '2.0.0',
  description: 'Major restructuring: NodeType enum renamed',
  migrate: (baseline: Baseline): Baseline => {
    // Major变更通常需要复杂转换
    // 这里简化示例

    const nodeTypeMap: Record<string, string> = {
      'DIRECTORY': 'DIR',
      'FILE': 'SOURCE_FILE',
      'MODULE': 'SYMBOL',
      'EXTERNAL': 'PACKAGE'
    };

    const nodes = baseline.graph.nodes.map(([id, node]) => {
      const newType = nodeTypeMap[node.type] || node.type;
      return [
        id.replace(node.type, newType),  // ID也需更新
        { ...node, type: newType as NodeType }
      ];
    });

    // 边也需要更新引用
    const edges = baseline.graph.edges.map(edge => ({
      ...edge,
      from: updateNodeId(edge.from, nodeTypeMap),
      to: updateNodeId(edge.to, nodeTypeMap)
    }));

    return {
      graph: { nodes, edges, commitHash: baseline.graph.commitHash, timestamp: baseline.graph.timestamp },
      commitHash: baseline.commitHash,
      timestamp: baseline.timestamp,
      schemaVersion: { major: 2, minor: 0, patch: 0 },
      generatorVersion: GENERATOR_VERSION,
      architectureConstraints: baseline.architectureConstraints,
      healthScore: baseline.healthScore,
      skillDemand: baseline.skillDemand,
      migrationHistory: [
        ...baseline.migrationHistory,
        {
          fromVersion: '1.x',
          toVersion: '2.0.0',
          migratedAt: Date.now(),
          strategy: 'migrate'
        }
      ]
    };
  }
});

function updateNodeId(id: string, typeMap: Record<string, string>): string {
  for (const [oldType, newType] of Object.entries(typeMap)) {
    if (id.startsWith(oldType + ':')) {
      return newType + ':' + id.slice(oldType.length + 1);
    }
  }
  return id;
}
```

### 5.6 CLI命令支持

```typescript
// packages/codegraph/src/cli/commands/version.ts

export function registerVersionCommand(cli: CAC) {
  cli.command('version', 'Show CodeGraph version info')
    .option('--check-baseline', 'Check baseline compatibility')
    .action(async (options) => {
      console.log(`CodeGraph Generator: ${GENERATOR_VERSION}`);
      console.log(`Schema Version: ${CURRENT_SCHEMA_VERSION}`);

      if (options.checkBaseline) {
        const cwd = process.cwd();
        const baselinePath = join(cwd, '.codegraph/baseline.json');

        if (!await fileExists(baselinePath)) {
          console.log('\nBaseline: Not found');
          return;
        }

        const baseline = await loadBaseline(cwd, { strict: true });
        if (baseline.failure) {
          console.log(`\nBaseline: INCOMPATIBLE (${baseline.failure.reason})`);
          console.log(`Action required: ${determineActionFromReason(baseline.failure.reason)}`);
        } else {
          console.log(`\nBaseline: ${baseline.baseline?.schemaVersion?.toString() || 'legacy'}`);
          console.log(`Compatible: ${baseline.compatibility?.compatible ? 'Yes' : 'No'}`);
          if (baseline.migrated) {
            console.log(`Migrated: Yes (from ${baseline.baseline?.migrationHistory?.slice(-1)[0]?.fromVersion})`);
          }
        }
      }
    });

  cli.command('migrate', 'Migrate baseline to current version')
    .option('--force', 'Force migration even if compatible')
    .action(async (options) => {
      const cwd = process.cwd();
      const result = await loadBaseline(cwd, {
        actionConfig: {
          forceAction: options.force ? 'migrate' : undefined,
          autoMigrate: true
        }
      });

      if (result.migrated) {
        console.log('Migration completed successfully');
      } else {
        console.log('No migration needed or migration failed');
      }
    });
}
```

---

## 6. 测试场景

### 6.1 单元测试

#### 6.1.1 版本兼容性检查测试

```typescript
// tests/unit/version-compatibility.test.ts

describe('checkSchemaCompatibility', () => {
  const currentVersion = new SchemaVersion(1, 0, 0);

  it('should reject legacy baseline without version', () => {
    const baseline = createMockBaseline({ schemaVersion: undefined });
    const result = checkSchemaCompatibility(baseline, currentVersion);

    expect(result.compatible).toBe(false);
    expect(result.reason).toBe('legacy_baseline');
    expect(result.action).toBe('rebuild');
  });

  it('should accept matching major version', () => {
    const baseline = createMockBaseline({
      schemaVersion: new SchemaVersion(1, 0, 0)
    });
    const result = checkSchemaCompatibility(baseline, currentVersion);

    expect(result.compatible).toBe(true);
    expect(result.reason).toBe('version_match');
    expect(result.action).toBe('proceed');
  });

  it('should accept older minor version', () => {
    const baseline = createMockBaseline({
      schemaVersion: new SchemaVersion(1, 0, 0)
    });
    const newerCurrent = new SchemaVersion(1, 1, 0);
    const result = checkSchemaCompatibility(baseline, newerCurrent);

    expect(result.compatible).toBe(true);
    expect(result.reason).toBe('minor_version_old');
    expect(result.action).toBe('migrate');
  });

  it('should accept older patch version', () => {
    const baseline = createMockBaseline({
      schemaVersion: new SchemaVersion(1, 0, 0)
    });
    const newerCurrent = new SchemaVersion(1, 0, 1);
    const result = checkSchemaCompatibility(baseline, newerCurrent);

    expect(result.compatible).toBe(true);
    expect(result.reason).toBe('patch_version_old');
    expect(result.action).toBe('proceed');
  });

  it('should reject major version mismatch (baseline higher)', () => {
    const baseline = createMockBaseline({
      schemaVersion: new SchemaVersion(2, 0, 0)
    });
    const result = checkSchemaCompatibility(baseline, currentVersion);

    expect(result.compatible).toBe(false);
    expect(result.reason).toBe('major_version_mismatch');
    expect(result.action).toBe('error');
  });

  it('should allow migration for major version mismatch (baseline lower)', () => {
    const baseline = createMockBaseline({
      schemaVersion: new SchemaVersion(0, 9, 0)
    });
    const result = checkSchemaCompatibility(baseline, currentVersion);

    expect(result.compatible).toBe(false);
    expect(result.reason).toBe('major_version_mismatch');
    expect(result.action).toBe('migrate');
  });
});
```

#### 6.1.2 版本解析测试

```typescript
describe('SchemaVersion', () => {
  it('should parse version string correctly', () => {
    const version = SchemaVersion.parse('1.2.3');
    expect(version.major).toBe(1);
    expect(version.minor).toBe(2);
    expect(version.patch).toBe(3);
  });

  it('should throw on invalid format', () => {
    expect(() => SchemaVersion.parse('1.2')).toThrow();
    expect(() => SchemaVersion.parse('abc')).toThrow();
  });

  it('should compare versions correctly', () => {
    const v1 = new SchemaVersion(1, 0, 0);
    const v2 = new SchemaVersion(1, 1, 0);
    const v3 = new SchemaVersion(2, 0, 0);

    expect(v2.isGreaterThan(v1)).toBe(true);
    expect(v3.isGreaterThan(v2)).toBe(true);
    expect(v1.isGreaterThan(v1)).toBe(false);

    expect(v2.isCompatibleWith(v1)).toBe(true);  // same major
    expect(v3.isCompatibleWith(v1)).toBe(false); // different major
  });
});
```

#### 6.1.3 结构验证测试

```typescript
describe('validateBaselineStructure', () => {
  it('should accept valid baseline', () => {
    const baseline = {
      graph: { nodes: [], edges: [] },
      commitHash: 'abc1234',
      timestamp: Date.now()
    };
    const result = validateBaselineStructure(baseline);
    expect(result.valid).toBe(true);
  });

  it('should reject missing required fields', () => {
    const baseline = { graph: { nodes: [], edges: [] } };
    const result = validateBaselineStructure(baseline);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: commitHash');
    expect(result.errors).toContain('Missing required field: timestamp');
  });

  it('should reject invalid graph structure', () => {
    const baseline = {
      graph: { nodes: 'invalid' },
      commitHash: 'abc1234',
      timestamp: Date.now()
    };
    const result = validateBaselineStructure(baseline);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('graph.nodes must be an array');
  });
});
```

#### 6.1.4 数据完整性测试

```typescript
describe('verifyDataIntegrity', () => {
  it('should detect duplicate node IDs', () => {
    const baseline = createMockBaseline({
      graph: {
        nodes: [
          ['FILE:a.ts', { id: 'FILE:a.ts', type: 'FILE', path: 'a.ts', name: 'a.ts' }],
          ['FILE:a.ts', { id: 'FILE:a.ts', type: 'FILE', path: 'a.ts', name: 'a.ts' }]
        ],
        edges: []
      }
    });
    const result = verifyDataIntegrity(baseline);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Duplicate node ID: FILE:a.ts');
  });

  it('should detect edge referencing missing node', () => {
    const baseline = createMockBaseline({
      graph: {
        nodes: [
          ['FILE:a.ts', { id: 'FILE:a.ts', type: 'FILE', path: 'a.ts', name: 'a.ts' }]
        ],
        edges: [
          { from: 'FILE:a.ts', to: 'FILE:b.ts', type: 'IMPORTS' }
        ]
      }
    });
    const result = verifyDataIntegrity(baseline);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Edge references missing target node: FILE:b.ts');
  });

  it('should detect future timestamp', () => {
    const baseline = createMockBaseline({
      timestamp: Date.now() + 100000
    });
    const result = verifyDataIntegrity(baseline);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Timestamp is in the future');
  });
});
```

### 6.2 集成测试

#### 6.2.1 loadBaseline完整流程测试

```typescript
// tests/integration/load-baseline.test.ts

describe('loadBaseline integration', () => {
  const testDir = './tests/fixtures/test-project';

  beforeAll(async () => {
    // 创建测试fixture
    await createTestProject(testDir);
  });

  afterAll(async () => {
    await cleanupTestProject(testDir);
  });

  it('should create baseline on first run', async () => {
    const result = await loadBaseline(testDir);
    expect(result.success).toBe(true);
    expect(result.executedAction).toBe('rebuild');
    expect(result.graph).toBeDefined();
    expect(result.baseline?.schemaVersion?.toString()).toBe('1.0.0');
  });

  it('should load existing compatible baseline', async () => {
    // 先创建基线
    await analyzeFull(testDir);

    // 再次加载
    const result = await loadBaseline(testDir);
    expect(result.success).toBe(true);
    expect(result.executedAction).toBe('proceed');
    expect(result.migrated).toBe(false);
  });

  it('should handle corrupted JSON', async () => {
    // 写入损坏的JSON
    await writeFile(join(testDir, '.codegraph/baseline.json'), '{ invalid json }');

    const result = await loadBaseline(testDir, { strict: false });
    expect(result.success).toBe(true);
    expect(result.executedAction).toBe('rebuild');
  });

  it('should handle schema incompatible in strict mode', async () => {
    // 写入未来版本基线
    const futureBaseline = {
      graph: { nodes: [], edges: [] },
      commitHash: 'abc123',
      timestamp: Date.now(),
      schemaVersion: { major: 99, minor: 0, patch: 0 }
    };
    await writeFile(
      join(testDir, '.codegraph/baseline.json'),
      JSON.stringify(futureBaseline)
    );

    const result = await loadBaseline(testDir, { strict: true });
    expect(result.success).toBe(false);
    expect(result.failure?.reason).toBe('schema_incompatible');
  });
});
```

#### 6.2.2 迁移流程测试

```typescript
// tests/integration/migration.test.ts

describe('Migration integration', () => {
  it('should migrate legacy baseline', async () => {
    const testDir = './tests/fixtures/legacy-project';

    // 创建legacy基线（无schemaVersion）
    await saveBaseline({
      graph: { nodes: [], edges: [], commitHash: 'abc123', timestamp: Date.now() },
      commitHash: 'abc123',
      timestamp: Date.now()
    }, testDir);

    const result = await loadBaseline(testDir, { actionConfig: { autoMigrate: true } });

    expect(result.migrated).toBe(true);
    expect(result.baseline?.schemaVersion?.toString()).toBe('1.0.0');
    expect(result.baseline?.migrationHistory?.length).toBe(1);
  });

  it('should find migration path for multi-step upgrade', async () => {
    // 注册多个迁移脚本
    registerMigration({
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      migrate: (b) => ({ ...b, schemaVersion: { major: 1, minor: 1, patch: 0 } }),
      description: 'Test migration 1'
    });

    registerMigration({
      fromVersion: '1.1.0',
      toVersion: '1.2.0',
      migrate: (b) => ({ ...b, schemaVersion: { major: 1, minor: 2, patch: 0 } }),
      description: 'Test migration 2'
    });

    const path = findMigrationPath('1.0.0', '1.2.0');
    expect(path).toBeDefined();
    expect(path?.length).toBe(2);
    expect(path?.[0]?.toVersion).toBe('1.1.0');
    expect(path?.[1]?.toVersion).toBe('1.2.0');
  });
});
```

#### 6.2.3 CLI命令测试

```typescript
// tests/integration/cli-version.test.ts

describe('CLI version commands', () => {
  it('should show version info', async () => {
    const output = await runCLI('version');
    expect(output).toContain('CodeGraph Generator: 1.0.0');
    expect(output).toContain('Schema Version: 1.0.0');
  });

  it('should check baseline compatibility', async () => {
    const testDir = './tests/fixtures/test-project';
    await analyzeFull(testDir);

    const output = await runCLI('version --check-baseline', testDir);
    expect(output).toContain('Baseline: 1.0.0');
    expect(output).toContain('Compatible: Yes');
  });

  it('should run migrate command', async () => {
    const testDir = './tests/fixtures/legacy-project';
    await createLegacyBaseline(testDir);

    const output = await runCLI('migrate', testDir);
    expect(output).toContain('Migration completed successfully');

    const result = await loadBaseline(testDir);
    expect(result.baseline?.schemaVersion?.toString()).toBe('1.0.0');
  });
});
```

### 6.3 测试覆盖率目标

| 模块 | 目标覆盖率 | 关键测试点 |
|-----|-----------|----------|
| `checkSchemaCompatibility` | 100% | 所有版本组合、边界情况 |
| `SchemaVersion` | 100% | 解析、比较、格式化 |
| `validateBaselineStructure` | 95% | 必需字段、类型检查、嵌套验证 |
| `verifyDataIntegrity` | 90% | 节点ID、边引用、时间戳 |
| `loadBaseline` | 90% | 所有失败场景、成功流程 |
| `migrateBaseline` | 85% | 直接迁移、路径查找、重建fallback |
| CLI commands | 80% | 输出格式、错误处理 |

---

## 附录 A: 错误代码定义

```typescript
enum BaselineErrorCode {
  // 加载错误
  E001_FILE_NOT_FOUND = 'E001_FILE_NOT_FOUND',
  E002_PARSE_ERROR = 'E002_PARSE_ERROR',
  E003_INVALID_STRUCTURE = 'E003_INVALID_STRUCTURE',
  E004_CORRUPTED_DATA = 'E004_CORRUPTED_DATA',
  E005_PERMISSION_ERROR = 'E005_PERMISSION_ERROR',

  // 版本错误
  E101_MAJOR_MISMATCH = 'E101_MAJOR_MISMATCH',
  E102_FUTURE_VERSION = 'E102_FUTURE_VERSION',
  E103_LEGACY_BASELINE = 'E103_LEGACY_BASELINE',

  // 迁移错误
  E201_NO_MIGRATION_PATH = 'E201_NO_MIGRATION_PATH',
  E202_MIGRATION_FAILED = 'E202_MIGRATION_FAILED',

  // 操作错误
  E301_REBUILD_CANCELLED = 'E301_REBUILD_CANCELLED',
  E302_FORCE_REBUILD_REQUIRED = 'E302_FORCE_REBUILD_REQUIRED'
}

class BaselineError extends Error {
  code: BaselineErrorCode;
  details?: unknown;

  constructor(code: BaselineErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'BaselineError';
  }
}
```

---

## 附录 B: CLI错误消息模板

```typescript
const errorMessages: Record<BaselineErrorCode, string> = {
  E001_FILE_NOT_FOUND: 'No baseline found. Run `codegraph analyze` to create one.',
  E002_PARSE_ERROR: 'Baseline file is corrupted. Run `codegraph analyze --force` to rebuild.',
  E003_INVALID_STRUCTURE: 'Baseline structure is invalid. Run `codegraph analyze --force` to rebuild.',
  E004_CORRUPTED_DATA: 'Baseline data integrity check failed. Run `codegraph analyze --force` to rebuild.',
  E005_PERMISSION_ERROR: 'Permission denied reading baseline file. Check file permissions.',
  E101_MAJOR_MISMATCH: 'Baseline schema version incompatible. Migration or rebuild required.',
  E102_FUTURE_VERSION: 'Baseline was created by a newer version. Update CodeGraph or rebuild baseline.',
  E103_LEGACY_BASELINE: 'Legacy baseline without version info. Automatic rebuild recommended.',
  E201_NO_MIGRATION_PATH: 'No migration path available. Manual rebuild required.',
  E202_MIGRATION_FAILED: 'Migration failed. Run `codegraph analyze --force` to rebuild.',
  E301_REBUILD_CANCELLED: 'Rebuild cancelled by user.',
  E302_FORCE_REBUILD_REQUIRED: 'Use `--force` flag to rebuild incompatible baseline.'
};
```

---

**文档版本**: v1.0
**创建日期**: 2026-05-03
**关联Change**: C6 `cg-baseline-persistence`
**用途**: 实现基线版本管理的详细技术指导