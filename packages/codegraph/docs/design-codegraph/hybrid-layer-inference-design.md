# Hybrid Layer Inference Design

> 简化版本 - 仅保留关键问题和确认可行的架构设计

---

## 1. 核心架构设计

### 1.1 五阶段推断管道

```
┌─────────────────────────────────────────────────────────────┐
│                    Hybrid Inference Pipeline                │
├─────────────────────────────────────────────────────────────┤
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
│    └─ 动态阈值 + 模糊匹配 + 置信度追踪                        │
│                                                             │
│  Phase 5: Fallback & Suggestions                            │
│    └─ Agent Prompt + 预过滤器 + 默认降级                     │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Plugin架构（语言无关扩展）

```
┌─────────────────────────────────────────────────────────────┐
│              Plugin-Based Architecture                        │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Plugin Registry                                   │
│  ├── TypeScript Plugin                                      │
│  │   └── Compiler API ImportClause.isTypeOnly              │
│  │   └── Layer建议: 0 (编译时)                              │
│  │                                                          │
│  ├── Python Plugin                                          │
│  │   └── .pyi stub检测                                      │
│  │   └── Layer建议: 0                                       │
│  │                                                          │
│  ├── Go/Rust/Java Plugin                                    │
│  │   └── interface/trait detection                          │
│  │   └── Layer建议: 1 (有运行时存在)                        │
│                                                              │
│  Layer 2: 配置覆盖系统                                       │
│  └── .codegraph/config.json                                 │
│      ├── typeFiles手动标记                                   │
│      ├── ffiBoundaries跨语言配置                             │
│      └── idlAware IDL生成代码                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Milestone Scope Management

### 2.1 M1 Scope (当前聚焦)

| 问题 | 优先级 | 解决方案 | 状态 |
|------|--------|----------|------|
| P0-stderr分离 | **M1** | CLI stderr输出分离 | 已实现 |
| P0-CLI输出修复 | **M1** | 命令格式修复 | 已实现 |
| P0-空项目处理 | **M1** | handleEmptyProject() | 已实现 |
| P0-单文件处理 | **M1** | handleSingleFileProject() | 已实现 |
| P0-测试文件排除 | **M1** | excludeTestFiles()预过滤 | 已实现 |
| P2-DEPTH_PRESETS | **M1** | 自适应深度配置表 | 设计完成 |

**M1交付目标**: C9(scope-query) + C10(quick-brief) + E2E测试通过

### 2.2 M2+ Scope (后续里程碑)

| 问题 | 优先级 | 解决方案 | Milestone |
|------|--------|----------|-----------|
| P1-Layer推断改进 | **M2** | Phase 1-5完整实现 | Week 1-2 |
| P1-Plugin系统 | **M2** | LanguagePluginRegistry | Week 3-4 |
| P2-TypeScript import type | **M2** | ImportClause.isTypeOnly | Week 5 |
| P2-Violation处理策略 | **M3** | ViolationLevel + Remediation | Week 6-7 |
| P3-其他语言Plugin | **M4** | Python/Go/Rust/Java | Week 8-10 |
| P4-跨语言FFI | **M5** | FFI boundary detection | Week 11+ |

---

## 3. 已解决的关键问题

### 3.1 Source Root Discovery

**问题**: tests/目录误判为源码根，node_modules污染

**解决方案**: 信号检测系统 + 排除列表

```typescript
// 权重分配表
const SIGNAL_WEIGHTS = {
  PACKAGE_JSON:    +10,  // 项目根标记
  TS_CONFIG:       +8,   // TypeScript项目
  TYPICAL_DIR:     +15,  // 最强信号: src/lib.app
  NO_NODE_MODULES: -20,  // 强负权重
  NO_DIST_BUILD:   -5,   // 构建输出扣分
};

const EXCLUDED_DIRECTORIES = [
  'node_modules', 'dist', 'build', 'test', 'tests', '__tests__',
  '.git', '.github', 'docs', 'coverage', '.next', '.nuxt'
];
```

### 3.2 循环依赖处理

**问题**: 循环依赖score无法区分层级

**解决方案**: DFS检测 + 惩罚公式

```typescript
// 循环惩罚公式
const penaltyPerMember = Math.ceil(cycle.length / 2);
score.cyclePenalty += penaltyPerMember;
score.netScore -= penaltyPerMember * 2;  // 双向惩罚
```

### 3.3 自适应深度

**问题**: threshold=2硬编码无依据

**解决方案**: DEPTH_PRESETS配置表

| 项目规模 | 文件数范围 | suggestedDepth | threshold |
|---------|-----------|---------------|----------|
| Small | 0-50 | 1 | 5 |
| Medium | 51-200 | 2 | 3 |
| Large | 201-500 | 3 | 2 |
| Enterprise | 501-2000 | 4 | 1 |

### 3.4 空项目/单文件处理

**解决方案**: Phase 0统一检测

```typescript
function detectSpecialCases(projectRoot: string): SpecialCaseResult {
  const sourceFiles = findSourceFiles(projectRoot);
  if (sourceFiles.length === 0) return { type: 'empty', warning: 'Empty project' };
  if (sourceFiles.length === 1) return { type: 'single-file', warning: 'Trivial structure' };
  return { type: 'normal', sourceFiles };
}
```

---

## 4. 待解决的关键问题 (M2+)

### 4.1 TypeScript import type检测

**现状**: TS Compiler API提供`ImportClause.isTypeOnly`，但当前parser未使用

**扩展设计**:

```typescript
interface ParsedImportInfo {
  importType: 'import' | 're-export' | 'dynamic';
  source: string;
  imports: ImportSpecifier[];
  isExternal: boolean;
  isTypeOnly: boolean;  // 新增
  typeOnlySpecifiers?: string[];  // 新增
}

// 使用Compiler API
const isTypeOnly = importClause?.isTypeOnly ?? false;
```

**Milestone**: M2 (Week 5)

### 4.2 语言差异处理（渐进式类型纯度模型）

**核心矛盾**: TS类型编译时消失 vs Go/Rust interface运行时存在

**解决方案**: purityLevel分级

| purityLevel | 语义 | Layer建议 | 适用语言 |
|-------------|------|----------|----------|
| 0 | 纯编译时消失 | Layer 0 | TypeScript .d.ts, Python .pyi |
| 1 | 有运行时存在 | Layer 1 | Go interface, Rust trait, Java interface |
| 2 | 完全运行时 | Layer 2+ | 业务逻辑 |

**Plugin接口设计**:

```typescript
interface LanguagePlugin {
  language: string;
  detectTypes(filePath: string): TypeDetectionResult;
  suggestLayer(result: TypeDetectionResult): LayerSuggestion;
}

enum PurityLevel {
  PURE_COMPILE_TIME = 0,
  HAS_RUNTIME_PRESENCE = 1,
  FULL_RUNTIME = 2
}
```

**Milestone**: M2 (Plugin Registry) + M4 (其他语言)

---

## 5. 实现路径

### 5.1 关键文件路径树

```
packages/codegraph/src/
├── parser/
│   └── ts-parser/
│       └── import-extractor.ts       # [M2扩展] isTypeOnly字段
│
├── plugins/                          # [M2新建]
│   ├── registry.ts                   # Plugin Registry
│   ├── types.ts                      # Plugin类型定义
│   ├── typescript-plugin.ts          # TS Plugin
│   └── [其他语言]                    # M4+
│
├── api/
│   └── layers/
│       └── inference/
│           └── core.ts               # [M2扩展] Plugin集成
│
├── config/
│   └── type-config-loader.ts         # [M2新建] 配置加载
│
└── types/
    └── layer-types.ts                # [扩展] PurityLevel枚举
```

### 5.2 工时估算

| Phase | Milestone | 预估工时 |
|-------|-----------|----------|
| TS Parser扩展 | M2 | 4h |
| Plugin Registry | M2 | 8h |
| FileTypeInfo metadata | M2 | 6h |
| Layer assignment集成 | M2 | 8h |
| Python/Go/Rust/Java Plugin | M4 | 12h |
| 用户配置系统 | M2 | 8h |
| **总计M2** | - | **46h** |

---

## 6. 工具范围界定

### 6.1 允许的工具

| 工具类别 | 具体工具 | 用途 |
|---------|---------|------|
| 编译器工具 | TypeScript Compiler API | AST解析，import type检测 |
| AST解析 | Python AST / tree-sitter | 源码结构分析 |
| 语言Parser | Go parser, Rust syn | 各语言原生解析 |
| 静态分析 | 任何静态分析方法 | 依赖关系分析 |

### 6.2 禁止的工具

| 工具类别 | 具体工具 | 禁用原因 |
|---------|---------|----------|
| AI模型 | LLM, Claude, GPT | 用户约束 |
| 机器学习 | ML模型 | 用户约束 |

---

**文档版本**: v4.0 (简化版)
**更新日期**: 2026-05-05
**状态**: Scope Management已定义，可开始M1交付