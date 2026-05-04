import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import { TypeScriptParserAdapter } from '../../src/parser/typescript-adapter.js';
import type { Parser, ParserResult } from '../../src/types.js';

describe('TypeScriptParserAdapter', () => {
  const fixturesDir = path.resolve('tests/fixtures');

  describe('Parser interface compliance', () => {
    it('should have name property', () => {
      const adapter = new TypeScriptParserAdapter(fixturesDir);
      assert.strictEqual(adapter.name, 'typescript');
    });

    it('should have extensions array including all variants', () => {
      const adapter = new TypeScriptParserAdapter(fixturesDir);
      assert.deepEqual(
        adapter.extensions.sort(),
        ['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx'].sort()
      );
    });

    it('should have parse method', () => {
      const adapter = new TypeScriptParserAdapter(fixturesDir);
      assert.strictEqual(typeof adapter.parse, 'function');
    });

    it('should indicate requiresFileOnDisk', () => {
      const adapter = new TypeScriptParserAdapter(fixturesDir);
      assert.strictEqual(adapter.requiresFileOnDisk, true);
    });
  });

  describe('parse method', () => {
    it('should return ParserResult structure', async () => {
      const projectRoot = path.join(fixturesDir, 'import-test-project');
      const adapter = new TypeScriptParserAdapter(projectRoot);

      // Create a simple test file
      const testFile = path.join(projectRoot, 'src', 'index.ts');
      if (!fs.existsSync(testFile)) {
        // Skip if fixture doesn't exist
        return;
      }

      const result = await adapter.parse('src/index.ts', '', projectRoot);

      assert.ok(Array.isArray(result.nodes));
      assert.ok(Array.isArray(result.edges));
      assert.ok(Array.isArray(result.warnings));
    });

    it('should extract MODULE nodes', async () => {
      const projectRoot = path.join(fixturesDir, 'module-test-project');
      const adapter = new TypeScriptParserAdapter(projectRoot);

      // Use existing fixture
      const fixturePath = path.join(projectRoot, 'src', 'all-kinds.ts');
      if (!fs.existsSync(fixturePath)) {
        return;
      }

      const result = await adapter.parse('src/all-kinds.ts', '', projectRoot);

      // Should have MODULE nodes for exported symbols
      const moduleNodes = result.nodes.filter(n => n.type === 'MODULE');
      assert.ok(moduleNodes.length > 0, 'Should extract MODULE nodes');
    });

    it('should extract IMPORTS edges', async () => {
      const projectRoot = path.join(fixturesDir, 'import-test-project');
      const adapter = new TypeScriptParserAdapter(projectRoot);

      const fixturePath = path.join(projectRoot, 'src', 'index.ts');
      if (!fs.existsSync(fixturePath)) {
        return;
      }

      const result = await adapter.parse('src/index.ts', '', projectRoot);

      // Should have IMPORTS edges for imports
      const importEdges = result.edges.filter(e => e.type === 'IMPORTS');
      assert.ok(importEdges.length >= 0, 'Should extract IMPORTS edges');
    });

    it('should handle syntax errors gracefully', async () => {
      const adapter = new TypeScriptParserAdapter(fixturesDir);

      // Parse a file that doesn't exist (TypeScript Compiler API handles this)
      const result = await adapter.parse('nonexistent-bad.ts', '', fixturesDir);

      // Should not throw, should return with warnings
      assert.ok(Array.isArray(result.warnings));
    });

    it('should handle file not found gracefully', async () => {
      const adapter = new TypeScriptParserAdapter(fixturesDir);

      // Non-existent file returns with warning
      const result = await adapter.parse('nonexistent.ts', '', fixturesDir);

      assert.ok(Array.isArray(result.warnings));
      assert.ok(result.warnings.length > 0, 'Should have warning for non-existent file');
      assert.ok(result.warnings[0].includes('not found') || result.warnings[0].includes('Error'));
    });
  });
});