import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import ts from 'typescript';
import {
  ModuleExtractor,
  extractModules,
  detectKind,
  calculateComplexity,
  countLOC,
  extractJSDoc,
  generateModuleId,
  type ModuleExtractResult,
  type ModuleMetadata,
} from '../../src/parser/module-extractor/index.js';
import { NodeType, EdgeType } from '../../src/types.js';

const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');
const moduleTestProject = path.join(fixturesDir, 'module-test-project');

describe('detectKind', () => {
  it('should classify FunctionDeclaration as function', () => {
    const code = `export function test() {}`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const func = sourceFile.statements[0] as ts.FunctionDeclaration;
    assert.strictEqual(detectKind(func), 'function');
  });

  it('should classify ClassDeclaration as class', () => {
    const code = `export class Test {}`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const cls = sourceFile.statements[0] as ts.ClassDeclaration;
    assert.strictEqual(detectKind(cls), 'class');
  });

  it('should classify InterfaceDeclaration as interface', () => {
    const code = `export interface Test {}`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const iface = sourceFile.statements[0] as ts.InterfaceDeclaration;
    assert.strictEqual(detectKind(iface), 'interface');
  });

  it('should classify TypeAliasDeclaration as type', () => {
    const code = `export type Test = string;`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const typeAlias = sourceFile.statements[0] as ts.TypeAliasDeclaration;
    assert.strictEqual(detectKind(typeAlias), 'type');
  });

  it('should classify EnumDeclaration as type', () => {
    const code = `export enum Status { Active, Inactive }`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const enumDecl = sourceFile.statements[0] as ts.EnumDeclaration;
    assert.strictEqual(detectKind(enumDecl), 'type');
  });

  it('should classify arrow function variable as function', () => {
    const code = `export const handler = () => {};`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const varStmt = sourceFile.statements[0] as ts.VariableStatement;
    const varDecl = varStmt.declarationList.declarations[0];
    assert.strictEqual(detectKind(varDecl), 'function');
  });

  it('should classify other variables as variable', () => {
    const code = `export const API_URL = 'https://api.com';`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const varStmt = sourceFile.statements[0] as ts.VariableStatement;
    const varDecl = varStmt.declarationList.declarations[0];
    assert.strictEqual(detectKind(varDecl), 'variable');
  });
});

describe('calculateComplexity', () => {
  it('should return 1 for simple function', () => {
    const code = `function test() { return 1; }`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const func = sourceFile.statements[0] as ts.FunctionDeclaration;
    assert.strictEqual(calculateComplexity(func), 1);
  });

  it('should count if statement as +1', () => {
    const code = `function test() { if (x) { return 1; } }`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const func = sourceFile.statements[0] as ts.FunctionDeclaration;
    assert.strictEqual(calculateComplexity(func), 2); // base + if
  });

  it('should count if-else as +2', () => {
    const code = `function test() { if (x) { return 1; } else { return 2; } }`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const func = sourceFile.statements[0] as ts.FunctionDeclaration;
    assert.strictEqual(calculateComplexity(func), 3); // base + if + else
  });

  it('should count for loop as +1', () => {
    const code = `function test() { for (let i = 0; i < 10; i++) {} }`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const func = sourceFile.statements[0] as ts.FunctionDeclaration;
    assert.strictEqual(calculateComplexity(func), 2); // base + for
  });

  it('should count logical operators', () => {
    const code = `function test() { return a && b || c; }`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const func = sourceFile.statements[0] as ts.FunctionDeclaration;
    assert.strictEqual(calculateComplexity(func), 3); // base + && + ||
  });

  it('should count ternary operator as +1', () => {
    const code = `function test() { return x ? 1 : 2; }`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const func = sourceFile.statements[0] as ts.FunctionDeclaration;
    assert.strictEqual(calculateComplexity(func), 2); // base + ?:
  });
});

describe('countLOC', () => {
  it('should count simple function lines', () => {
    const code = `function test() {\n  return 1;\n}`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const func = sourceFile.statements[0] as ts.FunctionDeclaration;
    assert.strictEqual(countLOC(sourceFile, func), 3);
  });

  it('should exclude empty lines', () => {
    const code = `function test() {\n\n  return 1;\n\n}`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const func = sourceFile.statements[0] as ts.FunctionDeclaration;
    assert.strictEqual(countLOC(sourceFile, func), 3);
  });

  it('should exclude comment lines', () => {
    const code = `function test() {\n  // comment\n  return 1;\n}`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const func = sourceFile.statements[0] as ts.FunctionDeclaration;
    assert.strictEqual(countLOC(sourceFile, func), 3);
  });
});

describe('extractJSDoc', () => {
  it('should extract JSDoc content', () => {
    const code = `/** Test function */\nexport function test() {}`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    // JSDoc is a comment on the first statement, not a separate statement
    const func = sourceFile.statements[0] as ts.FunctionDeclaration;
    const jsdoc = extractJSDoc(func, sourceFile);
    assert.ok(jsdoc?.includes('Test function'));
  });

  it('should truncate at 200 characters', () => {
    const longComment = 'A'.repeat(300);
    const code = `/** ${longComment} */\nexport function test() {}`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const func = sourceFile.statements[0] as ts.FunctionDeclaration;
    const jsdoc = extractJSDoc(func, sourceFile);
    assert.ok(jsdoc?.length <= 203); // 200 + ellipsis
  });

  it('should return undefined for no JSDoc', () => {
    const code = `export function test() {}`;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true);
    const func = sourceFile.statements[0] as ts.FunctionDeclaration;
    assert.strictEqual(extractJSDoc(func, sourceFile), undefined);
  });
});

describe('generateModuleId', () => {
  it('should generate correct MODULE ID format', () => {
    assert.strictEqual(generateModuleId('src/utils.ts', 'formatDate'), 'MODULE:src/utils.ts#formatDate');
  });

  it('should handle default name', () => {
    assert.strictEqual(generateModuleId('src/index.ts', 'default'), 'MODULE:src/index.ts#default');
  });

  it('should handle numbered defaults', () => {
    assert.strictEqual(generateModuleId('src/index.ts', 'default_1'), 'MODULE:src/index.ts#default_1');
  });
});

describe('ModuleExtractor', () => {
  describe('extractModules', () => {
    it('should extract named function export', async () => {
      const files = [path.join(moduleTestProject, 'src', 'all-kinds.ts')];
      const program = ts.createProgram(files, {
        allowJs: true,
        noEmit: true,
      });
      const sourceFile = program.getSourceFile(files[0])!;
      const extractor = new ModuleExtractor(program, moduleTestProject);
      const result = extractor.extractModules(sourceFile);

      assert.ok(result.nodes.length > 0);
      const funcNode = result.nodes.find(n => n.name === 'namedFunction');
      assert.ok(funcNode);
      assert.strictEqual(funcNode.type, NodeType.MODULE);
      assert.ok(funcNode.id.startsWith('MODULE:'));
    });

    it('should create CONTAINS edges from FILE to MODULE', async () => {
      const files = [path.join(moduleTestProject, 'src', 'all-kinds.ts')];
      const program = ts.createProgram(files, {
        allowJs: true,
        noEmit: true,
      });
      const sourceFile = program.getSourceFile(files[0])!;
      const extractor = new ModuleExtractor(program, moduleTestProject);
      const result = extractor.extractModules(sourceFile);

      assert.ok(result.edges.length > 0);
      const containsEdges = result.edges.filter(e => e.type === EdgeType.CONTAINS);
      assert.ok(containsEdges.length > 0);
    });

    it('should skip non-exported declarations', async () => {
      const files = [path.join(moduleTestProject, 'src', 'all-kinds.ts')];
      const program = ts.createProgram(files, {
        allowJs: true,
        noEmit: true,
      });
      const sourceFile = program.getSourceFile(files[0])!;
      const extractor = new ModuleExtractor(program, moduleTestProject);
      const result = extractor.extractModules(sourceFile);

      // Should not have 'privateFunction'
      const privateNode = result.nodes.find(n => n.name === 'privateFunction');
      assert.strictEqual(privateNode, undefined);
    });

    it('should extract interface export', async () => {
      const files = [path.join(moduleTestProject, 'src', 'all-kinds.ts')];
      const program = ts.createProgram(files, {
        allowJs: true,
        noEmit: true,
      });
      const sourceFile = program.getSourceFile(files[0])!;
      const extractor = new ModuleExtractor(program, moduleTestProject);
      const result = extractor.extractModules(sourceFile);

      const interfaceNode = result.nodes.find(n => n.name === 'MyInterface');
      assert.ok(interfaceNode);
      assert.strictEqual(interfaceNode?.metadata?.kind, 'interface');
    });

    it('should extract type export', async () => {
      const files = [path.join(moduleTestProject, 'src', 'all-kinds.ts')];
      const program = ts.createProgram(files, {
        allowJs: true,
        noEmit: true,
      });
      const sourceFile = program.getSourceFile(files[0])!;
      const extractor = new ModuleExtractor(program, moduleTestProject);
      const result = extractor.extractModules(sourceFile);

      const typeNode = result.nodes.find(n => n.name === 'MyType');
      assert.ok(typeNode);
      assert.strictEqual(typeNode?.metadata?.kind, 'type');
    });

    it('should extract enum with enumMembers', async () => {
      const files = [path.join(moduleTestProject, 'src', 'all-kinds.ts')];
      const program = ts.createProgram(files, {
        allowJs: true,
        noEmit: true,
      });
      const sourceFile = program.getSourceFile(files[0])!;
      const extractor = new ModuleExtractor(program, moduleTestProject);
      const result = extractor.extractModules(sourceFile);

      const enumNode = result.nodes.find(n => n.name === 'MyEnum');
      assert.ok(enumNode);
      assert.strictEqual(enumNode?.metadata?.kind, 'type');
      assert.ok(enumNode?.metadata?.enumMembers);
      assert.deepStrictEqual(enumNode?.metadata?.enumMembers, ['First', 'Second', 'Third']);
    });

    it('should extract variable export', async () => {
      const files = [path.join(moduleTestProject, 'src', 'all-kinds.ts')];
      const program = ts.createProgram(files, {
        allowJs: true,
        noEmit: true,
      });
      const sourceFile = program.getSourceFile(files[0])!;
      const extractor = new ModuleExtractor(program, moduleTestProject);
      const result = extractor.extractModules(sourceFile);

      const varNode = result.nodes.find(n => n.name === 'SIMPLE_CONSTANT');
      assert.ok(varNode);
      assert.strictEqual(varNode?.metadata?.kind, 'variable');
    });
  });

  describe('named default exports', () => {
    it('should use function name for named default export', async () => {
      const files = [path.join(moduleTestProject, 'src', 'named-default.ts')];
      const program = ts.createProgram(files, {
        allowJs: true,
        noEmit: true,
      });
      const sourceFile = program.getSourceFile(files[0])!;
      const extractor = new ModuleExtractor(program, moduleTestProject);
      const result = extractor.extractModules(sourceFile);

      // Should use "getConfig" not "default"
      const node = result.nodes.find(n => n.name === 'getConfig');
      assert.ok(node, 'Should have MODULE node with function name');
      assert.strictEqual(node?.id, 'MODULE:src/named-default.ts#getConfig');
      assert.strictEqual(node?.metadata?.namedDefault, true);
    });
  });

  describe('anonymous exports', () => {
    it('should use "default" for anonymous function export', async () => {
      const files = [path.join(moduleTestProject, 'src', 'anonymous-export.ts')];
      const program = ts.createProgram(files, {
        allowJs: true,
        noEmit: true,
      });
      const sourceFile = program.getSourceFile(files[0])!;
      const extractor = new ModuleExtractor(program, moduleTestProject);
      const result = extractor.extractModules(sourceFile);

      const node = result.nodes.find(n => n.name === 'default');
      assert.ok(node, 'Should have MODULE node with name "default"');
      assert.strictEqual(node?.id, 'MODULE:src/anonymous-export.ts#default');
      assert.strictEqual(node?.metadata?.kind, 'function');
    });

    it('should use "default" for anonymous class export', async () => {
      const files = [path.join(moduleTestProject, 'src', 'anonymous-class.ts')];
      const program = ts.createProgram(files, {
        allowJs: true,
        noEmit: true,
      });
      const sourceFile = program.getSourceFile(files[0])!;
      const extractor = new ModuleExtractor(program, moduleTestProject);
      const result = extractor.extractModules(sourceFile);

      const node = result.nodes.find(n => n.name === 'default');
      assert.ok(node, 'Should have MODULE node with name "default"');
      assert.strictEqual(node?.metadata?.kind, 'class');
    });
  });

  describe('renamed exports', () => {
    it('should use exported name for renamed export', async () => {
      const files = [path.join(moduleTestProject, 'src', 'renamed-export.ts')];
      const program = ts.createProgram(files, {
        allowJs: true,
        noEmit: true,
      });
      const sourceFile = program.getSourceFile(files[0])!;
      const extractor = new ModuleExtractor(program, moduleTestProject);
      const result = extractor.extractModules(sourceFile);

      // Should use exported name "formatDate" not internal name
      const node = result.nodes.find(n => n.name === 'formatDate');
      assert.ok(node, 'Should have MODULE with exported name');
      assert.strictEqual(node?.metadata?.originalName, 'formatDateInternal');
    });
  });

  describe('component detection', () => {
    it('should detect component with JSX.Element return type', async () => {
      const files = [path.join(moduleTestProject, 'src', 'component-detection.tsx')];
      const program = ts.createProgram(files, {
        allowJs: true,
        jsx: ts.JsxEmit.ReactJSX,
        noEmit: true,
      });
      const sourceFile = program.getSourceFile(files[0])!;
      const extractor = new ModuleExtractor(program, moduleTestProject);
      const result = extractor.extractModules(sourceFile);

      const headerNode = result.nodes.find(n => n.name === 'Header');
      assert.ok(headerNode);
      assert.strictEqual(headerNode?.metadata?.kind, 'component');
    });

    it('should detect component with JSX in body', async () => {
      const files = [path.join(moduleTestProject, 'src', 'component-detection.tsx')];
      const program = ts.createProgram(files, {
        allowJs: true,
        jsx: ts.JsxEmit.ReactJSX,
        noEmit: true,
      });
      const sourceFile = program.getSourceFile(files[0])!;
      const extractor = new ModuleExtractor(program, moduleTestProject);
      const result = extractor.extractModules(sourceFile);

      const buttonNode = result.nodes.find(n => n.name === 'Button');
      assert.ok(buttonNode);
      assert.strictEqual(buttonNode?.metadata?.kind, 'component');
    });

    it('should not classify hook as component', async () => {
      const files = [path.join(moduleTestProject, 'src', 'component-detection.tsx')];
      const program = ts.createProgram(files, {
        allowJs: true,
        jsx: ts.JsxEmit.ReactJSX,
        noEmit: true,
      });
      const sourceFile = program.getSourceFile(files[0])!;
      const extractor = new ModuleExtractor(program, moduleTestProject);
      const result = extractor.extractModules(sourceFile);

      const hookNode = result.nodes.find(n => n.name === 'useModal');
      assert.ok(hookNode);
      assert.strictEqual(hookNode?.metadata?.kind, 'function', 'Hook should be function, not component');
    });
  });

  describe('multiple exports', () => {
    it('should create single node for symbol with multiple exports', async () => {
      const files = [path.join(moduleTestProject, 'src', 'multiple-exports.ts')];
      const program = ts.createProgram(files, {
        allowJs: true,
        noEmit: true,
      });
      const sourceFile = program.getSourceFile(files[0])!;
      const extractor = new ModuleExtractor(program, moduleTestProject);
      const result = extractor.extractModules(sourceFile);

      // Should have exactly one fetchData node (not two)
      const fetchNodes = result.nodes.filter(n => n.name === 'fetchData');
      assert.strictEqual(fetchNodes.length, 1, 'Should have single MODULE for symbol with multiple exports');

      // Should have exports metadata tracking both named and default
      const exportsMeta = fetchNodes[0]?.metadata?.exports;
      assert.ok(exportsMeta, 'Should have exports metadata');
      assert.ok(exportsMeta?.includes('named'), 'Should include named export');
      assert.ok(exportsMeta?.includes('default'), 'Should include default export');
    });

    it('should handle ApiService with multiple exports', async () => {
      const files = [path.join(moduleTestProject, 'src', 'multiple-exports.ts')];
      const program = ts.createProgram(files, {
        allowJs: true,
        noEmit: true,
      });
      const sourceFile = program.getSourceFile(files[0])!;
      const extractor = new ModuleExtractor(program, moduleTestProject);
      const result = extractor.extractModules(sourceFile);

      const apiNodes = result.nodes.filter(n => n.name === 'ApiService');
      assert.strictEqual(apiNodes.length, 1, 'Should have single ApiService MODULE');
      assert.strictEqual(apiNodes[0]?.metadata?.kind, 'class');
    });
  });

  describe('re-exports', () => {
    it('should process export { name } from syntax', async () => {
      // Create a test file with re-export
      const code = `export { formatDate } from './utils/format.js';`;
      const sourceFile = ts.createSourceFile('re-export.ts', code, ts.ScriptTarget.ESNext, true);
      const program = ts.createProgram(['re-export.ts'], {
        allowJs: true,
        noEmit: true,
      });
      const extractor = new ModuleExtractor(program, '/test');
      const result = extractor.extractModules(sourceFile);

      // Should create MODULE node for the re-exported symbol
      const node = result.nodes.find(n => n.name === 'formatDate');
      assert.ok(node, 'Should have MODULE node for re-exported symbol');
    });
  });
});