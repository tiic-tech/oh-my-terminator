import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DefaultParserRegistry, type Parser, type ParserResult } from '../../src/parser-registry.js';

describe('DefaultParserRegistry', () => {
  let registry: DefaultParserRegistry;

  beforeEach(() => {
    registry = new DefaultParserRegistry();
  });

  describe('register', () => {
    it('should register a parser with extensions', () => {
      const parser: Parser = {
        name: 'typescript',
        extensions: ['.ts', '.tsx'],
        parse: async () => ({ nodes: [], edges: [], warnings: [] }),
      };
      registry.register(parser);
      assert.ok(registry.hasParser('.ts'));
      assert.ok(registry.hasParser('.tsx'));
    });

    it('should register multiple parsers', () => {
      const tsParser: Parser = {
        name: 'typescript',
        extensions: ['.ts'],
        parse: async () => ({ nodes: [], edges: [], warnings: [] }),
      };
      const jsParser: Parser = {
        name: 'javascript',
        extensions: ['.js', '.jsx'],
        parse: async () => ({ nodes: [], edges: [], warnings: [] }),
      };
      registry.register(tsParser);
      registry.register(jsParser);
      assert.ok(registry.hasParser('.ts'));
      assert.ok(registry.hasParser('.js'));
      assert.ok(registry.hasParser('.jsx'));
    });

    it('should overwrite parser for same extension', () => {
      const parser1: Parser = {
        name: 'parser1',
        extensions: ['.ts'],
        parse: async () => ({ nodes: [], edges: [], warnings: [] }),
      };
      const parser2: Parser = {
        name: 'parser2',
        extensions: ['.ts'],
        parse: async () => ({ nodes: [], edges: [], warnings: [] }),
      };
      registry.register(parser1);
      registry.register(parser2);
      const result = registry.getParser('.ts');
      assert.strictEqual(result?.name, 'parser2');
    });
  });

  describe('getParser', () => {
    it('should return parser for registered extension', () => {
      const parser: Parser = {
        name: 'typescript',
        extensions: ['.ts'],
        parse: async () => ({ nodes: [], edges: [], warnings: [] }),
      };
      registry.register(parser);
      const result = registry.getParser('.ts');
      assert.strictEqual(result?.name, 'typescript');
    });

    it('should return undefined for unregistered extension', () => {
      const result = registry.getParser('.vue');
      assert.strictEqual(result, undefined);
    });

    it('should return same parser for multiple extensions', () => {
      const parser: Parser = {
        name: 'typescript',
        extensions: ['.ts', '.tsx', '.js'],
        parse: async () => ({ nodes: [], edges: [], warnings: [] }),
      };
      registry.register(parser);
      const tsParser = registry.getParser('.ts');
      const tsxParser = registry.getParser('.tsx');
      const jsParser = registry.getParser('.js');
      assert.strictEqual(tsParser?.name, 'typescript');
      assert.strictEqual(tsxParser?.name, 'typescript');
      assert.strictEqual(jsParser?.name, 'typescript');
    });
  });

  describe('hasParser', () => {
    it('should return true for registered extension', () => {
      const parser: Parser = {
        name: 'typescript',
        extensions: ['.ts'],
        parse: async () => ({ nodes: [], edges: [], warnings: [] }),
      };
      registry.register(parser);
      assert.strictEqual(registry.hasParser('.ts'), true);
    });

    it('should return false for unregistered extension', () => {
      assert.strictEqual(registry.hasParser('.vue'), false);
    });
  });

  describe('getAllExtensions', () => {
    it('should return empty array when no parsers registered', () => {
      const extensions = registry.getAllExtensions();
      assert.deepEqual(extensions, []);
    });

    it('should return all registered extensions', () => {
      const parser: Parser = {
        name: 'typescript',
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
        parse: async () => ({ nodes: [], edges: [], warnings: [] }),
      };
      registry.register(parser);
      const extensions = registry.getAllExtensions();
      assert.deepEqual(extensions.sort(), ['.js', '.jsx', '.mjs', '.ts', '.tsx'].sort());
    });

    it('should return unique extensions from multiple parsers', () => {
      const parser1: Parser = {
        name: 'typescript',
        extensions: ['.ts', '.tsx'],
        parse: async () => ({ nodes: [], edges: [], warnings: [] }),
      };
      const parser2: Parser = {
        name: 'javascript',
        extensions: ['.js', '.ts'], // .ts overlap
        parse: async () => ({ nodes: [], edges: [], warnings: [] }),
      };
      registry.register(parser1);
      registry.register(parser2);
      const extensions = registry.getAllExtensions();
      // Should have unique extensions
      assert.strictEqual(extensions.length, 3);
      assert.ok(extensions.includes('.ts'));
      assert.ok(extensions.includes('.tsx'));
      assert.ok(extensions.includes('.js'));
    });
  });
});