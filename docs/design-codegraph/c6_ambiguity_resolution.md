# CodeGraph C6: 基线持久化歧义解决方案

> **文档定位**: Change 6 `cg-baseline-persistence` 开发前的歧义澄清与决策记录
> **审查日期**: 2026-05-03
> **审查方式**: Multi-agent并行审查

---

## 目录

1. [审查概述](#1-审查概述)
2. [高优先级歧义解决](#2-高优先级歧义解决)
3. [中优先级歧义解决](#3-中优先级歧义解决)
4. [低优先级备注](#4-低优先级备注)
5. [类型依赖澄清](#5-类型依赖澄清)
6. [开发建议](#6-开发建议)

---

## 1. 审查概述

### 1.1 审查方法

三个并行subagent审查：
- **Spec完整性审查**: 检查C6 spec中引用但未定义的类型和函数
- **C1-C5依赖兼容性审查**: 验证新增类型与现有Blueprint定义的一致性
- **CLI集成需求审查**: 分析C6与C9 CLI的交互需求

### 1.2 发现统计

| 类别 | 数量 | 状态 |
|------|------|------|
| 高优先级歧义 | 5 | 已解决 |
| 中优先级歧义 | 7 | 已解决 |
| 低优先级备注 | 4 | 记录 |
| 类型缺失 | 8 | 已定义 |
| 测试覆盖Gap | 5 | 记录 |

---

## 2. 高优先级歧义解决

### A1: SkillDemand接口缺失

**问题**: C6 spec Section 1.2引用`SkillDemand`接口但未定义完整结构。

**示例场景**:
```typescript
// C6 spec引用 skillDemand: SkillDemand
// 但未提供接口定义细节
interface Baseline {
  skillDemand: SkillDemand;  // 引用什么定义？
}
```

**选项考虑**:
1. Option 1: 在C6 spec重新定义SkillDemand - 重复定义风险
2. Option 2: 引用Blueprint Section 3.4定义 - 保持一致性
3. Option 3: 创建types.ts导出共享类型 - 需要跨包共享机制

**决策**: **Option 2 - 采用Blueprint Section 3.4定义**

**理由**:
1. Blueprint Section 3.4已完整定义`SkillDemand`接口
2. 保持单一定义源，避免版本漂移
3. C6作为下游Change应遵循上游规范
4. 未来其他Change也可复用同一定义

**实现指导**:
```typescript
// packages/codegraph/src/persistence/types.ts
// 直接引用Blueprint定义，不重复声明
/**
 * @see 01_origin_blueprint.md Section 3.4
 */
export interface SkillDemand {
  testWriter: number;          // 0-1 表示需求程度
  refactorSpecialist: number;
  architect: number;
  securityReviewer: number;
}
```

**影响文件**: `06_c6_baseline_version_spec.md` Section 1.2添加引用说明

---

### A2: saveBaseline函数未定义

**问题**: C6 spec多处调用`saveBaseline()`但无规范定义（原子写入、权限、备份、错误处理）。

**示例场景**:
```typescript
// 在migrateBaseline中调用
await saveBaseline(migrated, cwd);  // 如何保存？

// 在analyzeFull后调用
await saveBaseline(baseline, cwd);  // 错误时如何处理？
```

**选项考虑**:
1. Option 1: 简单JSON.stringify写入 - 无原子性保障
2. Option 2: 先写临时文件再rename - POSIX原子写入
3. Option 3: 增加备份机制 - 避免数据丢失

**决策**: **Option 2 + Option 3 - 原子写入 + 可选备份**

**理由**:
1. POSIX rename是原子操作，避免部分写入导致数据损坏
2. 备份机制在迁移前创建`.bak`文件，防止迁移失败丢失原数据
3. 权限继承现有文件或默认0644
4. 磁盘满、权限拒绝需要明确错误处理

**新增Section 4.6定义**:
```typescript
/**
 * 保存基线到文件系统
 * @param baseline 基线数据
 * @param cwd 项目根目录
 * @param options 保存选项
 */
async function saveBaseline(
  baseline: Baseline,
  cwd: string,
  options?: SaveBaselineOptions
): Promise<void> {
  const baselinePath = join(cwd, '.codegraph/baseline.json');
  const tempPath = baselinePath + '.tmp';
  const backupPath = baselinePath + '.bak';

  // 1. 可选备份（迁移前或用户请求）
  if (options?.createBackup && await fileExists(baselinePath)) {
    await copyFile(baselinePath, backupPath);
  }

  // 2. 写入临时文件
  const content = JSON.stringify(baseline, null, 2);
  await writeFile(tempPath, content, {
    mode: options?.mode || (await fileExists(baselinePath) 
      ? await getFileMode(baselinePath) 
      : 0o644)
  });

  // 3. 原子rename
  await rename(tempPath, baselinePath);

  // 4. 更新lastCommit.txt
  if (baseline.commitHash) {
    await writeFile(join(cwd, '.codegraph/lastCommit.txt'), baseline.commitHash);
  }
}

interface SaveBaselineOptions {
  createBackup?: boolean;    // 是否创建备份
  mode?: number;             // 文件权限（默认继承或0644）
}
```

**错误处理矩阵**:

| 错误类型 | 错误码 | 处理策略 |
|---------|-------|---------|
| 磁盘空间不足 | E_DISK_FULL | 报错，保留临时文件供用户处理 |
| 权限拒绝 | E_PERMISSION | 报错，提示检查权限 |
| 目录不存在 | E_DIR_NOT_FOUND | 自动创建.codegraph目录 |
| 写入中断 | E_WRITE_INTERRUPTED | 临时文件不删除，下次可恢复 |

**影响文件**: `06_c6_baseline_version_spec.md` Section 4.6新增

---

### A3: SchemaVersion位置冲突

**问题**: C6在SerializedCodeGraph添加schemaVersion，但Blueprint仅在Baseline定义，位置冲突。

**示例场景**:
```typescript
// Blueprint定义
interface Baseline {
  schemaVersion: SchemaVersion;  // 主位置
}

// C6 spec同时定义
interface SerializedCodeGraph {
  schemaVersion?: SchemaVersion;  // 可选字段 - 冗余？
}
```

**选项考虑**:
1. Option 1: 仅在Baseline保留 - SerializedCodeGraph不添加
2. Option 2: 仅在SerializedCodeGraph保留 - 移动位置
3. Option 3: 双位置策略 - 明确优先级和用途

**决策**: **Option 3 - 双位置策略，明确优先级**

**理由**:
1. Baseline.schemaVersion是主位置，必需字段
2. SerializedCodeGraph.schemaVersion可选，用于向后兼容旧版导出格式
3. 加载时优先读取Baseline.schemaVersion，fallback到SerializedCodeGraph
4. 保存时同时写入两处，保持一致性

**优先级规则**:
```typescript
function getSchemaVersion(baseline: Baseline): SchemaVersion {
  // 优先级1: Baseline顶层字段
  if (baseline.schemaVersion) {
    return baseline.schemaVersion;
  }
  
  // 优先级2: SerializedCodeGraph内部
  if (baseline.graph.schemaVersion) {
    return baseline.graph.schemaVersion;
  }
  
  // 优先级3: 无版本标识 -> legacy
  return 'legacy';
}

function setSchemaVersion(baseline: Baseline, version: SchemaVersion): void {
  // 同时写入两处
  baseline.schemaVersion = version;
  baseline.graph.schemaVersion = version;
}
```

**影响文件**: `06_c6_baseline_version_spec.md` Section 1.2/1.3添加说明

---

### A4: analyze --force行为未定义

**问题**: C6引用analyze --force但C9未定义，层级职责不清。

**示例场景**:
```typescript
// C6 spec Section 3.3
throw new IncompatibleBaselineError(
  'Please run `codegraph analyze --force` to rebuild.'
);

// --force是什么行为？
// - 直接调用loadBaseline绕过检查？
// - CLI层重建？
// - 核心层强制重建？
```

**选项考虑**:
1. Option 1: loadBaseline内部处理force参数 - 核心层绕过检查
2. Option 2: CLI层处理，先删除baseline.json再调用analyze - 层级分离
3. Option 3: ActionConfig.forceAction = 'rebuild' - 配置化控制

**决策**: **Option 2 + Option 3 - CLI层责任 + 配置化**

**理由**:
1. 核心逻辑不应被CLI flag直接绕过，保持API纯洁性
2. CLI parse --force后设置`ActionConfig.forceAction = 'rebuild'`
3. loadBaseline根据配置执行重建，不直接感知CLI flag
4. C9 spec需明确定义CLI flag行为（交叉引用）

**CLI集成说明**:
```typescript
// packages/codegraph/src/cli/commands/analyze.ts
cli.command('analyze')
  .option('--force', 'Force rebuild baseline, bypass compatibility check')
  .action(async (options) => {
    const actionConfig: ActionConfig = {
      forceAction: options.force ? 'rebuild' : undefined,
      allowRebuild: true  // CLI命令默认允许重建
    };
    
    const result = await loadBaseline(process.cwd(), { actionConfig });
    // ...
  });

// C6 loadBaseline处理
// --force通过ActionConfig传递，不直接耦合CLI
```

**影响文件**: 
- `06_c6_baseline_version_spec.md` Section 5.6添加CLI集成说明
- `08_c9_cli_spec.md` (未来更新)定义--force行为

---

### A5: 通配版本匹配逻辑缺失

**问题**: Section 5.5示例展示`'1.x'`通配，但`findMigrationPath`仅精确匹配。

**示例场景**:
```typescript
// Section 5.5示例
registerMigration({
  fromVersion: '1.x',  // 通配符！
  toVersion: '2.0.0',
  // ...
});

// 但findMigrationPath实现
if (script.fromVersion === current.version) {  // 精确匹配！
  // 无法匹配 '1.x' -> '1.0.0'
}
```

**选项考虑**:
1. Option 1: 仅支持精确匹配 - 移除通配示例
2. Option 2: 实现通配匹配 - 'x'匹配任意数字
3. Option 3: 支持范围表达式 - semver range语法

**决策**: **Option 2 - 实现通配匹配（'x'作为通配符）**

**理由**:
1. 示例已展示`'1.x'`用法，需实现支持
2. 'x'通配语义清晰：匹配任意数字
3. 不引入完整semver range复杂度
4. findMigrationPath增加pattern matching逻辑

**通配匹配实现**:
```typescript
function matchesVersion(pattern: string, version: string): boolean {
  // 精确匹配
  if (pattern === version) return true;
  
  // 通配匹配：'1.x' 匹配 '1.0.0', '1.1.0', '1.9.9' 等
  const patternParts = pattern.split('.');
  const versionParts = version.split('.');
  
  if (patternParts.length !== 3 || versionParts.length !== 3) {
    return false;
  }
  
  for (let i = 0; i < 3; i++) {
    if (patternParts[i] === 'x') continue;  // 通配，匹配任意
    if (patternParts[i] !== versionParts[i]) return false;
  }
  
  return true;
}

function findMigrationPath(fromV: string, toV: string): MigrationScript[] | null {
  // ...
  for (const [key, script] of migrationRegistry) {
    // 使用matchesVersion替代精确匹配
    if (matchesVersion(script.fromVersion, current.version)) {
      // ...
    }
  }
  // ...
}

// 注册时支持通配key
registerMigration({
  fromVersion: '1.x',      // 匹配所有1.x版本
  toVersion: '2.0.0',
  description: 'Major restructuring for all 1.x versions',
  migrate: (baseline) => { /* ... */ }
});
```

**影响文件**: `06_c6_baseline_version_spec.md` Section 5.2更新匹配逻辑

---

## 3. 中优先级歧义解决

### B1: 版本字符串验证不足

**问题**: SchemaVersion.parse简单split('.')，无完整验证。

**示例场景**:
```typescript
SchemaVersion.parse('1.2');      // parts.length = 2，抛出错误？
SchemaVersion.parse('abc');      // parseInt返回NaN？
SchemaVersion.parse('1.2.abc');  // patch非数字？
SchemaVersion.parse('-1.0.0');   // 负数版本？
```

**决策**: 增强验证逻辑

**实现指导**:
```typescript
static parse(versionStr: string): SchemaVersion {
  // 1. 格式验证
  if (!/^(\d+)\.(\d+)\.(\d+)$/.test(versionStr)) {
    throw new Error(`Invalid version format: ${versionStr}. Expected: major.minor.patch (e.g., 1.0.0)`);
  }
  
  const parts = versionStr.split('.');
  
  // 2. 数值验证
  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);
  const patch = parseInt(parts[2], 10);
  
  // 3. 范围验证（不允许负数）
  if (major < 0 || minor < 0 || patch < 0) {
    throw new Error(`Version components must be non-negative: ${versionStr}`);
  }
  
  return new SchemaVersion(major, minor, patch);
}
```

**影响文件**: `06_c6_baseline_version_spec.md` Section 2.2

---

### B2: 'legacy'魔术字符串

**问题**: 'legacy'字符串多处硬编码，无常量定义。

**示例场景**:
```typescript
// Section 4.2
reason: 'legacy_baseline'

// Section 5.3
const fromV = baseline.schemaVersion?.toString() || 'legacy';

// Section 5.6
fromVersion: 'legacy'
```

**决策**: 定义常量并统一使用

**实现指导**:
```typescript
// packages/codegraph/src/persistence/constants.ts
export const VERSION_CONSTANTS = {
  LEGACY: 'legacy',
  CURRENT: '1.0.0',
  MIN_SUPPORTED: '1.0.0',
} as const;

// 使用示例
const fromV = baseline.schemaVersion?.toString() || VERSION_CONSTANTS.LEGACY;
```

**影响文件**: `06_c6_baseline_version_spec.md` Section 2.3

---

### B3: 迁移原子性/回滚未定义

**问题**: migrateBaseline执行失败时如何处理？部分迁移状态如何恢复？

**示例场景**:
```typescript
// 迁移执行中途失败
let current = baseline;
for (const step of path) {
  current = step.migrate(current);  // step 2失败？
  // 前面步骤已完成，基线部分损坏？
}
```

**决策**: 实现事务性迁移 + 备份恢复

**实现指导**:
```typescript
async function migrateBaseline(baseline: Baseline, cwd: string): Promise<Baseline> {
  const backupPath = join(cwd, '.codegraph/baseline.json.bak');
  
  // 1. 创建备份
  await saveBaseline(baseline, cwd, { createBackup: true });
  
  try {
    // 2. 执行迁移（内存操作）
    let current = baseline;
    for (const step of path) {
      current = step.migrate(current);
    }
    
    // 3. 更新版本元数据
    current.schemaVersion = CURRENT_SCHEMA_VERSION;
    current.migrationHistory = [...];
    
    // 4. 保存迁移结果
    await saveBaseline(current, cwd);
    
    return current;
  } catch (error) {
    // 5. 失败时恢复备份
    console.error('Migration failed:', error);
    await copyFile(backupPath, join(cwd, '.codegraph/baseline.json'));
    throw new MigrationError('Migration failed, baseline restored from backup', error);
  }
}

class MigrationError extends Error {
  originalError: Error;
  constructor(message: string, original: Error) {
    super(message);
    this.originalError = original;
  }
}
```

**影响文件**: `06_c6_baseline_version_spec.md` Section 5.2

---

### B4: MigrationRecord缺少checksum

**问题**: MigrationRecord未记录迁移前后数据checksum，无法验证迁移正确性。

**决策**: 添加checksum字段

**实现指导**:
```typescript
interface MigrationRecord {
  fromVersion: string;
  toVersion: string;
  migratedAt: number;
  strategy: 'migrate' | 'rebuild';
  checksumBefore?: string;  // SHA256 of original baseline
  checksumAfter?: string;   // SHA256 of migrated baseline
}

// 计算checksum
function computeBaselineChecksum(baseline: Baseline): string {
  const content = JSON.stringify(baseline.graph);
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}
```

**影响文件**: `06_c6_baseline_version_spec.md` Section 1.2

---

### B5: C6 CLI缺少--json支持

**问题**: Section 5.6 CLI命令输出纯文本，无--json flag支持结构化输出。

**决策**: 添加--json选项

**实现指导**:
```typescript
cli.command('version')
  .option('--check-baseline', 'Check baseline compatibility')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    const info = {
      generator: GENERATOR_VERSION,
      schema: CURRENT_SCHEMA_VERSION.toString(),
      baseline: null as any
    };
    
    if (options.checkBaseline) {
      const result = await loadBaseline(process.cwd(), { strict: true });
      info.baseline = {
        version: result.baseline?.schemaVersion?.toString() || 'legacy',
        compatible: result.compatibility?.compatible,
        migrated: result.migrated
      };
    }
    
    if (options.json) {
      console.log(JSON.stringify(info, null, 2));
    } else {
      // 文本格式输出
      console.log(`CodeGraph Generator: ${info.generator}`);
      // ...
    }
  });
```

**影响文件**: `06_c6_baseline_version_spec.md` Section 5.6

---

### B6: 错误格式不一致

**问题**: Section 4.2 CompatibilityResult.message与错误处理输出格式不一致。

**示例场景**:
```typescript
// CompatibilityResult
message: 'Major version mismatch: baseline=2.0.0, current=1.0.0'

// CLI错误输出
console.error('Baseline schema incompatible. Run `codegraph analyze --force`');
```

**决策**: 统一错误格式模板

**实现指导**:
```typescript
// packages/codegraph/src/persistence/errors.ts
export const ERROR_MESSAGES = {
  major_mismatch: (baseline: string, current: string) => 
    `Baseline schema v${baseline} incompatible with current v${current}. Run 'codegraph analyze --force' to rebuild.`,
  
  legacy_baseline: () => 
    `Legacy baseline without version info. Run 'codegraph analyze' to create versioned baseline.`,
  
  future_version: (baseline: string, current: string) =>
    `Baseline v${baseline} is newer than current v${current}. Update CodeGraph or rebuild baseline.`,
  
  parse_error: (details: string) =>
    `Failed to parse baseline.json: ${details}. Run 'codegraph analyze --force' to rebuild.`,
} as const;
```

**影响文件**: `06_c6_baseline_version_spec.md` Section 4.3 + Appendix B

---

### B7: loadBaseline直接调用analyzeFull

**问题**: loadBaseline在handleFailure中直接调用analyzeFull，核心层与分析引擎耦合。

**示例场景**:
```typescript
// Section 4.3
case 'file_not_found':
  const graph = await analyzeFull(cwd);  // 核心层调用分析引擎
  return { graph, ... };
```

**决策**: 使用依赖注入或回调解耦

**实现指导**:
```typescript
interface LoadBaselineOptions {
  actionConfig?: ActionConfig;
  onFailure?: FailureHandler;
  strict?: boolean;
  // 新增：重建回调（解耦核心层与分析引擎）
  rebuildHandler?: (cwd: string) => Promise<CodeGraph>;
}

async function handleFailure(
  reason: LoadFailureReason,
  cwd: string,
  options?: LoadBaselineOptions
): Promise<LoadBaselineResult> {
  switch (reason) {
    case 'file_not_found':
      // 使用回调而非直接调用
      const graph = options?.rebuildHandler 
        ? await options.rebuildHandler(cwd)
        : await defaultRebuildHandler(cwd);
      return { success: true, graph, executedAction: 'rebuild' };
    // ...
  }
}

// CLI层注入
await loadBaseline(cwd, {
  rebuildHandler: async (dir) => {
    const result = await analyzeFull(dir);
    return result.graph;
  }
});
```

**影响文件**: `06_c6_baseline_version_spec.md` Section 4.2

---

## 4. 低优先级备注

### C1: .version文件冗余

**问题**: Section 1.4定义.version文件，与baseline.json中schemaVersion重复。

**备注**: 
- .version文件用于快速检查，避免解析完整baseline.json
- 保留设计，但明确用途：快速版本检查工具使用
- 未来可考虑移除，统一使用baseline.json

**建议**: 添加说明文档，明确.version文件用于外部工具快速检查场景。

---

### C2: 时间戳验证无容忍度

**问题**: Section 4.5 `timestamp > Date.now()`严格检查未来时间，无容忍度。

**示例场景**:
```typescript
// 跨时区场景：timestamp = now + 100ms（时钟偏差）
if (baseline.timestamp > Date.now()) {
  errors.push('Timestamp is in the future');  // 过于严格？
}
```

**备注**: 
- 添加容忍度（如5分钟）避免时钟偏差误报
- 或改为警告而非错误

**建议**: 
```typescript
const TOLERANCE_MS = 5 * 60 * 1000;  // 5分钟容忍度
if (baseline.timestamp > Date.now() + TOLERANCE_MS) {
  errors.push('Timestamp is significantly in the future');
} else if (baseline.timestamp > Date.now()) {
  warnings.push('Timestamp slightly in future (possible clock skew)');
}
```

---

### C3: commitHash格式过于宽松

**问题**: Section 4.5 `/^[a-f0-9]{7,40}$/`允许7-40字符，范围过大。

**备注**: 
- Git SHA通常为40字符完整hash或7字符缩写
- 40字符完整hash更安全，7字符缩写可能冲突
- 建议区分完整hash和缩写hash场景

**建议**: 
```typescript
// 完整hash验证（推荐）
const FULL_SHA_PATTERN = /^[a-f0-9]{40}$/;

// 缩写hash验证（宽松）
const SHORT_SHA_PATTERN = /^[a-f0-9]{7,40}$/;

// 基线存储使用完整hash
if (!FULL_SHA_PATTERN.test(baseline.commitHash)) {
  warnings.push('Commit hash is not full SHA-1, consider using 40-character hash');
}
```

---

### C4: 循环迁移检测缺失

**问题**: findMigrationPath未检测循环迁移路径（如1.0→1.1→1.0）。

**备注**: 
- BFS visited set已防止无限循环
- 但未检测循环路径本身（如注册错误迁移脚本）
- 建议添加循环检测警告

**建议**: 
```typescript
function findMigrationPath(fromV: string, toV: string): MigrationScript[] | null {
  // ...
  const visited = new Set<string>([fromV]);
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    for (const [key, script] of migrationRegistry) {
      if (matchesVersion(script.fromVersion, current.version)) {
        const nextV = script.toVersion;
        
        // 检测回到起点（循环）
        if (nextV === fromV) {
          console.warn(`Circular migration detected: ${fromV} -> ... -> ${fromV}`);
          return null;  // 拒绝循环路径
        }
        
        // ...
      }
    }
  }
  // ...
}
```

---

## 5. 类型依赖澄清

### 5.1 C1-C5类型复用

| 类型 | 来源 | 状态 | 备注 |
|------|------|------|------|
| SerializedCodeGraph | C1 types.ts | 扩展 | 新增可选schemaVersion |
| GraphNode | C1 types.ts | 直接复用 | 无变更 |
| GraphEdge | C1 types.ts | 直接复用 | 无变更 |
| CodeGraph | C1 types.ts | 直接复用 | 无变更 |
| Baseline | Blueprint §3.4 | 扩展 | 新增schemaVersion等 |
| SkillDemand | Blueprint §3.4 | 直接复用 | 不重复定义 |

### 5.2 C6新增类型

| 类型 | 定义位置 | 优先级 | 用途 |
|------|---------|--------|------|
| SchemaVersion | persistence/types.ts | H | 版本标识 |
| MigrationRecord | persistence/types.ts | H | 迁移历史 |
| CompatibilityResult | persistence/types.ts | H | 兼容性检查结果 |
| CompatibilityAction | persistence/types.ts | H | 处理策略枚举 |
| CompatibilityReason | persistence/types.ts | H | 不兼容原因枚举 |
| LoadBaselineOptions | persistence/types.ts | M | 加载选项 |
| LoadBaselineResult | persistence/types.ts | M | 加载结果 |
| ActionConfig | persistence/types.ts | M | 行为配置 |

### 5.3 类型导出建议

```typescript
// packages/codegraph/src/persistence/types.ts
export {
  // 核心版本类型
  SchemaVersion,
  MigrationRecord,
  
  // 兼容性类型
  CompatibilityResult,
  CompatibilityAction,
  CompatibilityReason,
  
  // 操作类型
  LoadBaselineOptions,
  LoadBaselineResult,
  ActionConfig,
  SaveBaselineOptions,
  
  // 常量
  VERSION_CONSTANTS,
  CURRENT_SCHEMA_VERSION,
  GENERATOR_VERSION,
};

// 复用类型（从核心导出）
export {
  Baseline,
  SkillDemand,
} from '../types';
```

---

## 6. 开发建议

### 6.1 文件组织

建议C6实现文件结构：
```
packages/codegraph/src/
├─ persistence/
│   ├─ types.ts           # C6新增类型定义
│   ├─ constants.ts       # 版本常量、错误消息模板
│   ├─ version.ts         # SchemaVersion类实现
│   ├─ compatibility.ts   # checkSchemaCompatibility函数
│   ├─ baseline.ts        # loadBaseline/saveBaseline核心逻辑
│   ├─ paths.ts           # .codegraph路径定义
│   ├─ migrations/
│   │   ├─ index.ts       # 注册入口、findMigrationPath
│   │   ├─ registry.ts    # MigrationScript注册表
│   │   └─ legacy-to-1.0.0.ts  # 首个迁移脚本
│   └─ index.ts           # 模块导出
```

### 6.2 开发顺序建议

**Phase 1: 基础类型（Day 1-2）**
1. `types.ts` - 定义所有新类型接口
2. `constants.ts` - 版本常量、错误模板
3. `version.ts` - SchemaVersion类实现（含验证、比较）

**Phase 2: 核心逻辑（Day 3-5）**
4. `compatibility.ts` - checkSchemaCompatibility
5. `baseline.ts` - loadBaseline（基础流程）
6. `baseline.ts` - saveBaseline（原子写入）

**Phase 3: 迁移框架（Day 6-8）**
7. `migrations/registry.ts` - 注册表实现
8. `migrations/index.ts` - findMigrationPath（含通配匹配）
9. `migrations/legacy-to-1.0.0.ts` - 首个迁移脚本

**Phase 4: CLI集成（Day 9-10）**
10. CLI version/migrate命令实现
11. --json选项支持

### 6.3 测试补充建议

**新增测试场景**:

| 测试类型 | 场景 | 优先级 |
|---------|------|--------|
| 单元测试 | permission_error处理 | H |
| 单元测试 | rollback恢复备份 | H |
| 单元测试 | 通配版本匹配 | H |
| 单元测试 | 循环迁移检测 | M |
| 集成测试 | 迁移事务性（失败恢复） | H |
| 集成测试 | 并发访问冲突（L） | L |

**测试fixture建议**:
```
tests/fixtures/
├─ baseline-legacy/       # 无版本标识的旧基线
├─ baseline-v0.9/         # 低于当前Major版本
├─ baseline-v1.0/         # 匹配版本
├─ baseline-v1.1/         # 高于Minor版本
├─ baseline-v99/          # 未来版本
├─ baseline-corrupted/    # 损坏JSON
├─ baseline-invalid/      # 结构无效
```

---

## 附录: 决策日志

| ID | 问题 | 决策 | 时间 | 影响范围 |
|----|------|------|------|---------|
| A1 | SkillDemand缺失 | 采用Blueprint定义 | 2026-05-03 | types.ts |
| A2 | saveBaseline未定义 | 原子写入+备份 | 2026-05-03 | baseline.ts |
| A3 | SchemaVersion位置冲突 | 双位置策略 | 2026-05-03 | types.ts, baseline.ts |
| A4 | --force行为未定义 | CLI层责任+配置化 | 2026-05-03 | CLI, LoadBaselineOptions |
| A5 | 通配版本匹配缺失 | 实现matchesVersion | 2026-05-03 | migrations/index.ts |
| B1 | 版本验证不足 | 增强parse验证 | 2026-05-03 | version.ts |
| B2 | legacy魔术字符串 | 定义常量 | 2026-05-03 | constants.ts |
| B3 | 迁移原子性缺失 | 事务性+备份恢复 | 2026-05-03 | migrations/index.ts |
| B4 | MigrationRecord缺checksum | 添加checksum字段 | 2026-05-03 | types.ts |
| B5 | CLI缺--json支持 | 添加--json选项 | 2026-05-03 | CLI |
| B6 | 错误格式不一致 | 统一错误模板 | 2026-05-03 | constants.ts |
| B7 | loadBaseline耦合analyze | 依赖注入rebuildHandler | 2026-05-03 | LoadBaselineOptions |
| C1 | .version文件冗余 | 保留+说明用途 | 2026-05-03 | 文档 |
| C2 | 时间戳无容忍度 | 添加5分钟容忍 | 2026-05-03 | verifyDataIntegrity |
| C3 | commitHash格式宽松 | 区分完整/缩写 | 2026-05-03 | 文档 |
| C4 | 循环迁移检测缺失 | 添加循环检测 | 2026-05-03 | findMigrationPath |

---

**文档版本**: v1.0
**创建日期**: 2026-05-03
**关联Change**: C6 `cg-baseline-persistence`
**用途**: 实现基线持久化的歧义澄清与技术指导