# MODULE节点生成与计算算法技术规格

> 版本: v1.0
> 依赖: docs/design-codegraph/01_origin_blueprint.md §3.1, §4.2.3
> 参考: ESLint complexity规则原理

---

## 1. 圈复杂度计算 (Complexity)

### 1.1 McCabe标准算法原理

圈复杂度（Cyclomatic Complexity）由Thomas J. McCabe于1976年提出，用于量化代码的控制流复杂程度。核心公式：

```
CC = E - N + 2P
```

其中：
- **E**: 控制流图边数
- **N**: 控制流图节点数
- **P**: 连通分量数（单入口单出口程序 P=1）

**简化实现**: 在AST遍历中，复杂度 = 决策点数量 + 1（基准值）

决策点定义：
- 每个条件分支（if、switch case、循环）增加复杂度
- 每个逻辑运算符（&&、||、??）增加复杂度
- 基准值为1（函数入口）

### 1.2 AST节点权重表

| AST节点类型 | 权重 | 说明 |
|------------|------|------|
| `IfStatement` | +1 | if条件分支 |
| `ConditionalExpression` | +1 | 三元表达式 `a ? b : c` |
| `SwitchStatement` | +case数 | 每个case分支独立计数 |
| `CaseClause` | +1 | switch中的单个case |
| `DefaultClause` | +1 | switch中的default |
| `ForStatement` | +1 | for循环 |
| `ForInStatement` | +1 | for-in循环 |
| `ForOfStatement` | +1 | for-of循环 |
| `WhileStatement` | +1 | while循环 |
| `DoStatement` | +1 | do-while循环 |
| `CatchClause` | +1 | try-catch中的catch |
| `BinaryExpression` (&&) | +1 | 逻辑AND |
| `BinaryExpression` (||) | +1 | 逻辑OR |
| `BinaryExpression` (??) | +1 | 空值合并运算符 |

### 1.3 SwitchStatement特殊处理

Switch语句的复杂度计算采用**分支累加策略**：

```typescript
// 计算规则
// 1. SwitchStatement本身不增加复杂度（容器）
// 2. 每个CaseClause增加+1
// 3. DefaultClause增加+1
// 4. 空case（fallthrough）仍计数

// 示例
switch (x) {
  case 1:        // +1
    doSomething();
  case 2:        // +1
    doAnother();
    break;
  default:       // +1
    handleDefault();
}
// 该switch贡献复杂度 = 3
```

**边界情况处理**：
- 空switch（无case无default）：贡献0
- 仅default无case：贡献1
- 连续fallthrough case：每个case独立计数

### 1.4 逻辑运算符统计

逻辑运算符在表达式层面增加决策路径：

```typescript
// 示例1: 简单逻辑AND
if (a && b) { }  // 复杂度: 2 (if + &&)

// 示例2: 链式逻辑运算符
if (a || b || c) { }  // 复杂度: 3 (if + || + ||)

// 示例3: 嵌套逻辑
if (a && (b || c)) { }  // 复杂度: 3 (if + && + ||)

// 示例4: 空值合并链
const x = a ?? b ?? c;  // 复杂度: 2 (?? + ??)
```

**注意**: 仅统计顶层逻辑运算符，嵌套于函数调用参数中的逻辑运算符不计入该函数复杂度。

### 1.5 TypeScript实现代码

```typescript
import ts from 'typescript';

/**
 * 计算函数/方法的圈复杂度
 * @param node - 函数声明节点
 * @returns 圈复杂度数值（最小值为1）
 */
export function calculateComplexity(node: ts.FunctionLikeDeclaration): number {
  let complexity = 1; // 基准值：函数入口
  
  // 递归遍历AST
  traverse(node.body!, (child) => {
    switch (child.kind) {
      // 条件分支
      case ts.SyntaxKind.IfStatement:
        complexity += 1;
        break;
      
      case ts.SyntaxKind.ConditionalExpression:
        complexity += 1;
        break;
      
      // Switch分支
      case ts.SyntaxKind.CaseClause:
        complexity += 1;
        break;
      
      case ts.SyntaxKind.DefaultClause:
        complexity += 1;
        break;
      
      // 循环语句
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForInStatement:
      case ts.SyntaxKind.ForOfStatement:
      case ts.SyntaxKind.WhileStatement:
      case ts.SyntaxKind.DoStatement:
        complexity += 1;
        break;
      
      // 异常处理
      case ts.SyntaxKind.CatchClause:
        complexity += 1;
        break;
      
      // 逻辑运算符
      case ts.SyntaxKind.BinaryExpression: {
        const binExpr = child as ts.BinaryExpression;
        const operator = binExpr.operatorToken.kind;
        if (
          operator === ts.SyntaxKind.AmpersandAmpersandToken ||
          operator === ts.SyntaxKind.BarBarToken ||
          operator === ts.SyntaxKind.QuestionQuestionToken
        ) {
          complexity += 1;
        }
        break;
      }
    }
  });
  
  return complexity;
}

/**
 * AST递归遍历辅助函数
 */
function traverse(node: ts.Node, visitor: (node: ts.Node) => void): void {
  visitor(node);
  ts.forEachChild(node, (child) => traverse(child, visitor));
}

/**
 * 计算类方法的复杂度（含所有方法）
 */
export function calculateClassComplexity(node: ts.ClassDeclaration): number {
  let totalComplexity = 0;
  
  ts.forEachChild(node, (child) => {
    if (
      ts.isMethodDeclaration(child) ||
      ts.isGetAccessorDeclaration(child) ||
      ts.isSetAccessorDeclaration(child)
    ) {
      totalComplexity += calculateComplexity(child);
    }
  });
  
  return totalComplexity;
}
```

### 1.6 测试用例验证表

| 测试场景 | 代码示例 | 预期复杂度 | 验证点 |
|---------|---------|-----------|-------|
| 空函数 | `function empty() {}` | 1 | 基准值 |
| 单if | `function f() { if (x) {} }` | 2 | if+基准 |
| 链式if | `function f() { if (a) {} if (b) {} }` | 3 | 多if累加 |
| if-else | `function f() { if (x) {} else {} }` | 2 | else不额外增加 |
| 三元表达式 | `const f = () => x ? 1 : 0` | 2 | ConditionalExpression |
| switch-3case | 见1.3示例 | 4 | 基准+3case |
| for循环 | `function f() { for (;;) {} }` | 2 | ForStatement |
| while循环 | `function f() { while (x) {} }` | 2 | WhileStatement |
| 嵌套循环 | `function f() { for (;;) { if (x) {} } }` | 3 | 循环+if嵌套 |
| 逻辑AND | `function f() { if (a && b) {} }` | 3 | if+&& |
| 链式OR | `function f() { if (a || b || c) {} }` | 4 | if+||+|| |
| try-catch | `function f() { try {} catch {} }` | 2 | CatchClause |
| 空值合并 | `const f = () => a ?? b` | 2 | ??运算符 |
| 综合场景 | 见下方完整测试 | 8 | 多种组合 |

**完整综合测试代码**：

```typescript
function complexExample(data: unknown): string {
  // 复杂度计算：基准1 + if1 + &&1 + for1 + switch3 + catch1 = 8
  
  if (Array.isArray(data) && data.length > 0) {  // +2 (if + &&)
    for (const item of data) {                    // +1 (for-of)
      switch (item.type) {                        // case容器不计
        case 'A':                                  // +1
          return 'TypeA';
        case 'B':                                  // +1
          return 'TypeB';
        default:                                   // +1
          return 'Unknown';
      }
    }
  }
  
  try {                                           // try不计
    return process(data);
  } catch {                                       // +1 (catch)
    return 'Error';
  }
}
// 预期复杂度: 8
```

---

## 2. LOC计算 (Lines of Code)

### 2.1 有效代码行定义

有效代码行（LOC）排除以下内容：
- 空行（仅含空白字符）
- 单行注释（`// ...`）
- 多行注释（`/* ... */`）
- JSDoc注释（`/** ... */`）

**统计口径**：物理行数而非逻辑行数（一条语句跨多行按实际行数计）

### 2.2 AST遍历方式实现（推荐）

通过AST遍历统计非空、非注释节点的行范围：

```typescript
import ts from 'typescript';

/**
 * 通过AST计算有效代码行数
 * @param sourceFile - TypeScript源文件节点
 * @returns 有效代码行数
 */
export function calculateLOCByAST(sourceFile: ts.SourceFile): number {
  const lineSet = new Set<number>();
  
  traverseForLOC(sourceFile, (node) => {
    // 排除注释节点
    if (
      ts.isJsDoc(node) ||
      ts.isSingleLineCommentTrivia(node) ||
      ts.isMultiLineCommentTrivia(node)
    ) {
      return;
    }
    
    // 获取节点行范围
    const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
    const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
    
    // 记录所有行
    for (let line = startLine; line <= endLine; line++) {
      lineSet.add(line);
    }
  });
  
  return lineSet.size;
}

/**
 * LOC专用遍历（排除空节点）
 */
function traverseForLOC(
  node: ts.Node,
  visitor: (node: ts.Node) => void
): void {
  // 排除空节点（如纯空行产生的节点）
  if (node.getText().trim().length === 0) {
    return;
  }
  
  visitor(node);
  ts.forEachChild(node, (child) => traverseForLOC(child, visitor));
}
```

### 2.3 文本分析方式实现（备用）

当AST不可用时，通过文本扫描统计：

```typescript
/**
 * 通过文本分析计算有效代码行数
 * @param source - 源代码文本
 * @returns 有效代码行数
 */
export function calculateLOCByText(source: string): number {
  const lines = source.split('\n');
  let loc = 0;
  
  // 多行注释状态追踪
  let inMultiLineComment = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // 空行
    if (trimmed.length === 0) {
      continue;
    }
    
    // 处理多行注释
    if (inMultiLineComment) {
      if (trimmed.includes('*/')) {
        inMultiLineComment = false;
        // 检查*/后是否有代码
        const afterComment = trimmed.split('*/')[1]?.trim();
        if (afterComment && afterComment.length > 0) {
          loc++;
        }
      }
      continue;
    }
    
    // 多行注释开始
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) {
        inMultiLineComment = true;
      }
      continue;
    }
    
    // 单行注释
    if (trimmed.startsWith('//')) {
      continue;
    }
    
    // JSDoc注释
    if (trimmed.startsWith('/**')) {
      if (!trimmed.includes('*/')) {
        inMultiLineComment = true;
      }
      continue;
    }
    
    // 有效代码行
    loc++;
  }
  
  return loc;
}
```

### 2.4 注释和空行排除规则

| 排除类型 | 正则模式 | 示例 |
|---------|---------|------|
| 空行 | `/^\s*$/` | `"\n   \n"` |
| 单行注释 | `/^\s*\/\/.*/` | `"// TODO: fix"` |
| 多行注释开始 | `/^\s*\/\*/` | `"/* block start"` |
| 多行注释结束 | `/^\s*\*\//` | `"*/"` |
| JSDoc开始 | `/^\s*\/\*\*/` | `"/** Documentation"` |
| JSDoc中间行 | `/^\s*\*[^\/]/` | `" * @param x"` |

**混合行处理**：
```typescript
// 代码后注释 - 计入LOC
const x = 1; // comment  → 有效行

// 注释后代码 - 计入LOC（文本方式）
/* comment */ const y = 2;  → 有效行

// 多行注释包裹代码 - 不计入LOC
/*
 * This is
 * a comment
 */  → 全部排除
```

### 2.5 测试用例验证表

| 测试场景 | 代码示例 | 预期LOC | 验证点 |
|---------|---------|---------|-------|
| 空文件 | `""` | 0 | 无任何内容 |
| 仅空行 | `"\n\n\n"` | 0 | 空行排除 |
| 单行代码 | `"const x = 1;"` | 1 | 基础计数 |
| 代码+空行 | `"const x = 1;\n\nconst y = 2;"` | 2 | 空行排除 |
| 单行注释 | `"// comment\nconst x = 1;"` | 1 | 注释排除 |
| 多行注释 | `"/* comment */\nconst x = 1;"` | 1 | 多行注释排除 |
| JSDoc | `"/** @param x */\nfunction f() {}"` | 1 | JSDoc排除 |
| 多行JSDoc | `"/**\n * desc\n */\nfunction f() {}"` | 1 | 多行JSDoc排除 |
| 代码后注释 | `"const x = 1; // comment"` | 1 | 含注释的代码行 |
| 混合行 | `"/* c */ const x = 1;"` | 1 | 注释后代码 |
| 跨行语句 | `"const x =\n  1 +\n  2;"` | 3 | 物理行计数 |
| 类声明 | 见下方完整测试 | 5 | 多元素累加 |

**完整LOC测试代码**：

```typescript
/**
 * Sample class for LOC calculation
 * Expected LOC: 5 (excluding comments and blank lines)
 */

// This is a single-line comment - excluded
class SampleClass {
  /* Multi-line comment - excluded */
  
  private value: number;    // Line 1
  
  constructor(v: number) {  // Line 2
    this.value = v;         // Line 3
  }
  
  getValue(): number {      // Line 4
    return this.value;      // Line 5
  }
}
```

---

## 3. kind推断规则

### 3.1 完整判定表

| AST节点类型 | kind值 | 判定条件 |
|------------|--------|---------|
| `FunctionDeclaration` | `function` | 无额外条件 |
| `ArrowFunction` | `function` | 在VariableStatement中 |
| `FunctionExpression` | `function` | 在VariableStatement中 |
| `ClassDeclaration` | `class` | 无额外条件 |
| `InterfaceDeclaration` | `interface` | 无额外条件 |
| `TypeAliasDeclaration` | `type` | 无额外条件 |
| `EnumDeclaration` | `enum` | 无额外条件（元数据中可选） |
| `VariableStatement` | 动态判定 | 见3.2详细规则 |

### 3.2 VariableStatement详细判定

```typescript
/**
 * 推断VariableStatement的kind
 * @param node - VariableStatement节点
 * @param sourceFile - 源文件（用于文件扩展名检查）
 * @returns kind值
 */
export function inferVariableKind(
  node: ts.VariableStatement,
  sourceFile: ts.SourceFile
): 'function' | 'component' | 'variable' {
  const decl = node.declarationList.declarations[0];
  if (!decl || !decl.initializer) {
    return 'variable';
  }
  
  const init = decl.initializer;
  
  // 箭头函数
  if (ts.isArrowFunction(init)) {
    return inferArrowFunctionKind(init, sourceFile);
  }
  
  // 函数表达式
  if (ts.isFunctionExpression(init)) {
    return 'function';
  }
  
  // JSX元素（React组件）
  if (ts.isJsxElement(init) || ts.isJsxSelfClosingElement(init)) {
    return 'component';
  }
  
  // 其他
  return 'variable';
}

/**
 * 推断箭头函数是否为组件
 */
function inferArrowFunctionKind(
  arrow: ts.ArrowFunction,
  sourceFile: ts.SourceFile
): 'function' | 'component' {
  // 检查返回值是否为JSX
  if (arrow.body && ts.isJsxElement(arrow.body) || ts.isJsxSelfClosingElement(arrow.body)) {
    return 'component';
  }
  
  // 检查函数体是否返回JSX
  if (ts.isBlock(arrow.body)) {
    const returnStmts = arrow.body.statements.filter(ts.isReturnStatement);
    for (const ret of returnStmts) {
      if (ret.expression && (
        ts.isJsxElement(ret.expression) ||
        ts.isJsxSelfClosingElement(ret.expression)
      )) {
        return 'component';
      }
    }
  }
  
  return 'function';
}
```

### 3.3 JSX组件识别逻辑

**三层判定策略**：

1. **文件扩展名检查**（优先级最高）
   ```typescript
   const filePath = sourceFile.fileName;
   if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
     // 可能包含组件，进一步检查
   }
   ```

2. **返回值类型检查**（优先级中等）
   ```typescript
   // 箭头函数返回JSX元素
   const MyComponent = () => <div>Hello</div>;  // component
   
   // 函数返回非JSX
   const getValue = () => 42;  // function
   ```

3. **命名约定检查**（优先级最低）
   ```typescript
   // PascalCase命名暗示组件
   const MyButton = () => <button>Click</button>;  // component
   
   // camelCase命名暗示普通函数
   const handleClick = () => {};  // function
   ```

**完整判定流程**：

```typescript
export function isReactComponent(
  node: ts.FunctionLikeDeclaration,
  sourceFile: ts.SourceFile,
  name?: string
): boolean {
  // 层1: 文件扩展名
  const extOk = sourceFile.fileName.endsWith('.tsx') || 
                sourceFile.fileName.endsWith('.jsx');
  if (!extOk) return false;
  
  // 层2: 返回JSX检查
  const body = node.body;
  if (body) {
    // 直接返回JSX
    if (ts.isJsxElement(body) || ts.isJsxSelfClosingElement(body)) {
      return true;
    }
    
    // Block中返回JSX
    if (ts.isBlock(body)) {
      for (const stmt of body.statements) {
        if (ts.isReturnStatement(stmt) && stmt.expression) {
          if (ts.isJsxElement(stmt.expression) || 
              ts.isJsxSelfClosingElement(stmt.expression)) {
            return true;
          }
        }
      }
    }
  }
  
  // 层3: PascalCase命名（可选辅助）
  if (name && /^[A-Z][a-zA-Z0-9]*$/.test(name)) {
    // 命名符合组件规范，但返回值未确认JSX
    // 保守策略：不标记为component
    return false;
  }
  
  return false;
}
```

### 3.4 特殊场景处理

| 场景 | 处理方式 | kind值 |
|-----|---------|--------|
| 高阶组件 | 返回函数的函数 | `function` |
| `forwardRef`包装 | 检查参数是否为组件 | `component` |
| `memo`包装 | 检查参数是否为组件 | `component` |
| 异步组件 | `async function` | `function` |
| 泛型组件 | `<T>(props: T) => JSX` | `component` |
| 无返回值函数 | `function log() {}` | `function` |
| 常量声明 | `const MAX = 100` | `variable` |
| 对象声明 | `const config = {}` | `variable` |

**高阶组件/包装器识别**：

```typescript
/**
 * 识别React.forwardRef/memo包装的组件
 */
function isWrappedComponent(node: ts.Node): boolean {
  if (ts.isCallExpression(node)) {
    const expr = node.expression;
    if (ts.isPropertyAccessExpression(expr)) {
      const obj = expr.expression.getText();
      const prop = expr.name.getText();
      
      // React.forwardRef / React.memo
      if (obj === 'React' && (prop === 'forwardRef' || prop === 'memo')) {
        return true;
      }
    }
  }
  return false;
}
```

### 3.5 测试用例验证表

| 测试场景 | 代码示例 | 预期kind | 验证点 |
|---------|---------|---------|-------|
| 函数声明 | `function foo() {}` | `function` | 直接判定 |
| 箭头函数变量 | `const fn = () => {}` | `function` | ArrowFunction |
| 箭头函数返回JSX | `const C = () => <div/>` | `component` | 返回值JSX |
| 类声明 | `class Foo {}` | `class` | 直接判定 |
| 接口声明 | `interface I {}` | `interface` | 直接判定 |
| 类型别名 | `type T = string` | `type` | 直接判定 |
| 常量变量 | `const x = 1` | `variable` | 无函数初始化器 |
| 对象变量 | `const obj = {}` | `variable` | 无函数初始化器 |
| 函数表达式 | `const fn = function() {}` | `function` | FunctionExpression |
| Block返回JSX | 见下方示例 | `component` | 语句块中返回 |
| 高阶函数 | `const hoc = () => () => {}` | `function` | 返回函数的函数 |
| forwardRef包装 | 见下方示例 | `component` | React API识别 |

**Block返回JSX测试**：

```typescript
// .tsx文件中
const MyComponent = (props) => {
  if (!props.show) {
    return null;
  }
  return (
    <div>
      {props.children}
    </div>
  );
};
// 预期kind: component（检测到return JSX）
```

**forwardRef包装测试**：

```typescript
const Input = React.forwardRef((props, ref) => {
  return <input ref={ref} {...props} />;
});
// 预期kind: component（识别forwardRef包装）
```

---

## 4. default导出处理

### 4.1 命名规则表

| 导出形式 | 节点ID命名规则 | 示例 |
|---------|--------------|------|
| 具名default导出 | `MODULE:文件路径#导出名` | `export default function foo() {}` → `MODULE:src/a.ts#foo` |
| 匿名default导出 | `MODULE:文件路径#default` | `export default function() {}` → `MODULE:src/a.ts#default` |
| 表达式default导出 | `MODULE:文件路径#default` | `export default 42` → `MODULE:src/a.ts#default` |
| 重导出default | `MODULE:原文件路径#原导出名` | `export { default } from './b'` → 引用原节点 |
| 重导出并重命名 | `MODULE:文件路径#重命名` | `export { default as x } from './b'` → `MODULE:src/a.ts#x` |

### 4.2 具名/匿名/表达式导出处理

```typescript
/**
 * 处理default导出的命名
 * @param node - 导出声明节点
 * @param sourceFile - 源文件
 * @returns MODULE节点命名
 */
export function resolveDefaultExportName(
  node: ts.ExportDeclaration | ts.ExportAssignment,
  sourceFile: ts.SourceFile
): string {
  const filePath = sourceFile.fileName;
  
  // export default function foo() {} - 具名
  if (ts.isExportAssignment(node)) {
    const expr = node.expression;
    
    // 具名函数声明
    if (ts.isFunctionDeclaration(expr) && expr.name) {
      return `MODULE:${filePath}#${expr.name.getText()}`;
    }
    
    // 具名类声明
    if (ts.isClassDeclaration(expr) && expr.name) {
      return `MODULE:${filePath}#${expr.name.getText()}`;
    }
    
    // 其他表达式（匿名函数、值、对象等）
    return `MODULE:${filePath}#default`;
  }
  
  // export { default } from '...' - 重导出
  if (ts.isExportDeclaration(node) && node.exportClause) {
    if (ts.isNamedExports(node.exportClause)) {
      for (const elem of node.exportClause.elements) {
        if (elem.name.getText() === 'default') {
          // 检查是否有重命名
          if (elem.propertyName) {
            return `MODULE:${filePath}#${elem.name.getText()}`;
          }
          // 原样导出，引用原文件节点
          // 此处返回特殊标记，由调用方处理跨文件引用
          return `EXTERNAL_DEFAULT_REF`;
        }
      }
    }
  }
  
  return `MODULE:${filePath}#default`;
}
```

### 4.3 export default函数命名

**特殊优先级规则**：

```typescript
// 规则1: 具名函数优先使用函数名
export default function authenticate() {}
// → MODULE:src/auth.ts#authenticate

// 规则2: 匿名函数使用default
export default function() {}
// → MODULE:src/auth.ts#default

// 规则3: 箭头函数变量使用变量名
const login = () => {};
export default login;
// → MODULE:src/auth.ts#login

// 规则4: 表达式使用default
export default () => {};
// → MODULE:src/auth.ts#default
```

**实现逻辑**：

```typescript
/**
 * 从export default提取最佳命名
 */
export function extractDefaultExportName(
  sourceFile: ts.SourceFile
): string | null {
  for (const node of sourceFile.statements) {
    if (ts.isExportAssignment(node)) {
      const expr = node.expression;
      
      // 具名函数/类声明
      if (
        (ts.isFunctionDeclaration(expr) && expr.name) ||
        (ts.isClassDeclaration(expr) && expr.name)
      ) {
        return expr.name!.getText();
      }
      
      // 标识符引用（export default xxx）
      if (ts.isIdentifier(expr)) {
        return expr.getText();
      }
      
      // 其他情况
      return 'default';
    }
  }
  return null;
}
```

### 4.4 文件级default导出优先级

一个文件只能有一个default导出，处理优先级：

| 优先级 | 声明位置 | 处理方式 |
|-------|---------|---------|
| 1 | `export default function foo()` | 创建`MODULE:file#foo` |
| 2 | `function foo() {}; export default foo` | 创建`MODULE:file#foo` |
| 3 | `const foo = () => {}; export default foo` | 创建`MODULE:file#foo` |
| 4 | `export default () => {}` | 创建`MODULE:file#default` |
| 5 | `export default class Foo` | 创建`MODULE:file#Foo` |
| 6 | `export default { ... }` | 创建`MODULE:file#default` (kind=variable) |
| 7 | `export default 42` | 创建`MODULE:file#default` (kind=variable) |

**冲突检测**：若文件中出现多个default导出声明，解析器应报错：

```typescript
/**
 * 验证default导出唯一性
 */
export function validateDefaultExportUniqueness(
  sourceFile: ts.SourceFile
): { valid: boolean; error?: string } {
  let defaultCount = 0;
  
  for (const node of sourceFile.statements) {
    if (ts.isExportAssignment(node)) {
      defaultCount++;
    }
  }
  
  if (defaultCount > 1) {
    return {
      valid: false,
      error: `Multiple default exports in ${sourceFile.fileName}`
    };
  }
  
  return { valid: true };
}
```

### 4.5 测试用例验证表

| 测试场景 | 代码示例 | 节点ID | kind |
|---------|---------|--------|------|
| 具名函数default | `export default function foo() {}` | `MODULE:a.ts#foo` | `function` |
| 具名类default | `export default class Bar {}` | `MODULE:a.ts#Bar` | `class` |
| 匿名函数default | `export default function() {}` | `MODULE:a.ts#default` | `function` |
| 箭头函数引用 | `const fn = () => {}; export default fn` | `MODULE:a.ts#fn` | `function` |
| 匿名箭头default | `export default () => {}` | `MODULE:a.ts#default` | `function` |
| 常量引用 | `const x = 1; export default x` | `MODULE:a.ts#x` | `variable` |
| 字面量default | `export default 42` | `MODULE:a.ts#default` | `variable` |
| 对象default | `export default { a: 1 }` | `MODULE:a.ts#default` | `variable` |
| 重导出default | `export { default } from './b'` | 引用原文件节点 | 原kind |
| 重命名重导出 | `export { default as x } from './b'` | `MODULE:a.ts#x` | 原kind |
| 组件default | `export default () => <div/>` | `MODULE:a.ts#default` | `component` |

---

## 5. 测试用例

### 5.1 圈复杂度测试代码

```typescript
// test/fixtures/complexity.ts

/**
 * 测试函数1: 空函数
 * Complexity: 1
 */
export function emptyFunction(): void {}

/**
 * 测试函数2: 单条件
 * Complexity: 2
 */
export function singleIf(x: boolean): number {
  if (x) {
    return 1;
  }
  return 0;
}

/**
 * 测试函数3: 多条件
 * Complexity: 4
 */
export function multiCondition(a: boolean, b: boolean, c: boolean): number {
  if (a && b) {       // +1 (if) +1 (&&)
    return 1;
  }
  if (b || c) {       // +1 (if) +1 (||)
    return 2;
  }
  return 0;
}

/**
 * 测试函数4: switch分支
 * Complexity: 4
 */
export function switchExample(type: string): string {
  switch (type) {
    case 'A':         // +1
      return 'Alpha';
    case 'B':         // +1
      return 'Beta';
    default:          // +1
      return 'Unknown';
  }
}

/**
 * 测试函数5: 循环
 * Complexity: 3
 */
export function loopExample(items: number[]): number {
  let sum = 0;
  for (const item of items) {  // +1
    if (item > 0) {            // +1
      sum += item;
    }
  }
  return sum;
}

/**
 * 测试函数6: 综合复杂
 * Complexity: 8
 */
export function comprehensiveExample(
  data: unknown,
  options: { flag: boolean }
): string {
  if (Array.isArray(data) && data.length > 0) {  // +2
    for (const item of data) {                    // +1
      switch (item.type) {
        case 'A':                                  // +1
          return 'TypeA';
        case 'B':                                  // +1
          return 'TypeB';
        default:                                   // +1
          return 'Unknown';
      }
    }
  }
  
  try {
    return process(data);
  } catch {                                       // +1
    return 'Error';
  }
  
  function process(d: unknown): string {
    return String(d);
  }
}
```

### 5.2 LOC测试代码

```typescript
// test/fixtures/loc.ts

/**
 * LOC测试文件
 * 预期有效代码行数: 10
 * (排除所有注释和空行)
 */

// 单行注释 - 排除
const line1 = 1;                      // 有效行1

/* 多行注释开始
   这是注释内容
   多行注释结束 */                   // 排除

const line2 = 2;                      // 有效行2
                                     // 空行 - 排除

/**
 * JSDoc注释
 * @param x 输入值
 * @returns 返回值
 */                                   // 排除
function calculate(x: number): number {  // 有效行3
  const multiplier = 2;                 // 有效行4
  return x * multiplier;                // 有效行5
}

class ExampleClass {                     // 有效行6
  private value: number;                 // 有效行7
  
  constructor(v: number) {               // 有效行8
    this.value = v;                      // 有效行9
  }
  
  getValue(): number {                   // 有效行10
    return this.value;
  }
}
```

### 5.3 kind推断测试代码

```typescript
// test/fixtures/kinds.ts

// === 函数类型 ===

export function namedFunction(): void {}  // kind: function

export const arrowFunction = () => {};     // kind: function

export const functionExpr = function() {}  // kind: function

// === 组件类型 (.tsx文件) ===

export const ReactComponent = () => <div>Hello</div>;  // kind: component

export const BlockComponent = (props) => {             // kind: component
  if (!props.show) return null;
  return <section>{props.children}</section>;
};

export class ClassComponent extends React.Component {  // kind: class (非component)
  render() {
    return <div />;
  }
}

// === 类类型 ===

export class ServiceClass {                 // kind: class
  private data: unknown;
  
  process() {
    return this.data;
  }
}

// === 接口/类型 ===

export interface DataInterface {            // kind: interface
  id: number;
  name: string;
}

export type ResultType = 'success' | 'error';  // kind: type

// === 变量类型 ===

export const MAX_COUNT = 100;               // kind: variable

export const configObject = {               // kind: variable
  apiUrl: '/api',
  timeout: 5000
};

// === 高阶/包装 ===

export const hocFunction = () => () => {};  // kind: function (高阶函数)

export const WrappedComponent = React.memo(  // kind: component (memo包装)
  () => <button>Click</button>
);
```

### 5.4 default导出测试代码

```typescript
// test/fixtures/defaultExports.ts

// === 具名default导出 ===

export default function namedDefault(): void {}  // MODULE:defaultExports.ts#namedDefault

export default class DefaultClass {}             // MODULE:defaultExports.ts#DefaultClass

// === 引用式default导出 ===

const helperFn = () => {};
export default helperFn;                          // MODULE:defaultExports.ts#helperFn

const helperValue = 42;
export default helperValue;                       // MODULE:defaultExports.ts#helperValue

// === 匿名/表达式default导出 ===

export default () => {};                          // MODULE:defaultExports.ts#default

export default {                                  // MODULE:defaultExports.ts#default
  a: 1,
  b: 2
};

export default 42;                                // MODULE:defaultExports.ts#default

// === 组件default导出 ===

export default () => <App />;                     // MODULE:defaultExports.ts#default (component)

// test/fixtures/reExportDefault.ts

// === 重导出 ===

export { default } from './defaultExports';       // 引用原文件节点

export { default as renamedDefault } from './defaultExports';  // MODULE:reExportDefault.ts#renamedDefault
```

---

## 6. 实现建议

### 6.1 性能优化

- **复杂度计算**: 遍历时跳过函数声明内部（仅计算顶层决策点）
- **LOC计算**: 使用Set去重行号，避免重复计数
- **kind推断**: 优先检查AST节点类型，避免深度遍历

### 6.2 错误处理

- 空AST节点：返回默认值（complexity=1, loc=0, kind='unknown')
- 解析失败：记录警告，继续处理其他节点
- 类型推断不确定：采用保守策略

### 6.3 边界情况

| 场景 | 处理方式 |
|-----|---------|
| 空函数体 | complexity=1, loc=0 |
| 仅注释文件 | 不创建MODULE节点 |
| 内嵌函数 | 不递归计算内嵌函数复杂度 |
| 泛型声明 | 正常处理，不影响kind判定 |
| 装饰器 | 不影响复杂度计算 |

---

## 附录A: ESLint complexity参考

ESLint complexity规则实现要点：

```javascript
// ESLint complexity核心逻辑
function computeComplexity(node) {
  let complexity = 1;
  
  // 增加决策点
  if (node.test) complexity++;
  if (node.consequent && node.alternate) {
    // if-else不额外增加
  }
  if (node.cases) {
    complexity += node.cases.length;
  }
  
  return complexity;
}
```

参考链接: https://eslint.org/docs/rules/complexity

---

## 附录B: McCabe原始论文参考

McCabe, T. J. (1976). "A Complexity Measure". IEEE Transactions on Software Engineering, SE-2(4), 308-320.

核心定理：
- CC = E - N + 2P
- CC ≤ 10 为可维护阈值
- CC > 50 需重构

---

## 版本历史

| 版本 | 日期 | 变更 |
|-----|------|-----|
| v1.0 | 2026-05-02 | 初始版本 |