## Context

CodeGraph C1-C5已完成核心图结构、文件扫描、TS解析、模块提取和全量分析流程。当前分析结果在内存中构建，每次运行都需要完整重新分析，无法持久化。

**当前状态**:
- `CodeGraph.toJSON()` 返回 `SerializedCodeGraph`（无版本信息）
- `analyzeFull()` 返回内存中的图结构，无持久化
- 无增量更新基础（Change 10依赖基线存储）

**约束**:
- 必须向后兼容C1-C5的 `SerializedCodeGraph` 格式
- 必须遵循Blueprint §3.4 Baseline结构定义
- 版本管理采用语义化版本（SemVer）

**相关决策**: 已在 `c6_ambiguity_resolution.md` 中澄清5个高优先级歧义

## Goals / Non-Goals

**Goals:**
1. 实现基线持久化到 `.codegraph/` 目录
2. 添加 `SchemaVersion` 版本管理，支持major/minor/patch层级兼容检查
3. 实现迁移框架，支持跨版本基线迁移（包括野生卡匹配）
4. 定义失败处理策略矩阵（error/rebuild/migrate/proceed）
5. 原子写入保障（临时文件+rename）
6. 为CLI命令（C9）和增量更新（C10）奠定基础

**Non-Goals:**
1. 不实现增量更新逻辑（Change 10职责）
2. 不实现完整CLI命令（仅提供核心函数，Change 9负责CLI层）
3. 不实现自动备份清理策略（可后续优化）
4. 不处理分布式/多进程并发写入（MVP阶段单进程假设）

## Decisions

### D1: SchemaVersion存储位置

**决策**: 双位置策略

| 位置 | 必需性 | 用途 |
|------|--------|------|
| `Baseline.schemaVersion` | 必需 | 主位置，完整元数据 |
| `SerializedCodeGraph.schemaVersion` | 可选 | 兼容旧版，fallback读取 |

**理由**:
- Blueprint定义Baseline为主结构，schemaVersion应在此
- SerializedCodeGraph可能独立使用（增量更新delta），需可选携带版本
- 加载时优先Baseline，fallback SerializedCodeGraph，保障向后兼容

**替代方案**:
- 仅在Baseline: SerializedCodeGraph独立使用时无法获取版本
- 仅在SerializedCodeGraph: 与Blueprint不一致

### D2: 原子写入策略

**决策**: POSIX原子写入（临时文件+rename）

```typescript
// 写入流程
const tempPath = baselinePath + '.tmp';
await writeFile(tempPath, content);  // 1. 写临时文件
await rename(tempPath, baselinePath); // 2. 原子rename
```

**理由**:
- POSIX rename是原子操作，避免部分写入导致数据损坏
- 磁盘满时临时文件写入失败，不影响原文件
- 跨平台兼容（Node.js fs.rename支持）

**替代方案**:
- 直接writeFile: 可能产生部分写入，数据损坏风险
- 文件锁: 跨平台复杂，Node.js无原生支持

### D3: 迁移框架设计

**决策**: 注册式迁移脚本 + BFS路径查找 + 野生卡匹配

```typescript
// 迁移脚本注册
registerMigration({
  fromVersion: '1.x',      // 支持 'x' 野生卡
  toVersion: '1.1.0',
  migrate: (baseline) => { /* 转换逻辑 */ }
});

// 路径查找：BFS找最短迁移路径
const path = findMigrationPath('1.0.0', '1.2.0');
// -> [1.0.0->1.1.0, 1.1.0->1.2.0]
```

**理由**:
- 注册式允许增量添加迁移脚本（每次schema变更添加一个）
- BFS路径查找自动处理多步迁移
- 野生卡匹配支持跨多minor版本的统一迁移

**替代方案**:
- 硬编码迁移链: 每次新版本需修改核心代码
- 直接迁移（无路径查找）: 仅支持相邻版本迁移

### D4: 失败处理策略矩阵

**决策**: 根据兼容性原因自动选择action

| CompatibilityReason | Action | 说明 |
|---------------------|--------|------|
| `legacy_baseline` | rebuild | 无版本标识，强制重建 |
| `major_version_mismatch` (baseline > current) | error | 基线来自未来版本，无法处理 |
| `major_version_mismatch` (baseline < current) | migrate | 尝试迁移 |
| `minor_version_old` | migrate/proceed | 可选迁移，取决于autoMigrate配置 |
| `patch_version_old` | proceed | 直接使用 |
| `version_match` | proceed | 完全兼容 |

**理由**:
- 安全优先：未知情况默认error而非盲目迁移
- 用户控制：autoMigrate配置允许延迟minor迁移
- 语义化版本：patch不影响兼容性

### D5: loadBaseline与analyzeFull的解耦

**决策**: 依赖注入方式调用rebuild

```typescript
interface LoadBaselineOptions {
  rebuildHandler?: (cwd: string) => Promise<CodeGraph>;  // 可注入
}

// 默认使用analyzeFull
const result = await loadBaseline(cwd, {
  rebuildHandler: analyzeFull  // 默认
});

// CLI层可注入自己的handler（如带进度报告）
const result = await loadBaseline(cwd, {
  rebuildHandler: (cwd) => cliAnalyze(cwd, { showProgress: true })
});
```

**理由**:
- 核心逻辑不直接依赖analyzer.ts具体实现
- CLI层可注入带UI反馈的handler
- 测试时可注入mock handler

**替代方案**:
- 直接调用analyzeFull: 核心逻辑绑定analyzer实现，难以测试

## Risks / Trade-offs

### R1: 大型仓库基线文件体积
**风险**: 大型仓库可能产生数百MB的baseline.json
→ **缓解**: 
- MVP阶段接受此开销（增量更新C10会减少全量分析频率）
- 后续可考虑压缩存储或分片存储（非MVP目标）

### R2: 迁移脚本累积维护成本
**风险**: 每次schema变更需添加迁移脚本，长期维护成本增加
→ **缓解**:
- 仅major版本迁移需要复杂逻辑
- minor/patch通常只需添加默认值字段
- 野生卡迁移脚本可覆盖多个版本

### R3: 原子写入跨平台差异
**风险**: Windows rename行为与POSIX略有不同（但Node.js已处理）
→ **缓解**: 
- Node.js fs.rename在Windows使用MoveFileEx，非原子但有错误处理
- 测试覆盖跨平台场景（CI: macOS + Windows + Linux）

### R4: 并发写入数据竞争
**风险**: 多个进程同时运行analyze可能导致baseline损坏
→ **缓解**:
- MVP阶段假设单进程，文档明确说明限制
- C10增量更新会引入文件锁机制

### R5: 迁移失败数据丢失
**风险**: 迁移过程中失败可能损坏baseline
→ **缓解**:
- 迁移前创建.bak备份
- safeMigrateBaseline实现事务式迁移（失败则恢复备份）
- 迁移日志记录操作过程

## Migration Plan

### 阶段1: 类型定义 (Day 1-2)
- 创建 `persistence/types.ts`: Baseline, SchemaVersion等类型
- 创建 `version.ts`: SchemaVersion类实现
- 扩展 `types.ts`: SerializedCodeGraph添加schemaVersion?

### 阶段2: 核心逻辑 (Day 3-5)
- 创建 `compatibility.ts`: 版本比较、兼容性检查
- 创建 `baseline.ts`: loadBaseline, saveBaseline核心实现
- 创建 `paths.ts`: .codegraph目录结构定义

### 阶段3: 迁移框架 (Day 6-8)
- 创建 `migrations/index.ts`: 注册入口
- 创建 `legacy-to-1.0.0.ts`: 首个迁移脚本
- 实现findMigrationPath、versionMatchesPattern

### 阶段4: 验证与测试 (Day 9-10)
- 单元测试: 版本解析、兼容性检查、结构验证
- 集成测试: load/save完整流程、迁移执行
- 性能测试: 大型fixture基线读写

### Rollback策略
- 迁移失败时恢复.bak备份
- analyze --force可强制重建（绕过迁移）
- deprecated标记触发自动重建

## Open Questions

1. **.version文件必要性**: 是否需要单独的.version文件用于快速版本检查？还是直接读取baseline.json？
   - 当前决策: 可选，主要用于快速检查避免完整JSON解析
   - 待验证: 实际性能差异

2. **迁移日志持久化**: 迁移日志应存储在baseline.json内部还是单独文件？
   - 当前决策: baseline.json内部（MigrationRecord[]）
   - 待验证: 是否需要单独迁移审计日志

3. **SkillDemand来源**: 应在C1 types.ts定义还是C6 persistence/types.ts？
   - 当前决策: C6定义并引用Blueprint §3.4
   - 待验证: 是否需要跨包共享机制