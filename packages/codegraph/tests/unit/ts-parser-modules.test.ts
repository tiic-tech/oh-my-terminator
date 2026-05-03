import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { TypeScriptParser, parseImports } from '../../src/parser/ts-parser.js';
import { NodeType, EdgeType } from '../../src/types.js';

const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');
const moduleTestProject = path.join(fixturesDir, 'module-test-project');

describe('TypeScriptParser MODULE integration', () => {
  describe('parseFile with modules', () => {
    it('should extract MODULE nodes from file', () => {
      const parser = new TypeScriptParser(moduleTestProject);
      const filePath = path.join(moduleTestProject, 'src', 'all-kinds.ts');
      const result = parser.parseFile(filePath);

      // Should have MODULE nodes
      const moduleNodes = result.nodes.filter(n => n.type === NodeType.MODULE);
      assert.ok(moduleNodes.length > 0, 'Should have MODULE nodes');

      // Should have namedFunction
      const funcNode = moduleNodes.find(n => n.name === 'namedFunction');
      assert.ok(funcNode, 'Should have namedFunction MODULE');
      assert.strictEqual(funcNode?.path, 'src/all-kinds.ts');
    });

    it('should create CONTAINS edges from FILE to MODULE', () => {
      const parser = new TypeScriptParser(moduleTestProject);
      const filePath = path.join(moduleTestProject, 'src', 'all-kinds.ts');
      const result = parser.parseFile(filePath);

      // Should have CONTAINS edges
      const containsEdges = result.edges.filter(e => e.type === EdgeType.CONTAINS);
      assert.ok(containsEdges.length > 0, 'Should have CONTAINS edges');

      // Should be from FILE to MODULE
      for (const edge of containsEdges) {
        assert.ok(edge.from.startsWith('FILE:'), 'Edge source should be FILE');
        assert.ok(edge.to.startsWith('MODULE:'), 'Edge target should be MODULE');
      }
    });

    it('should include metadata in MODULE nodes', () => {
      const parser = new TypeScriptParser(moduleTestProject);
      const filePath = path.join(moduleTestProject, 'src', 'all-kinds.ts');
      const result = parser.parseFile(filePath);

      const moduleNodes = result.nodes.filter(n => n.type === NodeType.MODULE);

      // Function should have kind
      const funcNode = moduleNodes.find(n => n.name === 'namedFunction');
      assert.ok(funcNode?.metadata?.kind, 'MODULE should have kind metadata');

      // Class should have kind
      const classNode = moduleNodes.find(n => n.name === 'MyClass');
      assert.ok(classNode?.metadata?.kind === 'class', 'Class MODULE should have kind=class');
    });
  });

  describe('parseAll with modules', () => {
    it('should combine MODULE nodes from all files', () => {
      const parser = new TypeScriptParser(moduleTestProject);
      const files = [
        path.join(moduleTestProject, 'src', 'all-kinds.ts'),
        path.join(moduleTestProject, 'src', 'enum-declaration.ts'),
      ];
      const result = parser.parseAll(files);

      const moduleNodes = result.nodes.filter(n => n.type === NodeType.MODULE);
      assert.ok(moduleNodes.length > 2, 'Should have MODULE nodes from multiple files');

      // Should have enum members
      const enumNode = moduleNodes.find(n => n.name === 'Status');
      assert.ok(enumNode?.metadata?.enumMembers, 'Enum should have enumMembers');
    });
  });
});