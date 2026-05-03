import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_IGNORE_RULES, shouldIgnore } from '../../src/ignore-rules.js';

describe('DEFAULT_IGNORE_RULES', () => {
  it('should include .git/', () => {
    assert.ok(DEFAULT_IGNORE_RULES.includes('.git/'));
  });

  it('should include node_modules/', () => {
    assert.ok(DEFAULT_IGNORE_RULES.includes('node_modules/'));
  });

  it('should include dist/', () => {
    assert.ok(DEFAULT_IGNORE_RULES.includes('dist/'));
  });

  it('should include build/', () => {
    assert.ok(DEFAULT_IGNORE_RULES.includes('build/'));
  });

  it('should include .next/', () => {
    assert.ok(DEFAULT_IGNORE_RULES.includes('.next/'));
  });

  it('should include .cache/', () => {
    assert.ok(DEFAULT_IGNORE_RULES.includes('.cache/'));
  });

  it('should include .codegraph/', () => {
    assert.ok(DEFAULT_IGNORE_RULES.includes('.codegraph/'));
  });

  it('should include coverage/', () => {
    assert.ok(DEFAULT_IGNORE_RULES.includes('coverage/'));
  });
});

describe('shouldIgnore', () => {
  it('should ignore .git directory', () => {
    assert.strictEqual(shouldIgnore('.git', DEFAULT_IGNORE_RULES), true);
  });

  it('should ignore .git/foo/bar', () => {
    assert.strictEqual(shouldIgnore('.git/foo/bar', DEFAULT_IGNORE_RULES), true);
  });

  it('should ignore node_modules at root', () => {
    assert.strictEqual(shouldIgnore('node_modules', DEFAULT_IGNORE_RULES), true);
  });

  it('should ignore node_modules/foo', () => {
    assert.strictEqual(shouldIgnore('node_modules/foo', DEFAULT_IGNORE_RULES), true);
  });

  it('should ignore nested node_modules', () => {
    assert.strictEqual(shouldIgnore('src/node_modules/util', DEFAULT_IGNORE_RULES), true);
  });

  it('should not ignore src/main.ts', () => {
    assert.strictEqual(shouldIgnore('src/main.ts', DEFAULT_IGNORE_RULES), false);
  });

  it('should not ignore src/components', () => {
    assert.strictEqual(shouldIgnore('src/components', DEFAULT_IGNORE_RULES), false);
  });

  it('should ignore dist folder', () => {
    assert.strictEqual(shouldIgnore('dist', DEFAULT_IGNORE_RULES), true);
  });

  it('should ignore dist/bundle.js', () => {
    assert.strictEqual(shouldIgnore('dist/bundle.js', DEFAULT_IGNORE_RULES), true);
  });
});