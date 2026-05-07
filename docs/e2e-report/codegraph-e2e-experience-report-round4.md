# CodeGraph E2E Experience Report - Round 4

**日期**: 2026-05-08  
**测试视角**: 代码开发Agent第一视角  
**测试目标**: 全面评估codegraph是否满足"少量token提供高质量开发情报"目标  
**版本**: Post-C15/C16 (CLI UX + Source-Root Auto-Detect)

---

## Executive Summary

| 维度 | 评分 | 说明 |
|------|------|------|
| **情报准确性** | 10/10 | exports/imports/依赖链100%匹配实际代码 |
| **Agent可解析性** | 9/10 | JSON结构清晰，易于程序化处理 |
| **Token效率** | 10/10 | ~275 tokens vs ~13000 bytes源代码（**47倍节省**） |
| **决策支持** | 7/10 | 基础情报充足，深度情报缺失 |
| **能力边界** | 7/10 | FILE/MODULE支持完善，DIRECTORY缺失 |
| **Auto-Detect** | 4/10 | **关键Bug**：Git检测失败、空layers返回 |
| **总体评分** | **7.8/10** | 基础功能优秀，auto-detect有阻塞性问题 |

---

## 测试场景覆盖

### Batch 1: 实际开发场景模拟

| 场景 | 测试Agent | 结果 | 关键发现 |
|------|-----------|------|----------|
| **修改前查询影响范围** | Agent A | PASS | scope/impact情报准确，缺少循环依赖检测 |
| **理解项目架构层级** | Agent B | **FAIL** | Git检测失败(E_NO_GIT_REPO)，空layers返回 |
| **重构模块查询依赖链** | Agent C | PASS | 依赖链完整，blast radius评级准确 |

### Batch 2: 输出质量与边界验证

| 场景 | 测试Agent | 结果 | 关键发现 |
|------|-----------|------|----------|
| **Token效率评估** | Token Agent | PASS | 47倍token节省，情报密度高 |
| **能力边界探索** | Boundary Agent | PARTIAL | FILE/MODULE支持，DIRECTORY缺失 |

---

## 关键发现详情

### ✅ 优秀表现

#### 1. 情报准确性 (10/10)

| 测试项 | 验证方式 | 结果 |
|--------|----------|------|
| exports准确性 | 对比实际代码导出 | 100%匹配（13 exports全部正确） |
| imports准确性 | 对比实际import语句 | 100%匹配（5 imports全部正确） |
| importedBy准确性 | grep验证反向依赖 | 100%匹配（3 dependents全部正确） |
| 依赖链完整性 | via路径追溯 | 正确区分direct/indirect，路径完整 |

**证据示例**：
```
scope analyzer/index.ts返回:
- exports: 13项（完全匹配实际代码export语句）
- imports: 5项（完全匹配实际代码import语句）
- importedBy: 3项（analyze.ts, analyze-helpers.ts, update.ts均实际导入）
```

#### 2. Token效率 (10/10)

| 对比项 | 直接读源代码 | 使用codegraph | 节省比例 |
|--------|--------------|---------------|----------|
| analyzer/index.ts + 依赖 | ~12,946 bytes | ~275 tokens (scope+impact) | **47倍** |
| 理解模块导出 | 需读全部文件 | scope输出仅150 tokens | **极大节省** |
| 理解影响范围 | 需追溯依赖链 | impact输出仅125 tokens | **极大节省** |

**结论**: "少量token提供高质量情报"目标**完全达成**。

#### 3. 模块级情报 (9/10)

| 情报项 | 是否提供 | 质量 |
|--------|----------|------|
| Export符号列表 | ✅ | 包含kind(function/class/type)和ID |
| Import依赖列表 | ✅ | 包含type(static/dynamic/re-export) |
| ImportedBy反向依赖 | ✅ | 包含文件路径和specifiers |
| Blast Radius评级 | ✅ | small/medium/large/unknown四级 |
| 依赖路径(via) | ✅ | 完整追溯链 |
| 复杂度信息 | ⚠️ | 提供但部分模块为unknown |
| 测试覆盖 | ✅ | hasTest字段 |
| 废弃标记 | ✅ | deprecated字段 |

---

### ⚠️ 需改进项

#### 1. Layers命令Auto-Detect失败 (P0 BLOCKING)

**问题描述**: 
- 从子目录运行`layers`命令时，Git检测失败返回`E_NO_GIT_REPO`
- 从项目根目录运行时，返回空layers但`healthScore: 100`

**影响**: Developer Agent无法使用auto-detect流程，必须每次指定`--source-root`。

**复现步骤**:
```bash
# 从packages/codegraph运行
npx tsx bin/codegraph.ts layers --json
# 返回: E_NO_GIT_REPO "Not a git repository"

# 从项目根目录运行
npx tsx packages/codegraph/bin/codegraph.ts layers --json
# 返回: {"layers":[], "healthScore":100} ← misleading!
```

**根因分析**: 
- Git检测检查当前目录而非向上搜索`.git`
- Source-root评分在项目根目录返回0分（无src/lib/app匹配）

#### 2. 缺少循环依赖检测 (P1)

**问题描述**: scope/impact输出不包含循环依赖警告。

**期望行为**: 如果目标模块参与循环依赖，应返回：
```json
{
  "warnings": ["Circular dependency detected: A → B → C → A"]
}
```

**影响**: Developer Agent无法提前识别危险的循环依赖。

#### 3. 复杂度信息不完整 (P2)

**问题描述**: 
- 纯类型文件(types.ts)返回`complexity: {level: "unknown", value: 0}`
- 应根据类型结构复杂度提供有意义评分

#### 4. DIRECTORY级情报不支持 (P2)

**问题描述**: `scope packages/codegraph/src/api`返回`E001_TARGET_NOT_FOUND`

**期望行为**: 支持目录级别聚合情报：
```json
{
  "target": "DIR:packages/codegraph/src/api",
  "exports": [...],  // 目录内所有文件exports聚合
  "imports": [...],   // 目录级依赖聚合
  "fileCount": 50
}
```

#### 5. 相对路径格式不支持 (P2)

**问题描述**: `scope analyzer/index.ts`返回错误

**期望行为**: 支持相对路径或智能路径匹配

---

### ✅ 能力边界确认

| 目标类型 | 支持状态 | 情报质量 |
|----------|----------|----------|
| FILE:path/to/file.ts | ✅ 完全支持 | 完整情报(exports/imports/importedBy) |
| MODULE:path#symbol | ✅ 完全支持 | 导出符号追踪 |
| EXTERNAL:package-name | ✅ 支持 | 仅import追踪（exports为空） |
| DIR:path/to/dir | ❌ 不支持 | E001_TARGET_NOT_FOUND |
| 相对路径 | ❌ 不支持 | E001_TARGET_NOT_FOUND |

---

## Agent决策支持评估

### 作为开发Agent，这些情报是否足够做出修改决策？

| 决策点 | Codegraph提供 | 评估 |
|--------|---------------|------|
| "这个模块导出什么？" | ✅ exports列表 | 充分 |
| "谁依赖这个模块？" | ✅ importedBy列表 | 充分 |
| "修改会影响多少文件？" | ✅ impact summary | 充分 |
| "这个修改风险多大？" | ⚠️ blastRadius | 部分（缺少量化阈值文档） |
| "修改难度多大？" | ⚠️ complexity | 部分（部分为unknown） |
| "是否有循环依赖？" | ❌ 不提供 | **缺失** |
| "是否有测试覆盖？" | ✅ hasTest | 充分 |
| "应该放在哪层？" | ✅ layers（需显式source-root） | 部分可用 |

**结论**: 基础决策情报充足（7/9），深度决策情报缺失（循环依赖、量化风险）。

---

## Release Readiness Assessment

### Ready for Release
- ✅ scope命令 - 情报准确，token高效
- ✅ impact命令 - 依赖链完整，blast radius评级
- ✅ analyze命令 - baseline创建正常
- ✅ JSON/stderr分离 - stdout纯JSON，stderr警告
- ✅ 错误处理 - 友好错误消息（C15已修复）

### NOT Ready for Release (Blocking)
- ❌ **layers命令auto-detect** - Git检测失败、空layers返回

### 建议的修复优先级

| Priority | Issue | 预估工时 |
|----------|-------|----------|
| **P0** | Git向上搜索检测 | 2h |
| **P0** | 空layers返回错误而非误导success | 1h |
| **P1** | 循环依赖检测警告 | 4h |
| **P2** | types文件复杂度计算 | 2h |
| **P2** | DIRECTORY级scope支持 | 4h |

---

## Test Artifacts

| 文件 | 位置 |
|------|------|
| Layers命令详细报告 | `docs/e2e/e2e-report-cg-layers.md` |
| Scope/Impact测试数据 | `docs/e2e/test-results.json` |
| 能力边界报告 | `packages/codegraph/docs/reviews/e2e-capability-boundary-report.md` |

---

## Conclusion

**CodeGraph核心功能（scope/impact）已达到生产可用标准**，情报准确性、Token效率优秀，满足"少量token提供高质量开发情报"目标。

**但layers命令auto-detect存在阻塞性Bug**，必须修复P0问题后才能支持Developer Agent完整工作流。

**推荐**:
1. 立即修复P0问题（Git向上搜索 + 空layers错误处理）
2. 发布scope/impact功能供Agent使用
3. P1/P2问题后续版本迭代

---

**测试执行**: 5个并行Agent，约5分钟测试时间  
**报告版本**: Round 4 (Post-C15/C16)  
**下一步**: 修复P0问题后执行Round 5验证