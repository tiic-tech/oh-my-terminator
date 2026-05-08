import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import {
  TypeScriptParser,
  parseImports,
  createParserProgram,
  resolveModulePath,
  createExternalNode,
  extractPackageName,
  isBuiltinModule,
  isNodeModulesPath,
  extractPackageFromNodeModules,
  generateImportEdge,
  generateReExportEdge,
  generateDynamicImportEdge,
  ParsedImportInfo,
} from '../../src/parser/index.js';
import { NodeType, EdgeType } from '../../src/types.js';

const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');
const importTestProject = path.join(fixturesDir, 'import-test-project');

describe('TypeScriptParser', () => {
  describe('parseAll', () => {
    it('should return empty result for empty file list', async () => {
      const parser = new TypeScriptParser(importTestProject);
      const result = parser.parseAll([]);

      assert.strictEqual(result.nodes.length, 0);
      assert.strictEqual(result.edges.length, 0);
      assert.strictEqual(result.filesParsed, 0);
    });

    it('should parse multiple files and combine results', async () => {
      const files = [
        path.join(importTestProject, 'src', 'utils', 'format.ts'),
        path.join(importTestProject, 'src', 'utils', 'math.ts'),
      ];

      const parser = new TypeScriptParser(importTestProject);
      const result = parser.parseAll(files);

      assert.ok(result.filesParsed > 0);
      assert.ok(Array.isArray(result.nodes));
      assert.ok(Array.isArray(result.edges));
      assert.ok(Array.isArray(result.warnings));
    });
  });

  describe('named imports', () => {
    it('should extract named import', async () => {
      const files = [path.join(importTestProject, 'src', 'index.ts')];
      const parser = new TypeScriptParser(importTestProject);
      const result = parser.parseAll(files);

      // Find an IMPORTS edge
      const importEdges = result.edges.filter(e => e.type === EdgeType.IMPORTS);
      assert.ok(importEdges.length > 0);

      // Check importSpecifier metadata
      const namedImport = importEdges.find(e =>
        e.metadata?.importSpecifier?.startsWith('named:')
      );
      assert.ok(namedImport, 'Should have named import');
    });
  });

  describe('default imports', () => {
    it('should extract default import with importSpecifier="default"', async () => {
      const files = [path.join(importTestProject, 'src', 'index.ts')];
      const parser = new TypeScriptParser(importTestProject);
      const result = parser.parseAll(files);

      const defaultImport = result.edges.find(e =>
        e.type === EdgeType.IMPORTS &&
        e.metadata?.importSpecifier === 'default'
      );
      assert.ok(defaultImport, 'Should have default import');
    });
  });

  describe('namespace imports', () => {
    it('should extract namespace import with importSpecifier="namespace"', async () => {
      const files = [path.join(importTestProject, 'src', 'index.ts')];
      const parser = new TypeScriptParser(importTestProject);
      const result = parser.parseAll(files);

      const namespaceImport = result.edges.find(e =>
        e.type === EdgeType.IMPORTS &&
        e.metadata?.importSpecifier === 'namespace'
      );
      assert.ok(namespaceImport, 'Should have namespace import');
    });
  });

  describe('side-effect imports', () => {
    it('should extract side-effect import with importSpecifier="empty"', async () => {
      // external-refs.ts has import './setup' at the end
      const files = [path.join(importTestProject, 'src', 'external-refs.ts')];
      const parser = new TypeScriptParser(importTestProject);
      const result = parser.parseAll(files);

      const emptyImport = result.edges.find(e =>
        e.type === EdgeType.IMPORTS &&
        e.metadata?.importSpecifier === 'empty'
      );
      assert.ok(emptyImport, 'Should have side-effect import');
    });
  });
});

describe('re-export parsing', () => {
  it('should extract named re-export', async () => {
    const files = [path.join(importTestProject, 'src', 're-export.ts')];
    const parser = new TypeScriptParser(importTestProject);
    const result = parser.parseAll(files);

    const namedReExport = result.edges.find(e =>
      e.type === EdgeType.RE_EXPORTS &&
      e.metadata?.importSpecifier?.startsWith('named:')
    );
    assert.ok(namedReExport, 'Should have named re-export');
  });

  it('should extract wildcard re-export with importSpecifier="wildcard"', async () => {
    const files = [path.join(importTestProject, 'src', 're-export.ts')];
    const parser = new TypeScriptParser(importTestProject);
    const result = parser.parseAll(files);

    const wildcardReExport = result.edges.find(e =>
      e.type === EdgeType.RE_EXPORTS &&
      e.metadata?.importSpecifier === 'wildcard'
    );
    assert.ok(wildcardReExport, 'Should have wildcard re-export');

    // Should be single edge (not multiple)
    const wildcardEdges = result.edges.filter(e =>
      e.type === EdgeType.RE_EXPORTS &&
      e.metadata?.importSpecifier === 'wildcard'
    );
    assert.strictEqual(wildcardEdges.length, 1, 'Wildcard should be single edge');
  });
});

describe('dynamic imports', () => {
  it('should extract dynamic import() calls', async () => {
    const files = [path.join(importTestProject, 'src', 'dynamic-import.ts')];
    const parser = new TypeScriptParser(importTestProject);
    const result = parser.parseAll(files);

    const dynamicImport = result.edges.find(e =>
      e.type === EdgeType.DYNAMIC_IMPORTS
    );
    assert.ok(dynamicImport, 'Should have dynamic import');

    // Check importSpecifier
    assert.strictEqual(dynamicImport?.metadata?.importSpecifier, 'dynamic');
  });
});

describe('path resolution', () => {
  it('should resolve relative paths', async () => {
    const files = [path.join(importTestProject, 'src', 'index.ts')];
    const parser = new TypeScriptParser(importTestProject);
    const result = parser.parseAll(files);

    // Find edge with relative import
    const relativeImport = result.edges.find(e =>
      e.type === EdgeType.IMPORTS &&
      e.to.startsWith('FILE:')
    );
    assert.ok(relativeImport, 'Should resolve relative imports');
  });

  it('should resolve alias paths from tsconfig', async () => {
    const files = [path.join(importTestProject, 'src', 'aliased-import.ts')];
    const parser = new TypeScriptParser(importTestProject);
    const result = parser.parseAll(files);

    // Should resolve @utils alias
    const aliasImport = result.edges.find(e =>
      e.type === EdgeType.IMPORTS &&
      e.to.includes('utils')
    );
    assert.ok(aliasImport, 'Should resolve alias paths');
  });
});

describe('EXTERNAL nodes', () => {
  it('should create EXTERNAL node for external packages', async () => {
    const files = [path.join(importTestProject, 'src', 'external-refs.ts')];
    const parser = new TypeScriptParser(importTestProject);
    const result = parser.parseAll(files);

    // Should have EXTERNAL nodes
    const externalNodes = result.nodes.filter(n => n.type === NodeType.EXTERNAL);
    assert.ok(externalNodes.length > 0, 'Should create EXTERNAL nodes');
  });

  it('should create EXTERNAL node with correct ID format', async () => {
    const files = [path.join(importTestProject, 'src', 'external-refs.ts')];
    const parser = new TypeScriptParser(importTestProject);
    const result = parser.parseAll(files);

    const externalNode = result.nodes.find(n => n.type === NodeType.EXTERNAL);
    assert.ok(externalNode?.id.startsWith('EXTERNAL:'));
  });

  it('should deduplicate EXTERNAL nodes', async () => {
    const files = [
      path.join(importTestProject, 'src', 'external-refs.ts'),
      path.join(importTestProject, 'src', 'index.ts'),
    ];
    const parser = new TypeScriptParser(importTestProject);
    const result = parser.parseAll(files);

    // Count lodash references
    const lodashNodes = result.nodes.filter(n =>
      n.type === NodeType.EXTERNAL && n.name === 'lodash'
    );
    assert.strictEqual(lodashNodes.length, 1, 'Should deduplicate EXTERNAL nodes');
  });

  it('should handle built-in modules', async () => {
    assert.strictEqual(isBuiltinModule('fs'), true);
    assert.strictEqual(isBuiltinModule('path'), true);
    assert.strictEqual(isBuiltinModule('node:fs'), true);
    assert.strictEqual(isBuiltinModule('lodash'), false);
  });
});

describe('extractPackageName', () => {
  it('should extract package name from regular specifier', () => {
    assert.strictEqual(extractPackageName('lodash'), 'lodash');
    assert.strictEqual(extractPackageName('lodash/debounce'), 'lodash');
  });

  it('should extract package name from scoped specifier', () => {
    assert.strictEqual(extractPackageName('@types/node'), '@types/node');
    assert.strictEqual(extractPackageName('@utils/format'), '@utils/format');
  });

  it('should handle built-in modules', () => {
    assert.strictEqual(extractPackageName('fs'), 'fs');
    assert.strictEqual(extractPackageName('node:fs'), 'fs');
  });
});

describe('isNodeModulesPath', () => {
  it('should detect node_modules in relative path', () => {
    assert.strictEqual(isNodeModulesPath('../node_modules/typescript/lib/typescript.d.ts'), true);
    assert.strictEqual(isNodeModulesPath('node_modules/lodash/index.js'), true);
  });

  it('should detect node_modules in absolute path', () => {
    assert.strictEqual(isNodeModulesPath('/full/path/node_modules/lodash/debounce.js'), true);
  });

  it('should return false for project paths', () => {
    assert.strictEqual(isNodeModulesPath('src/utils/helper.ts'), false);
    assert.strictEqual(isNodeModulesPath('../src/index.ts'), false);
  });
});

describe('extractPackageFromNodeModules', () => {
  it('should extract regular package name', () => {
    assert.strictEqual(
      extractPackageFromNodeModules('../node_modules/typescript/lib/typescript.d.ts'),
      'typescript'
    );
    assert.strictEqual(
      extractPackageFromNodeModules('node_modules/lodash/index.js'),
      'lodash'
    );
  });

  it('should extract scoped package name', () => {
    assert.strictEqual(
      extractPackageFromNodeModules('node_modules/@types/node/index.d.ts'),
      '@types/node'
    );
    assert.strictEqual(
      extractPackageFromNodeModules('/path/node_modules/@utils/format/dist/index.js'),
      '@utils/format'
    );
  });

  it('should return unknown for malformed paths', () => {
    assert.strictEqual(extractPackageFromNodeModules('no-node_modules-here'), 'unknown');
  });
});

describe('createExternalNode', () => {
  it('should create EXTERNAL node with correct properties', () => {
    const node = createExternalNode('lodash');

    assert.strictEqual(node.id, 'EXTERNAL:lodash');
    assert.strictEqual(node.type, NodeType.EXTERNAL);
    assert.strictEqual(node.path, 'lodash');
    assert.strictEqual(node.name, 'lodash');
  });
});

describe('edge generation', () => {
  const sampleImportInfo: ParsedImportInfo = {
    sourceFile: 'src/index.ts',
    specifier: './utils',
    resolvedPath: 'src/utils.ts',
    line: 5,
    importType: 'import',
    importSpecifier: 'named:formatDate',
  };

  it('should generate IMPORTS edge with correct properties', () => {
    const edge = generateImportEdge(sampleImportInfo);

    assert.strictEqual(edge.from, 'FILE:src/index.ts');
    assert.strictEqual(edge.to, 'FILE:src/utils.ts');
    assert.strictEqual(edge.type, EdgeType.IMPORTS);
    assert.strictEqual(edge.metadata?.line, 5);
    assert.strictEqual(edge.metadata?.importSpecifier, 'named:formatDate');
  });

  it('should generate RE_EXPORTS edge', () => {
    const reExportInfo: ParsedImportInfo = { ...sampleImportInfo, importType: 're-export' };
    const edge = generateReExportEdge(reExportInfo);

    assert.strictEqual(edge.type, EdgeType.RE_EXPORTS);
  });

  it('should generate DYNAMIC_IMPORTS edge', () => {
    const dynamicInfo: ParsedImportInfo = {
      ...sampleImportInfo,
      importType: 'dynamic',
      importSpecifier: 'dynamic',
    };
    const edge = generateDynamicImportEdge(dynamicInfo);

    assert.strictEqual(edge.type, EdgeType.DYNAMIC_IMPORTS);
    assert.strictEqual(edge.metadata?.importSpecifier, 'dynamic');
  });

  it('should generate edge to EXTERNAL node for unresolved imports', () => {
    const externalInfo: ParsedImportInfo = {
      sourceFile: 'src/index.ts',
      specifier: 'lodash',
      resolvedPath: null,
      line: 10,
      importType: 'import',
      importSpecifier: 'named:debounce',
    };
    const edge = generateImportEdge(externalInfo);

    assert.strictEqual(edge.to, 'EXTERNAL:lodash');
  });

  it('should generate edge to EXTERNAL node for node_modules resolved paths', () => {
    // TypeScript resolves npm packages to actual .d.ts files in node_modules,
    // but these should be represented as EXTERNAL nodes, not FILE nodes.
    const nodeModulesInfo: ParsedImportInfo = {
      sourceFile: 'src/parser.ts',
      specifier: 'typescript',
      resolvedPath: '../node_modules/typescript/lib/typescript.d.ts',
      line: 1,
      importType: 'import',
      importSpecifier: 'namespace',
    };
    const edge = generateImportEdge(nodeModulesInfo);

    assert.strictEqual(edge.to, 'EXTERNAL:typescript');
    assert.strictEqual(edge.from, 'FILE:src/parser.ts');
  });

  it('should generate edge to EXTERNAL for scoped packages in node_modules', () => {
    const scopedInfo: ParsedImportInfo = {
      sourceFile: 'src/types.ts',
      specifier: '@types/node',
      resolvedPath: 'node_modules/@types/node/index.d.ts',
      line: 2,
      importType: 'import',
      importSpecifier: 'named:Process',
    };
    const edge = generateImportEdge(scopedInfo);

    assert.strictEqual(edge.to, 'EXTERNAL:@types/node');
  });
});

describe('error handling', () => {
  it('should handle tsconfig.json not found', async () => {
    // Use simple fixture without tsconfig
    const simpleFixture = path.join(fixturesDir, 'simple');
    const files = [path.join(simpleFixture, 'main.ts')];

    const parser = new TypeScriptParser(simpleFixture);
    const result = parser.parseAll(files);

    // Should still work with default options
    assert.ok(result.filesParsed >= 0);
  });

  it('should return warnings on errors', async () => {
    const parser = new TypeScriptParser(importTestProject);
    // Try to parse non-existent file
    const result = parser.parseAll(['/non/existent/file.ts']);

    assert.ok(result.warnings.length > 0);
  });
});