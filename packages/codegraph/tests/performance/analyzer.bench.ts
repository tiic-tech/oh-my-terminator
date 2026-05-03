/**
 * Performance Benchmarks for analyzeFull function (C5)
 *
 * Measures totalTimeMs for different project sizes and reports results.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { analyzeFull } from '../../src/analyzer.js';

// Helper to format benchmark results
function formatStats(name: string, stats: {
  totalTimeMs: number;
  scanTimeMs: number;
  parseTimeMs: number;
  filesParsed: number;
  modules: number;
  edges: number;
}): void {
  console.log('\n========================================');
  console.log(`Benchmark: ${name}`);
  console.log('========================================');
  console.log(`Total Time:    ${stats.totalTimeMs.toFixed(2)}ms`);
  console.log(`Scan Time:     ${stats.scanTimeMs.toFixed(2)}ms`);
  console.log(`Parse Time:    ${stats.parseTimeMs.toFixed(2)}ms`);
  console.log(`Files Parsed:  ${stats.filesParsed}`);
  console.log(`Modules Found: ${stats.modules}`);
  console.log(`Edges Created: ${stats.edges}`);
  console.log('========================================\n');
}

describe('Performance Benchmarks', () => {
  it('should analyze import-test-project in < 2s', async () => {
    const projectPath = path.resolve('tests/fixtures/import-test-project');
    const result = await analyzeFull(projectPath);

    formatStats('import-test-project', result.stats);

    // Report detailed breakdown
    console.log('Warnings:', result.warnings.length > 0 ? result.warnings : 'None');

    // Performance assertion: should complete in under 2 seconds
    assert.ok(
      result.stats.totalTimeMs < 2000,
      `Expected totalTimeMs < 2000, got ${result.stats.totalTimeMs}ms`
    );
  });

  it('should analyze module-test-project in < 2s', async () => {
    const projectPath = path.resolve('tests/fixtures/module-test-project');
    const result = await analyzeFull(projectPath);

    formatStats('module-test-project', result.stats);

    // Report detailed breakdown
    console.log('Warnings:', result.warnings.length > 0 ? result.warnings : 'None');

    // Performance assertion: should complete in under 2 seconds
    assert.ok(
      result.stats.totalTimeMs < 2000,
      `Expected totalTimeMs < 2000, got ${result.stats.totalTimeMs}ms`
    );
  });

  it('should analyze performance-small (20 files) in < 2s', async () => {
    const projectPath = path.resolve('tests/fixtures/performance-small');
    const result = await analyzeFull(projectPath);

    formatStats('performance-small (20 files)', result.stats);

    // Report detailed breakdown
    console.log('Warnings:', result.warnings.length > 0 ? result.warnings : 'None');

    // Performance assertion: should complete in under 2 seconds
    assert.ok(
      result.stats.totalTimeMs < 2000,
      `Expected totalTimeMs < 2000, got ${result.stats.totalTimeMs}ms`
    );
  });

  it('should provide consistent timing across multiple runs', async () => {
    const projectPath = path.resolve('tests/fixtures/performance-small');

    // Run multiple times to check consistency
    const runs = 3;
    const times: number[] = [];

    console.log('\n========================================');
    console.log(`Consistency Test: ${runs} runs`);
    console.log('========================================');

    for (let i = 0; i < runs; i++) {
      const result = await analyzeFull(projectPath);
      times.push(result.stats.totalTimeMs);
      console.log(`Run ${i + 1}: ${result.stats.totalTimeMs.toFixed(2)}ms`);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);

    console.log('----------------------------------------');
    console.log(`Average: ${avg.toFixed(2)}ms`);
    console.log(`Std Dev: ${stdDev.toFixed(2)}ms`);
    console.log('========================================\n');

    // Standard deviation should be reasonable (< 20% of average)
    assert.ok(
      stdDev < avg * 0.2,
      `Expected stdDev < 20% of avg (${avg * 0.2}ms), got ${stdDev}ms`
    );
  });
});