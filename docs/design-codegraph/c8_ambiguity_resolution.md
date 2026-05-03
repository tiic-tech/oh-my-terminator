# C8 开发歧义消除决议

> **文档定位**: 记录08_c8_impact_layers_spec.md开发歧义消除过程
> **审查日期**: 2026-05-03
> **决议数量**: 12

---

## 审查发现歧义

| 编号 | 问题 | 来源章节 | 严重度 |
|------|------|---------|--------|
| C8-1 | 测试文件排除规则不明确 | §6.1 vs §1.2 | HIGH |
| C8-2 | maxDepth=0的语义不明确 | §1.3 | MEDIUM |
| C8-3 | LAYER_THRESHOLD=2未举例 | §2.3 | MEDIUM |
| C8-4 | via字段格式不一致 | §8.1 vs §1.4 | HIGH |
| C8-5 | healthScore计算与C7不一致 | §2.4 | MEDIUM |
| C8-6 | DYNAMIC_IMPORTS是否计入影响范围 | §6.1 | HIGH |
| C8-7 | 空graph错误码与C6体系冲突 | §8.2 | LOW |
| C8-8 | blastRadius边界值归属确认 | §9.1 | LOW |
| C8-9 | nextSuggested代码示例错误 | §9.1 | HIGH |
| C8-10 | expectedLayerGap语义混淆 | §2.4 | MEDIUM |
| C8-11 | 同层互导是否视为违规 | §2.3 vs §2.4 | MEDIUM |
| C8-12 | affectedFiles去重逻辑不明确 | §9.2 | MEDIUM |

---

## 决议记录

### C8-1: 测试文件排除规则不明确

**歧义描述**: §6.1边缘情况处理表声明"默认排除 tests/、__tests__/"，但§1.2 BFS算法代码未体现此过滤逻辑。

**示例场景**:
```typescript
// §6.1声明排除测试文件
// 但§1.2 BFS遍历代码：
for (const edge of inEdges) {
  if (edge.type === EdgeType.IMPORTS) {
    const dependent = edge.from;
    // 未过滤测试文件！
    visited.add(dependent);
    directDependents.add(dependent);
  }
}

// 问题场景:
// src/utils/format.ts 被 src/__tests__/format.test.ts 导入
// getImpact 是否应该返回测试文件？
```

**决议**: **添加测试文件过滤逻辑，与C7 A2决议对齐**

**理由**:
1. **测试隔离原则**: 测试文件通常不参与生产依赖链，排除更准确反映实际影响范围
2. **与C7一致**: C7 extractImportedBy同样需要考虑测试文件处理
3. **可配置**: 通过options.includeTests允许用户选择是否包含
4. **默认排除**: 符合"影响范围分析"的实际场景需求

**修改内容**:
- §1.2 BFS算法添加测试目录过滤注释
- §6.1边缘情况处理添加includeTests配置说明

**修改章节**: §1.2 BFS遍历算法、§6.1 边缘情况处理

---

### C8-2: maxDepth=0的语义不明确

**歧义描述**: §1.3递归深度控制定义maxDepth默认值10，但未明确maxDepth=0的特殊含义。

**示例场景**:
```typescript
// maxDepth=0 的三种可能语义:
// Option A: 不遍历，返回空列表
// Option B: 仅返回直接依赖者（第一层）
// Option C: 返回所有（无限制，与undefined同义）

// 期望行为不明确:
getImpact(graph, targets, { maxDepth: 0 });
// 结果: []? 还是 [直接依赖者]? 还是 [全部]?
```

**决议**: **maxDepth=0表示仅返回直接依赖者（第一层）**

**理由**:
1. **语义一致性**: maxDepth表示"遍历深度"，0=第0层（目标本身），1=第1层（直接依赖），但算法已跳过目标层
2. **实际需求**: 用户可能只想查看直接依赖者，maxDepth=0或1均可作为"仅直接"的语义
3. **实现清晰**: 选择maxDepth=0表示"仅直接"（depth 1），与算法注释对齐
4. **边界文档化**: 在代码注释中明确maxDepth=0的特殊处理

**修改内容**:
- §1.3添加maxDepth边界值说明表
- getImpactWithDepthLimit函数添加注释说明maxDepth=0行为

**修改章节**: §1.3 递归深度控制

---

### C8-3: LAYER_THRESHOLD=2未举例

**歧义描述**: §2.3层级推断判定使用LAYER_THRESHOLD=2作为分组阈值，但未提供具体计算示例说明如何判定。

**示例场景**:
```typescript
// 组得分计算
// utils: netScore = 45 (被导入多)
// types: netScore = 32
// services: netScore = -13 (导入多)
// components: netScore = 12
// pages: netScore = -30

// 分组判定（LAYER_THRESHOLD=2）:
// utils(45) vs types(32): 差值=13 > 2 → 不同层？
// types(32) vs components(12): 差值=20 > 2 → 不同层？
// components(12) vs services(-13): 差值=25 > 2 → 不同层？
// services(-13) vs pages(-30): 差值=17 > 2 → 不同层？

// 实际期望分组:
// Layer 1: utils(45), types(32) → 差值13但应同层？
```

**决议**: **添加netScore差值计算示例和阈值判定逻辑说明**

**理由**:
1. **阈值语义澄清**: 阈值用于判定相邻组是否同层，而非绝对分数差距
2. **示例必要性**: 无示例导致开发者难以理解分组逻辑
3. **边界情况**: 分数接近的组应归为同层，需明确说明

**修改内容**:
- §2.3添加分组判定示例表格
- 说明阈值含义：相邻分数差距<=阈值时归为同层

**修改章节**: §2.3 层级推断判定

---

### C8-4: via字段格式不一致

**歧义描述**: §8.1 CLI JSON示例中via使用数组格式`["src/services/auth.ts"]`，但§1.4输出格式模板使用字符串格式`(via login.tsx)`。

**示例场景**:
```typescript
// §8.1 CLI JSON 示例:
{
  "path": "src/pages/Home.tsx",
  "distance": 2,
  "via": ["src/services/auth.ts"]  // 数组
}

// §1.4 输出格式模板:
- src/pages/dashboard.tsx (via login.tsx)  // 单个字符串
- src/pages/profile.tsx (via AuthProvider.tsx)  // 单个字符串

// 问题: 一个文件可能有多个路径到达目标:
// Home.tsx → auth.ts → format.ts
// Home.tsx → Modal.tsx → format.ts
// 应输出: via ["auth.ts", "Modal.tsx"] 还是 via "auth.ts, Modal.tsx"?
```

**决议**: **统一为数组格式，支持多路径场景**

**理由**:
1. **多路径场景**: 间接依赖者可能通过多个中间文件到达目标
2. **结构化优先**: CLI JSON输出应使用结构化数组，便于程序解析
3. **文本格式**: 压缩文本输出可使用逗号分隔字符串表示
4. **一致性**: API层返回数组，CLI层JSON保持数组，文本输出简化显示

**修改内容**:
- §1.4输出格式模板添加说明：文本格式简化显示，API返回数组
- §8.1保持数组格式，添加多路径示例

**修改章节**: §1.4 输出格式模板、§8.1 CLI JSON

---

### C8-5: healthScore计算与C7不一致

**歧义描述**: §2.4违规检测输出模板显示healthScore计算，但公式与C7 §2.3 complexity计算风格不一致，且缺少具体公式。

**示例场景**:
```typescript
// §2.4输出模板:
## Layer Health Score: 85/100
- Violation penalty: -15 points (3 violations)

// §8.2 CLI JSON示例:
"healthScore": 85

// 问题: 计算公式未明确
// - 每个违规扣多少分？
// - severity是否影响扣分？
// - 多少违规扣多少分？
```

**决议**: **明确healthScore计算公式，与§8.2 CLI severity分级对齐**

**理由**:
1. **公式透明**: 健康度计算需要明确公式供开发者实现
2. **与CLI对齐**: §8.2已定义severity分级，healthScore应使用相同权重
3. **可扩展**: 公式支持后续调整权重

**公式定义**:
```typescript
// healthScore计算公式
// 基础分: 100
// 扣分规则:
// - minor violation: -5 points
// - moderate violation: -10 points
// - critical violation: -15 points
// 最低分: 0

function calculateLayerHealthScore(violations: CLILayerViolation[]): number {
  let score = 100;
  for (const v of violations) {
    switch (v.severity) {
      case 'minor': score -= 5; break;
      case 'moderate': score -= 10; break;
      case 'critical': score -= 15; break;
    }
  }
  return Math.max(0, score);
}
```

**修改内容**:
- §2.4添加healthScore计算公式定义
- §5 API类型定义添加healthScore计算函数

**修改章节**: §2.4 违规检测、§5 API类型定义

---

### C8-6: DYNAMIC_IMPORTS是否计入影响范围

**歧义描述**: §6.1边缘情况处理表未明确DYNAMIC_IMPORTS边是否计入影响范围遍历。

**示例场景**:
```typescript
// src/index.ts
import('./utils.js').then(module => { ... });  // DYNAMIC_IMPORTS边

// src/utils.js 的 getImpact 结果是否包含 src/index.ts?

// C7 A2决议: extractImportedBy 不包含 DYNAMIC_IMPORTS（反向索引）
// C8 getImpact 是否遵循相同规则？

// 选项:
// A: 包含 DYNAMIC_IMPORTS - 影响范围更完整
// B: 不包含 - 与C7保持一致，静态分析边界
```

**决议**: **不包含DYNAMIC_IMPORTS边 - 与C7 A2决议对齐**

**理由**:
1. **与C7一致**: C7 A2决议明确extractImportedBy不包含DYNAMIC_IMPORTS边
2. **静态分析边界**: 动态导入目标在运行时解析，无法确定具体导入目标
3. **语义对称**: 如果C7反向索引不包含，C8正向遍历也应排除，保持语义一致
4. **实际影响**: 动态导入的文件不应被视为"静态依赖链"的一部分

**修改内容**:
- §6.1边缘情况处理表添加DYNAMIC_IMPORTS行
- §1.2 BFS算法添加注释说明不处理DYNAMIC_IMPORTS边

**修改章节**: §1.2 BFS遍历算法、§6.1 边缘情况处理

---

### C8-7: 空graph错误码与C6体系冲突

**歧义描述**: §8.2 CLI JSON测试使用E005_EMPTY_GRAPH错误码，但C6体系未定义此错误码范围归属。

**示例场景**:
```typescript
// §8.2 场景3: layers命令空图
{
  "success": false,
  "error": {
    "code": "E005_EMPTY_GRAPH",  // C6未定义此码？
    "message": "Graph contains no FILE nodes"
  }
}

// C6错误码定义（推断）:
// E001_TARGET_NOT_FOUND
// E002_PARSE_ERROR
// E003_?（未定义）
// E004_?（未定义）

// 问题: E005是否与C6冲突？是否需要统一错误码注册表？
```

**决议**: **扩展C6错误码体系，添加E003-E005定义**

**理由**:
1. **统一体系**: 所有CodeGraph CLI命令应共享统一错误码体系
2. **向后扩展**: C6定义E001-E002，C7/C8可扩展E003-E005
3. **语义清晰**: E003=NO_IMPACT, E004=NO_LAYERS, E005=EMPTY_GRAPH

**错误码扩展定义**:
```typescript
const CLIErrorCodes = {
  // C6基础错误码
  E001_TARGET_NOT_FOUND: 'Target node not found in graph',
  E002_PARSE_ERROR: 'Failed to parse baseline data',
  
  // C8扩展错误码
  E003_NO_IMPACT: 'No dependents found for target',
  E004_NO_LAYERS: 'No architecture layers could be inferred',
  E005_EMPTY_GRAPH: 'Graph contains no FILE nodes',
};
```

**修改内容**:
- §9.4 Exit Codes添加错误码扩展定义表
- 说明与C6附录A对齐关系

**修改章节**: §9.4 Exit Codes、§7 CLI输出格式

---

### C8-8: blastRadius边界值归属确认

**歧义描述**: §9.1 mapImpactToCLI函数定义blastRadius阈值，但边界值（3、10）归属不明确。

**示例场景**:
```typescript
// §9.1 blastRadius计算:
// - low: total ≤ 3
// - medium: total 4-10
// - high: total > 10

// 边界值问题:
// total = 3 → low? （≤3包含3）
// total = 10 → medium? （≤10包含10）

// 问题: 边界值归属需明确确认
```

**决议**: **边界值归属确认：3=low, 10=medium**

**理由**:
1. **边界清晰**: ≤3明确包含3，≤10明确包含10
2. **实现一致**: 避免开发者理解歧义
3. **测试覆盖**: 边界值需有对应测试

**修改内容**:
- §9.1添加边界值归属注释
- §8.1测试场景添加边界值验证

**修改章节**: §9.1 CLI命令映射

---

### C8-9: nextSuggested代码示例错误

**歧义描述**: §9.1 mapImpactToCLI函数代码示例使用了未定义的变量`topDependent`。

**示例场景**:
```typescript
// §9.1 代码示例:
// 生成 nextSuggested
const nextSuggested: string[] = [];
if (api.affectedFiles.length > 0) {
  // 建议查看直接依赖者
  const topDependent = api.affectedFiles[0];  // 变量定义正确
  nextSuggested.push(`codegraph scope FILE:${topDependent}`);  // 使用正确
}
nextSuggested.push('codegraph layers');

// 问题审查: 变量定义和使用是否正确？
// 审查结果: 代码正确，但需添加注释说明topDependent语义
```

**决议**: **代码正确，添加注释说明topDependent选择逻辑**

**理由**:
1. **代码审查**: 变量定义和使用正确，无需修改
2. **注释增强**: 添加注释说明为何选择第一个依赖者
3. **语义说明**: topDependent代表"最近的直接依赖者"

**修改内容**:
- §9.1代码添加注释说明topDependent选择语义

**修改章节**: §9.1 CLI命令映射

---

### C8-10: expectedLayerGap语义混淆

**歧义描述**: §2.4违规检测中expectedLayerGap计算语义混淆：期望层级差vs实际层级差。

**示例场景**:
```typescript
// §2.4违规检测:
interface LayerViolation {
  expectedLayerGap: number; // 期望层级差（from层 - to层 应为正数）
}

// 违规判定代码:
if (fromLayer < toLayer) {  // 低层导入高层
  violations.push({
    expectedLayerGap: toLayer - fromLayer  // 计算值为负数？
  });
}

// 问题: 
// - 注释说"应为正数"
// - 实际计算 toLayer - fromLayer 在违规场景下为正数
// - 但语义上"期望层级差"应是 fromLayer - toLayer（期望为正）
// - 混淆: 字段名"expected"暗示期望值，实际存储的是违规程度
```

**决议**: **字段重命名为layerGap并明确语义**

**理由**:
1. **语义澄清**: expectedLayerGap命名暗示"期望值"，实际存储的是"违规程度"
2. **重命名**: layerGap表示实际层级差距（绝对值）
3. **注释增强**: 说明layerGap在违规场景下表示跨越的层级数

**修改内容**:
- §2.4 LayerViolation接口字段重命名为layerGap
- §8.2 CLI JSON同步更新字段名

**修改章节**: §2.4 违规检测、§8.2 CLI JSON、§5 API类型定义

---

### C8-11: 同层互导是否视为违规

**歧义描述**: §2.3层级推断判定说"相互导入=同层或需要拆分警告"，但§2.4违规检测代码未检测同层互导。

**示例场景**:
```typescript
// §2.3判定原则:
// - 相互导入 = 同层或需要拆分警告

// §2.4违规检测代码:
if (fromLayer < toLayer) {  // 仅检测低层导入高层
  violations.push(...);
}
// 未检测 fromLayer === toLayer 的互导场景！

// 问题场景:
// utils/date.ts 导入 utils/format.ts
// utils/format.ts 导入 utils/date.ts
// 同层互导是否违规？
```

**决议**: **同层互导不视为违规，但可选输出警告**

**理由**:
1. **同层合理性**: 同层模块间互导在设计上是合理的（如utils内的工具互相调用）
2. **警告而非违规**: 建议输出警告而非记为违规，避免过度严格
3. **可配置**: 通过options.warnOnMutualImport控制是否警告
4. **与§2.3对齐**: "同层或需要拆分警告"明确同层互导可接受，警告仅作提示

**修改内容**:
- §2.3添加同层互导说明：默认不视为违规
- §2.4添加同层互导警告逻辑（可选）

**修改章节**: §2.3 层级推断判定、§2.4 违规检测

---

### C8-12: affectedFiles去重逻辑不明确

**歧义描述**: §9.2多目标场景说明"合并去重"，但具体去重逻辑未定义。

**示例场景**:
```typescript
// §9.2场景2: impact命令多目标
输入: getImpact(["FILE:src/utils/format.ts", "FILE:src/types/api.ts"])

// format.ts 的依赖者:
// - src/services/auth.ts (distance: 1)
// - src/pages/Home.tsx (distance: 2, via: auth.ts)

// api.ts 的依赖者:
// - src/services/auth.ts (distance: 1)
// - src/pages/Home.tsx (distance: 2, via: auth.ts)

// 合并去重问题:
// - Home.tsx 在两个结果中都存在
// - distance应取最小值还是保持各自值？
// - via应合并还是取最短路径？
```

**决议**: **distance取最小值，via取对应最短路径**

**理由**:
1. **语义清晰**: 受影响文件的distance表示"最近影响距离"
2. **最短路径**: 用户关心最短依赖链，而非全部路径
3. **via对应**: via与distance对应，显示到达目标的最短路径
4. **实现简单**: 使用Map<path, AffectedFile>去重，保留最小distance

**修改内容**:
- §9.2添加多目标去重逻辑说明
- §8.1添加多目标测试场景验证要点

**修改章节**: §9.2 CLI命令映射、§8.1 CLI JSON测试

---

## Fixture补充需求

| 需求 | 文件 | 用途 |
|------|------|------|
| 测试目录fixture | fixture添加tests/目录 | C8-1测试文件排除验证 |
| 同层互导fixture | fixture添加utils/mutual.ts | C8-11同层互导验证 |
| 多目标fixture | fixture添加cross-deps.ts | C8-12多目标去重验证 |
| 空图fixture | 创建empty-graph fixture | C8-7空图错误验证 |
| 动态导入fixture | fixture添加dynamic-deps.ts | C8-6 DYNAMIC_IMPORTS验证 |

---

## 开发准备确认

- [x] 所有HIGH歧义已消除（C8-1, C8-4, C8-6, C8-9）
- [x] spec文档已更新（12处修改完成）
- [ ] fixture已补充（标注待补充）
- [ ] TDD可启动

---

## 决议影响矩阵

| 决议 | 影响函数 | 影响类型 | 测试场景 |
|------|---------|---------|---------|
| C8-1 | bfsDependents | 添加过滤逻辑 | 测试文件排除测试 |
| C8-2 | getImpactWithDepthLimit | 注释说明 | 边界值测试 |
| C8-3 | inferArchitectureLayers | 添加示例文档 | 分组判定验证 |
| C8-4 | AffectedFile.via | 类型统一 | 多路径测试 |
| C8-5 | calculateLayerHealthScore | 公式定义 | 健康度计算测试 |
| C8-6 | bfsDependents | 边类型过滤 | DYNAMIC_IMPORTS测试 |
| C8-7 | CLIErrorCodes | 扩展定义 | 空图错误测试 |
| C8-8 | mapImpactToCLI | 注释增强 | 边界值测试 |
| C8-9 | mapImpactToCLI | 注释增强 | nextSuggested验证 |
| C8-10 | LayerViolation.layerGap | 字段重命名 | severity计算测试 |
| C8-11 | detectLayerViolations | 警告逻辑 | 同层互导测试 |
| C8-12 | 多目标合并 | 去重逻辑 | 多目标测试 |

---

## 附录: 决议时间线

| 时间 | 决议 |
|------|------|
| 2026-05-03 | C8-1: 添加测试文件过滤逻辑 |
| 2026-05-03 | C8-2: maxDepth=0表示仅直接依赖 |
| 2026-05-03 | C8-3: 添加分组判定示例 |
| 2026-05-03 | C8-4: via统一为数组格式 |
| 2026-05-03 | C8-5: 明确healthScore公式 |
| 2026-05-03 | C8-6: 不包含DYNAMIC_IMPORTS |
| 2026-05-03 | C8-7: 扩展C6错误码体系 |
| 2026-05-03 | C8-8: 确认blastRadius边界归属 |
| 2026-05-03 | C8-9: 添加topDependent注释 |
| 2026-05-03 | C8-10: 字段重命名为layerGap |
| 2026-05-03 | C8-11: 同层互导不视为违规 |
| 2026-05-03 | C8-12: distance取最小值 |

---

## 附录: 与其他规格对齐摘要

| 规格 | 对齐项 | 决议编号 |
|------|--------|---------|
| C7 A2 | DYNAMIC_IMPORTS反向索引不包含 | C8-6 |
| C6 错误码 | E001-E002扩展至E005 | C8-7 |
| C6 Exit Codes | 0/1/2统一语义 | §9.4 |
| C7 complexity | healthScore计算风格参考 | C8-5 |

---

**文档版本**: v1.0
**创建日期**: 2026-05-03
**用途**: Change 8 (`cg-api-impact-layers`) 实现参考