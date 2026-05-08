import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  type FullAnalysisResult,
  type AnalysisStats,
  type AnalysisOptions,
  type ProgressEvent,
  type ProgressCallback,
  type Parser,
  type ParserResult,
  type ParserRegistry,
} from '../../src/types.js';

describe('FullAnalysisResult interface', () => {
  it('should allow creating a result with graph, stats, and warnings', () => {
    const result: FullAnalysisResult = {
      graph: {} as any, // Placeholder for test
      stats: {
        scanTimeMs: 100,
        parseTimeMs: 500,
        totalTimeMs: 600,
        filesParsed: 10,
        parseErrors: 0,
        directories: 5,
        files: 10,
        modules: 20,
        edges: 30,
      },
      warnings: [],
    };
    assert.strictEqual(result.stats.totalTimeMs, 600);
    assert.strictEqual(result.warnings.length, 0);
  });

  it('should allow result with warnings', () => {
    const result: FullAnalysisResult = {
      graph: {} as any,
      stats: {
        scanTimeMs: 100,
        parseTimeMs: 500,
        totalTimeMs: 600,
        filesParsed: 8,
        parseErrors: 2,
        directories: 5,
        files: 10,
        modules: 16,
        edges: 24,
      },
      warnings: ['Parse failed: src/bad.ts', 'Parse failed: lib/error.js'],
    };
    assert.strictEqual(result.warnings.length, 2);
    assert.strictEqual(result.stats.parseErrors, 2);
  });
});

describe('AnalysisStats interface', () => {
  it('should include all timing fields', () => {
    const stats: AnalysisStats = {
      scanTimeMs: 100,
      parseTimeMs: 500,
      totalTimeMs: 600,
      filesParsed: 10,
      parseErrors: 0,
      directories: 5,
      files: 10,
      modules: 20,
      edges: 30,
    };
    assert.strictEqual(typeof stats.scanTimeMs, 'number');
    assert.strictEqual(typeof stats.parseTimeMs, 'number');
    assert.strictEqual(typeof stats.totalTimeMs, 'number');
  });

  it('should include all count fields', () => {
    const stats: AnalysisStats = {
      scanTimeMs: 0,
      parseTimeMs: 0,
      totalTimeMs: 0,
      filesParsed: 0,
      parseErrors: 0,
      directories: 0,
      files: 0,
      modules: 0,
      edges: 0,
    };
    assert.strictEqual(typeof stats.filesParsed, 'number');
    assert.strictEqual(typeof stats.parseErrors, 'number');
    assert.strictEqual(typeof stats.directories, 'number');
    assert.strictEqual(typeof stats.files, 'number');
    assert.strictEqual(typeof stats.modules, 'number');
    assert.strictEqual(typeof stats.edges, 'number');
  });
});

describe('AnalysisOptions interface', () => {
  it('should allow empty options', () => {
    const options: AnalysisOptions = {};
    assert.deepEqual(options, {});
  });

  it('should allow extensions option', () => {
    const options: AnalysisOptions = {
      extensions: ['.ts', '.tsx', '.vue'],
    };
    assert.deepEqual(options.extensions, ['.ts', '.tsx', '.vue']);
  });

  it('should allow onProgress callback', () => {
    const callback: ProgressCallback = (event) => {
      console.log(event.phase);
    };
    const options: AnalysisOptions = {
      onProgress: callback,
    };
    assert.strictEqual(typeof options.onProgress, 'function');
  });

  it('should allow scanOptions', () => {
    const options: AnalysisOptions = {
      scanOptions: {
        extensions: ['.ts'],
        maxDepth: 10,
      },
    };
    assert.strictEqual(options.scanOptions?.maxDepth, 10);
  });
});

describe('ProgressEvent interface', () => {
  it('should allow scan phase event', () => {
    const event: ProgressEvent = {
      phase: 'scan',
      current: 1,
      total: 1,
      message: 'Found 10 files',
    };
    assert.strictEqual(event.phase, 'scan');
    assert.strictEqual(event.current, 1);
  });

  it('should allow parse phase event with filePath', () => {
    const event: ProgressEvent = {
      phase: 'parse',
      current: 5,
      total: 10,
      filePath: 'src/utils.ts',
    };
    assert.strictEqual(event.phase, 'parse');
    assert.strictEqual(event.filePath, 'src/utils.ts');
  });

  it('should allow complete phase event', () => {
    const event: ProgressEvent = {
      phase: 'complete',
      current: 10,
      total: 10,
      message: 'Analysis complete',
    };
    assert.strictEqual(event.phase, 'complete');
  });
});

describe('Parser interface', () => {
  it('should define parser with name and extensions', () => {
    const parser: Parser = {
      name: 'typescript',
      extensions: ['.ts', '.tsx'],
      parse: async () => ({ nodes: [], edges: [], warnings: [] }),
    };
    assert.strictEqual(parser.name, 'typescript');
    assert.deepEqual(parser.extensions, ['.ts', '.tsx']);
  });

  it('should have parse method returning ParserResult', async () => {
    const parser: Parser = {
      name: 'test',
      extensions: ['.test'],
      parse: async (filePath, content, projectRoot) => ({
        nodes: [],
        edges: [],
        warnings: [],
      }),
    };
    const result = await parser.parse('test.ts', 'content', '/project');
    assert.ok(result.nodes);
    assert.ok(result.edges);
    assert.ok(result.warnings);
  });
});

describe('ParserResult interface', () => {
  it('should allow empty result', () => {
    const result: ParserResult = {
      nodes: [],
      edges: [],
      warnings: [],
    };
    assert.strictEqual(result.nodes.length, 0);
    assert.strictEqual(result.edges.length, 0);
    assert.strictEqual(result.warnings.length, 0);
  });

  it('should allow result with nodes and edges', () => {
    const result: ParserResult = {
      nodes: [{ id: 'FILE:src/main.ts', type: 'FILE' as any, path: 'src/main.ts', name: 'main.ts' }],
      edges: [{ from: 'FILE:src/main.ts', to: 'FILE:src/utils.ts', type: 'IMPORTS' as any }],
      warnings: ['Some warning'],
    };
    assert.strictEqual(result.nodes.length, 1);
    assert.strictEqual(result.edges.length, 1);
    assert.strictEqual(result.warnings.length, 1);
  });
});

describe('ParserRegistry interface', () => {
  it('should define register method', () => {
    const registry: ParserRegistry = {
      register: (parser) => {},
      getParser: (ext) => undefined,
      hasParser: (ext) => false,
      getAllExtensions: () => [],
    };
    assert.strictEqual(typeof registry.register, 'function');
    assert.strictEqual(typeof registry.getParser, 'function');
    assert.strictEqual(typeof registry.hasParser, 'function');
    assert.strictEqual(typeof registry.getAllExtensions, 'function');
  });

  it('should have getParser returning Parser or undefined', () => {
    const registry: ParserRegistry = {
      register: () => {},
      getParser: (ext) => (ext === '.ts' ? { name: 'typescript', extensions: ['.ts'], parse: async () => ({ nodes: [], edges: [], warnings: [] }) } : undefined),
      hasParser: (ext) => ext === '.ts',
      getAllExtensions: () => ['.ts'],
    };
    const tsParser = registry.getParser('.ts');
    const vueParser = registry.getParser('.vue');
    assert.ok(tsParser);
    assert.strictEqual(vueParser, undefined);
  });

  it('should have getAllExtensions returning string array', () => {
    const registry: ParserRegistry = {
      register: () => {},
      getParser: () => undefined,
      hasParser: () => false,
      getAllExtensions: () => ['.ts', '.tsx', '.js', '.jsx'],
    };
    const extensions = registry.getAllExtensions();
    assert.deepEqual(extensions, ['.ts', '.tsx', '.js', '.jsx']);
  });
});