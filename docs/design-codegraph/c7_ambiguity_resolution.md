# C7 开发歧义消除决议

> **文档定位**: 记录07_c7_api_scope_spec.md开发歧义消除过程
> **审查日期**: 2026-05-03
> **决议数量**: 6

---

## 审查发现歧义

| 编号 | 问题 | 来源章节 | 严重度 |
|------|------|---------|--------|
| A1 | normalizeTarget缺少EXTERNAL处理 | §1.2 | HIGH |
| A2 | DYNAMIC_IMPORTS反向索引语义 | §1.3 | MEDIUM |
| A3 | Token预算强制执行时机 | §5.2 | MEDIUM |
| A4 | 计数语义歧义 | §2.2 | MEDIUM |
| A5 | MODULE ID解析失败边界 | §1.2 | LOW |
| A6 | 复杂度默认值 | §2.3 | LOW |

---

## 决议记录

### A1: EXTERNAL节点normalizeTarget处理

**歧义描述**: normalizeTarget函数仅处理FILE、MODULE、路径字符串三种输入类型，缺少EXTERNAL节点的处理逻辑。当用户查询`getScope("EXTERNAL:lodash")`时，函数无法正确解析。

**示例场景**:
```typescript
// 输入: getScope("EXTERNAL:lodash")
// normalizeTarget当前逻辑:
// - 不匹配 FILE: 前缀
// - 不匹配 MODULE: 前缀
// - fallback为 FILE:EXTERNAL:lodash (无效ID)

// 期望行为: 正确识别EXTERNAL节点并调用getScopeForExternal
```

**决议**: **添加情况4 - EXTERNAL节点处理**

**理由**:
1. EXTERNAL节点是CodeGraph的有效节点类型（NodeType.EXTERNAL）
2. 外部依赖查询是实际需求场景（了解哪些文件使用了lodash）
3. normalizeTarget应支持所有节点类型的规范化
4. 与现有getScopeForExternal函数配合使用

**修改内容**:
- normalizeTarget函数添加情况4: EXTERNAL节点处理
- 返回值添加targetType字段用于区分节点类型
- 更新测试场景4验证EXTERNAL查询行为

**修改章节**: §1.2 normalizeTarget函数定义

---

### A2: DYNAMIC_IMPORTS反向索引语义

**歧义描述**: extractImportedBy函数处理IMPORTS和RE_EXPORTS边，但不处理DYNAMIC_IMPORTS边。这是有意为之还是遗漏？语义是否对称？

**示例场景**:
```typescript
// src/index.ts
import('./utils.js').then(module => { ... });  // DYNAMIC_IMPORTS边

// src/utils.js 被动态导入
// extractImportedBy 是否应该包含 src/index.ts?

// 对比静态导入:
// import { format } from './utils.js';  // IMPORTS边
// extractImportedBy 包含 src/index.ts (正确)
```

**决议**: **不包含DYNAMIC_IMPORTS边 - 保持不对称设计**

**理由**:
1. **运行时解析特性**: 动态导入`import()`在运行时才解析目标模块，静态分析无法确定具体导入目标
2. **天然不对称性**: 我们知道文件A动态导入到哪里（从A的outEdges），但从目标B无法反向查找谁动态导入了它（B的inEdges不会记录）
3. **语义准确性**: 如果extractImportedBy包含DYNAMIC_IMPORTS，会产生误导：目标文件"知道"被动态导入，但实际上运行时才能确定
4. **实现一致性**: TypeScript解析器生成DYNAMIC_IMPORTS边时，目标可能是表达式而非确定的模块ID

**修改内容**:
- extractImportedBy添加注释说明不包含DYNAMIC_IMPORTS的原因
- 更新输出模板说明动态导入不参与反向依赖计算

**修改章节**: §1.3 extractImportedBy函数定义

---

### A3: Token预算强制执行时机

**歧义描述**: Section 5.2定义了600 token截断策略，但未明确是否为MVP强制要求。是否需要在第一阶段实现截断逻辑？

**示例场景**:
```typescript
// formatScopeOutputWithTokenLimit 函数定义存在
// 但是否需要在MVP阶段实现？

// 不实现的风险:
// - 大型文件的Scope输出可能超过600 tokens
// - Agent上下文预算可能被消耗

// 实现的复杂度:
// - 截断边界处理（如何优雅截断importedBy列表？）
// - 测试覆盖增加
// - MVP开发时间延长
```

**决议**: **MVP阶段不强制执行Token截断，列为Phase 2优化**

**理由**:
1. **典型场景估算**: 表格显示大多数输出 < 300 tokens（小型工具文件110、中型服务190、大型组件300），远低于600限制
2. **优先级原则**: MVP优先实现核心查询逻辑正确性，而非输出优化
3. **风险控制**: 截断逻辑涉及复杂边界处理，延迟实现降低MVP风险
4. **数据驱动**: Phase 2可根据实际使用数据优化截断策略，避免过早优化

**修改内容**:
- Section 5.2添加明确决议说明MVP不强制截断
- formatScopeOutputWithTokenLimit标记为Phase 2实现
- 添加典型场景token估算表格

**修改章节**: §5.2 Token优化策略

---

### A4: 计数语义歧义

**歧义描述**: countImports/countImportedBy返回数字，但语义不明确：是边数量还是唯一文件数量？

**示例场景**:
```typescript
// src/index.ts
import { formatDate, formatNumber } from './utils';  // 2条IMPORTS边？
import * as utils from './utils';                     // 1条IMPORTS边？

// countImports 返回值:
// - 边数量视角: 3 (三条IMPORTS边)
// - 文件数量视角: 1 (仅导入./utils一个文件)

// QuickBrief输出:
// ## Brief: src/index.ts
// - Imports: 3  // 用户理解为"导入3个文件"？
// - Imports: 1  // 用户理解为"导入1个文件"？
```

**决议**: **countImports计算边数量，而非唯一文件数量**

**理由**:
1. **依赖密度反映**: 一个文件多次导入同一目标的不同符号，反映更高的依赖密度。边数量更精确反映这种关系。
2. **QuickBrief定位**: QuickBrief是极简统计，"导入关系数量"比"导入文件数量"更有信息价值
3. **实现简单**: 直接统计边数量，无需去重逻辑
4. **与extractImports一致**: extractImports返回唯一文件列表（去重），countImports返回边数量（不去重），各有用途

**示例**:
- `import { a, b } from './utils'` → 2 edges, `countImports = 2`
- `import * as utils from './utils'` → 1 edge, `countImports = 1`
- `import('./utils')` → 1 DYNAMIC_IMPORTS edge, `countImports = 1`

**修改内容**:
- countImports添加注释说明语义和示例
- QuickBriefOutput字段注释更新为"导入关系数量"
- 同样语义应用于countImportedBy

**修改章节**: §2.2 countImports函数定义

---

### A5: MODULE ID解析失败边界

**歧义描述**: 当MODULE节点ID不存在时（如`MODULE:src/utils.ts#nonexistentExport`），normalizeTarget返回null，但后续处理未明确。

**示例场景**:
```typescript
// 输入: getScope("MODULE:src/utils.ts#nonexistentExport")
// normalizeTarget:
// - moduleNode = null (节点不存在)
// - fileNode = null (因为无法从null的moduleNode解析path)

// 当前行为: 走入"Target not found"错误路径
// 问题: 用户输入了正确的文件路径，仅导出名不存在
// 期望: 提示"导出不存在"而非"文件不存在"
```

**决议**: **添加MODULE节点不存在时的警告信息**

**理由**:
1. **用户体验**: "Target not found"提示过于笼统，用户可能误认为文件不存在
2. **调试帮助**: 明确提示MODULE节点不存在，帮助用户检查导出名是否正确
3. **边界清晰**: 区分"文件不存在"和"导出不存在"两种错误场景

**修改内容**:
- normalizeTarget返回值添加targetType字段
- getScope函数检查targetType='MODULE'且moduleNode=null的情况
- 返回专用警告信息："MODULE node not found: ${target}"

**修改章节**: §1.2 normalizeTarget函数、§1.4 边界场景处理表

---

### A6: 复杂度默认值

**歧义描述**: aggregateComplexity函数在无MODULE数据时返回`{ level: 'low', value: 0 }`。"low"暗示已知低复杂度，但实际是"无数据"状态。

**示例场景**:
```typescript
// FILE节点无任何MODULE子节点
// 可能原因:
// 1. 文件未被解析（仅扫描阶段）
// 2. 文件无导出符号
// 3. 文件类型不支持解析（如纯JSON文件）

// 当前输出:
// ### Complexity: low (0)  // 用户误解为"简单文件"

// 期望输出:
// ### Complexity: unknown  // 明确表示"未分析"或"无数据"
```

**决议**: **无MODULE数据时返回"unknown"而非"low"**

**理由**:
1. **语义准确性**: "low"表示已知低复杂度，"unknown"表示无数据/未分析
2. **避免误导**: 用户看到"low"可能误判文件复杂度，影响决策
3. **状态区分**: 三种状态：low/medium/high（已分析）vs unknown（未分析）
4. **与空值处理一致**: Section 1.3空值处理表已定义"无复杂度数据"返回"unknown"

**修改内容**:
- aggregateComplexity函数添加hasModuleData检测
- 无MODULE数据时返回`{ level: 'unknown', value: 0 }`
- ComplexityInfo接口添加'unknown'类型
- 更新错误处理代码中的complexity默认值

**修改章节**: §1.2 aggregateComplexity函数、§3 ComplexityInfo类型

---

## Fixture补充需求

| 需求 | 文件 | 用途 |
|------|------|------|
| 测试文件 | scope.test.ts | 全面Scope查询测试 |
| deprecated示例 | fixture中添加@deprecated导出 | deprecated检测验证 |
| EXTERNAL节点 fixture | 添加external-refs.ts | A1 EXTERNAL查询验证 |
| 动态导入fixture | 添加dynamic-import.ts | A2 DYNAMIC_IMPORTS验证 |
| 多符号导入fixture | 添加multi-import.ts | A4 边计数验证 |

---

## 开发准备确认

- [x] 所有P0歧义已消除（A1 HIGH已解决）
- [x] spec文档已更新（6处修改完成）
- [ ] fixture已补充（标注待补充）
- [ ] TDD可启动

---

## 决议影响矩阵

| 决议 | 影响函数 | 影响类型 | 测试场景 |
|------|---------|---------|---------|
| A1 | normalizeTarget | 函数逻辑 + 返回类型 | 场景4 EXTERNAL查询 |
| A2 | extractImportedBy | 注释说明 | 边界测试动态导入 |
| A3 | formatScopeOutput | Phase 2标记 | 无（MVP不实现） |
| A4 | countImports/countImportedBy | 注释说明 + 字段语义 | 边计数测试 |
| A5 | normalizeTarget + getScope | 函数逻辑 + 返回类型 | 场景5 MODULE不存在 |
| A6 | aggregateComplexity | 函数逻辑 + 类型定义 | 复杂度默认值测试 |

---

## 附录: 决议时间线

| 时间 | 决议 |
|------|------|
| 2026-05-03 | A1: normalizeTarget添加EXTERNAL处理 |
| 2026-05-03 | A2: DYNAMIC_IMPORTS不参与反向索引 |
| 2026-05-03 | A3: Token截断列为Phase 2 |
| 2026-05-03 | A4: countImports语义为边数量 |
| 2026-05-03 | A5: MODULE不存在返回警告信息 |
| 2026-05-03 | A6: 复杂度默认值改为unknown |

---

**文档版本**: v1.0
**创建日期**: 2026-05-03
**用途**: Change 7 (`cg-api-scope`) 实现参考