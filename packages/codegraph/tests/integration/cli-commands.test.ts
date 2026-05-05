/**
 * @fileoverview CLI Commands Integration Tests (Section 6)
 *
 * WHY: Validates full CLI command flows for scope, impact, layers, and help.
 * Tests P0 fix for update with compressed baseline (1.1 format).
 *
 * Coverage:
 * - 6.1: Update with compressed baseline (P0 fix verification)
 * - 6.2: Scope command full flow
 * - 6.3: Impact command full flow
 * - 6.4: Layers command full flow
 * - 6.5: Help shows all commands
 *
 * @see Section 6 tasks
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { mkdtemp, rm, writeFile, readFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { spawn } from 'child_process';
import { existsSync } from 'node:fs';

import {
  updateCommand,
  scopeCommand,
  impactCommand,
  layersCommand,
} from '../../src/cli/commands/index.js';
import { analyzeCommand } from '../../src/cli/commands/analyze.js';
import { loadBaselineFile, saveBaseline, ensureCodegraphDir } from '../../src/persistence/index.js';
import { CliErrorCode } from '../../src/types.js';
import { NodeType, EdgeType } from '../../src/types.js';
import type { Baseline, GraphNode, GraphEdge } from '../../src/types.js';
import { CodeGraph } from '../../src/graph.js';
import { serializeCompressed } from '../../src/persistence/compression/index.js';

// ============================================================================
// Test Fixtures Paths
// ============================================================================

const FIXTURES_DIR = join(dirname(new URL(import.meta.url).pathname), '../fixtures');
const BASELINE_1_1_PATH = join(FIXTURES_DIR, 'baseline-1.1.json');
const CLI_PATH = resolve(import.meta.dirname, '../../bin/codegraph.ts');
const PACKAGE_DIR = resolve(import.meta.dirname, '../../');

// Fix: Use resolve from path module
import { resolve } from 'node:path';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a temporary git repository for testing
 *
 * WHY: Each test needs isolated git environment to avoid state pollution.
 */
async function createTestGitRepo(): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'codegraph-cli-commands-test-'));

  // Initialize git repo
  execSync('git init', { cwd: tempDir, encoding: 'utf-8' });
  execSync('git config user.email "test@test.com"', { cwd: tempDir, encoding: 'utf-8' });
  execSync('git config user.name "Test User"', { cwd: tempDir, encoding: 'utf-8' });

  // Create src directory
  await mkdir(join(tempDir, 'src'));

  return tempDir;
}

/**
 * Add a new file to the test repo and commit
 */
async function addFile(repo: string, file: string, content: string): Promise<void> {
  const filePath = join(repo, file);

  // Ensure parent directory exists
  const dir = join(repo, file.split('/').slice(0, -1).join('/'));
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  await writeFile(filePath, content);
  execSync(`git add "${file}"`, { cwd: repo, encoding: 'utf-8' });
  execSync(`git commit -m "Add ${file}"`, { cwd: repo, encoding: 'utf-8' });
}

/**
 * Modify an existing file in the test repo and commit
 */
async function modifyFile(repo: string, file: string, content: string): Promise<void> {
  const filePath = join(repo, file);
  await writeFile(filePath, content);
  execSync(`git add "${file}"`, { cwd: repo, encoding: 'utf-8' });
  execSync(`git commit -m "Modify ${file}"`, { cwd: repo, encoding: 'utf-8' });
}

/**
 * Execute CLI command and capture output
 *
 * WHY: Spawns actual process for real-world testing, not just importing module.
 */
async function runCLI(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolvePromise) => {
    const child = spawn('pnpm', ['tsx', CLI_PATH, ...args], {
      cwd: PACKAGE_DIR,
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolvePromise({ stdout, stderr, exitCode: code ?? 0 });
    });
  });
}

/**
 * Create a sample graph with imports for testing scope/impact/layers
 */
function createSampleGraphWithImports(): CodeGraph {
  const graph = new CodeGraph();

  // Add FILE nodes
  const fileNode1: GraphNode = {
    id: 'FILE:src/core.ts',
    type: NodeType.FILE,
    path: 'src/core.ts',
    name: 'core.ts',
  };
  graph.addNode(fileNode1);

  const fileNode2: GraphNode = {
    id: 'FILE:src/utils.ts',
    type: NodeType.FILE,
    path: 'src/utils.ts',
    name: 'utils.ts',
  };
  graph.addNode(fileNode2);

  const fileNode3: GraphNode = {
    id: 'FILE:src/app.ts',
    type: NodeType.FILE,
    path: 'src/app.ts',
    name: 'app.ts',
  };
  graph.addNode(fileNode3);

  // Add MODULE nodes
  const moduleNode1: GraphNode = {
    id: 'MODULE:src/core.ts#CoreService',
    type: NodeType.MODULE,
    path: 'src/core.ts',
    name: 'CoreService',
    metadata: {
      kind: 'class',
      isExported: true,
      jsDoc: 'Core service module',
    },
  };
  graph.addNode(moduleNode1);

  const moduleNode2: GraphNode = {
    id: 'MODULE:src/utils.ts#formatDate',
    type: NodeType.MODULE,
    path: 'src/utils.ts',
    name: 'formatDate',
    metadata: {
      kind: 'function',
      isExported: true,
      jsDoc: 'Format date utility',
    },
  };
  graph.addNode(moduleNode2);

  // Add EXTERNAL nodes
  const externalNode1: GraphNode = {
    id: 'EXTERNAL:lodash',
    type: NodeType.EXTERNAL,
    path: 'lodash',
    name: 'lodash',
  };
  graph.addNode(externalNode1);

  const externalNode2: GraphNode = {
    id: 'EXTERNAL:axios',
    type: NodeType.EXTERNAL,
    path: 'axios',
    name: 'axios',
  };
  graph.addNode(externalNode2);

  // Add CONTAINS edges
  graph.addEdge({
    from: 'FILE:src/core.ts',
    to: 'MODULE:src/core.ts#CoreService',
    type: EdgeType.CONTAINS,
  });

  graph.addEdge({
    from: 'FILE:src/utils.ts',
    to: 'MODULE:src/utils.ts#formatDate',
    type: EdgeType.CONTAINS,
  });

  // Add IMPORTS edges (defines dependency structure)
  // app.ts imports core.ts and utils.ts
  graph.addEdge({
    from: 'FILE:src/app.ts',
    to: 'FILE:src/core.ts',
    type: EdgeType.IMPORTS,
  });

  graph.addEdge({
    from: 'FILE:src/app.ts',
    to: 'FILE:src/utils.ts',
    type: EdgeType.IMPORTS,
  });

  // core.ts imports lodash and utils.ts
  graph.addEdge({
    from: 'FILE:src/core.ts',
    to: 'EXTERNAL:lodash',
    type: EdgeType.IMPORTS,
  });

  graph.addEdge({
    from: 'FILE:src/core.ts',
    to: 'FILE:src/utils.ts',
    type: EdgeType.IMPORTS,
  });

  // utils.ts imports axios
  graph.addEdge({
    from: 'FILE:src/utils.ts',
    to: 'EXTERNAL:axios',
    type: EdgeType.IMPORTS,
  });

  graph.commitHash = 'test-commit-hash';
  graph.timestamp = Date.now();

  return graph;
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('CLI Commands Integration Tests (Section 6)', () => {
  let testRepo: string;

  beforeEach(async () => {
    testRepo = await createTestGitRepo();
  });

  afterEach(async () => {
    await rm(testRepo, { recursive: true, force: true });
  });

  // ============================================================================
  // 6.1: Update with compressed baseline (P0 fix verification)
  // ============================================================================

  describe('6.1: Update with compressed baseline', () => {
    it('should load compressed (1.1) baseline and update successfully', async () => {
      // Create initial files
      await addFile(testRepo, 'src/initial.ts', 'export const initial = 1;');

      // Create baseline using analyze (which saves compressed by default)
      await analyzeCommand(testRepo);

      // Verify baseline exists
      const baselinePath = join(testRepo, '.codegraph/baseline.json');
      assert.ok(existsSync(baselinePath), 'Baseline should exist');

      // Verify it's 1.1 format (compressed)
      const content = await readFile(baselinePath, 'utf-8');
      const parsed = JSON.parse(content);
      assert.ok(parsed.pathTable, 'Baseline should be 1.1 format with pathTable');

      // Add new file
      await addFile(testRepo, 'src/new.ts', 'export const newFile = 2;');

      // Run update command - this should load compressed baseline successfully
      const result = await updateCommand(testRepo);

      // Verify update succeeded (P0 fix verification)
      assert.strictEqual(result.success, true, 'Update should succeed with compressed baseline');
      assert.ok(result.changes.added.includes('src/new.ts'), 'Should detect added file');
      assert.ok(result.delta.newNodes > 0, 'Should add new nodes');

      // Verify updated baseline is still 1.1 format
      const updatedContent = await readFile(baselinePath, 'utf-8');
      const updatedParsed = JSON.parse(updatedContent);
      assert.ok(updatedParsed.pathTable, 'Updated baseline should still be 1.1 format');
    });

    it('should handle update when baseline uses pathTable format', async () => {
      // Create files
      await addFile(testRepo, 'src/a.ts', 'export const a = 1;');
      await addFile(testRepo, 'src/b.ts', 'export const b = 2;');

      // Create graph and save as compressed
      const graph = createSampleGraphWithImports();
      const baseline: Baseline = {
        graph: {
          nodes: Array.from(graph.nodes.entries()),
          edges: graph.edges,
          commitHash: graph.commitHash ?? 'test-hash',
          timestamp: graph.timestamp ?? Date.now(),
        },
        commitHash: graph.commitHash ?? 'test-hash',
        timestamp: Date.now(),
        schemaVersion: { major: 1, minor: 1, patch: 0 },
        generatorVersion: '1.1.0',
        architectureConstraints: [],
        healthScore: 50,
        skillDemand: {
          testWriter: 0.5,
          refactorSpecialist: 0.3,
          architect: 0.2,
          securityReviewer: 0.1,
        },
      };

      // Ensure .codegraph directory exists before saveBaseline
      await ensureCodegraphDir(testRepo);

      // Save compressed baseline
      await saveBaseline(baseline, testRepo, { compress: true });

      // Add new file after baseline
      await addFile(testRepo, 'src/c.ts', 'export const c = 3;');

      // Run update - should handle compressed baseline
      const result = await updateCommand(testRepo);

      assert.strictEqual(result.success, true, 'Update should work with pre-existing compressed baseline');
    });
  });

  // ============================================================================
  // 6.2: Scope command full flow
  // ============================================================================

  describe('6.2: Scope command full flow', () => {
    it('should query scope for FILE target', async () => {
      // Create files with import relationships
      await addFile(testRepo, 'src/core.ts', `
export class CoreService {
  process() { return 'processed'; }
}
`);
      await addFile(testRepo, 'src/utils.ts', `
import { CoreService } from './core.js';
export function helper(): string {
  return 'helper';
}
`);

      // Create baseline
      await analyzeCommand(testRepo);

      // Query scope for FILE target
      const result = await scopeCommand(testRepo, 'src/utils.ts');

      assert.strictEqual(result.success, true, 'Scope query should succeed');

      // ScopeResult structure: target is string ID, not object
      if (result.success) {
        assert.ok(result.target, 'Should have target ID');
        assert.ok(result.target.startsWith('FILE:') || result.target.includes('utils'), 'Target should be FILE type');
        assert.ok(Array.isArray(result.exports), 'Should have exports array');
        assert.ok(Array.isArray(result.imports), 'Should have imports array');
        assert.ok(Array.isArray(result.importedBy), 'Should have importedBy array');
      }
    });

    it('should query scope for MODULE target', async () => {
      await addFile(testRepo, 'src/utils.ts', `
export function formatDate(date: Date): string {
  return date.toISOString();
}
export function parseDate(str: string): Date {
  return new Date(str);
}
`);

      await analyzeCommand(testRepo);

      // Query scope for MODULE target (normalized ID format)
      const result = await scopeCommand(testRepo, 'MODULE:src/utils.ts#formatDate');

      assert.strictEqual(result.success, true, 'Scope query for MODULE should succeed');

      if (result.success) {
        assert.ok(result.target, 'Should have target ID');
        assert.ok(result.target.includes('formatDate'), 'Target should include module name');
      }
    });

    it('should query scope for EXTERNAL target', async () => {
      await addFile(testRepo, 'src/app.ts', `
import axios from 'axios';
import lodash from 'lodash';
export function main() { return 'main'; }
`);

      await analyzeCommand(testRepo);

      // Query scope for EXTERNAL target
      const result = await scopeCommand(testRepo, 'EXTERNAL:axios');

      assert.strictEqual(result.success, true, 'Scope query for EXTERNAL should succeed');

      if (result.success) {
        assert.ok(result.target, 'Should have target ID');
        assert.ok(result.target.includes('axios'), 'Target should include external name');
      }
    });

    it('should return error for non-existent target', async () => {
      await addFile(testRepo, 'src/main.ts', 'export function main() {}');
      await analyzeCommand(testRepo);

      const result = await scopeCommand(testRepo, 'src/nonexistent.ts');

      assert.strictEqual(result.success, false, 'Scope query should fail for non-existent target');
      assert.ok(result.error, 'Should have error info');
    });

    it('should return error when baseline not found', async () => {
      await addFile(testRepo, 'src/main.ts', 'export function main() {}');

      // No analyze called - no baseline
      const result = await scopeCommand(testRepo, 'src/main.ts');

      assert.strictEqual(result.success, false, 'Scope should fail without baseline');
      assert.strictEqual(result.error?.code, CliErrorCode.E_BASELINE_NOT_FOUND, 'Should have baseline not found error');
    });
  });

  // ============================================================================
  // 6.3: Impact command full flow
  // ============================================================================

  describe('6.3: Impact command full flow', () => {
    it('should find dependents for target file', async () => {
      // Create dependency chain: app.ts -> core.ts -> utils.ts
      await addFile(testRepo, 'src/utils.ts', 'export const util = 1;');
      await addFile(testRepo, 'src/core.ts', `
import { util } from './utils.js';
export const core = util + 1;
`);
      await addFile(testRepo, 'src/app.ts', `
import { core } from './core.js';
export const app = core + 1;
`);

      await analyzeCommand(testRepo);

      // Query impact for utils.ts (leaf of dependency chain)
      const result = await impactCommand(testRepo, 'src/utils.ts');

      assert.strictEqual(result.success, true, 'Impact query should succeed');

      // ImpactResult structure: targets is array, affectedFiles is array
      if (result.success) {
        assert.ok(result.targets, 'Should have targets info');
        assert.ok(Array.isArray(result.affectedFiles), 'Should have affectedFiles array');
        assert.ok(result.summary, 'Should have summary info');

        // utils.ts should have core.ts and app.ts as dependents
        assert.ok(result.summary.total >= 1, 'Should have at least 1 dependent file');
      }
    });

    it('should return empty impact for isolated file', async () => {
      await addFile(testRepo, 'src/isolated.ts', 'export const isolated = 1;');
      await addFile(testRepo, 'src/main.ts', 'export const main = 2;');

      await analyzeCommand(testRepo);

      const result = await impactCommand(testRepo, 'src/isolated.ts');

      assert.strictEqual(result.success, true, 'Impact query should succeed');

      if (result.success) {
        assert.strictEqual(result.summary.total, 0, 'Isolated file should have no dependents');
      }
    });

    it('should respect maxFiles option', async () => {
      // Create multiple dependent files
      await addFile(testRepo, 'src/core.ts', 'export const core = 1;');
      await addFile(testRepo, 'src/a.ts', 'import { core } from "./core.js"; export const a = 1;');
      await addFile(testRepo, 'src/b.ts', 'import { core } from "./core.js"; export const b = 2;');
      await addFile(testRepo, 'src/c.ts', 'import { core } from "./core.js"; export const c = 3;');

      await analyzeCommand(testRepo);

      const result = await impactCommand(testRepo, 'src/core.ts', { maxFiles: 2 });

      assert.strictEqual(result.success, true, 'Impact query should succeed');

      if (result.success) {
        // affectedFiles may be truncated by maxFiles
        assert.ok(result.affectedFiles.length <= 2 || result.truncated, 'Should respect maxFiles limit or show truncated flag');
      }
    });

    it('should return error when baseline not found', async () => {
      await addFile(testRepo, 'src/main.ts', 'export function main() {}');

      // No baseline
      const result = await impactCommand(testRepo, 'src/main.ts');

      assert.strictEqual(result.success, false, 'Impact should fail without baseline');
      assert.strictEqual(result.error?.code, CliErrorCode.E_BASELINE_NOT_FOUND, 'Should have baseline not found error');
    });
  });

  // ============================================================================
  // 6.4: Layers command full flow
  // ============================================================================

  describe('6.4: Layers command full flow', () => {
    it('should show architecture layers', async () => {
      // Create layered structure: app -> service -> utils
      await addFile(testRepo, 'src/utils.ts', 'export const util = 1;');
      await addFile(testRepo, 'src/service.ts', `
import { util } from './utils.js';
export const service = util + 1;
`);
      await addFile(testRepo, 'src/app.ts', `
import { service } from './service.js';
export const app = service + 1;
`);

      await analyzeCommand(testRepo);

      const result = await layersCommand(testRepo);

      assert.strictEqual(result.success, true, 'Layers query should succeed');

      if (result.success) {
        assert.ok(result.layers, 'Should have layers info');
        assert.ok(Array.isArray(result.layers), 'Layers should be an array');
        assert.ok(result.layers.length > 0, 'Should have at least one layer');
      }
    });

    it('should respect sourceRoot option', async () => {
      // Create nested structure
      await mkdir(join(testRepo, 'packages/app/src'), { recursive: true });
      await addFile(testRepo, 'packages/app/src/main.ts', 'export const main = 1;');

      await analyzeCommand(testRepo);

      const result = await layersCommand(testRepo, { sourceRoot: 'packages/app/src' });

      assert.strictEqual(result.success, true, 'Layers query should succeed with custom sourceRoot');
    });

    it('should return error when baseline not found', async () => {
      await addFile(testRepo, 'src/main.ts', 'export function main() {}');

      // No baseline
      const result = await layersCommand(testRepo);

      assert.strictEqual(result.success, false, 'Layers should fail without baseline');
      assert.strictEqual(result.error?.code, CliErrorCode.E_BASELINE_NOT_FOUND, 'Should have baseline not found error');
    });

    it('should handle empty graph gracefully', async () => {
      // Create empty repo (no TypeScript files with exports)
      await addFile(testRepo, 'README.md', '# Test Project');

      await analyzeCommand(testRepo);

      const result = await layersCommand(testRepo);

      // Empty graph should return LayersError (success=false) OR success=true with empty layers
      // Both behaviors are acceptable - check actual behavior
      if (result.success) {
        // Success with empty or minimal layers is acceptable
        assert.ok(Array.isArray(result.layers), 'Should have layers array');
      } else {
        // Failure is also acceptable for empty graph
        assert.ok(result.error, 'Should have error info for empty graph');
      }
    });
  });

  // ============================================================================
  // 6.5: Help shows all commands
  // ============================================================================

  describe('6.5: Help output', () => {
    it('should show all 6 commands in help', async () => {
      const result = await runCLI(['--help']);

      assert.strictEqual(result.exitCode, 0, 'Help command should exit with 0');

      // Verify all commands are shown
      assert.ok(result.stdout.includes('analyze'), 'Help should show analyze command');
      assert.ok(result.stdout.includes('update'), 'Help should show update command');
      assert.ok(result.stdout.includes('migrate'), 'Help should show migrate command');
      assert.ok(result.stdout.includes('impact'), 'Help should show impact command');
      assert.ok(result.stdout.includes('scope'), 'Help should show scope command');
      assert.ok(result.stdout.includes('layers'), 'Help should show layers command');

      // Verify help structure
      assert.ok(result.stdout.includes('Usage'), 'Help should show usage section');
      assert.ok(result.stdout.includes('codegraph'), 'Help should contain CLI name');
    });

    it('should show analyze command options', async () => {
      const result = await runCLI(['analyze', '--help']);

      assert.strictEqual(result.exitCode, 0, 'Analyze help should exit with 0');
      assert.ok(result.stdout.includes('--json'), 'Should show --json option');
      assert.ok(result.stdout.includes('--compress'), 'Should show --compress option');
      assert.ok(result.stdout.includes('--no-compression'), 'Should show --no-compression option');
    });

    it('should show scope command options', async () => {
      const result = await runCLI(['scope', '--help']);

      assert.strictEqual(result.exitCode, 0, 'Scope help should exit with 0');
      assert.ok(result.stdout.includes('--json'), 'Should show --json option');
      assert.ok(result.stdout.includes('--all'), 'Should show --all option');
    });

    it('should show impact command options', async () => {
      const result = await runCLI(['impact', '--help']);

      assert.strictEqual(result.exitCode, 0, 'Impact help should exit with 0');
      assert.ok(result.stdout.includes('--json'), 'Should show --json option');
      assert.ok(result.stdout.includes('--max-files'), 'Should show --max-files option');
      assert.ok(result.stdout.includes('--include-tests'), 'Should show --include-tests option');
    });

    it('should show layers command options', async () => {
      const result = await runCLI(['layers', '--help']);

      assert.strictEqual(result.exitCode, 0, 'Layers help should exit with 0');
      assert.ok(result.stdout.includes('--json'), 'Should show --json option');
      assert.ok(result.stdout.includes('--source-root'), 'Should show --source-root option');
    });
  });
});