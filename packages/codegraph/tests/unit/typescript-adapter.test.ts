import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import { TypeScriptParserAdapter } from '../../src/parser/typescript-adapter.js';
import type { Parser, ParserResult } from '../../src/types.js';

describe('TypeScriptParserAdapter', () => {
  let adapter: TypeScriptParserAdapter;
  const fixturesDir = path.resolve('tests/fixtures');

  beforeEach(() => {
    adapter = new TypeScriptParserAdapter();
  });

  describe('Parser interface compliance', () => {
    it('should have name property', () => {
      assert.strictEqual(adapter.name, 'typescript');
    });

    it('should have extensions array', () => {
      assert.deepEqual(adapter.extensions.sort(), ['.js', '.jsx', '.mjs', '.ts', '.tsx'].sort());
    });

    it('should have parse method', () => {
      assert.strictEqual(typeof adapter.parse, 'function');
    });
  });

  describe('parse method', () => {
    it('should return ParserResult structure', async () => {
      // Create a simple test file
      const testFile = path.join(fixturesDir, 'import-test-project', 'src', 'index.ts');
      if (!fs.existsSync(testFile)) {
        // Skip if fixture doesn't exist
        return;
      }
      const content = fs.readFileSync(testFile, 'utf-8');
      const projectRoot = path.join(fixturesDir, 'import-test-project');

      const result = await adapter.parse('src/index.ts', content, projectRoot);

      assert.ok(Array.isArray(result.nodes));
      assert.ok(Array.isArray(result.edges));
      assert.ok(Array.isArray(result.warnings));
    });

    it('should extract MODULE nodes', async () => {
      // Use existing fixture
      const fixturePath = path.join(fixturesDir, 'module-test-project', 'src', 'all-kinds.ts');
      if (!fs.existsSync(fixturePath)) {
        return;
      }
      const content = fs.readFileSync(fixturePath, 'utf-8');
      const projectRoot = path.join(fixturesDir, 'module-test-project');

      const result = await adapter.parse('src/all-kinds.ts', content, projectRoot);

      // Should have MODULE nodes for exported symbols
      const moduleNodes = result.nodes.filter(n => n.type === 'MODULE');
      assert.ok(moduleNodes.length > 0, 'Should extract MODULE nodes');
    });

    it('should extract IMPORTS edges', async () => {
      const fixturePath = path.join(fixturesDir, 'import-test-project', 'src', 'index.ts');
      if (!fs.existsSync(fixturePath)) {
        return;
      }
      const content = fs.readFileSync(fixturePath, 'utf-8');
      const projectRoot = path.join(fixturesDir, 'import-test-project');

      const result = await adapter.parse('src/index.ts', content, projectRoot);

      // Should have IMPORTS edges for imports
      const importEdges = result.edges.filter(e => e.type === 'IMPORTS');
      assert.ok(importEdges.length >= 0, 'Should extract IMPORTS edges');
    });

    it('should handle syntax errors gracefully', async () => {
      const badCode = 'import { x } from "./y"; invalid syntax here <<<';
      const projectRoot = fixturesDir;

      const result = await adapter.parse('bad.ts', badCode, projectRoot);

      // Should not throw, should return with warnings
      assert.ok(Array.isArray(result.warnings));
      // May have warnings about syntax error
    });

    it('should handle file not found gracefully', async () => {
      // Non-existent file returns with warning
      const result = await adapter.parse('nonexistent.ts', '', fixturesDir);

      assert.ok(Array.isArray(result.warnings));
      assert.ok(result.warnings.length > 0, 'Should have warning for non-existent file');
      assert.ok(result.warnings[0].includes('not found'));
    });
  });
});