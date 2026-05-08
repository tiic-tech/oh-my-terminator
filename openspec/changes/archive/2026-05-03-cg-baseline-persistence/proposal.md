## Why

CodeGraph分析结果目前无法持久化，每次运行都需要完整重新分析。这导致：
1. **性能浪费**：大型仓库重复分析耗时过长
2. **增量更新无法实现**：无法基于上次分析结果进行diff更新
3. **版本迁移风险**：schema变更时无兼容性保障机制

现在需要实现基线持久化，为后续增量更新（Change 10）和CLI命令（Change 9）奠定基础。

## What Changes

- 新增 `.codegraph/` 目录结构定义，存储基线数据
- 实现 `baseline.json` 序列化与反序列化
- 添加 `SchemaVersion` 版本管理机制，支持语义化版本控制
- 实现版本兼容性检查（major/minor/patch层级）
- 添加迁移框架，支持跨版本基线迁移
- 实现 `loadBaseline` 失败处理策略（rebuild/migrate/proceed）
- 新增 CLI 命令：`version --check-baseline`、`migrate`
- 扩展 `SerializedCodeGraph` 接口，添加可选 `schemaVersion` 字段
- 新增 `Baseline` 接口，包含完整元数据结构

## Capabilities

### New Capabilities

- `baseline-persistence`: 基线读写、原子写入策略、备份机制、目录结构定义
- `version-compatibility`: SchemaVersion类型、版本比较、兼容性检查函数、action决策矩阵
- `migration-framework`: 迁移脚本注册、路径查找、野生卡匹配、原子迁移、rollback机制

### Modified Capabilities

- `graph-structure`: `SerializedCodeGraph` 接口新增可选 `schemaVersion?: SchemaVersion` 字段（向后兼容）
- `analyzer`: `analyzeFull()` 返回结果需支持完整Baseline结构，`CodeGraph.toJSON()` 输出包含版本信息

## Impact

**新增文件**:
```
packages/codegraph/src/
├─ persistence/
│   ├─ types.ts           # Baseline, SchemaVersion, MigrationRecord等类型
│   ├─ version.ts         # SchemaVersion类实现
│   ├─ compatibility.ts   # checkSchemaCompatibility, determineAction
│   ├─ baseline.ts        # loadBaseline, saveBaseline, migrateBaseline
│   ├─ paths.ts           # .codegraph目录路径定义
│   ├─ migrations/
│   │   ├─ index.ts       # 迁移脚本注册入口
│   │   └─ legacy-to-1.0.0.ts  # 首个迁移脚本
│   └─ index.ts
├─ version.ts             # CURRENT_SCHEMA_VERSION, GENERATOR_VERSION常量
```

**修改文件**:
- `packages/codegraph/src/types.ts`: 扩展 `SerializedCodeGraph`
- `packages/codegraph/src/graph.ts`: `toJSON()` 输出schemaVersion
- `packages/codegraph/src/index.ts`: 导出新增类型和函数

**依赖关系**:
- 依赖 Change 1 (`graph.ts`, `types.ts`): 核心图结构
- 依赖 Change 5 (`analyzer.ts`): `analyzeFull()` 用于rebuild场景

**CLI集成**:
- 为 Change 9 CLI 提供 `version`、`migrate` 命令实现
- `analyze --force` 将触发baseline rebuild